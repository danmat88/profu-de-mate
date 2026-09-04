import { FieldValue, type Firestore, Timestamp } from 'firebase-admin/firestore';
import { bucharestQuotaWindow } from './commercialAccess.js';
import type { CommercialPrincipal } from './commercialIdentity.js';

const PROFILE_BATCH_SIZE = 400;

function retainedRequestCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

/**
 * Deletes commercial usage belonging to an account while retaining only the
 * current Google allowance counter long enough to prevent delete/recreate
 * abuse. The retained document contains no UID and no request identifiers.
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
      batch.set(document.ref, {
        principalId: principal.principalId,
        day: window.day,
        requests: retainedRequestCount(document.data().requests),
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
 * profiles. The installation principal and consumed welcome allowance remain
 * solely to prevent delete/reinstall abuse, but no Firebase UID or Google
 * principal may survive account deletion.
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
        welcomeLocked: true,
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(now + 400 * 24 * 60 * 60 * 1000),
      }, { merge: true });
    });
    await batch.commit();
    updated += snapshot.size;
  }
}
