import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAIRuntimeConfig } from './runtimeConfig.js';

test('uses conservative AI runtime defaults', () => {
  assert.deepEqual(normalizeAIRuntimeConfig(undefined), { enabled: true, maxDailyRequests: 300 });
});

test('normalizes the private kill switch and aggregate quota', () => {
  assert.deepEqual(normalizeAIRuntimeConfig({ enabled: false, maxDailyRequests: 75 }), { enabled: false, maxDailyRequests: 75 });
  assert.equal(normalizeAIRuntimeConfig({ maxDailyRequests: 5000 }).maxDailyRequests, 1000);
  assert.equal(normalizeAIRuntimeConfig({ maxDailyRequests: 0 }).maxDailyRequests, 1);
  assert.equal(normalizeAIRuntimeConfig({ maxDailyRequests: 12.5 }).maxDailyRequests, 300);
});
