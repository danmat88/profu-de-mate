import { getApp } from '@react-native-firebase/app';
import { addDoc, collection, getFirestore, serverTimestamp } from '@react-native-firebase/firestore';
import { getFeedbackAppVersion } from './appInfo';
import { initializeFirebaseServices } from './firebase';

export type FeedbackCategory = 'wrong_answer' | 'unclear' | 'unsafe' | 'other';

export async function submitLessonFeedback(lessonId: string, category: FeedbackCategory): Promise<void> {
  const user = await initializeFirebaseServices();
  const db = getFirestore(getApp());
  await addDoc(collection(db, 'feedback'), {
    userId: user.uid,
    lessonId,
    category,
    createdAt: serverTimestamp(),
    appVersion: getFeedbackAppVersion(),
  });
}
