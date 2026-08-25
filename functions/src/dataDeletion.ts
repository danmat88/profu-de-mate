import { FieldValue, type Firestore, Timestamp } from 'firebase-admin/firestore';
import { bucharestQuotaWindow } from './commercialAccess.js';
import type { CommercialPrincipal } from './commercialIdentity.js';

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
