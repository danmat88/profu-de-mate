import { HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';

export const studyTrackSchema = z.enum(['gimnaziu', 'en', 'liceu', 'bac_m1', 'bac_m2', 'bac_m3']);
export const formulaCategorySchema = z.enum([
  'algebra',
  'geometry',
  'trigonometry',
  'matrices',
  'analysis',
  'combinatorics',
]);
export const practiceDifficultySchema = z.enum(['easy', 'medium', 'exam']);

export type StudyTrack = z.infer<typeof studyTrackSchema>;
export type FormulaCategory = z.infer<typeof formulaCategorySchema>;
export type PracticeDifficulty = z.infer<typeof practiceDifficultySchema>;

const REQUEST_ID_PATTERN = /^analysis-[a-z0-9]{6,16}-[a-z0-9]{6,16}$/;
const INSTALLATION_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export type GeneratePracticeRequest = {
  track: StudyTrack;
  category: FormulaCategory;
  difficulty: PracticeDifficulty;
  formulaTitle?: string;
  seedProblemText?: string;
  requestId: string;
  installationToken: string;
};

const practiceTextBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string().trim().min(1).max(900),
  latex: z.literal(''),
  spoken: z.literal(''),
});

const practiceMathBlockSchema = z.object({
  type: z.literal('math'),
  text: z.literal(''),
  latex: z.string().trim().min(1).max(1200),
  spoken: z.string().trim().min(1).max(600),
});

export const practiceContentBlockSchema = z.discriminatedUnion('type', [
  practiceTextBlockSchema,
  practiceMathBlockSchema,
]);

export type PracticeContentBlock = z.infer<typeof practiceContentBlockSchema>;

export const aiPracticeExerciseSchema = z.object({
  title: z.string().trim().min(3).max(120),
  prompt: z.array(practiceContentBlockSchema).min(1).max(16),
  choices: z.tuple([
    z.string().trim().min(1).max(120),
    z.string().trim().min(1).max(120),
    z.string().trim().min(1).max(120),
    z.string().trim().min(1).max(120),
  ]).refine((values) => {
    const normalized = values.map((item) => item.toLocaleLowerCase('ro-RO').replace(/\s+/g, ''));
    return new Set(normalized).size === 4;
  }, 'Cele 4 variante de răspuns trebuie să fie distincte.'),
  correctIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  hint: z.string().trim().min(4).max(360),
  explanation: z.array(practiceContentBlockSchema).min(1).max(24),
});

export type AiPracticeExercise = z.infer<typeof aiPracticeExerciseSchema>;

const contentBlockJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: {
      type: 'string',
      enum: ['text', 'math'],
      description: 'Tipul blocului: text pentru proză românească sau math pentru o formulă LaTeX.',
    },
    text: {
      type: 'string',
      description: 'Text românesc clar doar pentru type="text"; șir gol "" pentru type="math".',
    },
    latex: {
      type: 'string',
      description: 'Formulă LaTeX validă fără delimitatori ($ sau \\[ \\]) doar pentru type="math"; șir gol "" pentru type="text".',
    },
    spoken: {
      type: 'string',
      description: 'Citirea naturală în română doar pentru type="math"; șir gol "" pentru type="text".',
    },
  },
  required: ['type', 'text', 'latex', 'spoken'],
} as const;

// Keep the provider schema strictly compatible with OpenAI Structured Outputs;
// strict array/string bounds and invariants are enforced by Zod after normalization.
export const aiPracticeExerciseJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: {
      type: 'string',
      description: 'Titlu scurt în română (3-10 cuvinte), max 100 caractere.',
    },
    prompt: {
      type: 'array',
      items: contentBlockJsonSchema,
      description: 'Enunțul complet al exercițiului, 1-10 blocuri ordonate de tip text și math.',
    },
    choices: {
      type: 'array',
      items: { type: 'string' },
      description: 'Exact 4 variante distincte de răspuns în Unicode curat, fără prefixe A)/B)/C)/D).',
    },
    correctIndex: {
      type: 'integer',
      enum: [0, 1, 2, 3],
      description: 'Indexul (0, 1, 2 sau 3) al singurei variante corecte din choices.',
    },
    hint: {
      type: 'string',
      description: 'Indiciu scurt de 1 propoziție care ajută fără să dezvăluie răspunsul.',
    },
    explanation: {
      type: 'array',
      items: contentBlockJsonSchema,
      description: 'Rezolvare pas cu pas în 1-14 blocuri ordonate de tip text și math.',
    },
  },
  required: ['title', 'prompt', 'choices', 'correctIndex', 'hint', 'explanation'],
} as const;

