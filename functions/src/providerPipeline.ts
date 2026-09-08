import {
  mathAnalysisSchema,
  normalizeProviderAnalysis,
  summarizeAnalysisValidationIssues,
  type FlowMode,
} from './analysisSchema.js';
import { renderMathAnalysis, type RenderedMathAnalysis } from './mathRenderer.js';
import { buildProviderPrompt, buildRepairPrompt } from './prompt.js';

const MAX_PROVIDER_CALLS = 3;
const MAX_REPAIR_SOURCE_CHARS = 120_000;
export const MAX_PROVIDER_OUTPUT_CHARS = 120_000;
export const PROVIDER_CALL_TIMEOUT_MS = 35_000;
export const PROVIDER_PIPELINE_TIMEOUT_MS = 100_000;
export const MAX_PROVIDER_OUTPUT_TOKENS = 8192;

export type ProviderGenerationContext = {
  signal: AbortSignal;
  timeoutMs: number;
  maxOutputTokens: number;
};

export class ProviderDeadlineError extends Error {
  constructor() {
    super('Provider generation exceeded its time budget.');
    this.name = 'ProviderDeadlineError';
  }
}

export type ProviderGenerationRequest =
  | { kind: 'image'; prompt: string; imageBase64: string; mimeType: string }
  | { kind: 'repair'; prompt: string; source: string };

export type ProviderPipelineRejection = {
  call: number;
  requestKind: ProviderGenerationRequest['kind'];
  stage: 'provider' | 'schema' | 'render';
  issues: { code: string; path: string }[];
};

type InternalRequest =
  | { kind: 'image'; attempt: number }
  | { kind: 'repair'; source: string; issues: { code: string; path: string }[]; stage: 'schema' | 'render' };

type RunProviderPipelineInput = {
  mode: FlowMode;
  imageBase64: string;
  mimeType: string;
  generate: (request: ProviderGenerationRequest, context: ProviderGenerationContext) => Promise<string | undefined>;
  /** Must commit the non-refundable attempt budget before any provider I/O. */
  beforeGenerate?: (request: ProviderGenerationRequest, context: ProviderGenerationContext) => Promise<void>;
  onRejected?: (event: ProviderPipelineRejection, error: unknown) => void;
};

function queueRepair(queue: InternalRequest[], request: InternalRequest, source: string, issues: { code: string; path: string }[], stage: 'schema' | 'render'): void {
  if (request.kind === 'image' && source.length <= MAX_REPAIR_SOURCE_CHARS) {
    queue.unshift({ kind: 'repair', source, issues, stage });
  }
}

export async function runProviderPipeline(input: RunProviderPipelineInput): Promise<RenderedMathAnalysis> {
  const deadline = Date.now() + PROVIDER_PIPELINE_TIMEOUT_MS;
  const queue: InternalRequest[] = [
    { kind: 'image', attempt: 0 },
    { kind: 'image', attempt: 1 },
  ];
  let lastError: unknown = new Error('Provider returned no usable response.');

  for (let call = 1; call <= MAX_PROVIDER_CALLS && queue.length > 0; call += 1) {
    const timeoutMs = Math.min(PROVIDER_CALL_TIMEOUT_MS, deadline - Date.now());
    if (timeoutMs <= 0) throw new ProviderDeadlineError();
    const request = queue.shift() as InternalRequest;
    const generationRequest: ProviderGenerationRequest = request.kind === 'repair'
      ? {
        kind: 'repair',
        prompt: buildRepairPrompt(input.mode, request.issues, request.stage),
        source: request.source,
      }
      : {
        kind: 'image',
        prompt: buildProviderPrompt(input.mode, request.attempt),
        imageBase64: input.imageBase64,
        mimeType: input.mimeType,
      };

    const controller = new AbortController();
    const context: ProviderGenerationContext = {
      signal: controller.signal,
      timeoutMs,
      maxOutputTokens: MAX_PROVIDER_OUTPUT_TOKENS,
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let providerStarted = false;
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new ProviderDeadlineError());
      }, timeoutMs);
    });
    let output: string | undefined;
    try {
      output = await Promise.race([
        (async () => {
          await input.beforeGenerate?.(generationRequest, context);
          // A slow budget transaction can finish after the deadline; it must
          // never start a provider call that the caller already abandoned.
          if (controller.signal.aborted) throw new ProviderDeadlineError();
          providerStarted = true;
          return input.generate(generationRequest, context);
        })(),
        timedOut,
      ]);
      if (!output) throw new Error('Provider returned an empty response.');
    } catch (error) {
      // Capacity/lifecycle failures are terminal. An ambiguous timed-out
      // request is also terminal, because cancellation cannot undo its cost.
      if (!providerStarted || error instanceof ProviderDeadlineError || controller.signal.aborted) throw error;
      lastError = error;
      input.onRejected?.({ call, requestKind: request.kind, stage: 'provider', issues: [] }, error);
      continue;
    } finally {
      clearTimeout(timer);
    }

    let candidate;
    try {
      if (output.length > MAX_PROVIDER_OUTPUT_CHARS) throw new Error('Provider response exceeds the output size budget.');
      candidate = mathAnalysisSchema.parse(normalizeProviderAnalysis(JSON.parse(output)));
      if (candidate.mode !== input.mode) {
        throw Object.assign(new Error('Provider response mode does not match the requested flow.'), {
          issues: [{ code: 'mode_mismatch', path: ['mode'] }],
        });
      }
    } catch (error) {
      lastError = error;
      const issues = summarizeAnalysisValidationIssues(error);
      input.onRejected?.({ call, requestKind: request.kind, stage: 'schema', issues }, error);
      queueRepair(queue, request, output, issues, 'schema');
      continue;
    }

    try {
      const rendered = await renderMathAnalysis(candidate);
      if (Date.now() >= deadline) throw new ProviderDeadlineError();
      return rendered;
    } catch (error) {
      if (error instanceof ProviderDeadlineError) throw error;
      lastError = error;
      input.onRejected?.({ call, requestKind: request.kind, stage: 'render', issues: [] }, error);
      queueRepair(queue, request, output, [], 'render');
    }
  }

  throw lastError;
}
