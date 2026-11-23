import assert from 'node:assert/strict';
import test from 'node:test';
import {
  friendlyGoogleConnectError,
  isGoogleSignInCancelledError,
} from '../../src/features/access/services/googleAuthErrors.ts';
import { serviceLoader } from '../helpers/loadService.mts';

type MockUser = {
  uid: string;
  isAnonymous: boolean;
  providerData: { providerId: string }[];
};

function createGoogleConnectHarness(options: {
  collision?: boolean;
  lagAuthUpdateMs?: number;
  failPostAuthTokenRefresh?: boolean;
  throwCancelled?: boolean;
} = {}) {
  const anonUser: MockUser = { uid: 'anon-1', isAnonymous: true, providerData: [] };
  const linkedSameUidUser: MockUser = {
    uid: 'anon-1',
    isAnonymous: false,
    providerData: [{ providerId: 'google.com' }],
  };
  const existingGoogleUser: MockUser = {
    uid: 'google-99',
    isAnonymous: false,
    providerData: [{ providerId: 'google.com' }],
  };
  const authState: { currentUser: MockUser | null } = { currentUser: anonUser };
  const listeners = new Set<(user: MockUser | null) => void>();
  const disk = new Map<string, string>();
  const diagnosticContexts: string[] = [];
  let mergeCompletedCount = 0;

  const scheduleAuthCommit = (nextUser: MockUser) => {
    const commit = () => {
      authState.currentUser = nextUser;
      listeners.forEach((listener) => listener(nextUser));
    };
    if (options.lagAuthUpdateMs && options.lagAuthUpdateMs > 0) {
      setTimeout(commit, options.lagAuthUpdateMs);
    } else {
      commit();
    }
  };

  const load = serviceLoader({
    '@react-native-firebase/app': { getApp: () => ({}) },
    '@react-native-firebase/auth': {
      getAuth: () => authState,
      GoogleAuthProvider: { credential: (token: string) => ({ token }) },
      onIdTokenChanged: (_auth: unknown, cb: (user: MockUser | null) => void) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      linkWithCredential: async () => {
        if (options.collision) {
          throw Object.assign(new Error('in use'), { code: 'auth/credential-already-in-use' });
        }
        // Simulate Android native bridge lag: linkWithCredential resolves BEFORE
        // auth.currentUser flips from anonymous to identified.
        scheduleAuthCommit(linkedSameUidUser);
        return { user: linkedSameUidUser };
      },
      signInWithCredential: async () => {
        scheduleAuthCommit(existingGoogleUser);
        return { user: existingGoogleUser };
      },
      getIdToken: async () => {
        if (options.failPostAuthTokenRefresh) {
          throw Object.assign(new Error('network blip'), { code: 'auth/network-request-failed' });
        }
        return 'fresh-token';
      },
      reauthenticateWithCredential: async () => ({}),
      signOut: async () => { authState.currentUser = null; },
    },
    '@react-native-firebase/functions': {
      getFunctions: () => ({}),
      httpsCallable: (_f: unknown, name: string) => async () => {
        if (name === 'prepareAccountMerge') {
          return { data: { ticket: '12345678-1234-1234-1234-123456789abc' } };
        }
        if (name === 'completeAccountMergeWithGoogle') {
          mergeCompletedCount += 1;
          return { data: { merged: true, copiedLessons: 1 } };
        }
        return { data: {} };
      },
    },
    'expo-secure-store': {
      getItemAsync: async (key: string) => disk.get(key) ?? null,
      setItemAsync: async (key: string, value: string) => { disk.set(key, value); },
      deleteItemAsync: async (key: string) => { disk.delete(key); },
    },
    'react-native-nitro-google-signin': {
      GoogleOneTapSignIn: {
        configure() {},
        checkPlayServices: async () => {},
        signIn: async () => {
          if (options.throwCancelled) {
            throw Object.assign(new Error('User cancelled'), { code: 'SIGN_IN_CANCELLED' });
          }
          return { type: 'success', data: { idToken: 'google-id-token' } };
        },
        createAccount: async () => ({ type: 'cancelled', data: null }),
        presentExplicitSignIn: async () => ({ type: 'cancelled', data: null }),
      },
      isCancelledResponse: (r: { type?: string }) => r?.type === 'cancelled',
      isNoSavedCredentialFoundResponse: (r: { type?: string }) => r?.type === 'noSavedCredentialFound',
      isSuccessResponse: (r: { type?: string }) => r?.type === 'success',
    },
    'src/features/access/services/commercialAccessCache.ts': {
      clearCachedCommercialAccess: async () => {},
      writeCachedCommercialAccess: async () => {},
    },
    'src/shared/services/deviceIntegrity.ts': { createWelcomeIntegrityProof: async () => ({}) },
    'src/shared/services/firebase.ts': {
      firebaseUserSessionKey: (u: MockUser | null) => (u ? `${u.uid}|${u.isAnonymous ? 'anonymous' : 'identified'}|${u.providerData.map((p) => p.providerId).join(',')}` : null),
      initializeVerifiedFirebaseServices: async () => authState.currentUser,
      recoverFirebaseSessionAfterCallableFailure: async () => null,
      resetFirebaseInitialization() {},
    },
    'src/shared/services/installationIdentity.ts': { getInstallationToken: async () => 'install-token' },
    'src/features/lessons/services/lessons.ts': { clearFavoriteLessonsCache() {} },
    'src/features/access/services/purchases.ts': {
      initializePurchases: async () => true,
      resetPurchasesForSignedOutUser: async () => {},
    },
    'src/shared/services/diagnostics.ts': {
      recordDiagnosticError: (context: string) => { diagnosticContexts.push(context); },
    },
    'src/features/analysis/services/pendingAnalysis.ts': { discardPendingAnalysis() {} },
    'src/features/math/services/mathDraft.ts': { clearMathDrafts() {} },
  }, {
    process: { env: { EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'test-web-client-id.apps.googleusercontent.com' } },
  });

  const service = load('src/features/access/services/commercial.ts');
  return { service, authState, diagnosticContexts, getMergeCompletedCount: () => mergeCompletedCount };
}

