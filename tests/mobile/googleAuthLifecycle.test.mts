import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  friendlyGoogleConnectError,
  isGoogleSignInCancelledError,
} from '../../src/features/access/services/googleAuthErrors.ts';
import { serviceLoader } from '../helpers/loadService.mts';

type MockUser = {
  uid: string;
  isAnonymous: boolean;
  providerData: { providerId: string }[];
};

function createGoogleConnectHarness(options: {
  collision?: boolean;
  lagAuthUpdateMs?: number;
  failPostAuthTokenRefresh?: boolean;
  throwCancelled?: boolean;
} = {}) {
  const anonUser: MockUser = { uid: 'anon-1', isAnonymous: true, providerData: [] };
  const linkedSameUidUser: MockUser = {
    uid: 'anon-1',
    isAnonymous: false,
    providerData: [{ providerId: 'google.com' }],
  };
  const existingGoogleUser: MockUser = {
    uid: 'google-99',
    isAnonymous: false,
    providerData: [{ providerId: 'google.com' }],
  };
  const authState: { currentUser: MockUser | null } = { currentUser: anonUser };
  const listeners = new Set<(user: MockUser | null) => void>();
  const disk = new Map<string, string>();
  const diagnosticContexts: string[] = [];
  let mergeCompletedCount = 0;

  const scheduleAuthCommit = (nextUser: MockUser) => {
    const commit = () => {
      authState.currentUser = nextUser;
      listeners.forEach((listener) => listener(nextUser));
    };
    if (options.lagAuthUpdateMs && options.lagAuthUpdateMs > 0) {
      setTimeout(commit, options.lagAuthUpdateMs);
    } else {
      commit();
    }
  };

  const load = serviceLoader({
    '@react-native-firebase/app': { getApp: () => ({}) },
    '@react-native-firebase/auth': {
      getAuth: () => authState,
      GoogleAuthProvider: { credential: (token: string) => ({ token }) },
      onIdTokenChanged: (_auth: unknown, cb: (user: MockUser | null) => void) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      linkWithCredential: async () => {
        if (options.collision) {
          throw Object.assign(new Error('in use'), { code: 'auth/credential-already-in-use' });
        }
        // Simulate Android native bridge lag: linkWithCredential resolves BEFORE
        // auth.currentUser flips from anonymous to identified.
        scheduleAuthCommit(linkedSameUidUser);
        return { user: linkedSameUidUser };
      },
      signInWithCredential: async () => {
        scheduleAuthCommit(existingGoogleUser);
        return { user: existingGoogleUser };
      },
      getIdToken: async () => {
        if (options.failPostAuthTokenRefresh) {
          throw Object.assign(new Error('network blip'), { code: 'auth/network-request-failed' });
        }
        return 'fresh-token';
      },
      reauthenticateWithCredential: async () => ({}),
      signOut: async () => { authState.currentUser = null; },
    },
    '@react-native-firebase/functions': {
      getFunctions: () => ({}),
      httpsCallable: (_f: unknown, name: string) => async () => {
        if (name === 'prepareAccountMerge') {
          return { data: { ticket: '12345678-1234-1234-1234-123456789abc' } };
        }
        if (name === 'completeAccountMergeWithGoogle') {
          mergeCompletedCount += 1;
          return { data: { merged: true, copiedLessons: 1 } };
        }
        return { data: {} };
      },
    },
    'expo-secure-store': {
      getItemAsync: async (key: string) => disk.get(key) ?? null,
      setItemAsync: async (key: string, value: string) => { disk.set(key, value); },
      deleteItemAsync: async (key: string) => { disk.delete(key); },
    },
    'react-native-nitro-google-signin': {
      GoogleOneTapSignIn: {
        configure() {},
        checkPlayServices: async () => {},
        signIn: async () => {
          if (options.throwCancelled) {
            throw Object.assign(new Error('User cancelled'), { code: 'SIGN_IN_CANCELLED' });
          }
          return { type: 'success', data: { idToken: 'google-id-token' } };
        },
        createAccount: async () => ({ type: 'cancelled', data: null }),
        presentExplicitSignIn: async () => ({ type: 'cancelled', data: null }),
      },
      isCancelledResponse: (r: { type?: string }) => r?.type === 'cancelled',
      isNoSavedCredentialFoundResponse: (r: { type?: string }) => r?.type === 'noSavedCredentialFound',
      isSuccessResponse: (r: { type?: string }) => r?.type === 'success',
    },
    'src/features/access/services/commercialAccessCache.ts': {
      clearCachedCommercialAccess: async () => {},
      writeCachedCommercialAccess: async () => {},
    },
    'src/shared/services/deviceIntegrity.ts': { createWelcomeIntegrityProof: async () => ({}) },
    'src/shared/services/firebase.ts': {
      firebaseUserSessionKey: (u: MockUser | null) => (u ? `${u.uid}|${u.isAnonymous ? 'anonymous' : 'identified'}|${u.providerData.map((p) => p.providerId).join(',')}` : null),
      initializeVerifiedFirebaseServices: async () => authState.currentUser,
      recoverFirebaseSessionAfterCallableFailure: async () => null,
      resetFirebaseInitialization() {},
    },
    'src/shared/services/installationIdentity.ts': { getInstallationToken: async () => 'install-token' },
    'src/features/lessons/services/lessons.ts': { clearFavoriteLessonsCache() {} },
    'src/features/exams/services/examStorage.ts': { clearExamLocalState() {} },
    'src/features/practice/services/practiceStorage.ts': { clearPracticeLocalState() {} },
    'src/features/study/services/studyStorage.ts': { clearStudyLocalState() {} },
    'src/features/study/services/studySync.ts': {
      flushStudyProgressSync: async () => {},
      refreshStudyProgressFromCloud() {},
      stopStudyProgressSync() {},
    },
    'src/features/access/services/purchases.ts': {
      initializePurchases: async () => true,
      resetPurchasesForSignedOutUser: async () => {},
    },
    'src/shared/services/diagnostics.ts': {
      recordDiagnosticError: (context: string) => { diagnosticContexts.push(context); },
    },
    'src/features/analysis/services/pendingAnalysis.ts': { discardPendingAnalysis() {} },
    'src/features/math/services/mathDraft.ts': { clearMathDrafts() {} },
  }, {
    process: { env: { EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'test-web-client-id.apps.googleusercontent.com' } },
  });

  const service = load('src/features/access/services/commercial.ts');
  return { service, authState, diagnosticContexts, getMergeCompletedCount: () => mergeCompletedCount };
}

