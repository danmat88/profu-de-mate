import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serviceLoader } from '../helpers/loadService.mts';

const google = { uid: 'alice', isAnonymous: false, providerData: [{ providerId: 'google.com' }] };
const auth = () => ({ currentUser: { ...google } as any });

test('a bound pending notebook transfer survives eight offline days and stays scoped to its account', async () => {
  const state = auth();
  const pending = { ticket: '12345678-1234-1234-1234-123456789abc', sourceUserId: 'source', targetUserId: 'alice', createdAt: Date.now() - 8 * 86400000 };
  const disk = new Map<string, string>([['commercial.pending-google-merges.v2', JSON.stringify([pending])]]);
  const load = serviceLoader({
    '@react-native-firebase/app': { getApp() {} }, '@react-native-firebase/auth': { getAuth: () => state },
    '@react-native-firebase/functions': {}, 'src/shared/services/firebase.ts': {}, 'src/features/access/services/commercialAccessCache.ts': {},
    'src/shared/services/deviceIntegrity.ts': {}, 'src/shared/services/installationIdentity.ts': {}, 'src/shared/services/diagnostics.ts': {}, 'src/features/lessons/services/lessons.ts': {}, 'src/features/analysis/services/pendingAnalysis.ts': {}, 'src/features/access/services/purchases.ts': {}, 'src/features/math/services/mathDraft.ts': { clearMathDrafts() {} },
    'src/features/exams/services/examStorage.ts': { clearExamLocalState() {} },
    'src/features/practice/services/practiceStorage.ts': { clearPracticeLocalState() {} },
    'src/features/study/services/studyStorage.ts': { clearStudyLocalState() {} },
    'src/features/study/services/studySync.ts': { flushStudyProgressSync: async () => {}, refreshStudyProgressFromCloud() {}, stopStudyProgressSync() {} },
    'expo-secure-store': { getItemAsync: async (key: string) => disk.get(key) ?? null,
      setItemAsync: async (key: string, value: string) => { disk.set(key, value); }, deleteItemAsync: async (key: string) => { disk.delete(key); } },
  });
  const service = load('src/features/access/services/commercial.ts');
  assert.deepEqual(Array.from(await service.pendingGoogleMergeTickets('alice')), [pending.ticket]);
  assert.deepEqual(Array.from(await service.pendingGoogleMergeTickets('bob')), []);
  assert.equal(JSON.parse(disk.get('commercial.pending-google-merges.v2')!)[0].ticket, pending.ticket);
});

test('native vibration errors and hangs cannot delay or fail the real user operation', async () => {
  const load = serviceLoader({ 'expo-haptics': {
    ImpactFeedbackStyle: { Light: 'light' }, NotificationFeedbackType: { Success: 'success' },
    selectionAsync: () => { throw Error('native module failure'); },
    impactAsync: async () => { throw Error('vibration unavailable'); },
    notificationAsync: () => new Promise(() => {}),
  } });
  const feedback = load('src/shared/services/haptics.ts');
  assert.equal(feedback.selection(), undefined);
  assert.equal(feedback.impact('light'), undefined);
  assert.equal(feedback.notification('success'), undefined);
  await new Promise((resolve) => setImmediate(resolve));
});

