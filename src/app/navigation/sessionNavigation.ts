import type { RootStackParamList } from '../../shared/types';

/** Reset account-owned screens while keeping sign-in and Premium flows open. */
export function navigationAfterIdentityChange(route: keyof RootStackParamList) {
  if (route === 'Paywall') {
    return { index: 1, routes: [{ name: 'Home' }, { name: 'Paywall', params: { source: 'settings' } }] };
  }
  if (route === 'Settings' || route === 'Legal') {
    return { index: 1, routes: [{ name: 'Home' }, { name: route }] };
  }
  return undefined;
}
