import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { serviceLoader } from '../helpers/loadService.mts';

test('splash text first mounts with prepared custom typefaces, never a temporary system font', () => {
  let textMounts = 0;
  const view = ({ children }: any) => React.createElement('div', null, children);
  const composite = { start() {}, stop() {} };
  class MockAnimatedValue {
    value: number;
    constructor(initial: number) { this.value = initial; }
    setValue(next: number) { this.value = next; }
    stopAnimation() {}
    interpolate() { return this; }
  }
  const flatten = (style: any): any => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
  const load = serviceLoader({
    react: React,
    'react/jsx-runtime': jsxRuntime,
    'react-native': {
      Animated: {
        Value: MockAnimatedValue,
        View: view,
        timing: () => composite,
        spring: () => composite,
        sequence: () => composite,
        loop: () => composite,
        delay: () => composite,
        multiply: () => new MockAnimatedValue(1),
      },
      Easing: { inOut: (fn: unknown) => fn, out: (fn: unknown) => fn, in: (fn: unknown) => fn, quad: (v: number) => v, sin: (v: number) => v, cubic: (v: number) => v },
      Image: () => React.createElement('img'),
      StyleSheet: { create: (styles: unknown) => styles }, View: view,
      useWindowDimensions: () => ({ width: 360, height: 802 }),
    },
    'react-native-safe-area-context': {
      useSafeAreaFrame: () => ({ x: 0, y: 0, width: 360, height: 802 }),
      useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
    },
    'react-native-svg': {
      __esModule: true,
      default: view,
      Defs: view,
      Path: view,
      RadialGradient: view,
      Rect: view,
      Stop: view,
    },
    'expo-linear-gradient': { LinearGradient: view },
    'expo-splash-screen': {}, 'expo-status-bar': { StatusBar: () => null },
    'src/shared/services/bundledImages.ts': { bundledImageSource: (id: number) => id },
    'src/shared/services/haptics.ts': { selection() {} },
    'src/shared/ui/Typography.tsx': { Text: ({ style, children }: any) => {
      textMounts++;
      return React.createElement('span', { 'data-typeface': flatten(style).fontFamily }, children);
    } },
    'assets/brand/splash_mark_v2.png': 1,
  });
  const { LaunchSplash } = load('src/app/components/LaunchSplash.tsx');
  const props = { ready: false, reducedMotion: false, onFinish() {} };
  renderToStaticMarkup(React.createElement(LaunchSplash, { ...props, visualsReady: false }));
  assert.equal(textMounts, 0, 'native text cannot cache a fallback typeface before fonts are ready');
  const ready = renderToStaticMarkup(React.createElement(LaunchSplash, { ...props, visualsReady: true }));
  assert.ok(textMounts > 0);
  assert.match(ready, /data-typeface="BalsamiqSans_700Bold">Profu’/);
  assert.match(ready, /data-typeface="FiraSans_500Medium">Matematica, pas cu pas\./);
  assert.doesNotMatch(ready, /Verific contul|%/);
});

test('all icon artwork and UI/document fonts must finish before visual preparation succeeds', async () => {
  let finishImages!: () => void;
  let finishFonts!: () => void;
  let finishDocumentFonts!: () => void;
  const images = new Promise<void>((resolve) => { finishImages = resolve; });
  const fonts = new Promise<void>((resolve) => { finishFonts = resolve; });
  const documents = new Promise<void>((resolve) => { finishDocumentFonts = resolve; });
  let requestedArtwork: number[] = [];
  let fontNames: string[] = [];
  const load = serviceLoader({
    '@expo-google-fonts/balsamiq-sans/400Regular': { BalsamiqSans_400Regular: 20 },
    '@expo-google-fonts/balsamiq-sans/700Bold': { BalsamiqSans_700Bold: 21 },
    '@expo-google-fonts/fira-sans/400Regular': { FiraSans_400Regular: 22 },
    '@expo-google-fonts/fira-sans/500Medium': { FiraSans_500Medium: 23 },
    '@expo-google-fonts/fira-sans/600SemiBold': { FiraSans_600SemiBold: 24 },
    'expo-font': { loadAsync: (map: object) => { fontNames = Object.keys(map); return fonts; } },
    'src/shared/services/bundledImages.ts': { prepareBundledImages: (modules: number[]) => { requestedArtwork = Array.from(modules); return images; } },
    'src/shared/ui/AppIcon.tsx': { iconAssets: { camera: 10, gallery: 11, notebook: 12, practice: 13, scan: 14, settings: 15, verify: 16, trophy: 17 } },
    'src/shared/ui/Mascot.tsx': { mascotAssets: { default: 3, wave: 30, thinking: 31, cheer: 32, oops: 33, point: 34 } },
    'src/features/math/services/documentFonts.ts': { preloadDocumentFonts: () => documents },
    'assets/brand/splash_mark_v2.png': 1,
    'assets/brand/profu_mark_v2.png': 2,
    'assets/profu_mascot_v2.png': 3,
  });
  const { preloadCriticalAppAssets } = load('src/app/services/startupAssets.ts');
  let ready = false;
  const prepared = preloadCriticalAppAssets().then(() => { ready = true; });
  finishImages(); finishFonts();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(ready, false, 'document fonts are also required before entering the app');
  finishDocumentFonts(); await prepared;
  assert.deepEqual(requestedArtwork, [1, 2, 3, 3, 30, 31, 32, 33, 34, 10, 11, 12, 13, 14, 15, 16, 17]);
  assert.equal(fontNames.length, 5);
});

