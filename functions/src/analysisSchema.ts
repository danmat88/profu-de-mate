import { z } from 'zod';

export const flowModeSchema = z.enum(['solve', 'check']);
export const analysisStatusSchema = z.enum(['ready', 'not_math', 'unclear']);
export const verdictSchema = z.enum(['correct', 'partially_correct', 'incorrect', 'not_applicable']);

const rawMathPattern = /(?:\d|[$]|\\(?:frac|dfrac|tfrac|sqrt|begin|end|sum|prod|int|oint|lim|overline|vec|hat|bar|binom|det|log|ln|sin|cos|tan|cot|Delta|angle|triangle|mathbb|mathrm)\b|sqrt\s*\(|[A-Za-z0-9})\]]\s*[\^_]\s*[{(A-Za-z0-9]|[=<>≤≥≠≈±×÷√∫∑∏∞∈∉⊂⊆⊃⊇∪∩⊥∥∆Δ])/i;

export const contentBlockSchema = z.object({
  type: z.enum(['text', 'math']),
  text: z.string().trim().max(900),
  latex: z.string().trim().max(1600),
  spoken: z.string().trim().max(900),
}).superRefine((block, context) => {
  if (block.type === 'text') {
    if (!block.text) context.addIssue({ code: 'custom', path: ['text'], message: 'Un bloc text nu poate fi gol.' });
    if (/^[,.;:!?…\s]+$/.test(block.text)) context.addIssue({ code: 'custom', path: ['text'], message: 'Punctuația nu poate forma singură un bloc text.' });
    if (block.latex || block.spoken) context.addIssue({ code: 'custom', path: ['latex'], message: 'Un bloc text nu conține câmpuri matematice.' });
    if (rawMathPattern.test(block.text)) context.addIssue({ code: 'custom', path: ['text'], message: 'Notația matematică brută trebuie mutată într-un bloc math.' });
    return;
  }

  if (block.text) context.addIssue({ code: 'custom', path: ['text'], message: 'Un bloc math nu conține text obișnuit.' });
  if (!block.latex) context.addIssue({ code: 'custom', path: ['latex'], message: 'Un bloc math are nevoie de LaTeX.' });
  if (!block.spoken) context.addIssue({ code: 'custom', path: ['spoken'], message: 'Un bloc math are nevoie de o citire accesibilă.' });
});

export const richContentSchema = z.array(contentBlockSchema).max(12);

export const takeawaySchema = z.object({
  content: z.array(contentBlockSchema).min(1).max(4),
});

export const lessonStepSchema = z.object({
  kicker: z.string().trim().min(1).max(42),
  title: z.string().trim().min(1).max(90),
  explanation: z.array(contentBlockSchema).min(1).max(7),
  note: z.array(contentBlockSchema).min(1).max(3),
  alternative: z.array(contentBlockSchema).min(1).max(7),
});

export const mathAnalysisSchema = z.object({
  status: analysisStatusSchema,
  mode: flowModeSchema,
  title: z.string().trim().min(1).max(90),
  problem: richContentSchema,
  topic: z.string().trim().max(80),
  verdict: verdictSchema,
  headline: z.string().trim().min(1).max(120),
  summary: richContentSchema,
  finalAnswer: richContentSchema,
  steps: z.array(lessonStepSchema).max(7),
  takeaways: z.array(takeawaySchema).max(3),
}).superRefine((value, context) => {
  if (value.status === 'ready' && value.steps.length === 0) {
    context.addIssue({ code: 'custom', path: ['steps'], message: 'Un rezultat valid are nevoie de cel puțin un pas.' });
  }
  if (value.status === 'ready' && value.problem.length === 0) {
    context.addIssue({ code: 'custom', path: ['problem'], message: 'Problema recunoscută nu poate fi goală.' });
  }
  if (value.status === 'ready' && value.finalAnswer.length === 0) {
    context.addIssue({ code: 'custom', path: ['finalAnswer'], message: 'Un rezultat valid are nevoie de răspuns final.' });
  }
  if (value.status !== 'ready' && (value.steps.length > 0 || value.problem.length > 0 || value.finalAnswer.length > 0 || value.takeaways.length > 0)) {
    context.addIssue({ code: 'custom', path: ['steps'], message: 'Răspunsurile de respingere nu conțin lecții sau formule inventate.' });
  }
  if (value.mode === 'solve' && value.verdict !== 'not_applicable') {
    context.addIssue({ code: 'custom', path: ['verdict'], message: 'Modul de rezolvare nu are verdict.' });
  }
  if (value.status === 'ready' && value.mode === 'check' && value.verdict === 'not_applicable') {
    context.addIssue({ code: 'custom', path: ['verdict'], message: 'O verificare validă are nevoie de verdict.' });
  }
});

export type FlowMode = z.infer<typeof flowModeSchema>;
export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type RichContent = z.infer<typeof richContentSchema>;
export type MathAnalysis = z.infer<typeof mathAnalysisSchema>;

const contentBlockJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: ['text', 'math'], description: 'text pentru explicație în cuvinte; math pentru orice notație, expresie, relație sau calcul.' },
    text: { type: 'string', description: 'Numai pentru type=text. Proză românească fără LaTeX, sqrt(...), ^ sau formule scrise brut. Nu crea blocuri care conțin numai punctuație. Gol pentru type=math.' },
    latex: { type: 'string', description: 'Numai pentru type=math. LaTeX valid fără delimitatori $, $$, \\(, \\[ sau Markdown. Gol pentru type=text.' },
    spoken: { type: 'string', description: 'Numai pentru type=math. Citirea naturală în română a formulei, pentru accesibilitate. Gol pentru type=text.' },
  },
  required: ['type', 'text', 'latex', 'spoken'],
} as const;

