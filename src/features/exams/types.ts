import type { ExamGuideId, StudyContentBlock } from '../study/types';

export type ExamSubjectKey = 's1' | 's2' | 's3';
export type ExamSimulationScope = 'full' | ExamSubjectKey;
export type ExamItemKind = 'choice' | 'short_answer' | 'rubric';

export type ExamRubricCriterion = {
  id: string;
  step: string;
  points: number;
};

export type ExamSimulationItem = {
  id: string;
  subject: ExamSubjectKey;
  numberLabel: string;
  title: string;
  maxPoints: number;
  kind: ExamItemKind;
  prompt: readonly StudyContentBlock[];
  /** Plain Romanian statement text sent alongside photos for AI rubric grading. */
  plainStatement: string;
  /** Exactly 4 choices when kind === 'choice'. */
  choices?: readonly [string, string, string, string];
  correctIndex?: 0 | 1 | 2 | 3;
  /** Accepted normalized forms when kind === 'short_answer'. */
  acceptedAnswers?: readonly string[];
  answerDisplay: string;
  inputHint?: string;
  /** Official solution steps rendered with MathJax Fira SVG. */
  solution: readonly StudyContentBlock[];
  /** Step-by-step official rubric criteria summing to maxPoints (for rubric items). */
  rubric?: readonly ExamRubricCriterion[];
};

export type ExamSimulationVariant = {
  id: string;
  examId: ExamGuideId;
  label: string;
  title: string;
  subtitle: string;
  durationMinutes: number;
  totalPoints: number;
  officePoints: number;
  items: readonly ExamSimulationItem[];
};

export type AiRubricCriterionResult = {
  step: string;
  awardedPoints: number;
  maxPoints: number;
  comment: string;
};

export type AiRubricGradingResult = {
  status: 'graded' | 'unclear' | 'not_math';
  awardedPoints: number;
  maxPoints: number;
  verdict: 'complete' | 'partial' | 'needs_work';
  summary: string;
  criteriaScores: readonly AiRubricCriterionResult[];
  improvementTip: string;
};

export type ExamSimulationRecord = {
  id: string;
  variantId: string;
  examId: ExamGuideId;
  scope: ExamSimulationScope;
  completedAt: string;
  awardedPoints: number;
  maxPoints: number;
  grade: number | null;
  elapsedSeconds: number;
  subjectPoints: Record<ExamSubjectKey, number>;
};