test('connectWithGoogle waits for native auth.currentUser propagation after linkWithCredential without false failure', async () => {
  const { service, authState, getMergeCompletedCount } = createGoogleConnectHarness({
    collision: false,
    lagAuthUpdateMs: 25,
    failPostAuthTokenRefresh: true,
  });

  const user = await service.connectWithGoogle();
  assert.ok(user);
  assert.equal(user.uid, 'anon-1');
  assert.equal(user.isAnonymous, false);
  assert.equal(authState.currentUser?.isAnonymous, false);
  assert.equal(getMergeCompletedCount(), 1, 'merge completes cleanly once auth.currentUser catches up');
});

test('connectWithGoogle waits for native auth.currentUser propagation after signInWithCredential collision switch', async () => {
  const { service, authState, getMergeCompletedCount } = createGoogleConnectHarness({
    collision: true,
    lagAuthUpdateMs: 25,
  });

  const user = await service.connectWithGoogle();
  assert.ok(user);
  assert.equal(user.uid, 'google-99');
  assert.equal(authState.currentUser?.uid, 'google-99');
  assert.equal(getMergeCompletedCount(), 1);
});

test('connectWithGoogle treats thrown SIGN_IN_CANCELLED cleanly as user cancellation', async () => {
  const { service } = createGoogleConnectHarness({ throwCancelled: true });
  const result = await service.connectWithGoogle();
  assert.equal(result, null);
});

test('googleAuthErrors classifies cancellations and native Google Sign-In errors into accurate Romanian copy', () => {
  assert.equal(isGoogleSignInCancelledError({ code: 'SIGN_IN_CANCELLED' }), true);
  assert.equal(isGoogleSignInCancelledError({ code: '12501' }), true);
  assert.equal(isGoogleSignInCancelledError({ code: 'PLAY_SERVICES_NOT_AVAILABLE' }), false);

  assert.match(friendlyGoogleConnectError({ code: 'PLAY_SERVICES_NOT_AVAILABLE' }), /Google Play/);
  assert.match(friendlyGoogleConnectError({ code: 'ONE_TAP_START_FAILED' }), /cont Google disponibil/);
  assert.match(friendlyGoogleConnectError({ code: 'IN_PROGRESS' }), /deja în curs/);
  assert.match(friendlyGoogleConnectError({ code: 'auth/user-disabled' }), /dezactivat/);
  assert.match(friendlyGoogleConnectError({ code: 'auth/network-request-failed' }), /Verifică internetul/);
  assert.equal(
    friendlyGoogleConnectError(new Error('Mai multe conectări așteaptă recuperarea lecțiilor.')),
    'Mai multe conectări așteaptă recuperarea lecțiilor.',
  );
});

