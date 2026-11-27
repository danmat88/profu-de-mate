import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { completeAccountMerge, createAccountMergeTicket } from '../../lib/accounts/accountMerge.js';
import {
  minimizeInstallationProfileForDeletion,
  removeOrRetainCommercialUsage,
  unlinkCommercialInstallations,
} from '../../lib/accounts/dataDeletion.js';
import {
  bindInstallationToAccount,
  bucharestQuotaWindow,
  consumeProviderAttempt,
  readCommercialAccess,
  reconcileStaleAnalysisReservations,
  reserveAnalysisQuota,
  settleAnalysisQuota,
} from '../../lib/access/commercialAccess.js';

assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^(?:localhost|127\.0\.0\.1):\d{1,5}$/,
  'Integration tests require an explicit local Firestore emulator.');
assert.match(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '', /^(?:localhost|127\.0\.0\.1):\d{1,5}$/,
  'Integration tests require an explicit local Auth emulator.');
const projectId = 'demo-profu-de-mate';
const app = initializeApp({ projectId });
const db = getFirestore(app);
const now = Date.parse('2040-03-15T10:00:00.000Z');
const day = '2040-03-15';
const userId = `integration-user-${Date.now()}`;
const deletedGoogleUserId = `deleted-google-${Date.now()}`;
const recreatedGoogleUserId = `recreated-google-${Date.now()}`;
const guestPrincipal = { identity: 'anonymous', principalId: `i_${'1'.repeat(64)}` };
const linkedGooglePrincipal = { identity: 'google', principalId: `g_${'2'.repeat(64)}` };
const deletedGooglePrincipal = { identity: 'google', principalId: `g_${'3'.repeat(64)}` };
const legacyInstallationPrincipal = { identity: 'anonymous', principalId: `i_${'4'.repeat(64)}` };
const minimizedInstallationPrincipal = `i_${'6'.repeat(64)}`;
const emptyInstallationPrincipal = `i_${'7'.repeat(64)}`;
const retainedMergeInstallationPrincipal = `i_${'8'.repeat(64)}`;
const retainedMergeGooglePrincipal = { identity: 'google', principalId: `g_${'9'.repeat(64)}` };
const retainedMergeUserId = `retained-merge-${Date.now()}`;
const staleReservationUserId = `stale-reservation-${Date.now()}`;
const staleReservationPrincipal = { identity: 'anonymous', principalId: `i_${'a'.repeat(64)}` };

async function deleteIfPresent(reference) {
  await reference.delete().catch(() => undefined);
}

after(async () => {
  const reservations = await db.collection('_commercialReservations')
    .where('userId', 'in', [userId, deletedGoogleUserId, staleReservationUserId])
    .get();
  const batch = db.batch();
  reservations.docs.forEach((document) => batch.delete(document.ref));
  const mergeTickets = await db.collection('_accountMergeTickets')
    .where('sourceUserId', 'in', [userId, retainedMergeUserId])
    .get();
  mergeTickets.docs.forEach((document) => batch.delete(document.ref));
  await batch.commit();
  await Promise.all([
    deleteIfPresent(db.collection('_commercialUsers').doc(guestPrincipal.principalId)),
    deleteIfPresent(db.collection('_commercialUsers').doc(linkedGooglePrincipal.principalId)),
    deleteIfPresent(db.collection('_commercialUsers').doc(deletedGooglePrincipal.principalId)),
    deleteIfPresent(db.collection('_commercialUsers').doc(legacyInstallationPrincipal.principalId)),
    deleteIfPresent(db.collection('_commercialUsers').doc(minimizedInstallationPrincipal)),
    deleteIfPresent(db.collection('_commercialUsers').doc(emptyInstallationPrincipal)),
    deleteIfPresent(db.collection('_commercialUsers').doc(retainedMergeInstallationPrincipal)),
    deleteIfPresent(db.collection('_commercialUsers').doc(staleReservationPrincipal.principalId)),
    deleteIfPresent(db.collection('_commercialUsers').doc(retainedMergeGooglePrincipal.principalId)),
    deleteIfPresent(db.collection('_commercialUsage').doc(`${guestPrincipal.principalId}_${day}`)),
    deleteIfPresent(db.collection('_commercialUsage').doc(`${staleReservationPrincipal.principalId}_${day}`)),
    deleteIfPresent(db.collection('_commercialUsage').doc(`${retainedMergeInstallationPrincipal}_${day}`)),
    deleteIfPresent(db.collection('_commercialUsage').doc(`${linkedGooglePrincipal.principalId}_${day}`)),
    deleteIfPresent(db.collection('_commercialUsage').doc(`${deletedGooglePrincipal.principalId}_${day}`)),
    deleteIfPresent(db.collection('_commercialUsage').doc(`${retainedMergeGooglePrincipal.principalId}_${day}`)),
    deleteIfPresent(db.collection('_commercialEntitlements').doc(linkedGooglePrincipal.principalId)),
    deleteIfPresent(db.collection('_commercialGlobal').doc(day)),
    deleteIfPresent(db.collection('_integrationResults').doc(userId)),
  ]);
  await deleteApp(app);
});

