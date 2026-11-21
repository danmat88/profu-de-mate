import assert from 'node:assert/strict';
import test from 'node:test';
import { createStartupLoader, StartupError } from '../../src/app/services/startupBootstrap.ts';
import type { CommercialAccess } from '../../src/shared/types/index.ts';
import { serviceLoader } from '../helpers/loadService.mts';

const access: CommercialAccess = {
  identity: 'google', tier: 'free', limit: 5, used: 3, remaining: 2, canAnalyze: true,
  reason: 'available', resetAt: null, purchaseUserId: 'g_' + 'a'.repeat(64),
  allowances: { welcome: 5, freeDaily: 5, premiumDaily: 30 },
  premium: { active: false, productId: null, expiresAt: null },
  deviceRecall: { shouldVerify: false, verified: false },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
const defaults = () => ({
  prepareVisuals: async () => {},
  initializeSession: async () => {},
  loadAccess: async () => access,
  loadPendingAnalysis: async () => null,
  currentSession: () => ({ key: 'alice|google', userId: 'alice' }),
});

test('launch cannot become ready when visuals finish before the real account response', async () => {
  const account = deferred<CommercialAccess>();
  const prepare = createStartupLoader({ ...defaults(), loadAccess: () => account.promise });
  let painted = false;
  const launch = prepare().then(snapshot => { painted = true; return snapshot; });
  await flush();
  assert.equal(painted, false);
  account.resolve(access);
  assert.equal((await launch).initialAccess.remaining, 2);
});

test('launch cannot become ready when account data arrives before the last image/font', async () => {
  const visuals = deferred<void>();
  const prepare = createStartupLoader({ ...defaults(), prepareVisuals: () => visuals.promise });
  let painted = false;
  const launch = prepare().then(snapshot => { painted = true; return snapshot; });
  await flush();
  assert.equal(painted, false);
  visuals.resolve();
  assert.equal((await launch).initialAccess, access);
});

test('simultaneous startup consumers share one account request and one resource preparation', async () => {
  let resources = 0; let accounts = 0;
  const prepare = createStartupLoader({ ...defaults(), prepareVisuals: async () => { resources++; }, loadAccess: async () => { accounts++; return access; } });
  const first = prepare();
  assert.equal(prepare(), first);
  await first;
  assert.equal(resources, 1);
  assert.equal(accounts, 1);
});

test('network or asset failures reject launch instead of supplying null access or partial visuals', async () => {
  for (const stage of ['account', 'visuals'] as const) {
    const prepare = createStartupLoader({ ...defaults(),
      ...(stage === 'account' ? { loadAccess: async () => { throw Error('offline'); } } : { prepareVisuals: async () => { throw Error('decode failed'); } }),
    });
    await assert.rejects(prepare(), (error: unknown) => error instanceof StartupError && error.stage === stage);
  }
});

test('a launch timeout stays failed when the old request eventually resolves; retry runs afresh', async () => {
  const slow = deferred<CommercialAccess>();
  let accounts = 0;
  const prepare = createStartupLoader({ ...defaults(), loadAccess: () => ++accounts === 1 ? slow.promise : Promise.resolve(access) }, 10);
  const first = prepare();
  await assert.rejects(first, (error: unknown) => error instanceof StartupError && error.stage === 'timeout');
  slow.resolve(access);
  await flush();
  assert.equal((await prepare()).initialAccess, access);
  assert.equal(accounts, 2);
  await assert.rejects(first);
});

test('an account switch while artwork is being prepared cannot expose the previous quota', async () => {
  const visuals = deferred<void>();
  let userId = 'alice';
  const prepare = createStartupLoader({ ...defaults(), prepareVisuals: () => visuals.promise, currentSession: () => ({ key: userId, userId }) });
  const result = prepare();
  await flush();
  userId = 'bob';
  visuals.resolve();
  await assert.rejects(result, (error: unknown) => error instanceof StartupError && error.stage === 'session');
});

test('a quota or entitlement that expires during launch must be fetched again, not painted', async () => {
  const visuals = deferred<void>();
  let now = 1000;
  const prepare = createStartupLoader({ ...defaults(), now: () => now, prepareVisuals: () => visuals.promise,
    loadAccess: async () => ({ ...access, resetAt: new Date(2000).toISOString() }),
  });
  const result = prepare();
  await flush();
  now = 3000;
  visuals.resolve();
  await assert.rejects(result, (error: unknown) => error instanceof StartupError && error.stage === 'account');
});

test('startup never resumes a persisted request belonging to a different account', async () => {
  const pending = { schemaVersion: 3, userId: 'bob', requestId: 'other-account' } as any;
  const snapshot = await createStartupLoader({ ...defaults(), loadPendingAnalysis: async () => pending })();
  assert.equal(snapshot.pendingAnalysis, null);
  assert.equal(snapshot.sessionKey, 'alice|google');
});

test('an identity change during the account request rejects the old snapshot', async () => {
  const account = deferred<CommercialAccess>();
  let userId = 'alice';
  const prepare = createStartupLoader({ ...defaults(), loadAccess: () => account.promise,
    currentSession: () => ({ key: userId, userId }),
  });
  const result = prepare();
  await flush();
  userId = 'bob';
  account.resolve(access);
  await assert.rejects(result, (error: unknown) => error instanceof StartupError && error.stage === 'account');
});

test('the mounted provider and Home focus reuse launch data without another account request', async () => {
  let requests = 0;
  const effects: Array<() => unknown> = [];
  let onAppState!: (state: string) => void;
  const user = { uid: 'alice', isAnonymous: false, providerData: [{ providerId: 'google.com' }] };
  const load = serviceLoader({
    react: {
      createContext: () => ({ Provider: 'Provider' }), useCallback: (callback: unknown) => callback,
      useMemo: (factory: () => unknown) => factory(), useRef: (current: unknown) => ({ current }),
      useState: (initial: any) => [typeof initial === 'function' ? initial() : initial, () => {}],
      useEffect: (effect: () => unknown) => effects.push(effect),
    },
    'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }) },
    'react-native': { AppState: { currentState: 'active', addEventListener: (_event: string, callback: typeof onAppState) => { onAppState = callback; return { remove() {} }; } } },
    '@react-native-firebase/app': { getApp() {} },
    '@react-native-firebase/auth': { getAuth: () => ({ currentUser: user }), onIdTokenChanged: (_auth: unknown, callback: (u: typeof user) => void) => { callback(user); return () => {}; } },
    'src/shared/services/firebase.ts': { firebaseUserSessionKey: (u: any) => u?.uid },
    'src/features/access/services/commercial.ts': { getCommercialAccess: async () => { requests++; return access; } },
    'src/shared/services/deviceIntegrity.ts': {}, 'src/shared/services/diagnostics.ts': { recordDiagnosticError: assert.fail },
    'src/features/account/services/dataManagement.ts': {},
    'src/features/lessons/services/lessons.ts': { prewarmFavoriteLessonsCache: async () => {} },
    'src/features/analysis/services/pendingAnalysis.ts': {}, 'src/features/math/services/mathDraft.ts': {},
    'src/shared/services/sessionGuard.ts': {}, 'src/features/access/services/purchases.ts': {},
  });
  const tree = load('src/features/access/context/CommercialContext.tsx').CommercialProvider({ initialAccess: access, initialVerifiedAt: Date.now(), children: null });
  const cleanup = effects.map(effect => effect());
  try {
    const context = tree.props.value;
    assert.equal(context.access, access);
    assert.equal(context.status, 'ready');
    assert.equal(await context.refreshIfStale(), access, 'Home focus uses verified initial access');
    onAppState('background'); onAppState('active');
    await flush();
    assert.equal(requests, 0, 'mount, focus and a brief foreground cycle issue no duplicate request');
  } finally { cleanup.forEach(fn => { if (typeof fn === 'function') fn(); }); }
});

test('Home renders a preparation boundary until access exists, then paints the real count on its first render', () => {
  let current: CommercialAccess | null = null;
  const navigate = () => {};
  const Surface = () => {};
  const Boundary = () => {};
  const load = serviceLoader({
    react: { useCallback: (callback: unknown) => callback, useRef: (current: unknown) => ({ current }),
      useState: (initial: any) => [typeof initial === 'function' ? initial() : initial, () => {}] },
    'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }) },
    '@react-navigation/native': { useNavigation: () => ({ navigate }), useFocusEffect() {} },
    'expo-image-picker': {}, 'src/shared/services/haptics.ts': {}, 'src/shared/services/sessionGuard.ts': {},
    'src/features/home/components/HomeSurface.tsx': { HomeSurface: Surface },
    'src/shared/ui/ReadinessScreen.tsx': { ReadinessScreen: Boundary },
    'src/features/access/context/CommercialContext.tsx': { useCommercial: () => ({ access: current, status: 'resolving', refresh: async () => {}, refreshIfStale: async () => {} }) },
    'src/features/analysis/services/pendingAnalysis.ts': { getPreparedPendingAnalysis: () => null },
    'src/features/lessons/services/lessons.ts': { getCachedFavoriteLessons: () => undefined },
    'src/features/math/services/mathDraft.ts': { warmMathDrafts() {} },
    'src/shared/storage/localPreferences.ts': { hasSeenHomeGuide: () => true, markHomeGuideSeen() {} },
  });
  const Home = load('src/features/home/screens/HomeScreen.tsx').HomeScreen;
  assert.equal(Home().type, Boundary);
  current = access;
  const ready = Home();
  assert.equal(ready.type, Surface);
  assert.equal(ready.props.allowance.label, '2 din 5 azi');
});

test('real access service deduplicates concurrent callers and rejects another identity’s late response', async () => {
  const user = (uid: string) => ({ uid, isAnonymous: false, providerData: [{ providerId: 'google.com' }] });
  const state = { currentUser: user('alice') };
  const responses: ReturnType<typeof deferred<{ data: CommercialAccess }>>[] = [];
  const cached: string[] = [];
  const load = serviceLoader({
    '@react-native-firebase/app': { getApp() {} }, '@react-native-firebase/auth': { getAuth: () => state },
    '@react-native-firebase/functions': { getFunctions() {}, httpsCallable: () => () => { const response = deferred<{ data: CommercialAccess }>(); responses.push(response); return response.promise; } },
    'src/shared/services/firebase.ts': { initializeVerifiedFirebaseServices: async () => state.currentUser, firebaseUserSessionKey: (u: any) => u?.uid },
    'src/features/access/services/commercialAccessCache.ts': { writeCachedCommercialAccess: async (_a: unknown, key: string) => { cached.push(key); } },
    'src/shared/services/deviceIntegrity.ts': {}, 'src/shared/services/installationIdentity.ts': { getInstallationToken: async () => 'installation' },
    'src/shared/services/diagnostics.ts': { recordDiagnosticError: assert.fail }, 'src/features/lessons/services/lessons.ts': {},
    'src/features/analysis/services/pendingAnalysis.ts': {}, 'src/features/math/services/mathDraft.ts': {},
    'src/features/access/services/purchases.ts': { initializePurchases: async () => true },
    'expo-secure-store': { getItemAsync: async () => null, deleteItemAsync: async () => {} },
  });
  const service = load('src/features/access/services/commercial.ts');
  const first = service.getCommercialAccess();
  assert.equal(service.getCommercialAccess(), first);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(responses.length, 1);
  state.currentUser = user('bob');
  const second = service.getCommercialAccess();
  assert.notEqual(second, first);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(responses.length, 2);
  responses[0].resolve({ data: access });
  await assert.rejects(first, (error: any) => error.code === 'commercial/stale-session');
  responses[1].resolve({ data: { ...access, remaining: 1 } });
  assert.equal((await second).remaining, 1);
  assert.deepEqual(cached, ['bob']);
});

test('Google sign-in and sign-out commit identity, session key and access atomically without intermediate null flashes', async () => {
  const guestUser = { uid: 'guest-1', isAnonymous: true, providerData: [] as Array<{ providerId: string }> };
  const googleUser = { uid: 'google-1', isAnonymous: false, providerData: [{ providerId: 'google.com' }] };
  const replacementGuest = { uid: 'guest-2', isAnonymous: true, providerData: [] as Array<{ providerId: string }> };
  const guestAccess: CommercialAccess = { ...access, identity: 'anonymous', tier: 'guest', used: 1, remaining: 4 };
  const googleAccess: CommercialAccess = { ...access, identity: 'google', tier: 'free', used: 2, remaining: 3 };
  const postLogoutAccess: CommercialAccess = { ...access, identity: 'anonymous', tier: 'guest', used: 2, remaining: 3 };

  let currentUser: typeof guestUser | null = guestUser;
  let tokenListener!: (u: typeof guestUser | null) => void;
  let accessResponse = deferred<CommercialAccess>();
  const stateWrites: Array<{ slot: number; value: unknown }> = [];
  const stateValues: unknown[] = [];
  let cursor = 0;
  const effects: Array<() => unknown> = [];

  const load = serviceLoader({
    react: {
      createContext: () => ({ Provider: 'Provider' }),
      useCallback: (callback: unknown) => callback,
      useMemo: (factory: () => unknown) => factory(),
      useRef: (current: unknown) => ({ current }),
      useState: (initial: any) => {
        const slot = cursor++;
        stateValues[slot] = typeof initial === 'function' ? initial() : initial;
        const setter = (next: any) => {
          stateValues[slot] = typeof next === 'function' ? next(stateValues[slot]) : next;
          stateWrites.push({ slot, value: stateValues[slot] });
        };
        return [stateValues[slot], setter];
      },
      useEffect: (effect: () => unknown) => effects.push(effect),
    },
    'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }) },
    'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
    '@react-native-firebase/app': { getApp() {} },
    '@react-native-firebase/auth': {
      getAuth: () => ({ currentUser }),
      onIdTokenChanged: (_auth: unknown, callback: typeof tokenListener) => { tokenListener = callback; return () => {}; },
    },
    'src/shared/services/firebase.ts': {
      firebaseUserSessionKey: (u: typeof guestUser | null) => (u ? `${u.uid}|${u.isAnonymous ? 'anon' : 'google'}` : null),
      resetFirebaseInitialization() {},
    },
    'src/features/access/services/commercial.ts': {
      getCommercialAccess: () => {
        if (!currentUser) {
          currentUser = replacementGuest;
          tokenListener(currentUser);
        }
        return accessResponse.promise;
      },
      connectWithGoogle: async () => {
        currentUser = googleUser;
        tokenListener(googleUser);
        return googleUser;
      },
      disconnectGoogleAccount: async () => {
        currentUser = null;
        tokenListener(null);
        return null;
      },
    },
    'src/shared/services/deviceIntegrity.ts': {},
    'src/shared/services/diagnostics.ts': { recordDiagnosticError: assert.fail },
    'src/features/account/services/dataManagement.ts': {},
    'src/features/lessons/services/lessons.ts': { clearFavoriteLessonsCache() {}, prewarmFavoriteLessonsCache: async () => {} },
    'src/features/analysis/services/pendingAnalysis.ts': { discardPendingAnalysis() {} },
    'src/features/math/services/mathDraft.ts': { clearMathDrafts() {} },
    'src/shared/services/sessionGuard.ts': { invalidateSessionOperations() {} },
    'src/features/access/services/purchases.ts': { resetPurchasesForSignedOutUser: async () => {} },
  });

  // Slots in CommercialProvider: 0=authSessionKey, 1=identity, 2=access, 3=startupReady, 4=status, 5=refreshing
  const tree = load('src/features/access/context/CommercialContext.tsx').CommercialProvider({
    initialAccess: guestAccess,
    initialVerifiedAt: Date.now(),
    children: null,
  });
  const cleanup = effects.map((effect) => effect());
  try {
    const context = tree.props.value;
    stateWrites.length = 0;

    // 1. Google sign-in: mid-transition token event must not emit null access or early key swap.
    const signInPromise = context.connectGoogle();
    await flush();
    assert.equal(stateWrites.some((w) => w.slot === 0 || w.slot === 1 || w.slot === 2), false);
    accessResponse.resolve(googleAccess);
    assert.equal(await signInPromise, googleAccess);
    assert.equal(stateValues[0], 'google-1|google');
    assert.equal(stateValues[1], 'google');
    assert.equal(stateValues[2], googleAccess);
    assert.equal(stateWrites.some((w) => w.slot === 2 && w.value === null), false);

    // 2. Google sign-out: null token + replacement anonymous token must not flash signed-out state.
    stateWrites.length = 0;
    accessResponse = deferred<CommercialAccess>();
    const signOutPromise = context.disconnectGoogle();
    await flush();
    assert.equal(stateWrites.some((w) => w.slot === 0 || w.slot === 1 || w.slot === 2), false);
    accessResponse.resolve(postLogoutAccess);
    assert.equal(await signOutPromise, postLogoutAccess);
    assert.equal(stateValues[0], 'guest-2|anon');
    assert.equal(stateValues[1], 'anonymous');
    assert.equal(stateValues[2], postLogoutAccess);
    assert.equal(stateWrites.some((w) => (w.slot === 0 || w.slot === 1 || w.slot === 2) && w.value === null), false);
  } finally {
    cleanup.forEach((fn) => { if (typeof fn === 'function') fn(); });
  }
});
