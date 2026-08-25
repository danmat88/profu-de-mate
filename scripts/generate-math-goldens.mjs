import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderLatex } from '../functions/lib/mathRenderer.js';
import { buildMathDocumentHtml } from '../src/utils/mathDocument.ts';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'artifacts', 'math-goldens');

const fontUrl = (...parts) => pathToFileURL(path.join(root, ...parts)).href;
const fonts = {
  bodyRegular: fontUrl('node_modules', '@expo-google-fonts', 'fira-sans', '400Regular', 'FiraSans_400Regular.ttf'),
  bodySemibold: fontUrl('node_modules', '@expo-google-fonts', 'fira-sans', '600SemiBold', 'FiraSans_600SemiBold.ttf'),
  display: fontUrl('node_modules', '@expo-google-fonts', 'balsamiq-sans', '700Bold', 'BalsamiqSans_700Bold.ttf'),
};

const text = (value) => ({ type: 'text', text: value, latex: '', spoken: '' });
const math = async (latex, spoken) => ({
  type: 'math',
  text: '',
  latex,
  spoken,
  rendered: await renderLatex(latex),
});

const visual = (value, spoken) => ({
  type: 'visual',
  text: '',
  latex: '',
  spoken,
  visual: value,
});

async function symbolicFixture() {
  const inline = await math('\\frac{3}{4}+\\frac{5}{6}=\\frac{19}{12}', 'trei pătrimi plus cinci șesimi este egal cu nouăsprezece doisprezecimi');
  const system = await math('\\begin{cases}2x+y=5\\\\x-y=1\\end{cases}', 'sistemul format din doi x plus y egal cu cinci și x minus y egal cu unu');
  const matrix = await math('A^{2}=\\begin{pmatrix}1&2\\\\3&0\\end{pmatrix}\\begin{pmatrix}1&2\\\\3&0\\end{pmatrix}=\\begin{pmatrix}7&2\\\\3&6\\end{pmatrix}', 'A la pătrat este produsul matricelor și rezultă matricea cu elementele șapte, doi, trei și șase');
  const wide = await math('\\frac{(x_{1}+x_{2}+x_{3}+x_{4}+x_{5}+x_{6}+x_{7}+x_{8}+x_{9}+x_{10}+x_{11}+x_{12})^{2}}{12^{2}}\\leq\\frac{x_{1}^{2}+x_{2}^{2}+x_{3}^{2}+x_{4}^{2}+x_{5}^{2}+x_{6}^{2}+x_{7}^{2}+x_{8}^{2}+x_{9}^{2}+x_{10}^{2}+x_{11}^{2}+x_{12}^{2}}{12}', 'pătratul mediei aritmetice este mai mic sau egal cu media pătratelor');

  return {
    accessibilityLabel: 'Fixture pentru formule matematice',
    variant: 'lesson',
    sections: [
      { kind: 'heading', eyebrow: 'REGRESIE VIZUALĂ', title: 'Formule, sisteme și matrici', tone: 'cyan' },
      { kind: 'content', content: [text('O formulă obișnuită trebuie să curgă firesc lângă explicație:'), inline] },
      { kind: 'section_title', eyebrow: 'STRUCTURI', title: 'Sistem și matrice' },
      { kind: 'content', content: [system, matrix] },
      { kind: 'note', label: 'FORMULĂ LATĂ', content: [text('Formula următoare trebuie să rămână completă și să ofere scroll numai când chiar este necesar.'), wide], tone: 'lime' },
    ],
  };
}

async function visualFixture() {
  const tableMath = await math('x^{2}', 'x la pătrat');
  return {
    accessibilityLabel: 'Fixture pentru vizualuri matematice',
    variant: 'lesson',
    sections: [
      { kind: 'heading', eyebrow: 'REGRESIE VIZUALĂ', title: 'Reprezentări structurate', tone: 'peach' },
      {
        kind: 'content',
        content: [
          visual({
            kind: 'geometry',
            title: 'Triunghi dreptunghic',
            points: [
              { id: 'A', label: 'A', x: 14, y: 82 },
              { id: 'B', label: 'B', x: 86, y: 82 },
              { id: 'C', label: 'C', x: 14, y: 18 },
            ],
            segments: [
              { from: 'A', to: 'B', style: 'solid', color: 'violet' },
              { from: 'A', to: 'C', style: 'solid', color: 'cyan' },
              { from: 'B', to: 'C', style: 'solid', color: 'peach' },
            ],
            circles: [],
            polygons: [{ points: ['A', 'B', 'C'], color: 'cyan' }],
          }, 'Triunghiul A B C este dreptunghic în A.'),
          visual({
            kind: 'graph',
            title: 'Graficul unei parabole',
            xMin: -3,
            xMax: 3,
            yMin: -1,
            yMax: 9,
            xStep: 1,
            yStep: 2,
            series: [{
              label: 'f de x egal cu x la pătrat',
              color: 'violet',
              points: [
                { x: -3, y: 9 }, { x: -2, y: 4 }, { x: -1, y: 1 },
                { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 4 }, { x: 3, y: 9 },
              ],
            }],
          }, 'Parabola cu vârful în origine.'),
          visual({
            kind: 'table',
            title: 'Tabel de valori',
            headers: ['x', 'f(x)', 'Observație'],
            rows: [
              { cells: [{ text: '−1', latex: '', spoken: '' }, { text: '', latex: tableMath.latex, spoken: tableMath.spoken, rendered: tableMath.rendered }, { text: 'pozitiv', latex: '', spoken: '' }] },
              { cells: [{ text: '0', latex: '', spoken: '' }, { text: '0', latex: '', spoken: '' }, { text: 'minim', latex: '', spoken: '' }] },
            ],
          }, 'Tabel cu valorile funcției și observațiile asociate.'),
          visual({
            kind: 'number_line',
            title: 'Mulțimea soluțiilor',
            min: -4,
            max: 4,
            step: 1,
            markers: [{ value: 0, label: '0', closed: true, color: 'violet' }],
            intervals: [{ start: -2, end: 3, startClosed: false, endClosed: true, color: 'cyan' }],
          }, 'Intervalul de la minus doi deschis până la trei închis.'),
        ],
      },
    ],
  };
}

await mkdir(output, { recursive: true });
const fixtures = [
  ['symbolic', await symbolicFixture()],
  ['visuals', await visualFixture()],
];

for (const [name, definition] of fixtures) {
  const html = buildMathDocumentHtml(definition, fonts);
  if (name === 'symbolic' && !html.includes('math-display is-wide')) {
    throw new Error('Fixture-ul simbolic nu mai acoperă formula excepțional de lată.');
  }
  await writeFile(path.join(output, name + '.html'), html, 'utf8');
}

process.stdout.write(output + '\n');
