import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { serviceLoader } from '../helpers/loadService.mts';

test('Android derives a deterministic SHA-256 device token that survives SecureStore wipes on reinstall', async () => {
  const androidId = 'dd96dec43fb81c97';
  const expected = createHash('sha256').update(`profu-device-v1:${androidId}`).digest('hex');

  const runInstall = async () => {
    const secureStore = new Map<string, string>();
    const load = serviceLoader({
      'react-native': { Platform: { OS: 'android' } },
      'expo-application': { getAndroidId: () => androidId },
      'expo-crypto': {
        CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
        CryptoEncoding: { HEX: 'hex' },
        digestStringAsync: async (_algo: string, data: string) => createHash('sha256').update(data).digest('hex'),
        randomUUID: () => '11111111-1111-1111-1111-111111111111',
      },
      'expo-secure-store': {
        getItemAsync: async (key: string) => secureStore.get(key) ?? null,
        setItemAsync: async (key: string, value: string) => { secureStore.set(key, value); },
      },
    });
    return load('src/shared/services/installationIdentity.ts').getInstallationToken();
  };

  const firstInstall = await runInstall();
  const afterReinstall = await runInstall();
  assert.equal(firstInstall, expected);
  assert.equal(afterReinstall, firstInstall);
  assert.doesNotMatch(firstInstall, new RegExp(androidId, 'i'));
});

test('falls back to SecureStore random token when Android ID is unavailable or invalid', async () => {
  const secureStore = new Map<string, string>();
  let uuidCalls = 0;
  const load = serviceLoader({
    'react-native': { Platform: { OS: 'android' } },
    'expo-application': { getAndroidId: () => '0000000000000000' },
    'expo-crypto': {
      CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
      CryptoEncoding: { HEX: 'hex' },
      digestStringAsync: async (_algo: string, data: string) => createHash('sha256').update(data).digest('hex'),
      randomUUID: () => {
        uuidCalls += 1;
        return uuidCalls === 1 ? 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' : '11111111-2222-3333-4444-555555555555';
      },
    },
    'expo-secure-store': {
      getItemAsync: async (key: string) => secureStore.get(key) ?? null,
      setItemAsync: async (key: string, value: string) => { secureStore.set(key, value); },
    },
  });

  const token = await load('src/shared/services/installationIdentity.ts').getInstallationToken();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(secureStore.get('commercial.installation-token.v1'), token);
});