test('un cont temporar primește un singur bilet de fuziune activ', async () => {
  const first = await createAccountMergeTicket(db, userId, guestPrincipal.principalId, now);
  const second = await createAccountMergeTicket(db, userId, guestPrincipal.principalId, now + 1_000);
  assert.equal(second, first);
  const ticket = await db.collection('_accountMergeTickets').doc(first).get();
  assert.equal(ticket.data()?.sourceUserId, userId);
  assert.equal(ticket.data()?.sourcePrincipalId, guestPrincipal.principalId);
  assert.equal(ticket.data()?.state, 'issued');
});

test('rezervarea concurentă a aceleiași cereri consumă o singură problemă', async () => {
  const requestId = 'analysis-concurrent-0001';
  await Promise.all([
    reserveAnalysisQuota(db, userId, requestId, guestPrincipal, now),
    reserveAnalysisQuota(db, userId, requestId, guestPrincipal, now),
  ]);

  const [usage, profile, global, reservation] = await Promise.all([
    db.collection('_commercialUsage').doc(`${guestPrincipal.principalId}_${day}`).get(),
    db.collection('_commercialUsers').doc(guestPrincipal.principalId).get(),
    db.collection('_commercialGlobal').doc(day).get(),
    db.collection('_commercialReservations').doc(`${guestPrincipal.principalId}_${requestId}`).get(),
  ]);
  assert.equal(usage.data()?.requests, 1);
  assert.ok(profile.data()?.expiresAt?.toMillis() >= now + 399 * 24 * 60 * 60 * 1000);
  assert.equal(global.exists, false, 'Reserving user allowance makes no provider request.');
  assert.equal(reservation.data()?.state, 'reserved');
});

test('un rezultat nefinalizat restituie problema fără a restitui încercarea furnizorului', async () => {
  const requestId = 'analysis-concurrent-0001';
  await consumeProviderAttempt(db, 300, now, userId);
  const resultRef = db.collection('_integrationResults').doc(userId);
  await settleAnalysisQuota(db, guestPrincipal.principalId, requestId, false, (transaction) => {
    transaction.set(resultRef, { status: 'not_math' });
  });

  const [usage, global, reservation, result] = await Promise.all([
    db.collection('_commercialUsage').doc(`${guestPrincipal.principalId}_${day}`).get(),
    db.collection('_commercialGlobal').doc(day).get(),
    db.collection('_commercialReservations').doc(`${guestPrincipal.principalId}_${requestId}`).get(),
    resultRef.get(),
  ]);
  assert.equal(usage.data()?.requests, 0);
  assert.equal(global.data()?.providerAttempts, 1);
  assert.equal(reservation.data()?.state, 'refunded');
  assert.equal(result.data()?.status, 'not_math');
});

test('o rezervare abandonată restituie automat problema fără dublu refund', async () => {
  const requestId = 'analysis-stale-000001';
  await reserveAnalysisQuota(db, staleReservationUserId, requestId, staleReservationPrincipal, now);
  await consumeProviderAttempt(db, 300, now, staleReservationUserId);
  assert.equal(
    await reconcileStaleAnalysisReservations(db, staleReservationPrincipal.principalId, now + 6 * 60_000),
    1,
  );
  assert.equal(
    await reconcileStaleAnalysisReservations(db, staleReservationPrincipal.principalId, now + 7 * 60_000),
    0,
  );
  const access = await readCommercialAccess(
    db,
    staleReservationUserId,
    staleReservationPrincipal,
    now + 7 * 60_000,
  );
  assert.equal(access.used, 0);
  assert.equal(access.remaining, 5);
  assert.equal((await db.collection('_commercialGlobal').doc(day).get()).data()?.providerAttempts, 2);
});

test('aceeași cerere poate fi reluată după refund și este taxată o singură dată la succes', async () => {
  const requestId = 'analysis-concurrent-0001';
  await reserveAnalysisQuota(db, userId, requestId, guestPrincipal, now + 1_000);
  await consumeProviderAttempt(db, 300, now + 1_000, userId);
  await settleAnalysisQuota(db, guestPrincipal.principalId, requestId, true, (transaction) => {
    transaction.set(db.collection('_integrationResults').doc(userId), { status: 'ready' });
  });
  await settleAnalysisQuota(db, guestPrincipal.principalId, requestId, true, () => undefined);

  const [usage, global, reservation] = await Promise.all([
    db.collection('_commercialUsage').doc(`${guestPrincipal.principalId}_${day}`).get(),
    db.collection('_commercialGlobal').doc(day).get(),
    db.collection('_commercialReservations').doc(`${guestPrincipal.principalId}_${requestId}`).get(),
  ]);
  assert.equal(usage.data()?.requests, 1);
  assert.equal(global.data()?.providerAttempts, 3);
  assert.equal(reservation.data()?.state, 'consumed');
});

