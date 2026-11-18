import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { collection, doc, getFirestore, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc, where } from '@react-native-firebase/firestore';
import type { MathAnalysis, StoredLesson } from '../../../shared/types';
import { isMathAnalysis } from '../../math/utils/mathContent';
import { firebaseUserSessionKey, initializeFirebaseServices } from '../../../shared/services/firebase';

type LessonListener = (lessons: StoredLesson[]) => void;
let favoriteLessonsCache: StoredLesson[] | undefined;
let favoriteLessonsCacheSessionKey: string | null = null;
let favoriteLessonsPrewarm: Promise<void> | null = null;
const DAY_MS = 24 * 60 * 60 * 1000;
const SAVED_RETENTION_MS = 400 * DAY_MS;
const RETENTION_REFRESH_WINDOW_MS = 399 * DAY_MS;
const retentionRefreshes = new Map<string, number>();

export function getCachedFavoriteLessons(): StoredLesson[] | undefined {
  const currentSessionKey = firebaseUserSessionKey(getAuth(getApp()).currentUser);
  return currentSessionKey && currentSessionKey === favoriteLessonsCacheSessionKey
    ? favoriteLessonsCache
    : undefined;
}

export function clearFavoriteLessonsCache() {
  favoriteLessonsCache = undefined;
  favoriteLessonsCacheSessionKey = null;
  favoriteLessonsPrewarm = null;
  retentionRefreshes.clear();
}

export function prewarmFavoriteLessonsCache(): Promise<void> {
  if (getCachedFavoriteLessons() !== undefined) return Promise.resolve();
  if (favoriteLessonsPrewarm) return favoriteLessonsPrewarm;

  const operation = new Promise<void>((resolve) => {
    let settled = false;
    let unsubscribe: (() => void) | undefined;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe?.();
      resolve();
    };
    const timeout = setTimeout(finish, 3_500);

    subscribeToFavoriteLessons(
      () => finish(),
      () => finish(),
    ).then((stop) => {
      unsubscribe = stop;
      if (settled) stop();
    }).catch(() => finish());
  });
  const tracked = operation.finally(() => {
    if (favoriteLessonsPrewarm === tracked) favoriteLessonsPrewarm = null;
  });
  favoriteLessonsPrewarm = tracked;
  return tracked;
}

export async function subscribeToFavoriteLessons(onChange: LessonListener, onError: (error: Error) => void): Promise<() => void> {
  const user = await initializeFirebaseServices();
  const sessionKey = firebaseUserSessionKey(user);
  if (!sessionKey) throw new Error('Sesiunea Caietului nu este disponibilă.');
  const db = getFirestore(getApp());
  const lessonsQuery = query(
    collection(db, 'users', user.uid, 'lessons'),
    where('isFavorite', '==', true),
    orderBy('createdAt', 'desc'),
  );
  const lessonCache = new Map<string, StoredLesson>();
  let previousLessons: StoredLesson[] | undefined;

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
    if (firebaseUserSessionKey(getAuth(getApp()).currentUser) !== sessionKey) return;
    snapshot.docs.forEach((snapshotDoc) => {
      const data = snapshotDoc.data() as { isFavorite?: unknown; expiresAt?: { toMillis?: () => number } };
      const refreshKey = `${sessionKey}:${snapshotDoc.id}`;
      if (data.isFavorite !== true || Date.now() - (retentionRefreshes.get(refreshKey) ?? 0) < DAY_MS) return;
      const expiresAt = data.expiresAt?.toMillis?.() ?? 0;
      if (expiresAt > Date.now() + RETENTION_REFRESH_WINDOW_MS) return;

      retentionRefreshes.set(refreshKey, Date.now());
      void updateDoc(snapshotDoc.ref, {
        isFavorite: true,
        expiresAt: Timestamp.fromMillis(Date.now() + SAVED_RETENTION_MS),
        updatedAt: serverTimestamp(),
      }).catch(() => retentionRefreshes.delete(refreshKey));
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

    if (previousLessons !== undefined && lessons.length === previousLessons.length
      && lessons.every((lesson, index) => lesson === previousLessons?.[index])) return;

    previousLessons = lessons;
    favoriteLessonsCache = lessons;
    favoriteLessonsCacheSessionKey = sessionKey;
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
