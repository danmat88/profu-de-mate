import { getApp } from '@react-native-firebase/app';
import {
  getToken as getAppCheckToken,
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
  type AppCheck,
} from '@react-native-firebase/app-check';
import { getAuth, getIdToken, signInAnonymously, signOut, type User } from '@react-native-firebase/auth';

let initialization: Promise<User> | null = null;
let verification: Promise<void> | null = null;
let appCheckInstance: AppCheck | null = null;

function terminalAuthSessionError(error: unknown): boolean {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  return code === 'auth/invalid-user-token'
    || code === 'auth/user-token-expired'
    || code === 'auth/user-disabled'
    || code === 'auth/user-not-found';
}

function offlineAuthRefreshError(error: unknown): boolean {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  return code === 'auth/network-request-failed';
}

async function currentOrAnonymousUser(): Promise<User> {
  const auth = getAuth(getApp());
  const current = auth.currentUser;
  if (current) {
    try {
      // Native Firebase persists this session across app restarts. Reading the
      // token from the server repairs immediately the case where the account
      // was deleted in Console or on another device. If the phone is offline,
      // a still-valid cached token keeps local startup usable.
      await getIdToken(current, true);
      return current;
    } catch (error) {
      if (terminalAuthSessionError(error)) {
        await signOut(auth).catch(() => undefined);
      } else if (offlineAuthRefreshError(error)) {
        await getIdToken(current);
        return current;
      } else {
        throw error;
      }
    }
  }
  return (await signInAnonymously(auth)).user;
}

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
    if (!appCheckInstance) {
      const useDebugAppCheck = __DEV__ || process.env.EXPO_PUBLIC_APP_CHECK_PROVIDER === 'debug';
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
  const user = await initializeFirebaseServices();
  if (!appCheckInstance) throw new Error('Firebase App Check nu a fost inițializat.');
  if (!verification) {
    verification = ensureAppCheckReady(appCheckInstance).catch((error) => {
      verification = null;
      throw error;
    });
  }
  await verification;
  return user;
}

export function resetFirebaseInitialization() {
  initialization = null;
  verification = null;
}
