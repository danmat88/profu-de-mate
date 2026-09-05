import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeConsumedUsage } from './accountMerge.js';

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
