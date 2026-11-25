export type FlowMode = 'solve' | 'check';

export type CommercialIdentity = 'anonymous' | 'google';
export type CommercialTier = 'guest' | 'free' | 'premium';
export type CommercialBlockReason = 'available' | 'welcome_exhausted' | 'daily_exhausted' | 'account_required';
export type CommercialStatus = 'resolving' | 'ready' | 'unavailable';

export type CommercialAccess = {
  identity: CommercialIdentity;
  tier: CommercialTier;
  limit: number;
  used: number;
  remaining: number;
  canAnalyze: boolean;
  reason: CommercialBlockReason;
  resetAt: string | null;
  purchaseUserId: string;
  allowances: {
    welcome: number;
    freeDaily: number;
    premiumDaily: number;
  };
  premium: {
    active: boolean;
    productId: string | null;
    expiresAt: string | null;
  };
  deviceRecall: {
    shouldVerify: boolean;
    verified: boolean;
  };
};

export type CaptureSource = 'camera' | 'gallery';

export type CapturedImage = {
  uri: string;
  width: number;
  height: number;
  source: CaptureSource;
};

export type AnalysisStatus = 'ready' | 'not_math' | 'unclear';
export type AnalysisVerdict = 'correct' | 'partially_correct' | 'incorrect' | 'not_applicable';

export type RenderedMath = {
  svg: string;
  viewBox: string;
  widthEx: number;
  heightEx: number;
  depthEx?: number;
};

export type TextContentBlock = {
  type: 'text';
  text: string;
  latex: '';
  spoken: '';
};

export type MathContentBlock = {
  type: 'math';
  text: '';
  latex: string;
  spoken: string;
  rendered: RenderedMath;
};

export type VisualColor = 'violet' | 'cyan' | 'lime' | 'peach' | 'rose';

export type GeometryVisual = {
  kind: 'geometry';
  title: string;
  points: { id: string; label: string; x: number; y: number }[];
  segments: { from: string; to: string; style: 'solid' | 'dashed'; color: VisualColor }[];
  circles: { center: string; radius: number; color: VisualColor }[];
  polygons: { points: string[]; color: VisualColor }[];
};

export type GraphVisual = {
  kind: 'graph';
  title: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xStep: number;
  yStep: number;
  series: { label: string; color: VisualColor; points: { x: number; y: number }[] }[];
};

export type TableCell =
  | { text: string; latex: ''; spoken: '' }
  | { text: ''; latex: string; spoken: string; rendered: RenderedMath };

export type TableVisual = {
  kind: 'table';
  title: string;
  headers: string[];
  rows: { cells: TableCell[] }[];
};

export type NumberLineVisual = {
  kind: 'number_line';
  title: string;
  min: number;
  max: number;
  step: number;
  markers: { value: number; label: string; closed: boolean; color: VisualColor }[];
  intervals: { start: number; end: number; startClosed: boolean; endClosed: boolean; color: VisualColor }[];
};

export type StructuredVisual = GeometryVisual | GraphVisual | TableVisual | NumberLineVisual;

export type VisualContentBlock = {
  type: 'visual';
  text: '';
  latex: '';
  spoken: string;
  visual: StructuredVisual;
};

export type ContentBlock = TextContentBlock | MathContentBlock | VisualContentBlock;
export type RichContent = ContentBlock[];

export type LessonStep = {
  kicker: string;
  title: string;
  explanation: RichContent;
  note: RichContent;
  alternative: RichContent;
};

export type MathAnalysis = {
  schemaVersion: 3 | 4;
  rendererVersion?: 'fira-v3';
  status: AnalysisStatus;
  mode: FlowMode;
  title: string;
  problem: RichContent;
  topic: string;
  verdict: AnalysisVerdict;
  headline: string;
  summary: RichContent;
  finalAnswer: RichContent;
  steps: LessonStep[];
  takeaways: { content: RichContent }[];
};

export type StoredLesson = MathAnalysis & {
  id: string;
  isFavorite: boolean;
  createdAt?: { toDate(): Date } | null;
};

export type WrittenMathProblem = { problemLatex: string; solutionLatex?: string };

