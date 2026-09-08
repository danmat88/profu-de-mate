import { GoogleGenAI } from '@google/genai';
import { mathAnalysisJsonSchema } from './analysisSchema.js';
import type { ProviderGenerationContext, ProviderGenerationRequest } from './providerPipeline.js';

export interface MathProvider {
  readonly model: string;
  generate(request: ProviderGenerationRequest, context: ProviderGenerationContext): Promise<string | undefined>;
}

// The existing development adapter is isolated here. Eligibility for the 13+
// audience remains an owner/provider decision before any public launch.
export function createMathProvider(apiKey: string, client = new GoogleGenAI({ apiKey })): MathProvider {
  return {
    model: 'gemini-3.7-flash',
    async generate(request, context) {
      const interaction = await client.interactions.create({
        model: 'gemini-3.7-flash',
        store: false,
        input: request.kind === 'repair'
          ? [{ type: 'text', text: request.prompt }, { type: 'text', text: `OBIECT JSON DE CORECTAT:\n${request.source}` }]
          : [{ type: 'text', text: request.prompt }, { type: 'image', data: request.imageBase64, mime_type: request.mimeType }],
        response_format: { type: 'text', mime_type: 'application/json', schema: mathAnalysisJsonSchema },
        generation_config: { thinking_level: 'low', max_output_tokens: context.maxOutputTokens },
      }, { timeout: context.timeoutMs, signal: context.signal, maxRetries: 0 });
      return interaction.output_text;
    },
  };
}
