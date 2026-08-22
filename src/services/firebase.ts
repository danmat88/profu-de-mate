import { getApp } from '@react-native-firebase/app';
import {
  getToken as getAppCheckToken,
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
  type AppCheck,
} from '@react-native-firebase/app-check';
import { getAuth, signInAnonymously, type User } from '@react-native-firebase/auth';

let initialization: Promise<User> | null = null;

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
    const provider = new ReactNativeFirebaseAppCheckProvider();
    provider.configure({
      android: { provider: __DEV__ ? 'debug' : 'playIntegrity' },
      apple: { provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback' },
    });
    const appCheck = initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
    await ensureAppCheckReady(appCheck);

    const auth = getAuth(app);
    if (auth.currentUser) return auth.currentUser;
    const credential = await signInAnonymously(auth);
    return credential.user;
  })().catch((error) => {
    initialization = null;
    throw error;
  });

  return initialization;
}
