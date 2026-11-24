import type { MathDocumentDefinition, MathDocumentSection } from '../../math/utils/mathDocument.ts';
import { normalizeShortAnswer } from '../../practice/utils/practiceEngine.ts';
import { resolveStudyContentBlocks } from '../../study/utils/studyDocumentBuilder.ts';
import type {
  ExamSimulationItem,
  ExamSimulationScope,
  ExamSimulationVariant,
  ExamSubjectKey,
} from '../types.ts';

export type ExamScoreBreakdown = {
  officePoints: number;
  subjectPoints: Record<ExamSubjectKey, number>;
  awardedPoints: number;
  maxPoints: number;
  grade: number | null;
  percent: number;
};

export function getScopeItems(
  variant: ExamSimulationVariant,
  scope: ExamSimulationScope,
): ExamSimulationItem[] {
  if (scope === 'full') return [...variant.items];
  return variant.items.filter((item) => item.subject === scope);
}

export function getScopeDurationMinutes(
  variant: ExamSimulationVariant,
  scope: ExamSimulationScope,
): number {
  if (scope === 'full') return variant.durationMinutes;
  if (variant.examId === 'en') {
    return scope === 's1' ? 25 : scope === 's2' ? 30 : 55;
  }
  return scope === 's1' ? 35 : scope === 's2' ? 60 : 70;
}

export function getScopeTitle(scope: ExamSimulationScope): string {
  if (scope === 'full') return 'Simulare completă';
  if (scope === 's1') return 'Subiectul I';
  if (scope === 's2') return 'Subiectul II';
  return 'Subiectul III';
}

function parseNumericValue(normalized: string): number | null {
  const frac = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(normalized);
  if (frac) {
    const a = Number(frac[1]);
    const b = Number(frac[2]);
    return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? a / b : null;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

export function evaluateAutoExamItem(
  item: ExamSimulationItem,
  answer: { choiceIndex?: number; text?: string },
): { correct: boolean; awardedPoints: number } {
  if (item.kind === 'choice') {
    const correct = typeof answer.choiceIndex === 'number' && answer.choiceIndex === item.correctIndex;
    return { correct, awardedPoints: correct ? item.maxPoints : 0 };
  }
  if (item.kind === 'short_answer') {
    const normalized = normalizeShortAnswer(answer.text ?? '');
    if (!normalized) return { correct: false, awardedPoints: 0 };
    const accepted = item.acceptedAnswers ?? [item.answerDisplay];
    const inputNum = parseNumericValue(normalized);
    for (const candidate of accepted) {
      const normCand = normalizeShortAnswer(candidate);
      if (normalized === normCand) {
        return { correct: true, awardedPoints: item.maxPoints };
      }
      if (inputNum !== null) {
        const candNum = parseNumericValue(normCand);
        if (candNum !== null && Math.abs(inputNum - candNum) < 1e-6) {
          return { correct: true, awardedPoints: item.maxPoints };
        }
      }
    }
    return { correct: false, awardedPoints: 0 };
  }
  return { correct: false, awardedPoints: 0 };
}

export function computeExamScore(
  variant: ExamSimulationVariant,
  scope: ExamSimulationScope,
  itemAwardedPoints: Readonly<Record<string, number>>,
): ExamScoreBreakdown {
  const subjectPoints: Record<ExamSubjectKey, number> = { s1: 0, s2: 0, s3: 0 };
  const items = getScopeItems(variant, scope);

  for (const item of items) {
    const raw = itemAwardedPoints[item.id] ?? 0;
    const clamped = Math.max(0, Math.min(item.maxPoints, Math.round(raw)));
    subjectPoints[item.subject] += clamped;
  }

  if (scope === 'full') {
    const awardedPoints = Math.min(
      variant.totalPoints,
      variant.officePoints + subjectPoints.s1 + subjectPoints.s2 + subjectPoints.s3,
    );
    const grade = Number((awardedPoints / 10).toFixed(2));
    return {
      officePoints: variant.officePoints,
      subjectPoints,
      awardedPoints,
      maxPoints: variant.totalPoints,
      grade,
      percent: Math.round((awardedPoints / variant.totalPoints) * 100),
    };
  }

  const maxPoints = items.reduce((sum, item) => sum + item.maxPoints, 0);
  const awardedPoints = subjectPoints[scope];
  return {
    officePoints: 0,
    subjectPoints,
    awardedPoints,
    maxPoints,
    grade: null,
    percent: maxPoints > 0 ? Math.round((awardedPoints / maxPoints) * 100) : 0,
  };
}

export function formatRomanianGrade(grade: number): string {
  return grade.toFixed(2).replace('.', ',');
}

export function buildExamItemDocument(item: ExamSimulationItem): MathDocumentDefinition {
  const tone = item.subject === 's1' ? 'violet' : item.subject === 's2' ? 'cyan' : 'peach';
  return {
    accessibilityLabel: `${item.numberLabel}: ${item.title}`,
    variant: 'problem',
    sections: [
      {
        kind: 'heading',
        eyebrow: `${item.numberLabel} · ${item.maxPoints} PUNCTE`,
        title: item.title,
        tone,
      },
      {
        kind: 'content',
        content: resolveStudyContentBlocks(item.prompt),
      },
    ],
  };
}

export function buildExamRubricDocument(item: ExamSimulationItem): MathDocumentDefinition {
  const sections: MathDocumentSection[] = [
    {
      kind: 'answer',
      label: `BAREM OFICIAL · ${item.maxPoints} PUNCTE`,
      caption: `${item.numberLabel} · ${item.title}`,
      content: [{ type: 'text', text: item.answerDisplay, latex: '', spoken: '' }],
    },
    {
      kind: 'section_title',
      eyebrow: 'REZOLVARE MODEL',
      title: 'Pașii oficiali de redactare',
    },
    {
      kind: 'content',
      content: resolveStudyContentBlocks(item.solution),
    },
  ];

  if (item.rubric && item.rubric.length > 0) {
    sections.push({
      kind: 'section_title',
      eyebrow: 'PUNCTAJ PE ETAPE',
      title: 'Cum acordă corectorii punctele',
    });
    item.rubric.forEach((criterion, index) => {
      sections.push({
        kind: 'takeaway',
        index: index + 1,
        tone: index % 2 === 0 ? 'lime' : 'cyan',
        content: [
          { type: 'text', text: `${criterion.points}p — ${criterion.step}`, latex: '', spoken: '' },
        ],
      });
    });
  }

  return {
    accessibilityLabel: `Barem oficial pentru ${item.title}`,
    variant: 'summary',
    sections,
  };
}
