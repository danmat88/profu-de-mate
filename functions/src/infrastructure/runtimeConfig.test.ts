import assert from 'node:assert/strict';
import test from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import { getAIAnalysisConfig, normalizeAIRuntimeConfig } from './runtimeConfig.js';

test('uses conservative AI runtime defaults', () => {
  assert.deepEqual(normalizeAIRuntimeConfig(undefined), { enabled: true, maxDailyRequests: 300 });
});

test('normalizes the private kill switch and aggregate quota', () => {
  assert.deepEqual(normalizeAIRuntimeConfig({ enabled: false, maxDailyRequests: 75 }), { enabled: false, maxDailyRequests: 75 });
  assert.equal(normalizeAIRuntimeConfig({ maxDailyRequests: 5000 }).maxDailyRequests, 1000);
  assert.equal(normalizeAIRuntimeConfig({ maxDailyRequests: 0 }).maxDailyRequests, 1);
  assert.equal(normalizeAIRuntimeConfig({ maxDailyRequests: 12.5 }).maxDailyRequests, 300);
});

test('a control-plane failure cannot enable AI or reuse an expired cached permission', async () => {
  let fail = false;
  let reads = 0;
  const db = {
    collection: () => ({ doc: () => ({ get: async () => {
      reads += 1;
      if (fail) throw new Error('unavailable');
      return { data: () => ({ enabled: true, maxDailyRequests: 42 }) };
    } }) }),
  } as unknown as Firestore;
  assert.deepEqual(await getAIAnalysisConfig(db, 1), { enabled: true, maxDailyRequests: 42 });
  fail = true;
  assert.equal((await getAIAnalysisConfig(db, 15_001)).enabled, false);
  fail = false;
  assert.deepEqual(await getAIAnalysisConfig(db, 15_002), { enabled: true, maxDailyRequests: 42 });
  assert.equal(reads, 3);
});
