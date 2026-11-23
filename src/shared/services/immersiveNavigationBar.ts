import { addVisibilityListener, getVisibilityAsync, setVisibilityAsync } from 'expo-navigation-bar';
import { AppState, Platform, type AppStateStatus } from 'react-native';

/**
 * Follow-up delays after Android AppState returns to active so we catch both
 * immediate Activity.onResume and post-Recents onWindowFocusChanged restoration.
 */
export const RESUME_REHIDE_DELAYS_MS = [180, 480] as const;

/**
 * Gentle settle window after an unexpected visibility event so intentional user
 * bottom-edge swipes to press Back or Home are never interrupted, while stuck
 * OEM bars still auto-hide cleanly.
 */
export const STUCK_BAR_REHIDE_DELAY_MS = 2_800;

export type ImmersiveBarControllerDeps = {
  isAndroid: boolean;
  getAppState: () => AppStateStatus;
  subscribeAppState: (listener: (state: AppStateStatus) => void) => { remove: () => void };
  hideBar: () => Promise<void>;
  getBarVisibility: () => Promise<'visible' | 'hidden'>;
  subscribeBarVisibility: (
    listener: (event: { visibility: 'visible' | 'hidden' }) => void,
  ) => { remove: () => void };
  setTimer: typeof setTimeout;
  clearTimer: typeof clearTimeout;
};

/**
 * Re-enforces Android hidden navigation bar mode across minimize/resume cycles.
 * expo-navigation-bar only hides the bar in Activity.onCreate and caches the
 * JS hidden prop, so returning from Recents or external pickers leaves the
 * system bar visible unless native hide is explicitly re-invoked.
 */
export function startImmersiveNavigationBarGuard(
  overrides: Partial<ImmersiveBarControllerDeps> = {},
): () => void {
  const deps: ImmersiveBarControllerDeps = {
    isAndroid: Platform.OS === 'android',
    getAppState: () => AppState.currentState,
    subscribeAppState: (listener) => AppState.addEventListener('change', listener),
    hideBar: () => setVisibilityAsync('hidden'),
    getBarVisibility: () => getVisibilityAsync(),
    subscribeBarVisibility: (listener) => addVisibilityListener(listener),
    setTimer: setTimeout,
    clearTimer: clearTimeout,
    ...overrides,
  };

  if (!deps.isAndroid) {
    return () => {};
  }

  let disposed = false;
  const resumeTimers = new Set<ReturnType<typeof setTimeout>>();
  let stuckBarTimer: ReturnType<typeof setTimeout> | null = null;

  const clearResumeTimers = () => {
    for (const timer of resumeTimers) {
      deps.clearTimer(timer);
    }
    resumeTimers.clear();
  };

  const clearStuckBarTimer = () => {
    if (stuckBarTimer !== null) {
      deps.clearTimer(stuckBarTimer);
      stuckBarTimer = null;
    }
  };

  const invokeHide = () => {
    if (disposed || deps.getAppState() !== 'active') return;
    void deps.hideBar().catch(() => undefined);
  };

  const enforceAfterResume = () => {
    clearResumeTimers();
    clearStuckBarTimer();
    invokeHide();
    for (const delay of RESUME_REHIDE_DELAYS_MS) {
      const timer = deps.setTimer(() => {
        resumeTimers.delete(timer);
        invokeHide();
      }, delay);
      resumeTimers.add(timer);
    }
  };

  let previousState = deps.getAppState();
  if (previousState === 'active') {
    enforceAfterResume();
  }

  const appStateSub = deps.subscribeAppState((nextState) => {
    const returningToActive = previousState !== 'active' && nextState === 'active';
    previousState = nextState;
    if (nextState !== 'active') {
      clearResumeTimers();
      clearStuckBarTimer();
      return;
    }
    if (returningToActive) {
      enforceAfterResume();
    }
  });

  let visibilitySub: { remove: () => void } | null = null;
  try {
    visibilitySub = deps.subscribeBarVisibility(({ visibility }) => {
      clearStuckBarTimer();
      if (disposed || visibility !== 'visible' || deps.getAppState() !== 'active') {
        return;
      }
      stuckBarTimer = deps.setTimer(() => {
        stuckBarTimer = null;
        if (disposed || deps.getAppState() !== 'active') return;
        void deps.getBarVisibility()
          .then((current) => {
            if (!disposed && current === 'visible' && deps.getAppState() === 'active') {
              invokeHide();
            }
          })
          .catch(() => undefined);
      }, STUCK_BAR_REHIDE_DELAY_MS);
    });
  } catch {
    visibilitySub = null;
  }

  return () => {
    disposed = true;
    clearResumeTimers();
    clearStuckBarTimer();
    appStateSub.remove();
    visibilitySub?.remove();
  };
}
