export const AUTOMATIC_COMMERCIAL_REFRESH_INTERVAL_MS = 60_000;

type AutomaticRefreshState = {
  now: number;
  lastSuccessfulRefreshAt: number;
  identityTransitionActive: boolean;
};

/**
 * Automatic lifecycle events use stale-while-revalidate. Explicit business
 * events (analysis completion, login, logout, deletion) bypass this policy and
 * call the authoritative refresh directly.
 */
export function shouldAutomaticallyRefreshCommercialAccess({
  now,
  lastSuccessfulRefreshAt,
  identityTransitionActive,
}: AutomaticRefreshState): boolean {
  if (identityTransitionActive) return false;
  if (lastSuccessfulRefreshAt <= 0) return true;
  const age = now - lastSuccessfulRefreshAt;
  return age < 0 || age >= AUTOMATIC_COMMERCIAL_REFRESH_INTERVAL_MS;
}

export function isCurrentCommercialRefreshGeneration(
  requestGeneration: number,
  activeGeneration: number,
): boolean {
  return requestGeneration === activeGeneration;
}
