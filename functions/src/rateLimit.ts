import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

const DAILY_LIMIT = 30;
const DEFAULT_GLOBAL_DAILY_LIMIT = 300;
const BURST_LIMIT = 4;
const BURST_WINDOW_MS = 60_000;

type DailyQuotaData = { requests?: unknown; requestIds?: unknown } | undefined;
type GlobalQuotaData = { requests?: unknown } | undefined;

export function buildDailyQuotaRefund(current: DailyQuotaData, requestId: string): { requests: number; requestIds: string[] } | null {
  const requestIds = Array.isArray(current?.requestIds)
    ? current.requestIds.filter((value): value is string => typeof value === 'string')
    : [];
  if (!requestIds.includes(requestId)) return null;

  const requests = typeof current?.requests === 'number' ? current.requests : requestIds.length;
  return {
    requests: Math.max(0, requests - 1),
    requestIds: requestIds.filter((value) => value !== requestId),
  };
}

export function buildGlobalQuotaRefund(current: GlobalQuotaData, userReservationWasRefunded: boolean): number | null {
  if (!userReservationWasRefunded) return null;
  const requests = typeof current?.requests === 'number' ? current.requests : 0;
  return Math.max(0, requests - 1);
}

export async function consumeAnalysisQuota(
  db: Firestore,
  userId: string,
  requestId: string,
  now = Date.now(),
  globalDailyLimit = DEFAULT_GLOBAL_DAILY_LIMIT,
): Promise<void> {
  const day = new Date(now).toISOString().slice(0, 10);
  const userRef = db.collection('_aiUsage').doc(`${userId}_${day}`);
  const globalRef = db.collection('_aiUsage').doc(`_global_${day}`);

  await db.runTransaction(async (transaction) => {
    const [userSnapshot, globalSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(globalRef),
    ]);
    const current = userSnapshot.data();
    const requests = typeof current?.requests === 'number' ? current.requests : 0;
    const requestIds = Array.isArray(current?.requestIds)
      ? current.requestIds.filter((value): value is string => typeof value === 'string')
      : [];
    if (requestIds.includes(requestId)) return;
    const windowStartedAt = current?.windowStartedAt instanceof Timestamp ? current.windowStartedAt.toMillis() : 0;
    const inCurrentWindow = now - windowStartedAt < BURST_WINDOW_MS;
    const burstRequests = inCurrentWindow && typeof current?.burstRequests === 'number' ? current.burstRequests : 0;
    const global = globalSnapshot.data();
    const globalRequests = typeof global?.requests === 'number' ? global.requests : 0;

    if (requests >= DAILY_LIMIT) {
      throw new HttpsError('resource-exhausted', 'Ai ajuns la limita de analiză pentru astăzi. Revino mâine.');
    }
    if (inCurrentWindow && burstRequests >= BURST_LIMIT) {
      throw new HttpsError('resource-exhausted', 'Ai trimis prea multe imagini prea repede. Așteaptă un minut și încearcă din nou.');
    }
    if (globalRequests >= globalDailyLimit) {
      throw new HttpsError('resource-exhausted', 'Profu’ a ajuns la limita de analize pentru astăzi. Încearcă din nou mâine.');
    }

    transaction.set(userRef, {
      userId,
      day,
      requests: requests + 1,
      requestIds: [...requestIds, requestId].slice(-DAILY_LIMIT),
      burstRequests: inCurrentWindow ? burstRequests + 1 : 1,
      windowStartedAt: Timestamp.fromMillis(inCurrentWindow ? windowStartedAt : now),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(now + 35 * 24 * 60 * 60 * 1000),
    }, { merge: true });
    transaction.set(globalRef, {
      day,
      scope: 'global',
      requests: globalRequests + 1,
      // The per-user reservation above is already the idempotency source.
      // This also removes the identifier array written by the earlier version.
      requestIds: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(now + 35 * 24 * 60 * 60 * 1000),
    }, { merge: true });
  });
}

/**
 * Restores only the daily allowance when a request fails after reservation.
 * The minute-level burst counter intentionally records attempts, including
 * failures, so repeated failing requests cannot bypass the anti-abuse window.
 */
export async function refundDailyAnalysisQuota(db: Firestore, userId: string, requestId: string, now = Date.now()): Promise<void> {
  const day = new Date(now).toISOString().slice(0, 10);
  const userRef = db.collection('_aiUsage').doc(`${userId}_${day}`);
  const globalRef = db.collection('_aiUsage').doc(`_global_${day}`);

  await db.runTransaction(async (transaction) => {
    const [userSnapshot, globalSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(globalRef),
    ]);

    const userRefund = userSnapshot.exists ? buildDailyQuotaRefund(userSnapshot.data(), requestId) : null;
    const globalRefund = buildGlobalQuotaRefund(globalSnapshot.data(), Boolean(userRefund));
    if (userRefund) transaction.update(userRef, { ...userRefund, updatedAt: FieldValue.serverTimestamp() });
    if (globalRefund !== null && globalSnapshot.exists) {
      transaction.update(globalRef, {
        requests: globalRefund,
        requestIds: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });
}
