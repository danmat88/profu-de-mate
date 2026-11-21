import { File, Paths } from 'expo-file-system';

const saveCoachMarker = new File(Paths.document, 'save-coach-v1.seen');
const homeGuideMarker = new File(Paths.document, 'home-guide-v1.seen');

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
  try {
    if (saveCoachMarker.exists) saveCoachMarker.delete();
    if (homeGuideMarker.exists) homeGuideMarker.delete();
  } catch {
    // Local preference cleanup will be retried on the next deletion request.
  }
}