test('a șasea problemă gratuită pe zi este refuzată de tranzacția serverului', async () => {
  for (let index = 2; index <= 5; index += 1) {
    const requestId = `analysis-limit-000${index}`;
    await reserveAnalysisQuota(db, userId, requestId, guestPrincipal, now + index * 61_000);
    await settleAnalysisQuota(db, guestPrincipal.principalId, requestId, true, () => undefined);
  }

  await assert.rejects(
    reserveAnalysisQuota(db, userId, 'analysis-limit-0006', guestPrincipal, now + 6 * 61_000),
    (error) => error?.details?.commercialReason === 'daily_exhausted',
  );
  const usage = await db.collection('_commercialUsage').doc(`${guestPrincipal.principalId}_${day}`).get();
  assert.equal(usage.data()?.requests, 5);
});

test('legarea directă la Google mută utilizarea zilei în cont fără bonus', async () => {
  const profile = await db.collection('_commercialUsers').doc(guestPrincipal.principalId).get();
  const ticket = profile.data()?.activeMergeTicket;
  assert.equal(typeof ticket, 'string');
  await assert.rejects(
    completeAccountMerge({
      db,
      ticket,
      targetUserId: userId,
      targetPrincipalId: linkedGooglePrincipal.principalId,
      expectedSourcePrincipalId: legacyInstallationPrincipal.principalId,
      now: now + 7 * 61_000,
    }),
    (error) => error?.code === 'failed-precondition',
  );
  const result = await completeAccountMerge({
    db,
    ticket,
    targetUserId: userId,
    targetPrincipalId: linkedGooglePrincipal.principalId,
    expectedSourcePrincipalId: guestPrincipal.principalId,
    now: now + 7 * 61_000,
  });
  assert.deepEqual(result, { merged: true, copiedLessons: 0 });

  const [daily, completedTicket, preservedProfile] = await Promise.all([
    db.collection('_commercialUsage').doc(`${linkedGooglePrincipal.principalId}_${day}`).get(),
    db.collection('_accountMergeTickets').doc(ticket).get(),
    db.collection('_commercialUsers').doc(guestPrincipal.principalId).get(),
  ]);
  assert.equal(daily.data()?.requests, 5);
  assert.equal(completedTicket.data()?.state, 'completed');
  assert.equal(preservedProfile.exists, true);
  assert.equal(preservedProfile.data()?.welcomeLocked, undefined);
  assert.equal(preservedProfile.data()?.activeMergeTicket, undefined);
  assert.ok(preservedProfile.data()?.expiresAt?.toMillis() >= now + 399 * 24 * 60 * 60 * 1000);
});

test('logout-ul păstrează contorul zilnic al dispozitivului fără resetare', async () => {
  const access = await readCommercialAccess(
    db,
    `rotated-anonymous-${Date.now()}`,
    guestPrincipal,
    now + 8 * 61_000,
  );
  assert.equal(access.identity, 'anonymous');
  assert.equal(access.reason, 'daily_exhausted');
  assert.equal(access.remaining, 0);
  assert.equal(access.resetAt, bucharestQuotaWindow(now + 8 * 61_000).resetAt);
  assert.equal(access.purchaseUserId, guestPrincipal.principalId);
});

test('o sesiune Google curăță lock-ul vechi fără să consume problemele instalării', async () => {
  await bindInstallationToAccount(
    db,
    legacyInstallationPrincipal.principalId,
    linkedGooglePrincipal.principalId,
    userId,
    now + 9 * 61_000,
  );
  await bindInstallationToAccount(
    db,
    legacyInstallationPrincipal.principalId,
    linkedGooglePrincipal.principalId,
    userId,
    now + 10 * 61_000,
  );
  const access = await readCommercialAccess(
    db,
    `legacy-rotated-${Date.now()}`,
    legacyInstallationPrincipal,
    now + 10 * 61_000,
  );
  assert.equal(access.reason, 'available');
  assert.equal(access.remaining, 5);
});

