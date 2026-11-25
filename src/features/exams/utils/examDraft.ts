import type { ExamGuideId } from '../../study/types';
import type { AiRubricGradingResult, ExamSimulationItem, ExamSimulationScope } from '../types';

export const EXAM_DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;
const VALID_EXAM_IDS = new Set<string>(['en', 'bac_m1', 'bac_m2', 'bac_m3']);
const VALID_SCOPES = new Set<string>(['full', 's1', 's2', 's3']);

export type ExamSimulationDraft = {
  version: 1;
  variantId: string;
  examId: ExamGuideId;
  scope: ExamSimulationScope;
  currentIndex: number;
  secondsLeft: number;
  elapsedSeconds: number;
  choiceAnswers: Record<string, number>;
  textAnswers: Record<string, string>;
  checkedRubricSteps: Record<string, readonly string[]>;
  rubricScores: Record<string, number>;
  aiGradingResults: Record<string, AiRubricGradingResult>;
  flaggedIds: Record<string, boolean>;
  savedAt: string;
};

function clampInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function sanitizeChoiceMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim();
    const idx = clampInt(val, 0, 10);
    if (id && id.length <= 64 && idx !== null) {
      out[id] = idx;
    }
  }
  return out;
}

function sanitizeTextMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim();
    if (id && id.length <= 64 && typeof val === 'string') {
      const trimmed = val.slice(0, 200);
      if (trimmed.length > 0) out[id] = trimmed;
    }
  }
  return out;
}

function sanitizeCheckedRubricMap(raw: unknown): Record<string, readonly string[]> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, readonly string[]> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim();
    if (!id || id.length > 64 || !Array.isArray(val)) continue;
    const clean = val
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => entry.trim().slice(0, 64))
      .slice(0, 20);
    if (clean.length > 0) out[id] = clean;
  }
  return out;
}

function sanitizeScoreMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim();
    if (!id || id.length > 64 || typeof val !== 'number' || !Number.isFinite(val)) continue;
    out[id] = Math.min(100, Math.max(0, val));
  }
  return out;
}

function sanitizeFlagMap(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim();
    if (id && id.length <= 64 && val === true) {
      out[id] = true;
    }
  }
  return out;
}

function sanitizeAiResult(raw: unknown): AiRubricGradingResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const status = obj.status === 'graded' || obj.status === 'unclear' || obj.status === 'not_math'
    ? obj.status
    : null;
  const maxPoints = clampInt(obj.maxPoints, 1, 100);
  const awardedPoints = maxPoints === null ? null : clampInt(obj.awardedPoints, 0, maxPoints);
  const verdict = obj.verdict === 'complete' || obj.verdict === 'partial' || obj.verdict === 'needs_work'
    ? obj.verdict
    : awardedPoints !== null && maxPoints !== null
      ? awardedPoints >= maxPoints
        ? 'complete'
        : awardedPoints > 0
          ? 'partial'
          : 'needs_work'
      : null;
  const summary = typeof obj.summary === 'string' ? obj.summary.slice(0, 1200) : '';
  const improvementTip = typeof obj.improvementTip === 'string' ? obj.improvementTip.slice(0, 600) : '';
  if (!status || !verdict || maxPoints === null || awardedPoints === null || !summary) return null;

  const criteriaScores: { step: string; maxPoints: number; awardedPoints: number; comment: string }[] = [];
  if (Array.isArray(obj.criteriaScores)) {
    for (const entry of obj.criteriaScores.slice(0, 20)) {
      if (!entry || typeof entry !== 'object') continue;
      const item = entry as Record<string, unknown>;
      const step = typeof item.step === 'string' ? item.step.slice(0, 400) : '';
      const cMax = clampInt(item.maxPoints, 0, 100);
      const cAwarded = cMax === null ? null : clampInt(item.awardedPoints, 0, cMax);
      const comment = typeof item.comment === 'string' ? item.comment.slice(0, 600) : '';
      if (step && cMax !== null && cAwarded !== null) {
        criteriaScores.push({ step, maxPoints: cMax, awardedPoints: cAwarded, comment });
      }
    }
  }

  return {
    status,
    awardedPoints,
    maxPoints,
    verdict,
    summary,
    criteriaScores,
    improvementTip,
  };
}

