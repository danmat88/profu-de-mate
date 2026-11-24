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

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastPushedSignature = '';
let activeSyncUid: string | null = null;
let unsubStudy: (() => void) | null = null;
let unsubPractice: (() => void) | null = null;

function buildPayload() {
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

async function pushStudyProgressNow(expectedUid: string): Promise<void> {
  try {
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
    lastPushedSignature = signature;
  } catch {
    // Offline or rules not yet deployed: local persistence stays authoritative and retries later.
  }
}

function schedulePush(expectedUid: string): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushStudyProgressNow(expectedUid);
  }, 1_800);
}

/**
 * Stops active listeners and cancels any pending cloud push.
 * Call before clearing local state during account deletion or sign-out.
 */
export function stopStudyProgressSync(): void {
  activeSyncUid = null;
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
  activeSyncUid = uid;
  lastPushedSignature = '';

  let cancelled = false;

  void (async () => {
    try {
      const ref = doc(getFirestore(getApp()), 'users', uid, 'studyProgress', 'summary');
      const snapshot = await getDoc(ref);
      if (cancelled || activeSyncUid !== uid) return;
      if (snapshot.exists()) {
        const data = snapshot.data() as RemoteStudyProgressDoc | undefined;
        if (data) {
          mergeRemoteStudyProfile(data);
          mergeRemotePracticeState(data);
        }
      }
      if (!cancelled && activeSyncUid === uid) {
        schedulePush(uid);
      }
    } catch {
      // Silently ignore offline / unprovisioned rules during local development.
    }
  })();

  unsubStudy = subscribeStudyProfile(() => {
    if (!cancelled && activeSyncUid === uid) schedulePush(uid);
  });
  unsubPractice = subscribePracticeState(() => {
    if (!cancelled && activeSyncUid === uid) schedulePush(uid);
  });

  return () => {
    cancelled = true;
    if (activeSyncUid === uid) {
      stopStudyProgressSync();
    }
  };
}
