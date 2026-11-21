import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const INSTALLATION_TOKEN_KEY = 'commercial.installation-token.v1';
const INSTALLATION_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const KNOWN_INVALID_ANDROID_ID = '9774d56d682e549c';

let cachedToken: string | null = null;
let tokenPromise: Promise<string> | null = null;

function newInstallationToken(): string {
  return `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replaceAll('-', '').toLocaleLowerCase('en-US');
}

async function stableAndroidDeviceToken(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const raw = Application.getAndroidId()?.trim().toLocaleLowerCase('en-US') ?? '';
    if (raw.length < 8 || /^0+$/.test(raw) || raw === KNOWN_INVALID_ANDROID_ID) return null;
    const digest = (await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `profu-device-v1:${raw}`,
      { encoding: Crypto.CryptoEncoding.HEX },
    )).toLocaleLowerCase('en-US');
    return INSTALLATION_TOKEN_PATTERN.test(digest) ? digest : null;
  } catch {
    return null;
  }
}

/**
 * Returns a stable 64-hex installation/device token. On Android 8+, derives a
 * one-way SHA-256 digest of the app-signing-key-scoped ANDROID_ID (SSAID), so
 * the raw identifier never leaves the device while surviving reinstalls and
 * app-data clears. Falls back to SecureStore on other platforms or broken ROMs.
 */
export function getInstallationToken(): Promise<string> {
  if (cachedToken) return Promise.resolve(cachedToken);
  if (tokenPromise) return tokenPromise;
  tokenPromise = (async () => {
    const storage = SecureStore;
    const deviceToken = await stableAndroidDeviceToken();
    if (deviceToken) {
      cachedToken = deviceToken;
      void storage.setItemAsync(INSTALLATION_TOKEN_KEY, deviceToken).catch(() => undefined);
      return deviceToken;
    }
    const stored = await storage.getItemAsync(INSTALLATION_TOKEN_KEY);
    if (stored && INSTALLATION_TOKEN_PATTERN.test(stored)) {
      cachedToken = stored;
      return stored;
    }
    const created = newInstallationToken();
    if (!INSTALLATION_TOKEN_PATTERN.test(created)) throw new Error('Identitatea instalării nu a putut fi creată.');
    await storage.setItemAsync(INSTALLATION_TOKEN_KEY, created);
    cachedToken = created;
    return created;
  })().finally(() => { tokenPromise = null; });
  return tokenPromise;
}
