import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ENFORCE_APP_CHECK,
  defaultDeviceRecallForStage,
  enforceAppCheckForStage,
  releaseSecurityStageFromEnvironment,
  RELEASE_SECURITY_STAGE,
} from './releaseSecurity.js';

test('defaults callable attestation to enforced when deployment config is absent', () => {
  assert.equal(releaseSecurityStageFromEnvironment(undefined), 'play');
  assert.equal(enforceAppCheckForStage(releaseSecurityStageFromEnvironment(undefined)), true);
  assert.equal(ENFORCE_APP_CHECK, enforceAppCheckForStage(RELEASE_SECURITY_STAGE));
});

test('reenables callable attestation for the Play release stage', () => {
  assert.equal(enforceAppCheckForStage('play'), true);
  assert.equal(defaultDeviceRecallForStage('play'), 'enforce');
  assert.equal(defaultDeviceRecallForStage('pre-play-public'), 'off');
});

test('accepts only explicit release security stages', () => {
  assert.equal(releaseSecurityStageFromEnvironment(undefined), 'play');
  assert.equal(enforceAppCheckForStage(releaseSecurityStageFromEnvironment('pre-play-public')), false);
  assert.equal(releaseSecurityStageFromEnvironment('play'), 'play');
  assert.throws(() => releaseSecurityStageFromEnvironment('debug'));
});
