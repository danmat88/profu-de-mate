import type { RootStackParamList } from '../../shared/types';

type IdentityResetState = {
  index: number;
  routes: { name: keyof RootStackParamList; params?: Record<string, unknown> }[];
};

const SESSION_SAFE_ROUTES = new Set<keyof RootStackParamList>([
  'Home',
  'Settings',
  'Legal',
  'Paywall',
  'Formulas',
  'FormulaDetail',
  'ExamGuide',
  'ExamsHub',
  'ExamSimulation',
  'ExamResult',
  'PracticeHub',
  'PracticeSession',
  'PracticeSummary',
]);

/** Reset account-owned screens while keeping sign-in and Premium flows open. */
export function navigationAfterIdentityChange(route: keyof RootStackParamList): IdentityResetState | undefined {
  if (route === 'Paywall') {
    return { index: 1, routes: [{ name: 'Home' }, { name: 'Paywall', params: { source: 'settings' } }] };
  }
  if (route === 'Settings' || route === 'Legal') {
    return { index: 1, routes: [{ name: 'Home' }, { name: route }] };
  }
  return undefined;
}

/**
 * Decide whether an identity transition requires resetting the navigation stack.
 * When every open route is session-safe (Home / Settings / Paywall / Legal),
 * keep the mounted navigator untouched to prevent flicker and layout drops.
 * When any account-owned route is open or underneath, strip it cleanly.
 */
export function navigationStateAfterIdentityChange(
  routeNames: readonly (keyof RootStackParamList)[],
  currentRoute: keyof RootStackParamList,
): IdentityResetState | null {
  if (routeNames.length > 0 && routeNames.every((name) => SESSION_SAFE_ROUTES.has(name))) {
    return null;
  }
  return navigationAfterIdentityChange(currentRoute) ?? { index: 0, routes: [{ name: 'Home' }] };
}
