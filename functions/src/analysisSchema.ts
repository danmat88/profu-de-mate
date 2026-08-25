import { z } from 'zod';

export const flowModeSchema = z.enum(['solve', 'check']);
export const analysisStatusSchema = z.enum(['ready', 'not_math', 'unclear']);
export const verdictSchema = z.enum(['correct', 'partially_correct', 'incorrect', 'not_applicable']);

const rawMathPattern = /(?:\d|[$]|\\(?:frac|dfrac|tfrac|sqrt|begin|end|sum|prod|int|oint|lim|overline|vec|hat|bar|binom|det|log|ln|sin|cos|tan|cot|Delta|angle|triangle|mathbb|mathrm)\b|sqrt\s*\(|[A-Za-z0-9})\]]\s*[\^_]\s*[{(A-Za-z0-9]|[=<>≤≥≠≈±×÷√∫∑∏∞∈∉⊂⊆⊃⊇∪∩⊥∥∆Δ])/i;
const structuralNumberReferencePattern = /\b(?:figura|fig\.?|pasul|pas|exercițiul|exerciţiul|problema|subpunctul|capitolul|clasa|schema|tabelul|rândul|coloana|pagina)\s+(?:nr\.\s*)?\d+[a-z]?\b/giu;
const punctuationOnlyPattern = /^[,.;:!?…\s]+$/u;

export const analysisContentLimits = {
  problem: 32,
  summary: 3,
  finalAnswer: 4,
  explanation: 20,
  note: 4,
  alternative: 12,
  takeaway: 4,
} as const;

function containsRawMathNotation(value: string): boolean {
  const withoutStructuralReferences = value.replace(structuralNumberReferencePattern, '');
  return rawMathPattern.test(withoutStructuralReferences);
}
const visualColorSchema = z.enum(['violet', 'cyan', 'lime', 'peach', 'rose']);
const visualIdSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,11}$/);
const normalizedCoordinateSchema = z.number().finite().min(0).max(100);
const boundedNumberSchema = z.number().finite().min(-10000).max(10000);

const textContentBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string().trim().min(1).max(900)
    .refine((value) => !punctuationOnlyPattern.test(value), 'Punctuația nu poate forma singură un bloc text.')
    .refine((value) => !containsRawMathNotation(value), 'Notația matematică brută trebuie mutată într-un bloc math.'),
  latex: z.literal(''),
  spoken: z.literal(''),
});

const mathContentBlockSchema = z.object({
  type: z.literal('math'),
  text: z.literal(''),
  latex: z.string().trim().min(1).max(1600),
  spoken: z.string().trim().min(1).max(900),
});

const geometryPointSchema = z.object({
  id: visualIdSchema,
  label: z.string().trim().max(12),
  x: normalizedCoordinateSchema,
  y: normalizedCoordinateSchema,
});

const geometryVisualSchema = z.object({
  kind: z.literal('geometry'),
  title: z.string().trim().min(1).max(80),
  points: z.array(geometryPointSchema).min(2).max(16),
  segments: z.array(z.object({
    from: visualIdSchema,
    to: visualIdSchema,
    style: z.enum(['solid', 'dashed']),
    color: visualColorSchema,
  })).max(24),
  circles: z.array(z.object({
    center: visualIdSchema,
    radius: z.number().finite().min(2).max(50),
    color: visualColorSchema,
  })).max(6),
  polygons: z.array(z.object({
    points: z.array(visualIdSchema).min(3).max(10),
    color: visualColorSchema,
  })).max(6),
}).superRefine((visual, context) => {
  const ids = new Set<string>();
  visual.points.forEach((point, index) => {
    if (ids.has(point.id)) context.addIssue({ code: 'custom', path: ['points', index, 'id'], message: 'Identificator de punct duplicat.' });
    ids.add(point.id);
  });
  visual.segments.forEach((segment, index) => {
    if (!ids.has(segment.from) || !ids.has(segment.to) || segment.from === segment.to) {
      context.addIssue({ code: 'custom', path: ['segments', index], message: 'Segmentul trebuie să unească două puncte distincte existente.' });
    }
  });
  visual.circles.forEach((circle, index) => {
    if (!ids.has(circle.center)) context.addIssue({ code: 'custom', path: ['circles', index, 'center'], message: 'Centrul cercului nu există.' });
  });
  visual.polygons.forEach((polygon, index) => {
    if (polygon.points.some((id) => !ids.has(id)) || new Set(polygon.points).size < 3) {
      context.addIssue({ code: 'custom', path: ['polygons', index], message: 'Poligonul trebuie să folosească cel puțin trei puncte distincte existente.' });
    }
  });
});

