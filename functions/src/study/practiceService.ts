import type OpenAI from 'openai';
import { HttpsError } from 'firebase-functions/v2/https';
import { renderLatex, type RenderedMath } from '../analysis/mathRenderer.js';
import { createOpenAiClient, resolveOpenAiRuntimeConfig } from '../infrastructure/openAiClient.js';
import { buildPracticePrompt, buildPracticeRepairPrompt } from './practicePrompt.js';
import {
  aiPracticeExerciseJsonSchema,
  aiPracticeExerciseSchema,
  extractJsonPayload,
  normalizeRawPracticeExercise,
  sanitizePracticeLatex,
  summarizePracticeValidationIssues,
  type AiPracticeExercise,
  type FormulaCategory,
  type GeneratePracticeRequest,
  type PracticeContentBlock,
  type PracticeDifficulty,
} from './practiceSchema.js';

export type RenderedPracticeBlock =
  | { type: 'text'; text: string; latex: ''; spoken: '' }
  | { type: 'math'; text: ''; latex: string; spoken: string; rendered: RenderedMath };

export type RenderedAiPracticeExercise = {
  id: string;
  title: string;
  category: FormulaCategory;
  difficulty: PracticeDifficulty;
  prompt: RenderedPracticeBlock[];
  choices: readonly [string, string, string, string];
  renderedChoices: readonly [RenderedMath | null, RenderedMath | null, RenderedMath | null, RenderedMath | null];
  correctIndex: 0 | 1 | 2 | 3;
  hint: string;
  renderedHint?: RenderedPracticeBlock[];
  explanation: RenderedPracticeBlock[];
};

export type PracticeRejectionEvent = {
  attempt: number;
  stage: 'empty' | 'json' | 'schema' | 'render';
  issues: { code: string; path: string }[];
};

const PRACTICE_MAX_OUTPUT_TOKENS = 4096;
const PRACTICE_CALL_TIMEOUT_MS = 40_000;
const INLINE_MATH_SPLIT = /\$\$([^$]+?)\$\$|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;
const CHOICE_NEEDS_MATHJAX = /(?:\$|\\(?:frac|dfrac|tfrac|sqrt|begin|det|mathbb|mathrm|mathcal|operatorname|cdot|times|pm|le|ge|ne|infty|pi|Delta|sin|cos|ln|log|int|sum|lim)\b|\^|_)/;

function splitInlineMathBlocks(text: string): PracticeContentBlock[] {
  if (!text.includes('$') && !text.includes('\\(') && !text.includes('\\[')) {
    return [{ type: 'text', text, latex: '', spoken: '' }];
  }
  const out: PracticeContentBlock[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_MATH_SPLIT)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      const before = text.slice(lastIndex, start).trim();
      if (before) out.push({ type: 'text', text: before, latex: '', spoken: '' });
    }
    const rawLatex = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? '').trim();
    if (rawLatex) {
      out.push({ type: 'math', text: '', latex: rawLatex, spoken: rawLatex });
    }
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) {
    const after = text.slice(lastIndex).trim();
    if (after) out.push({ type: 'text', text: after, latex: '', spoken: '' });
  }
  return out.length > 0 ? out : [{ type: 'text', text, latex: '', spoken: '' }];
}

async function renderChoiceMath(choice: string): Promise<RenderedMath | null> {
  if (!CHOICE_NEEDS_MATHJAX.test(choice)) return null;
  const cleanLatex = sanitizePracticeLatex(choice);
  if (!cleanLatex) return null;
  try {
    return await renderLatex(cleanLatex);
  } catch {
    return null;
  }
}

async function renderBlocks(
  blocks: readonly PracticeContentBlock[],
  onRenderFallback?: () => void,
): Promise<RenderedPracticeBlock[]> {
  const expanded = blocks.flatMap((block) => (
    block.type === 'text' ? splitInlineMathBlocks(block.text) : [block]
  ));
  return Promise.all(expanded.map(async (block) => {
    if (block.type === 'text') {
      return { type: 'text' as const, text: block.text, latex: '' as const, spoken: '' as const };
    }
    const cleanLatex = sanitizePracticeLatex(block.latex);
    try {
      const rendered = await renderLatex(cleanLatex);
      return {
        type: 'math' as const,
        text: '' as const,
        latex: cleanLatex,
        spoken: block.spoken,
        rendered,
      };
    } catch {
      onRenderFallback?.();
      return {
        type: 'text' as const,
        text: block.spoken || cleanLatex,
        latex: '' as const,
        spoken: '' as const,
      };
    }
  }));
}

