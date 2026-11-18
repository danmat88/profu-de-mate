import { File, Paths } from 'expo-file-system';

const saveCoachMarker = new File(Paths.document, 'save-coach-v1.seen');

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

export function clearLocalPreferences(): void {
  try {
    if (saveCoachMarker.exists) saveCoachMarker.delete();
  } catch {
    // Local preference cleanup will be retried on the next deletion request.
  }
}
