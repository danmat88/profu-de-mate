import assert from 'node:assert/strict';
import test from 'node:test';
import { FEEDBACK_RATE_LIMIT, FEEDBACK_RATE_WINDOW_MS, nextFeedbackRateState } from './feedbackSubmission.js';

test('limits repeated feedback inside one bounded window', () => {
  const now = Date.parse('2040-01-01T10:00:00.000Z');
  assert.deepEqual(nextFeedbackRateState(undefined, now), {
    allowed: true,
    state: { windowStartedAt: now, submissions: 1 },
  });
  assert.equal(nextFeedbackRateState({ windowStartedAt: now, submissions: FEEDBACK_RATE_LIMIT - 1 }, now + 1).allowed, true);
  assert.equal(nextFeedbackRateState({ windowStartedAt: now, submissions: FEEDBACK_RATE_LIMIT }, now + 2).allowed, false);
});

test('starts a clean feedback window after expiry', () => {
  const now = Date.parse('2040-01-01T10:00:00.000Z');
  assert.deepEqual(nextFeedbackRateState({ windowStartedAt: now, submissions: 99 }, now + FEEDBACK_RATE_WINDOW_MS), {
    allowed: true,
    state: { windowStartedAt: now + FEEDBACK_RATE_WINDOW_MS, submissions: 1 },
  });
});