test('ștergerea și recrearea aceluiași Google nu resetează cota zilei', async () => {
  const requestId = 'analysis-google-delete-0001';
  await reserveAnalysisQuota(db, deletedGoogleUserId, requestId, deletedGooglePrincipal, now + 10 * 61_000);
  await settleAnalysisQuota(db, deletedGooglePrincipal.principalId, requestId, true, () => undefined);
  const retainedRef = db.collection('_commercialUsage').doc(`${deletedGooglePrincipal.principalId}_${day}`);
  await retainedRef.set({ userId: deletedGoogleUserId, accidentalMetadata: 'must-not-survive' }, { merge: true });
  await removeOrRetainCommercialUsage(db, deletedGooglePrincipal, now + 11 * 61_000);
  await db.collection('_commercialUsers').doc(deletedGooglePrincipal.principalId).delete();

  const retained = await retainedRef.get();
  assert.equal(retained.data()?.requests, 1);
  assert.equal(retained.data()?.requestIds, undefined);
  assert.equal(retained.data()?.userId, undefined);
  assert.equal(retained.data()?.accidentalMetadata, undefined);
  assert.equal(retained.data()?.retainedFor, 'quota-abuse-prevention');
  assert.equal(retained.data()?.expiresAt?.toMillis(), Date.parse(bucharestQuotaWindow(now).resetAt));

  const access = await readCommercialAccess(
    db,
    recreatedGoogleUserId,
    deletedGooglePrincipal,
    now + 12 * 61_000,
  );
  assert.equal(access.identity, 'google');
  assert.equal(access.used, 1);
  assert.equal(access.remaining, 4);
});

test('ștergerea Google elimină legăturile reversibile de pe toate instalările', async () => {
  const secondInstallation = `i_${'5'.repeat(64)}`;
  await Promise.all([
    db.collection('_commercialUsers').doc(legacyInstallationPrincipal.principalId).set({
      principalId: legacyInstallationPrincipal.principalId,
      userId: deletedGoogleUserId,
      linkedAccountPrincipalId: deletedGooglePrincipal.principalId,
      linkedAccountUserId: deletedGoogleUserId,
      linkedAt: new Date(now),
      welcomeRequests: 5,
    }, { merge: true }),
    db.collection('_commercialUsers').doc(secondInstallation).set({
      principalId: secondInstallation,
      userId: recreatedGoogleUserId,
      linkedAccountPrincipalId: deletedGooglePrincipal.principalId,
      linkedAccountUserId: recreatedGoogleUserId,
      activeMergeTicket: 'sensitive-ticket',
      welcomeRequests: 2,
    }),
  ]);

  assert.equal(await unlinkCommercialInstallations(db, deletedGooglePrincipal.principalId, now), 2);
  const [first, second] = await Promise.all([
    db.collection('_commercialUsers').doc(legacyInstallationPrincipal.principalId).get(),
    db.collection('_commercialUsers').doc(secondInstallation).get(),
  ]);
  for (const profile of [first.data(), second.data()]) {
    assert.equal(profile?.userId, undefined);
    assert.equal(profile?.linkedAccountPrincipalId, undefined);
    assert.equal(profile?.linkedAccountUserId, undefined);
    assert.equal(profile?.activeMergeTicket, undefined);
    assert.equal(profile?.welcomeLocked, undefined);
  }
  assert.equal(first.data()?.welcomeRequests, 5);
  assert.equal(second.data()?.welcomeRequests, 2);
  await db.collection('_commercialUsers').doc(secondInstallation).delete();
});

test('ștergerea păstrează numai markerul minim necesar pentru oferta guest', async () => {
  const reference = db.collection('_commercialUsers').doc(minimizedInstallationPrincipal);
  await reference.set({
    principalId: minimizedInstallationPrincipal,
    userId: userId,
    linkedAccountPrincipalId: linkedGooglePrincipal.principalId,
    linkedAccountUserId: userId,
    welcomeRequests: 3,
    welcomeRequestIds: ['request-that-must-not-survive'],
    welcomeTodayDay: day,
    welcomeTodayRetainedRequests: 1,
    welcomeTodayRequestIds: ['request-that-must-not-survive', 'request-that-must-not-survive'],
    burstRequests: 4,
    deviceRecallClaimed: true,
    accidentalMetadata: 'must-not-survive',
  });

  assert.equal(await minimizeInstallationProfileForDeletion(db, minimizedInstallationPrincipal, now), 'retained');
  const retained = await reference.get();
  assert.equal(retained.data()?.principalId, minimizedInstallationPrincipal);
  assert.equal(retained.data()?.welcomeRequests, 3);
  assert.equal(retained.data()?.welcomeTodayDay, day);
  assert.equal(retained.data()?.welcomeTodayRetainedRequests, 2);
  assert.equal(retained.data()?.deviceRecallClaimed, true);
  assert.equal(retained.data()?.retainedFor, 'welcome-abuse-prevention');
  assert.equal(retained.data()?.expiresAt?.toMillis(), now + 400 * 24 * 60 * 60 * 1000);
  assert.equal(retained.data()?.welcomeTodayTransferHashes?.length, 1);
  retained.data()?.welcomeTodayTransferHashes?.forEach((hash) => assert.match(hash, /^[a-f0-9]{64}$/));
  assert.deepEqual(
    Object.keys(retained.data() ?? {}).sort(),
    ['deviceRecallClaimed', 'expiresAt', 'principalId', 'retainedFor', 'updatedAt', 'welcomeRequests', 'welcomeTodayDay', 'welcomeTodayRetainedRequests', 'welcomeTodayTransferHashes'],
  );
});

