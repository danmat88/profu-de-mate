import assert from 'node:assert/strict';
import test from 'node:test';
import {
  commercialPrincipalFromAuthToken,
  googleProviderSubjectFromAuthToken,
  hasRecentGoogleAuthentication,
  identityFromAuthToken,
  isCommercialPrincipalId,
} from './commercialIdentity.js';

const secret = '0123456789abcdef0123456789abcdef';

test('extracts the stable Google provider subject from the verified Firebase token', () => {
  const token = { firebase: { identities: { 'google.com': ['google-user-123'] } } };
  assert.equal(googleProviderSubjectFromAuthToken(token), 'google-user-123');
  assert.equal(identityFromAuthToken(token), 'google');
  assert.equal(identityFromAuthToken({ firebase: { identities: {} } }), 'anonymous');
});

test('derives a stable opaque principal without storing the Google subject', () => {
  const first = commercialPrincipalFromAuthToken(
    { firebase: { identities: { 'google.com': ['google-user-123'] } } },
    'firebase-uid-one',
    secret,
  );
  const recreatedAccount = commercialPrincipalFromAuthToken(
    { firebase: { identities: { 'google.com': ['google-user-123'] } } },
    'firebase-uid-two',
    secret,
  );
  assert.deepEqual(recreatedAccount, first);
  assert.equal(first.identity, 'google');
  assert.equal(first.principalId.includes('google-user-123'), false);
  assert.equal(isCommercialPrincipalId(first.principalId), true);
});

test('keeps an installation stable across anonymous UID rotation and isolates another installation', () => {
  const installation = 'a'.repeat(64);
  const first = commercialPrincipalFromAuthToken({}, 'anonymous-one', secret, installation);
  const rotatedUid = commercialPrincipalFromAuthToken({}, 'anonymous-two', secret, installation);
  const otherInstallation = commercialPrincipalFromAuthToken({}, 'anonymous-one', secret, 'b'.repeat(64));
  assert.equal(first.principalId, rotatedUid.principalId);
  assert.notEqual(first.principalId, otherInstallation.principalId);
  assert.equal(first.identity, 'anonymous');
  assert.match(first.principalId, /^i_[a-f0-9]{64}$/);
  assert.throws(() => commercialPrincipalFromAuthToken({}, 'anonymous-one', secret));
  assert.throws(() => commercialPrincipalFromAuthToken(
    { firebase: { identities: { 'google.com': ['google-user-123'] } } },
    'firebase-uid',
    'weak',
  ));
});

test('requires a recent verified Google authentication for destructive account deletion', () => {
  const now = Date.UTC(2026, 7, 25, 12, 0, 0);
  const googleToken = (authTime: number) => ({
    auth_time: authTime,
    firebase: { identities: { 'google.com': ['google-user-123'] } },
  });
  const nowSeconds = Math.floor(now / 1_000);
  assert.equal(hasRecentGoogleAuthentication(googleToken(nowSeconds - 120), now), true);
  assert.equal(hasRecentGoogleAuthentication(googleToken(nowSeconds - 301), now), false);
  assert.equal(hasRecentGoogleAuthentication(googleToken(nowSeconds + 61), now), false);
  assert.equal(hasRecentGoogleAuthentication({ auth_time: nowSeconds }, now), false);
});
