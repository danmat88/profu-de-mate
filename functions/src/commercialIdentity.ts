import { createHmac } from 'node:crypto';

export type CommercialIdentity = 'anonymous' | 'google';

export type CommercialPrincipal = {
  identity: CommercialIdentity;
  principalId: string;
};

const GOOGLE_PROVIDER = 'google.com';
const MINIMUM_HMAC_KEY_BYTES = 32;
const MAXIMUM_RECENT_AUTH_FUTURE_SKEW_SECONDS = 60;
const INSTALLATION_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

function firebaseIdentities(token: unknown): Record<string, unknown> | null {
  if (!token || typeof token !== 'object') return null;
  const firebase = (token as { firebase?: unknown }).firebase;
  if (!firebase || typeof firebase !== 'object') return null;
  const identities = (firebase as { identities?: unknown }).identities;
  return identities && typeof identities === 'object'
    ? identities as Record<string, unknown>
    : null;
}

export function googleProviderSubjectFromAuthToken(token: unknown): string | null {
  const googleIdentities = firebaseIdentities(token)?.[GOOGLE_PROVIDER];
  if (!Array.isArray(googleIdentities)) return null;
  const subject = googleIdentities.find((value): value is string => (
    typeof value === 'string' && value.length >= 1 && value.length <= 256
  ));
  return subject ?? null;
}

export function identityFromAuthToken(token: unknown): CommercialIdentity {
  return googleProviderSubjectFromAuthToken(token) ? 'google' : 'anonymous';
}

export function hasRecentGoogleAuthentication(
  token: unknown,
  now = Date.now(),
  maximumAgeSeconds = 5 * 60,
): boolean {
  if (!googleProviderSubjectFromAuthToken(token) || !token || typeof token !== 'object') return false;
  const authTime = (token as { auth_time?: unknown }).auth_time;
  if (typeof authTime !== 'number' || !Number.isInteger(authTime)) return false;
  const nowSeconds = Math.floor(now / 1_000);
  return authTime <= nowSeconds + MAXIMUM_RECENT_AUTH_FUTURE_SKEW_SECONDS
    && nowSeconds - authTime <= maximumAgeSeconds;
}

export function validInstallationToken(value: unknown): value is string {
  return typeof value === 'string' && INSTALLATION_TOKEN_PATTERN.test(value);
}

export function installationPrincipalId(installationToken: string, identityHmacKey: string): string {
  if (!validInstallationToken(installationToken)) {
    throw new Error('Installation token is invalid.');
  }
  if (Buffer.byteLength(identityHmacKey, 'utf8') < MINIMUM_HMAC_KEY_BYTES) {
    throw new Error('COMMERCIAL_IDENTITY_HMAC_KEY must contain at least 32 bytes.');
  }
  const digest = createHmac('sha256', identityHmacKey)
    .update(`installation:${installationToken}`, 'utf8')
    .digest('hex');
  return `i_${digest}`;
}

export function commercialPrincipalFromAuthToken(
  token: unknown,
  _userId: string,
  identityHmacKey: string,
  installationToken?: unknown,
): CommercialPrincipal {
  const googleSubject = googleProviderSubjectFromAuthToken(token);
  if (!googleSubject) {
    if (!validInstallationToken(installationToken)) {
      throw new Error('A stable installation identity is required for anonymous access.');
    }
    return { identity: 'anonymous', principalId: installationPrincipalId(installationToken, identityHmacKey) };
  }
  if (Buffer.byteLength(identityHmacKey, 'utf8') < MINIMUM_HMAC_KEY_BYTES) {
    throw new Error('COMMERCIAL_IDENTITY_HMAC_KEY must contain at least 32 bytes.');
  }
  const digest = createHmac('sha256', identityHmacKey)
    .update(`${GOOGLE_PROVIDER}:${googleSubject}`, 'utf8')
    .digest('hex');
  return { identity: 'google', principalId: `g_${digest}` };
}

export function isCommercialPrincipalId(value: unknown): value is string {
  return typeof value === 'string' && /^[gi]_[a-f0-9]{64}$/.test(value);
}
