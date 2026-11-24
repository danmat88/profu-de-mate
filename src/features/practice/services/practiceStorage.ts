import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import type { PracticeSessionRecord } from '../types';
import {
  computeNextStreak,
  getLocalDateKey,
  isStreakActiveTodayOrYesterday,
} from '../utils/practiceEngine';

export type PracticeState = {
  wrongQuestionIds: readonly string[];
  masteredQuestionIds: readonly string[];
  streakDays: number;
  lastPracticeDateKey: string | null;
  sessionsCompleted: number;
  totalAnswered: number;
  totalCorrect: number;
  recentSessions: readonly PracticeSessionRecord[];
};

const MAX_RECENT_SESSIONS = 12;

const DEFAULT_PRACTICE_STATE: PracticeState = {
  wrongQuestionIds: [],
  masteredQuestionIds: [],
  streakDays: 0,
  lastPracticeDateKey: null,
  sessionsCompleted: 0,
  totalAnswered: 0,
  totalCorrect: 0,
  recentSessions: [],
};

const practiceFile = new File(Paths.document, 'study-practice-v1.json');

let cachedState: PracticeState | null = null;
const listeners = new Set<() => void>();

function sanitizeStringList(value: unknown, limit: number): readonly string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    output.push(trimmed);
    if (output.length >= limit) break;
  }
  return output;
}

function sanitizeSessions(value: unknown): readonly PracticeSessionRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is PracticeSessionRecord => (
      Boolean(entry)
      && typeof entry === 'object'
      && typeof (entry as PracticeSessionRecord).id === 'string'
      && typeof (entry as PracticeSessionRecord).correctCount === 'number'
      && typeof (entry as PracticeSessionRecord).totalCount === 'number'
    ))
    .slice(0, MAX_RECENT_SESSIONS);
}

function readFromDisk(): PracticeState {
  try {
    if (!practiceFile.exists) return DEFAULT_PRACTICE_STATE;
    const parsed = JSON.parse(practiceFile.textSync()) as Partial<PracticeState>;
    const lastPracticeDateKey = typeof parsed.lastPracticeDateKey === 'string'
      ? parsed.lastPracticeDateKey
      : null;
    const rawStreak = typeof parsed.streakDays === 'number' && Number.isFinite(parsed.streakDays)
      ? Math.max(0, Math.floor(parsed.streakDays))
      : 0;
    return {
      wrongQuestionIds: sanitizeStringList(parsed.wrongQuestionIds, 120),
      masteredQuestionIds: sanitizeStringList(parsed.masteredQuestionIds, 250),
      streakDays: rawStreak,
      lastPracticeDateKey,
      sessionsCompleted: typeof parsed.sessionsCompleted === 'number' ? Math.max(0, Math.floor(parsed.sessionsCompleted)) : 0,
      totalAnswered: typeof parsed.totalAnswered === 'number' ? Math.max(0, Math.floor(parsed.totalAnswered)) : 0,
      totalCorrect: typeof parsed.totalCorrect === 'number' ? Math.max(0, Math.floor(parsed.totalCorrect)) : 0,
      recentSessions: sanitizeSessions(parsed.recentSessions),
    };
  } catch {
    return DEFAULT_PRACTICE_STATE;
  }
}

