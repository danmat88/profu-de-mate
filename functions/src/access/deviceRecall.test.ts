import assert from 'node:assert/strict';
import test from 'node:test';
import { parseIntegrityVerdict, welcomeClaimHash } from './deviceRecall.js';

test('binds the welcome claim to the Firebase uid and request', () => {
  assert.equal(welcomeClaimHash('uid-a', 'request-a'), welcomeClaimHash('uid-a', 'request-a'));
  assert.notEqual(welcomeClaimHash('uid-a', 'request-a'), welcomeClaimHash('uid-b', 'request-a'));
  assert.match(welcomeClaimHash('uid-a', 'request-a'), /^[a-f0-9]{64}$/);
});

test('accepts only a fresh, licensed and recognized Play verdict', () => {
  const now = Date.parse('2026-08-25T10:00:00.000Z');
  const requestHash = welcomeClaimHash('uid-a', 'request-a');
  const response = {
    tokenPayloadExternal: {
      requestDetails: {
        requestPackageName: 'ro.profudemate.app',
        requestHash,
        timestampMillis: String(now - 1_000),
      },
      appIntegrity: { appRecognitionVerdict: 'PLAY_RECOGNIZED' },
      accountDetails: { appLicensingVerdict: 'LICENSED' },
      deviceIntegrity: {
        deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'],
        deviceRecall: { values: { bitFirst: true }, writeDates: { yyyymmFirst: 202608 } },
      },
    },
  };
  assert.deepEqual(parseIntegrityVerdict(response, requestHash, now), {
    valid: true,
    evaluated: true,
    welcomeAlreadyClaimed: true,
  });
  assert.equal(parseIntegrityVerdict(response, 'wrong-hash', now).valid, false);
  assert.equal(parseIntegrityVerdict(response, requestHash, now + 121_000).valid, false);
});

test('distinguishes an unavailable device recall verdict from a fresh false bit', () => {
  const now = Date.parse('2026-08-25T10:00:00.000Z');
  const requestHash = welcomeClaimHash('uid-a', 'request-a');
  const base = {
    requestDetails: { requestPackageName: 'ro.profudemate.app', requestHash, timestampMillis: String(now) },
    appIntegrity: { appRecognitionVerdict: 'PLAY_RECOGNIZED' },
    accountDetails: { appLicensingVerdict: 'LICENSED' },
    deviceIntegrity: { deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'], deviceRecall: { values: {} } },
  };
  assert.equal(parseIntegrityVerdict({ tokenPayloadExternal: base }, requestHash, now).evaluated, false);
  const withFalse = {
    ...base,
    deviceIntegrity: { ...base.deviceIntegrity, deviceRecall: { values: { bitFirst: false } } },
  };
  assert.equal(parseIntegrityVerdict({ tokenPayloadExternal: withFalse }, requestHash, now).evaluated, true);
});
