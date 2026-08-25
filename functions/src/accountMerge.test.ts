import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeConsumedUsage } from './accountMerge.js';

test('merges guest use into the linked daily allowance without granting a bonus', () => {
  assert.deepEqual(mergeConsumedUsage(2, ['google-1', 'google-2'], ['guest-1', 'guest-2', 'guest-3'], 5), {
    used: 5,
    requestIds: ['google-1', 'google-2', 'guest-1', 'guest-2', 'guest-3'],
  });
  assert.deepEqual(mergeConsumedUsage(2, ['same', 'google-2'], ['same', 'guest-1'], 5), {
    used: 3,
    requestIds: ['same', 'google-2', 'guest-1'],
  });
  assert.equal(mergeConsumedUsage(29, [], ['guest-1', 'guest-2'], 30).used, 30);
});
