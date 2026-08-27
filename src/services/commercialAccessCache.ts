import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import type { CommercialAccess } from '../types';
import { firebaseUserSessionKey } from './firebase';

const CACHE_KEY = 'commercial.access-snapshot.v2';
const LEGACY_CACHE_KEY = 'commercial.access-snapshot.v1';
const CACHE_VERSION = 2;
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

type CachedCommercialAccess = {
  version: typeof CACHE_VERSION;
  firebaseUserId: string;
  firebaseSessionKey: string;
  savedAt: number;
  access: CommercialAccess;
};

async function secureStoreModule() {
  return import('expo-secure-store');
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function validOptionalDate(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)));
}

function isCommercialAccess(value: unknown): value is CommercialAccess {
  if (!value || typeof value !== 'object') return false;
  const access = value as Partial<CommercialAccess>;
  const allowances = access.allowances as Partial<CommercialAccess['allowances']> | undefined;
  const premium = access.premium as Partial<CommercialAccess['premium']> | undefined;
  const deviceRecall = access.deviceRecall as Partial<CommercialAccess['deviceRecall']> | undefined;
  return (access.identity === 'anonymous' || access.identity === 'google')
    && (access.tier === 'guest' || access.tier === 'free' || access.tier === 'premium')
    && finiteNonNegative(access.limit)
    && finiteNonNegative(access.used)
    && finiteNonNegative(access.remaining)
    && typeof access.canAnalyze === 'boolean'
    && (access.reason === 'available'
      || access.reason === 'welcome_exhausted'
      || access.reason === 'daily_exhausted'
      || access.reason === 'account_required')
    && validOptionalDate(access.resetAt)
    && typeof access.purchaseUserId === 'string'
    && access.purchaseUserId.length >= 1
    && access.purchaseUserId.length <= 160
    && Boolean(allowances)
    && finiteNonNegative(allowances?.welcome)
    && finiteNonNegative(allowances?.freeDaily)
    && finiteNonNegative(allowances?.premiumDaily)
    && Boolean(premium)
    && typeof premium?.active === 'boolean'
    && (premium?.productId === null || typeof premium?.productId === 'string')
    && validOptionalDate(premium?.expiresAt)
    && Boolean(deviceRecall)
    && typeof deviceRecall?.shouldVerify === 'boolean'
    && typeof deviceRecall?.verified === 'boolean';
}

function isFreshForDisplay(entry: CachedCommercialAccess): boolean {
  const age = Date.now() - entry.savedAt;
  if (age < 0 || age > MAX_CACHE_AGE_MS) return false;
  if (entry.access.resetAt && Date.parse(entry.access.resetAt) <= Date.now()) return false;
  if (entry.access.premium.active
    && entry.access.premium.expiresAt
    && Date.parse(entry.access.premium.expiresAt) <= Date.now()) return false;
  return true;
}

export async function readCachedCommercialAccess(): Promise<CommercialAccess | null> {
  try {
    const currentUser = getAuth(getApp()).currentUser;
    const currentSessionKey = firebaseUserSessionKey(currentUser);
    if (!currentUser || !currentSessionKey) return null;
    const storage = await secureStoreModule();
    const raw = await storage.getItemAsync(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedCommercialAccess>;
    if (parsed.version !== CACHE_VERSION
      || parsed.firebaseUserId !== currentUser.uid
      || parsed.firebaseSessionKey !== currentSessionKey
      || !finiteNonNegative(parsed.savedAt)
      || !isCommercialAccess(parsed.access)) return null;
    const entry = parsed as CachedCommercialAccess;
    return isFreshForDisplay(entry) ? entry.access : null;
  } catch {
    return null;
  }
}

export async function writeCachedCommercialAccess(
  access: CommercialAccess,
  expectedSessionKey?: string,
): Promise<void> {
  try {
    const currentUser = getAuth(getApp()).currentUser;
    const currentSessionKey = firebaseUserSessionKey(currentUser);
    if (!currentUser
      || !currentSessionKey
      || (expectedSessionKey && expectedSessionKey !== currentSessionKey)
      || !isCommercialAccess(access)) return;
    const entry: CachedCommercialAccess = {
      version: CACHE_VERSION,
      firebaseUserId: currentUser.uid,
      firebaseSessionKey: currentSessionKey,
      savedAt: Date.now(),
      access,
    };
    const storage = await secureStoreModule();
    await storage.setItemAsync(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // The server remains authoritative; a cache failure only affects startup polish.
  }
}

export async function clearCachedCommercialAccess(): Promise<void> {
  try {
    const storage = await secureStoreModule();
    await Promise.all([
      storage.deleteItemAsync(CACHE_KEY),
      storage.deleteItemAsync(LEGACY_CACHE_KEY),
    ]);
  } catch {
    // A mismatched Firebase uid also prevents a stale snapshot from being shown.
  }
}
