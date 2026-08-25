import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { MathContentBlock, RichContent, VisualContentBlock } from '../src/types.ts';
import {
  buildMathDocumentHtml,
  buildMathDocumentMarkup,
  buildMathDocumentUpdateScript,
  renderRichMathDocument,
  sanitizeDocumentSvg,
} from '../src/utils/mathDocument.ts';

function math(latex: string, spoken: string, widthEx = 7, heightEx = 2): MathContentBlock {
  return {
    type: 'math', text: '', latex, spoken,
    rendered: {
      svg: '<svg viewBox="0 0 20 10"><defs><path id="glyph" d="M0 0h10v10z"/></defs><use href="#glyph"/></svg>',
      viewBox: '0 0 20 10', widthEx, heightEx, depthEx: 0.2,
    },
  };
}

test('escapes provider prose and removes executable SVG content', () => {
  const maliciousSvg = '<svg viewBox="0 0 10 10" onload="steal()"><script>steal()</script><style>@font-face{src:url(https://evil.example/font)}</style><foreignObject>bad</foreignObject><path id="a" d="M0 0"/><use href="https://evil.example/a"/><use href="#a"/></svg>';
  const content: RichContent = [
    { type: 'text', text: '<img src=x onerror=steal()>', latex: '', spoken: '' },
    { ...math('x=1', 'x egal cu unu'), rendered: { ...math('x=1', 'x').rendered, svg: maliciousSvg } },
  ];
  const html = renderRichMathDocument(content);

  assert.match(html, /&lt;img src=x onerror=steal\(\)&gt;/);
  assert.doesNotMatch(html, /<script|<style|foreignObject|onload=|evil\.example/);
  assert.match(html, /href="#doc-1-a"/);
});

test('namespaces repeated formula glyph ids inside one document', () => {
  const content: RichContent = [math('x=1', 'x egal cu unu'), math('x=1', 'x egal cu unu')];
  const html = renderRichMathDocument(content);

  assert.match(html, /id="doc-1-glyph"/);
  assert.match(html, /href="#doc-1-glyph"/);
  assert.match(html, /id="doc-2-glyph"/);
  assert.match(html, /href="#doc-2-glyph"/);
});

