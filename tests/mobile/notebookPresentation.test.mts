import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { MathContentBlock, RichContent, StoredLesson } from '../../src/shared/types/index.ts';
import {
  filterNotebookLessons,
  notebookFilterCounts,
  notebookProblemPresentation,
  notebookTopicCounts,
  notebookVerdictPresentation,
  prettyLatexText,
} from '../../src/features/lessons/utils/notebookPresentation.ts';

function math(latex: string, spoken: string): MathContentBlock {
  return {
    type: 'math', text: '', latex, spoken,
    rendered: {
      svg: '<svg viewBox="0 0 20 10"></svg>',
      viewBox: '0 0 20 10',
      widthEx: 7,
      heightEx: 2,
      depthEx: 0.2,
    },
  };
}

function lesson(id: string, mode: 'solve' | 'check', problem: RichContent, topic = 'Algebră'): StoredLesson {
  const answer = [math('x=4', 'x egal cu patru')];
  return {
    id,
    isFavorite: true,
    schemaVersion: 4,
    status: 'ready',
    mode,
    title: 'Titlu generic generat de AI',
    problem,
    topic,
    verdict: mode === 'check' ? 'correct' : 'not_applicable',
    headline: 'Gata',
    summary: answer,
    finalAnswer: answer,
    steps: [{ kicker: 'PAS', title: 'Calculăm', explanation: answer, note: answer, alternative: answer }],
    takeaways: [{ content: answer }],
  };
}

test('identifies a saved lesson from the original problem instead of its generated title', () => {
  const saved = lesson('power', 'solve', [
    { type: 'text', text: 'Calculați', latex: '', spoken: '' },
    math('3^0', 'trei la puterea zero'),
  ]);

  const presentation = notebookProblemPresentation(saved);
  assert.equal(presentation.identity, 'Calculați trei la puterea zero');
  assert.equal(presentation.title, 'Titlu generic generat de AI');
  assert.doesNotMatch(presentation.identity, /Titlu generic/);
});

test('keeps spoken mathematics searchable but out of the visible card title', () => {
  const saved = lesson('system', 'solve', [
    { type: 'text', text: 'Se dau ecuațiile:', latex: '', spoken: '' },
    math('x+7=3', 'x plus șapte este egal cu trei'),
    math('y-5=1', 'y minus cinci este egal cu unu'),
    { type: 'text', text: 'Determinați valoarea expresiei:', latex: '', spoken: '' },
    math('x-y', 'x minus y'),
  ]);
  const presentation = notebookProblemPresentation(saved);

  assert.doesNotMatch(presentation.title, /x plus|y minus/);
  assert.match(presentation.identity, /x plus șapte|y minus cinci/);
});

test('builds stable list identities for broad mathematical structures without domain-specific branches', () => {
  const corpus = [
    '\\frac{3}{4}+\\frac{5}{6}',
    'x\\in(-\\infty,-2]\\cup[3,\\infty)',
    '\\begin{cases}2x+y=5\\\\x-y=1\\end{cases}',
    '\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}',
    '\\int_{0}^{1}x^{2}\\,dx',
    '\\lim_{x\\to0}\\frac{\\sin x}{x}',
    'P(A\\mid B)=\\frac{P(A\\cap B)}{P(B)}',
    '\\forall x\\in\\mathbb{R},\\quad x^{2}\\ge0',
  ];

  corpus.forEach((latex, index) => {
    const presentation = notebookProblemPresentation(lesson(`domain-${index}`, 'solve', [math(latex, 'Expresie matematică.')], 'Domeniu'));
    assert.equal(presentation.title, 'Titlu generic generat de AI');
    assert.equal(presentation.identity, 'Expresie matematică.');
  });
});

test('counts distinct subproblem requirements without duplicating labels', () => {
  const saved = lesson('geometry', 'solve', [
    { type: 'text', text: 'a) Calculați latura. b) Aflați unghiul. a) Folosim primul rezultat.', latex: '', spoken: '' },
    math('AB=6', 'A B egal cu șase'),
  ], 'Geometrie');

  assert.equal(notebookProblemPresentation(saved).requestCount, 2);
});

test('filters tabs and searches the original statement, topic and LaTeX', () => {
  const lessons = [
    lesson('radical', 'solve', [{ type: 'text', text: 'Simplificați radicalul.', latex: '', spoken: '' }, math('\\sqrt{18}', 'radical din optsprezece')]),
    lesson('check', 'check', [{ type: 'text', text: 'Verificați ecuația.', latex: '', spoken: '' }, math('2x+1=7', 'doi x plus unu egal cu șapte')], 'Ecuații'),
  ];

  assert.deepEqual(notebookFilterCounts(lessons), { all: 2, solve: 1, check: 1 });
  assert.deepEqual(filterNotebookLessons(lessons, 'check', '').map((item) => item.id), ['check']);
  assert.deepEqual(filterNotebookLessons(lessons, 'all', 'radical').map((item) => item.id), ['radical']);
  assert.deepEqual(filterNotebookLessons(lessons, 'all', '2x+1').map((item) => item.id), ['check']);
  assert.deepEqual(filterNotebookLessons(lessons, 'all', 'ecuații').map((item) => item.id), ['check']);
});

