import assert from 'node:assert/strict';
import test from 'node:test';
import { ProviderCircuitBreaker } from './providerCircuitBreaker.js';

test('keeps the provider circuit closed below the failure threshold', () => {
  const breaker = new ProviderCircuitBreaker(3, 1_000);
  breaker.recordFailure(100);
  breaker.recordFailure(200);
  assert.equal(breaker.canRequest(300), true);
});

test('opens after repeated failures and permits a probe after cooldown', () => {
  const breaker = new ProviderCircuitBreaker(3, 1_000);
  breaker.recordFailure(100);
  breaker.recordFailure(200);
  breaker.recordFailure(300);
  assert.equal(breaker.canRequest(1_299), false);
  assert.equal(breaker.canRequest(1_300), true);
  breaker.recordFailure(1_301);
  assert.equal(breaker.canRequest(1_400), false);
});

test('a successful provider response resets the circuit', () => {
  const breaker = new ProviderCircuitBreaker(2, 1_000);
  breaker.recordFailure(100);
  breaker.recordSuccess();
  breaker.recordFailure(200);
  assert.equal(breaker.canRequest(300), true);
});
