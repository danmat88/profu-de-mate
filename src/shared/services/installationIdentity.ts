import * as Crypto from 'expo-crypto';

const INSTALLATION_TOKEN_KEY = 'commercial.installation-token.v1';
const INSTALLATION_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

let cachedToken: string | null = null;
let tokenPromise: Promise<string> | null = null;

async function secureStoreModule() {
  return import('expo-secure-store');
}

function newInstallationToken(): string {
  return `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replaceAll('-', '').toLocaleLowerCase('en-US');
}

export function getInstallationToken(): Promise<string> {
  if (cachedToken) return Promise.resolve(cachedToken);
  if (tokenPromise) return tokenPromise;
  tokenPromise = (async () => {
    const storage = await secureStoreModule();
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
