import { useEffect, useState } from 'react';

type TransitionNavigation = {
  addListener?: (
    event: 'transitionEnd',
    callback: (event: { data: { closing: boolean } }) => void,
  ) => () => void;
};

/**
 * Returns `false` while the native stack push transition is animating in, then
 * flips to `true` as soon as `transitionEnd` fires (with a bounded fallback).
 * Keeping Frame 0 to the lightweight above-the-fold view ensures Android starts
 * the native slide immediately with zero freeze and zero empty void.
 */
export function useTransitionSettled(
  navigation: TransitionNavigation | undefined,
  reducedMotion: boolean,
  fallbackMs = 260,
): boolean {
  const [settled, setSettled] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setSettled(true);
      return undefined;
    }
    let done = false;
    const markSettled = () => {
      if (done) return;
      done = true;
      setSettled(true);
    };
    const unsubscribe = navigation?.addListener?.('transitionEnd', (event) => {
      if (!event.data.closing) markSettled();
    });
    const fallback = setTimeout(markSettled, fallbackMs);
    return () => {
      done = true;
      clearTimeout(fallback);
      unsubscribe?.();
    };
  }, [fallbackMs, navigation, reducedMotion]);

  return settled;
}

/**
 * Coordinates the 3-step sequential screen choreography:
 * 1. Native slide (`contentReady === false`): rich above-the-fold first paint glides in smoothly.
 * 2. Staggered reveal (`contentReady === true, ambientReady === false`): lower cards and controls pop in one by one.
 * 3. Living ambient (`ambientReady === true`): mascot float, live timers, layout springs and background sync wake up.
 */
export function useTransitionPhases(
  navigation: TransitionNavigation | undefined,
  reducedMotion: boolean,
  options: { fallbackMs?: number; ambientDelayMs?: number } = {},
): { contentReady: boolean; ambientReady: boolean } {
  const fallbackMs = options.fallbackMs ?? 260;
  const ambientDelayMs = options.ambientDelayMs ?? 240;
  const contentReady = useTransitionSettled(navigation, reducedMotion, fallbackMs);
  const [ambientReady, setAmbientReady] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setAmbientReady(true);
      return undefined;
    }
    if (!contentReady) {
      setAmbientReady(false);
      return undefined;
    }
    const timer = setTimeout(() => setAmbientReady(true), ambientDelayMs);
    return () => clearTimeout(timer);
  }, [ambientDelayMs, contentReady, reducedMotion]);

  return { contentReady, ambientReady };
}
