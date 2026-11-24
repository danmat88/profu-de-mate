import type { MathDocumentDefinition } from '../../math/utils/mathDocument.ts';
import {
  FORMULA_CATEGORIES,
  getFormulaCategoryMeta,
  type FormulaCategoryId,
  type StudyTrackId,
} from '../../study/types.ts';
import { resolveStudyContentBlocks } from '../../study/utils/studyDocumentBuilder.ts';
import { PRACTICE_BANK } from '../data/practiceBank.ts';
import {
  PRACTICE_DIFFICULTY_META,
  type PracticeChoice,
  type PracticeQuestion,
  type PracticeSessionMode,
} from '../types.ts';

export type CategoryPracticeStat = {
  categoryId: FormulaCategoryId;
  label: string;
  shortLabel: string;
  accent: string;
  total: number;
  mastered: number;
  wrong: number;
};

export type PracticeSelectionOptions = {
  mode: PracticeSessionMode;
  track: StudyTrackId;
  category?: FormulaCategoryId;
  formulaId?: string;
  wrongIds?: readonly string[];
  masteredIds?: readonly string[];
  limit?: number;
  seed?: number;
};

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKeyUtcDays(dateKey: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function computeNextStreak(
  previousStreak: number,
  lastDateKey: string | null,
  todayDateKey: string,
): { streakDays: number; lastPracticeDateKey: string } {
  const safePrev = Number.isFinite(previousStreak) && previousStreak > 0 ? Math.floor(previousStreak) : 0;
  if (!lastDateKey) {
    return { streakDays: 1, lastPracticeDateKey: todayDateKey };
  }
  if (lastDateKey === todayDateKey) {
    return { streakDays: Math.max(1, safePrev), lastPracticeDateKey: todayDateKey };
  }
  const prevDays = parseDateKeyUtcDays(lastDateKey);
  const todayDays = parseDateKeyUtcDays(todayDateKey);
  if (prevDays !== null && todayDays !== null && todayDays - prevDays === 1) {
    return { streakDays: safePrev + 1, lastPracticeDateKey: todayDateKey };
  }
  if (prevDays !== null && todayDays !== null && todayDays < prevDays) {
    return { streakDays: Math.max(1, safePrev), lastPracticeDateKey: lastDateKey };
  }
  return { streakDays: 1, lastPracticeDateKey: todayDateKey };
}

export function isStreakActiveTodayOrYesterday(
  lastDateKey: string | null,
  todayDateKey: string,
): boolean {
  if (!lastDateKey) return false;
  const prevDays = parseDateKeyUtcDays(lastDateKey);
  const todayDays = parseDateKeyUtcDays(todayDateKey);
  if (prevDays === null || todayDays === null) return false;
  return todayDays - prevDays <= 1 && todayDays >= prevDays;
}

function parseSimpleNumeric(value: string): number | null {
  const fractionMatch = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(value);
  if (fractionMatch) {
    const num = Number(fractionMatch[1]);
    const den = Number(fractionMatch[2]);
    if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
      return num / den;
    }
    return null;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeShortAnswer(raw: string): string {
  return raw
    .trim()
    .toLocaleLowerCase('ro-RO')
    .replace(/[−–—]/g, '-')
    .replace(/,/g, '.')
    .replace(/\s*(?:cm\^?3|cm³|cm\^?2|cm²|cm|m\^?2|m²|m|°|grade)\s*$/i, '')
    .replace(/\s+/g, '')
    .replace(/^(?:sqrt|radical)\((\d+(?:\.\d+)?)\)$/i, '√$1')
    .replace(/^√\((\d+(?:\.\d+)?)\)$/i, '√$1')
    .replace(/^\+/, '');
}

export function evaluatePracticeAnswer(
  question: PracticeQuestion,
  submission: { choiceIndex?: number; text?: string },
): boolean {
  if (question.kind === 'choice') {
    return typeof submission.choiceIndex === 'number' && submission.choiceIndex === question.correctIndex;
  }
  const normalizedInput = normalizeShortAnswer(submission.text ?? '');
  if (!normalizedInput) return false;

  const accepted = question.acceptedAnswers ?? [question.answerDisplay];
  const inputNumber = parseSimpleNumeric(normalizedInput);

  for (const candidate of accepted) {
    const normalizedCandidate = normalizeShortAnswer(candidate);
    if (normalizedInput === normalizedCandidate) return true;
    if (inputNumber !== null) {
      const candidateNumber = parseSimpleNumeric(normalizedCandidate);
      if (candidateNumber !== null && Math.abs(inputNumber - candidateNumber) < 1e-6) {
        return true;
      }
    }
  }
  return false;
}

function nextSeededRandom(state: { seed: number }): number {
  state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
  return state.seed / 0x100000000;
}

function shuffleArray<T>(items: readonly T[], seed: number): T[] {
  const copy = [...items];
  const rng = { seed: (seed >>> 0) || 1 };
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextSeededRandom(rng) * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function shuffleQuestionChoices(question: PracticeQuestion, seed: number): PracticeQuestion {
  if (question.kind !== 'choice' || !question.choices || question.correctIndex === undefined) {
    return question;
  }
  const indexed = question.choices.map((choice, originalIndex) => ({
    choice,
    isCorrect: originalIndex === question.correctIndex,
  }));
  const shuffled = shuffleArray(indexed, seed);
  const nextCorrect = shuffled.findIndex((item) => item.isCorrect);
  return {
    ...question,
    choices: shuffled.map((item) => item.choice) as unknown as readonly [
      PracticeChoice,
      PracticeChoice,
      PracticeChoice,
      PracticeChoice,
    ],
    correctIndex: (nextCorrect >= 0 ? nextCorrect : 0) as 0 | 1 | 2 | 3,
  };
}

export function getPracticeQuestionById(id: string): PracticeQuestion | undefined {
  return PRACTICE_BANK.find((item) => item.id === id);
}

export function getPracticeQuestionsForFormula(formulaId: string): PracticeQuestion[] {
  return PRACTICE_BANK.filter((item) => item.formulaId === formulaId);
}

export function selectPracticeQuestions(
  bank: readonly PracticeQuestion[],
  options: PracticeSelectionOptions,
): PracticeQuestion[] {
  const limit = options.limit ?? 5;
  const seed = options.seed ?? Date.now();
  const wrongSet = new Set(options.wrongIds ?? []);
  const masteredSet = new Set(options.masteredIds ?? []);

  let pool: PracticeQuestion[];

  if (options.mode === 'mistakes') {
    pool = bank.filter((q) => wrongSet.has(q.id));
  } else if (options.mode === 'formula' && options.formulaId) {
    pool = bank.filter((q) => q.formulaId === options.formulaId);
  } else if (options.mode === 'category' && options.category) {
    const trackMatches = bank.filter(
      (q) => q.category === options.category && q.tracks.includes(options.track),
    );
    pool = trackMatches.length > 0
      ? trackMatches
      : bank.filter((q) => q.category === options.category);
  } else {
    pool = bank.filter((q) => q.tracks.includes(options.track));
    if (pool.length === 0) pool = [...bank];
  }

  // Prioritize unmastered & previously missed questions, while keeping variety.
  const wrongItems = shuffleArray(pool.filter((q) => wrongSet.has(q.id)), seed + 11);
  const freshItems = shuffleArray(
    pool.filter((q) => !wrongSet.has(q.id) && !masteredSet.has(q.id)),
    seed + 29,
  );
  const masteredItems = shuffleArray(
    pool.filter((q) => !wrongSet.has(q.id) && masteredSet.has(q.id)),
    seed + 53,
  );

  const ordered = [...wrongItems, ...freshItems, ...masteredItems].slice(0, limit);
  return ordered.map((question, index) => shuffleQuestionChoices(question, seed + (index + 1) * 97));
}

export function computeCategoryStats(
  bank: readonly PracticeQuestion[],
  track: StudyTrackId,
  masteredIds: readonly string[],
  wrongIds: readonly string[],
): CategoryPracticeStat[] {
  const masteredSet = new Set(masteredIds);
  const wrongSet = new Set(wrongIds);
  const trackBank = bank.filter((q) => q.tracks.includes(track));

  return FORMULA_CATEGORIES
    .map((cat) => {
      const items = trackBank.filter((q) => q.category === cat.id);
      if (items.length === 0) return null;
      return {
        categoryId: cat.id,
        label: cat.label,
        shortLabel: cat.shortLabel,
        accent: cat.accent,
        total: items.length,
        mastered: items.filter((q) => masteredSet.has(q.id)).length,
        wrong: items.filter((q) => wrongSet.has(q.id)).length,
      };
    })
    .filter((item): item is CategoryPracticeStat => Boolean(item));
}

export function buildPracticePromptDocument(question: PracticeQuestion): MathDocumentDefinition {
  const categoryMeta = getFormulaCategoryMeta(question.category);
  const diffMeta = PRACTICE_DIFFICULTY_META[question.difficulty];
  const promptContent = question.renderedPrompt ?? resolveStudyContentBlocks(question.prompt);

  return {
    accessibilityLabel: `Exercițiu: ${question.title}`,
    variant: 'problem',
    sections: [
      {
        kind: 'heading',
        eyebrow: `${categoryMeta.shortLabel.toUpperCase()} · ${diffMeta.badge}${question.aiGenerated ? ' · AI' : ''}`,
        title: question.title,
        tone: question.aiGenerated ? 'lime' : 'violet',
      },
      {
        kind: 'content',
        content: promptContent,
      },
    ],
  };
}

export function buildPracticeExplanationDocument(question: PracticeQuestion): MathDocumentDefinition {
  const categoryMeta = getFormulaCategoryMeta(question.category);
  const explanationContent = question.renderedExplanation ?? resolveStudyContentBlocks(question.explanation);

  return {
    accessibilityLabel: `Explicație pas cu pas: ${question.title}`,
    variant: 'summary',
    sections: [
      {
        kind: 'answer',
        label: 'RĂSPUNS CORECT',
        caption: `${categoryMeta.shortLabel} · ${question.title}`,
        content: [{ type: 'text', text: question.answerDisplay, latex: '', spoken: '' }],
      },
      {
        kind: 'section_title',
        eyebrow: 'PAS CU PAS',
        title: 'Cum ajungi la rezultat',
      },
      {
        kind: 'content',
        content: explanationContent,
      },
    ],
  };
}