test('a confirmed deletion survives local sign-out failure and marks its identity terminal', async () => {
  const state = auth(); const marked: string[] = []; let diagnostics = 0;
  const load = serviceLoader({
    '@react-native-firebase/app': { getApp() {} },
    '@react-native-firebase/auth': { getAuth: () => state, signOut: async () => { throw Error('native signout failed'); } },
    '@react-native-firebase/crashlytics': { getCrashlytics() {}, setCrashlyticsCollectionEnabled: async () => {} },
    '@react-native-firebase/functions': { getFunctions() {}, httpsCallable: () => async () => ({ data: { deleted: true } }) },
    'src/shared/services/firebase.ts': { initializeVerifiedFirebaseServices: async () => state.currentUser,
      markFirebaseUserDeleted: (uid: string) => marked.push(uid), resetFirebaseInitialization() {} },
    'src/shared/services/diagnostics.ts': { recordDiagnosticError: () => { diagnostics++; } },
    'src/features/lessons/services/lessons.ts': { clearFavoriteLessonsCache() {} }, 'src/features/access/services/commercialAccessCache.ts': { clearCachedCommercialAccess: async () => {} },
    'src/features/access/services/commercial.ts': { confirmGoogleIdentityForDeletion: async () => true, pendingGoogleMergeTickets: async () => [], removePendingGoogleMergesForUser: async () => {} },
    'src/shared/storage/localPreferences.ts': { clearLocalPreferences() {} },
    'src/features/exams/services/examStorage.ts': { clearExamLocalState() {} },
    'src/features/practice/services/practiceStorage.ts': { clearPracticeLocalState() {} },
    'src/features/study/services/studyStorage.ts': { clearStudyLocalState() {} },
    'src/features/study/services/studySync.ts': { stopStudyProgressSync() {} },
    'src/features/analysis/services/pendingAnalysis.ts': { clearPendingAnalysis() {} }, 'src/features/math/services/mathDraft.ts': { clearMathDrafts() {} },
    'src/features/capture/services/temporaryImages.ts': { clearTemporaryCapturedImages() {} }, 'src/shared/services/installationIdentity.ts': { getInstallationToken: async () => 'installation' },
    'src/features/access/services/purchases.ts': { resetPurchasesForSignedOutUser: async () => {} },
    'react-native-nitro-google-signin': { GoogleOneTapSignIn: { signOut: async () => {} } },
  });
  const result = await load('src/features/account/services/dataManagement.ts').deleteAllUserData();
  assert.equal(result.localSignOutPending, true);
  assert.equal(result.externalBillingProfilePending, false);
  assert.deepEqual(marked, ['alice']);
  assert.equal(diagnostics, 1);
});

test('a deleted local identity cannot reopen offline data while native sign-out needs retry', async () => {
  const state = auth(); let failSignOut = true; let guests = 0;
  const load = serviceLoader({
    '@react-native-firebase/app': { getApp() {} }, '@react-native-firebase/app-check': {},
    '@react-native-firebase/auth': {
      getAuth: () => state,
      signOut: async () => { if (failSignOut) throw Error('native signout failed'); state.currentUser = null; },
      signInAnonymously: async () => { guests++; state.currentUser = { uid: 'guest', isAnonymous: true, providerData: [] }; return { user: state.currentUser }; },
    },
  }, { process: { env: { EXPO_PUBLIC_APP_CHECK_PROVIDER: 'none' } } });
  const service = load('src/shared/services/firebase.ts');
  service.markFirebaseUserDeleted('alice');
  assert.equal(service.getRestoredFirebaseUser(), null, 'offline entry cannot use a deleted identity');
  await assert.rejects(service.initializeFirebaseServices(), /native signout failed/);
  assert.equal(guests, 0);
  failSignOut = false;
  assert.equal((await service.initializeFirebaseServices()).uid, 'guest');
  assert.equal(service.getRestoredFirebaseUser().uid, 'guest');
  assert.equal(guests, 1);
});

test('actual Notebook subscription publishes an initial empty snapshot and ignores a different account', async () => {
  const state = auth(); let snapshot: any; const received: number[] = [];
  const load = serviceLoader({
    '@react-native-firebase/app': { getApp: () => ({}) },
    '@react-native-firebase/auth': { getAuth: () => state },
    '@react-native-firebase/firestore': {
      collection() {}, getFirestore() {}, orderBy() {}, query() {}, where() {},
      onSnapshot: (_q: unknown, cb: any) => { snapshot = cb; return () => {}; },
    },
    'src/shared/services/firebase.ts': { initializeFirebaseServices: async () => state.currentUser, firebaseUserSessionKey: (u: any) => u?.uid },
    'src/features/math/utils/mathContent.ts': { isMathAnalysis: () => true },
  });
  const service = load('src/features/lessons/services/lessons.ts');
  await service.subscribeToFavoriteLessons((lessons: any[]) => received.push(lessons.length), assert.fail);
  snapshot({ docs: [], docChanges: () => [] });
  snapshot({ docs: [], docChanges: () => [] });
  assert.deepEqual(received, [0]);
  assert.equal(service.getCachedFavoriteLessons().length, 0);
  state.currentUser = { ...google, uid: 'bob' };
  snapshot({ docs: [], docChanges: () => [] });
  assert.equal(service.getCachedFavoriteLessons(), undefined);
  assert.deepEqual(received, [0]);
});

