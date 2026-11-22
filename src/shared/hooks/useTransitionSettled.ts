import { useEffect, useState } from 'react';

type TransitionNavigation = {
  addListener?: (
    event: 'transitionEnd',
    callback: (event: { data: { closing: boolean } }) => void,
  ) => () => void;
};

/**
 * Returns `false` while the native stack push transition is sliding in, then
 * flips to `true` once `transitionEnd` fires (with a bounded fallback).
 * Keeping ambient loops, layout animations and background network calls paused
 * until `transitionEnd` lets the full screen glide in cleanly and then wake up
 * its living motion sequentially without overlapping animations.
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