export async function renderAiPracticeExercise(
  parsed: AiPracticeExercise,
  meta: { id: string; category: FormulaCategory; difficulty: PracticeDifficulty },
  onRenderFallback?: () => void,
): Promise<RenderedAiPracticeExercise> {
  const hintHasInline = parsed.hint.includes('$') || parsed.hint.includes('\\(') || parsed.hint.includes('\\[');
  const [prompt, explanation, renderedChoices, renderedHint] = await Promise.all([
    renderBlocks(parsed.prompt, onRenderFallback),
    renderBlocks(parsed.explanation, onRenderFallback),
    Promise.all(parsed.choices.map((choice) => renderChoiceMath(choice))) as Promise<
      [RenderedMath | null, RenderedMath | null, RenderedMath | null, RenderedMath | null]
    >,
    hintHasInline
      ? renderBlocks([{ type: 'text', text: parsed.hint, latex: '', spoken: '' }], onRenderFallback)
      : Promise.resolve(undefined),
  ]);
  return {
    id: meta.id,
    title: parsed.title,
    category: meta.category,
    difficulty: meta.difficulty,
    prompt,
    choices: parsed.choices,
    renderedChoices,
    correctIndex: parsed.correctIndex,
    hint: parsed.hint,
    ...(renderedHint ? { renderedHint } : {}),
    explanation,
  };
}

function parseCandidateExercise(rawText: string):
  | { ok: true; data: AiPracticeExercise }
  | { ok: false; stage: 'json' | 'schema'; issues: { code: string; path: string }[] } {
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(extractJsonPayload(rawText));
  } catch {
    return { ok: false, stage: 'json', issues: [{ code: 'invalid_json', path: '' }] };
  }

  const normalized = normalizeRawPracticeExercise(rawJson);
  const parsed = aiPracticeExerciseSchema.safeParse(normalized);
  if (!parsed.success) {
    return {
      ok: false,
      stage: 'schema',
      issues: summarizePracticeValidationIssues(parsed.error),
    };
  }
  return { ok: true, data: parsed.data };
}

export async function generateRenderedPracticeExercise(params: {
  apiKey: string;
  request: GeneratePracticeRequest;
  beforeGenerate: () => Promise<void>;
  onRejected?: (event: PracticeRejectionEvent) => void;
  client?: OpenAI;
  model?: string;
}): Promise<RenderedAiPracticeExercise> {
  const runtime = resolveOpenAiRuntimeConfig();
  const model = params.model ?? runtime.model;
  const client = params.client ?? createOpenAiClient(params.apiKey, runtime);
  const promptText = buildPracticePrompt(params.request);

  let nextContent: Array<{ type: 'input_text'; text: string }> = [{ type: 'input_text', text: promptText }];
  let lastStage: 'empty' | 'json' | 'schema' = 'empty';

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await params.beforeGenerate();

    const response = await client.responses.create({
      model,
      store: false,
      input: [{ role: 'user', content: nextContent }],
      reasoning: { effort: 'low' },
      max_output_tokens: PRACTICE_MAX_OUTPUT_TOKENS,
      text: {
        format: {
          type: 'json_schema',
          name: 'practice_exercise',
          strict: true,
          schema: aiPracticeExerciseJsonSchema as unknown as Record<string, unknown>,
        },
      },
    }, { timeout: PRACTICE_CALL_TIMEOUT_MS, maxRetries: 0 });

    const rawText = response.output_text?.trim();
    if (!rawText) {
      lastStage = 'empty';
      params.onRejected?.({ attempt, stage: 'empty', issues: [] });
      if (attempt < 2) continue;
      throw new HttpsError('unavailable', 'Nu am primit un exercițiu valid. Încearcă din nou.');
    }

    const result = parseCandidateExercise(rawText);
    if (result.ok) {
      return renderAiPracticeExercise(result.data, {
        id: `ai-${params.request.requestId}`,
        category: params.request.category,
        difficulty: params.request.difficulty,
      }, () => {
        params.onRejected?.({ attempt, stage: 'render', issues: [{ code: 'latex_fallback', path: '' }] });
      });
    }

    lastStage = result.stage;
    params.onRejected?.({ attempt, stage: result.stage, issues: result.issues });
    if (attempt < 2) {
      nextContent = [
        { type: 'input_text', text: buildPracticeRepairPrompt(result.issues, result.stage) },
        { type: 'input_text', text: `OBIECT JSON DE CORECTAT:\n${rawText.slice(0, 24_000)}` },
      ];
    }
  }

  if (lastStage === 'json') {
    throw new HttpsError('internal', 'Exercițiul generat nu a putut fi citit. Încearcă din nou.');
  }
  throw new HttpsError('internal', 'Exercițiul generat nu a trecut verificarea matematică. Încearcă din nou.');
}
