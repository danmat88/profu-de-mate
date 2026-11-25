import type {
  FormulaCategory,
  GeneratePracticeRequest,
  PracticeDifficulty,
  StudyTrack,
} from './practiceSchema.js';

const TRACK_LABELS: Record<StudyTrack, string> = {
  gimnaziu: 'Gimnaziu România (clasele V–VII)',
  en: 'Evaluarea Națională (clasa a VIII-a, programa oficială MEN)',
  liceu: 'Liceu România (clasele IX–XI)',
  bac_m1: 'Bacalaureat Matematică M1 (Mate-Info, programa MEN)',
  bac_m2: 'Bacalaureat Matematică M2 (Științe ale Naturii, programa MEN)',
  bac_m3: 'Bacalaureat Matematică M3 (Tehnologic, programa MEN)',
};

const CATEGORY_LABELS: Record<FormulaCategory, string> = {
  algebra: 'Algebră, calcul algebric, ecuații, funcții, progresii, logaritmi',
  geometry: 'Geometrie plană, geometrie în spațiu sau geometrie analitică',
  trigonometry: 'Trigonometrie și relații metrice în triunghi',
  combinatorics: 'Combinatorică și probabilități',
  matrices: 'Matrice, determinanți, legi de compoziție sau polinoame',
  analysis: 'Analiză matematică: limite, derivate, tangente, integrale definite',
};

const DIFFICULTY_INSTRUCTIONS: Record<PracticeDifficulty, string> = {
  easy: 'Ușor: aplicare directă a unei singure formule, numere curate, rezolvare în 2–3 pași.',
  medium: 'Mediu: nivel tipic de subiect I/II de examen, cu 2–4 pași clari și un distractor de semn/formulă.',
  exam: 'Nivel Examen: item autentic de Evaluarea Națională sau BAC, cu verificare riguroasă a condițiilor.',
};

export function buildPracticePrompt(request: GeneratePracticeRequest): string {
  const lines = [
    'Ești Profu’ de mate, un profesor de matematică din România foarte clar, riguros și prietenos.',
    'Compune UN SINGUR exercițiu original de matematică în limba română (cu diacritice corecte: ă, â, î, ș, ț), cu exact 4 variante distincte de răspuns și exact 1 variantă corectă.',
    '',
    `NIVEL: ${TRACK_LABELS[request.track]}`,
    `CAPITOL: ${CATEGORY_LABELS[request.category]}`,
    `DIFICULTATE: ${DIFFICULTY_INSTRUCTIONS[request.difficulty]}`,
  ];

  if (request.formulaTitle) {
    lines.push(`FORMULĂ / TEMĂ ȚINTĂ: ${request.formulaTitle}`);
  }
  if (request.seedProblemText) {
    lines.push(`INSPIRAȚIE (creează un exercițiu ASEMĂNĂTOR, dar cu alte numere/date, NU copia enunțul): ${request.seedProblemText}`);
  }

  lines.push(
    '',
    'REGULI STRICTE:',
    '1. Verifică matematic fiecare calcul de două ori înainte de a alege correctIndex (0, 1, 2 sau 3).',
    '2. Folosește blocuri { "type": "text", "text": "...", "latex": "", "spoken": "" } pentru explicațiile în română (fără simboluri $ în text) și blocuri { "type": "math", "text": "", "latex": "...", "spoken": "..." } pentru ecuații și formule LaTeX valide (fără $, \\[ \\] sau \\tg — folosește \\operatorname{tg}).',
    '3. Variantele din `choices` trebuie să fie exact 4 șiruri distincte, fără prefixe A)/B)/C)/D). Pentru numere și expresii simple folosește Unicode curat (ex. "5/2", "4x² − 12x + 9", "9√3 cm²", "e − 1"); pentru matrice sau fracții complexe folosește LaTeX valid (ex. "$\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$"), niciodată paranteze ASCII de tip "[[1,2],[3,4]]".',
    '4. `hint` trebuie să fie un indiciu scurt de 1 propoziție care ajută fără să dezvăluie răspunsul final.',
    '5. `explanation` trebuie să arate pas cu pas cum se ajunge sigur la răspunsul din choices[correctIndex].',
    '6. Răspunde STRICT în JSON valid conform schemei, fără text în afara JSON-ului.',
  );

  return lines.join('\n');
}

export function buildPracticeRepairPrompt(
  issues: readonly { code: string; path: string }[],
  stage: 'json' | 'schema',
): string {
  const summary = issues.length > 0
    ? issues.map((issue) => `${issue.path || 'root'} (${issue.code})`).join(', ')
    : stage === 'json'
      ? 'JSON incomplet sau invalid'
      : 'structura nu respectă schema';
  return [
    'Repară obiectul JSON de mai jos astfel încât să respecte STRICT schema de exercițiu matematic.',
    `Probleme detectate: ${summary}.`,
    'Asigură-te că:',
    '- `prompt` și `explanation` conțin doar blocuri `text` (cu latex="" și spoken="") și blocuri `math` (cu text="", latex valid fără $, spoken nevid).',
    '- `choices` are EXACT 4 variante distincte de răspuns.',
    '- `correctIndex` este 0, 1, 2 sau 3 și corespunde calculului din `explanation`.',
    'Returnează STRICT obiectul JSON reparat.',
  ].join('\n');
}
