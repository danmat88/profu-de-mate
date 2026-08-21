export type FlowMode = 'solve' | 'check';

export type CaptureSource = 'camera' | 'gallery';

export type CapturedImage = {
  uri: string;
  width: number;
  height: number;
  source: CaptureSource;
};

export type RootStackParamList = {
  Home: undefined;
  Notebook: undefined;
  Capture: { mode: FlowMode };
  Review: { mode: FlowMode; image: CapturedImage };
  Processing: { mode: FlowMode; image: CapturedImage };
  Lesson: { mode: FlowMode; source?: 'flow' | 'notebook' };
  Summary: { mode: FlowMode };
};
