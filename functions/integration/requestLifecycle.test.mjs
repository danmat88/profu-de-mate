import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { claimAnalysisRequest, analysisRequestState, assertAnalysisLease, failAnalysisRequest, REQUEST_LEASE_MS } from '../lib/analysisRequests.js';
import { beginAccountDeletion, assertUserActive, finishAccountDeletion } from '../lib/userLifecycle.js';
import { submitFeedback, initializeFeedbackRecord } from '../lib/feedbackService.js';
import { reserveAnalysisQuota, settleAnalysisQuota, refundAnalysisQuota } from '../lib/commercialAccess.js';
import { createAccountMergeTicket, completeAccountMerge } from '../lib/accountMerge.js';
import { deleteQueryInBatches } from '../lib/cleanup.js';

if (!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')
  || !/^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '')) throw Error('Local demo emulators required.');
const app = initializeApp({ projectId: 'demo-profu-de-mate' });
const db = getFirestore(app);
before(() => db.doc('_runtimeConfig/commercial').set({ deviceRecallMode: 'off' }));
after(() => deleteApp(app));
const now = Date.now();
const input = { mode: 'solve', mimeType: 'image/jpeg', imageBase64: 'aW1hZ2U=', installationToken: 'a'.repeat(64), requestId: 'analysis-abcdef-123456' };
const ref = (uid) => db.collection('_analysisRequests').doc(`${uid}_${input.requestId}`);
const result = { status: 'unclear', mode: 'solve', summary: [{ type: 'text', text: 'Fotografie neclară.' }] };

test('only one concurrent request claims the lease; stale processing is recoverable', async () => {
  const attempts = await Promise.allSettled(Array.from({ length: 3 }, () => claimAnalysisRequest(db, 'claims', input, now)));
  assert.equal(attempts.filter((a) => a.status === 'fulfilled').length, 1);
  const old = (await ref('claims').get()).data();
  assert.equal(analysisRequestState(old, now + REQUEST_LEASE_MS), 'failed');
  const next = await claimAnalysisRequest(db, 'claims', input, now + REQUEST_LEASE_MS + 1);
  await failAnalysisRequest(db, 'claims', input.requestId, old.leaseId);
  assert.equal((await ref('claims').get()).data().leaseId, next.leaseId);
  assert.equal((await ref('claims').get()).data().state, 'processing');
  await assert.rejects(claimAnalysisRequest(db, 'claims', { ...input, mode: 'check' }, now), { code: 'invalid-argument' });
  await assert.rejects(claimAnalysisRequest(db, 'claims', { ...input, imageBase64: 'other' }, now), { code: 'invalid-argument' });
});

test('an obsolete worker cannot charge or refund a newer request lease', async () => {
  const uid = 'old-worker'; const principal = { identity: 'anonymous', principalId: `i_${'d'.repeat(64)}` };
  const first = await claimAnalysisRequest(db, uid, input, now);
  await reserveAnalysisQuota(db, uid, input.requestId, principal, now);
  const second = await claimAnalysisRequest(db, uid, input, now + REQUEST_LEASE_MS + 1);
  const oldGuard = (tx) => assertAnalysisLease(tx, db, uid, input.requestId, first.leaseId);
  await assert.rejects(refundAnalysisQuota(db, principal.principalId, input.requestId, undefined, oldGuard), { code: 'aborted' });
  await assert.rejects(settleAnalysisQuota(db, principal.principalId, input.requestId, true, () => {}, undefined, oldGuard), { code: 'aborted' });
  await settleAnalysisQuota(db, principal.principalId, input.requestId, true, (tx) => tx.update(ref(uid), { state: 'completed', response: { lessonId: 'lesson', result } }), undefined,
    (tx) => assertAnalysisLease(tx, db, uid, input.requestId, second.leaseId));
  assert.equal((await ref(uid).get()).data().state, 'completed');
  await assert.rejects(reserveAnalysisQuota(db, uid, input.requestId, principal, now + 200_000), { code: 'failed-precondition' });
  await assert.rejects(reserveAnalysisQuota(db, 'other-uid', input.requestId, principal, now + 200_000), { code: 'permission-denied' });
});

test('expired cleanup evaluates current data and preserves a refreshed saved lesson', async () => {
  const collection = db.collection('cleanupProbe');
  await collection.doc('expired').set({ expiresAt: Timestamp.fromMillis(now - 100) });
  await collection.doc('renewed').set({ expiresAt: Timestamp.fromMillis(now + 400 * 86400_000) });
  assert.equal(await deleteQueryInBatches(db, collection.where('expiresAt', '<=', Timestamp.fromMillis(now))), 1);
  assert.equal((await collection.doc('renewed').get()).exists, true);
  assert.equal((await collection.doc('expired').get()).exists, false);
});

test('deletion prevents late writes, request failure resurrection and direct guarded transactions', async () => {
  const uid = 'deletion'; const claim = await claimAnalysisRequest(db, uid, input, now);
  await beginAccountDeletion(db, uid); await ref(uid).delete();
  await assert.rejects(failAnalysisRequest(db, uid, input.requestId, claim.leaseId), { code: 'failed-precondition' });
  await assert.rejects(db.runTransaction(async (tx) => { await assertUserActive(tx, db, uid); tx.set(ref(uid), {}); }), { code: 'failed-precondition' });
  await finishAccountDeletion(db, uid);
  assert.equal((await ref(uid).get()).exists, false);
  await assert.rejects(claimAnalysisRequest(db, uid, input), { code: 'failed-precondition' });
});