test('connectWithGoogle waits for native auth.currentUser propagation after linkWithCredential without false failure', async () => {
  const { service, authState, getMergeCompletedCount } = createGoogleConnectHarness({
    collision: false,
    lagAuthUpdateMs: 25,
    failPostAuthTokenRefresh: true,
  });

  const user = await service.connectWithGoogle();
  assert.ok(user);
  assert.equal(user.uid, 'anon-1');
  assert.equal(user.isAnonymous, false);
  assert.equal(authState.currentUser?.isAnonymous, false);
  assert.equal(getMergeCompletedCount(), 1, 'merge completes cleanly once auth.currentUser catches up');
});

test('connectWithGoogle waits for native auth.currentUser propagation after signInWithCredential collision switch', async () => {
  const { service, authState, getMergeCompletedCount } = createGoogleConnectHarness({
    collision: true,
    lagAuthUpdateMs: 25,
  });

  const user = await service.connectWithGoogle();
  assert.ok(user);
  assert.equal(user.uid, 'google-99');
  assert.equal(authState.currentUser?.uid, 'google-99');
  assert.equal(getMergeCompletedCount(), 1);
});

test('connectWithGoogle treats thrown SIGN_IN_CANCELLED cleanly as user cancellation', async () => {
  const { service } = createGoogleConnectHarness({ throwCancelled: true });
  const result = await service.connectWithGoogle();
  assert.equal(result, null);
});

test('googleAuthErrors classifies cancellations and native Google Sign-In errors into accurate Romanian copy', () => {
  assert.equal(isGoogleSignInCancelledError({ code: 'SIGN_IN_CANCELLED' }), true);
  assert.equal(isGoogleSignInCancelledError({ code: '12501' }), true);
  assert.equal(isGoogleSignInCancelledError({ code: 'PLAY_SERVICES_NOT_AVAILABLE' }), false);

  assert.match(friendlyGoogleConnectError({ code: 'PLAY_SERVICES_NOT_AVAILABLE' }), /Google Play/);
  assert.match(friendlyGoogleConnectError({ code: 'ONE_TAP_START_FAILED' }), /cont Google disponibil/);
  assert.match(friendlyGoogleConnectError({ code: 'IN_PROGRESS' }), /deja în curs/);
  assert.match(friendlyGoogleConnectError({ code: 'auth/user-disabled' }), /dezactivat/);
  assert.match(friendlyGoogleConnectError({ code: 'auth/network-request-failed' }), /Verifică internetul/);
  assert.equal(
    friendlyGoogleConnectError(new Error('Mai multe conectări așteaptă recuperarea lecțiilor.')),
    'Mai multe conectări așteaptă recuperarea lecțiilor.',
  );
});
