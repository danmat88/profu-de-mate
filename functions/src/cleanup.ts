import type { Firestore, Query } from 'firebase-admin/firestore';

/** Evaluate expiration inside each transaction; a renewed lesson must survive cleanup. */
export async function deleteQueryInBatches(db: Firestore, query: Query): Promise<number> {
  let deleted = 0;
  while (true) {
    const count = await db.runTransaction(async (transaction) => {
      // Keep response/read and deletion index sizes bounded even for rendered lessons.
      const snapshot = await transaction.get(query.limit(8));
      snapshot.docs.forEach((document) => transaction.delete(document.ref));
      return snapshot.size;
    });
    deleted += count;
    if (count < 8) return deleted;
  }
}
