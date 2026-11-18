import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import type { CommercialAccess } from '../../src/shared/types/index.ts';
import { isCommercialAccessExpired } from '../../src/features/access/services/commercialRefreshPolicy.ts';

const midnight = Date.parse('2026-09-20T21:00:00.000Z');
const exhausted: CommercialAccess = {
  identity: 'google', tier: 'free', limit: 5, used: 5, remaining: 0,
  canAnalyze: false, reason: 'daily_exhausted', resetAt: new Date(midnight).toISOString(),
  purchaseUserId: 'account', allowances: { welcome: 5, freeDaily: 5, premiumDaily: 30 },
  premium: { active: false, productId: null, expiresAt: null },
  deviceRecall: { shouldVerify: false, verified: false },
};
type Node = { type: string; props: Record<string, any> };
const code = ts.transpileModule(readFileSync('src/features/access/screens/PaywallScreen.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

// Execute the real screen, replacing native rendering and inert purchase effects.
// Each render receives the context state before/after the midnight monitor fires.
function render(contextAccess: CommercialAccess | null, loading: boolean, source = 'quota', routeAccess = exhausted) {
  let backCalls = 0;
  let refreshCalls = 0;
  const noop = () => {};
  const exports: any = {};
  const jsx = (type: string, props: Record<string, any>): Node => ({ type, props });
  runInNewContext(code, {
    exports, Date: { now: () => midnight },
    require(name: string) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      if (name === 'react') return { useState: (initial: unknown) => [initial, noop], useEffect: noop, useMemo: (fn: () => unknown) => fn() };
      if (name === 'react-native') return { StyleSheet: { create: (s: unknown) => s }, View: 'View', ScrollView: 'ScrollView', Pressable: 'Pressable' };
      if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 0 }) };
      if (name.endsWith('/CommercialContext')) return { useCommercial: () => ({ access: contextAccess, loading, refresh: () => { refreshCalls++; }, connectGoogle: noop, applyServerAccess: noop }) };
      if (name.endsWith('/commercialRefreshPolicy')) return { isCommercialAccessExpired };
      if (name.endsWith('/useResponsiveLayout')) return { useResponsiveLayout: () => ({ gutter: 16 }) };
      if (name.endsWith('/theme')) return { colors: {}, fonts: {} };
      if (name.endsWith('/purchases')) return { isPurchasesConfigured: () => false };
      if (name.endsWith('/latestTask')) return { createLatestTask: () => ({ run: noop, cancel: noop }) };
      if (name.endsWith('/sessionGuard')) return {};
      if (name === 'expo-status-bar') return { StatusBar: 'StatusBar' };
      const component = name.split('/').pop()!;
      return { [component === 'Typography' ? 'Text' : component]: component === 'Typography' ? 'Text' : component };
    },
  });
  const tree = exports.PaywallScreen({ navigation: { goBack: () => { backCalls++; } }, route: { params: { access: routeAccess, source } } });
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
  assert.equal(loading.nodes.some(n => n.type === 'PlayfulLoader'), true);
  assert.equal(loading.text.includes('probleme disponibile azi'), false);
  const offline = render(null, false, 'quota', premium);
  assert.equal(offline.text.includes('probleme disponibile azi'), false);
  const retry = offline.nodes.find(n => n.props.title === 'Reîncearcă verificarea');
  assert.ok(retry);
  retry.props.onPress();
  assert.equal(offline.refreshCalls(), 1);
  assert.equal(offline.nodes.some(n => n.type === 'GoogleAccountButton'), false);
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
