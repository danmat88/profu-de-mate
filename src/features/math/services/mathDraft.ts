import { File, Paths } from 'expo-file-system';
import type { FlowMode } from '../../../shared/types';
import { isMathDocument, type MathDocument } from '../utils/mathEditor';
import { assertSessionActive, type ActiveSession } from '../../../shared/services/sessionGuard';

export type MathDraft = { problem: MathDocument; solution: MathDocument };
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const draftFile = (mode: FlowMode) => new File(Paths.document, `profu-math-draft-${mode}-v1.json`);

export function readMathDraft(mode: FlowMode, session: ActiveSession): MathDraft | null {
  assertSessionActive(session);
  try {
    const file = draftFile(mode);
    if (!file.exists) return null;
    if (file.size > 100_000) { file.delete(); return null; }
    const value = JSON.parse(file.textSync());
    const age = Date.now() - value.updatedAt;
    if (value.userId !== session.userId || value.sessionKey !== session.sessionKey
      || !Number.isFinite(age) || age < 0 || age > MAX_AGE_MS
      || !isMathDocument(value.problem) || !isMathDocument(value.solution)) {
      file.delete();
      return null;
    }
    return { problem: value.problem, solution: value.solution };
  } catch { return null; }
}

export function writeMathDraft(mode: FlowMode, draft: MathDraft, session: ActiveSession): boolean {
  try {
    assertSessionActive(session);
    draftFile(mode).write(JSON.stringify({ ...draft, userId: session.userId, sessionKey: session.sessionKey, updatedAt: Date.now() }));
    return true;
  } catch { return false; }
}

export function clearMathDrafts(): void {
  for (const mode of ['solve', 'check'] as const) {
    try { const file = draftFile(mode); if (file.exists) file.delete(); } catch { /* Identity-bound drafts remain unreadable after sign-out. */ }
  }
}