const richContentJsonSchema = {
  type: 'array',
  items: contentBlockJsonSchema,
} as const;

export const mathAnalysisJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: analysisStatusSchema.options },
    mode: { type: 'string', enum: flowModeSchema.options },
    title: { type: 'string', description: 'Titlu scurt și specific pentru problemă, fără formulă brută.' },
    problem: { ...richContentJsonSchema, description: 'Enunțul complet, în ordinea lecturii. Orice expresie sau simbol matematic important este bloc math separat.' },
    topic: { type: 'string', description: 'Subiect matematic precis, nu un capitol generic.' },
    verdict: { type: 'string', enum: verdictSchema.options },
    headline: { type: 'string', description: 'Mesaj principal calm și util, fără formule.' },
    summary: { ...richContentJsonSchema, description: 'Rezumat pedagogic scurt. Orice matematică este bloc math.' },
    finalAnswer: { ...richContentJsonSchema, description: 'Răspunsul exact la cerință. Folosește blocuri math pentru toate valorile, relațiile și formulele.' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kicker: { type: 'string', description: 'Etichetă foarte scurtă, cu majuscule.' },
          title: { type: 'string', description: 'Acțiunea pedagogică a pasului, fără formulă brută.' },
          explanation: { ...richContentJsonSchema, description: 'Explicația și calculele pasului, în ordine. Fiecare calcul sau relație este bloc math separat.' },
          note: { type: 'array', items: contentBlockJsonSchema, description: 'Observație scurtă. Orice notație este bloc math.' },
          alternative: { type: 'array', items: contentBlockJsonSchema, description: 'Aceeași idee explicată mai simplu sau vizual. Orice notație este bloc math.' },
        },
        required: ['kicker', 'title', 'explanation', 'note', 'alternative'],
      },
    },
    takeaways: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          content: { type: 'array', items: contentBlockJsonSchema },
        },
        required: ['content'],
      },
    },
  },
  required: ['status', 'mode', 'title', 'problem', 'topic', 'verdict', 'headline', 'summary', 'finalAnswer', 'steps', 'takeaways'],
} as const;