test('presents verification outcomes consistently for every math domain', () => {
  const checked = lesson('checked', 'check', [math('x=4', 'x egal cu patru')]);

  checked.verdict = 'correct';
  assert.deepEqual(notebookVerdictPresentation(checked), { label: 'CORECTĂ', tone: 'correct' });
  checked.verdict = 'partially_correct';
  assert.deepEqual(notebookVerdictPresentation(checked), { label: 'PARȚIAL CORECTĂ', tone: 'partial' });
  checked.verdict = 'incorrect';
  assert.deepEqual(notebookVerdictPresentation(checked), { label: 'DE CORECTAT', tone: 'incorrect' });

  const solved = lesson('solved', 'solve', [math('x=4', 'x egal cu patru')]);
  assert.equal(notebookVerdictPresentation(solved), undefined);
});

test('keeps notebook rows formula-free and exposes direct removal with an in-app confirmation', async () => {
  const source = await readFile(new URL('../../src/features/lessons/screens/NotebookScreen.tsx', import.meta.url), 'utf8');
  const modalSource = await readFile(new URL('../../src/features/lessons/components/RemoveFromNotebookModal.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /MathFormula|InlineMathFormula|MathDocumentView/);
  assert.doesNotMatch(source, /react-native-reanimated/);
  assert.match(source, /Scoate .* din Caiet/);
  assert.match(source, /setLessonFavorite\(lesson\.id, false\)/);
  assert.match(source, /<RemoveFromNotebookModal[\s\S]*visible=\{removeVisible && Boolean\(pendingRemoval\)\}/);
  assert.match(source, /notebookTopicCounts\(notes\)/);
  assert.match(source, /formatLessonShareMessage\(lesson\)/);
  assert.match(modalSource, /Scoți problema din Caiet\?/);
  assert.match(modalSource, /Păstreaz-o în Caiet/);
});

test('formats readable Unicode math previews, final answer snippets, and topic filters', () => {
  assert.equal(prettyLatexText('3^0'), '3⁰');
  assert.equal(prettyLatexText('x^2 - 4 = 0'), 'x² − 4 = 0');
  assert.equal(prettyLatexText('\\frac{3}{4} + \\frac{5}{6}'), '3/4 + 5/6');
  assert.equal(prettyLatexText('\\sqrt{18}'), '√18');
  assert.equal(prettyLatexText('\\angle ABC = 60^\\circ'), '∠ABC = 60°');
  assert.equal(prettyLatexText('S = \\{2, 5\\}'), 'S = {2, 5}');

  const eq = lesson('eq', 'solve', [
    { type: 'text', text: 'Rezolvați', latex: '', spoken: '' },
    math('x^2-4=0', 'x la puterea a doua minus patru egal cu zero'),
  ], 'Ecuații');
  eq.finalAnswer = [math('S=\\{-2, 2\\}', 'S egal cu mulțimea minus doi și doi')];
  eq.takeaways = [
    { content: [{ type: 'text', text: 'Diferență de pătrate.', latex: '', spoken: '' }] },
    { content: [{ type: 'text', text: 'Verifică ambele soluții.', latex: '', spoken: '' }] },
  ];

  const presentation = notebookProblemPresentation(eq);
  assert.equal(presentation.prettySnippet, 'Rezolvați x² − 4 = 0');
  assert.equal(presentation.answerPreview, 'S = {-2, 2}');
  assert.equal(presentation.takeawayCount, 2);

  const lessons = [
    eq,
    lesson('geo-1', 'check', [math('AB=6', 'A B egal cu șase')], 'Geometrie'),
    lesson('geo-2', 'solve', [math('AC=8', 'A C egal cu opt')], 'Geometrie'),
  ];

  assert.deepEqual(notebookTopicCounts(lessons), [
    { topic: 'Geometrie', count: 2 },
    { topic: 'Ecuații', count: 1 },
  ]);
  assert.deepEqual(filterNotebookLessons(lessons, 'all', '', 'Geometrie').map((item) => item.id), ['geo-1', 'geo-2']);
  assert.deepEqual(filterNotebookLessons(lessons, 'check', '', 'Geometrie').map((item) => item.id), ['geo-1']);
  assert.deepEqual(filterNotebookLessons(lessons, 'all', 'S = {-2, 2}').map((item) => item.id), ['eq']);
});