const graphVisualSchema = z.object({
  kind: z.literal('graph'),
  title: z.string().trim().min(1).max(80),
  xMin: boundedNumberSchema,
  xMax: boundedNumberSchema,
  yMin: boundedNumberSchema,
  yMax: boundedNumberSchema,
  xStep: z.number().finite().positive().max(10000),
  yStep: z.number().finite().positive().max(10000),
  series: z.array(z.object({
    label: z.string().trim().max(30),
    color: visualColorSchema,
    points: z.array(z.object({ x: boundedNumberSchema, y: boundedNumberSchema })).min(2).max(60),
  })).min(1).max(3),
}).superRefine((visual, context) => {
  if (visual.xMin >= visual.xMax || visual.yMin >= visual.yMax) {
    context.addIssue({ code: 'custom', path: ['xMin'], message: 'Intervalele graficului trebuie să fie crescătoare.' });
    return;
  }
  if (visual.xStep > visual.xMax - visual.xMin || visual.yStep > visual.yMax - visual.yMin) {
    context.addIssue({ code: 'custom', path: ['xStep'], message: 'Pasul grilei depășește intervalul.' });
  }
  visual.series.forEach((series, seriesIndex) => series.points.forEach((point, pointIndex) => {
    if (point.x < visual.xMin || point.x > visual.xMax || point.y < visual.yMin || point.y > visual.yMax) {
      context.addIssue({ code: 'custom', path: ['series', seriesIndex, 'points', pointIndex], message: 'Punctul trebuie să fie în domeniul vizibil al graficului.' });
    }
  }));
});

export const tableCellSchema = z.union([
  z.object({ text: z.string().trim().min(1).max(80), latex: z.literal(''), spoken: z.literal('') }),
  z.object({ text: z.literal(''), latex: z.string().trim().min(1).max(400), spoken: z.string().trim().min(1).max(240) }),
]);

const tableVisualSchema = z.object({
  kind: z.literal('table'),
  title: z.string().trim().min(1).max(80),
  headers: z.array(z.string().trim().min(1).max(40)).min(1).max(6),
  rows: z.array(z.object({ cells: z.array(tableCellSchema).min(1).max(6) })).min(1).max(10),
}).superRefine((visual, context) => {
  visual.rows.forEach((row, index) => {
    if (row.cells.length !== visual.headers.length) {
      context.addIssue({ code: 'custom', path: ['rows', index, 'cells'], message: 'Fiecare rând trebuie să aibă același număr de celule ca antetul.' });
    }
  });
});

const numberLineVisualSchema = z.object({
  kind: z.literal('number_line'),
  title: z.string().trim().min(1).max(80),
  min: boundedNumberSchema,
  max: boundedNumberSchema,
  step: z.number().finite().positive().max(10000),
  markers: z.array(z.object({
    value: boundedNumberSchema,
    label: z.string().trim().min(1).max(18),
    closed: z.boolean(),
    color: visualColorSchema,
  })).max(12),
  intervals: z.array(z.object({
    start: boundedNumberSchema,
    end: boundedNumberSchema,
    startClosed: z.boolean(),
    endClosed: z.boolean(),
    color: visualColorSchema,
  })).max(6),
}).superRefine((visual, context) => {
  if (visual.min >= visual.max || visual.step > visual.max - visual.min) {
    context.addIssue({ code: 'custom', path: ['min'], message: 'Axa numerică trebuie să aibă limite crescătoare și un pas valid.' });
    return;
  }
  visual.markers.forEach((marker, index) => {
    if (marker.value < visual.min || marker.value > visual.max) {
      context.addIssue({ code: 'custom', path: ['markers', index, 'value'], message: 'Marcajul trebuie să fie pe axa vizibilă.' });
    }
  });
  visual.intervals.forEach((interval, index) => {
    if (interval.start >= interval.end || interval.start < visual.min || interval.end > visual.max) {
      context.addIssue({ code: 'custom', path: ['intervals', index], message: 'Intervalul trebuie să fie crescător și inclus în axa vizibilă.' });
    }
  });
});

