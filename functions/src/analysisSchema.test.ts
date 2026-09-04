import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analysisContentLimits,
  mathAnalysisJsonSchema,
  mathAnalysisSchema,
  normalizeProviderAnalysis,
  summarizeAnalysisValidationIssues,
} from './analysisSchema.js';
import { renderLatex, renderMathAnalysis } from './mathRenderer.js';

const text = (value: string) => ({ type: 'text', text: value, latex: '', spoken: '' });
const math = (latex: string, spoken: string) => ({ type: 'math', text: '', latex, spoken });
const visual = (value: unknown, spoken: string) => ({ type: 'visual', text: '', latex: '', spoken, visual: value });

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

const mathDomainCorpus = [
  ['Aritmetică și fracții', '\\frac{3}{4}+\\frac{5}{6}=\\frac{19}{12}'],
  ['Ecuații de gradul al doilea', '\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}'],
  ['Inecuații și intervale', 'x\\in(-\\infty,-2]\\cup[3,\\infty)'],
  ['Modul', '\\lvert 2x-3\\rvert\\le 5'],
  ['Radicali', '\\sqrt[3]{27}=3'],
  ['Geometrie plană', '\\triangle ABC,\\quad \\angle A=90^{\\circ},\\quad \\overline{BC}^{2}=\\overline{AB}^{2}+\\overline{AC}^{2}'],
  ['Vectori', '\\vec{u}\\cdot\\vec{v}=\\lVert\\vec{u}\\rVert\\,\\lVert\\vec{v}\\rVert\\cos\\theta'],
  ['Trigonometrie', '\\sin^{2}x+\\cos^{2}x=1'],
  ['Funcții', 'f:\\mathbb{R}\\to\\mathbb{R},\\quad f(x)=x^{2}-1'],
  ['Integrale', '\\int_{0}^{1}x^{2}\\,dx=\\frac{1}{3}'],
  ['Derivate', "f'(x)=3x^{2}-2x+1"],
  ['Matrice', '\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}'],
  ['Determinanți', '\\det\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}=-2'],
  ['Sisteme de ecuații', '\\begin{cases}2x+y=5\\\\x-y=1\\end{cases}'],
  ['Limite', '\\lim_{x\\to 0}\\frac{\\sin x}{x}=1'],
  ['Progresii', 'a_{n}=a_{1}+(n-1)r'],
  ['Sume', '\\sum_{k=1}^{n}k=\\frac{n(n+1)}{2}'],
  ['Numere complexe', 'z=3+4i,\\quad \\lvert z\\rvert=5'],
  ['Combinatorică', '\\binom{n}{k}=\\frac{n!}{k!(n-k)!}'],
  ['Probabilități', 'P(A\\mid B)=\\frac{P(A\\cap B)}{P(B)}'],
  ['Statistică', '\\bar{x}=\\frac{1}{n}\\sum_{i=1}^{n}x_{i}'],
  ['Mulțimi', 'A\\setminus B=\\{x\\in A\\mid x\\notin B\\}'],
  ['Logică matematică', '\\forall x\\in\\mathbb{R},\\quad x^{2}\\ge 0'],
  ['Mărimi și unități', 'v=72\\,\\mathrm{km/h}=20\\,\\mathrm{m/s}'],
  ['Zecimale', 'x=3{,}14'],
  ['Notație științifică', 'N=6{,}02\\cdot 10^{23}'],
  ['Transformări aliniate', '\\begin{aligned}x+2y&=7\\\\3x-y&=5\\end{aligned}'],
  ['Procente și rapoarte', '\\frac{15}{100}\\cdot 240=36'],
  ['Polinoame și factorizări', 'x^{3}-8=(x-2)(x^{2}+2x+4)'],
  ['Expresii raționale', '\\frac{x+1}{x-2}+\\frac{3}{x-2}=\\frac{x+4}{x-2}'],
  ['Ecuații exponențiale', '2^{x+1}=16'],
  ['Ecuații logaritmice', '\\log_{2}(x-1)=3'],
  ['Geometrie analitică', 'd(A,B)=\\sqrt{(x_{B}-x_{A})^{2}+(y_{B}-y_{A})^{2}}'],
  ['Șiruri recurente', 'a_{n+1}=2a_{n}+1'],
  ['Integrale nedefinite', '\\int(3x^{2}-2x+1)\\,dx=x^{3}-x^{2}+x+C'],
  ['Derivate parțiale', '\\frac{\\partial}{\\partial x}(x^{2}y+\\sin y)=2xy'],
  ['Ecuații diferențiale', 'y\\prime+2y=e^{x}'],
  ['Arii în geometria plană', 'A_{\\triangle}=\\frac{b\\cdot h}{2}'],
  ['Volume în geometria spațială', 'V_{\\mathrm{piramidă}}=\\frac{A_{b}\\cdot h}{3}'],
  ['Matematică financiară', 'S=P(1+r)^{n}'],
  ['Inducție matematică', '\\sum_{k=1}^{n}k=\\frac{n(n+1)}{2}\\Longrightarrow\\sum_{k=1}^{n+1}k=\\frac{(n+1)(n+2)}{2}'],
] as const;

