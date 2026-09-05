import {
  type DocumentData,
  type DocumentReference,
  FieldValue,
  type Firestore,
  Timestamp,
  type Transaction,
} from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  isCommercialPrincipalId,
  type CommercialIdentity,
  type CommercialPrincipal,
} from './commercialIdentity.js';

export { identityFromAuthToken } from './commercialIdentity.js';
export type { CommercialIdentity, CommercialPrincipal } from './commercialIdentity.js';

const COMMERCIAL_TIME_ZONE = 'Europe/Bucharest';
const BURST_LIMIT = 4;
const BURST_WINDOW_MS = 60_000;
const COUNTER_RETENTION_MS = 35 * 24 * 60 * 60 * 1000;
export const COMMERCIAL_PROFILE_RETENTION_MS = 400 * 24 * 60 * 60 * 1000;
const STALE_RESERVATION_RECOVERY_MS = 5 * 60 * 1000;
const CONFIG_CACHE_MS = 15_000;

export type CommercialTier = 'guest' | 'free' | 'premium';
export type CommercialBlockReason = 'available' | 'welcome_exhausted' | 'daily_exhausted';

export type CommercialConfig = {
  welcomeLimit: number;
  freeDailyLimit: number;
  premiumDailyLimit: number;
  premiumEntitlementId: string;
  deviceRecallMode: 'off' | 'monitor' | 'enforce';
};

export type CommercialAccess = {
  identity: CommercialIdentity;
  tier: CommercialTier;
  limit: number;
  used: number;
  remaining: number;
  canAnalyze: boolean;
  reason: CommercialBlockReason;
  resetAt: string | null;
  purchaseUserId: string;
  allowances: {
    welcome: number;
    freeDaily: number;
    premiumDaily: number;
  };
  premium: {
    active: boolean;
    productId: string | null;
    expiresAt: string | null;
  };
  deviceRecall: {
    shouldVerify: boolean;
    verified: boolean;
  };
};

export const DEFAULT_COMMERCIAL_CONFIG: CommercialConfig = {
  welcomeLimit: 5,
  freeDailyLimit: 5,
  premiumDailyLimit: 30,
  premiumEntitlementId: 'premium',
  deviceRecallMode: 'off',
};

type ReservationScope = 'welcome' | 'daily';
type ReservationData = {
  state?: unknown;
  scope?: unknown;
  day?: unknown;
  requestId?: unknown;
  principalId?: unknown;
  reservedAt?: unknown;
};

let cachedConfig: { value: CommercialConfig; expiresAt: number } | null = null;

function integerInRange(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

export function normalizeCommercialConfig(value: unknown): CommercialConfig {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    welcomeLimit: integerInRange(data.welcomeLimit, DEFAULT_COMMERCIAL_CONFIG.welcomeLimit, 1, 20),
    freeDailyLimit: integerInRange(data.freeDailyLimit, DEFAULT_COMMERCIAL_CONFIG.freeDailyLimit, 1, 20),
    premiumDailyLimit: integerInRange(data.premiumDailyLimit, DEFAULT_COMMERCIAL_CONFIG.premiumDailyLimit, 5, 200),
    premiumEntitlementId: typeof data.premiumEntitlementId === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(data.premiumEntitlementId)
      ? data.premiumEntitlementId
      : DEFAULT_COMMERCIAL_CONFIG.premiumEntitlementId,
    deviceRecallMode: data.deviceRecallMode === 'monitor' || data.deviceRecallMode === 'enforce'
      ? data.deviceRecallMode
      : 'off',
  };
}

export async function getCommercialConfig(db: Firestore, now = Date.now()): Promise<CommercialConfig> {
  if (cachedConfig && cachedConfig.expiresAt > now) return cachedConfig.value;
  try {
    const snapshot = await db.collection('_runtimeConfig').doc('commercial').get();
    const value = normalizeCommercialConfig(snapshot.data());
    cachedConfig = { value, expiresAt: now + CONFIG_CACHE_MS };
    return value;
  } catch {
    return DEFAULT_COMMERCIAL_CONFIG;
  }
}

/**
 * Records which account last received data from this installation. The
 * installation's one-time allowance remains governed exclusively by its
 * existing `welcomeRequests` counter: connecting or disconnecting an account
 * must never consume unused problems and must never mint a new allowance.
 */
