import assert from 'node:assert/strict';
import test from 'node:test';
import { serviceLoader } from '../helpers/loadService.mts';
import type { CommercialAccess } from '../../src/shared/types/index.ts';
import { isCommercialAccessExpired } from '../../src/features/access/services/commercialRefreshPolicy.ts';
import { navigationAfterIdentityChange } from '../../src/app/navigation/sessionNavigation.ts';

const midnight = Date.parse('2026-09-20T21:00:00.000Z');
const exhausted: CommercialAccess = {
  identity: 'google', tier: 'free', limit: 5, used: 5, remaining: 0,
  canAnalyze: false, reason: 'daily_exhausted', resetAt: new Date(midnight).toISOString(),
  purchaseUserId: 'account', allowances: { welcome: 5, freeDaily: 5, premiumDaily: 30 },
  premium: { active: false, productId: null, expiresAt: null },
  deviceRecall: { shouldVerify: false, verified: false },
};
type Node = { type: string; props: Record<string, any> };
// Execute the real screen, replacing native rendering and inert purchase effects.
// Each render receives the context state before/after the midnight monitor fires.
function render(contextAccess: CommercialAccess | null, loading: boolean, source = 'quota', routeAccess = exhausted, options: {
  identity?: 'google' | 'anonymous' | null;
  configured?: boolean;
  offer?: any;
} = {}) {
  let backCalls = 0;
  let refreshCalls = 0;
  const noop = () => {};
  const jsx = (type: any, props: Record<string, any>): Node => typeof type === 'function' ? type(props) : ({ type, props });
  const load = serviceLoader({
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    react: { useState: (initial: any) => [typeof initial === 'function' ? initial() : initial, noop], useEffect: noop, useMemo: (fn: () => unknown) => fn() },
    'react-native': { StyleSheet: { create: (s: unknown) => s }, View: 'View', Image: 'Image', ScrollView: 'ScrollView', Pressable: 'Pressable' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 0 }) },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'src/features/access/context/CommercialContext.tsx': { useCommercial: () => ({ access: contextAccess, identity: options.identity, loading, refresh: () => { refreshCalls++; }, connectGoogle: noop, applyServerAccess: noop }) },
    'src/features/access/services/commercialRefreshPolicy.ts': { isCommercialAccessExpired },
    'src/features/access/services/purchases.ts': { isPurchasesConfigured: () => options.configured ?? false, getCachedPremiumOffer: () => options.offer ?? null },
    'src/shared/hooks/useResponsiveLayout.ts': { useResponsiveLayout: () => ({ gutter: 16 }) },
    'src/shared/hooks/useDelayedBusy.ts': { useDelayedBusy: () => false },
    'src/shared/utils/latestTask.ts': { createLatestTask: () => ({ run: noop, cancel: noop }) },
    'src/shared/services/sessionGuard.ts': {},
    'src/shared/services/bundledImages.ts': { bundledImageSource: (value: number) => value },
    'src/shared/ui/Typography.tsx': { Text: 'Text' },
    'src/shared/ui/ComicButton.tsx': { ComicButton: 'ComicButton' },
    'src/shared/ui/MiniGlyph.tsx': { MiniGlyph: 'MiniGlyph' },
    'src/features/account/components/GoogleAccountButton.tsx': { GoogleAccountButton: 'GoogleAccountButton' },
    'assets/profu_mascot_v2.png': 0,
  }, { Date: { now: () => midnight } });
  const { PaywallScreen } = load('src/features/access/screens/PaywallScreen.tsx');
  const tree = PaywallScreen({ navigation: { goBack: () => { backCalls++; } }, route: { params: { access: routeAccess, source } } });
  const nodes: Node[] = [];
  function visit(node: any) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (node && typeof node === 'object' && node.props) { nodes.push(node); visit(node.props.children); }
  }
  visit(tree);
  return { nodes, text: JSON.stringify(tree), backCalls: () => backCalls, refreshCalls: () => refreshCalls };
}