test('keeps the provider schema free of unsupported union branches', () => {
  const serialized = JSON.stringify(mathAnalysisJsonSchema);
  assert.equal(serialized.includes('"anyOf"'), false);
  assert.equal((serialized.match(/"maxItems"/g) ?? []).length, 2, 'Doar colecțiile de nivel superior au limite în schema furnizorului.');
});

test('normalizes serialized provider visuals before strict validation', () => {
  const geometry = {
    kind: 'geometry', title: 'Segmentul AB',
    points: [{ id: 'A', label: 'A', x: 10, y: 50 }, { id: 'B', label: 'B', x: 90, y: 50 }],
    segments: [{ from: 'A', to: 'B', style: 'solid', color: 'violet' }], circles: [], polygons: [],
  };
  const providerLesson = JSON.parse(JSON.stringify(solvedLesson()));
  providerLesson.problem = [{ type: 'visual', text: '', latex: '', spoken: 'Segmentul de la A la B.', visual: JSON.stringify(geometry) }];
  const addEmptyVisual = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(addEmptyVisual);
    if (!value || typeof value !== 'object') return value;
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, addEmptyVisual(item)]).concat(
      (record.type === 'text' || record.type === 'math') && !('visual' in record) ? [['visual', '']] : [],
    ));
  };

  const normalized = normalizeProviderAnalysis(addEmptyVisual(providerLesson));
  assert.equal(mathAnalysisSchema.safeParse(normalized).success, true);
});

test('rejects malformed or misplaced serialized provider visuals', () => {
  assert.throws(() => normalizeProviderAnalysis({ type: 'visual', text: '', latex: '', spoken: 'Desen.', visual: '{invalid' }));
  assert.throws(() => normalizeProviderAnalysis({ type: 'text', text: 'Explicație.', latex: '', spoken: '', visual: '{"kind":"geometry"}' }));
});

test('accepts structural references but still rejects actual mathematics in prose', () => {
  ['În Figura 1 este reprezentată piramida.', 'Continuăm cu pasul 2.', 'Rezolvăm problema 3a.'].forEach((sentence) => {
    const parsed = mathAnalysisSchema.safeParse({ ...solvedLesson(), summary: [text(sentence)] });
    assert.equal(parsed.success, true, sentence);
  });

  ['Lungimea este 12 cm.', 'Obținem x = 3.', 'Calculăm sqrt(9).'].forEach((sentence) => {
    const parsed = mathAnalysisSchema.safeParse({ ...solvedLesson(), summary: [text(sentence)] });
    assert.equal(parsed.success, false, sentence);
  });
});

test('keeps formulas out of interface titles and headlines', () => {
  const invalid = [
    { title: 'Rezolvăm x = 2' },
    { topic: 'Ecuația 2x + 1 = 5' },
    { headline: 'Răspunsul este 6 m' },
    { steps: [{ ...solvedLesson().steps[0], title: 'Calculăm x^2' }] },
  ];

  invalid.forEach((override) => {
    const parsed = mathAnalysisSchema.safeParse({ ...solvedLesson(), ...override });
    assert.equal(parsed.success, false, JSON.stringify(override));
  });
});

