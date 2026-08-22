export type FlowMode = 'solve' | 'check';

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

export type ContentBlock = TextContentBlock | MathContentBlock;
export type RichContent = ContentBlock[];

export type LessonStep = {
  kicker: string;
  title: string;
  explanation: RichContent;
  note: RichContent;
  alternative: RichContent;
};

export type MathAnalysis = {
  schemaVersion: 3;
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
  takeaways: Array<{ content: RichContent }>;
};

export type StoredLesson = MathAnalysis & {
  id: string;
  isFavorite: boolean;
  createdAt?: { toDate(): Date } | null;
};

export type RootStackParamList = {
  Home: undefined;
  Notebook: undefined;
  Settings: undefined;
  Legal: undefined;
  Capture: { mode: FlowMode };
  Review: { mode: FlowMode; image: CapturedImage };
  Processing: { mode: FlowMode; image: CapturedImage; requestId: string };
  Lesson: { lesson: MathAnalysis; lessonId: string; isFavorite?: boolean; source?: 'flow' | 'notebook'; sourceImage?: CapturedImage };
  Summary: { lesson: MathAnalysis; lessonId: string; isFavorite?: boolean };
};