export function sanitizePracticeLatex(raw: string): string {
  let latex = raw.trim();
  // Unwrap accidental outer math delimiters only when they wrap the entire
  // expression (never strip multi-span expressions like "$x=2$ sau $x=-2$").
  for (let i = 0; i < 2; i += 1) {
    if (latex.startsWith('$$') && latex.endsWith('$$') && latex.length > 4) {
      const inner = latex.slice(2, -2);
      if (!inner.includes('$')) latex = inner.trim();
    } else if (latex.startsWith('$') && latex.endsWith('$') && latex.length > 2) {
      const inner = latex.slice(1, -1);
      if (!inner.includes('$')) latex = inner.trim();
    } else if (latex.startsWith('\\[') && latex.endsWith('\\]') && latex.length > 4) {
      const inner = latex.slice(2, -2);
      if (!inner.includes('\\[') && !inner.includes('\\]')) latex = inner.trim();
    } else if (latex.startsWith('\\(') && latex.endsWith('\\)') && latex.length > 4) {
      const inner = latex.slice(2, -2);
      if (!inner.includes('\\(') && !inner.includes('\\)')) latex = inner.trim();
    }
  }

  return latex
    .replace(/\\arctg(?![A-Za-z])/g, '\\operatorname{arctg}')
    .replace(/\\arcctg(?![A-Za-z])/g, '\\operatorname{arcctg}')
    .replace(/\\ctg(?![A-Za-z])/g, '\\operatorname{ctg}')
    .replace(/\\tg(?![A-Za-z])/g, '\\operatorname{tg}')
    .replace(/\\sh(?![A-Za-z])/g, '\\sinh')
    .replace(/\\ch(?![A-Za-z])/g, '\\cosh')
    .replace(/\\triangle(?![A-Za-z])/g, '\\Delta')
    .replace(/\\frown(?![A-Za-z])/g, '\\widehat')
    .replace(/\\setminus(?![A-Za-z])/g, '\\backslash')
    .replace(/\\mathcal\{([A-Za-z])\}/g, '\\mathrm{$1}')
    .replace(/−/g, '-')
    .replace(/·/g, ' \\cdot ')
    .replace(/×/g, ' \\times ')
    .replace(/÷/g, ' \\div ')
    .replace(/≤/g, ' \\le ')
    .replace(/≥/g, ' \\ge ')
    .replace(/≠/g, ' \\ne ')
    .replace(/±/g, ' \\pm ')
    .replace(/∞/g, '\\infty')
    .replace(/π/g, '\\pi')
    .replace(/∈/g, ' \\in ')
    .replace(/∉/g, ' \\notin ')
    .replace(/⇒/g, ' \\implies ')
    .replace(/⇔/g, ' \\iff ')
    .replace(/ℝ/g, '\\mathbb{R}')
    .replace(/ℕ/g, '\\mathbb{N}')
    .replace(/ℤ/g, '\\mathbb{Z}')
    .replace(/ℚ/g, '\\mathbb{Q}')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampString(value: string, maxLength: number): string {
  const cleaned = value.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function normalizeBlockList(rawList: unknown, maxBlocks: number): unknown {
  if (!Array.isArray(rawList)) return rawList;

  const normalized: Array<{ type: 'text' | 'math'; text: string; latex: string; spoken: string }> = [];

  for (const item of rawList) {
    if (typeof item === 'string') {
      const text = clampString(item, 900);
      if (text) normalized.push({ type: 'text', text, latex: '', spoken: '' });
      continue;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

    const record = item as Record<string, unknown>;
    const rawType = typeof record.type === 'string' ? record.type.trim().toLowerCase() : '';
    const rawText = typeof record.text === 'string' ? record.text.trim() : '';
    const rawLatex = typeof record.latex === 'string' ? record.latex.trim() : '';
    const rawSpoken = typeof record.spoken === 'string' ? record.spoken.trim() : '';

    const inferredType: 'text' | 'math' = rawType === 'math'
      ? 'math'
      : rawType === 'text'
        ? 'text'
        : rawLatex && !rawText
          ? 'math'
          : 'text';

    if (inferredType === 'math') {
      const latex = clampString(sanitizePracticeLatex(rawLatex || rawText), 1200);
      if (!latex) continue;
      const spoken = clampString(rawSpoken || rawText || 'expresie matematică', 600);
      normalized.push({ type: 'math', text: '', latex, spoken });
    } else {
      const text = clampString(rawText || rawSpoken, 900);
      if (!text) continue;
      const previous = normalized.at(-1);
      if (previous?.type === 'text' && previous.text.length + text.length + 1 <= 900) {
        const sep = /^[,.;:!?…]/u.test(text) ? '' : ' ';
        previous.text = `${previous.text}${sep}${text}`;
      } else {
        normalized.push({ type: 'text', text, latex: '', spoken: '' });
      }
    }
  }

  return normalized.slice(0, maxBlocks);
}

function normalizeChoiceValue(raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  if (typeof raw !== 'string') return '';
  let value = raw.replace(/\s+/g, ' ').trim();
  // Strip accidental "A) ", "b. ", "C: " prefixes if present.
  value = value.replace(/^[A-Da-d]\s*[).:]\s+/, '').trim();
  // Strip wrapping single-$ only when it wraps one complete span with no
  // interior $ delimiters or TeX macros.
  if (value.startsWith('$') && value.endsWith('$') && value.length > 2 && !value.includes('\\')) {
    const inner = value.slice(1, -1);
    if (!inner.includes('$')) {
      value = inner.trim();
    }
  }
  return clampString(value, 120);
}

function normalizeCorrectIndex(raw: unknown): unknown {
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim().toUpperCase();
    if (/^[0-3]$/.test(trimmed)) return Number(trimmed);
    const letterIdx = ['A', 'B', 'C', 'D'].indexOf(trimmed);
    if (letterIdx >= 0) return letterIdx;
  }
  return raw;
}

/**
 * Cleans common AI structured-output quirks (e.g., populated `spoken` on
 * `text` blocks, `$...$` wrapped LaTeX, `A) ` choice prefixes, stringified
 * `correctIndex`, or over-fragmented text blocks) before strict Zod validation.
 */
export function normalizeRawPracticeExercise(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const record = raw as Record<string, unknown>;

  const title = typeof record.title === 'string'
    ? clampString(record.title.trim().replace(/^["'#*]+|["'#*]+$/g, ''), 120)
    : record.title;

  const choices = Array.isArray(record.choices)
    ? record.choices.slice(0, 4).map(normalizeChoiceValue)
    : record.choices;

  const rawHint = typeof record.hint === 'string'
    ? record.hint.replace(/^indiciu\s*:\s*/i, '')
    : '';
  const hint = rawHint.trim().length >= 4
    ? clampString(rawHint, 360)
    : 'Aplică pas cu pas formula de bază a capitolului și verifică semnele.';

  return {
    title,
    prompt: normalizeBlockList(record.prompt, 16),
    choices,
    correctIndex: normalizeCorrectIndex(record.correctIndex),
    hint,
    explanation: normalizeBlockList(record.explanation, 24),
  };
}

export function extractJsonPayload(rawText: string): string {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  return trimmed;
}

export function summarizePracticeValidationIssues(error: unknown): { code: string; path: string }[] {
  if (!error || typeof error !== 'object' || !Array.isArray((error as { issues?: unknown }).issues)) return [];
  return (error as { issues: { code?: unknown; path?: unknown }[] }).issues.slice(0, 10).map((issue) => ({
    code: typeof issue.code === 'string' ? issue.code : 'unknown',
    path: Array.isArray(issue.path)
      ? issue.path.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number').join('.')
      : '',
  }));
}

function optionalTrimmedString(value: unknown, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', 'Datele exercițiului nu sunt valide.');
  }
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return undefined;
  if (cleaned.length > maxLength) {
    throw new HttpsError('invalid-argument', 'Descrierea capitolului este prea lungă.');
  }
  return cleaned;
}

export function parseGeneratePracticeRequest(value: unknown): GeneratePracticeRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'Cererea de generare nu este validă.');
  }
  const data = value as Record<string, unknown>;
  const track = studyTrackSchema.safeParse(data.track);
  const category = formulaCategorySchema.safeParse(data.category);
  const difficulty = practiceDifficultySchema.safeParse(data.difficulty);
  if (!track.success || !category.success || !difficulty.success) {
    throw new HttpsError('invalid-argument', 'Nivelul, capitolul sau dificultatea nu sunt valide.');
  }
  if (typeof data.requestId !== 'string' || !REQUEST_ID_PATTERN.test(data.requestId)) {
    throw new HttpsError('invalid-argument', 'Identificatorul cererii nu este valid.');
  }
  if (typeof data.installationToken !== 'string' || !INSTALLATION_TOKEN_PATTERN.test(data.installationToken)) {
    throw new HttpsError('invalid-argument', 'Identitatea instalării nu este validă.');
  }

  const formulaTitle = optionalTrimmedString(data.formulaTitle, 140);
  const seedProblemText = optionalTrimmedString(data.seedProblemText, 400);

  return {
    track: track.data,
    category: category.data,
    difficulty: difficulty.data,
    ...(formulaTitle ? { formulaTitle } : {}),
    ...(seedProblemText ? { seedProblemText } : {}),
    requestId: data.requestId,
    installationToken: data.installationToken,
  };
}
