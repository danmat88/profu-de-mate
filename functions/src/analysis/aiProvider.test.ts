import assert from 'node:assert/strict';
import test from 'node:test';
import type OpenAI from 'openai';
import { mathAnalysisJsonSchema } from './analysisSchema.js';
import { createMathProvider } from './aiProvider.js';
import { DEFAULT_OPENAI_MODEL, resolveOpenAiRuntimeConfig } from '../infrastructure/openAiClient.js';
import { aiPracticeExerciseJsonSchema } from '../study/practiceSchema.js';
import { examGradingResultJsonSchema } from '../study/examGradingSchema.js';

const UNSUPPORTED_STRICT_KEYWORDS = new Set([
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'pattern',
  'format',
  'multipleOf',
  'uniqueItems',
  'minProperties',
  'maxProperties',
  'patternProperties',
]);

function assertOpenAiStrictSchema(node: unknown, path = 'root'): void {
  assert.ok(node && typeof node === 'object' && !Array.isArray(node), `${path}: expected schema object`);
  const record = node as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    assert.equal(UNSUPPORTED_STRICT_KEYWORDS.has(key), false, `${path}: unsupported strict keyword "${key}"`);
  }
  if (record.type === 'object') {
    assert.equal(record.additionalProperties, false, `${path}: object must declare additionalProperties: false`);
    assert.ok(record.properties && typeof record.properties === 'object', `${path}: object must declare properties`);
    const propNames = Object.keys(record.properties as Record<string, unknown>);
    assert.ok(Array.isArray(record.required), `${path}: object must declare required array`);
    assert.deepEqual(
      [...(record.required as string[])].sort(),
      [...propNames].sort(),
      `${path}: required must list every property`,
    );
    for (const [propName, propSchema] of Object.entries(record.properties as Record<string, unknown>)) {
      assertOpenAiStrictSchema(propSchema, `${path}.properties.${propName}`);
    }
  }
  if (record.type === 'array') {
    assert.ok(record.items, `${path}: array must declare items`);
    assertOpenAiStrictSchema(record.items, `${path}.items`);
  }
}

test('all three AI JSON schemas satisfy OpenAI Structured Outputs strict: true constraints', () => {
  assertOpenAiStrictSchema(mathAnalysisJsonSchema, 'mathAnalysisJsonSchema');
  assertOpenAiStrictSchema(aiPracticeExerciseJsonSchema, 'aiPracticeExerciseJsonSchema');
  assertOpenAiStrictSchema(examGradingResultJsonSchema, 'examGradingResultJsonSchema');
});

test('resolveOpenAiRuntimeConfig uses safe defaults and validates official OpenAI base URLs', () => {
  assert.deepEqual(resolveOpenAiRuntimeConfig({}), { model: DEFAULT_OPENAI_MODEL });
  assert.deepEqual(
    resolveOpenAiRuntimeConfig({
      PROFU_OPENAI_MODEL: 'gpt-5-mini',
      PROFU_OPENAI_BASE_URL: 'https://eu.api.openai.com/v1/',
    }),
    { model: 'gpt-5-mini', baseURL: 'https://eu.api.openai.com/v1' },
  );
  assert.throws(() => resolveOpenAiRuntimeConfig({ PROFU_OPENAI_BASE_URL: 'http://api.openai.com/v1' }));
  assert.throws(() => resolveOpenAiRuntimeConfig({ PROFU_OPENAI_BASE_URL: 'https://evil.example.com/v1' }));
});