test('shared images are downloaded and decoded once, and screens use their prepared local URI', async () => {
  let downloads = 0; let decodes = 0;
  const load = serviceLoader({
    'expo-asset': { Asset: { fromModule: (id: number) => ({ localUri: `file://icon-${id}.png`, downloadAsync: async () => { downloads++; } }) } },
    'react-native': { Image: { getSize: async () => { decodes++; return { width: 256, height: 256 }; } } },
  });
  const images = load('src/shared/services/bundledImages.ts');
  assert.equal(images.bundledImageSource(1), 1);
  await Promise.all([images.prepareBundledImages([1, 1, 2]), images.prepareBundledImages([1, 2])]);
  assert.equal(downloads, 2);
  assert.equal(decodes, 2);
  assert.equal(images.bundledImageSource(1).uri, 'file://icon-1.png');
  await images.prepareBundledImages([1, 2]);
  assert.equal(downloads, 2);
});

test('an image decode failure is not marked ready and can be retried', async () => {
  let fail = true;
  const load = serviceLoader({
    'expo-asset': { Asset: { fromModule: () => ({ localUri: 'file://icon.png', downloadAsync: async () => {} }) } },
    'react-native': { Image: { getSize: async () => { if (fail) throw Error('decode'); return { width: 256, height: 256 }; } } },
  });
  const images = load('src/shared/services/bundledImages.ts');
  await assert.rejects(images.prepareBundledImages([1]));
  assert.equal(images.bundledImageSource(1), 1);
  fail = false;
  await images.prepareBundledImages([1]);
  assert.equal(images.bundledImageSource(1).uri, 'file://icon.png');
});

test('release Android drawable resource identifiers prepare without invoking Fresco encoded Image.getSize', async () => {
  let getSizeCalls = 0;
  let downloads = 0;
  const assets: Record<number, { uri: string; localUri?: string }> = {
    1: { uri: 'assets_brand_splash_mark_v2', localUri: 'assets_brand_splash_mark_v2' },
    2: { uri: 'res:/2131230845' },
    3: { uri: 'file:///android_res/drawable/assets_mascot_owl_wave.png' },
    4: { uri: '' },
  };
  const load = serviceLoader({
    'expo-asset': {
      Asset: {
        fromModule: (id: number) => ({
          ...assets[id],
          downloadAsync: async () => { downloads++; },
        }),
      },
    },
    'react-native': {
      Image: {
        getSize: async () => {
          getSizeCalls++;
          throw new Error('Unsupported uri scheme for encoded image fetch! Uri is: res:2131230845');
        },
      },
    },
  });
  const images = load('src/shared/services/bundledImages.ts');
  await images.prepareBundledImages([1, 2, 3]);
  assert.equal(getSizeCalls, 0);
  assert.equal(downloads, 3);
  assert.equal(images.bundledImageSource(1), 1);
  assert.equal(images.bundledImageSource(2), 2);
  assert.equal(images.bundledImageSource(3), 3);
  await images.prepareBundledImages([1, 2, 3]);
  assert.equal(downloads, 3);
  await assert.rejects(images.prepareBundledImages([4]));
});

test('document fonts are downloaded once and become synchronously available to subsequent lesson screens', async () => {
  let downloads = 0;
  const load = serviceLoader({
    '@expo-google-fonts/balsamiq-sans/700Bold': { BalsamiqSans_700Bold: 1 },
    '@expo-google-fonts/fira-sans/400Regular': { FiraSans_400Regular: 2 },
    '@expo-google-fonts/fira-sans/500Medium': { FiraSans_500Medium: 3 },
    '@expo-google-fonts/fira-sans/600SemiBold': { FiraSans_600SemiBold: 4 },
    'expo-asset': { Asset: { fromModule: (id: number) => ({ localUri: `file:///font-${id}.ttf`, downloadAsync: async () => { downloads++; } }) } },
  });
  const fonts = load('src/features/math/services/documentFonts.ts');
  assert.equal(fonts.getCachedDocumentFonts(), undefined);
  const first = fonts.preloadDocumentFonts();
  const simultaneous = fonts.preloadDocumentFonts();
  assert.equal(first, simultaneous);
  const resolved = await first;
  assert.equal(fonts.getCachedDocumentFonts(), resolved);
  assert.equal(await fonts.preloadDocumentFonts(), resolved);
  assert.equal(downloads, 4);
  assert.equal(resolved.display, 'file:///font-1.ttf');
  assert.equal(resolved.bodyMedium, 'file:///font-3.ttf');
});

