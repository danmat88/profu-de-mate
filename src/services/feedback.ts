import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { getFeedbackAppVersion } from './appInfo';
import { initializeVerifiedFirebaseServices } from './firebase';
import { assertSessionActive, captureSession } from './sessionGuard';

export type FeedbackCategory = 'wrong_answer' | 'unclear' | 'unsafe' | 'other';

export type FeedbackTarget = { lessonId: string; requestId?: never } | { requestId: string; lessonId?: never };

export async function submitLessonFeedback(target: string | FeedbackTarget, category: FeedbackCategory): Promise<void> {
  const session = captureSession();
  await initializeVerifiedFirebaseServices();
  assertSessionActive(session);
  const submit = httpsCallable<{
    lessonId?: string;
    requestId?: string;
    category: FeedbackCategory;
    appVersion: string;
  }, { submitted: boolean }>(getFunctions(getApp(), 'europe-west1'), 'submitLessonFeedback', { timeout: 20_000 });
  const response = await submit({
    ...(typeof target === 'string' ? { lessonId: target } : target),
    category,
    appVersion: getFeedbackAppVersion(),
  });
  assertSessionActive(session);
  if (response.data?.submitted !== true) throw new Error('Raportarea nu a fost confirmată.');
}
