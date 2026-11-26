import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  computeQuotaResetSnapshot,
  nextCountdownTickDelayMs,
  parseResetTimestamp,
} from '../../src/features/access/utils/quotaResetCountdown.ts';

test('parseResetTimestamp parses authoritative server ISO dates and fails closed on invalid input', () => {
  const target = Date.parse('2026-11-21T22:00:00.000Z');
  assert.equal(parseResetTimestamp('2026-11-21T22:00:00.000Z'), target);
  assert.equal(parseResetTimestamp(null), null);
  assert.equal(parseResetTimestamp(undefined), null);
  assert.equal(parseResetTimestamp('   '), null);
  assert.equal(parseResetTimestamp('not-a-date'), null);
});

test('computeQuotaResetSnapshot counts down cleanly to midnight without off-by-one or negative drift', () => {
  const midnight = Date.parse('2026-11-21T22:00:00.000Z');

  const threeHours = computeQuotaResetSnapshot(midnight, midnight - (3 * 3600 + 19 * 60 + 42) * 1000);
  assert.equal(threeHours.expired, false);
  assert.equal(threeHours.compactClock, '03:19:42');
  assert.equal(threeHours.shortLabel, '3h 19m');
  assert.equal(threeHours.accessibleDuration, '3 ore și 19 minute');
  assert.ok(threeHours.dayProgress > 0.8 && threeHours.dayProgress < 0.9);

  const oneHourFiveMin = computeQuotaResetSnapshot(midnight, midnight - (3600 + 5 * 60) * 1000);
  assert.equal(oneHourFiveMin.compactClock, '01:05:00');
  assert.equal(oneHourFiveMin.accessibleDuration, '1 oră și 5 minute');

  // Ceiling semantics keep 00:00:01 visible through the final millisecond.
  assert.equal(computeQuotaResetSnapshot(midnight, midnight - 1_001).compactClock, '00:00:02');
  assert.equal(computeQuotaResetSnapshot(midnight, midnight - 1_000).compactClock, '00:00:01');
  assert.equal(computeQuotaResetSnapshot(midnight, midnight - 1).compactClock, '00:00:01');
  assert.equal(computeQuotaResetSnapshot(midnight, midnight - 1).expired, false);
  assert.equal(computeQuotaResetSnapshot(midnight, midnight - 1).accessibleDuration, 'mai puțin de un minut');

  // At and past midnight: zeroed, marked expired, never negative.
  for (const after of [midnight, midnight + 60_000]) {
    const done = computeQuotaResetSnapshot(midnight, after);
    assert.equal(done.expired, true);
    assert.equal(done.remainingMs, 0);
    assert.equal(done.compactClock, '00:00:00');
    assert.equal(done.dayProgress, 1);
    assert.equal(done.accessibleDuration, 'chiar acum');
  }

  // Handles 25-hour DST fall-back days gracefully.
  const dstLongDay = computeQuotaResetSnapshot(midnight, midnight - (24 * 3600 + 30 * 60 + 5) * 1000);
  assert.equal(dstLongDay.compactClock, '24:30:05');
  assert.equal(dstLongDay.dayProgress, 0.04);
});

test('nextCountdownTickDelayMs aligns ticks to the exact wall-clock second flip', () => {
  const midnight = 100_000;
  assert.equal(nextCountdownTickDelayMs(midnight, 99_650), 370);
  assert.equal(nextCountdownTickDelayMs(midnight, 99_000), 1_020);
  assert.equal(nextCountdownTickDelayMs(midnight, 100_000), null);
  assert.equal(nextCountdownTickDelayMs(midnight, 100_500), null);
});

test('live quota reset timer is wired cleanly into Home, Paywall, Settings, and quota-blocked Processing screens', async () => {
  const [homeSurface, premiumSurface, settings, processing, mathProcessing, timerSource] = await Promise.all([
    readFile(new URL('../../src/features/home/components/HomeSurface.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/access/components/PremiumSurface.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/account/screens/SettingsScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/analysis/screens/ProcessingScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/analysis/screens/MathProcessingScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/access/components/QuotaResetTimer.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(homeSurface, /<HomeResetPillNote/);
  assert.match(premiumSurface, /<QuotaResetTimer[\s\S]*variant="canopy"/);
  assert.match(settings, /<QuotaResetTimer[\s\S]*variant="embedded"/);
  assert.match(processing, /<QuotaResetTimer[\s\S]*variant="hero"/);
  assert.match(mathProcessing, /<QuotaResetTimer[\s\S]*variant="hero"/);
  assert.match(timerSource, /tabular-nums/);
});
