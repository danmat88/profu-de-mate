import assert from 'node:assert/strict';
import test from 'node:test';
import { friendlyAnalysisError } from '../src/utils/analysisErrors.ts';

test('separates an offline device from a server timeout', () => {
  const offline = friendlyAnalysisError({ code: 'functions/unavailable' });
  const timeout = friendlyAnalysisError({ code: 'functions/deadline-exceeded' });

  assert.match(offline, /internet/i);
  assert.match(timeout, /durat prea mult/i);
  assert.notEqual(offline, timeout);
});

test('keeps security, quota and invalid-image recovery messages specific', () => {
  assert.match(friendlyAnalysisError({ code: 'app-check/not-ready' }), /verifica această instalare/i);
  assert.match(friendlyAnalysisError({ code: 'functions/resource-exhausted' }), /limita de analize/i);
  assert.match(friendlyAnalysisError({ code: 'functions/invalid-argument' }), /problema completă/i);
});

test('does not expose an unexpected provider error message to the user', () => {
  const message = friendlyAnalysisError(new Error('provider secret: raw upstream failure'));

  assert.doesNotMatch(message, /provider|secret|upstream/i);
  assert.match(message, /Nu am putut analiza fotografia/i);
});