test('actual OpenAI adapter propagates cancellation, strict schema, detail=high image, and zero invisible retries', async () => {
  const calls: { request: any; options: any }[] = [];
  const client = {
    responses: {
      create: async (request: unknown, options: unknown) => {
        calls.push({ request, options });
        return { output_text: '{}' };
      },
    },
  } as unknown as OpenAI;
  const provider = createMathProvider('fixture-only', client, 'gpt-6-luna');
  assert.equal(provider.model, 'gpt-6-luna');
  const context = { signal: new AbortController().signal, timeoutMs: 1234, maxOutputTokens: 4321 };

  assert.equal(
    await provider.generate({ kind: 'image', prompt: 'solve', imageBase64: 'fixture', mimeType: 'image/jpeg' }, context),
    '{}',
  );
  await provider.generate({ kind: 'repair', prompt: 'repair', source: 'invalid-json' }, context);

  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.request.model, 'gpt-6-luna');
    assert.equal(call.request.store, false);
    assert.equal(call.request.max_output_tokens, 4321);
    assert.deepEqual(call.request.reasoning, { effort: 'low' });
    assert.equal(call.request.text.format.type, 'json_schema');
    assert.equal(call.request.text.format.strict, true);
    assert.equal(call.options.maxRetries, 0);
    assert.equal(call.options.signal, context.signal);
    assert.equal(call.options.timeout, 1234);
  }

  const imageContent = calls[0].request.input[0].content;
  assert.equal(imageContent[0].type, 'input_text');
  assert.equal(imageContent[1].type, 'input_image');
  assert.equal(imageContent[1].image_url, 'data:image/jpeg;base64,fixture');
  assert.equal(imageContent[1].detail, 'high');

  const repairContent = calls[1].request.input[0].content;
  assert.ok(repairContent.every((part: { type: string }) => part.type === 'input_text'));

  // Max tier passes extended medium reasoning + higher token ceiling for analysis while keeping repair fast (low).
  const maxProvider = createMathProvider('fixture-only', client, 'gpt-6-luna', 'medium');
  await maxProvider.generate({ kind: 'image', prompt: 'solve', imageBase64: 'fixture', mimeType: 'image/jpeg' }, context);
  await maxProvider.generate({ kind: 'repair', prompt: 'repair', source: 'invalid-json' }, context);
  assert.deepEqual(calls[2].request.reasoning, { effort: 'medium' });
  assert.equal(calls[2].request.max_output_tokens, 12288);
  assert.deepEqual(calls[3].request.reasoning, { effort: 'low' });
  assert.equal(calls[3].request.max_output_tokens, 4321);

  const incompleteClient = {
    responses: {
      create: async () => ({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output_text: '{"partial' }),
    },
  } as unknown as OpenAI;
  const incompleteProvider = createMathProvider('fixture-only', incompleteClient, 'gpt-6-luna', 'medium');
  await assert.rejects(
    incompleteProvider.generate({ kind: 'image', prompt: 'solve', imageBase64: 'fixture', mimeType: 'image/jpeg' }, context),
    /incomplete/,
  );
});

test('typed OpenAI adapter sends separate math data as text without image parts or storage', async () => {
  const calls: { request: any; options: any }[] = [];
  const client = {
    responses: {
      create: async (request: unknown, options: unknown) => {
        calls.push({ request, options });
        return { output_text: '{}' };
      },
    },
  } as unknown as OpenAI;
  const provider = createMathProvider('fixture-only', client, 'gpt-6-luna');
  const context = { signal: new AbortController().signal, timeoutMs: 321, maxOutputTokens: 123 };
  const problemLatex = String.raw`\frac{x}{2}=3`;

  for (const solutionLatex of [undefined, 'x=6']) {
    await provider.generate({ kind: 'math', prompt: 'math-only-instructions', problemLatex, solutionLatex }, context);
    const { request, options } = calls[calls.length - 1];
    assert.equal(request.store, false);
    const content = request.input[0].content;
    assert.equal(content.length, 2);
    assert.ok(content.every((part: { type: string }) => part.type === 'input_text'));
    assert.equal(content[0].text, 'math-only-instructions');
    const data = JSON.parse(content[1].text.slice(content[1].text.indexOf('\n') + 1));
    assert.deepEqual(data, { problemLatex, ...(solutionLatex === undefined ? {} : { solutionLatex }) });
    assert.equal(options.maxRetries, 0);
    assert.equal(options.signal, context.signal);
    assert.equal(options.timeout, context.timeoutMs);
    assert.equal(request.max_output_tokens, context.maxOutputTokens);
  }
});
