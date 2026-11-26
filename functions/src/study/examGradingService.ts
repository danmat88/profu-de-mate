import type OpenAI from 'openai';
import { HttpsError } from 'firebase-functions/v2/https';
import { createOpenAiClient, resolveOpenAiRuntimeConfig } from '../infrastructure/openAiClient.js';
import {
  examGradingResultJsonSchema,
  examGradingResultSchema,
  normalizeExamGradingResult,
  normalizeRawExamGrading,
  type ExamGradingResult,
  type ExamId,
  type GradeExamSolutionRequest,
} from './examGradingSchema.js';
import { extractJsonPayload, summarizePracticeValidationIssues } from './practiceSchema.js';

const EXAM_NAMES: Record<ExamId, string> = {
  en: 'Evaluarea Națională (clasa a VIII-a)',
  bac_m1: 'Bacalaureat Matematică M1 (Mate-Info)',
  bac_m2: 'Bacalaureat Matematică M2 (Științe ale Naturii)',
  bac_m3: 'Bacalaureat Matematică M3 (Tehnologic)',
};

export function buildExamGradingPrompt(request: GradeExamSolutionRequest): string {
  const rubricLines = request.rubricCriteria
    .map((item, idx) => `${idx + 1}. [${item.points}p] ${item.step}`)
    .join('\n');

  return [
    'Ești Profu’ de mate, profesor evaluator de matematică în România (MEN).',
    `Corectează rezolvarea scrisă de elev din fotografie STRICT după baremul oficial pentru ${EXAM_NAMES[request.examId]}.`,
    '',
    `SUBIECT (${request.maxPoints} puncte): ${request.itemTitle}`,
    `ENUNȚ: ${request.problemText}`,
    '',
    'BAREM OFICIAL PE ETAPE:',
    rubricLines,
    '',
    'REGULI STRICTE:',
    '1. Dacă fotografia este neclară, blurată sau ilizibilă, setează status = "unclear", awardedPoints = 0 și explică blând cum să refacă poza.',
    '2. Dacă fotografia nu conține o rezolvare matematică pentru acest enunț, setează status = "not_math", awardedPoints = 0.',
    '3. Dacă elevul folosește o metodă alternativă matematic corectă și complet justificată, acordă punctajul integral al etapei respective (exact ca în baremul MEN!).',
    '4. Acordă puncte întregi parțiale pentru pașii corecți intermediari, explicând concret unde s-a pierdut fiecare punct.',
    '5. În `criteriaScores`, returnează câte un obiect în aceeași ordine cu etapele din barem, cu `awardedPoints` întreg între 0 și punctajul etapei.',
    '6. Scrie în limba română caldă, încurajatoare, cu diacritice corecte (ă, â, î, ș, ț). Folosește notații matematice curate în Unicode (ex. x², √3, Δ, ≤, ≥, ≠) — fără comenzi LaTeX brute cu backslash (fără \\frac, \\sqrt, \\begin).',
    '7. Răspunde STRICT în JSON valid conform schemei, fără text suplimentar.',
  ].join('\n');
}

export async function gradeExamSolutionWithAi(params: {
  apiKey: string;
  request: GradeExamSolutionRequest;
  beforeGenerate: () => Promise<void>;
  onRejected?: (event: { stage: 'empty' | 'json' | 'schema'; issues: { code: string; path: string }[] }) => void;
  client?: OpenAI;
  model?: string;
  reasoningEffort?: 'low' | 'medium';
}): Promise<ExamGradingResult> {
  const runtime = resolveOpenAiRuntimeConfig();
  const model = params.model ?? runtime.model;
  const reasoningEffort = params.reasoningEffort ?? 'low';
  const client = params.client ?? createOpenAiClient(params.apiKey, runtime);
  const promptText = buildExamGradingPrompt(params.request);

  await params.beforeGenerate();

  const response = await client.responses.create({
    model,
    store: false,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: promptText },
          {
            type: 'input_image',
            image_url: `data:${params.request.mimeType};base64,${params.request.imageBase64}`,
            detail: 'high',
          },
        ],
      },
    ],
    reasoning: { effort: reasoningEffort },
    max_output_tokens: 3200,
    text: {
      format: {
        type: 'json_schema',
        name: 'exam_grading_result',
        strict: true,
        schema: examGradingResultJsonSchema as unknown as Record<string, unknown>,
      },
    },
  }, { timeout: 75_000, maxRetries: 0 });

  const rawText = response.output_text?.trim();
  if (!rawText) {
    params.onRejected?.({ stage: 'empty', issues: [] });
    throw new HttpsError('unavailable', 'Nu am primit evaluarea baremului. Încearcă din nou.');
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(extractJsonPayload(rawText));
  } catch {
    params.onRejected?.({ stage: 'json', issues: [{ code: 'invalid_json', path: '' }] });
    throw new HttpsError('internal', 'Evaluarea baremului nu a putut fi citită. Încearcă din nou.');
  }

  const normalizedRaw = normalizeRawExamGrading(rawJson, params.request);
  const parsed = examGradingResultSchema.safeParse(normalizedRaw);
  if (!parsed.success) {
    params.onRejected?.({ stage: 'schema', issues: summarizePracticeValidationIssues(parsed.error) });
    throw new HttpsError('internal', 'Evaluarea baremului nu a trecut validarea. Încearcă din nou.');
  }

  return normalizeExamGradingResult(parsed.data, params.request);
}