test('compacts harmless provider punctuation and adjacent prose', () => {
  const normalized = normalizeProviderAnalysis([
    { type: 'text', text: 'Aplicăm teorema', latex: '', spoken: '', visual: '' },
    { type: 'text', text: '.', latex: '', spoken: '', visual: '' },
    { type: 'text', text: 'Apoi calculăm.', latex: '', spoken: '', visual: '' },
    { type: 'math', text: '', latex: 'x=2', spoken: 'x este egal cu doi', visual: '' },
    { type: 'text', text: '.', latex: '', spoken: '', visual: '' },
  ]) as { type: string; text?: string }[];

  assert.deepEqual(normalized, [
    { type: 'text', text: 'Aplicăm teorema. Apoi calculăm.', latex: '', spoken: '' },
    { type: 'math', text: '', latex: 'x=2', spoken: 'x este egal cu doi' },
  ]);
});

test('supports long multi-part statements and explanations within bounded limits', () => {
  const problem = Array.from({ length: 25 }, (_, index) => index % 2 === 0
    ? text(`Enunțul continuă în secțiunea ${String.fromCharCode(97 + (index % 3))}.`)
    : math(`x_{${index}}=${index}`, `x indice ${index} este ${index}`));
  const explanation = Array.from({ length: 12 }, (_, index) => index % 2 === 0
    ? text('Aplicăm relația potrivită pentru această etapă.')
    : math(`a_{${index}}=${index}`, `a indice ${index} este ${index}`));
  const parsed = mathAnalysisSchema.safeParse({
    ...solvedLesson(),
    problem,
    steps: [{ ...solvedLesson().steps[0], explanation }],
  });

  assert.equal(parsed.success, true, parsed.success ? 'Analiza lungă este validă.' : JSON.stringify(parsed.error.issues));
  assert.equal(analysisContentLimits.problem, 32);
  assert.equal(analysisContentLimits.explanation, 20);
});

test('summarizes validation telemetry without values or messages', () => {
  const parsed = mathAnalysisSchema.safeParse({ ...solvedLesson(), steps: [] });
  assert.equal(parsed.success, false);
  if (parsed.success) return;
  const summary = summarizeAnalysisValidationIssues(parsed.error);
  assert.deepEqual(summary, [{ code: 'custom', path: 'steps' }]);
  assert.doesNotMatch(JSON.stringify(summary), /Un rezultat|Ecuație|x\^/);
});