function sanitizeAiResultsMap(raw: unknown): Record<string, AiRubricGradingResult> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, AiRubricGradingResult> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim();
    if (!id || id.length > 64) continue;
    const clean = sanitizeAiResult(val);
    if (clean) out[id] = clean;
  }
  return out;
}

export function sanitizeExamDraft(
  value: unknown,
  nowMs: number = Date.now(),
): ExamSimulationDraft | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1) return null;

  const variantId = typeof raw.variantId === 'string' ? raw.variantId.trim() : '';
  const examId = typeof raw.examId === 'string' && VALID_EXAM_IDS.has(raw.examId)
    ? (raw.examId as ExamGuideId)
    : null;
  const scope = typeof raw.scope === 'string' && VALID_SCOPES.has(raw.scope)
    ? (raw.scope as ExamSimulationScope)
    : null;
  const currentIndex = clampInt(raw.currentIndex, 0, 100);
  const secondsLeft = clampInt(raw.secondsLeft, 0, 86_400);
  const elapsedSeconds = clampInt(raw.elapsedSeconds, 0, 86_400);
  const savedAt = typeof raw.savedAt === 'string' ? raw.savedAt.trim() : '';
  const savedMs = Date.parse(savedAt);

  if (
    !variantId || variantId.length > 64
    || !examId || !scope
    || currentIndex === null
    || secondsLeft === null
    || elapsedSeconds === null
    || !Number.isFinite(savedMs)
  ) {
    return null;
  }

  if (nowMs - savedMs > EXAM_DRAFT_MAX_AGE_MS || savedMs - nowMs > MAX_FUTURE_SKEW_MS) {
    return null;
  }

  return {
    version: 1,
    variantId,
    examId,
    scope,
    currentIndex,
    secondsLeft,
    elapsedSeconds,
    choiceAnswers: sanitizeChoiceMap(raw.choiceAnswers),
    textAnswers: sanitizeTextMap(raw.textAnswers),
    checkedRubricSteps: sanitizeCheckedRubricMap(raw.checkedRubricSteps),
    rubricScores: sanitizeScoreMap(raw.rubricScores),
    aiGradingResults: sanitizeAiResultsMap(raw.aiGradingResults),
    flaggedIds: sanitizeFlagMap(raw.flaggedIds),
    savedAt,
  };
}

export function isDraftForSimulation(
  draft: ExamSimulationDraft | null,
  variantId: string,
  scope: ExamSimulationScope,
): draft is ExamSimulationDraft {
  return Boolean(draft && draft.variantId === variantId && draft.scope === scope);
}

export function countDraftAnsweredItems(
  draft: ExamSimulationDraft,
  items: readonly ExamSimulationItem[],
): number {
  let count = 0;
  for (const item of items) {
    if (item.kind === 'choice') {
      if (draft.choiceAnswers[item.id] !== undefined) count += 1;
    } else if (item.kind === 'short_answer') {
      if (Boolean(draft.textAnswers[item.id]?.trim())) count += 1;
    } else if (
      draft.rubricScores[item.id] !== undefined
      || draft.aiGradingResults[item.id] !== undefined
    ) {
      count += 1;
    }
  }
  return count;
}

export function hasMeaningfulDraftProgress(draft: ExamSimulationDraft): boolean {
  return (
    Object.keys(draft.choiceAnswers).length > 0
    || Object.values(draft.textAnswers).some((val) => val.trim().length > 0)
    || Object.keys(draft.rubricScores).length > 0
    || Object.keys(draft.aiGradingResults).length > 0
    || Object.keys(draft.flaggedIds).length > 0
    || draft.currentIndex > 0
    || draft.elapsedSeconds >= 10
  );
}

export function formatExamCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}
