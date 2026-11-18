import assert from 'node:assert/strict';
import test from 'node:test';
import { serviceLoader } from '../helpers/loadService.mts';

function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function flush() { for (let i = 0; i < 30; i += 1) await Promise.resolve(); }

function harness(overrides: Record<string, (...args: any[]) => unknown> = {}) {
  const auth = { currentUser: { uid: 'a', isAnonymous: false, providerData: [{ providerId: 'google.com' }] } as any };
  const calls: { name: string; value?: unknown }[] = [];
  const timers = new Map<number, { at: number; callback: () => void }>();
  let now = 0;
  let timerId = 0;
  let customer: string | null = null;
  const access = { premium: { active: true } };
  const sdk = {
    configure: ({ appUserID }: { appUserID: string }) => { customer = appUserID; calls.push({ name: 'configure', value: customer }); },
    logIn: async (id: string) => { calls.push({ name: 'login', value: id }); const result = await overrides.logIn?.(id); customer = id; return result; },
    logOut: async () => { calls.push({ name: 'logout' }); const result = await overrides.logOut?.(); customer = null; return result; },
    isAnonymous: async () => customer === null,
    purchasePackage: async (plan: unknown) => { calls.push({ name: 'purchase', value: customer }); return overrides.purchasePackage?.(plan); },
    restorePurchases: async () => { calls.push({ name: 'restore', value: customer }); return overrides.restorePurchases?.(); },
    getOfferings: async () => ({ current: { monthly: { identifier: 'month' }, annual: { identifier: 'year' } } }),
    getCustomerInfo: async () => ({ managementURL: 'https://play.google.com/store/account/subscriptions' }),
  };
  const load = serviceLoader({
    '@react-native-firebase/app': { getApp: () => ({}) },
    '@react-native-firebase/auth': { getAuth: () => auth },
    '@react-native-firebase/functions': {
      getFunctions: () => ({}),
      httpsCallable: () => async () => { calls.push({ name: 'sync', value: auth.currentUser?.uid }); await overrides.sync?.(); return { data: access }; },
    },
    'react-native-purchases': { ...sdk, PACKAGE_TYPE: {}, LOG_LEVEL: {}, PURCHASES_ERROR_CODE: {} },
    'src/shared/services/firebase.ts': { initializeVerifiedFirebaseServices: async () => auth.currentUser },
    'src/features/access/services/commercialAccessCache.ts': { writeCachedCommercialAccess: async (_access: unknown, sessionKey: string) => { calls.push({ name: 'cache', value: sessionKey }); } },
  }, {
    process: { env: { EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'goog_test_public' } },
    setTimeout: (callback: () => void, delay: number) => { const id = ++timerId; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout: (id: number) => timers.delete(id),
  });
  const purchases = load('src/features/access/services/purchases.ts');
  const guard = load('src/shared/services/sessionGuard.ts');
  const id = (value: string) => 'g_' + value.repeat(64);
  return {
    purchases, calls, auth, id,
    switchTo(value: string | null) {
      guard.invalidateSessionOperations();
      auth.currentUser = value ? { uid: value, isAnonymous: false, providerData: [{ providerId: 'google.com' }] } : null;
    },
    async advance(milliseconds: number) {
      now += milliseconds;
      for (const [key, timer] of timers) if (timer.at <= now) { timers.delete(key); timer.callback(); }
      await flush();
    },
  };
}

test('a blocked RevenueCat login has a bounded caller wait and never overlaps another identity mutation', async () => {
  const login = deferred();
  const h = harness({ logIn: () => login.promise });
  await h.purchases.initializePurchases(h.id('a'));
  h.switchTo('b');
  let state = 'pending';
  const pending = h.purchases.initializePurchases(h.id('b')).then(() => { state = 'ready'; }, () => { state = 'error'; });
  await flush();
  await h.advance(30_000);
  assert.equal(state, 'error');
  h.switchTo('c');
  let nextState = 'pending';
  const next = h.purchases.initializePurchases(h.id('c')).then(() => { nextState = 'ready'; }, () => { nextState = 'error'; });
  await flush();
  await h.advance(30_000);
  assert.equal(nextState, 'error');
  assert.equal(h.calls.filter((call) => call.name === 'login').length, 1);
  login.resolve({});
  await flush();
  assert.equal(h.calls.filter((call) => call.name === 'login').length, 1, 'an expired queued login must not run later');
  await h.purchases.initializePurchases(h.id('c'));
  assert.equal(h.calls.at(-1)?.value, h.id('c'));
  await Promise.all([pending, next]);
});

test('blocked logout settles the caller while retaining the native lock until logout really completes', async () => {
  const logout = deferred();
  const h = harness({ logOut: () => logout.promise });
  await h.purchases.initializePurchases(h.id('a'));
  h.switchTo(null);
  let state = 'pending';
  const pending = h.purchases.resetPurchasesForSignedOutUser().then(() => { state = 'ready'; }, () => { state = 'error'; });
  await flush();
  await h.advance(30_000);
  assert.equal(state, 'error');
  h.switchTo('b');
  const next = h.purchases.initializePurchases(h.id('b'));
  await flush();
  assert.equal(h.calls.filter((call) => call.name === 'login').length, 0);
  logout.resolve({});
  await next;
  assert.deepEqual(h.calls.filter((call) => ['logout', 'login'].includes(call.name)).map((call) => call.name), ['logout', 'login']);
  await pending;
});

for (const action of ['purchasePremium', 'restorePremium']) {
  test(`${action} finishing after an account change cannot sync or cache the old purchase for the new account`, async () => {
    const transaction = deferred();
    const h = harness({ purchasePackage: () => transaction.promise, restorePurchases: () => transaction.promise });
    await h.purchases.initializePurchases(h.id('a'));
    const pending = h.purchases[action]({});
    const rejected = assert.rejects(pending, { code: 'session/changed' });
    await flush();
    h.switchTo('b');
    const detach = h.purchases.resetPurchasesForSignedOutUser();
    const next = h.purchases.initializePurchases(h.id('b'));
    await flush();
    assert.equal(h.calls.some((call) => call.name === 'login' || call.name === 'logout'), false);
    transaction.resolve({});
    await Promise.all([rejected, detach, next]);
    assert.equal(h.calls.some((call) => call.name === 'sync' || call.name === 'cache'), false);
    assert.equal(h.calls.at(-1)?.value, h.id('b'));
  });
}

test('a server premium reply delivered after account change cannot populate the next account cache', async () => {
  const sync = deferred();
  const h = harness({ sync: () => sync.promise });
  await h.purchases.initializePurchases(h.id('a'));
  const pending = h.purchases.restorePremium();
  const rejected = assert.rejects(pending, { code: 'session/changed' });
  await flush();
  assert.equal(h.calls.at(-1)?.name, 'sync');
  h.switchTo('b');
  sync.resolve({});
  await rejected;
  assert.equal(h.calls.some((call) => call.name === 'cache'), false);
});

test('successful purchase synchronizes and caches only for its captured Firebase identity', async () => {
  const h = harness();
  await h.purchases.initializePurchases(h.id('a'));
  const access = await h.purchases.purchasePremium({});
  assert.equal(access.premium.active, true);
  assert.deepEqual(h.calls.map((call) => call.name), ['configure', 'purchase', 'sync', 'cache']);
  assert.equal(h.calls.at(-1)?.value, 'a|identified|google.com');
});

test('a second purchase or restore cannot queue a surprise transaction behind an active purchase', async () => {
  const transaction = deferred();
  const h = harness({ purchasePackage: () => transaction.promise });
  await h.purchases.initializePurchases(h.id('a'));
  const first = h.purchases.purchasePremium({});
  await flush();
  let purchaseState = 'pending';
  let restoreState = 'pending';
  const second = h.purchases.purchasePremium({}).then(() => { purchaseState = 'ready'; }, () => { purchaseState = 'error'; });
  const restore = h.purchases.restorePremium().then(() => { restoreState = 'ready'; }, () => { restoreState = 'error'; });
  await flush();
  assert.equal(purchaseState, 'error');
  assert.equal(restoreState, 'error');
  transaction.resolve({});
  await Promise.all([first, second, restore]);
  assert.equal(h.calls.filter((call) => call.name === 'purchase').length, 1);
  assert.equal(h.calls.filter((call) => call.name === 'restore').length, 0);
});

test('purchase timeout keeps transaction ownership until the native result settles', async () => {
  const transaction = deferred();
  const h = harness({ purchasePackage: () => transaction.promise });
  await h.purchases.initializePurchases(h.id('a'));
  const first = h.purchases.purchasePremium({});
  const timedOut = assert.rejects(first, { code: 'purchases/timeout' });
  await flush();
  await h.advance(120_000);
  await timedOut;
  let restoreState = 'pending';
  const restore = h.purchases.restorePremium().then(() => { restoreState = 'ready'; }, () => { restoreState = 'error'; });
  await flush();
  assert.equal(restoreState, 'error');
  transaction.resolve({});
  await flush();
  await restore;
  await h.purchases.restorePremium();
  assert.equal(h.calls.filter((call) => call.name === 'restore').length, 1);
});

test('a timed-out queued logout still detaches before the next account login', async () => {
  const transaction = deferred();
  const h = harness({ purchasePackage: () => transaction.promise });
  await h.purchases.initializePurchases(h.id('a'));
  const purchase = h.purchases.purchasePremium({});
  const stale = assert.rejects(purchase, { code: 'session/changed' });
  await flush();
  h.switchTo(null);
  const reset = h.purchases.resetPurchasesForSignedOutUser();
  const timedOut = assert.rejects(reset, { code: 'purchases/timeout' });
  await flush();
  await h.advance(20_000);
  await timedOut;
  h.switchTo('b');
  const login = h.purchases.initializePurchases(h.id('b'));
  transaction.resolve({});
  await Promise.all([stale, login]);
  assert.deepEqual(h.calls.filter((call) => ['logout', 'login'].includes(call.name)).map((call) => call.name), ['logout', 'login']);
});

test('a purchase which expires behind a blocked login never starts later', async () => {
  const login = deferred();
  const h = harness({ logIn: () => login.promise });
  await h.purchases.initializePurchases(h.id('a'));
  h.switchTo('b');
  const initialization = h.purchases.initializePurchases(h.id('b'));
  const loginTimeout = assert.rejects(initialization, { code: 'purchases/timeout' });
  await flush();
  const purchase = h.purchases.purchasePremium({});
  const purchaseTimeout = assert.rejects(purchase, { code: 'purchases/timeout' });
  await flush();
  await h.advance(120_000);
  await Promise.all([loginTimeout, purchaseTimeout]);
  login.resolve({});
  await flush();
  assert.equal(h.calls.some((call) => call.name === 'purchase'), false);
  await h.purchases.purchasePremium({});
  assert.equal(h.calls.filter((call) => call.name === 'purchase').length, 1);
});

test('a rejected login cannot expose the previous customer and can be retried safely', async () => {
  let attempts = 0;
  const h = harness({ logIn: async () => { if (++attempts === 1) throw new Error('offline'); } });
  await h.purchases.initializePurchases(h.id('a'));
  h.switchTo('b');
  await assert.rejects(h.purchases.initializePurchases(h.id('b')), /offline/);
  await assert.rejects(h.purchases.purchasePremium({}), /Contul comercial/);
  assert.equal(h.calls.some((call) => call.name === 'purchase'), false);
  await h.purchases.initializePurchases(h.id('b'));
  await h.purchases.purchasePremium({});
  assert.equal(h.calls.find((call) => call.name === 'purchase')?.value, h.id('b'));
});

test('invalidating a transition for the same UID rejects an older purchase callback', async () => {
  const transaction = deferred();
  const h = harness({ purchasePackage: () => transaction.promise });
  await h.purchases.initializePurchases(h.id('a'));
  const purchase = h.purchases.purchasePremium({});
  const rejected = assert.rejects(purchase, { code: 'session/changed' });
  await flush();
  h.switchTo('a');
  transaction.resolve({});
  await rejected;
  assert.equal(h.calls.some((call) => call.name === 'sync' || call.name === 'cache'), false);
  await h.purchases.purchasePremium({});
  assert.equal(h.calls.filter((call) => call.name === 'purchase').length, 2);
});

test('duplicate logout cleanup from context and service cannot detach a later configured account', async () => {
  const logout = deferred();
  const h = harness({ logOut: () => logout.promise });
  await h.purchases.initializePurchases(h.id('a'));
  h.switchTo(null);
  const contextReset = h.purchases.resetPurchasesForSignedOutUser();
  const contextTimeout = assert.rejects(contextReset, { code: 'purchases/timeout' });
  const serviceReset = h.purchases.resetPurchasesForSignedOutUser();
  const serviceTimeout = assert.rejects(serviceReset, { code: 'purchases/timeout' });
  await flush();
  await h.advance(20_000);
  await Promise.all([contextTimeout, serviceTimeout]);
  h.switchTo('b');
  const initialize = h.purchases.initializePurchases(h.id('b'));
  logout.resolve({});
  await initialize;
  await h.purchases.purchasePremium({});
  assert.equal(h.calls.filter((call) => call.name === 'logout').length, 1);
  assert.equal(h.calls.find((call) => call.name === 'purchase')?.value, h.id('b'));
});

test('a rejected logout leaves billing detached and does not poison the next login queue', async () => {
  const h = harness({ logOut: async () => { throw new Error('offline'); } });
  await h.purchases.initializePurchases(h.id('a'));
  h.switchTo('b');
  await assert.rejects(h.purchases.resetPurchasesForSignedOutUser(), /offline/);
  await assert.rejects(h.purchases.restorePremium(), /Contul comercial/);
  assert.equal(h.calls.some((call) => call.name === 'restore'), false);
  await h.purchases.initializePurchases(h.id('b'));
  await h.purchases.restorePremium();
  assert.equal(h.calls.find((call) => call.name === 'restore')?.value, h.id('b'));
});

test('a native rejection after a caller timeout is consumed and releases the SDK queue', async () => {
  const login = deferred();
  let attempts = 0;
  const h = harness({ logIn: () => ++attempts === 1 ? login.promise : Promise.resolve({}) });
  await h.purchases.initializePurchases(h.id('a'));
  h.switchTo('b');
  const initialize = h.purchases.initializePurchases(h.id('b'));
  const timeout = assert.rejects(initialize, { code: 'purchases/timeout' });
  await flush();
  await h.advance(20_000);
  await timeout;
  login.reject(new Error('late native failure'));
  await flush();
  await h.purchases.initializePurchases(h.id('b'));
  await h.purchases.purchasePremium({});
  assert.equal(h.calls.find((call) => call.name === 'purchase')?.value, h.id('b'));
});
