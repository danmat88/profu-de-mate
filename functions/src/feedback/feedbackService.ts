import { FieldValue, type Firestore, Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { FEEDBACK_RATE_WINDOW_MS, nextFeedbackRateState } from './feedbackSubmission.js';
import { FEEDBACK_RETENTION_MS, feedbackSeverity, isFeedbackCategory } from './feedbackTriage.js';
import { assertUserActive } from '../accounts/userLifecycle.js';

export async function submitFeedback(db: Firestore, uid: string, input: unknown, now = Date.now()): Promise<void> {
  const data = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const isLesson = typeof data.lessonId === 'string';
  const id = isLesson ? data.lessonId : data.requestId;
  const category = data.category;
  const appVersion = typeof data.appVersion === 'string' ? data.appVersion.trim() : '';
  if (typeof id !== 'string' || !/^analysis-[a-z0-9]{6,16}-[a-z0-9]{6,16}$/.test(id)
    || (isLesson && data.requestId !== undefined) || !isFeedbackCategory(category)
    || appVersion.length < 1 || appVersion.length > 24) {
    throw new HttpsError('invalid-argument', 'Raportarea nu este validă.');
  }
  const targetRef = isLesson ? db.collection('users').doc(uid).collection('lessons').doc(id)
    : db.collection('_analysisRequests').doc(`${uid}_${id}`);
  const rateRef = db.collection('_feedbackRateLimits').doc(uid);
  const feedbackRef = db.collection('feedback').doc();
  await db.runTransaction(async (transaction) => {
    await assertUserActive(transaction, db, uid);
    const [target, rate] = await Promise.all([transaction.get(targetRef), transaction.get(rateRef)]);
    const targetData = target.data();
    const result = isLesson ? targetData : targetData?.response?.result;
    if (!target.exists || !result || (!isLesson && (targetData?.state !== 'completed' || targetData.userId !== uid))) {
      throw new HttpsError('not-found', 'Răspunsul nu mai este disponibil pentru raportare.');
    }
    const rateData = rate.data();
    const next = nextFeedbackRateState({
      windowStartedAt: rateData?.windowStartedAt instanceof Timestamp ? rateData.windowStartedAt.toMillis() : undefined,
      submissions: rateData?.submissions,
    }, now);
    if (!next.allowed) throw new HttpsError('resource-exhausted', 'Ai trimis mai multe raportări într-un timp scurt. Încearcă din nou mai târziu.');
    transaction.set(rateRef, {
      userId: uid, windowStartedAt: Timestamp.fromMillis(next.state.windowStartedAt), submissions: next.state.submissions,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(next.state.windowStartedAt + FEEDBACK_RATE_WINDOW_MS + 24 * 60 * 60 * 1000),
    });
    transaction.create(feedbackRef, {
      userId: uid, ...(isLesson ? { lessonId: id } : { requestId: id }), category, appVersion,
      // Keep the reported generated text available for review after its short request cache expires.
      // The photograph is never included in stored analysis/lesson records.
      reportedResult: result,
      status: 'new', severity: feedbackSeverity(category),
      createdAt: Timestamp.fromMillis(now), updatedAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + FEEDBACK_RETENTION_MS),
    });
  });
}

/** Legacy backfill only. Retries neither recreate deleted reports nor reopen resolved ones. */
export async function initializeFeedbackRecord(db: Firestore, ref: DocumentReference): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(ref);
    const data = current.data();
    if (!current.exists || data?.status !== undefined || !isFeedbackCategory(data?.category)) return;
    if (typeof data.userId !== 'string') return;
    await assertUserActive(transaction, db, data.userId);
    const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
    transaction.update(ref, {
      status: 'new', severity: feedbackSeverity(data.category), updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(createdAt + FEEDBACK_RETENTION_MS),
    });
  });
}