export async function bindInstallationToAccount(
  db: Firestore,
  installationPrincipalId: string,
  accountPrincipalId: string,
  accountUserId: string,
  now = Date.now(),
): Promise<void> {
  if (!isCommercialPrincipalId(installationPrincipalId) || !installationPrincipalId.startsWith('i_')
    || !isCommercialPrincipalId(accountPrincipalId) || !accountPrincipalId.startsWith('g_')) {
    throw new HttpsError('failed-precondition', 'Identitatea comercială nu este validă.');
  }
  const profileRef = db.collection('_commercialUsers').doc(installationPrincipalId);
  const current = await profileRef.get();
  if (current.data()?.linkedAccountPrincipalId === accountPrincipalId
    && current.data()?.linkedAccountUserId === accountUserId
    && current.data()?.welcomeLocked === undefined) return;
  await profileRef.set({
    principalId: installationPrincipalId,
    // Remove the obsolete lock written by older releases. The consumed counter
    // already prevents Firebase UID rotation from granting another allowance.
    welcomeLocked: FieldValue.delete(),
    linkedAccountPrincipalId: accountPrincipalId,
    linkedAccountUserId: accountUserId,
    linkedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(now + COMMERCIAL_PROFILE_RETENTION_MS),
  }, { merge: true });
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(timestamp: number, timeZone = COMMERCIAL_TIME_ZONE): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const values = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function localDateTimeToUtc(parts: ZonedParts, timeZone = COMMERCIAL_TIME_ZONE): number {
  const desiredAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let candidate = desiredAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedParts(candidate, timeZone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    candidate -= actualAsUtc - desiredAsUtc;
  }
  return candidate;
}

export function bucharestQuotaWindow(now = Date.now()): { day: string; resetAt: string } {
  const current = zonedParts(now);
  const nextCalendarDay = new Date(Date.UTC(current.year, current.month - 1, current.day + 1));
  const reset = localDateTimeToUtc({
    year: nextCalendarDay.getUTCFullYear(),
    month: nextCalendarDay.getUTCMonth() + 1,
    day: nextCalendarDay.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
  });
  return {
    day: `${String(current.year).padStart(4, '0')}-${String(current.month).padStart(2, '0')}-${String(current.day).padStart(2, '0')}`,
    resetAt: new Date(reset).toISOString(),
  };
}

function numeric(data: DocumentData | undefined, key: string): number {
  const value = data?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function stringArray(data: DocumentData | undefined, key: string): string[] {
  const value = data?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function timestampMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}

export function buildCommercialAccess(args: {
  identity: CommercialIdentity;
  principalId: string;
  profile?: DocumentData;
  daily?: DocumentData;
  entitlement?: DocumentData;
  config: CommercialConfig;
  now: number;
  resetAt: string;
}): CommercialAccess {
  const expiresAtMs = timestampMillis(args.entitlement?.expiresAt);
  const premiumActive = args.entitlement?.active === true && (expiresAtMs === null || expiresAtMs > args.now);
  const tier: CommercialTier = premiumActive ? 'premium' : args.identity === 'google' ? 'free' : 'guest';
  const limit = tier === 'premium'
    ? args.config.premiumDailyLimit
    : tier === 'free'
      ? args.config.freeDailyLimit
      : args.config.welcomeLimit;
  const used = tier === 'guest' ? numeric(args.profile, 'welcomeRequests') : numeric(args.daily, 'requests');
  const remaining = Math.max(0, limit - used);
  const deviceRecallVerified = args.profile?.deviceRecallClaimed === true;
  return {
    identity: args.identity,
    tier,
    limit,
    used,
    remaining,
    canAnalyze: remaining > 0,
    reason: remaining > 0 ? 'available' : tier === 'guest' ? 'welcome_exhausted' : 'daily_exhausted',
    resetAt: tier === 'guest' ? null : args.resetAt,
    purchaseUserId: args.principalId,
    allowances: {
      welcome: args.config.welcomeLimit,
      freeDaily: args.config.freeDailyLimit,
      premiumDaily: args.config.premiumDailyLimit,
    },
    premium: {
      active: premiumActive,
      productId: typeof args.entitlement?.productId === 'string' ? args.entitlement.productId : null,
      expiresAt: expiresAtMs === null ? null : new Date(expiresAtMs).toISOString(),
    },
    deviceRecall: {
      shouldVerify: tier === 'guest' && args.config.deviceRecallMode !== 'off' && !deviceRecallVerified,
      verified: deviceRecallVerified,
    },
  };
}

function refsFor(db: Firestore, _userId: string, principalId: string, requestId: string, day: string) {
  return {
    profile: db.collection('_commercialUsers').doc(principalId),
    daily: db.collection('_commercialUsage').doc(`${principalId}_${day}`),
    entitlement: db.collection('_commercialEntitlements').doc(principalId),
    reservation: db.collection('_commercialReservations').doc(`${principalId}_${requestId}`),
    global: db.collection('_commercialGlobal').doc(day),
  };
}

export async function readCommercialAccess(
  db: Firestore,
  userId: string,
  principal: CommercialPrincipal,
  now = Date.now(),
): Promise<CommercialAccess> {
  const config = await getCommercialConfig(db, now);
  const window = bucharestQuotaWindow(now);
  const refs = refsFor(db, userId, principal.principalId, '_status', window.day);
  const [profile, daily, entitlement] = await Promise.all([
    refs.profile.get(),
    refs.daily.get(),
    refs.entitlement.get(),
  ]);
  return buildCommercialAccess({
    identity: principal.identity,
    principalId: principal.principalId,
    profile: profile.data(),
    daily: daily.data(),
    entitlement: entitlement.data(),
    config,
    now,
    resetAt: window.resetAt,
  });
}

function quotaError(access: CommercialAccess): HttpsError {
  if (access.reason === 'welcome_exhausted') {
    return new HttpsError(
      'resource-exhausted',
      `Ai folosit cele ${access.limit} probleme de bun-venit. Conectează-te cu Google pentru probleme gratuite în fiecare zi.`,
      { commercialReason: access.reason, access },
    );
  }
  return new HttpsError(
    'resource-exhausted',
    access.tier === 'premium'
      ? 'Ai ajuns la limita de siguranță pentru astăzi. Problemele disponibile revin la miezul nopții.'
      : `Ai folosit cele ${access.limit} probleme gratuite de astăzi. Revin la miezul nopții.`,
    { commercialReason: access.reason, access },
  );
}

export async function reserveAnalysisQuota(
  db: Firestore,
  userId: string,
  requestId: string,
  principal: CommercialPrincipal,
  now = Date.now(),
  globalDailyLimit = 300,
): Promise<CommercialAccess> {
  const config = await getCommercialConfig(db, now);
  const window = bucharestQuotaWindow(now);
  if (!isCommercialPrincipalId(principal.principalId)) {
    throw new HttpsError('internal', 'Identitatea comercială nu este validă.');
  }
  const refs = refsFor(db, userId, principal.principalId, requestId, window.day);

  return db.runTransaction(async (transaction) => {
    const [profileSnapshot, dailySnapshot, entitlementSnapshot, reservationSnapshot, globalSnapshot] = await Promise.all([
      transaction.get(refs.profile),
      transaction.get(refs.daily),
      transaction.get(refs.entitlement),
      transaction.get(refs.reservation),
      transaction.get(refs.global),
    ]);
    const profile = profileSnapshot.data();
    const daily = dailySnapshot.data();
    const entitlement = entitlementSnapshot.data();
    const reservation = reservationSnapshot.data() as ReservationData | undefined;
    const access = buildCommercialAccess({
      identity: principal.identity,
      principalId: principal.principalId,
      profile,
      daily,
      entitlement,
      config,
      now,
      resetAt: window.resetAt,
    });

    if (reservation?.state === 'reserved') {
      // A legitimate retry takes ownership of the existing quota lease. This
      // prevents stale-reservation recovery from refunding a retry that is
      // currently talking to the provider.
      transaction.update(refs.reservation, {
        reservedAt: Timestamp.fromMillis(now),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return access;
    }
    if (reservation?.state === 'consumed') return access;

    const windowStartedAt = timestampMillis(profile?.burstWindowStartedAt) ?? 0;
    const inCurrentBurstWindow = now - windowStartedAt < BURST_WINDOW_MS;
    const burstRequests = inCurrentBurstWindow ? numeric(profile, 'burstRequests') : 0;
    if (inCurrentBurstWindow && burstRequests >= BURST_LIMIT) {
      throw new HttpsError(
        'resource-exhausted',
        'Ai trimis prea multe fotografii prea repede. Așteaptă un minut și încearcă din nou.',
        { commercialReason: 'burst_limited' },
      );
    }
    if (!access.canAnalyze) throw quotaError(access);
    if (access.tier === 'guest' && config.deviceRecallMode === 'enforce' && !access.deviceRecall.verified) {
      throw new HttpsError(
        'failed-precondition',
        'Verificarea sigură a problemelor de bun-venit nu este gata. Încearcă din nou sau conectează-te cu Google.',
        { commercialReason: 'device_verification_required', access },
      );
    }

    const globalRequests = numeric(globalSnapshot.data(), 'requests');
    if (globalRequests >= globalDailyLimit) {
      throw new HttpsError(
        'resource-exhausted',
        'Profu’ a ajuns la limita totală de lucru pentru astăzi. Încearcă din nou mâine.',
        { commercialReason: 'service_capacity' },
      );
    }

    const scope: ReservationScope = access.tier === 'guest' ? 'welcome' : 'daily';
    const expiresAt = Timestamp.fromMillis(now + COUNTER_RETENTION_MS);
    const profileWrite: DocumentData = {
      userId,
      principalId: principal.principalId,
      burstRequests: burstRequests + 1,
      burstWindowStartedAt: Timestamp.fromMillis(inCurrentBurstWindow ? windowStartedAt : now),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(now + COMMERCIAL_PROFILE_RETENTION_MS),
    };

    if (scope === 'welcome') {
      const requestIds = stringArray(profile, 'welcomeRequestIds');
      const continuesCurrentDay = profile?.welcomeTodayDay === window.day;
      const todayRequestIds = continuesCurrentDay
        ? stringArray(profile, 'welcomeTodayRequestIds')
        : [];
      profileWrite.welcomeRequests = access.used + 1;
      profileWrite.welcomeRequestIds = [...requestIds.filter((value) => value !== requestId), requestId].slice(-config.welcomeLimit);
      profileWrite.welcomeTodayDay = window.day;
      profileWrite.welcomeTodayRequestIds = [...todayRequestIds.filter((value) => value !== requestId), requestId].slice(-config.welcomeLimit);
      if (!continuesCurrentDay) {
        profileWrite.welcomeTodayRetainedRequests = FieldValue.delete();
        profileWrite.welcomeTodayTransferHashes = FieldValue.delete();
      }
    } else {
      const requestIds = stringArray(daily, 'requestIds');
      transaction.set(refs.daily, {
        principalId: principal.principalId,
        day: window.day,
        requests: access.used + 1,
        requestIds: [...requestIds.filter((value) => value !== requestId), requestId].slice(-config.premiumDailyLimit),
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt,
      }, { merge: true });
    }

    transaction.set(refs.profile, profileWrite, { merge: true });
    transaction.set(refs.global, {
      day: window.day,
      requests: globalRequests + 1,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt,
    }, { merge: true });
    transaction.set(refs.reservation, {
      userId,
      requestId,
      principalId: principal.principalId,
      day: window.day,
      scope,
      tier: access.tier,
      state: 'reserved',
      reservedAt: Timestamp.fromMillis(now),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt,
    }, { merge: true });

    return {
      ...access,
      used: access.used + 1,
      remaining: Math.max(0, access.remaining - 1),
      canAnalyze: access.remaining - 1 > 0,
      reason: access.remaining - 1 > 0 ? 'available' : access.tier === 'guest' ? 'welcome_exhausted' : 'daily_exhausted',
    };
  });
}

function counterReference(
  db: Firestore,
  reservation: ReservationData,
): { ref: DocumentReference; requestsKey: string; requestIdsKey: string } | null {
  if (reservation.scope === 'welcome') {
    if (!isCommercialPrincipalId(reservation.principalId)) return null;
    return {
      ref: db.collection('_commercialUsers').doc(reservation.principalId),
      requestsKey: 'welcomeRequests',
      requestIdsKey: 'welcomeRequestIds',
    };
  }
  if (reservation.scope === 'daily' && typeof reservation.day === 'string') {
    if (!isCommercialPrincipalId(reservation.principalId)) return null;
    return {
      ref: db.collection('_commercialUsage').doc(`${reservation.principalId}_${reservation.day}`),
      requestsKey: 'requests',
      requestIdsKey: 'requestIds',
    };
  }
  return null;
}

function applyCounterRefund(
  transaction: Transaction,
  counter: { ref: DocumentReference; requestsKey: string; requestIdsKey: string },
  data: DocumentData | undefined,
  requestId: string,
  reservation: ReservationData,
): boolean {
  const ids = stringArray(data, counter.requestIdsKey);
  if (!ids.includes(requestId)) return false;
  const update: DocumentData = {
    [counter.requestsKey]: Math.max(0, numeric(data, counter.requestsKey) - 1),
    [counter.requestIdsKey]: ids.filter((value) => value !== requestId),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (reservation.scope === 'welcome' && data?.welcomeTodayDay === reservation.day) {
    update.welcomeTodayRequestIds = stringArray(data, 'welcomeTodayRequestIds').filter((value) => value !== requestId);
  }
  transaction.set(counter.ref, update, { merge: true });
  return true;
}

export async function settleAnalysisQuota(
  db: Firestore,
  principalId: string,
  requestId: string,
  charge: boolean,
  addResultWrites: (transaction: Transaction) => void,
  onlyIfReservedBefore?: number,
): Promise<boolean> {
  const reservationRef = db.collection('_commercialReservations').doc(`${principalId}_${requestId}`);
  return db.runTransaction(async (transaction) => {
    const reservationSnapshot = await transaction.get(reservationRef);
    const reservation = reservationSnapshot.data() as ReservationData | undefined;
    if (!reservationSnapshot.exists || !reservation) {
      throw new HttpsError('failed-precondition', 'Rezervarea pentru această analiză lipsește. Încearcă din nou.');
    }

    if (charge) {
      if (reservation.state === 'refunded') {
        throw new HttpsError('failed-precondition', 'Rezervarea pentru această analiză a expirat. Încearcă din nou.');
      }
      if (reservation.state !== 'reserved' && reservation.state !== 'consumed') {
        throw new HttpsError('internal', 'Rezervarea comercială are o stare invalidă.');
      }
      if (reservation.state === 'reserved') {
        transaction.update(reservationRef, {
          state: 'consumed',
          settledAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      addResultWrites(transaction);
      return true;
    }

    if (reservation.state === 'reserved') {
      const reservedAt = timestampMillis(reservation.reservedAt);
      if (onlyIfReservedBefore !== undefined
        && (reservedAt === null || reservedAt > onlyIfReservedBefore)) {
        return false;
      }
      const counter = counterReference(db, reservation);
      if (!counter || typeof reservation.day !== 'string') {
        throw new HttpsError('internal', 'Rezervarea comercială nu este validă.');
      }
      const globalRef = db.collection('_commercialGlobal').doc(reservation.day);
      const [counterSnapshot, globalSnapshot] = await Promise.all([
        transaction.get(counter.ref),
        transaction.get(globalRef),
      ]);
      const refunded = applyCounterRefund(transaction, counter, counterSnapshot.data(), requestId, reservation);
      if (refunded && globalSnapshot.exists) {
        transaction.update(globalRef, {
          requests: Math.max(0, numeric(globalSnapshot.data(), 'requests') - 1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.update(reservationRef, {
        state: 'refunded',
        settledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      addResultWrites(transaction);
      return refunded;
    }
    return false;
  });
}

export async function refundAnalysisQuota(
  db: Firestore,
  principalId: string,
  requestId: string,
  onlyIfReservedBefore?: number,
): Promise<boolean> {
  return settleAnalysisQuota(db, principalId, requestId, false, () => undefined, onlyIfReservedBefore);
}

/**
 * A killed process or provider timeout can strand a reserved allowance slot.
 * Recover only leases older than the full callable lifetime, and use the same
 * transactional refund path so concurrent retries cannot return it twice.
 */
export async function reconcileStaleAnalysisReservations(
  db: Firestore,
  principalId: string,
  now = Date.now(),
): Promise<number> {
  if (!isCommercialPrincipalId(principalId)) return 0;
  const staleBeforeMs = now - STALE_RESERVATION_RECOVERY_MS;
  const staleBefore = Timestamp.fromMillis(staleBeforeMs);
  const snapshot = await db.collection('_commercialReservations')
    .where('principalId', '==', principalId)
    .where('state', '==', 'reserved')
    .where('reservedAt', '<=', staleBefore)
    .orderBy('reservedAt', 'asc')
    .limit(20)
    .get();
  const results = await Promise.all(snapshot.docs.map(async (document) => {
    const requestId = document.data().requestId;
    if (typeof requestId !== 'string') return false;
    return refundAnalysisQuota(db, principalId, requestId, staleBeforeMs);
  }));
  return results.filter(Boolean).length;
}
