import { Platform } from 'react-native';

let preparation: Promise<void> | null = null;

function projectNumber(): string | null {
  const value = process.env.EXPO_PUBLIC_PLAY_INTEGRITY_PROJECT_NUMBER?.trim();
  return value && /^\d{6,20}$/.test(value) ? value : null;
}

export function preparePlayIntegrity(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  const cloudProjectNumber = projectNumber();
  if (!cloudProjectNumber) return Promise.resolve();
  if (!preparation) {
    preparation = import('@expo/app-integrity')
      .then((integrity) => integrity.prepareIntegrityTokenProviderAsync(cloudProjectNumber))
      .catch((error) => {
        preparation = null;
        throw error;
      });
  }
  return preparation;
}

export async function createWelcomeIntegrityProof(userId: string, requestId: string): Promise<{
  integrityToken: string;
  requestHash: string;
}> {
  if (Platform.OS !== 'android' || !projectNumber()) {
    throw new Error('Play Integrity nu este configurat pentru acest build.');
  }
  await preparePlayIntegrity();
  const crypto = await import('expo-crypto');
  const requestHash = await crypto.digestStringAsync(
    crypto.CryptoDigestAlgorithm.SHA256,
    `${userId}:${requestId}:welcome`,
    { encoding: crypto.CryptoEncoding.HEX },
  );
  const integrity = await import('@expo/app-integrity');
  const integrityToken = await integrity.requestIntegrityCheckAsync(requestHash);
  return { integrityToken, requestHash };
}
