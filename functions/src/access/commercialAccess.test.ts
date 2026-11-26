import assert from 'node:assert/strict';
import test from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import {
  bucharestQuotaWindow,
  buildCommercialAccess,
  DEFAULT_COMMERCIAL_CONFIG,
  identityFromAuthToken,
  normalizeCommercialConfig,
} from './commercialAccess.js';

test('normalizes commercial limits without accepting unsafe values', () => {
  assert.deepEqual(normalizeCommercialConfig({
    welcomeLimit: 6,
    freeDailyLimit: 4,
    premiumDailyLimit: 60,
    maxDailyLimit: 180,
    premiumEntitlementId: 'pro_access',
    maxEntitlementId: 'max_access',
    deviceRecallMode: 'monitor',
  }), {
    welcomeLimit: 6,
    freeDailyLimit: 4,
    premiumDailyLimit: 60,
    maxDailyLimit: 180,
    premiumEntitlementId: 'pro_access',
    maxEntitlementId: 'max_access',
    deviceRecallMode: 'monitor',
  });
  assert.deepEqual(normalizeCommercialConfig({ welcomeLimit: 0, premiumDailyLimit: 10_000, maxDailyLimit: 99_999 }), DEFAULT_COMMERCIAL_CONFIG);
});

test('uses Europe/Bucharest day boundaries in winter and summer', () => {
  assert.deepEqual(bucharestQuotaWindow(Date.parse('2026-01-15T21:59:59.000Z')), {
    day: '2026-01-15',
    resetAt: '2026-01-15T22:00:00.000Z',
  });
  assert.deepEqual(bucharestQuotaWindow(Date.parse('2026-01-15T22:00:00.000Z')), {
    day: '2026-01-16',
    resetAt: '2026-01-16T22:00:00.000Z',
  });
  assert.deepEqual(bucharestQuotaWindow(Date.parse('2026-07-15T20:59:59.000Z')), {
    day: '2026-07-15',
    resetAt: '2026-07-15T21:00:00.000Z',
  });
});

test('detects Google as a linked identity from the verified Firebase token', () => {
  assert.equal(identityFromAuthToken({ firebase: { identities: { 'google.com': ['google-user'] } } }), 'google');
  assert.equal(identityFromAuthToken({ firebase: { identities: {} } }), 'anonymous');
  assert.equal(identityFromAuthToken(undefined), 'anonymous');
});

test('Bucharest resets follow 23/25-hour DST days and calendar rollover, not a fixed 24-hour timer', () => {
  const cases = [
    ['2026-03-28T22:00:00.000Z', '2026-03-29', '2026-03-29T21:00:00.000Z', 23],
    ['2026-10-24T21:00:00.000Z', '2026-10-25', '2026-10-25T22:00:00.000Z', 25],
    ['2026-12-31T22:00:00.000Z', '2027-01-01', '2027-01-01T22:00:00.000Z', 24],
    ['2028-02-28T22:00:00.000Z', '2028-02-29', '2028-02-29T22:00:00.000Z', 24],
  ] as const;
  for (const [start, day, resetAt, hours] of cases) {
    const window = bucharestQuotaWindow(Date.parse(start));
    assert.deepEqual(window, { day, resetAt });
    assert.equal(Date.parse(window.resetAt) - Date.parse(start), hours * 60 * 60 * 1000);
    assert.equal(bucharestQuotaWindow(Date.parse(resetAt) - 1).day, day);
    assert.notEqual(bucharestQuotaWindow(Date.parse(resetAt)).day, day);
  }
});

test('builds unified daily guest, dual-bound free, and account-bound premium access', () => {
  const guestPrincipal = `i_${'a'.repeat(64)}`;
  const googlePrincipal = `g_${'b'.repeat(64)}`;
  const common = {
    config: DEFAULT_COMMERCIAL_CONFIG,
    now: Date.parse('2026-08-25T10:00:00.000Z'),
    resetAt: '2026-08-25T21:00:00.000Z',
  };
  assert.deepEqual(buildCommercialAccess({ identity: 'anonymous', principalId: guestPrincipal, daily: { requests: 3 }, ...common }), {
    identity: 'anonymous', tier: 'guest', limit: 5, used: 3, remaining: 2, canAnalyze: true,
    reason: 'available', resetAt: common.resetAt, purchaseUserId: guestPrincipal, premium: { active: false, tier: null, productId: null, expiresAt: null },
    allowances: { welcome: 5, freeDaily: 5, premiumDaily: 50, maxDaily: 150 },
    deviceRecall: { shouldVerify: false, verified: false },
  });
  assert.equal(buildCommercialAccess({ identity: 'google', principalId: googlePrincipal, daily: { requests: 5 }, ...common }).reason, 'daily_exhausted');

  // Dual-bound free tier: switching to a fresh Gmail on an already-used phone
  // cannot reset the phone's daily allowance.
  const altGoogleOnUsedDevice = buildCommercialAccess({
    identity: 'google',
    principalId: googlePrincipal,
    daily: { requests: 0 },
    deviceDaily: { requests: 4 },
    ...common,
  });
  assert.equal(altGoogleOnUsedDevice.used, 4);
  assert.equal(altGoogleOnUsedDevice.remaining, 1);

  // Dual-bound free tier: logging into an exhausted Google account on a new
  // phone still respects the account's usage.
  const usedGoogleOnNewDevice = buildCommercialAccess({
    identity: 'google',
    principalId: googlePrincipal,
    daily: { requests: 5 },
    deviceDaily: { requests: 0 },
    ...common,
  });
  assert.equal(usedGoogleOnNewDevice.used, 5);
  assert.equal(usedGoogleOnNewDevice.remaining, 0);
  assert.equal(usedGoogleOnNewDevice.reason, 'daily_exhausted');

  // Pro subscribers receive 50/day even if the device already spent 5 free problems.
  const pro = buildCommercialAccess({
    identity: 'google',
    principalId: googlePrincipal,
    daily: { requests: 12 },
    deviceDaily: { requests: 5 },
    entitlement: { active: true, planTier: 'pro', entitlementId: 'premium', productId: 'pro_monthly', expiresAt: Timestamp.fromMillis(common.now + 60_000) },
    ...common,
  });
  assert.equal(pro.tier, 'premium');
  assert.equal(pro.premium.tier, 'pro');
  assert.equal(pro.limit, 50);
  assert.equal(pro.used, 12);
  assert.equal(pro.remaining, 38);

  // Max subscribers receive 150/day and tier='max'.
  const max = buildCommercialAccess({
    identity: 'google',
    principalId: googlePrincipal,
    daily: { requests: 40 },
    deviceDaily: { requests: 5 },
    entitlement: { active: true, planTier: 'max', entitlementId: 'max', productId: 'max_monthly', expiresAt: Timestamp.fromMillis(common.now + 60_000) },
    ...common,
  });
  assert.equal(max.tier, 'premium');
  assert.equal(max.premium.tier, 'max');
  assert.equal(max.limit, 150);
  assert.equal(max.used, 40);
  assert.equal(max.remaining, 110);
});

test('does not trust an expired premium snapshot', () => {
  const now = Date.parse('2026-08-25T10:00:00.000Z');
  const access = buildCommercialAccess({
    identity: 'google',
    principalId: `g_${'b'.repeat(64)}`,
    entitlement: { active: true, expiresAt: Timestamp.fromMillis(now - 1) },
    config: DEFAULT_COMMERCIAL_CONFIG,
    now,
    resetAt: '2026-08-25T21:00:00.000Z',
  });
  assert.equal(access.tier, 'free');
  assert.equal(access.premium.active, false);
});
