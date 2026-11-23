import { useEffect, useState, type ReactNode } from 'react';

export type TransitionMotionValue = {
  /** True while any native stack push, pop, or modal slide is actively in flight. */
  isTransitioning: boolean;
  /** Call immediately when initiating navigation or on native transitionStart. */
  beginTransition: () => void;
  /** Call on native transitionEnd to release motion on the settled destination screen. */
  endTransition: () => void;
};

/**
 * Maximum time a transition lock can stay active if a screen uses `animation: 'none'`,
 * replaces synchronously, or Android skips a transitionEnd callback.
 */
const TRANSITION_WATCHDOG_MS = 380;

type Listener = () => void;

let activeTransition = false;
let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function emitTransitionState() {
  listeners.forEach((listener) => listener());
}

function clearTransitionWatchdog() {
  if (watchdogTimer) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
}

export function endAppTransition(): void {
  clearTransitionWatchdog();
  if (!activeTransition) return;
  activeTransition = false;
  emitTransitionState();
}

export function beginAppTransition(): void {
  clearTransitionWatchdog();
  if (!activeTransition) {
    activeTransition = true;
    emitTransitionState();
  }
  watchdogTimer = setTimeout(() => {
    watchdogTimer = null;
    if (!activeTransition) return;
    activeTransition = false;
    emitTransitionState();
  }, TRANSITION_WATCHDOG_MS);
}

/**
 * App-wide transition coordinator boundary mounted around the root navigator.
 *
 * Golden rule:
 * 1. The moment a transition starts (tap or native `transitionStart`), `isTransitioning`
 *    becomes `true`, pausing animations on BOTH the outgoing and incoming screens.
 * 2. The moment native `transitionEnd` finishes, `isTransitioning` flips back to `false`,
 *    allowing ONLY the newly focused destination screen to wake its animations and
 *    deferred heavy surfaces (such as WebViews).
 */
export function TransitionMotionProvider({ children }: { children: ReactNode }) {
  useEffect(() => () => {
    endAppTransition();
  }, []);

  return <>{children}</>;
}

export function useTransitionMotion(): TransitionMotionValue {
  const [isTransitioning, setIsTransitioning] = useState(activeTransition);

  useEffect(() => {
    const sync = () => setIsTransitioning(activeTransition);
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);

  return {
    isTransitioning,
    beginTransition: beginAppTransition,
    endTransition: endAppTransition,
  };
}
