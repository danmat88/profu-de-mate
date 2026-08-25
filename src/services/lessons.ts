import { getApp } from '@react-native-firebase/app';
import { collection, doc, getFirestore, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc, where } from '@react-native-firebase/firestore';
import type { MathAnalysis, StoredLesson } from '../types';
import { isMathAnalysis } from '../utils/mathContent';
import { initializeFirebaseServices } from './firebase';

type LessonListener = (lessons: StoredLesson[]) => void;
let favoriteLessonsCache: StoredLesson[] | undefined;
const DAY_MS = 24 * 60 * 60 * 1000;
const SAVED_RETENTION_MS = 400 * DAY_MS;
const RETENTION_REFRESH_WINDOW_MS = 60 * DAY_MS;
const retentionRefreshes = new Set<string>();

export function getCachedFavoriteLessons(): StoredLesson[] | undefined {
  return favoriteLessonsCache;
}

export function clearFavoriteLessonsCache() {
  favoriteLessonsCache = undefined;
}

export async function subscribeToFavoriteLessons(onChange: LessonListener, onError: (error: Error) => void): Promise<() => void> {
  const user = await initializeFirebaseServices();
  const db = getFirestore(getApp());
  const lessonsQuery = query(
    collection(db, 'users', user.uid, 'lessons'),
    where('isFavorite', '==', true),
    orderBy('createdAt', 'desc'),
  );
  const lessonCache = new Map<string, StoredLesson>();
  let previousLessons: StoredLesson[] = [];

  const readLesson = (id: string, data: unknown): StoredLesson | null => {
    const stored = data as MathAnalysis & { isFavorite?: unknown; createdAt?: StoredLesson['createdAt'] };
    if (!isMathAnalysis(data) || stored.isFavorite !== true) return null;
    return {
      ...stored,
      id,
      isFavorite: true,
      createdAt: stored.createdAt,
    };
  };

  return onSnapshot(lessonsQuery, (snapshot) => {
    snapshot.docs.forEach((snapshotDoc) => {
      const data = snapshotDoc.data() as { isFavorite?: unknown; expiresAt?: { toMillis?: () => number } };
      if (data.isFavorite !== true || retentionRefreshes.has(snapshotDoc.id)) return;
      const expiresAt = data.expiresAt?.toMillis?.() ?? 0;
      if (expiresAt > Date.now() + RETENTION_REFRESH_WINDOW_MS) return;

      retentionRefreshes.add(snapshotDoc.id);
      void updateDoc(snapshotDoc.ref, {
        isFavorite: true,
        expiresAt: Timestamp.fromMillis(Date.now() + SAVED_RETENTION_MS),
        updatedAt: serverTimestamp(),
      }).catch(() => retentionRefreshes.delete(snapshotDoc.id));
    });

    snapshot.docChanges().forEach((change) => {
      if (change.type === 'removed') {
        lessonCache.delete(change.doc.id);
        return;
      }

      const lesson = readLesson(change.doc.id, change.doc.data());
      if (lesson) lessonCache.set(change.doc.id, lesson);
      else lessonCache.delete(change.doc.id);
    });

    const lessons = snapshot.docs.flatMap((snapshotDoc) => {
      const cached = lessonCache.get(snapshotDoc.id);
      if (cached) return [cached];

      const lesson = readLesson(snapshotDoc.id, snapshotDoc.data());
      if (!lesson) return [];
      lessonCache.set(snapshotDoc.id, lesson);
      return [lesson];
    });

    if (lessons.length === previousLessons.length
      && lessons.every((lesson, index) => lesson === previousLessons[index])) return;

    previousLessons = lessons;
    favoriteLessonsCache = lessons;
    onChange(lessons);
  }, onError);
}

export async function setLessonFavorite(lessonId: string, isFavorite: boolean): Promise<void> {
  const user = await initializeFirebaseServices();
  const db = getFirestore(getApp());
  await updateDoc(doc(db, 'users', user.uid, 'lessons', lessonId), {
    isFavorite,
    expiresAt: Timestamp.fromMillis(Date.now() + (isFavorite ? SAVED_RETENTION_MS : 7 * DAY_MS)),
    updatedAt: serverTimestamp(),
  });
}