test('accepts and renders a structured lesson', async () => {
  const parsed = mathAnalysisSchema.parse(solvedLesson());
  const rendered = await renderMathAnalysis(parsed);

  assert.equal(rendered.schemaVersion, 4);
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

test('accepts geometry, graph, table and number-line visuals', () => {
  const visuals = [
    {
      kind: 'geometry', title: 'Triunghi dreptunghic',
      points: [{ id: 'A', label: 'A', x: 12, y: 86 }, { id: 'B', label: 'B', x: 12, y: 12 }, { id: 'C', label: 'C', x: 88, y: 86 }],
      segments: [{ from: 'A', to: 'B', style: 'solid', color: 'violet' }, { from: 'B', to: 'C', style: 'solid', color: 'cyan' }, { from: 'C', to: 'A', style: 'solid', color: 'peach' }],
      circles: [], polygons: [{ points: ['A', 'B', 'C'], color: 'violet' }],
    },
    {
      kind: 'graph', title: 'Graficul funcției', xMin: -2, xMax: 2, yMin: 0, yMax: 4, xStep: 1, yStep: 1,
      series: [{ label: 'Parabolă', color: 'violet', points: [{ x: -2, y: 4 }, { x: -1, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 4 }] }],
    },
    {
      kind: 'table', title: 'Tabel de valori', headers: ['x', 'Valoare'], rows: [
        { cells: [{ text: '', latex: '0', spoken: 'zero' }, { text: 'origine', latex: '', spoken: '' }] },
        { cells: [{ text: '', latex: '1', spoken: 'unu' }, { text: '', latex: '1', spoken: 'unu' }] },
      ],
    },
    {
      kind: 'number_line', title: 'Intervalul soluțiilor', min: -4, max: 4, step: 1,
      markers: [{ value: -2, label: '−2', closed: true, color: 'violet' }],
      intervals: [{ start: -2, end: 3, startClosed: true, endClosed: false, color: 'violet' }],
    },
  ];

  visuals.forEach((item) => {
    const parsed = mathAnalysisSchema.safeParse({
      ...solvedLesson(),
      steps: [{ ...solvedLesson().steps[0], explanation: [text('Folosim reprezentarea.'), visual(item, 'Reprezentare matematică accesibilă.')] }],
    });
    assert.equal(parsed.success, true, parsed.success ? 'Vizual acceptat.' : JSON.stringify(parsed.error.issues));
  });
});

test('rejects visual references and table dimensions that are not safe', () => {
  const invalidGeometry = {
    kind: 'geometry', title: 'Desen invalid',
    points: [{ id: 'A', label: 'A', x: 10, y: 10 }, { id: 'B', label: 'B', x: 90, y: 90 }],
    segments: [{ from: 'A', to: 'C', style: 'solid', color: 'violet' }], circles: [], polygons: [],
  };
  const invalidTable = {
    kind: 'table', title: 'Tabel invalid', headers: ['x', 'y'],
    rows: [{ cells: [{ text: 'doar o celulă', latex: '', spoken: '' }] }],
  };

  [invalidGeometry, invalidTable].forEach((item) => {
    const parsed = mathAnalysisSchema.safeParse({
      ...solvedLesson(),
      steps: [{ ...solvedLesson().steps[0], explanation: [visual(item, 'Vizual invalid.')] }],
    });
    assert.equal(parsed.success, false);
  });
});

test('renders formulas from structured table cells before storage', async () => {
  const table = {
    kind: 'table', title: 'Tabel de valori', headers: ['x', 'f(x)'],
    rows: [{ cells: [{ text: '', latex: '2', spoken: 'doi' }, { text: '', latex: '4', spoken: 'patru' }] }],
  };
  const parsed = mathAnalysisSchema.parse({
    ...solvedLesson(),
    steps: [{ ...solvedLesson().steps[0], explanation: [visual(table, 'Pentru x egal cu doi, f de x este patru.')] }],
  });
  const rendered = await renderMathAnalysis(parsed);
  const block = rendered.steps[0].explanation[0] as unknown as { visual: { rows: { cells: { rendered: { svg: string } }[] }[] } };
  assert.match(block.visual.rows[0].cells[0].rendered.svg, /^<svg/);
  assert.equal(rendered.schemaVersion, 4);
});

test('renders the production corpus across school mathematics', async () => {
  const rendered = await Promise.all(mathDomainCorpus.map(([, expression]) => renderLatex(expression)));
  assert.equal(rendered.length, mathDomainCorpus.length);
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

test('validates and renders complete lessons across every supported math family', async () => {
  const lessons = await Promise.all(mathDomainCorpus.map(async ([topic, expression]) => {
    const spoken = `Expresie matematică din domeniul ${topic.toLocaleLowerCase('ro-RO')}.`;
    const parsed = mathAnalysisSchema.parse({
      ...solvedLesson(),
      title: topic,
      topic,
      problem: [math(expression, spoken)],
      finalAnswer: [math(expression, spoken)],
      steps: [{
        ...solvedLesson().steps[0],
        explanation: [text('Aplicăm proprietățile potrivite acestui tip de problemă.'), math(expression, spoken)],
      }],
    });
    return renderMathAnalysis(parsed);
  }));

  assert.equal(lessons.length, mathDomainCorpus.length);
  lessons.forEach((lesson) => {
    assert.equal(lesson.status, 'ready');
    assert.match(lesson.problem[0].rendered?.svg ?? '', /^<svg/);
    assert.match(lesson.finalAnswer[0].rendered?.svg ?? '', /^<svg/);
  });
});

test('supports solve, all check verdicts, unclear and not-math outcomes', async () => {
  const readyChecks = ['correct', 'partially_correct', 'incorrect'] as const;
  readyChecks.forEach((verdict) => {
    const parsed = mathAnalysisSchema.safeParse({ ...solvedLesson(), mode: 'check', verdict });
    assert.equal(parsed.success, true, verdict);
  });

  ['unclear', 'not_math'].forEach((status) => {
    const parsed = mathAnalysisSchema.safeParse({
      ...solvedLesson(), status, problem: [], finalAnswer: [], steps: [], takeaways: [],
      summary: [text(status === 'unclear' ? 'Fotografia nu surprinde complet enunțul.' : 'Imaginea nu conține o problemă de matematică.')],
    });
    assert.equal(parsed.success, true, status);
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
