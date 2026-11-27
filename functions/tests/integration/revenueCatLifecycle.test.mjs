import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { syncRevenueCatEntitlement } from '../../lib/billing/revenueCat.js';
import { deferUnsafeRevenueCatDeletions, requestRevenueCatDeletionReview } from '../../lib/billing/revenueCatDeletion.js';

assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^(?:localhost|127\.0\.0\.1):\d{1,5}$/);
const app = initializeApp({ projectId: 'demo-profu-de-mate' }, 'revenuecat-lifecycle-tests');
const db = getFirestore(app);
after(() => deleteApp(app));
const now = Date.now();
const principal = (digit) => `g_${digit.repeat(64)}`;
const profile = (id) => db.collection('_commercialUsers').doc(id);
const entitlement = (id) => db.collection('_commercialEntitlements').doc(id);
const queue = (id) => db.collection('_pendingRevenueCatDeletions').doc(id);
const inactive = { active: false, planTier: null, entitlementId: 'premium', productId: null, expiresAtMs: null };
const customer = { subscriber: { entitlements: { premium: { expires_date: null, product_identifier: 'lifetime' } } } };

test('legacy, recreated and currently absent customers are retained for review without any HTTP DELETE', async (t) => {
  let networkCalls = 0;
  t.mock.method(globalThis, 'fetch', async () => { networkCalls += 1; throw Error('No network allowed'); });
  for (const id of [principal('1'), principal('2'), principal('3')]) {
    await queue(id).set({ appUserId: id, attempts: 4, userId: 'old-user', nextAttemptAt: Timestamp.fromMillis(now - 1) });
  }
  await profile(principal('2')).set({ userId: 'new-user' });
  const result = await deferUnsafeRevenueCatDeletions(db, now);
  assert.deepEqual(result, { inspected: 3, completed: 0, reviewRequired: 3 });
  for (const id of [principal('1'), principal('2'), principal('3')]) {
    const data = (await queue(id).get()).data();
    assert.equal(data.state, 'review_required');
    assert.equal(data.attempts, 4);
    assert.equal(data.userId, 'old-user');
    assert.equal(data.nextAttemptAt, undefined);
  }
  assert.equal((await queue(principal('2')).get()).data().reviewReason, 'customer_profile_present');
  assert.deepEqual(await deferUnsafeRevenueCatDeletions(db, now + 86_400_000), { inspected: 0, completed: 0, reviewRequired: 0 });
  assert.equal(networkCalls, 0);
});

test('new deletion requests remain explicitly pending and preserve earlier operation evidence', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw Error('No external request is safe here'); });
  const id = principal('4');
  await queue(id).set({ appUserId: id, userId: 'original-user', attempts: 7, nextAttemptAt: Timestamp.fromMillis(now) });
  await requestRevenueCatDeletionReview(db, id, 'recreated-user');
  const data = (await queue(id).get()).data();
  assert.equal(data.userId, 'original-user');
  assert.equal(data.lastRequestedByUserId, 'recreated-user');
  assert.equal(data.attempts, 7);
  assert.equal(data.state, 'review_required');
  assert.equal(data.nextAttemptAt, undefined);
});

test('a webhook fetched for a deleted UID cannot grant its response to the recreated account', async (t) => {
  const id = principal('5');
  await profile(id).set({ userId: 'rc-old-user' });
  t.mock.method(globalThis, 'fetch', async () => {
    await db.collection('_accountLifecycle').doc('rc-old-user').set({ state: 'deleted' });
    await profile(id).set({ userId: 'rc-new-user' });
    return { status: 200, ok: true, json: async () => customer };
  });
  const result = await syncRevenueCatEntitlement({ db, appUserId: id, secretApiKey: 'local-mock', entitlementId: 'premium', source: 'webhook' });
  assert.deepEqual(result, inactive);
  assert.equal((await entitlement(id).get()).exists, false);
});

test('a deletion queued while a provider fetch is pending prevents entitlement resurrection', async (t) => {
  const id = principal('6');
  await profile(id).set({ userId: 'rc-deleting-user' });
  t.mock.method(globalThis, 'fetch', async () => {
    await requestRevenueCatDeletionReview(db, id, 'rc-deleting-user');
    return { status: 200, ok: true, json: async () => customer };
  });
  const result = await syncRevenueCatEntitlement({ db, appUserId: id, secretApiKey: 'local-mock', entitlementId: 'premium', source: 'webhook' });
  assert.deepEqual(result, inactive);
  assert.equal((await entitlement(id).get()).exists, false);
});
