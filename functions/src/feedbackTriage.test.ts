import assert from 'node:assert/strict';
import test from 'node:test';
import { FEEDBACK_RETENTION_MS, feedbackSeverity, isFeedbackCategory } from './feedbackTriage.js';

test('prioritizes unsafe and wrong-answer reports', () => {
  assert.equal(feedbackSeverity('unsafe'), 'high');
  assert.equal(feedbackSeverity('wrong_answer'), 'medium');
  assert.equal(feedbackSeverity('unclear'), 'low');
  assert.equal(feedbackSeverity('other'), 'low');
});

test('keeps the triage category and retention contract bounded', () => {
  assert.equal(isFeedbackCategory('unsafe'), true);
  assert.equal(isFeedbackCategory('resolved'), false);
  assert.equal(FEEDBACK_RETENTION_MS, 180 * 24 * 60 * 60 * 1000);
});
