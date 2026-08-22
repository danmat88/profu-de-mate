import { getApp } from '@react-native-firebase/app';
import { collection, doc, getFirestore, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from '@react-native-firebase/firestore';
import type { MathAnalysis, StoredLesson } from '../types';
import { isMathAnalysis } from '../utils/mathContent';
import { initializeFirebaseServices } from './firebase';

type LessonListener = (lessons: StoredLesson[]) => void;

export async function subscribeToFavoriteLessons(onChange: LessonListener, onError: (error: Error) => void): Promise<() => void> {
  const user = await initializeFirebaseServices();
  const db = getFirestore(getApp());
  const lessonsQuery = query(collection(db, 'users', user.uid, 'lessons'), orderBy('createdAt', 'desc'));

  return onSnapshot(lessonsQuery, (snapshot) => {
    const lessons = snapshot.docs.flatMap((snapshotDoc) => {
      const data = snapshotDoc.data();
      const stored = data as MathAnalysis & { isFavorite?: unknown; createdAt?: StoredLesson['createdAt'] };
      if (!isMathAnalysis(data) || stored.isFavorite !== true) return [];
      return [{
        ...data,
        id: snapshotDoc.id,
        isFavorite: true,
        createdAt: stored.createdAt,
      }];
    });
    onChange(lessons);
  }, onError);
}

export async function setLessonFavorite(lessonId: string, isFavorite: boolean): Promise<void> {
  const user = await initializeFirebaseServices();
  const db = getFirestore(getApp());
  await updateDoc(doc(db, 'users', user.uid, 'lessons', lessonId), {
    isFavorite,
    updatedAt: serverTimestamp(),
  });
}
