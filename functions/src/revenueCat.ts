import { createHmac, timingSafeEqual } from 'node:crypto';
import { FieldValue, type Firestore, Timestamp } from 'firebase-admin/firestore';

const REVENUECAT_API_BASE = 'https://api.revenuecat.com/v1';
const REVENUECAT_TIMEOUT_MS = 12_000;
const ENTITLEMENT_RETENTION_MS = 400 * 24 * 60 * 60 * 1000;

export type RevenueCatEntitlementSnapshot = {
  active: boolean;
  productId: string | null;
  expiresAtMs: number | null;
};

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function dateMillis(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseRevenueCatEntitlement(
  customerInfo: unknown,
  entitlementId: string,
  now = Date.now(),
): RevenueCatEntitlementSnapshot {
  const root = objectValue(customerInfo);
  const subscriber = objectValue(root?.subscriber);
  const entitlements = objectValue(subscriber?.entitlements);
  const entitlement = objectValue(entitlements?.[entitlementId]);
  if (!entitlement) return { active: false, productId: null, expiresAtMs: null };

  const rawExpiration = entitlement.expires_date;
  const expiration = dateMillis(rawExpiration);
  const graceExpiration = dateMillis(entitlement.grace_period_expires_date);
  const effectiveExpiration = expiration === null
    ? graceExpiration
    : graceExpiration === null
      ? expiration
      : Math.max(expiration, graceExpiration);
  const neverExpires = rawExpiration === null;

  return {
    active: neverExpires || (effectiveExpiration !== null && effectiveExpiration > now),
    productId: typeof entitlement.product_identifier === 'string' ? entitlement.product_identifier : null,
    expiresAtMs: neverExpires ? null : effectiveExpiration,
  };
}

export async function fetchRevenueCatCustomer(appUserId: string, secretApiKey: string): Promise<unknown | null> {
  const response = await fetch(`${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: {
      Authorization: `Bearer ${secretApiKey}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(REVENUECAT_TIMEOUT_MS),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`RevenueCat customer sync failed with status ${response.status}.`);
  }
  return response.json();
}

export async function deleteRevenueCatCustomer(appUserId: string, secretApiKey: string): Promise<void> {
  const response = await fetch(`${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${secretApiKey}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(REVENUECAT_TIMEOUT_MS),
  });
  if (response.status === 404) return;
  if (!response.ok) throw new Error(`RevenueCat customer deletion failed with status ${response.status}.`);
}

export async function syncRevenueCatEntitlement(args: {
  db: Firestore;
  appUserId: string;
  secretApiKey: string;
  entitlementId: string;
  source: 'callable' | 'webhook';
  now?: number;
}): Promise<RevenueCatEntitlementSnapshot> {
  const now = args.now ?? Date.now();
  const customerInfo = await fetchRevenueCatCustomer(args.appUserId, args.secretApiKey);
  const entitlement = parseRevenueCatEntitlement(customerInfo, args.entitlementId, now);
  await args.db.collection('_commercialEntitlements').doc(args.appUserId).set({
    principalId: args.appUserId,
    entitlementId: args.entitlementId,
    active: entitlement.active,
    productId: entitlement.productId,
    expiresAt: entitlement.expiresAtMs === null ? null : Timestamp.fromMillis(entitlement.expiresAtMs),
    source: args.source,
    syncedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    retentionExpiresAt: Timestamp.fromMillis(now + ENTITLEMENT_RETENTION_MS),
  }, { merge: true });
  return entitlement;
}

export function verifyRevenueCatSignature(
  rawBody: Buffer,
  signatureHeader: string,
  signingSecret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): boolean {
  const parts = Object.fromEntries(signatureHeader.split(',').map((part) => {
    const separator = part.indexOf('=');
    return separator > 0 ? [part.slice(0, separator).trim(), part.slice(separator + 1).trim()] : ['', ''];
  }));
  const timestamp = parts.t;
  const supplied = parts.v1;
  if (!/^\d{10,13}$/.test(timestamp ?? '') || !/^[a-f0-9]{64}$/i.test(supplied ?? '')) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds) return false;

  const expected = createHmac('sha256', signingSecret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), rawBody]))
    .digest();
  const suppliedBytes = Buffer.from(supplied, 'hex');
  return suppliedBytes.length === expected.length && timingSafeEqual(suppliedBytes, expected);
}

export function secureSecretEquals(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const actualBytes = Buffer.from(actual, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function validCommercialUserId(value: unknown): value is string {
  return typeof value === 'string' && /^[gi]_[a-f0-9]{64}$/.test(value);
}

export function parseRevenueCatWebhook(payload: unknown): { eventId: string; appUserIds: string[]; eventType: string } | null {
  const root = objectValue(payload);
  const event = objectValue(root?.event);
  if (!event || typeof event.id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(event.id)) return null;
  const candidates: unknown[] = [event.app_user_id, event.original_app_user_id];
  for (const key of ['aliases', 'transferred_from', 'transferred_to'] as const) {
    if (Array.isArray(event[key])) candidates.push(...event[key]);
  }
  const appUserIds = [...new Set(candidates.filter(validCommercialUserId))];
  if (appUserIds.length === 0) return null;
  return {
    eventId: event.id,
    appUserIds,
    eventType: typeof event.type === 'string' ? event.type.slice(0, 80) : 'UNKNOWN',
  };
}