test('disconnectGoogleAccount flushes unsaved study progress, stops sync, and wipes all account-owned local stores before signOut', async () => {
  const events: string[] = [];
  const googleUser: MockUser = {
    uid: 'google-1',
    isAnonymous: false,
    providerData: [{ providerId: 'google.com' }],
  };
  const authState: { currentUser: MockUser | null } = { currentUser: googleUser };
  const load = serviceLoader({
    '@react-native-firebase/app': { getApp: () => ({}) },
    '@react-native-firebase/auth': {
      getAuth: () => authState,
      signOut: async () => {
        events.push('signOut');
        authState.currentUser = null;
      },
    },
    '@react-native-firebase/functions': {},
    'expo-secure-store': {},
    'react-native-nitro-google-signin': { GoogleOneTapSignIn: { signOut: async () => {} } },
    'src/features/access/services/commercialAccessCache.ts': { clearCachedCommercialAccess: async () => { events.push('clearAccessCache'); } },
    'src/shared/services/deviceIntegrity.ts': {},
    'src/shared/services/firebase.ts': { resetFirebaseInitialization: () => { events.push('resetFirebase'); } },
    'src/shared/services/installationIdentity.ts': {},
    'src/shared/services/diagnostics.ts': {},
    'src/features/lessons/services/lessons.ts': { clearFavoriteLessonsCache: () => { events.push('clearLessons'); } },
    'src/features/analysis/services/pendingAnalysis.ts': { discardPendingAnalysis: () => { events.push('clearPendingAnalysis'); } },
    'src/features/math/services/mathDraft.ts': { clearMathDrafts: () => { events.push('clearMathDrafts'); } },
    'src/features/exams/services/examStorage.ts': { clearExamLocalState: () => { events.push('clearExams'); } },
    'src/features/practice/services/practiceStorage.ts': { clearPracticeLocalState: () => { events.push('clearPractice'); } },
    'src/features/study/services/studyStorage.ts': { clearStudyLocalState: () => { events.push('clearStudy'); } },
    'src/features/study/services/studySync.ts': {
      flushStudyProgressSync: async () => { events.push('flushStudy'); },
      refreshStudyProgressFromCloud() {},
      stopStudyProgressSync: () => { events.push('stopStudySync'); },
    },
    'src/features/access/services/purchases.ts': { resetPurchasesForSignedOutUser: async () => {} },
  });

  const service = load('src/features/access/services/commercial.ts');
  assert.equal(await service.disconnectGoogleAccount(), null);
  assert.equal(authState.currentUser, null);
  assert.ok(events.indexOf('flushStudy') < events.indexOf('stopStudySync'), 'flush must run before stopping studySync');
  assert.ok(events.indexOf('stopStudySync') < events.indexOf('clearStudy'), 'sync must stop before clearing local stores');
  for (const step of ['clearStudy', 'clearPractice', 'clearExams', 'clearLessons', 'clearPendingAnalysis', 'clearMathDrafts']) {
    assert.ok(events.includes(step), `disconnect must execute ${step}`);
    assert.ok(events.indexOf(step) < events.indexOf('signOut'), `${step} must complete before Firebase signOut`);
  }
});

