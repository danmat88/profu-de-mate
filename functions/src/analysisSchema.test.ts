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
  const invalidProse = [
    'Calculăm sqrt(9) și apoi folosim x^2.',
    'Obținem x = 3.',
    'Lungimea este 12 cm.',
    'Rezultatul este aproximativ 25%.',
    'Folosim relația A ∩ B.',
  ];

  invalidProse.forEach((summary) => {
    const parsed = mathAnalysisSchema.safeParse({
      ...solvedLesson(),
      summary: [text(summary)],
    });
    assert.equal(parsed.success, false, `Trebuia respins textul cu matematică brută: ${summary}`);
  });
});

test('accepts natural Romanian prose without hidden notation', () => {
  const parsed = mathAnalysisSchema.safeParse({
    ...solvedLesson(),
    summary: [text('Aplicăm formula potrivită și verificăm rezultatul obținut.')],
  });
  assert.equal(parsed.success, true);
});

test('rejects a ready result without steps', () => {
  const parsed = mathAnalysisSchema.safeParse({ ...solvedLesson(), steps: [] });
  assert.equal(parsed.success, false);
});

test('renders the production corpus across school mathematics', async () => {
  const expressions = [
    '\\frac{3}{4}+\\frac{5}{6}=\\frac{19}{12}',
    '\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}',
    'x\\in(-\\infty,-2]\\cup[3,\\infty)',
    '\\lvert 2x-3\\rvert\\le 5',
    '\\sqrt[3]{27}=3',
    '\\triangle ABC,\\quad \\angle A=90^{\\circ},\\quad \\overline{BC}^{2}=\\overline{AB}^{2}+\\overline{AC}^{2}',
    '\\vec{u}\\cdot\\vec{v}=\\lVert\\vec{u}\\rVert\\,\\lVert\\vec{v}\\rVert\\cos\\theta',
    '\\sin^{2}x+\\cos^{2}x=1',
    'f:\\mathbb{R}\\to\\mathbb{R},\\quad f(x)=x^{2}-1',
    '\\int_{0}^{1}x^{2}\\,dx=\\frac{1}{3}',
    'f\'(x)=3x^{2}-2x+1',
    '\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}',
    '\\det\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}=-2',
    '\\begin{cases}2x+y=5\\\\x-y=1\\end{cases}',
    '\\lim_{x\\to 0}\\frac{\\sin x}{x}=1',
    'a_{n}=a_{1}+(n-1)r',
    '\\sum_{k=1}^{n}k=\\frac{n(n+1)}{2}',
    'z=3+4i,\\quad \\lvert z\\rvert=5',
    '\\binom{n}{k}=\\frac{n!}{k!(n-k)!}',
    'P(A\\mid B)=\\frac{P(A\\cap B)}{P(B)}',
    '\\bar{x}=\\frac{1}{n}\\sum_{i=1}^{n}x_{i}',
    'A\\setminus B=\\{x\\in A\\mid x\\notin B\\}',
    '\\forall x\\in\\mathbb{R},\\quad x^{2}\\ge 0',
    'v=72\\,\\mathrm{km/h}=20\\,\\mathrm{m/s}',
    'x=3{,}14',
    'N=6{,}02\\cdot 10^{23}',
    '\\begin{aligned}x+2y&=7\\\\3x-y&=5\\end{aligned}',
  ];

  const rendered = await Promise.all(expressions.map(renderLatex));
  assert.equal(rendered.length, expressions.length);
  rendered.forEach((asset) => {
    assert.match(asset.svg, /^<svg/);
    assert.ok(asset.widthEx > 0);
    assert.ok(asset.heightEx > 0);
    assert.ok(asset.depthEx >= 0);
    assert.match(asset.viewBox, /^[-\d.]+\s+[-\d.]+\s+[\d.]+\s+[\d.]+$/);
    assert.doesNotMatch(asset.svg, /<(?:script|foreignObject)\b/i);
    assert.doesNotMatch(asset.svg, /\s(?:data|aria)-[\w:-]+=/i);
  });
});

test('keeps repeated formula assets deterministic and dimensionally stable', async () => {
  const first = await renderLatex('x^{2}-x-1=11');
  const second = await renderLatex('  x^{2}-x-1=11  ');

  assert.equal(second.svg, first.svg);
  assert.equal(second.viewBox, first.viewBox);
  assert.equal(second.widthEx, first.widthEx);
  assert.equal(second.heightEx, first.heightEx);
  assert.equal(second.depthEx, first.depthEx);
});

test('rejects malformed LaTeX before it reaches the app', async () => {
  await assert.rejects(() => renderLatex('\\sqrt{9'), /Missing close brace/);
});
