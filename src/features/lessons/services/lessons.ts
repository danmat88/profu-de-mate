import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { collection, doc, getFirestore, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc, where } from '@react-native-firebase/firestore';
import type { MathAnalysis, StoredLesson } from '../../../shared/types';
import { isMathAnalysis } from '../../math/utils/mathContent';
import { firebaseUserSessionKey, initializeFirebaseServices } from '../../../shared/services/firebase';

type LessonListener = (lessons: StoredLesson[]) => void;
type LessonErrorListener = (error: Error) => void;
let favoriteLessonsCache: StoredLesson[] | undefined;
let favoriteLessonsCacheSessionKey: string | null = null;
let favoriteLessonsPrewarm: Promise<void> | null = null;
let warmAttachPromise: Promise<void> | null = null;
let warmUnsubscribe: (() => void) | undefined;
let warmSessionKey: string | null = null;
let warming = false;
let cacheGeneration = 0;
const warmSubscribers = new Set<{ onChange: LessonListener; onError: LessonErrorListener }>();
const cacheListeners = new Set<() => void>();
const DAY_MS = 24 * 60 * 60 * 1000;
const SAVED_RETENTION_MS = 400 * DAY_MS;
const RETENTION_REFRESH_WINDOW_MS = 399 * DAY_MS;
const OFFLINE_FAVORITE_WRITE_TIMEOUT_MS = 1_800;
const retentionRefreshes = new Map<string, number>();

function notifyCacheListeners(): void {
  cacheListeners.forEach((listener) => listener());
}

export function getCachedFavoriteLessons(): StoredLesson[] | undefined {
  const currentSessionKey = firebaseUserSessionKey(getAuth(getApp()).currentUser);
  return currentSessionKey && currentSessionKey === favoriteLessonsCacheSessionKey
    ? favoriteLessonsCache
    : undefined;
}

export function subscribeFavoriteLessonsCache(listener: () => void): () => void {
  cacheListeners.add(listener);
  return () => {
    cacheListeners.delete(listener);
  };
}

export function clearFavoriteLessonsCache(options?: { preserveActiveSession?: boolean }) {
  if (options?.preserveActiveSession) {
    const currentSessionKey = firebaseUserSessionKey(getAuth(getApp()).currentUser);
    if (currentSessionKey && (warmUnsubscribe || warming) && warmSessionKey === currentSessionKey) {
      // Live Firestore snapshot on users/{uid}/lessons is already observing this
      // exact identity and will receive newly merged lessons automatically.
      return;
    }
  }
  cacheGeneration += 1;
  warmUnsubscribe?.();
  warmUnsubscribe = undefined;
  warmSessionKey = null;
  warmAttachPromise = null;
  warmSubscribers.clear();
  warming = false;
  favoriteLessonsCache = undefined;
  favoriteLessonsCacheSessionKey = null;
  favoriteLessonsPrewarm = null;
  retentionRefreshes.clear();
  notifyCacheListeners();
}

async function openDirectFavoriteLessonsSubscription(
  generation: number,
  onChange: LessonListener,
  onError: LessonErrorListener,
): Promise<() => void> {
  const user = await initializeFirebaseServices();
  const sessionKey = firebaseUserSessionKey(user);
  if (!sessionKey) throw new Error('Sesiunea Caietului nu este disponibilă.');
  if (generation !== cacheGeneration || firebaseUserSessionKey(getAuth(getApp()).currentUser) !== sessionKey) {
    return () => {};
  }
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
    if (generation !== cacheGeneration || firebaseUserSessionKey(getAuth(getApp()).currentUser) !== sessionKey) return;
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
    notifyCacheListeners();
    onChange(lessons);
  }, onError);
}

