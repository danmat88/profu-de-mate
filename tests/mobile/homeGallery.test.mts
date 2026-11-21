import assert from 'node:assert/strict';
import test from 'node:test';
import { serviceLoader } from '../helpers/loadService.mts';

const access = {
  identity: 'google', tier: 'free', remaining: 2, limit: 5,
  premium: { active: false },
};
const hooks = {
  useCallback: (fn: unknown) => fn,
  useContext: () => true,
  useRef: (current: unknown) => ({ current }),
  useState: (initial: any) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect() {},
};
const jsx = (type: unknown, props: unknown) => ({ type, props });
const flatten = (style: any): any => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

function surfaceFixture() {
  const window = { width: 360, height: 802, fontScale: 1 };
  const frame = { x: 0, y: 0, width: 360, height: 802 };
  const insets = { top: 42, right: 0, bottom: 0, left: 0 };
  const sharedValue = (initial: number) => ({ value: initial, get: () => initial, set() {} });
  const load = serviceLoader({
    react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {
      AppState: { currentState: 'active' },
      View: 'View', Image: 'Image', Pressable: 'Pressable', StyleSheet: { create: (s: unknown) => s },
      useWindowDimensions: () => window,
    },
    'react-native-reanimated': {
      default: { View: 'View' },
      cancelAnimation() {},
      Easing: { inOut: (fn: unknown) => fn, quad: (v: number) => v },
      useAnimatedStyle: (fn: () => unknown) => fn(),
      useSharedValue: sharedValue,
      withRepeat: (v: unknown) => v,
      withSequence: (v: unknown) => v,
      withSpring: (v: unknown) => v,
      withTiming: (v: unknown) => v,
    },
    '@react-navigation/native': { useIsFocused: () => true },
    'react-native-safe-area-context': { useSafeAreaFrame: () => frame, useSafeAreaInsets: () => insets },
    'expo-linear-gradient': { LinearGradient: 'Gradient' }, 'expo-status-bar': { StatusBar: 'StatusBar' },
    'src/features/home/context/HomeMotionContext.ts': { HomeMotionReadyContext: {} },
    'src/shared/hooks/useReducedMotion.ts': { useReducedMotion: () => true },
    'src/shared/services/bundledImages.ts': { bundledImageSource: (id: number) => id },
    'src/shared/ui/AppIcon.tsx': { AppIcon: 'AppIcon' }, 'src/shared/ui/Chip.tsx': { Chip: 'Chip' },
    'src/shared/ui/ComicBackdrop.tsx': { ComicBackdrop: 'Backdrop' }, 'src/shared/ui/Enter.tsx': { Enter: 'Enter' },
    'src/shared/ui/IconButton.tsx': { IconButton: 'IconButton' }, 'src/shared/ui/Mascot.tsx': { Mascot: 'Mascot' },
    'src/shared/ui/MiniGlyph.tsx': { MiniGlyph: 'Glyph' }, 'src/shared/ui/PlayfulLoader.tsx': { PlayfulLoader: 'Loader' },
    'src/shared/ui/PressableScale.tsx': { PressableScale: 'PressableScale' },
    'src/shared/ui/SegmentedToggle.tsx': { SegmentedToggle: 'SegmentedToggle' },
    'src/shared/ui/SpeechBubble.tsx': { SpeechBubble: 'SpeechBubble' },
    'src/shared/ui/Typography.tsx': { Text: 'Text' },
    'assets/brand/profu_mark_v2.png': 1, 'assets/profu_mascot_v2.png': 2,
  });
  const Surface = load('src/features/home/components/HomeSurface.tsx').HomeSurface;
  const render = (busy = false) => Surface({ mode: 'solve', pending: false, galleryBusy: busy, galleryError: null,
    allowance: { label: '2 din 5 azi', note: 'VEZI PREMIUM', accessibilityLabel: 'Premium' },
  });
  return { window, frame, insets, render };
}

function find(node: any, predicate: (node: any) => boolean): any {
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const found = find(child, predicate);
    if (found) return found;
  }
}

