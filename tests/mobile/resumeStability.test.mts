import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { serviceLoader } from '../helpers/loadService.mts';
import {
  stabilizeSafeAreaMetrics,
  type SafeAreaMetricsSnapshot,
} from '../../src/shared/utils/safeAreaStability.ts';

function snapshot(
  insets: Partial<SafeAreaMetricsSnapshot['insets']> = {},
  frame: Partial<SafeAreaMetricsSnapshot['frame']> = {},
): SafeAreaMetricsSnapshot {
  return {
    insets: { top: 42, right: 0, bottom: 0, left: 0, ...insets },
    frame: { x: 0, y: 0, width: 393, height: 851, ...frame },
  };
}

test('stabilizeSafeAreaMetrics ignores Android resume nav-bar jumps, top flicker and small height shrinks with reference identity', () => {
  const baseline = snapshot({ top: 42, bottom: 0 }, { width: 393, height: 851 });

  // 3-button or gesture nav bar reappears on minimize/resume -> bottom jumps 0 -> 48 / 24.
  const withNavBar = stabilizeSafeAreaMetrics(
    baseline,
    snapshot({ top: 42, bottom: 48 }, { width: 393, height: 851 }),
    { immersiveBottom: true },
  );
  assert.equal(withNavBar, baseline, 'resumed nav bar must not trigger layout or context re-renders');

  // Window height shrinks by 48dp alongside nav bar restoration.
  const withShrunkViewport = stabilizeSafeAreaMetrics(
    baseline,
    snapshot({ top: 42, bottom: 48 }, { width: 393, height: 803 }),
    { immersiveBottom: true },
  );
  assert.equal(withShrunkViewport, baseline, 'transient < 96dp height drop must not flip responsive breakpoints');

  // Recents / focus transition transiently collapses top inset to 0 or partial height.
  const withCollapsedTop = stabilizeSafeAreaMetrics(
    baseline,
    snapshot({ top: 0, bottom: 24 }, { width: 393, height: 851 }),
    { immersiveBottom: true },
  );
  assert.equal(withCollapsedTop, baseline, 'transient top inset collapse must never push headers under the status bar');

  const withPartialTop = stabilizeSafeAreaMetrics(
    baseline,
    snapshot({ top: 14, bottom: 0 }, { width: 393, height: 851 }),
    { immersiveBottom: true },
  );
  assert.equal(withPartialTop, baseline);

  // Detached zero-sized frame during backgrounding is ignored completely.
  const withZeroFrame = stabilizeSafeAreaMetrics(
    baseline,
    snapshot({ top: 0, bottom: 0 }, { width: 0, height: 0 }),
    { immersiveBottom: true },
  );
  assert.equal(withZeroFrame, baseline);
});

test('stabilizeSafeAreaMetrics settles cold-launch immersive hide and preserves non-hideable bars', () => {
  // Cold launch captured frame 0 before native hide completed.
  const coldStart = snapshot({ top: 0, bottom: 48 }, { width: 393, height: 803 });

  // Status bar arrives and nav bar finishes hiding -> accepts full height, real top, and bottom 0.
  const settled = stabilizeSafeAreaMetrics(
    coldStart,
    snapshot({ top: 42, bottom: 0 }, { width: 393, height: 851 }),
    { immersiveBottom: true },
  );
  assert.deepEqual(settled, snapshot({ top: 42, bottom: 0 }, { width: 393, height: 851 }));

  // Subsequent resume bar bounce stays locked at bottom 0.
  const afterResume = stabilizeSafeAreaMetrics(
    settled,
    snapshot({ top: 42, bottom: 48 }, { width: 393, height: 803 }),
    { immersiveBottom: true },
  );
  assert.equal(afterResume, settled);

  // Device where Android never hides the bar retains its real bottom inset safely.
  const permanentBar = snapshot({ top: 36, bottom: 48 }, { width: 393, height: 851 });
  const stillPermanent = stabilizeSafeAreaMetrics(
    permanentBar,
    snapshot({ top: 36, bottom: 48 }, { width: 393, height: 851 }),
    { immersiveBottom: true },
  );
  assert.equal(stillPermanent, permanentBar);
});

