import { File, Paths } from 'expo-file-system';

const saveCoachMarker = new File(Paths.document, 'save-coach-v1.seen');
const homeGuideMarker = new File(Paths.document, 'home-guide-v1.seen');
const readingScaleFile = new File(Paths.document, 'math-reading-scale-v1.txt');

export const MATH_READING_SCALES = [1, 1.14, 1.28] as const;
export type MathReadingScale = (typeof MATH_READING_SCALES)[number];

let cachedReadingScale: MathReadingScale | undefined;

export function nextMathReadingScale(current: MathReadingScale): MathReadingScale {
  const index = MATH_READING_SCALES.indexOf(current);
  return MATH_READING_SCALES[(index + 1) % MATH_READING_SCALES.length];
}

export function mathReadingScaleBadge(scale: MathReadingScale): string {
  if (scale >= 1.25) return 'A++';
  if (scale >= 1.1) return 'A+';
  return 'Aa';
}

export function getMathReadingScale(): MathReadingScale {
  if (cachedReadingScale !== undefined) return cachedReadingScale;
  try {
    if (readingScaleFile.exists) {
      const parsed = Number(readingScaleFile.textSync().trim());
      if (MATH_READING_SCALES.includes(parsed as MathReadingScale)) {
        cachedReadingScale = parsed as MathReadingScale;
        return cachedReadingScale;
      }
    }
  } catch {
    // Fall back to default scale when local storage is unavailable.
  }
  cachedReadingScale = 1;
  return 1;
}

export function setMathReadingScale(scale: MathReadingScale): void {
  cachedReadingScale = scale;
  try {
    if (!readingScaleFile.exists) readingScaleFile.create({ intermediates: true });
    readingScaleFile.write(String(scale));
  } catch {
    // Reading zoom still works for the active session even if disk write fails.
  }
}

export function hasSeenSaveCoach(): boolean {
  try {
    return saveCoachMarker.exists;
  } catch {
    return false;
  }
}

export function markSaveCoachSeen(): void {
  try {
    if (!saveCoachMarker.exists) saveCoachMarker.create({ intermediates: true });
    saveCoachMarker.write('seen');
  } catch {
    // The hint remains non-critical if local persistence is unavailable.
  }
}

export function hasSeenHomeGuide(): boolean {
  try {
    return homeGuideMarker.exists;
  } catch {
    return false;
  }
}

export function markHomeGuideSeen(): void {
  try {
    if (!homeGuideMarker.exists) homeGuideMarker.create({ intermediates: true });
    homeGuideMarker.write('seen');
  } catch {
    // The first-launch guide remains non-critical if local persistence is unavailable.
  }
}

export function clearLocalPreferences(): void {
  cachedReadingScale = 1;
  try {
    if (saveCoachMarker.exists) saveCoachMarker.delete();
    if (homeGuideMarker.exists) homeGuideMarker.delete();
    if (readingScaleFile.exists) readingScaleFile.delete();
  } catch {
    // Local preference cleanup will be retried on the next deletion request.
  }
}
