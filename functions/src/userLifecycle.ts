import { FieldValue, type Firestore, Timestamp, type Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export const DELETION_MARKER_RETENTION_MS = 35 * 24 * 60 * 60 * 1000;

/** Read this inside the SAME transaction as every user-owned write. */
export async function assertUserActive(transaction: Transaction, db: Firestore, userId: string): Promise<void> {
  const marker = await transaction.get(db.collection('_accountLifecycle').doc(userId));
  if (marker.exists) {
    throw new HttpsError('failed-precondition', 'Datele acestui cont sunt în curs de ștergere sau transfer. Pornește din nou aplicația.', {
      reason: 'account-inactive',
    });
  }
}

/** No expiry while cleanup is incomplete: a failed deletion must remain fenced. */
export async function beginAccountDeletion(db: Firestore, userId: string): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const ref = db.collection('_accountLifecycle').doc(userId);
    const snapshot = await transaction.get(ref);
    if (snapshot.data()?.state === 'deleted') return;
    transaction.set(ref, { state: 'deleting', updatedAt: FieldValue.serverTimestamp() });
  });
}

export async function finishAccountDeletion(db: Firestore, userId: string, now = Date.now()): Promise<void> {
  await db.collection('_accountLifecycle').doc(userId).set({
    state: 'deleted',
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(now + DELETION_MARKER_RETENTION_MS),
  });
}
