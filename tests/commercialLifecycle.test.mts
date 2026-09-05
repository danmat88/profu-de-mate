import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const firebaseSource = readFileSync(join(process.cwd(), 'src/services/firebase.ts'), 'utf8');
const commercialSource = readFileSync(join(process.cwd(), 'src/services/commercial.ts'), 'utf8');
const deletionSource = readFileSync(join(process.cwd(), 'src/services/dataManagement.ts'), 'utf8');
const contextSource = readFileSync(join(process.cwd(), 'src/context/CommercialContext.tsx'), 'utf8');
const backendSource = readFileSync(join(process.cwd(), 'functions/src/index.ts'), 'utf8');
const identitySource = readFileSync(join(process.cwd(), 'functions/src/commercialIdentity.ts'), 'utf8');

test('validates a restored Firebase session once and replaces only a terminal identity', () => {
  assert.match(firebaseSource, /const current = auth\.currentUser;/);
  assert.match(firebaseSource, /if \(current\) return current;/);
  assert.match(firebaseSource, /verifyServerAuthSession\(initializedUser\)/);
  assert.match(firebaseSource, /getIdToken\(user, true\)/);
  assert.match(firebaseSource, /isTerminalAuthSessionError\(error\)/);
  assert.match(firebaseSource, /authVerification\?\.sessionKey === sessionKey\) authVerification = null/);
  assert.match(firebaseSource, /replaceTerminalFirebaseSession\(sessionKey\)/);
  assert.match(firebaseSource, /signInAnonymously\(auth\)/);
  assert.match(firebaseSource, /await getIdToken\(active, true\);\s*return active;/);
  assert.match(commercialSource, /recoverFirebaseSessionAfterCallableFailure\(error, requestedSessionKey\)/);
  assert.match(commercialSource, /if \(replacement\) return requestCommercialAccess\(false\)/);
});

test('logout rotates only Firebase auth while commercial guest identity stays installation-bound', () => {
  const disconnect = commercialSource.match(/export async function disconnectGoogleAccount[\s\S]*?\n}/)?.[0] ?? '';
  assert.doesNotMatch(disconnect, /prepareAccountLogout|prepareLogout/);
  assert.match(disconnect, /signOut\(getAuth\(app\)\)/);
  assert.match(disconnect, /return null;/);
  assert.doesNotMatch(disconnect, /getCommercialAccess\(\)/);
  assert.match(disconnect, /resetPurchasesForSignedOutUser\(\)/);
  assert.match(identitySource, /installationPrincipalId\(installationToken/);
  assert.match(identitySource, /return \{ identity: 'anonymous', principalId: installationPrincipalId/);
  assert.doesNotMatch(disconnect, /deleteMyData|deleteUser|deleteAllUserData/);
});

test('the context owns the single commercial refresh after account transitions', () => {
  const connect = commercialSource.match(/export async function connectWithGoogle[\s\S]*?\n}/)?.[0] ?? '';
  const disconnect = commercialSource.match(/export async function disconnectGoogleAccount[\s\S]*?\n}/)?.[0] ?? '';
  assert.doesNotMatch(connect, /getCommercialAccess\(\)/);
  assert.doesNotMatch(disconnect, /getCommercialAccess\(\)/);
  assert.match(contextSource, /accountDeletionInFlight/);
  assert.match(contextSource, /if \(accountDeletionInFlight\.current\) return accountDeletionInFlight\.current/);
});

test('unfinished Google merges survive cancellation, account switches and app restarts', () => {
  assert.match(commercialSource, /commercial\.pending-google-merges\.v2/);
  assert.match(commercialSource, /MAX_PENDING_MERGES = 5/);
  assert.match(commercialSource, /targetUserId: user\.uid/);
  assert.match(commercialSource, /merge\.targetUserId === user\.uid/);
  assert.match(commercialSource, /writePendingMerges\(remaining\)/);
  assert.doesNotMatch(commercialSource, /isCancelledResponse\(response\)[\s\S]{0,120}clearPending/);
});

test('reauthenticates before remote deletion and clears local state only after server confirmation', () => {
  const reauthenticateAt = deletionSource.indexOf('confirmGoogleIdentityForDeletion');
  const remoteDeleteAt = deletionSource.indexOf('await deleteData({ installationToken, pendingMergeTickets })');
  const clearLocalAt = deletionSource.indexOf('clearLocalPreferences();');
  assert.ok(reauthenticateAt >= 0 && reauthenticateAt < remoteDeleteAt);
  assert.ok(remoteDeleteAt < clearLocalAt);
  assert.match(deletionSource, /resetPurchasesForSignedOutUser\(\)/);
  assert.doesNotMatch(deletionSource, /getCommercialAccess\(\)/);
  assert.match(deletionSource, /pendingGoogleMergeTickets\(user\.uid\)/);
  assert.match(deletionSource, /removePendingGoogleMergesForUser\(user\.uid\)/);
  assert.match(backendSource, /_feedbackRateLimits'\)\.doc\(userId\)\.delete\(\)/);
  assert.match(backendSource, /minimizeInstallationProfileForDeletion\(db, installationPrincipal\)/);
  assert.match(contextSource, /const operation = deleteAllUserData\(\)[\s\S]*?clearAccessForIdentityChange\(\);[\s\S]*?void refresh\(\);/);
});

test('exports account deletion even while RevenueCat remains feature-gated', () => {
  assert.match(backendSource, /export const deleteMyData = onCall\(/);
  assert.doesNotMatch(backendSource, /export const deleteMyData = revenueCatSecrets \? onCall/);
});

test('server keeps old logout clients compatible without locking guest access', () => {
  assert.match(backendSource, /export const prepareAccountLogout = onCall\(/);
  assert.match(backendSource, /await bindInstallationToAccount\(/);
  assert.doesNotMatch(backendSource, /welcomeLocked: true/);
  const accessHandler = backendSource.match(/export const getCommercialAccess[\s\S]*?\n}\);/)?.[0] ?? '';
  assert.match(accessHandler, /principal\.identity === 'google'/);
  assert.match(accessHandler, /bindInstallationToAccount/);
});