test('lessons cache coalesces in-flight prewarm with Caiet subscription, emits live cache updates, and preserves live stream across background merge', async () => {
  const googleUser: MockUser = {
    uid: 'google-42',
    isAnonymous: false,
    providerData: [{ providerId: 'google.com' }],
  };
  const authState: { currentUser: MockUser | null } = { currentUser: googleUser };
  let snapshotCalls = 0;
  let unsubCalls = 0;
  let latestSnapshotCb!: (snap: any) => void;
  let releaseInit!: () => void;
  const initGate = new Promise<void>((resolve) => { releaseInit = resolve; });

  const load = serviceLoader({
    '@react-native-firebase/app': { getApp: () => ({}) },
    '@react-native-firebase/auth': { getAuth: () => authState },
    '@react-native-firebase/firestore': {
      collection() {},
      getFirestore() {},
      orderBy() {},
      query() {},
      where() {},
      onSnapshot: (_q: unknown, cb: (snap: any) => void) => {
        snapshotCalls += 1;
        latestSnapshotCb = cb;
        return () => { unsubCalls += 1; };
      },
    },
    'src/shared/services/firebase.ts': {
      initializeFirebaseServices: async () => {
        await initGate;
        return authState.currentUser;
      },
      firebaseUserSessionKey: (u: MockUser | null) => (u ? `${u.uid}|${u.isAnonymous ? 'anon' : 'google'}` : null),
    },
    'src/features/math/utils/mathContent.ts': { isMathAnalysis: () => true },
  });

  const lessons = load('src/features/lessons/services/lessons.ts');
  const cacheCounts: Array<number | undefined> = [];
  const stopCacheWatch = lessons.subscribeFavoriteLessonsCache(() => {
    cacheCounts.push(lessons.getCachedFavoriteLessons()?.length);
  });

  // Start prewarm and Caiet subscription concurrently while initializeFirebaseServices is still in flight.
  const prewarmPromise = lessons.prewarmFavoriteLessonsCache();
  const notebookDeliveries: number[] = [];
  const subPromise = lessons.subscribeToFavoriteLessons(
    (list: unknown[]) => notebookDeliveries.push(list.length),
    assert.fail,
  );

  releaseInit();
  const unsubNotebook = await subPromise;
  assert.equal(snapshotCalls, 1, 'concurrent prewarm + Caiet subscribe must open exactly one Firestore onSnapshot');

  const doc1 = { id: 'lesson-1', data: () => ({ isFavorite: true, expiresAt: { toMillis: () => Date.now() + 400 * 86400000 } }) };
  latestSnapshotCb({ docs: [doc1], docChanges: () => [{ type: 'added', doc: doc1 }] });
  await prewarmPromise;

  assert.deepEqual(notebookDeliveries, [1]);
  assert.deepEqual(cacheCounts, [1]);

  // Background merge completion for the same signed-in user must preserve the live listener.
  lessons.clearFavoriteLessonsCache({ preserveActiveSession: true });
  assert.equal(unsubCalls, 0);

  const doc2 = { id: 'lesson-2', data: () => ({ isFavorite: true, expiresAt: { toMillis: () => Date.now() + 400 * 86400000 } }) };
  latestSnapshotCb({ docs: [doc1, doc2], docChanges: () => [{ type: 'added', doc: doc2 }] });
  assert.deepEqual(notebookDeliveries, [1, 2], 'merged lesson must stream live into mounted Caiet without restart');
  assert.deepEqual(cacheCounts, [1, 2], 'Studio badge and Home preview listeners must update live');

  // Signed-out reset clears cache and notifies cache listeners immediately.
  lessons.clearFavoriteLessonsCache();
  assert.equal(unsubCalls, 1);
  assert.equal(cacheCounts.at(-1), undefined);

  // Offline signed-out prewarm must be a no-op (never creating a rogue anonymous session).
  authState.currentUser = null;
  await lessons.prewarmFavoriteLessonsCache();
  assert.equal(snapshotCalls, 1);

  unsubNotebook();
  stopCacheWatch();
});

