import { FieldValue, type Firestore, Timestamp } from 'firebase-admin/firestore';
import { isCommercialPrincipalId } from '../access/commercialIdentity.js';

/**
 * RevenueCat currently shares the stable anti-abuse principal across recreated
 * accounts. Its DELETE API has no generation precondition. A delayed DELETE
 * could therefore delete a new customer's data. Keep the deletion request for
 * explicit resolution; never report it as completed or discard its metadata.
 */
export async function requestRevenueCatDeletionReview(
  db: Firestore,
  appUserId: string,
  userId: string,
): Promise<void> {
  if (!isCommercialPrincipalId(appUserId)) throw new Error('Invalid commercial identity for RevenueCat deletion.');
  const ref = db.collection('_pendingRevenueCatDeletions').doc(appUserId);
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    transaction.set(ref, {
      appUserId,
      ...(!existing.exists ? { userId, createdAt: FieldValue.serverTimestamp(), attempts: 0 } : {}),
      lastRequestedByUserId: userId,
      state: 'review_required',
      reviewReason: 'customer_identity_reused_across_account_generations',
      nextAttemptAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

/** Migrate due historical jobs into a non-destructive review queue. */
export async function deferUnsafeRevenueCatDeletions(
  db: Firestore,
  now = Date.now(),
): Promise<{ inspected: number; completed: 0; reviewRequired: number }> {
  const snapshot = await db.collection('_pendingRevenueCatDeletions')
    .where('nextAttemptAt', '<=', Timestamp.fromMillis(now)).limit(100).get();
  let reviewRequired = 0;
  for (const document of snapshot.docs) {
    const changed = await db.runTransaction(async (transaction) => {
      const current = await transaction.get(document.ref);
      const data = current.data();
      if (!current.exists || !(data?.nextAttemptAt instanceof Timestamp) || data.nextAttemptAt.toMillis() > now) return false;
      const validIdentity = isCommercialPrincipalId(data.appUserId) && data.appUserId === document.id;
      const profile = validIdentity
        ? await transaction.get(db.collection('_commercialUsers').doc(data.appUserId))
        : null;
      transaction.update(document.ref, {
        state: 'review_required',
        reviewReason: !validIdentity ? 'invalid_legacy_identity'
          : typeof profile?.data()?.userId === 'string' ? 'customer_profile_present'
            : 'customer_generation_cannot_be_proven',
        nextAttemptAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (changed) reviewRequired += 1;
  }
  return { inspected: snapshot.size, completed: 0, reviewRequired };
}