test('a quota screen never resurrects an expired Premium route snapshot during midnight refresh or offline failure', () => {
  const premium = { ...exhausted, tier: 'premium' as const, premium: { active: true, productId: 'premium', expiresAt: null } };
  const loading = render(null, true, 'quota', premium);
  assert.equal(loading.nodes.filter(n => n.props.accessibilityRole === 'radio').length, 2, 'the offer stays visible while access refreshes');
  assert.equal(loading.nodes.some(n => n.type === 'PlayfulLoader'), false, 'background access must not replace the screen with a loader');
  assert.equal(loading.text.includes('probleme disponibile azi'), false);
  const offline = render(null, false, 'quota', premium);
  assert.equal(offline.text.includes('probleme disponibile azi'), false);
  const retry = offline.nodes.find(n => n.type === 'Pressable' && n.props.children?.props?.children === 'Reîncearcă verificarea');
  assert.ok(retry);
  retry.props.onPress();
  assert.equal(offline.refreshCalls(), 1);
  assert.equal(offline.nodes.some(n => n.type === 'GoogleAccountButton'), false);
});

test('guest users see the Premium overview and both plan choices before Google sign-in', () => {
  const guest = { ...exhausted, identity: 'anonymous' as const, tier: 'guest' as const };
  const result = render(guest, false, 'home', guest, { identity: 'anonymous' });
  assert.equal(result.nodes.filter(n => n.props.accessibilityRole === 'radio').length, 2);
  assert.equal(result.nodes.some(n => n.type === 'GoogleAccountButton'), true);
  assert.equal(result.text.includes('Abonamentele nu sunt disponibile momentan'), true);
  assert.equal(result.text.includes('lei'), false, 'the UI must not invent a price when billing is unconfigured');
});

test('a missing billing key keeps the real purchase action disabled with an explicit message', () => {
  const result = render({ ...exhausted, resetAt: null }, false, 'settings');
  const purchase = result.nodes.find(n => n.type === 'ComicButton' && n.props.title === 'Abonamente indisponibile');
  assert.ok(purchase);
  assert.equal(purchase.props.disabled, true);
});

test('a monthly-only store offering selects the available package and displays its actual localized price', () => {
  const offer = { annual: null, monthly: { identifier: 'monthly', product: { priceString: '29,99 RON' } } };
  const result = render({ ...exhausted, resetAt: null }, false, 'settings', exhausted, { configured: true, offer });
  const options = result.nodes.filter(n => n.props.accessibilityRole === 'radio');
  assert.equal(options.length, 1);
  assert.equal(options[0].props.accessibilityState.checked, true);
  const buy = result.nodes.find(n => n.type === 'ComicButton' && n.props.title === 'Alege Premium · 29,99 RON');
  assert.ok(buy);
  assert.equal(buy.props.disabled, false);
});

test('identity changes retain a usable Premium back stack and discard old account params', () => {
  const state = navigationAfterIdentityChange('Paywall');
  assert.deepEqual(state, { index: 1, routes: [{ name: 'Home' }, { name: 'Paywall', params: { source: 'settings' } }] });
  assert.equal(JSON.stringify(state).includes('access'), false);
  for (const route of ['Lesson', 'Notebook', 'Processing', 'MathProcessing', 'MathInput'] as const) {
    assert.equal(navigationAfterIdentityChange(route), undefined, 'account-owned routes must not survive an identity reset');
  }
});

test('an open quota screen offers Continue after the server restores free or Premium daily allowance', () => {
  for (const premium of [false, true]) {
    const refreshed = { ...exhausted, remaining: 3, used: 2, canAnalyze: true, resetAt: new Date(midnight + 86_400_000).toISOString(), premium: { active: premium, productId: null, expiresAt: null } };
    const result = render(refreshed, false);
    const button = result.nodes.find(n => n.type === 'Pressable' && n.props.children?.props?.children === 'Continuă');
    assert.ok(button, `Continue must be available for premium=${premium}`);
    button.props.onPress();
    assert.equal(result.backCalls(), 1);
  }
});

test('only a fresh server context unlocks Continue; route data and expired context cannot grant it', () => {
  const available = { ...exhausted, canAnalyze: true, remaining: 5, resetAt: new Date(midnight + 86_400_000).toISOString() };
  for (const result of [render(null, true, 'quota', available), render({ ...available, resetAt: exhausted.resetAt }, false), render(available, false, 'settings')]) {
    assert.equal(result.text.includes('Ai probleme disponibile.'), false);
  }
});