test('real pending marker rejects another account and late disk reads cannot restore a logged-out photo', async () => {
  const state = auth(); let disk = ''; let delayed: Promise<string> | null = null; let resolveRead!: (s: string) => void;
  class File {
    exists = true;
    write(value: string) { disk = value; }
    delete() { disk = ''; }
    async text() { return delayed ?? disk; }
  }
  const load = serviceLoader({
    '@react-native-firebase/app': { getApp() {} }, '@react-native-firebase/auth': { getAuth: () => state },
    'expo-file-system': { File, Paths: { cache: 'cache' } },
    'src/features/capture/services/temporaryImages.ts': { isManagedTemporaryImage: () => true, clearTemporaryCapturedImagesOnStartup() {}, deleteTemporaryCapturedImages() {} },
  });
  const service = load('src/features/analysis/services/pendingAnalysis.ts');
  assert.equal(service.savePendingAnalysis('solve', { uri: 'cache/photo', width: 20, height: 20, source: 'camera' }, 'analysis-abcdef-123456', 'alice'), true);
  const old = disk;
  state.currentUser = { ...google, uid: 'bob' };
  assert.equal(service.getPreparedPendingAnalysis(), null);
  assert.equal(service.savePendingAnalysis('solve', {}, 'analysis-abcdef-123456', 'alice'), false);
  state.currentUser = google;
  delayed = new Promise((resolve) => { resolveRead = resolve; });
  const pending = service.preparePendingAnalysisOnStartup();
  service.discardPendingAnalysis();
  resolveRead(old);
  assert.equal(await pending, null);
  assert.equal(service.getPreparedPendingAnalysis(), null);
});

test('logout invalidates a late token response without recreating an account', async () => {
  const state = auth(); let calls = 0; let guests = 0; let finish!: () => void;
  const load = serviceLoader({
    '@react-native-firebase/app': { getApp() {} },
    '@react-native-firebase/auth': {
      getAuth: () => state, getIdToken: async () => { calls++; await new Promise<void>((resolve) => { finish = resolve; }); return 'token'; },
      signInAnonymously: async () => { guests++; throw Error('must not create guest'); }, signOut: async () => { state.currentUser = null; },
    },
    '@react-native-firebase/app-check': {},
  }, { process: { env: { EXPO_PUBLIC_APP_CHECK_PROVIDER: 'none' } } });
  const service = load('src/shared/services/firebase.ts');
  const pending = service.initializeVerifiedFirebaseServices();
  await new Promise((resolve) => setImmediate(resolve));
  service.resetFirebaseInitialization(); state.currentUser = null; finish();
  await assert.rejects(pending, { code: 'session/changed' });
  assert.equal(calls, 1); assert.equal(guests, 0);
});

test('actual logout completes locally even if Firebase verification and billing cleanup never resolve', async () => {
  const state = auth(); let signs = 0; let verify = 0; let cleared = 0; let flushed = 0; let studyStopped = 0;
  const never = () => new Promise(() => {});
  const load = serviceLoader({
    'expo-secure-store': {},
    '@react-native-firebase/app': { getApp() {} },
    '@react-native-firebase/auth': { getAuth: () => state, signOut: async () => { signs++; state.currentUser = null; } },
    '@react-native-firebase/functions': {},
    'src/shared/services/firebase.ts': { initializeVerifiedFirebaseServices: () => { verify++; return never(); }, resetFirebaseInitialization() {} },
    'src/features/access/services/commercialAccessCache.ts': { clearCachedCommercialAccess: async () => { cleared++; } },
    'src/shared/services/deviceIntegrity.ts': {}, 'src/shared/services/installationIdentity.ts': {}, 'src/shared/services/diagnostics.ts': {},
    'src/features/lessons/services/lessons.ts': { clearFavoriteLessonsCache: () => { cleared++; } },
    'src/features/analysis/services/pendingAnalysis.ts': { discardPendingAnalysis: () => { cleared++; } },
    'src/features/math/services/mathDraft.ts': { clearMathDrafts() {} },
    'src/features/exams/services/examStorage.ts': { clearExamLocalState: () => { cleared++; } },
    'src/features/practice/services/practiceStorage.ts': { clearPracticeLocalState: () => { cleared++; } },
    'src/features/study/services/studyStorage.ts': { clearStudyLocalState: () => { cleared++; } },
    'src/features/study/services/studySync.ts': {
      flushStudyProgressSync: async () => { flushed++; },
      refreshStudyProgressFromCloud() {},
      stopStudyProgressSync: () => { studyStopped++; },
    },
    'src/features/access/services/purchases.ts': { resetPurchasesForSignedOutUser: never },
    'react-native-nitro-google-signin': { GoogleOneTapSignIn: { signOut: never } },
  });
  const service = load('src/features/access/services/commercial.ts');
  assert.equal(await service.disconnectGoogleAccount(), null);
  assert.equal(signs, 1); assert.equal(verify, 0); assert.equal(flushed, 1); assert.equal(studyStopped, 1); assert.equal(cleared, 6);
});

