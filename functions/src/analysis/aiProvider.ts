import type OpenAI from 'openai';
import { createOpenAiClient, resolveOpenAiRuntimeConfig } from '../infrastructure/openAiClient.js';
import { mathAnalysisJsonSchema } from './analysisSchema.js';
import type { ProviderGenerationContext, ProviderGenerationRequest } from './providerPipeline.js';

export type MathReasoningEffort = 'low' | 'medium';

export interface MathProvider {
  readonly model: string;
  generate(request: ProviderGenerationRequest, context: ProviderGenerationContext): Promise<string | undefined>;
}

export function createMathProvider(
  apiKey: string,
  client?: OpenAI,
  model?: string,
  reasoningEffort: MathReasoningEffort = 'low',
): MathProvider {
  const runtime = resolveOpenAiRuntimeConfig();
  const resolvedModel = model ?? runtime.model;
  const resolvedClient = client ?? createOpenAiClient(apiKey, runtime);

  return {
    model: resolvedModel,
    async generate(request, context) {
      const content = request.kind === 'repair'
        ? [
          { type: 'input_text' as const, text: request.prompt },
          { type: 'input_text' as const, text: `OBIECT JSON DE CORECTAT:\n${request.source}` },
        ]
        : request.kind === 'math'
          ? [
            { type: 'input_text' as const, text: request.prompt },
            {
              type: 'input_text' as const,
              text: `DATE MATEMATICE DIN EDITOR (JSON):\n${JSON.stringify({
                problemLatex: request.problemLatex,
                ...(request.solutionLatex === undefined ? {} : { solutionLatex: request.solutionLatex }),
              })}`,
            },
          ]
          : [
            { type: 'input_text' as const, text: request.prompt },
            {
              type: 'input_image' as const,
              image_url: `data:${request.mimeType};base64,${request.imageBase64}`,
              detail: 'high' as const,
            },
          ];

      const effectiveEffort = request.kind === 'repair' ? 'low' : reasoningEffort;
      const effectiveMaxTokens = effectiveEffort === 'medium'
        ? Math.max(context.maxOutputTokens, 12_288)
        : context.maxOutputTokens;
      const response = await resolvedClient.responses.create({
        model: resolvedModel,
        store: false,
        input: [{ role: 'user', content }],
        reasoning: { effort: effectiveEffort },
        max_output_tokens: effectiveMaxTokens,
        text: {
          format: {
            type: 'json_schema',
            name: 'math_analysis',
            strict: true,
            schema: mathAnalysisJsonSchema as unknown as Record<string, unknown>,
          },
        },
      }, { timeout: context.timeoutMs, signal: context.signal, maxRetries: 0 });
      if (response.status === 'incomplete') {
        const reason = response.incomplete_details?.reason ?? 'unknown';
        throw new Error(`Provider response was incomplete (${reason}).`);
      }
      return response.output_text;
    },
  };
}