test('failed font preparation can retry without retaining a rejected cache entry', async () => {
  let fail = true;
  const load = serviceLoader({
    '@expo-google-fonts/balsamiq-sans/700Bold': { BalsamiqSans_700Bold: 1 },
    '@expo-google-fonts/fira-sans/400Regular': { FiraSans_400Regular: 2 },
    '@expo-google-fonts/fira-sans/500Medium': { FiraSans_500Medium: 3 },
    '@expo-google-fonts/fira-sans/600SemiBold': { FiraSans_600SemiBold: 4 },
    'expo-asset': { Asset: { fromModule: () => ({ uri: 'file:///font.ttf', downloadAsync: async () => { if (fail) throw Error('unavailable'); } }) } },
  });
  const fonts = load('src/features/math/services/documentFonts.ts');
  await assert.rejects(fonts.preloadDocumentFonts());
  assert.equal(fonts.getCachedDocumentFonts(), undefined);
  fail = false;
  assert.equal((await fonts.preloadDocumentFonts()).display, 'file:///font.ttf');
});

test('all controls share one reduced-motion native listener and respond together to accessibility changes', async () => {
  let reads = 0; let subscriptions = 0; let removals = 0; let updates = 0;
  let nativeUpdate!: (enabled: boolean) => void;
  const observers: Array<{ snapshot: () => boolean; stop: () => void }> = [];
  const load = serviceLoader({
    react: { useSyncExternalStore: (subscribe: any, snapshot: () => boolean) => {
      observers.push({ snapshot, stop: subscribe(() => { updates++; }) });
      return snapshot();
    } },
    'react-native': { AccessibilityInfo: {
      isReduceMotionEnabled: async () => { reads++; return true; },
      addEventListener: (_: string, listener: typeof nativeUpdate) => { subscriptions++; nativeUpdate = listener; return { remove() { removals++; } }; },
    } },
  });
  const { useReducedMotion } = load('src/shared/hooks/useReducedMotion.ts');
  useReducedMotion(); useReducedMotion();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(reads, 1);
  assert.equal(subscriptions, 1);
  assert.equal(observers.every(observer => observer.snapshot()), true);
  assert.equal(updates, 2);
  nativeUpdate(false);
  assert.equal(observers.some(observer => observer.snapshot()), false);
  observers[0].stop(); assert.equal(removals, 0);
  observers[1].stop(); assert.equal(removals, 1);
});

test('Notebook stays warm after its first read and discards late snapshots after a cache reset', async () => {
  const user = { uid: 'alice', isAnonymous: false, providerData: [{ providerId: 'google.com' }] };
  let snapshot!: (value: any) => void;
  let stopped = 0;
  let markSubscribed!: () => void;
  const subscribed = new Promise<void>((resolve) => { markSubscribed = resolve; });
  const load = serviceLoader({
    '@react-native-firebase/app': { getApp() {} },
    '@react-native-firebase/auth': { getAuth: () => ({ currentUser: user }) },
    '@react-native-firebase/firestore': {
      collection() {}, getFirestore() {}, orderBy() {}, query() {}, where() {},
      onSnapshot: (_: unknown, listener: typeof snapshot) => { snapshot = listener; markSubscribed(); return () => { stopped++; }; },
    },
    'src/shared/services/firebase.ts': { initializeFirebaseServices: async () => user, firebaseUserSessionKey: (value: any) => value?.uid },
    'src/features/math/utils/mathContent.ts': { isMathAnalysis: () => true },
  });
  const notebook = load('src/features/lessons/services/lessons.ts');
  const warming = notebook.prewarmFavoriteLessonsCache();
  await subscribed;
  snapshot({ docs: [], docChanges: () => [] });
  await warming;
  assert.equal(stopped, 0, 'the warmer must keep observing later saves');
  const doc = { id: 'saved', data: () => ({ isFavorite: true, expiresAt: { toMillis: () => Date.now() + 400 * 86400000 } }) };
  snapshot({ docs: [doc], docChanges: () => [{ type: 'added', doc }] });
  assert.equal(notebook.getCachedFavoriteLessons()[0].id, 'saved');
  notebook.clearFavoriteLessonsCache();
  assert.equal(stopped, 1);
  snapshot({ docs: [doc], docChanges: () => [{ type: 'added', doc }] });
  assert.equal(notebook.getCachedFavoriteLessons(), undefined, 'a late snapshot must not resurrect data after reset');
});
