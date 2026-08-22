import assert from 'node:assert/strict';
import test from 'node:test';
import { mathAnalysisSchema } from './analysisSchema.js';
import { renderLatex, renderMathAnalysis } from './mathRenderer.js';

const text = (value: string) => ({ type: 'text', text: value, latex: '', spoken: '' });
const math = (latex: string, spoken: string) => ({ type: 'math', text: '', latex, spoken });

function solvedLesson() {
  return {
    status: 'ready',
    mode: 'solve',
    title: 'Ecuație de gradul al doilea',
    problem: [math('x^{2} - 5x + 6 = 0', 'x la pătrat minus cinci x plus șase este egal cu zero')],
    topic: 'Ecuații de gradul al doilea',
    verdict: 'not_applicable',
    headline: 'O rezolvăm prin factorizare.',
    summary: [text('Căutăm două numere potrivite pentru factorizare.')],
    finalAnswer: [math('x_{1}=2,\quad x_{2}=3', 'x unu este doi, iar x doi este trei')],
    steps: [{
      kicker: 'FACTORIZĂM',
      title: 'Descompunem expresia',
      explanation: [
        text('Scriem expresia ca produs de doi factori.'),
        math('(x-2)(x-3)=0', 'x minus doi înmulțit cu x minus trei este egal cu zero'),
      ],
      note: [text('Un produs este zero când cel puțin un factor este zero.')],
      alternative: [
        text('Desfacem produsul în două posibilități.'),
        math('x-2=0\quad\text{sau}\quad x-3=0', 'x minus doi este zero sau x minus trei este zero'),
      ],
    }],
    takeaways: [{ content: [text('Factorizarea poate transforma ecuația într-un produs nul.')] }],
  } as const;
}

test('accepts and renders a structured lesson', async () => {
  const parsed = mathAnalysisSchema.parse(solvedLesson());
  const rendered = await renderMathAnalysis(parsed);

  assert.equal(rendered.schemaVersion, 3);
  assert.match(rendered.problem[0].rendered?.svg ?? '', /^<svg/);
  assert.match(rendered.problem[0].rendered?.svg ?? '', /FIRA/);
  assert.equal(rendered.summary[0].rendered, undefined);
});

test('rejects raw math notation inside prose', () => {
  const value = solvedLesson();
  const parsed = mathAnalysisSchema.safeParse({
    ...value,
    summary: [text('Calculăm sqrt(9) și apoi folosim x^2.')],
  });

  assert.equal(parsed.success, false);
});

test('rejects a ready result without steps', () => {
  const parsed = mathAnalysisSchema.safeParse({ ...solvedLesson(), steps: [] });
  assert.equal(parsed.success, false);
});

test('renders representative algebra, geometry, analysis and matrix notation', async () => {
  const expressions = [
    '\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}',
    '\\triangle ABC,\\quad \\angle A=90^{\\circ},\\quad \\overline{BC}^{2}=\\overline{AB}^{2}+\\overline{AC}^{2}',
    '\\int_{0}^{1}x^{2}\\,dx=\\frac{1}{3}',
    '\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}',
    '\\begin{cases}2x+y=5\\\\x-y=1\\end{cases}',
    '\\lim_{x\\to 0}\\frac{\\sin x}{x}=1',
  ];

  const rendered = await Promise.all(expressions.map(renderLatex));
  assert.equal(rendered.length, expressions.length);
  rendered.forEach((asset) => {
    assert.match(asset.svg, /^<svg/);
    assert.ok(asset.widthEx > 0);
    assert.ok(asset.heightEx > 0);
    assert.match(asset.viewBox, /^[-\d.]+\s+[-\d.]+\s+[\d.]+\s+[\d.]+$/);
  });
});

test('rejects malformed LaTeX before it reaches the app', async () => {
  await assert.rejects(() => renderLatex('\\sqrt{9'), /Missing close brace/);
});