export type StudyFormulaCategoryParam =
  | 'algebra'
  | 'geometry'
  | 'trigonometry'
  | 'matrices'
  | 'analysis'
  | 'combinatorics';

export type ExamGuideRouteId = 'en' | 'bac_m1' | 'bac_m2' | 'bac_m3';
export type ExamSimulationScopeParam = 'full' | 's1' | 's2' | 's3';

export type ExamResultItemSummary = {
  itemId: string;
  numberLabel: string;
  title: string;
  subject: 's1' | 's2' | 's3';
  awardedPoints: number;
  maxPoints: number;
  userAnswerLabel?: string;
  answerStatus?: 'correct' | 'wrong' | 'skipped' | 'rubric';
};

export type PracticeDifficultyParam = 'easy' | 'medium' | 'exam';
export type PracticeSessionModeParam = 'quick' | 'category' | 'formula' | 'mistakes' | 'ai';

export type PracticeSummaryAnswerItem = {
  questionId: string;
  title: string;
  category: StudyFormulaCategoryParam;
  formulaId: string;
  correct: boolean;
  userAnswerLabel: string;
  correctAnswerLabel: string;
};

export type AiPracticeExercisePayload = {
  id: string;
  title: string;
  category: StudyFormulaCategoryParam;
  difficulty: PracticeDifficultyParam;
  formulaId?: string;
  prompt: RichContent;
  choices: readonly [string, string, string, string];
  renderedChoices?: readonly [RenderedMath | null, RenderedMath | null, RenderedMath | null, RenderedMath | null];
  correctIndex: 0 | 1 | 2 | 3;
  hint: string;
  renderedHint?: RichContent;
  explanation: RichContent;
};

export type RootStackParamList = {
  Home: undefined;
  Notebook: undefined;
  Settings: undefined;
  Legal: undefined;
  Paywall: { source: 'quota' | 'settings' | 'home'; access?: CommercialAccess };
  Capture: { mode: FlowMode };
  MathInput: { mode: FlowMode };
  MathProcessing: { mode: FlowMode; math: WrittenMathProblem; requestId: string; userId: string; origin?: 'editor' | 'home' };
  Review: { mode: FlowMode; image: CapturedImage };
  Processing: { mode: FlowMode; image: CapturedImage; requestId: string; userId: string; origin?: 'review' | 'home' };
  Lesson: { lesson: MathAnalysis; lessonId: string; isFavorite?: boolean; source?: 'flow' | 'notebook'; sourceImage?: CapturedImage };
  Summary: { lesson: MathAnalysis; lessonId: string; isFavorite?: boolean };
  Formulas: { initialCategory?: StudyFormulaCategoryParam; initialFavoritesOnly?: boolean; showAllTracks?: boolean } | undefined;
  FormulaDetail: { formulaId: string; formulaIds?: readonly string[] };
  ExamGuide: { examId?: ExamGuideRouteId } | undefined;
  ExamsHub: { examId?: ExamGuideRouteId } | undefined;
  ExamSimulation: { variantId: string; scope: ExamSimulationScopeParam; fresh?: boolean };
  ExamResult: {
    variantId: string;
    examId: ExamGuideRouteId;
    scope: ExamSimulationScopeParam;
    officePoints: number;
    subjectPoints: { s1: number; s2: number; s3: number };
    awardedPoints: number;
    maxPoints: number;
    grade: number | null;
    elapsedSeconds: number;
    pauseCount?: number;
    items: readonly ExamResultItemSummary[];
  };
  PracticeHub: undefined;
  PracticeSession: {
    mode: PracticeSessionModeParam;
    category?: StudyFormulaCategoryParam;
    formulaId?: string;
    questionId?: string;
    aiExercise?: AiPracticeExercisePayload;
  };
  PracticeSummary: {
    mode: PracticeSessionModeParam;
    category?: StudyFormulaCategoryParam;
    formulaId?: string;
    correctCount: number;
    totalCount: number;
    elapsedSeconds: number;
    answers: readonly PracticeSummaryAnswerItem[];
  };
};
