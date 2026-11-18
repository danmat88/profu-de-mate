import type { CommercialAccess } from '../../../shared/types';

export const AUTOMATIC_COMMERCIAL_REFRESH_INTERVAL_MS = 60_000;

type AutomaticRefreshState = {
  now: number;
  lastSuccessfulRefreshAt: number;
  identityTransitionActive: boolean;
  access?: CommercialAccess | null;
};

export function commercialAccessExpiry(access: CommercialAccess | null): number | null {
  if (!access) return null;
  const dates = [access.resetAt, access.premium.active ? access.premium.expiresAt : null]
    .filter((value): value is string => typeof value === 'string')
    .map(Date.parse)
    .filter(Number.isFinite);
  return dates.length ? Math.min(...dates) : null;
}

export function isCommercialAccessExpired(access: CommercialAccess | null, now: number): boolean {
  const expiry = commercialAccessExpiry(access);
  return expiry !== null && expiry <= now;
}

/**
 * Automatic lifecycle events use stale-while-revalidate. Explicit business
 * events (analysis completion, login, logout, deletion) bypass this policy and
 * call the authoritative refresh directly.
 */
export function shouldAutomaticallyRefreshCommercialAccess({
  now,
  lastSuccessfulRefreshAt,
  identityTransitionActive,
  access = null,
}: AutomaticRefreshState): boolean {
  if (identityTransitionActive) return false;
  if (isCommercialAccessExpired(access, now)) return true;
  if (lastSuccessfulRefreshAt <= 0) return true;
  const age = now - lastSuccessfulRefreshAt;
  return age < 0 || age >= AUTOMATIC_COMMERCIAL_REFRESH_INTERVAL_MS;
}

type ExpiryMonitorOptions = {
  getAccess: () => CommercialAccess | null;
  canRefresh: () => boolean;
  invalidateExpiredAccess: () => void;
  refresh: () => Promise<unknown>;
};

type ExpiryScheduler = {
  now: () => number;
  setTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => void;
};

/**
 * Watch the server's reset/entitlement boundary even if the same screen stays
 * open all night. Only the server can grant the new allowance. Local timers
 * invalidate yesterday's display and retry a failed refresh at most once per
 * minute; backgrounding and authentication transitions never start a call.
 */
export function createCommercialExpiryMonitor(
  options: ExpiryMonitorOptions,
  scheduler: ExpiryScheduler = { now: Date.now, setTimeout, clearTimeout },
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let refreshPending = false;
  let refreshing = false;
  let retryAt = 0;

  const clearTimer = () => {
    if (timer !== null) scheduler.clearTimeout(timer);
    timer = null;
  };

  const reschedule = () => {
    clearTimer();
    if (disposed) return;
    const now = scheduler.now();
    const access = options.getAccess();
    const expiry = commercialAccessExpiry(access);
    if (access && !isCommercialAccessExpired(access, now)) refreshPending = false;
    if (expiry === null && !refreshPending) return;
    // Check the clock at least once a minute so device clock corrections do
    // not leave a long, obsolete timeout. These checks make no network calls.
    const dueAt = expiry !== null && expiry > now ? expiry : Math.max(now, retryAt);
    const delay = Math.min(AUTOMATIC_COMMERCIAL_REFRESH_INTERVAL_MS, Math.max(1, dueAt - now));
    timer = scheduler.setTimeout(check, delay);
  };

  const check = () => {
    clearTimer();
    if (disposed) return;
    const now = scheduler.now();
    if (isCommercialAccessExpired(options.getAccess(), now)) {
      refreshPending = true;
      options.invalidateExpiredAccess();
    }
    if (refreshPending && !refreshing && options.canRefresh() && now >= retryAt) {
      refreshing = true;
      retryAt = now + AUTOMATIC_COMMERCIAL_REFRESH_INTERVAL_MS;
      void options.refresh().catch(() => undefined).finally(() => {
        refreshing = false;
        reschedule();
      });
    } else if (refreshPending && (!options.canRefresh() || refreshing)) {
      retryAt = Math.max(retryAt, now + AUTOMATIC_COMMERCIAL_REFRESH_INTERVAL_MS);
    }
    reschedule();
  };

  return {
    check,
    reschedule,
    reset() {
      refreshPending = false;
      retryAt = 0;
      clearTimer();
    },
    dispose() {
      disposed = true;
      clearTimer();
    },
  };
}

export function isCurrentCommercialRefreshGeneration(
  requestGeneration: number,
  activeGeneration: number,
): boolean {
  return requestGeneration === activeGeneration;
}
