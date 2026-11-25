import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeConsumedUsage, mergeExamRecords } from './accountMerge.js';

test('merges guest use into the linked daily allowance without granting a bonus', () => {
  const sourcePrincipalId = `i_${'1'.repeat(64)}`;
  const merged = mergeConsumedUsage(
    2,
    ['google-1', 'google-2'],
    [],
    ['guest-1', 'guest-2', 'guest-3'],
    0,
    [],
    sourcePrincipalId,
    5,
  );
  assert.equal(merged.used, 5);
  assert.deepEqual(merged.requestIds, ['google-1', 'google-2', 'guest-1', 'guest-2', 'guest-3']);
  assert.equal(merged.transferHashes.length, 3);
  merged.transferHashes.forEach((hash) => assert.match(hash, /^[a-f0-9]{64}$/));
  const deduplicated = mergeConsumedUsage(2, ['same', 'google-2'], [], ['same', 'guest-1'], 0, [], sourcePrincipalId, 5);
  assert.equal(deduplicated.used, 3);
  assert.deepEqual(deduplicated.requestIds, ['same', 'google-2', 'guest-1']);
  assert.equal(mergeConsumedUsage(29, [], [], ['guest-1', 'guest-2'], 0, [], sourcePrincipalId, 30).used, 30);
});

test('merges a privacy-minimized same-day guest count without resetting or double charging it', () => {
  const sourcePrincipalId = `i_${'2'.repeat(64)}`;
  const first = mergeConsumedUsage(0, [], [], [], 2, [], sourcePrincipalId, 5);
  assert.equal(first.used, 2);
  assert.equal(first.transferHashes.length, 2);
  const repeated = mergeConsumedUsage(
    first.used,
    first.requestIds,
    first.transferHashes,
    [],
    2,
    [],
    sourcePrincipalId,
    5,
  );
  assert.equal(repeated.used, 2);
  assert.deepEqual(repeated.transferHashes, first.transferHashes);
  assert.equal(mergeConsumedUsage(1, ['google-1'], [], ['guest-new'], 2, [], sourcePrincipalId, 5).used, 4);
});

test('one-way transfer hashes deduplicate previously merged guest requests exactly', () => {
  const sourcePrincipalId = `i_${'3'.repeat(64)}`;
  const first = mergeConsumedUsage(0, [], [], ['guest-1', 'guest-2'], 0, [], sourcePrincipalId, 5);
  const reconnected = mergeConsumedUsage(
    first.used,
    first.requestIds,
    first.transferHashes,
    [],
    2,
    first.transferHashes,
    sourcePrincipalId,
    5,
  );
  assert.equal(reconnected.used, 2);
  assert.deepEqual(reconnected.requestIds, ['guest-1', 'guest-2']);
});

test('merges exam simulation records across guest and Google accounts without duplicates and caps at 24', () => {
  const base = {
    id: 'exam-1',
    variantId: 'bac-m1-1',
    examId: 'bac_m1' as const,
    scope: 'full' as const,
    completedAt: '2026-11-24T10:00:00.000Z',
    awardedPoints: 92,
    maxPoints: 100,
    grade: 9.2,
    elapsedSeconds: 5100,
    subjectPoints: { s1: 30, s2: 27, s3: 25 },
  };
  const guestNewer = {
    ...base,
    id: 'exam-guest',
    completedAt: '2026-11-25T08:30:00.000Z',
    awardedPoints: 88,
    grade: 8.8,
  };
  const merged = mergeExamRecords(
    [base, { id: 'bad', examId: 'unknown', awardedPoints: 500 }],
    [base, guestNewer],
  );
  assert.deepEqual(merged.map((item) => item.id), ['exam-guest', 'exam-1']);
  assert.equal(merged[1].grade, 9.2);

  const many = Array.from({ length: 30 }, (_, index) => ({
    ...base,
    id: `exam-many-${index}`,
    completedAt: `2026-11-20T00:00:${String(index).padStart(2, '0')}.000Z`,
  }));
  const capped = mergeExamRecords([guestNewer], many);
  assert.equal(capped.length, 24);
  assert.equal(capped[0].id, 'exam-guest');
});
