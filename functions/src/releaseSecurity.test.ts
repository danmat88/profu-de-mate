import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ENFORCE_APP_CHECK,
  enforceAppCheckForStage,
  RELEASE_SECURITY_STAGE,
} from './releaseSecurity.js';

test('keeps callable attestation disabled only during the pre-Play public stage', () => {
  assert.equal(RELEASE_SECURITY_STAGE, 'pre-play-public');
  assert.equal(ENFORCE_APP_CHECK, false);
});

test('reenables callable attestation for the Play release stage', () => {
  assert.equal(enforceAppCheckForStage('play'), true);
});
