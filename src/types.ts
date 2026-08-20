export type FlowMode = 'solve' | 'check';

export type RootStackParamList = {
  Home: undefined;
  Notebook: undefined;
  Capture: { mode: FlowMode };
  Review: { mode: FlowMode };
  Processing: { mode: FlowMode };
  Lesson: { mode: FlowMode };
  Summary: { mode: FlowMode };
};