export function prewarmFavoriteLessonsCache(): Promise<void> {
  const currentSessionKey = firebaseUserSessionKey(getAuth(getApp()).currentUser);
  if (!currentSessionKey) return Promise.resolve();
  if (warmSessionKey && warmSessionKey !== currentSessionKey) {
    clearFavoriteLessonsCache();
  }
  if (favoriteLessonsPrewarm && warmSessionKey === currentSessionKey) return favoriteLessonsPrewarm;
  if ((warming || warmUnsubscribe) && warmSessionKey === currentSessionKey) return Promise.resolve();
  warming = true;
  warmSessionKey = currentSessionKey;
  const generation = cacheGeneration;

  let resolveAttached!: () => void;
  const attachPromise = new Promise<void>((resolve) => { resolveAttached = resolve; });
  warmAttachPromise = attachPromise;

  const operation = new Promise<void>((resolve) => {
    let settled = false;
    let failed = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolveAttached();
      resolve();
    };
    const timeout = setTimeout(finish, 3_500);

    openDirectFavoriteLessonsSubscription(
      generation,
      (lessons) => {
        finish();
        warmSubscribers.forEach((subscriber) => subscriber.onChange(lessons));
      },
      (error) => {
        failed = true;
        const subscribers = [...warmSubscribers];
        if (generation === cacheGeneration) {
          warmUnsubscribe?.();
          warmUnsubscribe = undefined;
          warmSessionKey = null;
          warmAttachPromise = null;
          warmSubscribers.clear();
          warming = false;
        }
        finish();
        subscribers.forEach((subscriber) => subscriber.onError(error));
      },
    ).then((stop) => {
      const activeSessionKey = firebaseUserSessionKey(getAuth(getApp()).currentUser);
      if (generation !== cacheGeneration || failed || activeSessionKey !== currentSessionKey) {
        stop();
        if (generation === cacheGeneration) {
          warming = false;
          if (warmSessionKey === currentSessionKey) warmSessionKey = null;
          if (warmAttachPromise === attachPromise) warmAttachPromise = null;
        }
        resolveAttached();
        return;
      }
      warming = false;
      // Keep this listener alive so saving a lesson warms the next visit too.
      warmUnsubscribe = stop;
      warmSessionKey = activeSessionKey;
      resolveAttached();
    }).catch((error: unknown) => {
      const subscribers = [...warmSubscribers];
      if (generation === cacheGeneration) {
        warmSessionKey = null;
        warmAttachPromise = null;
        warmSubscribers.clear();
        warming = false;
      }
      finish();
      const err = error instanceof Error ? error : new Error('Sesiunea Caietului nu este disponibilă.');
      subscribers.forEach((subscriber) => subscriber.onError(err));
    });
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
  if (firebaseUserSessionKey(getAuth(getApp()).currentUser) !== sessionKey) {
    return () => {};
  }

  // Always attach through the single session-scoped warm listener so background
  // merges (`clearFavoriteLessonsCache({ preserveActiveSession: true })`) never
  // orphan or leak direct Firestore snapshots.
  if (warmSessionKey && warmSessionKey !== sessionKey) {
    clearFavoriteLessonsCache();
  }
  if (!warmUnsubscribe && !warming) {
    void prewarmFavoriteLessonsCache();
  }
  const subscriber = { onChange, onError };
  warmSubscribers.add(subscriber);
  if (warmAttachPromise && warmSessionKey === sessionKey) {
    await warmAttachPromise;
  }
  if (favoriteLessonsCache !== undefined && favoriteLessonsCacheSessionKey === sessionKey) {
    onChange(favoriteLessonsCache);
  }
  return () => {
    warmSubscribers.delete(subscriber);
  };
}

export async function setLessonFavorite(lessonId: string, isFavorite: boolean): Promise<void> {
  const user = await initializeFirebaseServices();
  const db = getFirestore(getApp());
  const writePromise = updateDoc(doc(db, 'users', user.uid, 'lessons', lessonId), {
    isFavorite,
    expiresAt: Timestamp.fromMillis(Date.now() + (isFavorite ? SAVED_RETENTION_MS : 7 * DAY_MS)),
    updatedAt: serverTimestamp(),
  });
  // Firestore offline persistence updates local cache and live snapshots
  // immediately, while updateDoc's Promise stays pending until the device
  // regains network. Bound the wait so offline favorite/remove actions never
  // freeze the confirmation modal, while still surfacing immediate errors.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      writePromise,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, OFFLINE_FAVORITE_WRITE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    void writePromise.catch(() => undefined);
  }
}
