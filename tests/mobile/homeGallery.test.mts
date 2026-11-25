import assert from 'node:assert/strict';
import test from 'node:test';
import { serviceLoader } from '../helpers/loadService.mts';

const access = {
  identity: 'google', tier: 'free', remaining: 2, limit: 5,
  premium: { active: false },
};
const hooks = {
  memo: (fn: unknown) => fn,
  useCallback: (fn: unknown) => fn,
  useContext: () => true,
  useMemo: (fn: () => unknown) => fn(),
  useRef: (current: unknown) => ({ current }),
  useState: (initial: any) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect() {},
};
const jsx = (type: unknown, props: unknown) => ({ type, props });
const flatten = (style: any): any => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

function mockAnimated(viewComponent: unknown) {
  const composite = { start() {}, stop() {} };
  class Value {
    value: number;
    constructor(initial: number) { this.value = initial; }
    setValue(next: number) { this.value = next; }
    stopAnimation() {}
    interpolate() { return this; }
  }
  return {
    Animated: {
      Value,
      View: viewComponent,
      timing: () => composite,
      spring: () => composite,
      sequence: () => composite,
      loop: () => composite,
      delay: () => composite,
    },
    Easing: {
      inOut: (fn: unknown) => fn,
      out: (fn: unknown) => fn,
      in: (fn: unknown) => fn,
      quad: (v: number) => v,
      cubic: (v: number) => v,
      sin: (v: number) => v,
      linear: (v: number) => v,
    },
  };
}