test('conectarea Google preia consumul zilei chiar după minimizarea profilului temporar', async () => {
  const reference = db.collection('_commercialUsers').doc(retainedMergeInstallationPrincipal);
  await reference.set({
    principalId: retainedMergeInstallationPrincipal,
    welcomeRequests: 2,
    welcomeTodayDay: day,
    welcomeTodayRequestIds: ['guest-before-delete-1', 'guest-before-delete-2'],
  });
  assert.equal(await minimizeInstallationProfileForDeletion(db, retainedMergeInstallationPrincipal, now), 'retained');

  const ticket = await createAccountMergeTicket(
    db,
    retainedMergeUserId,
    retainedMergeInstallationPrincipal,
    now + 1_000,
  );
  await completeAccountMerge({
    db,
    ticket,
    targetUserId: retainedMergeUserId,
    targetPrincipalId: retainedMergeGooglePrincipal.principalId,
    expectedSourcePrincipalId: retainedMergeInstallationPrincipal,
    now: now + 2_000,
  });

  const daily = await db.collection('_commercialUsage')
    .doc(`${retainedMergeGooglePrincipal.principalId}_${day}`)
    .get();
  assert.equal(daily.data()?.requests, 2);
  assert.deepEqual(daily.data()?.requestIds, []);
  assert.equal(daily.data()?.transferHashes?.length, 2);

  // Account deletion minimizes both sides. Recreating and reconnecting the
  // same Google identity must recognize the previously transferred guest use
  // instead of counting those same two problems a second time.
  await removeOrRetainCommercialUsage(db, retainedMergeGooglePrincipal, now + 3_000);
  assert.equal(await minimizeInstallationProfileForDeletion(
    db,
    retainedMergeInstallationPrincipal,
    now + 4_000,
  ), 'retained');
  const recreatedTicket = await createAccountMergeTicket(
    db,
    retainedMergeUserId,
    retainedMergeInstallationPrincipal,
    now + 5_000,
  );
  await completeAccountMerge({
    db,
    ticket: recreatedTicket,
    targetUserId: retainedMergeUserId,
    targetPrincipalId: retainedMergeGooglePrincipal.principalId,
    expectedSourcePrincipalId: retainedMergeInstallationPrincipal,
    now: now + 6_000,
  });
  const reconnectedDaily = await db.collection('_commercialUsage')
    .doc(`${retainedMergeGooglePrincipal.principalId}_${day}`)
    .get();
  assert.equal(reconnectedDaily.data()?.requests, 2);
});

test('ștergerea elimină profilul anonim gol creat numai pentru legarea contului', async () => {
  const reference = db.collection('_commercialUsers').doc(emptyInstallationPrincipal);
  await reference.set({
    principalId: emptyInstallationPrincipal,
    userId,
    linkedAccountPrincipalId: linkedGooglePrincipal.principalId,
    linkedAccountUserId: userId,
  });

  assert.equal(await minimizeInstallationProfileForDeletion(db, emptyInstallationPrincipal, now), 'deleted');
  assert.equal((await reference.get()).exists, false);
});

test('provider capacity is irreversible across refunded analyses and retries', async () => {
  const budgetNow = Date.parse('2041-04-15T10:00:00.000Z');
  const budgetUser = 'provider-refund-test';
  const principal = { identity: 'anonymous', principalId: `i_${'b'.repeat(64)}` };
  const globalRef = db.collection('_commercialGlobal').doc(bucharestQuotaWindow(budgetNow).day);
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const requestId = `provider-refund-${attempt}`;
      await reserveAnalysisQuota(db, budgetUser, requestId, principal, budgetNow + attempt * 61_000);
      await consumeProviderAttempt(db, 2, budgetNow + attempt * 61_000, budgetUser);
      await settleAnalysisQuota(db, principal.principalId, requestId, false, () => undefined);
    }
    assert.equal((await readCommercialAccess(db, budgetUser, principal, budgetNow)).used, 0);
    await assert.rejects(consumeProviderAttempt(db, 2, budgetNow, budgetUser),
      (error) => error?.details?.commercialReason === 'service_capacity');
    assert.equal((await globalRef.get()).data()?.providerAttempts, 2);
  } finally {
    await Promise.all([
      globalRef.delete(),
      db.collection('_commercialUsage').doc(`${principal.principalId}_${bucharestQuotaWindow(budgetNow).day}`).delete(),
      db.collection('_commercialUsers').doc(principal.principalId).delete(),
      ...[0, 1].map((attempt) => db.collection('_commercialReservations').doc(`${principal.principalId}_provider-refund-${attempt}`).delete()),
    ]);
  }
});

