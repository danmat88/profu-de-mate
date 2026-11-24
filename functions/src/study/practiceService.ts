import { GoogleGenAI } from '@google/genai';
import { HttpsError } from 'firebase-functions/v2/https';
import { renderLatex, type RenderedMath } from '../analysis/mathRenderer.js';
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
  correctIndex: 0 | 1 | 2 | 3;
  hint: string;
  explanation: RenderedPracticeBlock[];
};

export type PracticeRejectionEvent = {
  attempt: number;
  stage: 'empty' | 'json' | 'schema' | 'render';
  issues: { code: string; path: string }[];
};

const PRACTICE_MAX_OUTPUT_TOKENS = 4096;
const PRACTICE_CALL_TIMEOUT_MS = 40_000;

async function renderBlocks(
  blocks: readonly PracticeContentBlock[],
  onRenderFallback?: () => void,
): Promise<RenderedPracticeBlock[]> {
  return Promise.all(blocks.map(async (block) => {
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
  const [prompt, explanation] = await Promise.all([
    renderBlocks(parsed.prompt, onRenderFallback),
    renderBlocks(parsed.explanation, onRenderFallback),
  ]);
  return {
    id: meta.id,
    title: parsed.title,
    category: meta.category,
    difficulty: meta.difficulty,
    prompt,
    choices: parsed.choices,
    correctIndex: parsed.correctIndex,
    hint: parsed.hint,
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
  client?: GoogleGenAI;
}): Promise<RenderedAiPracticeExercise> {
  const client = params.client ?? new GoogleGenAI({ apiKey: params.apiKey });
  const promptText = buildPracticePrompt(params.request);

  let nextInput: Array<{ type: 'text'; text: string }> = [{ type: 'text', text: promptText }];
  let lastStage: 'empty' | 'json' | 'schema' = 'empty';

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await params.beforeGenerate();

    const interaction = await client.interactions.create({
      model: 'gemini-3.7-flash',
      store: false,
      input: nextInput,
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: aiPracticeExerciseJsonSchema,
      },
      generation_config: {
        thinking_level: 'low',
        max_output_tokens: PRACTICE_MAX_OUTPUT_TOKENS,
      },
    }, { timeout: PRACTICE_CALL_TIMEOUT_MS, maxRetries: 0 });

    const rawText = interaction.output_text?.trim();
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
      nextInput = [
        { type: 'text', text: buildPracticeRepairPrompt(result.issues, result.stage) },
        { type: 'text', text: `OBIECT JSON DE CORECTAT:\n${rawText.slice(0, 24_000)}` },
      ];
    }
  }

  if (lastStage === 'json') {
    throw new HttpsError('internal', 'Exercițiul generat nu a putut fi citit. Încearcă din nou.');
  }
  throw new HttpsError('internal', 'Exercițiul generat nu a trecut verificarea matematică. Încearcă din nou.');
}
