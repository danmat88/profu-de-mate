import { File, Paths } from 'expo-file-system';
import { assertSessionActive, type ActiveSession } from '../../../shared/services/sessionGuard';
import type { FlowMode } from '../../../shared/types';
import { isMathDocument, type MathDocument } from '../utils/mathEditor';

export type MathDraft = { problem: MathDocument; solution: MathDocument };
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const draftFile = (mode: FlowMode) => new File(Paths.document, `profu-math-draft-${mode}-v1.json`);

type CachedEntry = { draft: MathDraft | null; updatedAt: number };
const memoryCache = new Map<string, CachedEntry>();

function cacheKey(mode: FlowMode, session: ActiveSession): string {
  return `${session.userId}:${session.sessionKey}:${mode}`;
}

function cloneDraft(draft: MathDraft): MathDraft {
  return JSON.parse(JSON.stringify(draft)) as MathDraft;
}

/**
 * Instant RAM lookup for the active session's draft.
 * Returns `undefined` when not yet warmed from disk, `null` when confirmed empty.
 */
export function getCachedMathDraft(mode: FlowMode, session: ActiveSession): MathDraft | null | undefined {
  assertSessionActive(session);
  const entry = memoryCache.get(cacheKey(mode, session));
  if (!entry) return undefined;
  if (entry.draft) {
    const age = Date.now() - entry.updatedAt;
    if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) {
      memoryCache.delete(cacheKey(mode, session));
      return undefined;
    }
    return cloneDraft(entry.draft);
  }
  return null;
}

export function readMathDraft(mode: FlowMode, session: ActiveSession): MathDraft | null {
  assertSessionActive(session);
  const key = cacheKey(mode, session);
  try {
    const file = draftFile(mode);
    if (!file.exists) {
      memoryCache.set(key, { draft: null, updatedAt: Date.now() });
      return null;
    }
    if (file.size > 100_000) {
      file.delete();
      memoryCache.set(key, { draft: null, updatedAt: Date.now() });
      return null;
    }
    const value = JSON.parse(file.textSync());
    const age = Date.now() - value.updatedAt;
    if (value.userId !== session.userId || value.sessionKey !== session.sessionKey
      || !Number.isFinite(age) || age < 0 || age > MAX_AGE_MS
      || !isMathDocument(value.problem) || !isMathDocument(value.solution)) {
      file.delete();
      memoryCache.set(key, { draft: null, updatedAt: Date.now() });
      return null;
    }
    const draft: MathDraft = { problem: value.problem, solution: value.solution };
    memoryCache.set(key, { draft: cloneDraft(draft), updatedAt: value.updatedAt });
    return draft;
  } catch {
    return null;
  }
}

/** Preloads both mode drafts into RAM while idle on Home so opening Scrie is instant with zero flash. */
export function warmMathDrafts(session: ActiveSession): void {
  try {
    for (const mode of ['solve', 'check'] as const) {
      if (getCachedMathDraft(mode, session) === undefined) {
        readMathDraft(mode, session);
      }
    }
  } catch {
    // Best-effort warmup; MathInputScreen still reads safely on demand.
  }
}

export function writeMathDraft(mode: FlowMode, draft: MathDraft, session: ActiveSession): boolean {
  try {
    assertSessionActive(session);
    const updatedAt = Date.now();
    draftFile(mode).write(JSON.stringify({ ...draft, userId: session.userId, sessionKey: session.sessionKey, updatedAt }));
    memoryCache.set(cacheKey(mode, session), { draft: cloneDraft(draft), updatedAt });
    return true;
  } catch {
    return false;
  }
}

export function clearMathDrafts(): void {
  memoryCache.clear();
  for (const mode of ['solve', 'check'] as const) {
    try { const file = draftFile(mode); if (file.exists) file.delete(); } catch { /* Identity-bound drafts remain unreadable after sign-out. */ }
  }
}
