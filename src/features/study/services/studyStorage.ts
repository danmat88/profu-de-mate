import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { STUDY_TRACKS, type StudyTrackId } from '../types';

export type StudyProfile = {
  track: StudyTrackId;
  hasChosenTrack: boolean;
  favoriteFormulaIds: readonly string[];
  recentFormulaIds: readonly string[];
  exploredFormulaIds: readonly string[];
};

const VALID_TRACK_IDS = new Set<string>(STUDY_TRACKS.map((item) => item.id));
const MAX_RECENT_FORMULAS = 6;
const MAX_EXPLORED_FORMULAS = 120;

const DEFAULT_STUDY_PROFILE: StudyProfile = {
  track: 'en',
  hasChosenTrack: false,
  favoriteFormulaIds: [],
  recentFormulaIds: [],
  exploredFormulaIds: [],
};

const profileFile = new File(Paths.document, 'study-profile-v1.json');

let cachedProfile: StudyProfile | null = null;
const listeners = new Set<() => void>();

function sanitizeIdList(value: unknown, limit: number): readonly string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    cleaned.push(trimmed);
    if (cleaned.length >= limit) break;
  }
  return cleaned;
}

function readFromDisk(): StudyProfile {
  try {
    if (!profileFile.exists) return DEFAULT_STUDY_PROFILE;
    const parsed = JSON.parse(profileFile.textSync()) as Partial<Record<keyof StudyProfile, unknown>>;
    const rawTrack = typeof parsed.track === 'string' && VALID_TRACK_IDS.has(parsed.track)
      ? (parsed.track as StudyTrackId)
      : DEFAULT_STUDY_PROFILE.track;
    return {
      track: rawTrack,
      hasChosenTrack: parsed.hasChosenTrack === true,
      favoriteFormulaIds: sanitizeIdList(parsed.favoriteFormulaIds, 100),
      recentFormulaIds: sanitizeIdList(parsed.recentFormulaIds, MAX_RECENT_FORMULAS),
      exploredFormulaIds: sanitizeIdList(parsed.exploredFormulaIds, MAX_EXPLORED_FORMULAS),
    };
  } catch {
    return DEFAULT_STUDY_PROFILE;
  }
}

function writeToDisk(profile: StudyProfile): void {
  try {
    if (!profileFile.exists) profileFile.create({ intermediates: true });
    profileFile.write(JSON.stringify(profile));
  } catch {
    // Keep the in-memory profile active even if local storage cannot be written.
  }
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function commit(next: StudyProfile): StudyProfile {
  cachedProfile = next;
  writeToDisk(next);
  emit();
  return next;
}

export function getStudyProfile(): StudyProfile {
  if (!cachedProfile) {
    cachedProfile = readFromDisk();
  }
  return cachedProfile;
}

export function subscribeStudyProfile(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useStudyProfile(): StudyProfile {
  return useSyncExternalStore(subscribeStudyProfile, getStudyProfile, getStudyProfile);
}

export function setStudyTrack(track: StudyTrackId): StudyProfile {
  const current = getStudyProfile();
  if (current.track === track && current.hasChosenTrack) return current;
  return commit({
    ...current,
    track,
    hasChosenTrack: true,
  });
}

export function isFormulaFavorite(formulaId: string): boolean {
  return getStudyProfile().favoriteFormulaIds.includes(formulaId);
}

export function toggleFavoriteFormula(formulaId: string): boolean {
  const current = getStudyProfile();
  const exists = current.favoriteFormulaIds.includes(formulaId);
  const nextFavorites = exists
    ? current.favoriteFormulaIds.filter((id) => id !== formulaId)
    : [formulaId, ...current.favoriteFormulaIds];
  commit({
    ...current,
    favoriteFormulaIds: nextFavorites,
  });
  return !exists;
}

export function recordFormulaViewed(formulaId: string): void {
  const current = getStudyProfile();
  const alreadyLatest = current.recentFormulaIds[0] === formulaId;
  const alreadyExplored = current.exploredFormulaIds.includes(formulaId);
  if (alreadyLatest && alreadyExplored) return;

  const nextRecent = [
    formulaId,
    ...current.recentFormulaIds.filter((id) => id !== formulaId),
  ].slice(0, MAX_RECENT_FORMULAS);
  const nextExplored = alreadyExplored
    ? current.exploredFormulaIds
    : [...current.exploredFormulaIds, formulaId].slice(-MAX_EXPLORED_FORMULAS);

  commit({
    ...current,
    recentFormulaIds: nextRecent,
    exploredFormulaIds: nextExplored,
  });
}

export function mergeRemoteStudyProfile(remote: {
  track?: StudyTrackId;
  hasChosenTrack?: boolean;
  favoriteFormulaIds?: readonly string[];
  exploredFormulaIds?: readonly string[];
}): StudyProfile {
  const current = getStudyProfile();
  const nextFavorites = sanitizeIdList(
    [...current.favoriteFormulaIds, ...(remote.favoriteFormulaIds ?? [])],
    100,
  );
  const nextExplored = sanitizeIdList(
    [...current.exploredFormulaIds, ...(remote.exploredFormulaIds ?? [])],
    MAX_EXPLORED_FORMULAS,
  );
  const nextTrack = !current.hasChosenTrack && remote.track && VALID_TRACK_IDS.has(remote.track)
    ? remote.track
    : current.track;
  const nextChosen = current.hasChosenTrack || remote.hasChosenTrack === true;

  if (
    nextTrack === current.track
    && nextChosen === current.hasChosenTrack
    && nextFavorites.length === current.favoriteFormulaIds.length
    && nextExplored.length === current.exploredFormulaIds.length
  ) {
    return current;
  }

  return commit({
    ...current,
    track: nextTrack,
    hasChosenTrack: nextChosen,
    favoriteFormulaIds: nextFavorites,
    exploredFormulaIds: nextExplored,
  });
}

export function clearStudyLocalState(): void {
  cachedProfile = DEFAULT_STUDY_PROFILE;
  try {
    if (profileFile.exists) profileFile.delete();
  } catch {
    // Cleanup will be retried on the next deletion request.
  }
  emit();
}