test('stabilizeSafeAreaMetrics adapts to real resizes (keyboard, split-screen, foldables) without latching a stray bottom bar', () => {
  const full = snapshot({ top: 42, bottom: 0 }, { x: 0, y: 0, width: 393, height: 851 });

  // Soft keyboard opens (adjustResize shrinks height by > 96dp) while top-anchored.
  const keyboardOpen = stabilizeSafeAreaMetrics(
    full,
    snapshot({ top: 0, bottom: 48 }, { x: 0, y: 0, width: 393, height: 520 }),
    { immersiveBottom: true },
  );
  assert.equal(keyboardOpen.frame.height, 520);
  assert.equal(keyboardOpen.insets.top, 42, 'top-anchored keyboard resize keeps established status-bar top');
  assert.equal(keyboardOpen.insets.bottom, 0, 'immersive bottom never latches a stray bar during keyboard resize');

  // Split-screen bottom pane has frame.y > 0 and legitimately has top = 0.
  const bottomSplitPane = stabilizeSafeAreaMetrics(
    full,
    snapshot({ top: 0, bottom: 0 }, { x: 0, y: 425, width: 393, height: 426 }),
    { immersiveBottom: true },
  );
  assert.equal(bottomSplitPane.frame.y, 425);
  assert.equal(bottomSplitPane.frame.height, 426);
  assert.equal(bottomSplitPane.insets.top, 0);

  // Foldable unfold changes width -> adapts cleanly while keeping hidden bottom bar.
  const unfolded = stabilizeSafeAreaMetrics(
    full,
    snapshot({ top: 38, bottom: 48 }, { x: 0, y: 0, width: 674, height: 840 }),
    { immersiveBottom: true },
  );
  assert.equal(unfolded.frame.width, 674);
  assert.equal(unfolded.insets.top, 38);
  assert.equal(unfolded.insets.bottom, 0);

  // Non-immersive mode preserves live bottom insets normally.
  const nonImmersive = stabilizeSafeAreaMetrics(
    full,
    snapshot({ top: 42, bottom: 34 }, { x: 0, y: 0, width: 393, height: 851 }),
    { immersiveBottom: false },
  );
  assert.equal(nonImmersive.insets.bottom, 34);
});

