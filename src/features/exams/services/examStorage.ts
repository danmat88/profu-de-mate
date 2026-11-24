import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import type { ExamGuideId } from '../../study/types';
import type { ExamSimulationRecord } from '../types';

export type ExamHistoryState = {
  records: readonly ExamSimulationRecord[];
};

const MAX_RECORDS = 24;
const DEFAULT_HISTORY: ExamHistoryState = { records: [] };
const historyFile = new File(Paths.document, 'study-exams-v1.json');

let cachedHistory: ExamHistoryState | null = null;
const listeners = new Set<() => void>();

function readFromDisk(): ExamHistoryState {
  try {
    if (!historyFile.exists) return DEFAULT_HISTORY;
    const parsed = JSON.parse(historyFile.textSync()) as Partial<ExamHistoryState>;
    const records = Array.isArray(parsed.records)
      ? parsed.records.filter((item): item is ExamSimulationRecord => (
        Boolean(item)
        && typeof item === 'object'
        && typeof item.id === 'string'
        && typeof item.variantId === 'string'
        && typeof item.awardedPoints === 'number'
      )).slice(0, MAX_RECORDS)
      : [];
    return { records };
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
  const next: ExamHistoryState = {
    records: [record, ...current.records].slice(0, MAX_RECORDS),
  };
  cachedHistory = next;
  writeToDisk(next);
  emit();
  return next;
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