test('concurrent provider attempts cannot exceed the shared cap', async () => {
  const budgetNow = Date.parse('2041-04-16T10:00:00.000Z');
  const globalRef = db.collection('_commercialGlobal').doc(bucharestQuotaWindow(budgetNow).day);
  try {
    const outcomes = await Promise.allSettled(Array.from({ length: 20 },
      () => consumeProviderAttempt(db, 4, budgetNow, userId)));
    assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 4);
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') assert.equal(outcome.reason?.details?.commercialReason, 'service_capacity');
    }
    assert.equal((await globalRef.get()).data()?.providerAttempts, 4);
  } finally {
    await globalRef.delete();
  }
});

test('legacy daily counters fail closed without pretending prior refunds were free', async () => {
  const budgetNow = Date.parse('2041-04-17T10:00:00.000Z');
  const legacyRef = db.collection('_commercialGlobal').doc(bucharestQuotaWindow(budgetNow).day);
  const tomorrow = budgetNow + 24 * 60 * 60 * 1000;
  const nextRef = db.collection('_commercialGlobal').doc(bucharestQuotaWindow(tomorrow).day);
  try {
    await legacyRef.set({ requests: 0 });
    await assert.rejects(consumeProviderAttempt(db, 300, budgetNow, userId),
      (error) => error?.details?.budgetReason === 'legacy_or_invalid_counter');
    assert.deepEqual((await legacyRef.get()).data(), { requests: 0 });
    await consumeProviderAttempt(db, 300, tomorrow, userId);
    assert.equal((await nextRef.get()).data()?.providerAttempts, 1);
  } finally {
    await Promise.all([legacyRef.delete(), nextRef.delete()]);
  }
});

test('an account marked for deletion cannot reserve provider capacity or resurrect refunded usage', async () => {
  const budgetNow = Date.parse('2041-04-19T10:00:00.000Z');
  const budgetUser = 'provider-deletion-test';
  const requestId = 'provider-deletion-request';
  const principal = { identity: 'anonymous', principalId: `i_${'c'.repeat(64)}` };
  const lifecycleRef = db.collection('_accountLifecycle').doc(budgetUser);
  const globalRef = db.collection('_commercialGlobal').doc(bucharestQuotaWindow(budgetNow).day);
  const usageRef = db.collection('_commercialUsage').doc(`${principal.principalId}_${bucharestQuotaWindow(budgetNow).day}`);
  const profileRef = db.collection('_commercialUsers').doc(principal.principalId);
  const reservationRef = db.collection('_commercialReservations').doc(`${principal.principalId}_${requestId}`);
  let resultWrites = 0;
  try {
    await reserveAnalysisQuota(db, budgetUser, requestId, principal, budgetNow);
    await lifecycleRef.set({ state: 'deleting' });
    await profileRef.delete();
    await usageRef.delete();
    await assert.rejects(consumeProviderAttempt(db, 300, budgetNow, budgetUser), (error) => error?.code === 'failed-precondition');
    await assert.rejects(settleAnalysisQuota(db, principal.principalId, requestId, false, () => { resultWrites += 1; }),
      (error) => error?.code === 'failed-precondition');
    assert.equal(resultWrites, 0);
    assert.equal((await globalRef.get()).exists, false);
    assert.equal((await profileRef.get()).exists, false);
    assert.equal((await usageRef.get()).exists, false);
  } finally {
    await Promise.all([lifecycleRef.delete(), globalRef.delete(), usageRef.delete(), profileRef.delete(), reservationRef.delete()]);
  }
});

test('daily quota resets at Bucharest midnight without a scheduled deletion and retries/refunds stay on their original day', async () => {
  const principal = { identity: 'google', principalId: `g_${'d'.repeat(64)}` };
  const quotaUser = 'daily-midnight-test';
  const before = Date.parse('2043-01-15T21:59:30.000Z');
  const after = Date.parse('2043-01-15T22:00:01.000Z');
  const previousDay = db.collection('_commercialUsage').doc(`${principal.principalId}_2043-01-15`);
  const nextDay = db.collection('_commercialUsage').doc(`${principal.principalId}_2043-01-16`);
  const oldRequest = 'daily-before-midnight';
  const newRequest = 'daily-after-midnight';
  try {
    await previousDay.set({ requests: 4, requestIds: ['earlier-1', 'earlier-2', 'earlier-3', 'earlier-4'] });
    const last = await reserveAnalysisQuota(db, quotaUser, oldRequest, principal, before);
    assert.equal(last.remaining, 0);
    assert.equal(last.resetAt, '2043-01-15T22:00:00.000Z');
    assert.equal((await readCommercialAccess(db, quotaUser, principal, after)).remaining, 5);
    assert.equal((await previousDay.get()).data()?.requests, 5, 'Reset does not rely on Firestore TTL deletion.');

    await Promise.all([
      reserveAnalysisQuota(db, quotaUser, oldRequest, principal, after),
      reserveAnalysisQuota(db, quotaUser, oldRequest, principal, after),
    ]);
    assert.equal((await nextDay.get()).exists, false, 'Retrying yesterday’s reservation does not spend today twice.');
    await reserveAnalysisQuota(db, quotaUser, newRequest, principal, after);
    await Promise.all([
      settleAnalysisQuota(db, principal.principalId, oldRequest, false, () => undefined),
      settleAnalysisQuota(db, principal.principalId, oldRequest, false, () => undefined),
    ]);
    assert.equal((await previousDay.get()).data()?.requests, 4);
    assert.equal((await nextDay.get()).data()?.requests, 1, 'A refund after midnight returns only yesterday’s slot.');
    await settleAnalysisQuota(db, principal.principalId, newRequest, true, () => undefined);
    assert.equal((await readCommercialAccess(db, quotaUser, principal, after)).remaining, 4);
  } finally {
    await Promise.all([
      previousDay.delete(), nextDay.delete(),
      db.collection('_commercialUsers').doc(principal.principalId).delete(),
      ...[oldRequest, newRequest].map((request) => db.collection('_commercialReservations').doc(`${principal.principalId}_${request}`).delete()),
    ]);
  }
});