function writeToDisk(state: PracticeState): void {
  try {
    if (!practiceFile.exists) practiceFile.create({ intermediates: true });
    practiceFile.write(JSON.stringify(state));
  } catch {
    // Keep in-memory practice state active even if disk write fails.
  }
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function commit(next: PracticeState): PracticeState {
  cachedState = next;
  writeToDisk(next);
  emit();
  return next;
}

export function getPracticeState(): PracticeState {
  if (!cachedState) {
    cachedState = readFromDisk();
  }
  return cachedState;
}

export function subscribePracticeState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePracticeState(): PracticeState {
  return useSyncExternalStore(subscribePracticeState, getPracticeState, getPracticeState);
}

export function getActiveStreakDays(state: PracticeState, todayKey = getLocalDateKey()): number {
  if (state.streakDays <= 0) return 0;
  return isStreakActiveTodayOrYesterday(state.lastPracticeDateKey, todayKey) ? state.streakDays : 0;
}

export function recordPracticeAnswer(
  questionId: string,
  correct: boolean,
  isCurated = true,
): PracticeState {
  const current = getPracticeState();
  const nextWrong = !isCurated
    ? current.wrongQuestionIds
    : correct
      ? current.wrongQuestionIds.filter((id) => id !== questionId)
      : [questionId, ...current.wrongQuestionIds.filter((id) => id !== questionId)];
  const nextMastered = !isCurated || !correct
    ? current.masteredQuestionIds
    : current.masteredQuestionIds.includes(questionId)
      ? current.masteredQuestionIds
      : [...current.masteredQuestionIds, questionId];

  const streak = computeNextStreak(current.streakDays, current.lastPracticeDateKey, getLocalDateKey());

  return commit({
    ...current,
    wrongQuestionIds: nextWrong,
    masteredQuestionIds: nextMastered,
    streakDays: streak.streakDays,
    lastPracticeDateKey: streak.lastPracticeDateKey,
    totalAnswered: current.totalAnswered + 1,
    totalCorrect: current.totalCorrect + (correct ? 1 : 0),
  });
}

export function recordCompletedPracticeSession(record: PracticeSessionRecord): PracticeState {
  const current = getPracticeState();
  const streak = computeNextStreak(current.streakDays, current.lastPracticeDateKey, getLocalDateKey());
  return commit({
    ...current,
    streakDays: streak.streakDays,
    lastPracticeDateKey: streak.lastPracticeDateKey,
    sessionsCompleted: current.sessionsCompleted + 1,
    recentSessions: [record, ...current.recentSessions].slice(0, MAX_RECENT_SESSIONS),
  });
}

export function removeWrongQuestion(questionId: string): PracticeState {
  const current = getPracticeState();
  if (!current.wrongQuestionIds.includes(questionId)) return current;
  return commit({
    ...current,
    wrongQuestionIds: current.wrongQuestionIds.filter((id) => id !== questionId),
  });
}

export function mergeRemotePracticeState(remote: {
  masteredQuestionIds?: readonly string[];
  wrongQuestionIds?: readonly string[];
  streakDays?: number;
  lastPracticeDateKey?: string | null;
  sessionsCompleted?: number;
  totalAnswered?: number;
  totalCorrect?: number;
}): PracticeState {
  const current = getPracticeState();
  const nextMastered = sanitizeStringList(
    [...current.masteredQuestionIds, ...(remote.masteredQuestionIds ?? [])],
    250,
  );
  const masteredSet = new Set(nextMastered);
  const nextWrong = sanitizeStringList(
    [...current.wrongQuestionIds, ...(remote.wrongQuestionIds ?? [])].filter((id) => !masteredSet.has(id)),
    120,
  );
  const remoteDate = typeof remote.lastPracticeDateKey === 'string' ? remote.lastPracticeDateKey : null;
  const nextDate = current.lastPracticeDateKey && remoteDate
    ? (current.lastPracticeDateKey > remoteDate ? current.lastPracticeDateKey : remoteDate)
    : (current.lastPracticeDateKey ?? remoteDate);
  const nextStreak = Math.max(current.streakDays, typeof remote.streakDays === 'number' ? Math.floor(remote.streakDays) : 0);
  const nextSessions = Math.max(current.sessionsCompleted, typeof remote.sessionsCompleted === 'number' ? Math.floor(remote.sessionsCompleted) : 0);
  const nextAnswered = Math.max(current.totalAnswered, typeof remote.totalAnswered === 'number' ? Math.floor(remote.totalAnswered) : 0);
  const nextCorrect = Math.min(
    nextAnswered,
    Math.max(current.totalCorrect, typeof remote.totalCorrect === 'number' ? Math.floor(remote.totalCorrect) : 0),
  );

  if (
    nextMastered.length === current.masteredQuestionIds.length
    && nextWrong.length === current.wrongQuestionIds.length
    && nextStreak === current.streakDays
    && nextDate === current.lastPracticeDateKey
    && nextSessions === current.sessionsCompleted
    && nextAnswered === current.totalAnswered
    && nextCorrect === current.totalCorrect
  ) {
    return current;
  }

  return commit({
    ...current,
    masteredQuestionIds: nextMastered,
    wrongQuestionIds: nextWrong,
    streakDays: nextStreak,
    lastPracticeDateKey: nextDate,
    sessionsCompleted: nextSessions,
    totalAnswered: nextAnswered,
    totalCorrect: nextCorrect,
  });
}

export function clearPracticeLocalState(): void {
  cachedState = DEFAULT_PRACTICE_STATE;
  try {
    if (practiceFile.exists) practiceFile.delete();
  } catch {
    // Cleanup will be retried on the next deletion request.
  }
  emit();
}
