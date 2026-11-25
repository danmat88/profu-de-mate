import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { recordDailyStudyActivity } from '../../practice/services/practiceStorage';
import type { ExamGuideId } from '../../study/types';
import type { ExamSimulationRecord, ExamSimulationScope } from '../types';

export type ExamHistoryState = {
  records: readonly ExamSimulationRecord[];
};

const MAX_RECORDS = 24;
const VALID_EXAM_IDS = new Set<string>(['en', 'bac_m1', 'bac_m2', 'bac_m3']);
const VALID_SCOPES = new Set<string>(['full', 's1', 's2', 's3']);
const DEFAULT_HISTORY: ExamHistoryState = { records: [] };
const historyFile = new File(Paths.document, 'study-exams-v1.json');

let cachedHistory: ExamHistoryState | null = null;
const listeners = new Set<() => void>();

function clampFinite(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, value));
}

export function sanitizeExamRecord(value: unknown): ExamSimulationRecord | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const variantId = typeof raw.variantId === 'string' ? raw.variantId.trim() : '';
  const examId = typeof raw.examId === 'string' && VALID_EXAM_IDS.has(raw.examId)
    ? (raw.examId as ExamGuideId)
    : null;
  const scope = typeof raw.scope === 'string' && VALID_SCOPES.has(raw.scope)
    ? (raw.scope as ExamSimulationScope)
    : null;
  const completedAt = typeof raw.completedAt === 'string' ? raw.completedAt.trim() : '';
  const maxPoints = clampFinite(raw.maxPoints, 1, 100);
  const awardedPoints = maxPoints === null ? null : clampFinite(raw.awardedPoints, 0, maxPoints);
  const grade = raw.grade === null ? null : clampFinite(raw.grade, 1, 10);
  const elapsedSeconds = clampFinite(raw.elapsedSeconds, 0, 86_400);
  const rawSubjects = raw.subjectPoints && typeof raw.subjectPoints === 'object'
    ? (raw.subjectPoints as Record<string, unknown>)
    : null;
  const s1 = rawSubjects ? clampFinite(rawSubjects.s1, 0, 100) : null;
  const s2 = rawSubjects ? clampFinite(rawSubjects.s2, 0, 100) : null;
  const s3 = rawSubjects ? clampFinite(rawSubjects.s3, 0, 100) : null;

  if (
    !id || id.length > 64
    || !variantId || variantId.length > 64
    || !examId || !scope
    || completedAt.length < 10 || completedAt.length > 40
    || awardedPoints === null || maxPoints === null
    || (raw.grade !== null && grade === null)
    || elapsedSeconds === null
    || s1 === null || s2 === null || s3 === null
  ) {
    return null;
  }

  return {
    id,
    variantId,
    examId,
    scope,
    completedAt,
    awardedPoints,
    maxPoints,
    grade,
    elapsedSeconds: Math.round(elapsedSeconds),
    subjectPoints: { s1, s2, s3 },
  };
}

export function sanitizeExamRecords(value: unknown): ExamSimulationRecord[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, ExamSimulationRecord>();
  for (const item of value) {
    const sanitized = sanitizeExamRecord(item);
    if (sanitized && !byId.has(sanitized.id)) {
      byId.set(sanitized.id, sanitized);
    }
  }
  return [...byId.values()]
    .sort((a, b) => (a.completedAt === b.completedAt ? a.id.localeCompare(b.id) : b.completedAt.localeCompare(a.completedAt)))
    .slice(0, MAX_RECORDS);
}

function sameExamRecord(a: ExamSimulationRecord, b: ExamSimulationRecord): boolean {
  return a.id === b.id
    && a.variantId === b.variantId
    && a.examId === b.examId
    && a.scope === b.scope
    && a.completedAt === b.completedAt
    && a.awardedPoints === b.awardedPoints
    && a.maxPoints === b.maxPoints
    && a.grade === b.grade
    && a.elapsedSeconds === b.elapsedSeconds
    && a.subjectPoints.s1 === b.subjectPoints.s1
    && a.subjectPoints.s2 === b.subjectPoints.s2
    && a.subjectPoints.s3 === b.subjectPoints.s3;
}

function readFromDisk(): ExamHistoryState {
  try {
    if (!historyFile.exists) return DEFAULT_HISTORY;
    const parsed = JSON.parse(historyFile.textSync()) as Partial<ExamHistoryState>;
    return { records: sanitizeExamRecords(parsed.records) };
  } catch {
    return DEFAULT_HISTORY;
  }
}

function writeToDisk(state: ExamHistoryState): void {
  try {
    if (!historyFile.exists) historyFile.create({ intermediates: true });
    historyFile.write(JSON.stringify(state));
  } catch {
    // Keep exam history active in memory even if disk write fails.
  }
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function commit(next: ExamHistoryState): ExamHistoryState {
  cachedHistory = next;
  writeToDisk(next);
  emit();
  return next;
}

export function getExamHistory(): ExamHistoryState {
  if (!cachedHistory) {
    cachedHistory = readFromDisk();
  }
  return cachedHistory;
}

export function subscribeExamHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useExamHistory(): ExamHistoryState {
  return useSyncExternalStore(subscribeExamHistory, getExamHistory, getExamHistory);
}

export function recordExamSimulation(record: ExamSimulationRecord): ExamHistoryState {
  const current = getExamHistory();
  const sanitized = sanitizeExamRecord(record) ?? record;
  const records = sanitizeExamRecords([sanitized, ...current.records]);
  recordDailyStudyActivity();
  return commit({ records });
}

export function mergeRemoteExamHistory(remoteRecords: readonly unknown[] | undefined): ExamHistoryState {
  const current = getExamHistory();
  if (!Array.isArray(remoteRecords) || remoteRecords.length === 0) return current;
  const merged = sanitizeExamRecords([...current.records, ...remoteRecords]);
  if (
    merged.length === current.records.length
    && merged.every((record, index) => sameExamRecord(record, current.records[index]))
  ) {
    return current;
  }
  return commit({ records: merged });
}

export function getBestGradeForExam(
  history: ExamHistoryState,
  examId: ExamGuideId,
): number | null {
  let best: number | null = null;
  for (const record of history.records) {
    if (record.examId !== examId || record.scope !== 'full' || record.grade === null) continue;
    if (best === null || record.grade > best) best = record.grade;
  }
  return best;
}

export function clearExamLocalState(): void {
  cachedHistory = DEFAULT_HISTORY;
  try {
    if (historyFile.exists) historyFile.delete();
  } catch {
    // Cleanup will be retried on the next deletion request.
  }
  emit();
}
