import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const firebaseSource = readFileSync(join(process.cwd(), 'src/services/firebase.ts'), 'utf8');
const commercialSource = readFileSync(join(process.cwd(), 'src/services/commercial.ts'), 'utf8');
const deletionSource = readFileSync(join(process.cwd(), 'src/services/dataManagement.ts'), 'utf8');
const backendSource = readFileSync(join(process.cwd(), 'functions/src/index.ts'), 'utf8');
const identitySource = readFileSync(join(process.cwd(), 'functions/src/commercialIdentity.ts'), 'utf8');

test('persists valid native Firebase sessions and replaces only terminally stale accounts', () => {
  assert.match(firebaseSource, /const current = auth\.currentUser;/);
  assert.match(firebaseSource, /await getIdToken\(current, true\);\s+return current;/s);
  assert.match(firebaseSource, /offlineAuthRefreshError\(error\)[\s\S]*?await getIdToken\(current\);/);
  assert.match(firebaseSource, /terminalAuthSessionError\(error\)/);
  assert.match(firebaseSource, /signInAnonymously\(auth\)/);
});

test('logout rotates only Firebase auth while commercial guest identity stays installation-bound', () => {
  const disconnect = commercialSource.match(/export async function disconnectGoogleAccount[\s\S]*?\n}/)?.[0] ?? '';
  const serverSealAt = disconnect.indexOf("'prepareAccountLogout'");
  const firebaseLogoutAt = disconnect.indexOf('signOut(getAuth(app))');
  assert.ok(serverSealAt >= 0 && serverSealAt < firebaseLogoutAt);
  assert.match(disconnect, /await prepareLogout\(\{ installationToken \}\)/);
  assert.match(disconnect, /signOut\(getAuth\(app\)\)/);
  assert.match(disconnect, /initializeVerifiedFirebaseServices\(\)/);
  assert.doesNotMatch(disconnect, /getCommercialAccess\(\)/);
  assert.doesNotMatch(disconnect, /resetPurchasesAfterDataDeletion|Purchases\.logOut/);
  assert.match(identitySource, /installationPrincipalId\(installationToken/);
  assert.match(identitySource, /return \{ identity: 'anonymous', principalId: installationPrincipalId/);
  assert.doesNotMatch(disconnect, /deleteMyData|deleteUser|deleteAllUserData/);
});

test('the context owns the single commercial refresh after account transitions', () => {
  const connect = commercialSource.match(/export async function connectWithGoogle[\s\S]*?\n}/)?.[0] ?? '';
  const disconnect = commercialSource.match(/export async function disconnectGoogleAccount[\s\S]*?\n}/)?.[0] ?? '';
  assert.doesNotMatch(connect, /getCommercialAccess\(\)/);
  assert.doesNotMatch(disconnect, /getCommercialAccess\(\)/);
});

test('reauthenticates before remote deletion and clears local state only after server confirmation', () => {
  const reauthenticateAt = deletionSource.indexOf('confirmGoogleIdentityForDeletion');
  const remoteDeleteAt = deletionSource.indexOf('await deleteData({ installationToken })');
  const clearLocalAt = deletionSource.indexOf('clearLocalPreferences();');
  assert.ok(reauthenticateAt >= 0 && reauthenticateAt < remoteDeleteAt);
  assert.ok(remoteDeleteAt < clearLocalAt);
  assert.match(deletionSource, /getCommercialAccess\(\)/);
  assert.doesNotMatch(deletionSource, /resetPurchasesAfterDataDeletion|initializePurchases\(guest\.uid\)/);
});

test('exports account deletion even while RevenueCat remains feature-gated', () => {
  assert.match(backendSource, /export const deleteMyData = onCall\(/);
  assert.doesNotMatch(backendSource, /export const deleteMyData = revenueCatSecrets \? onCall/);
});

test('server seals every Google-linked installation independently of Firebase UID rotation', () => {
  assert.match(backendSource, /export const prepareAccountLogout = onCall\(/);
  assert.match(backendSource, /await bindInstallationToAccount\(/);
  const accessHandler = backendSource.match(/export const getCommercialAccess[\s\S]*?\n}\);/)?.[0] ?? '';
  assert.match(accessHandler, /principal\.identity === 'google'/);
  assert.match(accessHandler, /bindInstallationToAccount/);
});