test('flows compact mathematics inline and keeps complex mathematics in a derivation', () => {
  const content: RichContent = [
    { type: 'text', text: 'Obținem', latex: '', spoken: '' },
    math('AB=6', 'A B egal cu șase'),
    { type: 'text', text: 'din relația de mai sus.', latex: '', spoken: '' },
    math('\\begin{aligned}x+y&=4\\\\x-y&=2\\end{aligned}', 'sistemul de ecuații', 22, 6),
  ];
  const html = renderRichMathDocument(content);

  assert.match(html, /<p>Obținem <span class="math-inline"/);
  assert.match(html, /din relația de mai sus\.<\/p>/);
  assert.match(html, /<div class="derivation"><div class="math-display/);
});

test('groups labels with their own final answers', () => {
  const content: RichContent = [
    { type: 'text', text: 'a)', latex: '', spoken: '' },
    math('AB=6\\,\\mathrm m', 'A B egal cu șase metri'),
    { type: 'text', text: 'b)', latex: '', spoken: '' },
    math('\\angle AOB=90^{\\circ}', 'unghiul A O B este nouăzeci de grade', 12, 2.5),
  ];
  const html = renderRichMathDocument(content);

  assert.equal((html.match(/class="subproblem"/g) ?? []).length, 2);
  assert.match(html, /subproblem-label">a\)<\/span>/);
  assert.match(html, /subproblem-label">b\)<\/span>/);
});

test('separates subproblems when the provider returns every label in one prose block', () => {
  const content: RichContent = [
    { type: 'text', text: 'a) Calculăm lungimea muchiei. b) Aflăm măsura unghiului. c) Scriem concluzia.', latex: '', spoken: '' },
  ];
  const html = renderRichMathDocument(content);

  assert.equal((html.match(/class="subproblem"/g) ?? []).length, 3);
  assert.match(html, /subproblem-label">a\)<\/span>/);
  assert.match(html, /subproblem-label">b\)<\/span>/);
  assert.match(html, /subproblem-label">c\)<\/span>/);
  assert.match(html, /Aflăm măsura unghiului\./);
});

test('does not mistake a subproblem reference inside a sentence for a new section', () => {
  const html = renderRichMathDocument([
    { type: 'text', text: 'Astfel, verificarea cerută la punctul a) este confirmată complet.', latex: '', spoken: '' },
  ]);

  assert.doesNotMatch(html, /class="subproblem"/);
  assert.match(html, /punctul a\) este confirmată complet\./);
});

test('groups subproblem labels spread across prose blocks around formulas', () => {
  const html = renderRichMathDocument([
    { type: 'text', text: 'Folosim datele din figură', latex: '', spoken: '' },
    math('VA=6', 'V A egal cu șase'),
    { type: 'text', text: 'iar apoi a) verificăm lungimea', latex: '', spoken: '' },
    math('AB=6', 'A B egal cu șase'),
    { type: 'text', text: 'și b) determinăm unghiul cerut.', latex: '', spoken: '' },
  ]);

  assert.equal((html.match(/class="subproblem"/g) ?? []).length, 2);
  assert.match(html, /subproblem-label">a\)<\/span>/);
  assert.match(html, /subproblem-label">b\)<\/span>/);
});

test('fits ordinary display mathematics and scrolls only exceptionally long formulas', () => {
  const ordinary = renderRichMathDocument([math('x_1+x_2=12', 'x unu plus x doi egal cu doisprezece', 26, 3)]);
  const exceptional = renderRichMathDocument([math('\\begin{aligned}a&=b\\\\c&=d\\end{aligned}', 'o derivare foarte lungă', 90, 6)]);

  assert.doesNotMatch(ordinary, /math-display is-wide/);
  assert.match(exceptional, /math-display is-wide/);
});

test('contains wide formulas and tables without widening the document viewport', () => {
  const html = buildMathDocumentHtml({
    accessibilityLabel: 'Document lat',
    variant: 'lesson',
    sections: [{ kind: 'content', content: [math('x_1+\\cdots+x_n', 'sumă lungă', 90, 4)] }],
  });

  assert.match(html, /html,body\{width:100%;max-width:100%;[^}]*overflow-x:hidden/);
  assert.match(html, /#document\{width:100%;max-width:100%;overflow-x:hidden/);
  assert.match(html, /\.math-display\{width:100%;max-width:100%;overflow:hidden/);
  assert.match(html, /\.table-scroll\{width:100%;min-width:0;max-width:100%;overflow-x:auto/);
});

test('renders every structured visual family inside the same document', () => {
  const visuals: VisualContentBlock[] = [
    {
      type: 'visual', text: '', latex: '', spoken: 'Un segment.',
      visual: { kind: 'geometry', title: 'Segmentul AB', points: [{ id: 'A', label: 'A', x: 10, y: 50 }, { id: 'B', label: 'B', x: 90, y: 50 }], segments: [{ from: 'A', to: 'B', style: 'solid', color: 'violet' }], circles: [], polygons: [] },
    },
    {
      type: 'visual', text: '', latex: '', spoken: 'Grafic liniar.',
      visual: { kind: 'graph', title: 'Grafic', xMin: -1, xMax: 1, yMin: -1, yMax: 1, xStep: 1, yStep: 1, series: [{ label: 'Dreaptă', color: 'cyan', points: [{ x: -1, y: -1 }, { x: 1, y: 1 }] }] },
    },
    {
      type: 'visual', text: '', latex: '', spoken: 'Tabel de valori.',
      visual: { kind: 'table', title: 'Tabel', headers: ['x', 'f(x)'], rows: [{ cells: [{ text: 'unu', latex: '', spoken: '' }, { text: '', latex: '2', spoken: 'doi', rendered: math('2', 'doi').rendered }] }] },
    },
    {
      type: 'visual', text: '', latex: '', spoken: 'Interval numeric.',
      visual: { kind: 'number_line', title: 'Interval', min: -2, max: 2, step: 1, markers: [{ value: 0, label: '0', closed: true, color: 'violet' }], intervals: [{ start: -1, end: 1, startClosed: true, endClosed: false, color: 'cyan' }] },
    },
  ];
  const html = renderRichMathDocument(visuals);

  ['DESEN GEOMETRIC', 'GRAFIC', 'TABEL', 'AXĂ NUMERICĂ'].forEach((label) => assert.match(html, new RegExp(label)));
  assert.match(html, /<table>/);
  assert.equal((html.match(/class="structured-visual"/g) ?? []).length, 4);
});

test('builds a local locked-down WebView shell and a bounded update command', () => {
  const definition = {
    accessibilityLabel: 'Pas matematic',
    variant: 'lesson' as const,
    sections: [
      { kind: 'heading' as const, eyebrow: 'PASUL 1', title: 'Calculăm latura' },
      { kind: 'content' as const, content: [math('AB=6', 'A B egal cu șase')] },
    ],
  };
  const markup = buildMathDocumentMarkup(definition);
  const shell = buildMathDocumentHtml(definition, { bodyRegular: 'file:///safe/font.ttf' });
  const update = buildMathDocumentUpdateScript(definition, '2');

  assert.match(markup, /Calculăm latura/);
  assert.match(shell, /Content-Security-Policy/);
  assert.match(shell, /connect-src 'none'/);
  assert.match(shell, /window\.__setDocument/);
  assert.match(shell, /document\.fonts\.ready/);
  assert.doesNotMatch(shell, /cdn\.jsdelivr|https:\/\/safe/);
  assert.match(update, /^window\.__setDocument\(/);
  assert.ok(update.length < shell.length);
});

test('keeps the native WebView bridge local and cookie-free', async () => {
  const source = await readFile(new URL('../src/components/MathDocumentView.tsx', import.meta.url), 'utf8');

  assert.match(source, /sharedCookiesEnabled=\{false\}/);
  assert.match(source, /thirdPartyCookiesEnabled=\{false\}/);
  assert.match(source, /allowUniversalAccessFromFileURLs=\{false\}/);
  assert.match(source, /mixedContentMode="never"/);
  assert.match(source, /onShouldStartLoadWithRequest/);
  assert.doesNotMatch(source, /originWhitelist=\{\['\*'\]\}/);
});

test('uses one math document in the lesson and summary, while the notebook stays formula-free', async () => {
  const [lesson, summary, notebook] = await Promise.all([
    readFile(new URL('../src/screens/LessonScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/screens/SummaryScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/screens/NotebookScreen.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(lesson, /<MathDocumentView definition=\{lessonDocument\}/);
  assert.match(summary, /<MathDocumentView definition=\{summaryDocument\}/);
  assert.doesNotMatch(lesson, /<RichMathContent/);
  assert.doesNotMatch(summary, /<RichMathContent/);
  assert.doesNotMatch(notebook, /<RichMathContent/);
  assert.doesNotMatch(notebook, /<(?:InlineMathFormula|MathFormula|MathDocumentView)/);
  assert.doesNotMatch(notebook, /<MathDocumentView/);
});

test('returns an empty string for a non-SVG payload', () => {
  assert.equal(sanitizeDocumentSvg('<img src=x>', 'safe'), '');
});