export const structuredVisualSchema = z.union([
  geometryVisualSchema,
  graphVisualSchema,
  tableVisualSchema,
  numberLineVisualSchema,
]);

const visualContentBlockSchema = z.object({
  type: z.literal('visual'),
  text: z.literal(''),
  latex: z.literal(''),
  spoken: z.string().trim().min(1).max(900),
  visual: structuredVisualSchema,
});

export const contentBlockSchema = z.union([textContentBlockSchema, mathContentBlockSchema, visualContentBlockSchema]);
export const richContentSchema = z.array(contentBlockSchema).max(analysisContentLimits.problem);

const interfaceProseSchema = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum)
  .refine((value) => !containsRawMathNotation(value), 'Textul de interfață nu poate conține notație matematică brută.');

export const takeawaySchema = z.object({ content: z.array(contentBlockSchema).min(1).max(analysisContentLimits.takeaway) });

export const lessonStepSchema = z.object({
  kicker: interfaceProseSchema(1, 42),
  title: interfaceProseSchema(1, 90),
  explanation: z.array(contentBlockSchema).min(1).max(analysisContentLimits.explanation),
  note: z.array(contentBlockSchema).min(1).max(analysisContentLimits.note),
  alternative: z.array(contentBlockSchema).min(1).max(analysisContentLimits.alternative),
});

const containsVisual = (content: Array<z.infer<typeof contentBlockSchema>>) => content.some((block) => block.type === 'visual');

export const mathAnalysisSchema = z.object({
  status: analysisStatusSchema,
  mode: flowModeSchema,
  title: interfaceProseSchema(1, 90),
  problem: richContentSchema,
  topic: interfaceProseSchema(0, 80),
  verdict: verdictSchema,
  headline: interfaceProseSchema(1, 120),
  summary: z.array(contentBlockSchema).max(analysisContentLimits.summary),
  finalAnswer: z.array(contentBlockSchema).max(analysisContentLimits.finalAnswer),
  steps: z.array(lessonStepSchema).max(9),
  takeaways: z.array(takeawaySchema).max(3),
}).superRefine((value, context) => {
  if (value.status === 'ready' && value.steps.length === 0) context.addIssue({ code: 'custom', path: ['steps'], message: 'Un rezultat valid are nevoie de cel puțin un pas.' });
  if (value.status === 'ready' && value.problem.length === 0) context.addIssue({ code: 'custom', path: ['problem'], message: 'Problema recunoscută nu poate fi goală.' });
  if (value.status === 'ready' && value.finalAnswer.length === 0) context.addIssue({ code: 'custom', path: ['finalAnswer'], message: 'Un rezultat valid are nevoie de răspuns final.' });
  if (value.status !== 'ready' && (value.steps.length > 0 || value.problem.length > 0 || value.finalAnswer.length > 0 || value.takeaways.length > 0)) {
    context.addIssue({ code: 'custom', path: ['steps'], message: 'Răspunsurile de respingere nu conțin lecții sau formule inventate.' });
  }
  if (value.mode === 'solve' && value.verdict !== 'not_applicable') context.addIssue({ code: 'custom', path: ['verdict'], message: 'Modul de rezolvare nu are verdict.' });
  if (value.status === 'ready' && value.mode === 'check' && value.verdict === 'not_applicable') context.addIssue({ code: 'custom', path: ['verdict'], message: 'O verificare validă are nevoie de verdict.' });

  if (containsVisual(value.summary) || containsVisual(value.finalAnswer) || value.takeaways.some((item) => containsVisual(item.content))) {
    context.addIssue({ code: 'custom', path: ['summary'], message: 'Vizualurile apar numai în enunț sau în explicațiile lecției.' });
  }
  value.steps.forEach((step, index) => {
    if (containsVisual(step.note)) context.addIssue({ code: 'custom', path: ['steps', index, 'note'], message: 'Observația scurtă nu conține vizualuri.' });
    const visualCount = [...step.explanation, ...step.alternative].filter((block) => block.type === 'visual').length;
    if (visualCount > 1) context.addIssue({ code: 'custom', path: ['steps', index], message: 'Un pas poate conține cel mult un vizual structurat.' });
  });
  const allVisuals = value.problem.filter((block) => block.type === 'visual').length
    + value.steps.reduce((total, step) => total + [...step.explanation, ...step.alternative].filter((block) => block.type === 'visual').length, 0);
  if (allVisuals > 4) context.addIssue({ code: 'custom', path: ['steps'], message: 'Lecția poate conține cel mult patru vizualuri structurate.' });
});

