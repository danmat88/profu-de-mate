import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isTerminalAuthSessionError,
  isUnauthenticatedCallableError,
} from '../src/services/firebaseAuthRecovery.ts';

test('rotates only identities Firebase confirms are terminal', () => {
  for (const code of [
    'auth/id-token-revoked',
    'auth/invalid-user-token',
    'auth/session-cookie-revoked',
    'auth/user-disabled',
    'auth/user-not-found',
    'auth/user-token-expired',
  ]) {
    assert.equal(isTerminalAuthSessionError({ code }), true, code);
  }
});

test('keeps the active identity for offline, App Check and transient failures', () => {
  for (const code of [
    'auth/network-request-failed',
    'functions/internal',
    'functions/resource-exhausted',
    'app-check/not-ready',
  ]) {
    assert.equal(isTerminalAuthSessionError({ code }), false, code);
  }
  assert.equal(isTerminalAuthSessionError(null), false);
});

test('recognizes callable authentication rejection without conflating other failures', () => {
  assert.equal(isUnauthenticatedCallableError({ code: 'functions/unauthenticated' }), true);
  assert.equal(isUnauthenticatedCallableError({ code: 'auth/user-not-found' }), false);
  assert.equal(isUnauthenticatedCallableError(new Error('unauthenticated')), false);
});
