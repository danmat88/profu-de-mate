import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  computeQuotaResetSnapshot,
  nextCountdownTickDelayMs,
  parseResetTimestamp,
  type QuotaResetSnapshot,
} from '../utils/quotaResetCountdown';

/**
 * Drift-free, battery-smart countdown hook anchored to the server's `resetAt`
 * timestamp. Pauses automatically while backgrounded or inactive (e.g. when a
 * screen is blurred in the navigation stack) and snaps immediately to the exact
 * wall-clock remaining duration on return.
 */
export function useQuotaResetCountdown(
  resetAt: string | null | undefined,
  active = true,
): QuotaResetSnapshot | null {
  const resetAtMs = parseResetTimestamp(resetAt);
  const [foreground, setForeground] = useState(() => AppState.currentState === 'active');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const isForeground = nextState === 'active';
      setForeground(isForeground);
      if (isForeground) setNow(Date.now());
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!active || !foreground || resetAtMs === null) return undefined;
    const current = Date.now();
    setNow(current);

    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = (timestamp: number) => {
      const delay = nextCountdownTickDelayMs(resetAtMs, timestamp);
      if (delay === null) return;
      timer = setTimeout(() => {
        const tickNow = Date.now();
        setNow(tickNow);
        schedule(tickNow);
      }, delay);
    };

    schedule(current);
    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, [active, foreground, resetAtMs]);

  if (resetAtMs === null) return null;
  return computeQuotaResetSnapshot(resetAtMs, now);
}
