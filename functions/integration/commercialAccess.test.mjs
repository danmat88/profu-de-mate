import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { completeAccountMerge, createAccountMergeTicket } from '../lib/accountMerge.js';
import {
  minimizeInstallationProfileForDeletion,
  removeOrRetainCommercialUsage,
  unlinkCommercialInstallations,
} from '../lib/dataDeletion.js';
import {
  bindInstallationToAccount,
  bucharestQuotaWindow,
  readCommercialAccess,
  reconcileStaleAnalysisReservations,
  reserveAnalysisQuota,
  settleAnalysisQuota,
} from '../lib/commercialAccess.js';

const projectId = 'profu-de-mate-danmat88';
const app = initializeApp({ projectId }, `commercial-integration-${Date.now()}`);
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

before(() => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Testul trebuie rulat prin emulatorul Firestore.');
});

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
    reserveAnalysisQuota(db, userId, requestId, guestPrincipal, now, 300),
    reserveAnalysisQuota(db, userId, requestId, guestPrincipal, now, 300),
  ]);

  const [profile, global, reservation] = await Promise.all([
    db.collection('_commercialUsers').doc(guestPrincipal.principalId).get(),
    db.collection('_commercialGlobal').doc(day).get(),
    db.collection('_commercialReservations').doc(`${guestPrincipal.principalId}_${requestId}`).get(),
  ]);
  assert.equal(profile.data()?.welcomeRequests, 1);
  assert.ok(profile.data()?.expiresAt?.toMillis() >= now + 399 * 24 * 60 * 60 * 1000);
  assert.equal(global.data()?.requests, 1);
  assert.equal(reservation.data()?.state, 'reserved');
});

test('un rezultat nefinalizat restituie atomic problema și plafonul global', async () => {
  const requestId = 'analysis-concurrent-0001';
  const resultRef = db.collection('_integrationResults').doc(userId);
  await settleAnalysisQuota(db, guestPrincipal.principalId, requestId, false, (transaction) => {
    transaction.set(resultRef, { status: 'not_math' });
  });

  const [profile, global, reservation, result] = await Promise.all([
    db.collection('_commercialUsers').doc(guestPrincipal.principalId).get(),
    db.collection('_commercialGlobal').doc(day).get(),
    db.collection('_commercialReservations').doc(`${guestPrincipal.principalId}_${requestId}`).get(),
    resultRef.get(),
  ]);
  assert.equal(profile.data()?.welcomeRequests, 0);
  assert.equal(global.data()?.requests, 0);
  assert.equal(reservation.data()?.state, 'refunded');
  assert.equal(result.data()?.status, 'not_math');
});

test('o rezervare abandonată restituie automat problema fără dublu refund', async () => {
  const requestId = 'analysis-stale-000001';
  await reserveAnalysisQuota(db, staleReservationUserId, requestId, staleReservationPrincipal, now, 300);
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
});

test('aceeași cerere poate fi reluată după refund și este taxată o singură dată la succes', async () => {
  const requestId = 'analysis-concurrent-0001';
  await reserveAnalysisQuota(db, userId, requestId, guestPrincipal, now + 1_000, 300);
  await settleAnalysisQuota(db, guestPrincipal.principalId, requestId, true, (transaction) => {
    transaction.set(db.collection('_integrationResults').doc(userId), { status: 'ready' });
  });
  await settleAnalysisQuota(db, guestPrincipal.principalId, requestId, true, () => undefined);

  const [profile, global, reservation] = await Promise.all([
    db.collection('_commercialUsers').doc(guestPrincipal.principalId).get(),
    db.collection('_commercialGlobal').doc(day).get(),
    db.collection('_commercialReservations').doc(`${guestPrincipal.principalId}_${requestId}`).get(),
  ]);
  assert.equal(profile.data()?.welcomeRequests, 1);
  assert.equal(global.data()?.requests, 1);
  assert.equal(reservation.data()?.state, 'consumed');
});

test('a șasea problemă de bun-venit este refuzată de tranzacția serverului', async () => {
  for (let index = 2; index <= 5; index += 1) {
    const requestId = `analysis-limit-000${index}`;
    await reserveAnalysisQuota(db, userId, requestId, guestPrincipal, now + index * 61_000, 300);
    await settleAnalysisQuota(db, guestPrincipal.principalId, requestId, true, () => undefined);
  }

  await assert.rejects(
    reserveAnalysisQuota(db, userId, 'analysis-limit-0006', guestPrincipal, now + 6 * 61_000, 300),
    (error) => error?.details?.commercialReason === 'welcome_exhausted',
  );
  const profile = await db.collection('_commercialUsers').doc(guestPrincipal.principalId).get();
  assert.equal(profile.data()?.welcomeRequests, 5);
});

test('legarea directă la Google mută utilizarea de bun-venit în cota zilei fără bonus', async () => {
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
  assert.equal(preservedProfile.data()?.welcomeRequests, 5);
  assert.equal(preservedProfile.data()?.welcomeLocked, undefined);
  assert.equal(preservedProfile.data()?.activeMergeTicket, undefined);
  assert.ok(preservedProfile.data()?.expiresAt?.toMillis() >= now + 399 * 24 * 60 * 60 * 1000);
});

test('logout-ul păstrează contorul instalării fără blocare artificială', async () => {
  const access = await readCommercialAccess(
    db,
    `rotated-anonymous-${Date.now()}`,
    guestPrincipal,
    now + 8 * 61_000,
  );
  assert.equal(access.identity, 'anonymous');
  assert.equal(access.reason, 'welcome_exhausted');
  assert.equal(access.remaining, 0);
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
  await reserveAnalysisQuota(db, deletedGoogleUserId, requestId, deletedGooglePrincipal, now + 10 * 61_000, 300);
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
