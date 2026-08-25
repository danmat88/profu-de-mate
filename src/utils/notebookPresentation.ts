import type { RichContent, StoredLesson } from '../types';
import {
  contentToAccessibleText,
  prepareRichContentForPresentation,
} from './mathContent.ts';

export type NotebookFilter = 'all' | 'solve' | 'check';

export type NotebookProblemPresentation = {
  identity: string;
  title: string;
  requestCount: number;
};

export type NotebookVerdictPresentation = {
  label: string;
  tone: 'correct' | 'partial' | 'incorrect';
};

function normalizedProblemText(content: RichContent) {
  return contentToAccessibleText(prepareRichContentForPresentation(content))
    .replace(/^problema\s*:\s*/iu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function notebookProblemPresentation(lesson: StoredLesson): NotebookProblemPresentation {
  const identity = normalizedProblemText(lesson.problem) || lesson.title.trim() || 'Problemă matematică';
  const labels = lesson.problem.flatMap((block) => block.type === 'text'
    ? [...block.text.matchAll(/(?:^|\s)([a-zăâîșț]\))(?:\s+|$)/giu)].map((match) => match[1].toLocaleLowerCase('ro-RO'))
    : []);

  return {
    identity,
    title: lesson.title.trim() || lesson.topic.trim() || 'Problemă matematică',
    requestCount: new Set(labels).size,
  };
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

export function filterNotebookLessons(lessons: StoredLesson[], filter: NotebookFilter, queryText: string) {
  const query = queryText.trim().toLocaleLowerCase('ro-RO');
  return lessons.filter((lesson) => {
    if (filter !== 'all' && lesson.mode !== filter) return false;
    if (!query) return true;
    const presentation = notebookProblemPresentation(lesson);
    const searchable = [
      presentation.identity,
      lesson.title,
      lesson.topic,
      ...lesson.problem.flatMap((block) => block.type === 'math' ? [block.latex, block.spoken] : []),
    ].join(' ').toLocaleLowerCase('ro-RO');
    return searchable.includes(query);
  });
}
