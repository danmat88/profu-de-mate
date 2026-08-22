import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

const DAILY_LIMIT = 30;
const BURST_LIMIT = 4;
const BURST_WINDOW_MS = 60_000;

export async function consumeAnalysisQuota(db: Firestore, userId: string, requestId: string, now = Date.now()): Promise<void> {
  const day = new Date(now).toISOString().slice(0, 10);
  const ref = db.collection('_aiUsage').doc(`${userId}_${day}`);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data();
    const requests = typeof current?.requests === 'number' ? current.requests : 0;
    const requestIds = Array.isArray(current?.requestIds)
      ? current.requestIds.filter((value): value is string => typeof value === 'string')
      : [];
    if (requestIds.includes(requestId)) return;
    const windowStartedAt = current?.windowStartedAt instanceof Timestamp ? current.windowStartedAt.toMillis() : 0;
    const inCurrentWindow = now - windowStartedAt < BURST_WINDOW_MS;
    const burstRequests = inCurrentWindow && typeof current?.burstRequests === 'number' ? current.burstRequests : 0;

    if (requests >= DAILY_LIMIT) {
      throw new HttpsError('resource-exhausted', 'Ai ajuns la limita de analiză pentru astăzi. Revino mâine.');
    }
    if (inCurrentWindow && burstRequests >= BURST_LIMIT) {
      throw new HttpsError('resource-exhausted', 'Ai trimis prea multe imagini prea repede. Așteaptă un minut și încearcă din nou.');
    }

    transaction.set(ref, {
      userId,
      day,
      requests: requests + 1,
      requestIds: [...requestIds, requestId].slice(-DAILY_LIMIT),
      burstRequests: inCurrentWindow ? burstRequests + 1 : 1,
      windowStartedAt: Timestamp.fromMillis(inCurrentWindow ? windowStartedAt : now),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(now + 35 * 24 * 60 * 60 * 1000),
    }, { merge: true });
  });
}