test('startImmersiveNavigationBarGuard re-hides on Android resume and clears stuck OEM bars without fighting swipes', async () => {
  let appState: 'active' | 'background' | 'inactive' = 'active';
  let appStateListener: ((state: 'active' | 'background' | 'inactive') => void) | null = null;
  let visibilityListener: ((event: { visibility: 'visible' | 'hidden' }) => void) | null = null;
  let barVisibility: 'visible' | 'hidden' = 'hidden';
  let hideCalls = 0;
  let nextTimerId = 1;
  const timers = new Map<number, { delay: number; callback: () => void }>();

  const load = serviceLoader({
    'expo-navigation-bar': {
      addVisibilityListener: () => ({ remove() {} }),
      getVisibilityAsync: async () => 'hidden',
      setVisibilityAsync: async () => {},
    },
    'react-native': {
      AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
      Platform: { OS: 'android' },
    },
  });
  const {
    RESUME_REHIDE_DELAYS_MS,
    STUCK_BAR_REHIDE_DELAY_MS,
    startImmersiveNavigationBarGuard,
  } = load('src/shared/services/immersiveNavigationBar.ts');

  const stop = startImmersiveNavigationBarGuard({
    isAndroid: true,
    getAppState: () => appState,
    subscribeAppState: (listener) => {
      appStateListener = listener as typeof appStateListener;
      return { remove: () => { appStateListener = null; } };
    },
    hideBar: async () => {
      hideCalls += 1;
      barVisibility = 'hidden';
    },
    getBarVisibility: async () => barVisibility,
    subscribeBarVisibility: (listener) => {
      visibilityListener = listener;
      return { remove: () => { visibilityListener = null; } };
    },
    setTimer: ((callback: () => void, delay?: number) => {
      const id = nextTimerId++;
      timers.set(id, { delay: delay ?? 0, callback });
      return id as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout,
    clearTimer: ((id: ReturnType<typeof setTimeout>) => {
      timers.delete(id as unknown as number);
    }) as typeof clearTimeout,
  });

  // Initial active mount enforces hide immediately plus the post-focus follow-up pulses.
  assert.equal(hideCalls, 1);
  assert.deepEqual(
    Array.from(timers.values()).map((entry) => entry.delay),
    Array.from(RESUME_REHIDE_DELAYS_MS),
  );

  // Minimizing cancels any pending follow-up timers without hiding in the background.
  appState = 'background';
  appStateListener?.('background');
  assert.equal(timers.size, 0);

  // Returning from Recents re-enforces native hide immediately and after focus settles.
  appState = 'active';
  appStateListener?.('active');
  assert.equal(hideCalls, 2);
  assert.equal(timers.size, RESUME_REHIDE_DELAYS_MS.length);

  for (const [id, entry] of Array.from(timers.entries())) {
    timers.delete(id);
    entry.callback();
  }
  assert.equal(hideCalls, 2 + RESUME_REHIDE_DELAYS_MS.length);

  // User swipes up: bar becomes visible -> not hidden immediately (respects swipe), only after settle window if stuck.
  const beforeSwipe = hideCalls;
  barVisibility = 'visible';
  visibilityListener?.({ visibility: 'visible' });
  assert.equal(hideCalls, beforeSwipe, 'must not immediately fight an intentional bottom-edge swipe');
  assert.equal(timers.size, 1);
  const [stuckId, stuckEntry] = Array.from(timers.entries())[0];
  assert.equal(stuckEntry.delay, STUCK_BAR_REHIDE_DELAY_MS);
  timers.delete(stuckId);
  stuckEntry.callback();
  await Promise.resolve();
  assert.equal(hideCalls, beforeSwipe + 1, 'stuck visible bar auto-hides after the settle window');

  stop();
  assert.equal(appStateListener, null);
  assert.equal(visibilityListener, null);
  assert.equal(timers.size, 0);
});

test('all screens and modals are wired to stabilized safe-area metrics and translucent system bars', async () => {
  const [
    appSource,
    errorBoundarySource,
    splashSource,
    mathInputSource,
    mathEditorSource,
    premiumSurfaceSource,
    comicButtonSource,
    lessonSource,
    roadmapModalSource,
  ] = await Promise.all([
    readFile(new URL('../../src/app/App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/app/components/AppErrorBoundary.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/app/components/LaunchSplash.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/math/screens/MathInputScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/math/components/MathEditor.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/access/components/PremiumSurface.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/shared/ui/ComicButton.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/lessons/screens/LessonScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/lessons/components/LessonRoadmapModal.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(appSource, /<StableSafeAreaProvider>/);
  assert.match(appSource, /startImmersiveNavigationBarGuard\(\)/);
  assert.doesNotMatch(errorBoundarySource, /<SafeAreaView/);
  assert.match(errorBoundarySource, /useSafeAreaInsets\(\)/);

  for (const source of [mathInputSource, mathEditorSource, premiumSurfaceSource, comicButtonSource]) {
    assert.match(source, /useSafeAreaFrame\(\)/);
    assert.match(source, /useResponsiveLayout\(frame\)/);
  }
  assert.match(splashSource, /useSafeAreaFrame\(\)/);
  assert.doesNotMatch(splashSource, /useWindowDimensions/);

  const lessonModals = lessonSource.match(/<Modal[\s\S]*?>/g) ?? [];
  assert.equal(lessonModals.length, 2);
  for (const modalTag of lessonModals) {
    assert.match(modalTag, /statusBarTranslucent/);
    assert.match(modalTag, /navigationBarTranslucent/);
  }
  assert.match(roadmapModalSource, /statusBarTranslucent/);
  assert.match(roadmapModalSource, /navigationBarTranslucent/);
  assert.doesNotMatch(roadmapModalSource, /react-native-reanimated/);
});