function surfaceFixture() {
  const window = { width: 360, height: 802, fontScale: 1 };
  const frame = { x: 0, y: 0, width: 360, height: 802 };
  const insets = { top: 42, right: 0, bottom: 0, left: 0 };
  const load = serviceLoader({
    react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {
      ...mockAnimated('View'),
      AppState: { currentState: 'active' },
      View: 'View', Image: 'Image', Pressable: 'Pressable', StyleSheet: { create: (s: unknown) => s },
      useWindowDimensions: () => window,
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
    'src/shared/ui/SpotlightAura.tsx': { SpotlightAura: 'SpotlightAura' },
    'src/shared/ui/Typography.tsx': { Text: 'Text' },
    'src/features/access/components/QuotaResetTimer.tsx': {
      ComicClockIcon: 'ComicClockIcon',
      HomeResetPillNote: 'HomeResetPillNote',
    },
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
  const page = root.props.children[1].props.children;
  const sections = page.props.children;
  const gallery = find(root, node => node.props?.accessibilityLabel === 'Alege o fotografie din galerie');
  const galleryIcon = gallery.props.children[0];
  const galleryCopy = gallery.props.children[1];
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
    'src/features/home/context/HomeMotionContext.ts': { HomeMotionReadyContext: {} },
    'src/shared/ui/ReadinessScreen.tsx': {},
    'src/features/access/context/CommercialContext.tsx': { useCommercial: () => ({ access, status: 'ready', refreshIfStale: async () => {} }) },
    'src/features/analysis/services/pendingAnalysis.ts': { getPreparedPendingAnalysis: () => null },
    'src/features/lessons/services/lessons.ts': { getCachedFavoriteLessons: () => undefined, subscribeFavoriteLessonsCache: () => () => {} },
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
  assert.equal(
    stateChanges.filter(change => change.index === 1).at(-1)?.value,
    false,
    'navigating to Review must still clear galleryBusy so Home tabs never return frozen',
  );
});

test('opening the gallery keeps Home controls crisp without dimming them gray', () => {
  const fixture = surfaceFixture();
  const busyTree = fixture.render(true);
  const toggle = find(busyTree, node => node.type === 'SegmentedToggle');
  const capture = find(busyTree, node => node.props?.accessibilityLabel === 'Fotografiază o problemă de rezolvat');
  const gallery = find(busyTree, node => node.props?.accessibilityLabel === 'Alege o fotografie din galerie');
  const math = find(busyTree, node => node.props?.accessibilityLabel === 'Scrie o problemă sau o rezolvare');

  assert.equal(toggle.props.disabled, true);
  assert.equal(toggle.props.dimWhenDisabled, false);
  assert.equal(capture.props.disabled, true);
  assert.equal(capture.props.dimWhenDisabled, false);
  assert.equal(gallery.props.disabled, true);
  assert.equal(gallery.props.dimWhenDisabled, false);
  assert.equal(math.props.disabled, true);
  assert.equal(math.props.dimWhenDisabled, false);
});

function statefulSurfaceFixture(initialHeight = 802) {
  const window = { width: 360, height: initialHeight, fontScale: 1 };
  const frame = { x: 0, y: 0, width: 360, height: initialHeight };
  const insets = { top: 42, right: 0, bottom: 0, left: 0 };
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  let stateCursor = 0;
  let refCursor = 0;
  const load = serviceLoader({
    react: {
      memo: (fn: unknown) => fn,
      useCallback: (fn: unknown) => fn,
      useContext: () => true,
      useMemo: (fn: () => unknown) => fn(),
      useRef: (initial: unknown) => {
        const index = refCursor++;
        if (!refs[index]) refs[index] = { current: initial };
        return refs[index];
      },
      useState: (initial: any) => {
        const index = stateCursor++;
        if (!(index in states)) {
          states[index] = typeof initial === 'function' ? initial() : initial;
        }
        const setState = (next: any) => {
          states[index] = typeof next === 'function' ? next(states[index]) : next;
        };
        return [states[index], setState];
      },
      useEffect() {},
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {
      ...mockAnimated('View'),
      AppState: { currentState: 'active' },
      View: 'View', Image: 'Image', Pressable: 'Pressable', StyleSheet: { create: (s: unknown) => s },
      useWindowDimensions: () => window,
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
    'src/shared/ui/SpotlightAura.tsx': { SpotlightAura: 'SpotlightAura' },
    'src/shared/ui/Typography.tsx': { Text: 'Text' },
    'src/features/access/components/QuotaResetTimer.tsx': {
      ComicClockIcon: 'ComicClockIcon',
      HomeResetPillNote: 'HomeResetPillNote',
    },
    'assets/brand/profu_mark_v2.png': 1, 'assets/profu_mascot_v2.png': 2,
  });
  const Surface = load('src/features/home/components/HomeSurface.tsx').HomeSurface;
  const render = (overrides: Record<string, unknown> = {}) => {
    stateCursor = 0;
    refCursor = 0;
    return Surface({
      mode: 'solve',
      pending: false,
      galleryBusy: false,
      galleryError: null,
      allowance: { label: '2 din 5 azi', note: 'VEZI PREMIUM', accessibilityLabel: 'Premium' },
      remaining: 2,
      limit: 5,
      premiumActive: false,
      ...overrides,
    });
  };
  return { render };
}

test('top-left owl icon adapts tutor messages for exhausted free, exhausted premium, last problem, pending and gallery errors', () => {
  const freeExhausted = statefulSurfaceFixture();
  let tree = freeExhausted.render({ remaining: 0, limit: 5, premiumActive: false });
  let bubble = find(tree, node => node.type === 'SpeechBubble');
  let mascot = find(tree, node => node.type === 'Mascot');
  assert.equal(bubble.props.title, 'Ai terminat pe azi!');
  assert.ok(bubble.props.body.length <= 42, 'exhausted owl body stays concise without ugly ellipsis');
  assert.equal(mascot.props.nudgeSignal, 0);

  const seenFreeBodies: string[] = [];
  for (let tap = 1; tap <= 4; tap += 1) {
    const logoButton = find(tree, node => node.props?.accessibilityLabel === 'Profu’ de mate');
    logoButton.props.onPress();
    tree = freeExhausted.render({ remaining: 0, limit: 5, premiumActive: false });
    bubble = find(tree, node => node.type === 'SpeechBubble');
    mascot = find(tree, node => node.type === 'Mascot');
    seenFreeBodies.push(bubble.props.body);
    assert.equal(mascot.props.nudgeSignal, tap, 'tapping top-left owl icon nudges Profu mascot');
    assert.doesNotMatch(bubble.props.body, /Fă o poză|Deschide camera/i);
    assert.ok(bubble.props.body.length <= 44);
  }
  assert.equal(seenFreeBodies.some(body => body.includes('Premium')), true);

  const premiumExhausted = statefulSurfaceFixture();
  tree = premiumExhausted.render({ remaining: 0, limit: 30, premiumActive: true });
  for (let tap = 0; tap < 3; tap += 1) {
    find(tree, node => node.props?.accessibilityLabel === 'Profu’ de mate').props.onPress();
    tree = premiumExhausted.render({ remaining: 0, limit: 30, premiumActive: true });
    bubble = find(tree, node => node.type === 'SpeechBubble');
    assert.doesNotMatch(bubble.props.title + bubble.props.body, /Premium/i, 'exhausted Premium users must not get Premium upsell tips');
  }

  const lastProblem = statefulSurfaceFixture();
  tree = lastProblem.render({ remaining: 1, limit: 5, premiumActive: false });
  find(tree, node => node.props?.accessibilityLabel === 'Profu’ de mate').props.onPress();
  tree = lastProblem.render({ remaining: 1, limit: 5, premiumActive: false });
  bubble = find(tree, node => node.type === 'SpeechBubble');
  assert.equal(bubble.props.title, 'Ultima problemă pe azi!');

  let cleared = 0;
  const galleryErrorFixture = statefulSurfaceFixture();
  tree = galleryErrorFixture.render({
    galleryError: 'Fotografia nu s-a deschis. Încearcă alta.',
    onClearGalleryError: () => { cleared += 1; },
  });
  bubble = find(tree, node => node.type === 'SpeechBubble');
  assert.equal(bubble.props.tone, 'roseSoft');
  find(tree, node => node.props?.accessibilityLabel === 'Profu’ de mate').props.onPress();
  assert.equal(cleared, 1, 'tapping the top-left owl icon dismisses an active gallery error');

  const compactExhausted = statefulSurfaceFixture(640);
  tree = compactExhausted.render({ remaining: 0, limit: 5, premiumActive: false });
  bubble = find(tree, node => node.type === 'SpeechBubble');
  assert.ok(bubble.props.body.length <= 32, 'compact phones get a short 1-line owl message without clipping');
});

test('Home pending analysis keeps balanced lower tiles, distinguishes photo vs written math, and lets user cancel cleanly', () => {
  let discarded = 0;
  let openedPractice = 0;
  const fixture = statefulSurfaceFixture();
  const photoPending = fixture.render({
    mode: 'solve',
    pending: true,
    pendingKind: 'photo',
    embedded: true,
    onDiscardPending: () => { discarded += 1; },
    onQuickPractice: () => { openedPractice += 1; },
  });

  const toggle = find(photoPending, node => node.type === 'SegmentedToggle');
  assert.equal(toggle.props.disabled, true);
  assert.equal(toggle.props.dimWhenDisabled, false);

  const photoBubble = find(photoPending, node => node.type === 'SpeechBubble');
  assert.equal(photoBubble.props.body, 'Fotografia și progresul sunt păstrate.');

  const discardBtn = find(photoPending, node => node.props?.accessibilityLabel === 'Anulează analiza în curs și începe altă problemă');
  assert.ok(discardBtn, 'pending state must expose an explicit cancel tile');
  discardBtn.props.onPress();
  assert.equal(discarded, 1);

  const quickPracticeBtn = find(photoPending, node => node.props?.accessibilityLabel === 'Începe un antrenament fulger de 5 minute');
  assert.ok(quickPracticeBtn, 'embedded pending state keeps quick practice banner so hero proportions never break');
  quickPracticeBtn.props.onPress();
  assert.equal(openedPractice, 1);

  const writtenPending = fixture.render({
    mode: 'check',
    pending: true,
    pendingKind: 'written',
    embedded: true,
  });
  const writtenBubble = find(writtenPending, node => node.type === 'SpeechBubble');
  assert.equal(writtenBubble.props.body, 'Exercițiul scris și progresul sunt păstrate.');
});
