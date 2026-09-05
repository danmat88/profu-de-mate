import { createHash } from 'node:crypto';
import { FieldValue, type Firestore, Timestamp } from 'firebase-admin/firestore';
import { bucharestQuotaWindow, COMMERCIAL_PROFILE_RETENTION_MS } from './commercialAccess.js';
import type { CommercialPrincipal } from './commercialIdentity.js';

const PROFILE_BATCH_SIZE = 400;

function retainedRequestCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function transferHashes(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && /^[a-f0-9]{64}$/.test(item))
    : [];
}

function transferHash(requestId: string): string {
  // Analysis request IDs contain high-entropy random data. Keeping only their
  // one-way digest allows exact same-day quota deduplication without retaining
  // the request identifier or any photographed/generated content.
  return createHash('sha256').update(`quota-transfer:${requestId}`, 'utf8').digest('hex');
}

/**
 * Deletes commercial usage belonging to an account while retaining only the
 * current Google allowance counter long enough to prevent delete/recreate
 * abuse. The retained document contains no UID or request identifiers; only
 * bounded one-way transfer hashes may remain for exact quota deduplication.
 */
export async function removeOrRetainCommercialUsage(
  db: Firestore,
  principal: CommercialPrincipal,
  now = Date.now(),
): Promise<void> {
  const snapshot = await db.collection('_commercialUsage')
    .where('principalId', '==', principal.principalId)
    .get();
  if (snapshot.empty) return;

  const window = bucharestQuotaWindow(now);
  const currentDocumentId = `${principal.principalId}_${window.day}`;
  const batch = db.batch();
  snapshot.docs.forEach((document) => {
    if (principal.identity === 'google' && document.id === currentDocumentId) {
      // Replace the complete document rather than merging fields. This is a
      // deliberate data-minimization boundary: legacy identifiers and future
      // metadata cannot survive account deletion by accident.
      const retainedTransferHashes = [...new Set(transferHashes(document.data().transferHashes))].slice(-200);
      batch.set(document.ref, {
        principalId: principal.principalId,
        day: window.day,
        requests: retainedRequestCount(document.data().requests),
        ...(retainedTransferHashes.length > 0 ? { transferHashes: retainedTransferHashes } : {}),
        retainedFor: 'quota-abuse-prevention',
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.parse(window.resetAt)),
      });
    } else {
      batch.delete(document.ref);
    }
  });
  await batch.commit();
}

/**
 * Removes every reversible account link from installation-scoped commercial
 * profiles. The installation principal and its consumed welcome counter remain
 * solely to prevent allowance resets, but no Firebase UID or Google principal
 * may survive account deletion. Unused guest problems remain usable.
 */
export async function unlinkCommercialInstallations(
  db: Firestore,
  accountPrincipalId: string,
  now = Date.now(),
): Promise<number> {
  let updated = 0;
  while (true) {
    const snapshot = await db.collection('_commercialUsers')
      .where('linkedAccountPrincipalId', '==', accountPrincipalId)
      .limit(PROFILE_BATCH_SIZE)
      .get();
    if (snapshot.empty) return updated;

    const batch = db.batch();
    snapshot.docs.forEach((document) => {
      batch.set(document.ref, {
        userId: FieldValue.delete(),
        linkedAccountPrincipalId: FieldValue.delete(),
        linkedAccountUserId: FieldValue.delete(),
        linkedAt: FieldValue.delete(),
        activeMergeTicket: FieldValue.delete(),
        activeMergeExpiresAt: FieldValue.delete(),
        welcomeLocked: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(now + 400 * 24 * 60 * 60 * 1000),
      }, { merge: true });
    });
    await batch.commit();
    updated += snapshot.size;
  }
}

/**
 * Removes every account/session field from the installation profile. A
 * minimized abuse-prevention marker survives only when the installation has
 * actually consumed welcome problems or Play Integrity device recall was
 * claimed. Link-only profiles are deleted instead of leaving empty anonymous
 * records behind after account deletion.
 */
export async function minimizeInstallationProfileForDeletion(
  db: Firestore,
  installationPrincipalId: string,
  now = Date.now(),
): Promise<'deleted' | 'retained'> {
  const reference = db.collection('_commercialUsers').doc(installationPrincipalId);
  const snapshot = await reference.get();
  if (!snapshot.exists) return 'deleted';

  const data = snapshot.data();
  const welcomeRequests = retainedRequestCount(data?.welcomeRequests);
  const deviceRecallClaimed = data?.deviceRecallClaimed === true;
  if (welcomeRequests === 0 && !deviceRecallClaimed) {
    await reference.delete();
    return 'deleted';
  }

  const window = bucharestQuotaWindow(now);
  const currentDay = data?.welcomeTodayDay === window.day;
  const existingHashes = currentDay ? transferHashes(data?.welcomeTodayTransferHashes) : [];
  const currentRequestIds = currentDay && Array.isArray(data?.welcomeTodayRequestIds)
    ? data.welcomeTodayRequestIds.filter((value): value is string => typeof value === 'string')
    : [];
  const knownHashes = new Set(existingHashes);
  const newHashes = [...new Set(
    currentRequestIds.map(transferHash).filter((hash) => !knownHashes.has(hash)),
  )];
  const welcomeTodayTransferHashes = [...new Set([...existingHashes, ...newHashes])].slice(-welcomeRequests);
  const welcomeTodayRetainedRequests = currentDay
    ? Math.min(
        welcomeRequests,
        retainedRequestCount(data?.welcomeTodayRetainedRequests) + newHashes.length,
      )
    : 0;

  await reference.set({
    principalId: installationPrincipalId,
    welcomeRequests,
    ...(welcomeTodayRetainedRequests > 0 ? {
      welcomeTodayDay: window.day,
      welcomeTodayRetainedRequests,
      welcomeTodayTransferHashes,
    } : {}),
    ...(deviceRecallClaimed ? { deviceRecallClaimed: true } : {}),
    retainedFor: 'welcome-abuse-prevention',
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(now + COMMERCIAL_PROFILE_RETENTION_MS),
  });
  return 'retained';
}
