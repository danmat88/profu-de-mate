import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

let reducedMotion = false;
let subscription: ReturnType<typeof AccessibilityInfo.addEventListener> | undefined;
let generation = 0;
const listeners = new Set<() => void>();

function update(enabled: boolean) {
  if (enabled === reducedMotion) return;
  reducedMotion = enabled;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!subscription) {
    const current = ++generation;
    subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => { if (current === generation) update(enabled); })
      .catch(() => undefined);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) { subscription?.remove(); subscription = undefined; generation += 1; }
  };
}

const snapshot = () => reducedMotion;

/** One cached native accessibility preference shared by every screen and control. */
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
