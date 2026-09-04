import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { getFeedbackAppVersion } from './appInfo';
import { initializeVerifiedFirebaseServices } from './firebase';

export type FeedbackCategory = 'wrong_answer' | 'unclear' | 'unsafe' | 'other';

export async function submitLessonFeedback(lessonId: string, category: FeedbackCategory): Promise<void> {
  await initializeVerifiedFirebaseServices();
  const submit = httpsCallable<{
    lessonId: string;
    category: FeedbackCategory;
    appVersion: string;
  }, { submitted: boolean }>(getFunctions(getApp(), 'europe-west1'), 'submitLessonFeedback', { timeout: 20_000 });
  const response = await submit({
    lessonId,
    category,
    appVersion: getFeedbackAppVersion(),
  });
  if (response.data?.submitted !== true) throw new Error('Raportarea nu a fost confirmată.');
}