test('non-ready AI content is reportable, bound to its owner, and remains reviewable after cache expiry', async () => {
  const uid = 'reports';
  await ref(uid).set({ userId: uid, state: 'completed', response: { lessonId: null, result } });
  await submitFeedback(db, uid, { requestId: input.requestId, category: 'unsafe', appVersion: '1.0.0' }, now);
  await assert.rejects(submitFeedback(db, 'stranger', { requestId: input.requestId, category: 'unsafe', appVersion: '1.0.0' }), { code: 'not-found' });
  const reports = await db.collection('feedback').where('userId', '==', uid).get();
  assert.equal(reports.size, 1);
  assert.deepEqual(reports.docs[0].data().reportedResult, result);
  await reports.docs[0].ref.update({ status: 'resolved' });
  await initializeFeedbackRecord(db, reports.docs[0].ref);
  assert.equal((await reports.docs[0].ref.get()).data().status, 'resolved');
  await reports.docs[0].ref.delete();
  await initializeFeedbackRecord(db, reports.docs[0].ref);
  assert.equal((await reports.docs[0].ref.get()).exists, false);
});

test('partial merge retains its recovery ticket beyond the original expiry', async () => {
  const uid = 'merge-interrupted', target = 'merge-recovered';
  const sourcePrincipal = `i_${'d'.repeat(64)}`, targetPrincipal = `g_${'e'.repeat(64)}`;
  const ticket = await createAccountMergeTicket(db, uid, sourcePrincipal, now);
  await db.doc(`users/${uid}/lessons/recover-me`).set({ userTitle: 'kept' });
  let transactions = 0;
  const interrupted = new Proxy(db, { get(instance, key) {
    if (key === 'runTransaction') return (...args) => {
      if (++transactions === 2) throw Error('simulated interruption after source freeze');
      return instance.runTransaction(...args);
    };
    const value = Reflect.get(instance, key);
    return typeof value === 'function' ? value.bind(instance) : value;
  } });
  const args = { db: interrupted, ticket, targetUserId: target, targetPrincipalId: targetPrincipal, expectedSourcePrincipalId: sourcePrincipal, now };
  await assert.rejects(completeAccountMerge(args), /simulated interruption/);
  const record = (await db.doc(`_accountMergeTickets/${ticket}`).get()).data();
  assert.equal(record.state, 'merging');
  assert.equal(record.expiresAt, undefined);
  const later = now + 8 * 24 * 60 * 60 * 1000;
  await deleteQueryInBatches(db, db.collection('_accountMergeTickets').where('expiresAt', '<=', Timestamp.fromMillis(later)));
  assert.equal((await db.doc(`_accountMergeTickets/${ticket}`).get()).exists, true);
  assert.equal((await completeAccountMerge({ ...args, db, now: later })).copiedLessons, 1);
  assert.equal((await db.doc(`users/${target}/lessons/recover-me`).get()).data().userTitle, 'kept');
});

test('merge refuses active analysis, then transfers once without overwriting target edits', async () => {
  const uid = 'merge-source', target = 'merge-target';
  const sourcePrincipal = `i_${'b'.repeat(64)}`, targetPrincipal = `g_${'c'.repeat(64)}`;
  const ticket = await createAccountMergeTicket(db, uid, sourcePrincipal, now);
  const args = { db, ticket, targetUserId: target, targetPrincipalId: targetPrincipal, expectedSourcePrincipalId: sourcePrincipal, now };
  const claim = await claimAnalysisRequest(db, uid, input, now);
  await assert.rejects(completeAccountMerge(args), { code: 'aborted' });
  assert.equal((await db.collection('_accountLifecycle').doc(uid).get()).exists, false);
  await failAnalysisRequest(db, uid, input.requestId, claim.leaseId);
  await db.doc(`users/${uid}/lessons/shared`).set({ userTitle: 'source', isFavorite: false });
  await db.doc(`users/${target}/lessons/shared`).set({ userTitle: 'target edit', isFavorite: true });
  await db.doc(`users/${uid}/lessons/unique`).set({ userTitle: 'copy' });
  // Exercise multiple transaction pages for both lessons and feedback.
  const fixtures = db.batch();
  for (let i = 0; i < 9; i++) {
    fixtures.set(db.doc(`users/${uid}/lessons/page-${i}`), { userTitle: `page ${i}` });
    fixtures.set(db.doc(`feedback/merge-${i}`), { userId: uid, status: 'new' });
  }
  await fixtures.commit();
  const merged = await completeAccountMerge(args);
  assert.equal(merged.copiedLessons, 10);
  assert.equal((await db.collection(`users/${target}/lessons`).get()).size, 11);
  assert.equal((await db.collection('feedback').where('userId', '==', uid).get()).size, 0);
  assert.equal((await db.collection('feedback').where('userId', '==', target).get()).size, 9);
  assert.equal((await db.doc(`users/${target}/lessons/shared`).get()).data().userTitle, 'target edit');
  assert.equal((await db.doc(`users/${target}/lessons/unique`).get()).data().userTitle, 'copy');
  assert.equal((await db.doc(`users/${uid}/lessons/unique`).get()).exists, false);
  assert.equal((await completeAccountMerge(args)).copiedLessons, 0);
  await assert.rejects(completeAccountMerge({ ...args, targetUserId: 'other-target' }), { code: 'permission-denied' });
});
