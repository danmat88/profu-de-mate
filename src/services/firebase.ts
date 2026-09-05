import { getApp } from '@react-native-firebase/app';
import {
  getToken as getAppCheckToken,
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
  type AppCheck,
} from '@react-native-firebase/app-check';
import { getAuth, getIdToken, signInAnonymously, signOut, type User } from '@react-native-firebase/auth';
import { authSessionIdentityKey } from './authSessionIdentity';
import { isTerminalAuthSessionError, isUnauthenticatedCallableError } from './firebaseAuthRecovery';

let initialization: Promise<User> | null = null;
let appCheckVerification: Promise<void> | null = null;
let authVerification: { sessionKey: string; promise: Promise<User> } | null = null;
let appCheckInstance: AppCheck | null = null;

type AppCheckMode = 'debug' | 'none' | 'playIntegrity';

function configuredAppCheckMode(): AppCheckMode {
  if (__DEV__) return 'debug';
  const configured = process.env.EXPO_PUBLIC_APP_CHECK_PROVIDER?.trim();
  if (configured === 'debug' || configured === 'none' || configured === 'playIntegrity') return configured;
  // A release with a missing or mistyped setting fails closed instead of
  // silently disabling production attestation.
  return 'playIntegrity';
}

async function currentOrAnonymousUser(): Promise<User> {
  const auth = getAuth(getApp());
  const current = auth.currentUser;
  // Native Firebase persists the session and refreshes ID tokens when a
  // protected operation needs one. A forced token refresh here would turn
  // every cold start into an unnecessary network dependency.
  if (current) return current;
  return (await signInAnonymously(auth)).user;
}

async function replaceTerminalFirebaseSession(expectedSessionKey: string): Promise<User> {
  const auth = getAuth(getApp());
  const active = auth.currentUser;
  const activeSessionKey = authSessionIdentityKey(active);

  // Another account transition won the race. Never sign that newer identity
  // out while recovering an older request.
  if (active && activeSessionKey !== expectedSessionKey) return active;

  if (active) await signOut(auth).catch(() => undefined);
  const replacement = (await signInAnonymously(auth)).user;
  initialization = Promise.resolve(replacement);
  authVerification = null;
  return replacement;
}

async function verifyServerAuthSession(user: User): Promise<User> {
  const sessionKey = authSessionIdentityKey(user);
  if (!sessionKey) return currentOrAnonymousUser();
  if (authVerification?.sessionKey === sessionKey) return authVerification.promise;

  const promise = getIdToken(user, true)
    .then(() => {
      const active = getAuth(getApp()).currentUser;
      return authSessionIdentityKey(active) === sessionKey ? user : currentOrAnonymousUser();
    })
    .catch((error: unknown) => {
      if (!isTerminalAuthSessionError(error)) {
        // A temporary network / Play Services failure must not poison the
        // process-wide verification cache. The next protected request gets a
        // clean retry without forcing the user to restart the app.
        if (authVerification?.sessionKey === sessionKey) authVerification = null;
        throw error;
      }
      return replaceTerminalFirebaseSession(sessionKey);
    });
  authVerification = { sessionKey, promise };
  return promise;
}

/**
 * Identifies the locally visible authentication state, including an anonymous
 * account that was linked in place and therefore kept the same Firebase UID.
 * It is local cache metadata, never a server-side credential.
 */
export const firebaseUserSessionKey = authSessionIdentityKey;

function isJwt(token: string): boolean {
  return token.split('.').length === 3;
}

async function ensureAppCheckReady(appCheck: AppCheck): Promise<void> {
  const retryDelays = [0, 200, 600, 1_200];
  let lastError: unknown;

  for (const delay of retryDelays) {
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      const { token } = await getAppCheckToken(appCheck, true);
      if (isJwt(token)) return;
      lastError = new Error('Firebase App Check returned a malformed token.');
    } catch (error) {
      lastError = error;
    }
  }

  const error = new Error('Firebase App Check could not establish a verified session.', { cause: lastError });
  Object.assign(error, { code: 'app-check/not-ready' });
  throw error;
}

export function initializeFirebaseServices(): Promise<User> {
  if (initialization) return initialization;

  initialization = (async () => {
    const app = getApp();
    const appCheckMode = configuredAppCheckMode();
    if (appCheckMode !== 'none' && !appCheckInstance) {
      const useDebugAppCheck = appCheckMode === 'debug';
      const sharedDebugToken = process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN?.trim();
      if (!__DEV__ && useDebugAppCheck && !sharedDebugToken) {
        throw new Error('Firebase App Check debug token is missing from the EAS build environment.');
      }
      const provider = new ReactNativeFirebaseAppCheckProvider();
      provider.configure({
        android: {
          provider: useDebugAppCheck ? 'debug' : 'playIntegrity',
          ...(useDebugAppCheck && sharedDebugToken ? { debugToken: sharedDebugToken } : {}),
        },
        apple: {
          provider: useDebugAppCheck ? 'debug' : 'appAttestWithDeviceCheckFallback',
          ...(useDebugAppCheck && sharedDebugToken ? { debugToken: sharedDebugToken } : {}),
        },
      });
      appCheckInstance = initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
    }

    return currentOrAnonymousUser();
  })().catch((error) => {
    initialization = null;
    throw error;
  });

  return initialization;
}

export async function initializeVerifiedFirebaseServices(): Promise<User> {
  const initializedUser = await initializeFirebaseServices();
  const user = await verifyServerAuthSession(initializedUser);
  if (configuredAppCheckMode() === 'none') return user;
  if (!appCheckInstance) throw new Error('Firebase App Check nu a fost inițializat.');
  if (!appCheckVerification) {
    appCheckVerification = ensureAppCheckReady(appCheckInstance).catch((error) => {
      appCheckVerification = null;
      throw error;
    });
  }
  await appCheckVerification;
  return user;
}

/**
 * A deleted/disabled account can keep an already-issued ID token briefly. If
 * a callable rejects it, force-refresh the token and rotate only when Firebase
 * confirms that the identity is terminal. Returns the refreshed or replacement
 * user when the caller should safely retry once.
 */
export async function recoverFirebaseSessionAfterCallableFailure(
  error: unknown,
  expectedSessionKey: string,
): Promise<User | null> {
  if (!isUnauthenticatedCallableError(error)) return null;
  const active = getAuth(getApp()).currentUser;
  if (!active || authSessionIdentityKey(active) !== expectedSessionKey) return null;

  try {
    await getIdToken(active, true);
    return active;
  } catch (refreshError) {
    if (!isTerminalAuthSessionError(refreshError)) return null;
    return replaceTerminalFirebaseSession(expectedSessionKey);
  }
}

export function resetFirebaseInitialization() {
  initialization = null;
  appCheckVerification = null;
  authVerification = null;
}