test('concurrent requests on separate devices cannot both consume the final daily slot', async () => {
  const principal = { identity: 'google', principalId: `g_${'e'.repeat(64)}` };
  const quotaUser = 'daily-concurrent-test';
  const at = Date.parse('2043-01-17T10:00:00.000Z');
  const daily = db.collection('_commercialUsage').doc(`${principal.principalId}_2043-01-17`);
  const requests = ['daily-last-slot-device-a', 'daily-last-slot-device-b'];
  try {
    await daily.set({ requests: 4, requestIds: ['earlier-1', 'earlier-2', 'earlier-3', 'earlier-4'] });
    const outcomes = await Promise.allSettled(requests.map((request) => reserveAnalysisQuota(db, quotaUser, request, principal, at)));
    assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    assert.equal(rejected?.reason?.details?.commercialReason, 'daily_exhausted');
    assert.equal((await daily.get()).data()?.requests, 5);
  } finally {
    await Promise.all([
      daily.delete(), db.collection('_commercialUsers').doc(principal.principalId).delete(),
      ...requests.map((request) => db.collection('_commercialReservations').doc(`${principal.principalId}_${request}`).delete()),
    ]);
  }
});

test('both guest and Premium receive fresh daily counters at Bucharest midnight', async () => {
  const guest = { identity: 'anonymous', principalId: `i_${'d'.repeat(64)}` };
  const premium = { identity: 'google', principalId: `g_${'f'.repeat(64)}` };
  const quotaUser = 'daily-tier-test';
  const before = Date.parse('2043-07-15T20:59:59.000Z');
  const after = Date.parse('2043-07-15T21:00:00.000Z');
  const previousGuestDaily = db.collection('_commercialUsage').doc(`${guest.principalId}_2043-07-15`);
  const premiumEntitlement = db.collection('_commercialEntitlements').doc(premium.principalId);
  const previousDaily = db.collection('_commercialUsage').doc(`${premium.principalId}_2043-07-15`);
  try {
    await Promise.all([
      previousGuestDaily.set({ principalId: guest.principalId, day: '2043-07-15', requests: 5 }),
      premiumEntitlement.set({ active: true, productId: 'test-premium' }),
      previousDaily.set({ principalId: premium.principalId, day: '2043-07-15', requests: 50 }),
    ]);
    assert.equal((await readCommercialAccess(db, quotaUser, premium, before)).remaining, 0);
    assert.equal((await readCommercialAccess(db, quotaUser, guest, before)).remaining, 0);
    const newPremium = await readCommercialAccess(db, quotaUser, premium, after);
    assert.equal(newPremium.tier, 'premium');
    assert.equal(newPremium.remaining, 50);
    const sameGuest = await readCommercialAccess(db, quotaUser, guest, after);
    assert.equal(sameGuest.remaining, 5);
    assert.equal(sameGuest.resetAt, '2043-07-16T21:00:00.000Z');
    assert.equal(sameGuest.reason, 'available');
  } finally {
    await Promise.all([previousGuestDaily.delete(), premiumEntitlement.delete(), previousDaily.delete()]);
  }
});

