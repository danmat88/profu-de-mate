import { createHash } from 'node:crypto';
import { FieldValue, type Firestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { GoogleAuth } from 'google-auth-library';
import { COMMERCIAL_PROFILE_RETENTION_MS } from './commercialAccess.js';

const PACKAGE_NAME = 'ro.profudemate.app';
const PLAY_INTEGRITY_SCOPE = 'https://www.googleapis.com/auth/playintegrity';
const VERDICT_FRESHNESS_MS = 2 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;

type DeviceRecallMode = 'off' | 'monitor' | 'enforce';

type IntegrityVerdict = {
  valid: boolean;
  evaluated: boolean;
  welcomeAlreadyClaimed: boolean;
};

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function welcomeClaimHash(userId: string, requestId: string): string {
  return createHash('sha256').update(`${userId}:${requestId}:welcome`, 'utf8').digest('hex');
}

export function parseIntegrityVerdict(
  response: unknown,
  expectedHash: string,
  now = Date.now(),
): IntegrityVerdict {
  const root = objectValue(response);
  const payload = objectValue(root?.tokenPayloadExternal) ?? root;
  const request = objectValue(payload?.requestDetails);
  const app = objectValue(payload?.appIntegrity);
  const account = objectValue(payload?.accountDetails);
  const device = objectValue(payload?.deviceIntegrity);
  const recall = objectValue(device?.deviceRecall);
  const recallValues = objectValue(recall?.values);
  const timestamp = typeof request?.timestampMillis === 'string' || typeof request?.timestampMillis === 'number'
    ? Number(request.timestampMillis)
    : Number.NaN;
  const deviceLabels = Array.isArray(device?.deviceRecognitionVerdict)
    ? device.deviceRecognitionVerdict.filter((value): value is string => typeof value === 'string')
    : [];
  const evaluated = typeof recallValues?.bitFirst === 'boolean';
  const valid = request?.requestPackageName === PACKAGE_NAME
    && request?.requestHash === expectedHash
    && Number.isFinite(timestamp)
    && Math.abs(now - timestamp) <= VERDICT_FRESHNESS_MS
    && app?.appRecognitionVerdict === 'PLAY_RECOGNIZED'
    && account?.appLicensingVerdict === 'LICENSED'
    && deviceLabels.includes('MEETS_DEVICE_INTEGRITY');
  return {
    valid,
    evaluated,
    welcomeAlreadyClaimed: recallValues?.bitFirst === true,
  };
}

async function playIntegrityAccessToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: [PLAY_INTEGRITY_SCOPE] });
  const token = await auth.getAccessToken();
  if (!token) throw new Error('Play Integrity access token is unavailable.');
  return token;
}

async function decodeIntegrityToken(integrityToken: string, accessToken: string): Promise<unknown> {
  const response = await fetch(`https://playintegrity.googleapis.com/v1/${PACKAGE_NAME}:decodeIntegrityToken`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ integrity_token: integrityToken }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Play Integrity decode failed with status ${response.status}.`);
  return response.json();
}

async function writeWelcomeClaim(integrityToken: string, accessToken: string): Promise<void> {
  const response = await fetch(`https://playintegrity.googleapis.com/v1/${PACKAGE_NAME}/deviceRecall:write`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ integrityToken, newValues: { bitFirst: true } }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Play Integrity device recall write failed with status ${response.status}.`);
}

function verificationError(reason: 'unavailable' | 'invalid'): HttpsError {
  return new HttpsError(
    'failed-precondition',
    'Nu am putut verifica în siguranță problemele de bun-venit. Încearcă din nou sau conectează-te cu Google.',
    { commercialReason: reason === 'unavailable' ? 'device_verification_unavailable' : 'device_verification_failed' },
  );
}

export async function claimWelcomeDevice(args: {
  db: Firestore;
  userId: string;
  principalId: string;
  requestId: string;
  integrityToken: string;
  requestHash: string;
  mode: DeviceRecallMode;
  freeDailyLimit: number;
  now?: number;
}): Promise<{ verified: boolean }> {
  if (args.mode === 'off') return { verified: false };
  const expectedHash = welcomeClaimHash(args.userId, args.requestId);
  if (args.requestHash !== expectedHash) throw verificationError('invalid');

  let verdict: IntegrityVerdict;
  let accessToken: string;
  try {
    accessToken = await playIntegrityAccessToken();
    const response = await decodeIntegrityToken(args.integrityToken, accessToken);
    verdict = parseIntegrityVerdict(response, expectedHash, args.now);
  } catch (error) {
    if (args.mode === 'monitor') return { verified: false };
    throw verificationError('unavailable');
  }
  if (!verdict.valid || !verdict.evaluated) {
    if (args.mode === 'monitor') return { verified: false };
    throw verificationError(verdict.evaluated ? 'invalid' : 'unavailable');
  }

  const profileRef = args.db.collection('_commercialUsers').doc(args.principalId);
  const profile = await profileRef.get();
  if (verdict.welcomeAlreadyClaimed && profile.data()?.deviceRecallClaimed !== true) {
    throw new HttpsError(
      'resource-exhausted',
      `Problemele de bun-venit au fost deja folosite pe acest telefon. Conectează-te cu Google pentru ${args.freeDailyLimit} probleme gratuite în fiecare zi.`,
      { commercialReason: 'welcome_device_used' },
    );
  }

  if (!verdict.welcomeAlreadyClaimed) {
    try {
      await writeWelcomeClaim(args.integrityToken, accessToken);
    } catch {
      if (args.mode === 'enforce') throw verificationError('unavailable');
      return { verified: false };
    }
  }
  await profileRef.set({
    userId: args.userId,
    principalId: args.principalId,
    deviceRecallClaimed: true,
    deviceRecallVerifiedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis((args.now ?? Date.now()) + COMMERCIAL_PROFILE_RETENTION_MS),
  }, { merge: true });
  return { verified: true };
}