export type FlowMode = z.infer<typeof flowModeSchema>;
export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type RichContent = z.infer<typeof richContentSchema>;
export type StructuredVisual = z.infer<typeof structuredVisualSchema>;
export type TableCell = z.infer<typeof tableCellSchema>;
export type MathAnalysis = z.infer<typeof mathAnalysisSchema>;

const contentBlockJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    type: { type: 'string', enum: ['text', 'math', 'visual'] },
    text: { type: 'string', description: 'Proză românească naturală doar pentru type=text; altfel șir gol.' },
    latex: { type: 'string', description: 'LaTeX fără delimitatori doar pentru type=math; altfel șir gol.' },
    spoken: { type: 'string', description: 'Citirea naturală în română pentru type=math sau descrierea accesibilă pentru type=visual; șir gol pentru type=text.' },
    visual: { type: 'string', description: 'Pentru type=visual: obiectul vizual complet serializat ca JSON valid; pentru text și math: șir gol.' },
  },
  required: ['type', 'text', 'latex', 'spoken', 'visual'],
} as const;

// Keep the provider schema intentionally structural. The Interactions API can
// reject a deeply nested schema when every repeated content array also carries
// bounds. The strict Zod contract below remains the semantic security boundary.
const richContentJsonSchema = () => ({
  type: 'array',
  items: contentBlockJsonSchema,
} as const);

export const mathAnalysisJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    status: { type: 'string', enum: analysisStatusSchema.options }, mode: { type: 'string', enum: flowModeSchema.options },
    title: { type: 'string', description: 'Titlu de 3-10 cuvinte care identifică exercițiul concret, nu doar capitolul; fără formulă brută.' },
    problem: { ...richContentJsonSchema(), description: `Enunțul complet, în cel mult ${analysisContentLimits.problem} de blocuri. Folosește visual numai pentru un desen, grafic, tabel sau o axă necesară.` },
    topic: { type: 'string', description: 'Subiect matematic precis, nu un capitol generic.' }, verdict: { type: 'string', enum: verdictSchema.options },
    headline: { type: 'string', description: 'Mesaj principal calm și util, fără formule.' },
    summary: { ...richContentJsonSchema(), description: `Rezumat pedagogic scurt, numai text și math, în cel mult ${analysisContentLimits.summary} blocuri.` },
    finalAnswer: { ...richContentJsonSchema(), description: `Răspunsul exact, numai text și math, în cel mult ${analysisContentLimits.finalAnswer} blocuri.` },
    steps: { type: 'array', maxItems: 9, items: { type: 'object', additionalProperties: false, properties: {
      kicker: { type: 'string' }, title: { type: 'string' },
      explanation: { ...richContentJsonSchema(), description: `Explicație în ordine, în cel mult ${analysisContentLimits.explanation} de blocuri; poate include cel mult un visual relevant.` },
      note: { ...richContentJsonSchema(), description: `Observație scurtă, numai text și math, în cel mult ${analysisContentLimits.note} blocuri.` },
      alternative: { ...richContentJsonSchema(), description: `Explicație alternativă, în cel mult ${analysisContentLimits.alternative} blocuri; poate include cel mult un visual relevant.` },
    }, required: ['kicker', 'title', 'explanation', 'note', 'alternative'] } },
    takeaways: { type: 'array', maxItems: 3, items: { type: 'object', additionalProperties: false, properties: { content: richContentJsonSchema() }, required: ['content'] } },
  },
  required: ['status', 'mode', 'title', 'problem', 'topic', 'verdict', 'headline', 'summary', 'finalAnswer', 'steps', 'takeaways'],
} as const;