test('actual Firebase service verifies a restored identity once and replaces only terminal identities', async () => {
  const state = auth(); let tokens = 0; let signs = 0; let guests = 0; let failure: string | null = null;
  const load = serviceLoader({
    '@react-native-firebase/app': { getApp() {} },
    '@react-native-firebase/auth': {
      getAuth: () => state,
      getIdToken: async () => { tokens++; if (failure) throw { code: failure }; return 'token'; },
      signOut: async () => { signs++; state.currentUser = null; },
      signInAnonymously: async () => { guests++; state.currentUser = { uid: 'guest', isAnonymous: true, providerData: [] }; return { user: state.currentUser }; },
    },
    '@react-native-firebase/app-check': {},
  }, { process: { env: { EXPO_PUBLIC_APP_CHECK_PROVIDER: 'none' } } });
  const service = load('src/shared/services/firebase.ts');
  await service.initializeVerifiedFirebaseServices(); await service.initializeVerifiedFirebaseServices();
  assert.equal(tokens, 1);
  service.resetFirebaseInitialization(); failure = 'auth/network-request-failed';
  await assert.rejects(service.initializeVerifiedFirebaseServices());
  assert.equal(signs, 0); assert.equal(guests, 0);
  failure = 'auth/user-not-found';
  const guest = await service.initializeVerifiedFirebaseServices();
  assert.equal(guest.uid, 'guest'); assert.equal(signs, 1); assert.equal(guests, 1);
});

test('actual client resumes an expired request once and rejects a changed account before sending its image', async () => {
  const state = auth(); let analyses = 0; let reads = 0;
  const load = serviceLoader({
    '@react-native-firebase/app': { getApp() {} }, '@react-native-firebase/auth': { getAuth: () => state },
    '@react-native-firebase/functions': { getFunctions() {}, httpsCallable: (_f: unknown, name: string) => async () => {
      if (name === 'getAnalysisStatus') return { data: { state: 'failed' } };
      analyses++; return { data: { lessonId: null, result: { mode: 'solve', status: 'unclear' } } };
    } },
    'expo-file-system': { File: class { async base64() { reads++; return 'aW1hZ2U='; } } },
    'src/features/math/utils/mathContent.ts': { isMathAnalysis: () => true },
    'src/shared/services/firebase.ts': { initializeVerifiedFirebaseServices: async () => state.currentUser },
    'src/shared/services/installationIdentity.ts': { getInstallationToken: async () => 'a'.repeat(64) },
  });
  const service = load('src/features/analysis/services/mathAnalysis.ts');
  await service.analyzeOrResumeMathImage('solve', { uri: 'photo' }, 'analysis-abcdef-123456', true, () => false, 'alice');
  assert.equal(analyses, 1); assert.equal(reads, 1);
  state.currentUser = { ...google, uid: 'bob' };
  await assert.rejects(service.analyzeOrResumeMathImage('solve', { uri: 'photo' }, 'analysis-abcdef-123456', false, () => false, 'alice'), { code: 'session/changed' });
  assert.equal(analyses, 1); assert.equal(reads, 1);
});
