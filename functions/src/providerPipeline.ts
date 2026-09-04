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
  generate: (request: ProviderGenerationRequest) => Promise<string | undefined>;
  onRejected?: (event: ProviderPipelineRejection, error: unknown) => void;
};

function queueRepair(queue: InternalRequest[], request: InternalRequest, source: string, issues: { code: string; path: string }[], stage: 'schema' | 'render'): void {
  if (request.kind === 'image' && source.length <= MAX_REPAIR_SOURCE_CHARS) {
    queue.unshift({ kind: 'repair', source, issues, stage });
  }
}

export async function runProviderPipeline(input: RunProviderPipelineInput): Promise<RenderedMathAnalysis> {
  const queue: InternalRequest[] = [
    { kind: 'image', attempt: 0 },
    { kind: 'image', attempt: 1 },
  ];
  let lastError: unknown = new Error('Provider returned no usable response.');

  for (let call = 1; call <= MAX_PROVIDER_CALLS && queue.length > 0; call += 1) {
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

    let output: string | undefined;
    try {
      output = await input.generate(generationRequest);
      if (!output) throw new Error('Provider returned an empty response.');
    } catch (error) {
      lastError = error;
      input.onRejected?.({ call, requestKind: request.kind, stage: 'provider', issues: [] }, error);
      continue;
    }

    let candidate;
    try {
      candidate = mathAnalysisSchema.parse(normalizeProviderAnalysis(JSON.parse(output)));
    } catch (error) {
      lastError = error;
      const issues = summarizeAnalysisValidationIssues(error);
      input.onRejected?.({ call, requestKind: request.kind, stage: 'schema', issues }, error);
      queueRepair(queue, request, output, issues, 'schema');
      continue;
    }

    try {
      return await renderMathAnalysis(candidate);
    } catch (error) {
      lastError = error;
      input.onRejected?.({ call, requestKind: request.kind, stage: 'render', issues: [] }, error);
      queueRepair(queue, request, output, [], 'render');
    }
  }

  throw lastError;
}