test('dual-bound daily quota survives uninstall/reinstall, sign-out, alt Gmail, second phone, and refunds symmetrically', async () => {
  const deviceId = `i_${'7'.repeat(63)}a`;
  const otherDeviceId = `i_${'7'.repeat(63)}b`;
  const googlePrimary = { identity: 'google', principalId: `g_${'7'.repeat(63)}1` };
  const googleAlt = { identity: 'google', principalId: `g_${'7'.repeat(63)}2` };
  const guestDevice = { identity: 'anonymous', principalId: deviceId };
  const testDay = '2044-05-10';
  const baseAt = Date.parse('2044-05-10T09:00:00.000Z');
  const primaryUid = 'dual-bound-primary-uid';
  const reinstalledGuestUid = 'dual-bound-guest-uid';
  const altUid = 'dual-bound-alt-uid';
  const requests = ['dual-req-1', 'dual-req-2', 'dual-req-3', 'dual-req-4', 'dual-req-refund', 'dual-req-5'];
  try {
    // 1. Spend 4 problems while connected with Google on this phone.
    for (let i = 0; i < 4; i += 1) {
      await reserveAnalysisQuota(db, primaryUid, requests[i], googlePrimary, baseAt + i * 61_000, deviceId);
      await settleAnalysisQuota(db, googlePrimary.principalId, requests[i], true, () => undefined);
    }
    const afterFour = await readCommercialAccess(db, primaryUid, googlePrimary, baseAt + 5 * 61_000, deviceId);
    assert.equal(afterFour.remaining, 1);

    // 2. A failed/refunded analysis restores BOTH account and device counters symmetrically.
    await reserveAnalysisQuota(db, primaryUid, requests[4], googlePrimary, baseAt + 6 * 61_000, deviceId);
    await settleAnalysisQuota(db, googlePrimary.principalId, requests[4], false, () => undefined);
    assert.equal((await readCommercialAccess(db, primaryUid, googlePrimary, baseAt + 6 * 61_000, deviceId)).remaining, 1);
    assert.equal((await readCommercialAccess(db, reinstalledGuestUid, guestDevice, baseAt + 6 * 61_000, deviceId)).remaining, 1);

    // 3. Uninstall & reinstall -> opens as fresh guest on the SAME phone -> sees 1/5 (NOT 5/5!).
    const afterReinstall = await readCommercialAccess(db, reinstalledGuestUid, guestDevice, baseAt + 7 * 61_000, deviceId);
    assert.equal(afterReinstall.used, 4);
    assert.equal(afterReinstall.remaining, 1);

    // 4. Spend the 1 remaining problem as guest -> reaches 0/5.
    await reserveAnalysisQuota(db, reinstalledGuestUid, requests[5], guestDevice, baseAt + 8 * 61_000, deviceId);
    await settleAnalysisQuota(db, guestDevice.principalId, requests[5], true, () => undefined);
    assert.equal((await readCommercialAccess(db, reinstalledGuestUid, guestDevice, baseAt + 9 * 61_000, deviceId)).remaining, 0);

    // 5. Reconnect with Google -> merges req5 -> sees 0/5 (NOT 4/5!).
    const ticket = await createAccountMergeTicket(db, reinstalledGuestUid, deviceId, baseAt + 9 * 61_000);
    await completeAccountMerge({
      db,
      ticket,
      targetUserId: primaryUid,
      targetPrincipalId: googlePrimary.principalId,
      expectedSourcePrincipalId: deviceId,
      now: baseAt + 10 * 61_000,
    });
    const reconnected = await readCommercialAccess(db, primaryUid, googlePrimary, baseAt + 10 * 61_000, deviceId);
    assert.equal(reconnected.used, 5);
    assert.equal(reconnected.remaining, 0);
    assert.equal(reconnected.reason, 'daily_exhausted');

    // 6. Switch to a second Gmail on the same phone -> still 0/5!
    const altOnSamePhone = await readCommercialAccess(db, altUid, googleAlt, baseAt + 10 * 61_000, deviceId);
    assert.equal(altOnSamePhone.used, 5);
    assert.equal(altOnSamePhone.remaining, 0);

    // 7. Sign into the same Google account on a second phone -> still 0/5!
    const primaryOnOtherPhone = await readCommercialAccess(db, primaryUid, googlePrimary, baseAt + 10 * 61_000, otherDeviceId);
    assert.equal(primaryOnOtherPhone.used, 5);
    assert.equal(primaryOnOtherPhone.remaining, 0);
  } finally {
    const tickets = await db.collection('_accountMergeTickets').where('sourcePrincipalId', '==', deviceId).get();
    await Promise.all([
      ...tickets.docs.map((doc) => doc.ref.delete()),
      deleteIfPresent(db.collection('_accountLifecycle').doc(reinstalledGuestUid)),
      deleteIfPresent(db.collection('_commercialUsage').doc(`${deviceId}_${testDay}`)),
      deleteIfPresent(db.collection('_commercialUsage').doc(`${otherDeviceId}_${testDay}`)),
      deleteIfPresent(db.collection('_commercialUsage').doc(`${googlePrimary.principalId}_${testDay}`)),
      deleteIfPresent(db.collection('_commercialUsage').doc(`${googleAlt.principalId}_${testDay}`)),
      deleteIfPresent(db.collection('_commercialUsers').doc(deviceId)),
      deleteIfPresent(db.collection('_commercialUsers').doc(googlePrimary.principalId)),
      ...requests.slice(0, 5).map((req) => deleteIfPresent(db.collection('_commercialReservations').doc(`${googlePrimary.principalId}_${req}`))),
      deleteIfPresent(db.collection('_commercialReservations').doc(`${deviceId}_${requests[5]}`)),
    ]);
  }
});
