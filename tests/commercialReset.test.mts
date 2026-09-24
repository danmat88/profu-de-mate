import assert from 'node:assert/strict';
import test from 'node:test';
import type { CommercialAccess } from '../src/types.ts';
import {
  commercialAccessExpiry,
  createCommercialExpiryMonitor,
  isCommercialAccessExpired,
  shouldAutomaticallyRefreshCommercialAccess,
} from '../src/services/commercialRefreshPolicy.ts';

const midnight = Date.parse('2026-09-20T21:00:00.000Z');

function access(resetAt: number | null = midnight): CommercialAccess {
  return {
    identity: 'google', tier: 'free', limit: 5, used: 5, remaining: 0,
    canAnalyze: false, reason: 'daily_exhausted',
    resetAt: resetAt === null ? null : new Date(resetAt).toISOString(),
    purchaseUserId: `g_${'a'.repeat(64)}`,
    allowances: { welcome: 5, freeDaily: 5, premiumDaily: 30 },
    premium: { active: false, productId: null, expiresAt: null },
    deviceRecall: { shouldVerify: false, verified: false },
  };
}

function fakeClock(start: number) {
  let now = start;
  let sequence = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  return {
    now: () => now,
    setTimeout: (callback: () => void, delay: number) => {
      const id = ++sequence;
      timers.set(id, { at: now + delay, callback });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout: (id: ReturnType<typeof setTimeout>) => { timers.delete(id as unknown as number); },
    async advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].callback();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      }
      now = end;
    },
    timerCount: () => timers.size,
  };
}

test('midnight bypasses the one-minute foreground throttle without granting local quota', () => {
  const exhausted = access();
  assert.equal(isCommercialAccessExpired(exhausted, midnight - 1), false);
  assert.equal(isCommercialAccessExpired(exhausted, midnight), true);
  assert.equal(shouldAutomaticallyRefreshCommercialAccess({
    now: midnight, lastSuccessfulRefreshAt: midnight - 5_000,
    identityTransitionActive: false, access: exhausted,
  }), true);
  assert.equal(shouldAutomaticallyRefreshCommercialAccess({
    now: midnight, lastSuccessfulRefreshAt: midnight - 5_000,
    identityTransitionActive: true, access: exhausted,
  }), false);
  assert.equal(exhausted.remaining, 0);
});

test('an open screen refreshes exactly at the server boundary and displays only the server result', async () => {
  const clock = fakeClock(midnight - 90_000);
  let current: CommercialAccess | null = access();
  let calls = 0;
  let invalidations = 0;
  const monitor = createCommercialExpiryMonitor({
    getAccess: () => current,
    canRefresh: () => true,
    invalidateExpiredAccess: () => { invalidations++; current = null; },
    refresh: async () => {
      calls++;
      assert.equal(current, null, 'Yesterday must disappear before the request completes.');
      current = { ...access(midnight + 86_400_000), used: 2, remaining: 3, canAnalyze: true, reason: 'available' };
    },
  }, clock);
  monitor.reschedule();
  await clock.advance(89_999);
  assert.equal(calls, 0, 'Clock checks before midnight make no network calls.');
  await clock.advance(1);
  assert.equal(calls, 1);
  assert.equal(invalidations, 1);
  assert.equal(current!.remaining, 3, 'Another device may already have spent part of the new day.');
  await clock.advance(120_000);
  assert.equal(calls, 1);
  monitor.dispose();
  assert.equal(clock.timerCount(), 0);
});

test('offline midnight retries are bounded and do not restore yesterday or invent a full allowance', async () => {
  const clock = fakeClock(midnight - 1);
  let current: CommercialAccess | null = access();
  let calls = 0;
  const monitor = createCommercialExpiryMonitor({
    getAccess: () => current, canRefresh: () => true,
    invalidateExpiredAccess: () => { current = null; },
    refresh: async () => { calls++; throw new Error('offline'); },
  }, clock);
  monitor.reschedule();
  await clock.advance(1);
  assert.equal(calls, 1);
  assert.equal(current, null);
  await clock.advance(59_999);
  assert.equal(calls, 1);
  await clock.advance(1);
  assert.equal(calls, 2);
  monitor.reset();
  await clock.advance(180_000);
  assert.equal(calls, 2, 'Changing account stops the previous account retry.');
  monitor.dispose();
});

test('background and account transitions invalidate stale display without network calls', async () => {
  const clock = fakeClock(midnight - 1);
  let current: CommercialAccess | null = access();
  let allowed = false;
  let calls = 0;
  const monitor = createCommercialExpiryMonitor({
    getAccess: () => current, canRefresh: () => allowed,
    invalidateExpiredAccess: () => { current = null; },
    refresh: async () => { calls++; current = access(midnight + 86_400_000); },
  }, clock);
  monitor.reschedule();
  await clock.advance(120_001);
  assert.equal(calls, 0);
  assert.equal(current, null);
  allowed = true;
  await clock.advance(60_000);
  assert.equal(calls, 1);
  monitor.dispose();
});

test('guest welcome never resets each day, while Premium expires at the earlier boundary', async () => {
  const guest = { ...access(null), identity: 'anonymous', tier: 'guest', reason: 'welcome_exhausted' } as CommercialAccess;
  const clock = fakeClock(midnight);
  let calls = 0;
  const monitor = createCommercialExpiryMonitor({
    getAccess: () => guest, canRefresh: () => true,
    invalidateExpiredAccess: () => { throw new Error('Welcome does not expire at midnight.'); },
    refresh: async () => { calls++; },
  }, clock);
  monitor.check();
  await clock.advance(2 * 86_400_000);
  assert.equal(calls, 0);
  assert.equal(clock.timerCount(), 0);
  const premium = {
    ...access(midnight + 86_400_000), tier: 'premium',
    premium: { active: true, productId: 'premium', expiresAt: new Date(midnight + 1_000).toISOString() },
  } as CommercialAccess;
  assert.equal(commercialAccessExpiry(premium), midnight + 1_000);
  assert.equal(isCommercialAccessExpired(premium, midnight + 1_000), true);
  monitor.dispose();
});

test('a slow refresh is not duplicated and an expired response is retried with backoff', async () => {
  const clock = fakeClock(midnight - 1);
  let current: CommercialAccess | null = access();
  let calls = 0;
  let finish: (() => void) | undefined;
  const monitor = createCommercialExpiryMonitor({
    getAccess: () => current, canRefresh: () => true,
    invalidateExpiredAccess: () => { current = null; },
    refresh: async () => {
      calls++;
      await new Promise<void>((resolve) => { finish = resolve; });
      current = access();
    },
  }, clock);
  monitor.reschedule();
  await clock.advance(120_001);
  assert.equal(calls, 1);
  finish!();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  monitor.reschedule();
  await clock.advance(60_000);
  assert.equal(calls, 2);
  monitor.dispose();
  finish!();
});
