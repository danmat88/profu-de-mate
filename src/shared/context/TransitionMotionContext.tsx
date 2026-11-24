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
const TRANSITION_WATCHDOG_MS = 560;

type Listener = () => void;

let activeTransition = false;
let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
let pendingEmitFrame: number | null = null;
const listeners = new Set<Listener>();

function emitTransitionState() {
  listeners.forEach((listener) => listener());
}

function cancelPendingEmit() {
  if (pendingEmitFrame !== null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(pendingEmitFrame);
    pendingEmitFrame = null;
  }
}

function scheduleEmitTransitionState() {
  if (typeof requestAnimationFrame !== 'function') {
    emitTransitionState();
    return;
  }
  if (pendingEmitFrame !== null) return;
  pendingEmitFrame = requestAnimationFrame(() => {
    pendingEmitFrame = null;
    emitTransitionState();
  });
}

function clearTransitionWatchdog() {
  if (watchdogTimer) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
}

export function endAppTransition(): void {
  clearTransitionWatchdog();
  cancelPendingEmit();
  if (!activeTransition) return;
  activeTransition = false;
  scheduleEmitTransitionState();
}

export function beginAppTransition(): void {
  clearTransitionWatchdog();
  if (!activeTransition) {
    activeTransition = true;
    // Defer notifying subscribed screens to the next animation frame so an
    // incoming navigation.navigate() commits immediately with zero wasted
    // synchronous re-renders of the outgoing screen on the tap frame.
    scheduleEmitTransitionState();
  }
  watchdogTimer = setTimeout(() => {
    watchdogTimer = null;
    if (!activeTransition) return;
    activeTransition = false;
    scheduleEmitTransitionState();
  }, TRANSITION_WATCHDOG_MS);
}

/**
 * App-wide transition coordinator boundary mounted around the root navigator.
 *
 * Golden rule:
 * 1. The moment a transition starts (tap or native transitionStart), isTransitioning
 *    becomes true, pausing animations on BOTH the outgoing and incoming screens.
 * 2. The moment native transitionEnd finishes, isTransitioning flips back to false,
 *    allowing ONLY the newly focused destination screen to wake its animations and
 *    deferred heavy surfaces (such as WebViews).
 *
 * Callers that only trigger transitions should call beginAppTransition / endAppTransition
 * directly instead of subscribing via this hook, keeping the root navigator and
 * unfocused screens completely free of transition re-renders.
 */
export function TransitionMotionProvider({ children }: { children: ReactNode }) {
  useEffect(() => () => {
    endAppTransition();
  }, []);

  return <>{children}</>;
}

export function useTransitionMotion(enabled = true): TransitionMotionValue {
  const [isTransitioning, setIsTransitioning] = useState(() => (enabled ? activeTransition : false));

  useEffect(() => {
    if (!enabled) {
      setIsTransitioning(false);
      return undefined;
    }
    const sync = () => setIsTransitioning(activeTransition);
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, [enabled]);

  return {
    isTransitioning,
    beginTransition: beginAppTransition,
    endTransition: endAppTransition,
  };
}
