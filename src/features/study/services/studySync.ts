import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from '@react-native-firebase/firestore';
import {
  getPracticeState,
  mergeRemotePracticeState,
  subscribePracticeState,
} from '../../practice/services/practiceStorage';
import type { StudyTrackId } from '../types';
import {
  getStudyProfile,
  mergeRemoteStudyProfile,
  subscribeStudyProfile,
} from './studyStorage';

type RemoteStudyProgressDoc = {
  track?: StudyTrackId;
  hasChosenTrack?: boolean;
  favoriteFormulaIds?: readonly string[];
  exploredFormulaIds?: readonly string[];
  masteredQuestionIds?: readonly string[];
  wrongQuestionIds?: readonly string[];
  streakDays?: number;
  lastPracticeDateKey?: string | null;
  sessionsCompleted?: number;
  totalAnswered?: number;
  totalCorrect?: number;
};

type StudyProgressPayload = {
  track: StudyTrackId;
  hasChosenTrack: boolean;
  favoriteFormulaIds: string[];
  exploredFormulaIds: string[];
  masteredQuestionIds: string[];
  wrongQuestionIds: string[];
  streakDays: number;
  lastPracticeDateKey: string | null;
  sessionsCompleted: number;
  totalAnswered: number;
  totalCorrect: number;
};

type PullState = 'idle' | 'pulling' | 'ready' | 'failed';

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastPushedSignature = '';
let activeSyncUid: string | null = null;
let pullState: PullState = 'idle';
let dirtyWhilePulling = false;
let applyingRemoteMerge = false;
let syncGeneration = 0;
let unsubStudy: (() => void) | null = null;
let unsubPractice: (() => void) | null = null;

function sanitizeList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    output.push(trimmed);
    if (output.length >= limit) break;
  }
  return output;
}

function buildPayload(): StudyProgressPayload {
  const study = getStudyProfile();
  const practice = getPracticeState();
  const safeAnswered = Math.min(1_000_000, Math.max(0, Math.floor(practice.totalAnswered)));
  const safeCorrect = Math.min(safeAnswered, Math.max(0, Math.floor(practice.totalCorrect)));
  return {
    track: study.track,
    hasChosenTrack: study.hasChosenTrack,
    favoriteFormulaIds: [...study.favoriteFormulaIds].slice(0, 100),
    exploredFormulaIds: [...study.exploredFormulaIds].slice(0, 120),
    masteredQuestionIds: [...practice.masteredQuestionIds].slice(0, 250),
    wrongQuestionIds: [...practice.wrongQuestionIds].slice(0, 120),
    streakDays: Math.min(3650, Math.max(0, Math.floor(practice.streakDays))),
    lastPracticeDateKey: practice.lastPracticeDateKey,
    sessionsCompleted: Math.min(100_000, Math.max(0, Math.floor(practice.sessionsCompleted))),
    totalAnswered: safeAnswered,
    totalCorrect: safeCorrect,
  };
}

function canonicalRemoteSignature(data: RemoteStudyProgressDoc): string {
  const safeAnswered = typeof data.totalAnswered === 'number' && Number.isFinite(data.totalAnswered)
    ? Math.min(1_000_000, Math.max(0, Math.floor(data.totalAnswered)))
    : 0;
  const safeCorrect = typeof data.totalCorrect === 'number' && Number.isFinite(data.totalCorrect)
    ? Math.min(safeAnswered, Math.max(0, Math.floor(data.totalCorrect)))
    : 0;
  const mastered = sanitizeList(data.masteredQuestionIds, 250);
  const masteredSet = new Set(mastered);
  const payload: StudyProgressPayload = {
    track: data.track ?? 'en',
    hasChosenTrack: data.hasChosenTrack === true,
    favoriteFormulaIds: sanitizeList(data.favoriteFormulaIds, 100),
    exploredFormulaIds: sanitizeList(data.exploredFormulaIds, 120),
    masteredQuestionIds: mastered,
    wrongQuestionIds: sanitizeList(data.wrongQuestionIds, 120).filter((id) => !masteredSet.has(id)),
    streakDays: typeof data.streakDays === 'number' && Number.isFinite(data.streakDays)
      ? Math.min(3650, Math.max(0, Math.floor(data.streakDays)))
      : 0,
    lastPracticeDateKey: typeof data.lastPracticeDateKey === 'string' ? data.lastPracticeDateKey : null,
    sessionsCompleted: typeof data.sessionsCompleted === 'number' && Number.isFinite(data.sessionsCompleted)
      ? Math.min(100_000, Math.max(0, Math.floor(data.sessionsCompleted)))
      : 0,
    totalAnswered: safeAnswered,
    totalCorrect: safeCorrect,
  };
  return JSON.stringify(payload);
}

function hasMeaningfulProgress(payload: StudyProgressPayload): boolean {
  return payload.hasChosenTrack
    || payload.favoriteFormulaIds.length > 0
    || payload.exploredFormulaIds.length > 0
    || payload.masteredQuestionIds.length > 0
    || payload.wrongQuestionIds.length > 0
    || payload.streakDays > 0
    || payload.sessionsCompleted > 0
    || payload.totalAnswered > 0;
}