function isContentBlockRecord(value: unknown): value is Record<string, unknown> & { type: 'text' | 'math' | 'visual' } {
  return Boolean(value && typeof value === 'object' && ['text', 'math', 'visual'].includes(String((value as Record<string, unknown>).type)));
}

function compactContentBlocks(items: unknown[]): unknown[] {
  if (items.length === 0 || !items.every(isContentBlockRecord)) return items;

  const compacted: Array<Record<string, unknown> & { type: 'text' | 'math' | 'visual' }> = [];
  items.forEach((item) => {
    if (item.type !== 'text' || typeof item.text !== 'string') {
      compacted.push(item);
      return;
    }

    const text = item.text.trim();
    const previous = compacted.at(-1);
    if (punctuationOnlyPattern.test(text)) {
      if (previous?.type === 'text' && typeof previous.text === 'string' && previous.text.length + text.length <= 900) {
        compacted[compacted.length - 1] = { ...previous, text: `${previous.text}${text}` };
      }
      return;
    }

    if (previous?.type === 'text' && typeof previous.text === 'string') {
      const separator = /^[,.;:!?…]/u.test(text) ? '' : ' ';
      const merged = `${previous.text}${separator}${text}`;
      if (merged.length <= 900) {
        compacted[compacted.length - 1] = { ...previous, text: merged };
        return;
      }
    }
    compacted.push({ ...item, text });
  });
  return compacted;
}

export function normalizeProviderAnalysis(value: unknown): unknown {
  if (Array.isArray(value)) return compactContentBlocks(value.map(normalizeProviderAnalysis));
  if (!value || typeof value !== 'object') return value;

  const record = value as Record<string, unknown>;
  const isContentBlock = record.type === 'text' || record.type === 'math' || record.type === 'visual';
  if (isContentBlock) {
    if (typeof record.visual !== 'string') throw new Error('Provider content block is missing its serialized visual field.');
    const { visual, ...content } = record;
    const normalizedContent = Object.fromEntries(
      Object.entries(content).map(([key, item]) => [key, normalizeProviderAnalysis(item)]),
    );

    if (record.type === 'visual') {
      if (!visual.trim()) throw new Error('Provider visual block is empty.');
      return { ...normalizedContent, visual: normalizeProviderAnalysis(JSON.parse(visual)) };
    }
    if (visual !== '') throw new Error('Provider text and math blocks cannot contain a visual payload.');
    return normalizedContent;
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [key, normalizeProviderAnalysis(item)]),
  );
}

export function summarizeAnalysisValidationIssues(error: unknown): Array<{ code: string; path: string }> {
  if (!error || typeof error !== 'object' || !Array.isArray((error as { issues?: unknown }).issues)) return [];
  const issues = (error as { issues: Array<{ code?: unknown; path?: unknown }> }).issues;
  return issues.slice(0, 12).map((issue) => ({
    code: typeof issue.code === 'string' ? issue.code : 'unknown',
    path: Array.isArray(issue.path)
      ? issue.path.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number').join('.')
      : '',
  }));
}