function geometry(root: any) {
  const page = root.props.children[2].props.children;
  const sections = page.props.children;
  const gallery = find(root, node => node.props?.accessibilityLabel === 'Alege o fotografie din galerie');
  const galleryIcon = gallery.props.children[1];
  const galleryCopy = gallery.props.children[2];
  return JSON.parse(JSON.stringify({
    root: flatten(root.props.style), page: flatten(page.props.style),
    header: flatten(sections[0].props.style), tutor: flatten(sections[1].props.style),
    modes: flatten(sections[2].props.style), camera: flatten(sections[3].props.style),
    galleryIcon: flatten(galleryIcon.props.style),
    galleryLabel: galleryCopy.props.children[0].props.children,
  }));
}

test('Home keeps its geometry across picker opening, temporary Android window/bar changes and cancellation', () => {
  const fixture = surfaceFixture();
  const before = geometry(fixture.render());
  assert.equal(before.header.height, 58);
  assert.deepEqual(geometry(fixture.render(true)), before);
  fixture.window.height = 744;
  fixture.insets.bottom = 24;
  assert.deepEqual(geometry(fixture.render(true)), before, 'native picker window metrics cannot switch Home to compact');
  assert.deepEqual(geometry(fixture.render()), before, 'picker resolution before inset restoration must not reflow Home');
  fixture.window.height = 802;
  fixture.insets.bottom = 0;
  assert.deepEqual(geometry(fixture.render()), before);
});

test('Home still adapts to actual root resizing and accessibility font changes', () => {
  const fixture = surfaceFixture();
  fixture.frame.height = 640;
  assert.equal(geometry(fixture.render()).header.height, 44);
  fixture.frame.height = 802;
  fixture.window.fontScale = 1.3;
  assert.equal(geometry(fixture.render()).header.height, 44);
  fixture.window.fontScale = 1;
  fixture.frame.width = 640;
  const resized = geometry(fixture.render());
  assert.equal(resized.header.height, 58);
  assert.equal(resized.page.width, 560);
});

test('cancelling the gallery preserves Home, releases the launch lock and permits a later photo selection', async () => {
  const launches: Array<(result: unknown) => void> = [];
  const navigations: any[] = [];
  const stateChanges: any[] = [];
  let stateIndex = 0;
  const load = serviceLoader({
    react: { ...hooks, useState: (initial: any) => {
      const index = stateIndex++;
      return [typeof initial === 'function' ? initial() : initial, (value: unknown) => stateChanges.push({ index, value })];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@react-navigation/native': { useNavigation: () => ({ navigate: (...args: any[]) => navigations.push(args) }), useFocusEffect() {} },
    'expo-image-picker': { launchImageLibraryAsync: () => new Promise(resolve => launches.push(resolve)) },
    'src/features/home/components/HomeSurface.tsx': { HomeSurface: 'HomeSurface' },
    'src/shared/ui/ReadinessScreen.tsx': {},
    'src/features/access/context/CommercialContext.tsx': { useCommercial: () => ({ access, status: 'ready', refreshIfStale: async () => {} }) },
    'src/features/analysis/services/pendingAnalysis.ts': { getPreparedPendingAnalysis: () => null },
    'src/features/lessons/services/lessons.ts': { getCachedFavoriteLessons: () => undefined },
    'src/features/math/services/mathDraft.ts': { warmMathDrafts() {} },
    'src/shared/storage/localPreferences.ts': { hasSeenHomeGuide: () => true, markHomeGuideSeen() {} },
    'src/shared/services/sessionGuard.ts': { captureSession: () => ({}), assertSessionActive() {} },
    'src/shared/services/haptics.ts': { impact() {}, notification() {}, ImpactFeedbackStyle: { Light: 'light' }, NotificationFeedbackType: { Success: 'success', Error: 'error' } },
  });
  const home = load('src/features/home/screens/HomeScreen.tsx').HomeScreen();
  home.props.onGallery(); home.props.onGallery();
  assert.equal(launches.length, 1, 'rapid taps must not launch overlapping native pickers');
  launches[0]({ canceled: true, assets: null });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(navigations, []);
  assert.equal(stateChanges.some(change => change.index === 2 && change.value !== null), false, 'cancellation is not an error');
  assert.deepEqual(stateChanges.filter(change => change.index === 1).map(change => change.value), [true, false]);
  home.props.onGallery();
  assert.equal(launches.length, 2);
  launches[1]({ canceled: false, assets: [{ uri: 'file://picked-photo.jpg', width: 1200, height: 900 }] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(navigations.length, 1);
  assert.equal(navigations[0][0], 'Review');
  assert.equal(navigations[0][1].mode, 'solve');
  assert.equal(navigations[0][1].image.uri, 'file://picked-photo.jpg');
});
