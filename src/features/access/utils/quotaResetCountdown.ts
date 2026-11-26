const DAY_MS = 24 * 60 * 60 * 1000;

export type QuotaResetSnapshot = {
  remainingMs: number;
  expired: boolean;
  hours: number;
  minutes: number;
  seconds: number;
  hoursText: string;
  minutesText: string;
  secondsText: string;
  compactClock: string;
  shortLabel: string;
  /** Fraction (0.04..1) of the 24-hour cycle elapsed toward the next reset. */
  dayProgress: number;
  accessibleDuration: string;
};

function pad2(value: number): string {
  return String(Math.max(0, value)).padStart(2, '0');
}

function pluralizeRo(count: number, singular: string, plural: string): string {
  if (count === 1) return `1 ${singular}`;
  const rem100 = count % 100;
  return count >= 20 && (rem100 === 0 || rem100 >= 20)
    ? `${count} de ${plural}`
    : `${count} ${plural}`;
}

/**
 * Safely parses an authoritative server ISO reset timestamp (`access.resetAt`).
 * Returns `null` when absent or malformed so callers fail closed without NaN.
 */
export function parseResetTimestamp(resetAt: string | null | undefined): number | null {
  if (typeof resetAt !== 'string' || resetAt.trim().length === 0) return null;
  const parsed = Date.parse(resetAt);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Computes a deterministic, DST-safe countdown snapshot to the exact server
 * `resetAt` boundary (e.g., midnight `Europe/Bucharest`). Uses `Math.ceil` on
 * positive milliseconds so `00:00:01` holds for its full last second and
 * transitions cleanly to `00:00:00` (`expired: true`) at the real boundary.
 */
export function computeQuotaResetSnapshot(resetAtMs: number, now: number): QuotaResetSnapshot {
  const remainingMs = Math.max(0, resetAtMs - now);
  const expired = remainingMs <= 0;
  const totalSeconds = expired ? 0 : Math.ceil(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hoursText = pad2(hours);
  const minutesText = pad2(minutes);
  const secondsText = pad2(seconds);
  const compactClock = `${hoursText}:${minutesText}:${secondsText}`;

  const shortLabel = expired
    ? 'Acum'
    : hours > 0
      ? `${hours}h ${minutesText}m`
      : minutes > 0
        ? `${minutes}m ${secondsText}s`
        : `${seconds}s`;

  const rawProgress = 1 - remainingMs / DAY_MS;
  const dayProgress = expired ? 1 : Math.max(0.04, Math.min(1, rawProgress));

  const accessibleDuration = expired
    ? 'chiar acum'
    : hours > 0 && minutes > 0
      ? `${pluralizeRo(hours, 'oră', 'ore')} și ${pluralizeRo(minutes, 'minut', 'minute')}`
      : hours > 0
        ? pluralizeRo(hours, 'oră', 'ore')
        : minutes > 0
          ? pluralizeRo(minutes, 'minut', 'minute')
          : 'mai puțin de un minut';

  return {
    remainingMs,
    expired,
    hours,
    minutes,
    seconds,
    hoursText,
    minutesText,
    secondsText,
    compactClock,
    shortLabel,
    dayProgress,
    accessibleDuration,
  };
}

/**
 * Computes the exact delay in ms until the next displayed second flips so
 * timers stay aligned to wall-clock second boundaries with zero drift.
 */
export function nextCountdownTickDelayMs(resetAtMs: number, now: number): number | null {
  const remainingMs = resetAtMs - now;
  if (remainingMs <= 0) return null;
  const remainder = remainingMs % 1000;
  return (remainder === 0 ? 1000 : remainder) + 20;
}
