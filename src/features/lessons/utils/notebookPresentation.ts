import type { RichContent, StoredLesson } from '../../../shared/types';
import {
  contentToAccessibleText,
  prepareRichContentForPresentation,
} from '../../math/utils/mathContent.ts';

export type NotebookFilter = 'all' | 'solve' | 'check';

export type NotebookProblemPresentation = {
  identity: string;
  title: string;
  snippet: string | null;
  requestCount: number;
};

export type NotebookVerdictPresentation = {
  label: string;
  tone: 'correct' | 'partial' | 'incorrect';
};

const REQUEST_LABEL_RE = /(?:^|\s)([a-zăâîșț]\))(?:\s+|$)/giu;

function normalizedProblemText(content: RichContent) {
  return contentToAccessibleText(prepareRichContentForPresentation(content))
    .replace(/^problema\s*:\s*/iu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSnippet(identity: string, title: string, topic: string): string | null {
  const cleanIdentity = identity.trim();
  if (!cleanIdentity) return null;
  const normId = cleanIdentity.toLowerCase();
  const normTitle = title.trim().toLowerCase();
  const normTopic = topic.trim().toLowerCase();
  if (normId === normTitle || normId === normTopic) return null;
  if (normTitle.length >= 12 && normId.startsWith(normTitle) && normId.length - normTitle.length < 8) {
    return null;
  }
  return cleanIdentity.length > 96 ? `${cleanIdentity.slice(0, 93).trimEnd()}…` : cleanIdentity;
}

const presentationCache = new WeakMap<StoredLesson, NotebookProblemPresentation>();
const searchableCache = new WeakMap<StoredLesson, string>();

export function notebookProblemPresentation(lesson: StoredLesson): NotebookProblemPresentation {
  const cached = presentationCache.get(lesson);
  if (cached) return cached;

  const identity = normalizedProblemText(lesson.problem) || lesson.title.trim() || 'Problemă matematică';
  const labels = new Set<string>();
  for (const block of lesson.problem) {
    if (block.type !== 'text') continue;
    REQUEST_LABEL_RE.lastIndex = 0;
    let match = REQUEST_LABEL_RE.exec(block.text);
    while (match) {
      labels.add(match[1].toLowerCase());
      match = REQUEST_LABEL_RE.exec(block.text);
    }
  }

  const title = lesson.title.trim() || lesson.topic.trim() || 'Problemă matematică';
  const result: NotebookProblemPresentation = {
    identity,
    title,
    snippet: buildSnippet(identity, title, lesson.topic),
    requestCount: labels.size,
  };
  presentationCache.set(lesson, result);
  return result;
}

/** Pre-populates presentation cache off the navigation tap path. */
export function prewarmNotebookPresentations(lessons: readonly StoredLesson[] | undefined) {
  if (!lessons || lessons.length === 0) return;
  const limit = Math.min(lessons.length, 24);
  for (let index = 0; index < limit; index += 1) {
    notebookProblemPresentation(lessons[index]);
  }
}

export function notebookVerdictPresentation(lesson: StoredLesson): NotebookVerdictPresentation | undefined {
  if (lesson.mode !== 'check') return undefined;
  if (lesson.verdict === 'correct') return { label: 'CORECTĂ', tone: 'correct' };
  if (lesson.verdict === 'partially_correct') return { label: 'PARȚIAL CORECTĂ', tone: 'partial' };
  if (lesson.verdict === 'incorrect') return { label: 'DE CORECTAT', tone: 'incorrect' };
  return undefined;
}

export function notebookFilterCounts(lessons: StoredLesson[]) {
  return lessons.reduce((counts, lesson) => {
    counts.all += 1;
    counts[lesson.mode] += 1;
    return counts;
  }, { all: 0, solve: 0, check: 0 });
}

function lessonSearchableText(lesson: StoredLesson): string {
  const cached = searchableCache.get(lesson);
  if (cached !== undefined) return cached;
  const presentation = notebookProblemPresentation(lesson);
  const searchable = [
    presentation.identity,
    lesson.title,
    lesson.topic,
    ...lesson.problem.flatMap((block) => block.type === 'math' ? [block.latex, block.spoken] : []),
  ].join(' ').toLocaleLowerCase('ro-RO');
  searchableCache.set(lesson, searchable);
  return searchable;
}

export function filterNotebookLessons(lessons: StoredLesson[], filter: NotebookFilter, queryText: string) {
  const query = queryText.trim().toLocaleLowerCase('ro-RO');
  if (filter === 'all' && !query) return lessons;
  return lessons.filter((lesson) => {
    if (filter !== 'all' && lesson.mode !== filter) return false;
    if (!query) return true;
    return lessonSearchableText(lesson).includes(query);
  });
}