test('studySync pulls before pushing, avoids overwriting cloud during slow pull, skips empty guest writes, and flushes on logout', async () => {
  const googleUser: MockUser = {
    uid: 'google-sync',
    isAnonymous: false,
    providerData: [{ providerId: 'google.com' }],
  };
  const authState: { currentUser: MockUser | null } = { currentUser: googleUser };
  let remoteDoc: Record<string, unknown> | null = {
    track: 'bac_m1',
    hasChosenTrack: true,
    favoriteFormulaIds: ['f-cloud'],
    exploredFormulaIds: ['f-cloud'],
    masteredQuestionIds: ['q-1'],
    wrongQuestionIds: ['q-2'],
    streakDays: 4,
    lastPracticeDateKey: '2026-11-25',
    sessionsCompleted: 3,
    totalAnswered: 15,
    totalCorrect: 13,
  };
  let failGetDoc = false;
  let setDocCalls = 0;
  let lastWritten: Record<string, unknown> | null = null;
  let resolvePull!: () => void;
  let pullGate: Promise<void> | null = new Promise<void>((resolve) => { resolvePull = resolve; });

  let studyProfile = {
    track: 'en',
    hasChosenTrack: false,
    favoriteFormulaIds: [] as string[],
    recentFormulaIds: [] as string[],
    exploredFormulaIds: [] as string[],
  };
  const studyListeners = new Set<() => void>();
  let practiceState = {
    wrongQuestionIds: [] as string[],
    masteredQuestionIds: [] as string[],
    streakDays: 0,
    lastPracticeDateKey: null as string | null,
    sessionsCompleted: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    recentSessions: [] as unknown[],
  };
  const practiceListeners = new Set<() => void>();

  const load = serviceLoader({
    '@react-native-firebase/app': { getApp: () => ({}) },
    '@react-native-firebase/auth': { getAuth: () => authState },
    '@react-native-firebase/firestore': {
      doc: (_db: unknown, ...parts: string[]) => parts.join('/'),
      getFirestore: () => ({}),
      serverTimestamp: () => 'SERVER_TS',
      getDoc: async () => {
        if (pullGate) await pullGate;
        if (failGetDoc) throw new Error('offline');
        return {
          exists: () => remoteDoc !== null,
          data: () => remoteDoc ?? undefined,
        };
      },
      setDoc: async (_ref: unknown, data: Record<string, unknown>) => {
        setDocCalls += 1;
        lastWritten = data;
      },
    },
    'src/features/study/services/studyStorage.ts': {
      getStudyProfile: () => studyProfile,
      subscribeStudyProfile: (cb: () => void) => {
        studyListeners.add(cb);
        return () => studyListeners.delete(cb);
      },
      mergeRemoteStudyProfile: (remote: any) => {
        studyProfile = {
          ...studyProfile,
          track: !studyProfile.hasChosenTrack && remote.track ? remote.track : studyProfile.track,
          hasChosenTrack: studyProfile.hasChosenTrack || remote.hasChosenTrack === true,
          favoriteFormulaIds: [...new Set([...studyProfile.favoriteFormulaIds, ...(remote.favoriteFormulaIds ?? [])])],
          exploredFormulaIds: [...new Set([...studyProfile.exploredFormulaIds, ...(remote.exploredFormulaIds ?? [])])],
        };
        studyListeners.forEach((cb) => cb());
        return studyProfile;
      },
    },
    'src/features/practice/services/practiceStorage.ts': {
      getPracticeState: () => practiceState,
      subscribePracticeState: (cb: () => void) => {
        practiceListeners.add(cb);
        return () => practiceListeners.delete(cb);
      },
      mergeRemotePracticeState: (remote: any) => {
        practiceState = {
          ...practiceState,
          masteredQuestionIds: [...new Set([...practiceState.masteredQuestionIds, ...(remote.masteredQuestionIds ?? [])])],
          wrongQuestionIds: [...new Set([...practiceState.wrongQuestionIds, ...(remote.wrongQuestionIds ?? [])])],
          streakDays: Math.max(practiceState.streakDays, remote.streakDays ?? 0),
          lastPracticeDateKey: remote.lastPracticeDateKey ?? practiceState.lastPracticeDateKey,
          sessionsCompleted: Math.max(practiceState.sessionsCompleted, remote.sessionsCompleted ?? 0),
          totalAnswered: Math.max(practiceState.totalAnswered, remote.totalAnswered ?? 0),
          totalCorrect: Math.max(practiceState.totalCorrect, remote.totalCorrect ?? 0),
        };
        practiceListeners.forEach((cb) => cb());
        return practiceState;
      },
    },
  });

  const studySync = load('src/features/study/services/studySync.ts');
  const stop = studySync.startStudyProgressSync();

  // User stars a formula while initial cloud pull is still in flight — must NOT overwrite cloud yet!
  studyProfile = { ...studyProfile, favoriteFormulaIds: ['f-local'] };
  studyListeners.forEach((cb) => cb());
  await studySync.flushStudyProgressSync(50);
  assert.equal(setDocCalls, 0, 'must never push before initial cloud pull merges');

  // Now cloud pull finishes: remote + local merge cleanly, and flush pushes the union!
  resolvePull();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(studyProfile.track, 'bac_m1');
  assert.deepEqual(Array.from(studyProfile.favoriteFormulaIds), ['f-local', 'f-cloud']);
  assert.equal(practiceState.streakDays, 4);

  await studySync.flushStudyProgressSync(200);
  assert.equal(setDocCalls, 1);
  assert.deepEqual(Array.from((lastWritten?.favoriteFormulaIds as string[]) ?? []), ['f-local', 'f-cloud']);

  // Second flush with no further edits must be a 0ms no-op.
  await studySync.flushStudyProgressSync(200);
  assert.equal(setDocCalls, 1);
  stop();

  // Untouched fresh guest with no cloud doc must NOT write an empty doc.
  pullGate = null;
  remoteDoc = null;
  studyProfile = { track: 'en', hasChosenTrack: false, favoriteFormulaIds: [], recentFormulaIds: [], exploredFormulaIds: [] };
  practiceState = { wrongQuestionIds: [], masteredQuestionIds: [], streakDays: 0, lastPracticeDateKey: null, sessionsCompleted: 0, totalAnswered: 0, totalCorrect: 0, recentSessions: [] };
  authState.currentUser = { uid: 'guest-empty', isAnonymous: true, providerData: [] };
  const stopGuest = studySync.startStudyProgressSync();
  await new Promise((resolve) => setTimeout(resolve, 10));
  await studySync.flushStudyProgressSync(100);
  assert.equal(setDocCalls, 1, 'empty guest must not create an empty Firestore studyProgress doc');
  stopGuest();

  // Offline pull failure recovers automatically when retryStudyProgressSyncIfNeeded runs.
  failGetDoc = true;
  remoteDoc = { track: 'bac_m2', hasChosenTrack: true, favoriteFormulaIds: ['f-recovered'] };
  authState.currentUser = googleUser;
  const stopRetry = studySync.startStudyProgressSync();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(studyProfile.track, 'en');
  failGetDoc = false;
  studySync.retryStudyProgressSyncIfNeeded();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(studyProfile.track, 'bac_m2');
  assert.deepEqual(studyProfile.favoriteFormulaIds, ['f-recovered']);
  stopRetry();
});

