import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDailyQuotaRefund, buildGlobalQuotaRefund } from './rateLimit.js';

test('refunds exactly one reserved daily request and removes its id', () => {
  assert.deepEqual(buildDailyQuotaRefund({
    requests: 3,
    requestIds: ['request-a', 'request-b', 'request-c'],
  }, 'request-b'), {
    requests: 2,
    requestIds: ['request-a', 'request-c'],
  });
});

test('does not refund a request that was never reserved or was already refunded', () => {
  assert.equal(buildDailyQuotaRefund({
    requests: 2,
    requestIds: ['request-a', 'request-c'],
  }, 'request-b'), null);
});

test('refunds the aggregate counter only when the user reservation was refunded', () => {
  assert.equal(buildGlobalQuotaRefund({ requests: 12 }, true), 11);
  assert.equal(buildGlobalQuotaRefund({ requests: 12 }, false), null);
  assert.equal(buildGlobalQuotaRefund({ requests: 0 }, true), 0);
});
