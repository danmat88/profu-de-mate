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
    premiumEntitlementId: 'pro_access',
    deviceRecallMode: 'monitor',
  }), {
    welcomeLimit: 6,
    freeDailyLimit: 4,
    premiumDailyLimit: 60,
    premiumEntitlementId: 'pro_access',
    deviceRecallMode: 'monitor',
  });
  assert.deepEqual(normalizeCommercialConfig({ welcomeLimit: 0, premiumDailyLimit: 10_000 }), DEFAULT_COMMERCIAL_CONFIG);
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

test('builds guest, free and premium access from server-owned counters', () => {
  const guestPrincipal = `i_${'a'.repeat(64)}`;
  const googlePrincipal = `g_${'b'.repeat(64)}`;
  const common = {
    config: DEFAULT_COMMERCIAL_CONFIG,
    now: Date.parse('2026-08-25T10:00:00.000Z'),
    resetAt: '2026-08-25T21:00:00.000Z',
  };
  assert.deepEqual(buildCommercialAccess({ identity: 'anonymous', principalId: guestPrincipal, profile: { welcomeRequests: 3 }, ...common }), {
    identity: 'anonymous', tier: 'guest', limit: 5, used: 3, remaining: 2, canAnalyze: true,
    reason: 'available', resetAt: null, purchaseUserId: guestPrincipal, premium: { active: false, productId: null, expiresAt: null },
    allowances: { welcome: 5, freeDaily: 5, premiumDaily: 30 },
    deviceRecall: { shouldVerify: false, verified: false },
  });
  assert.equal(buildCommercialAccess({ identity: 'google', principalId: googlePrincipal, daily: { requests: 5 }, ...common }).reason, 'daily_exhausted');
  assert.equal(buildCommercialAccess({ identity: 'anonymous', principalId: guestPrincipal, profile: { welcomeRequests: 1, welcomeLocked: true }, ...common }).reason, 'account_required');
  const premium = buildCommercialAccess({
    identity: 'google',
    principalId: googlePrincipal,
    daily: { requests: 12 },
    entitlement: { active: true, productId: 'premium_monthly', expiresAt: Timestamp.fromMillis(common.now + 60_000) },
    ...common,
  });
  assert.equal(premium.tier, 'premium');
  assert.equal(premium.remaining, 18);
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