async function pushStudyProgressNow(expectedUid: string, expectedGeneration: number): Promise<void> {
  try {
    if (expectedGeneration !== syncGeneration || activeSyncUid !== expectedUid || pullState !== 'ready') return;
    const user = getAuth(getApp()).currentUser;
    if (!user || user.uid !== expectedUid) return;
    const payload = buildPayload();
    const signature = JSON.stringify(payload);
    if (signature === lastPushedSignature) return;
    const ref = doc(getFirestore(getApp()), 'users', user.uid, 'studyProgress', 'summary');
    await setDoc(ref, {
      ...payload,
      updatedAt: serverTimestamp(),
    });
    if (expectedGeneration === syncGeneration && activeSyncUid === expectedUid) {
      lastPushedSignature = signature;
    }
  } catch {
    // Offline or rules not yet deployed: local persistence stays authoritative and retries later.
  }
}

function schedulePush(expectedUid: string, expectedGeneration: number): void {
  if (expectedGeneration !== syncGeneration || activeSyncUid !== expectedUid) return;
  if (pullState !== 'ready') {
    dirtyWhilePulling = true;
    return;
  }
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushStudyProgressNow(expectedUid, expectedGeneration);
  }, 1_800);
}

function pullAndSync(uid: string, generation: number): void {
  pullState = 'pulling';
  void (async () => {
    try {
      const ref = doc(getFirestore(getApp()), 'users', uid, 'studyProgress', 'summary');
      const snapshot = await getDoc(ref);
      if (generation !== syncGeneration || activeSyncUid !== uid) return;
      const remoteData = snapshot.exists()
        ? (snapshot.data() as RemoteStudyProgressDoc | undefined)
        : undefined;
      if (remoteData) {
        applyingRemoteMerge = true;
        try {
          mergeRemoteStudyProfile(remoteData);
          mergeRemotePracticeState(remoteData);
        } finally {
          applyingRemoteMerge = false;
        }
      }
      if (generation !== syncGeneration || activeSyncUid !== uid) return;
      pullState = 'ready';
      const localPayload = buildPayload();
      const localSignature = JSON.stringify(localPayload);
      if (remoteData) {
        const remoteSignature = canonicalRemoteSignature(remoteData);
        dirtyWhilePulling = false;
        if (localSignature === remoteSignature) {
          lastPushedSignature = localSignature;
        } else {
          schedulePush(uid, generation);
        }
      } else if (hasMeaningfulProgress(localPayload) || dirtyWhilePulling) {
        dirtyWhilePulling = false;
        schedulePush(uid, generation);
      } else {
        lastPushedSignature = localSignature;
      }
    } catch {
      if (generation === syncGeneration && activeSyncUid === uid) {
        pullState = 'failed';
      }
    }
  })();
}

/**
 * Best-effort bounded flush of any unsynced local study/practice changes for
 * the currently active session. Resolves immediately (0ms) when nothing is
 * pending or before the initial pull completes, and never blocks offline
 * sign-out or account switching.
 */
export async function flushStudyProgressSync(timeoutMs = 1_200): Promise<void> {
  const uid = activeSyncUid;
  const generation = syncGeneration;
  if (!uid || pullState !== 'ready') return;
  const currentSignature = JSON.stringify(buildPayload());
  if (!pushTimer && currentSignature === lastPushedSignature) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    void pushStudyProgressNow(uid, generation).finally(finish);
  });
}

/**
 * Re-pulls cloud study progress for the active user (for example after a
 * background retry of pending Google account merges completes).
 */
export function refreshStudyProgressFromCloud(): void {
  if (!activeSyncUid || pullState === 'pulling') return;
  pullAndSync(activeSyncUid, syncGeneration);
}

/** Retries the initial cloud pull when returning online/foreground after an offline failure. */
export function retryStudyProgressSyncIfNeeded(): void {
  if (!activeSyncUid || pullState !== 'failed') return;
  pullAndSync(activeSyncUid, syncGeneration);
}

/**
 * Stops active listeners and cancels any pending cloud push.
 * Call before clearing local state during account deletion or sign-out.
 */
export function stopStudyProgressSync(): void {
  syncGeneration += 1;
  activeSyncUid = null;
  pullState = 'idle';
  dirtyWhilePulling = false;
  lastPushedSignature = '';
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  unsubStudy?.();
  unsubPractice?.();
  unsubStudy = null;
  unsubPractice = null;
}

/**
 * Starts non-blocking offline-first synchronization of study track, favorite
 * formulas, practice mastery, repeat queue, and daily streak for the active
 * Firebase user. Returns a cleanup function.
 */
export function startStudyProgressSync(): () => void {
  stopStudyProgressSync();
  const user = (() => {
    try {
      return getAuth(getApp()).currentUser;
    } catch {
      return null;
    }
  })();

  if (!user) return () => undefined;
  const uid = user.uid;
  const generation = syncGeneration;
  activeSyncUid = uid;
  lastPushedSignature = '';
  dirtyWhilePulling = false;

  pullAndSync(uid, generation);

  unsubStudy = subscribeStudyProfile(() => {
    if (!applyingRemoteMerge && generation === syncGeneration && activeSyncUid === uid) schedulePush(uid, generation);
  });
  unsubPractice = subscribePracticeState(() => {
    if (!applyingRemoteMerge && generation === syncGeneration && activeSyncUid === uid) schedulePush(uid, generation);
  });

  return () => {
    if (generation === syncGeneration && activeSyncUid === uid) {
      stopStudyProgressSync();
    }
  };
}
