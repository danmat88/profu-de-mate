import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { sanitizeExamDraft, type ExamSimulationDraft } from '../utils/examDraft';

const draftFile = new File(Paths.document, 'study-exam-draft-v1.json');

let cachedDraft: ExamSimulationDraft | null | undefined;
const listeners = new Set<() => void>();

function readDraftFromDisk(): ExamSimulationDraft | null {
  try {
    if (!draftFile.exists) return null;
    const parsed = JSON.parse(draftFile.textSync()) as unknown;
    const clean = sanitizeExamDraft(parsed);
    if (!clean) {
      try {
        draftFile.delete();
      } catch {
        // Ignore stale file cleanup errors.
      }
      return null;
    }
    return clean;
  } catch {
    return null;
  }
}

function writeDraftToDisk(draft: ExamSimulationDraft | null): void {
  try {
    if (!draft) {
      if (draftFile.exists) draftFile.delete();
      return;
    }
    if (!draftFile.exists) draftFile.create({ intermediates: true });
    draftFile.write(JSON.stringify(draft));
  } catch {
    // Keep draft active in memory even if disk write fails.
  }
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getExamDraft(): ExamSimulationDraft | null {
  if (cachedDraft === undefined) {
    cachedDraft = readDraftFromDisk();
  }
  return cachedDraft;
}

export function subscribeExamDraft(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useExamDraft(): ExamSimulationDraft | null {
  return useSyncExternalStore(subscribeExamDraft, getExamDraft, getExamDraft);
}

export function saveExamDraft(draft: ExamSimulationDraft): ExamSimulationDraft | null {
  const clean = sanitizeExamDraft(draft);
  if (!clean) return null;
  cachedDraft = clean;
  writeDraftToDisk(clean);
  emit();
  return clean;
}

export function clearExamDraft(): void {
  cachedDraft = null;
  writeDraftToDisk(null);
  emit();
}
