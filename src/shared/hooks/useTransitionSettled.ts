import { useEffect, useState } from 'react';
import { useTransitionMotion } from '../context/TransitionMotionContext';

type TransitionEvent = {
  data?: Readonly<{ closing?: boolean }>;
};

type TransitionNavigation = {
  isFocused?: () => boolean;
  addListener?: {
    (event: 'transitionStart', callback: (event: TransitionEvent) => void): () => void;
    (event: 'transitionEnd', callback: (event: TransitionEvent) => void): () => void;
    (event: 'focus', callback: () => void): () => void;
    (event: 'blur', callback: () => void): () => void;
    (event: 'beforeRemove', callback: () => void): () => void;
  };
};

/**
 * Returns `false` while the native stack push transition is sliding in, then
 * flips to `true` once `transitionEnd` fires (with a bounded fallback).
 * Keeping ambient loops, layout animations, WebView mounts and background calls
 * paused until `transitionEnd` lets the screen glide in at a locked 60fps.
 */
export function useTransitionSettled(
  navigation: TransitionNavigation | undefined,
  reducedMotion: boolean,
  fallbackMs = 300,
): boolean {
  const [settled, setSettled] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setSettled(true);
      return undefined;
    }
    let done = false;
    let fallback: ReturnType<typeof setTimeout> | null = null;
    const clearFallback = () => {
      if (fallback) {
        clearTimeout(fallback);
        fallback = null;
      }
    };
    const markSettled = () => {
      if (done) return;
      done = true;
      clearFallback();
      setSettled(true);
    };
    const armFallback = (delayMs: number) => {
      clearFallback();
      fallback = setTimeout(markSettled, delayMs);
    };

    const unsubscribeStart = navigation?.addListener?.('transitionStart', (event) => {
      if (!done && !event.data?.closing) {
        armFallback(fallbackMs + 120);
      }
    });
    const unsubscribeEnd = navigation?.addListener?.('transitionEnd', (event) => {
      if (!event.data?.closing) markSettled();
    });
    armFallback(fallbackMs);

    return () => {
      done = true;
      clearFallback();
      unsubscribeStart?.();
      unsubscribeEnd?.();
    };
  }, [fallbackMs, navigation, reducedMotion]);

  return settled;
}

type ScreenMotionOptions = {
  /** Set true for the initial root screen (Home) that never slides in on launch. */
  initiallySettled?: boolean;
  /** Safety timeout if Android skips a transitionEnd callback. */
  fallbackMs?: number;
};

/**
 * Returns `true` ONLY when this screen is focused, has finished sliding in, AND
 * no stack transition is currently running anywhere in the navigator.
 *
 * Immediately flips to `false` on `transitionStart`, `blur`, `beforeRemove`, or
 * `beginTransition()` so outgoing and incoming screens pause all animations
 * while a native screen transition is in flight.
 */
export function useScreenMotionActive(
  navigation: TransitionNavigation | undefined,
  reducedMotion: boolean,
  options?: ScreenMotionOptions,
): boolean {
  const initiallySettled = options?.initiallySettled ?? false;
  const fallbackMs = options?.fallbackMs ?? 300;
  const [focused, setFocused] = useState(() => navigation?.isFocused?.() ?? true);
  // Subscribe to global transitions ONLY while this screen is focused so covered
  // stack screens never re-render when deeper screens navigate.
  const { isTransitioning } = useTransitionMotion(focused && !reducedMotion);
  const pushedSettled = useTransitionSettled(navigation, reducedMotion || initiallySettled, fallbackMs);
  const [localTransitioning, setLocalTransitioning] = useState(false);

  useEffect(() => {
    if (!navigation?.addListener) return undefined;
    let localWatchdog: ReturnType<typeof setTimeout> | null = null;
    const clearLocalWatchdog = () => {
      if (localWatchdog) {
        clearTimeout(localWatchdog);
        localWatchdog = null;
      }
    };
    const startLocal = () => {
      if (reducedMotion) return;
      setLocalTransitioning(true);
      clearLocalWatchdog();
      localWatchdog = setTimeout(() => {
        localWatchdog = null;
        setLocalTransitioning(false);
      }, fallbackMs + 120);
    };
    const endLocal = () => {
      clearLocalWatchdog();
      setLocalTransitioning(false);
    };

    const unsubFocus = navigation.addListener('focus', () => setFocused(true));
    const unsubBlur = navigation.addListener('blur', () => {
      setFocused(false);
      endLocal();
    });
    const unsubBeforeRemove = navigation.addListener('beforeRemove', () => {
      setFocused(false);
      startLocal();
    });
    const unsubStart = navigation.addListener('transitionStart', () => {
      startLocal();
    });
    const unsubEnd = navigation.addListener('transitionEnd', () => {
      endLocal();
    });

    return () => {
      clearLocalWatchdog();
      unsubFocus?.();
      unsubBlur?.();
      unsubBeforeRemove?.();
      unsubStart?.();
      unsubEnd?.();
    };
  }, [fallbackMs, navigation, reducedMotion]);

  if (reducedMotion) return focused;
  return focused && pushedSettled && !isTransitioning && !localTransitioning;
}
