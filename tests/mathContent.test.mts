import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  compactProblemContent,
  contentToAccessibleText,
  isMathAnalysis,
  prepareRichContentForPresentation,
  representativeMathBlock,
} from '../src/utils/mathContent.ts';
import type { MathContentBlock, RichContent, VisualContentBlock } from '../src/types.ts';

function math(latex: string, spoken: string): MathContentBlock {
  return {
    type: 'math',
    text: '',
    latex,
    spoken,
    rendered: {
      svg: '<svg viewBox="0 0 10 10"></svg>',
      viewBox: '0 0 10 10',
      widthEx: 5,
      heightEx: 2,
    },
  };
}

test('builds a natural TalkBack phrase from prose and spoken mathematics', () => {
  const content: RichContent = [
    { type: 'text', text: 'Rezultă', latex: '', spoken: '' },
    math('x=4', 'x egal cu patru'),
    { type: 'text', text: 'după simplificare.', latex: '', spoken: '' },
  ];
  assert.equal(contentToAccessibleText(content), 'Rezultă x egal cu patru după simplificare.');
});

test('selects a meaningful equation instead of an isolated symbol', () => {
  const isolated = math('x', 'x');
  const equation = math('x=\\frac{12}{3}', 'x egal cu doisprezece supra trei');
  assert.equal(representativeMathBlock([isolated, equation]), equation);
});

test('keeps a connected pair of expressions in the notebook preview', () => {
  const first = math('AB=AC', 'A B egal cu A C');
  const second = math('\\angle B=\\angle C', 'unghiul B egal cu unghiul C');
  const content: RichContent = [
    { type: 'text', text: 'În triunghi avem', latex: '', spoken: '' },
    first,
    { type: 'text', text: 'și', latex: '', spoken: '' },
    second,
    { type: 'text', text: 'deci triunghiul este isoscel.', latex: '', spoken: '' },
  ];
  assert.deepEqual(compactProblemContent(content), content.slice(0, 4));
});

test('normalizes legacy punctuation fragments for stable mathematical layout', () => {
  const content: RichContent = [
    { type: 'text', text: 'Înălțimea este', latex: '', spoken: '' },
    math('VO=3\\sqrt{2}', 'V O este egal cu trei radical din doi'),
    { type: 'text', text: ', iar muchia laterală este', latex: '', spoken: '' },
    math('VA=6', 'V A este egal cu șase'),
    { type: 'text', text: '.', latex: '', spoken: '' },
    { type: 'text', text: 'Continuăm cu baza.', latex: '', spoken: '' },
  ];

  assert.deepEqual(prepareRichContentForPresentation(content), [
    content[0],
    content[1],
    { type: 'text', text: 'iar muchia laterală este', latex: '', spoken: '' },
    content[3],
    { type: 'text', text: 'Continuăm cu baza.', latex: '', spoken: '' },
  ]);
});

test('rejects a ready analysis that has no explanatory steps', () => {
  const content: RichContent = [math('x=4', 'x egal cu patru')];
  assert.equal(isMathAnalysis({
    schemaVersion: 3,
    status: 'ready',
    mode: 'solve',
    title: 'Ecuație',
    problem: content,
    topic: 'Algebră',
    verdict: 'not_applicable',
    headline: 'Rezolvat',
    summary: content,
    finalAnswer: content,
    steps: [],
    takeaways: [{ content }],
  }), false);
});

test('accepts a rendered structured table and exposes its TalkBack description', () => {
  const renderedCell = math('4', 'patru');
  const table: VisualContentBlock = {
    type: 'visual',
    text: '',
    latex: '',
    spoken: 'Tabel cu x egal cu doi și f de x egal cu patru.',
    visual: {
      kind: 'table',
      title: 'Tabel de valori',
      headers: ['x', 'f(x)'],
      rows: [{ cells: [
        { text: '', latex: '2', spoken: 'doi', rendered: renderedCell.rendered },
        { text: '', latex: '4', spoken: 'patru', rendered: renderedCell.rendered },
      ] }],
    },
  };
  const formulaContent: RichContent = [math('x=2', 'x egal cu doi')];
  const analysis = {
    schemaVersion: 4,
    status: 'ready',
    mode: 'solve',
    title: 'Tabel de valori',
    problem: formulaContent,
    topic: 'Funcții',
    verdict: 'not_applicable',
    headline: 'Citirea este corectă.',
    summary: formulaContent,
    finalAnswer: formulaContent,
    steps: [{ kicker: 'CITIM', title: 'Citirea tabelului', explanation: [table], note: formulaContent, alternative: formulaContent }],
    takeaways: [{ content: formulaContent }],
  };

  assert.equal(isMathAnalysis(analysis), true);
  assert.equal(contentToAccessibleText([table]), table.spoken);
});

test('never downgrades rendered mathematics to native body-font text', async () => {
  const [richContentSource, formulaSource] = await Promise.all([
    readFile(new URL('../src/components/RichMathContent.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/MathFormula.tsx', import.meta.url), 'utf8'),
  ]);
  const inlineStart = formulaSource.indexOf('function InlineMathFormulaComponent');
  const inlineEnd = formulaSource.indexOf('export const InlineMathFormula');
  const inlineImplementation = formulaSource.slice(inlineStart, inlineEnd);

  assert.doesNotMatch(richContentSource, /isNativeParagraph|nativeMath|latexToInlineText\(/);
  assert.doesNotMatch(inlineImplementation, /latexToInlineText|<Text/);
  assert.match(inlineImplementation, /<SvgXml xml=\{xml\}/);
});

test('keeps a subproblem label with the display formula that follows it', async () => {
  const source = await readFile(new URL('../src/components/RichMathContent.tsx', import.meta.url), 'utf8');

  assert.match(source, /subproblemLabelPattern/);
  assert.match(source, /if \(prefix\) flow\.pop\(\)/);
  assert.match(source, /row\.prefix\.text\.trim\(\)/);
  assert.match(source, /mathContainerWidth - 28/);
});