test('practiceStorage merge commits when wrongQuestionIds changes content at identical length', () => {
  let savedText = '';
  class MockFile {
    exists = false;
    create() { this.exists = true; }
    textSync() { return savedText; }
    write(value: string) { this.exists = true; savedText = value; }
    delete() { this.exists = false; savedText = ''; }
  }
  const load = serviceLoader({
    'expo-file-system': { File: MockFile, Paths: { document: 'doc' } },
    react: { useSyncExternalStore: () => null },
  });
  const storage = load('src/features/practice/services/practiceStorage.ts');
  storage.recordPracticeAnswer('q1', false, true);
  assert.deepEqual(Array.from(storage.getPracticeState().wrongQuestionIds), ['q1']);

  // Remote mastered q1 and has q2 wrong -> nextWrong is ['q2'] (same length 1 as ['q1']!).
  storage.mergeRemotePracticeState({
    masteredQuestionIds: ['q1'],
    wrongQuestionIds: ['q2'],
  });
  assert.deepEqual(Array.from(storage.getPracticeState().wrongQuestionIds), ['q2']);
  assert.deepEqual(Array.from(storage.getPracticeState().masteredQuestionIds), ['q1']);
});

test('Caiet, Studio, Home, and CommercialContext stay wired for instant live identity transitions', async () => {
  const [notebookSource, studioSource, homeSource, contextSource] = await Promise.all([
    readFile(new URL('../../src/features/lessons/screens/NotebookScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/app/screens/StudioScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/home/screens/HomeScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/access/context/CommercialContext.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(notebookSource, /const \{ authSessionKey \} = useCommercial\(\)/);
  assert.match(notebookSource, /syncedSessionKey !== authSessionKey/);
  assert.match(notebookSource, /\}, \[authSessionKey, initialWarmCache, subscriptionAttempt, transitionSettled\]\)/);
  assert.match(studioSource, /subscribeFavoriteLessonsCache/);
  assert.doesNotMatch(studioSource, /startStudyProgressSync/);
  assert.match(homeSource, /subscribeFavoriteLessonsCache/);
  assert.match(contextSource, /if \(!authSessionKey\) return;\s*void prewarmFavoriteLessonsCache\(\)/);
  assert.match(contextSource, /startStudyProgressSync\(\)/);
  assert.match(contextSource, /clearStudyLocalState\(\)/);
  assert.match(contextSource, /clearPracticeLocalState\(\)/);
  assert.match(contextSource, /clearExamLocalState\(\)/);
});
