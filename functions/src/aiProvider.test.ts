import assert from 'node:assert/strict';
import test from 'node:test';
import type { GoogleGenAI } from '@google/genai';
import { createMathProvider } from './aiProvider.js';

test('actual adapter propagates cancellation and output budget with zero invisible SDK retries', async () => {
  const calls: { request: any; options: any }[] = [];
  const client = { interactions: { create: async (request: unknown, options: unknown) => {
    calls.push({ request, options }); return { output_text: '{}' };
  } } } as unknown as GoogleGenAI;
  const provider = createMathProvider('fixture-only', client);
  const context = { signal: new AbortController().signal, timeoutMs: 1234, maxOutputTokens: 4321 };
  assert.equal(await provider.generate({ kind: 'image', prompt: 'solve', imageBase64: 'fixture', mimeType: 'image/jpeg' }, context), '{}');
  await provider.generate({ kind: 'repair', prompt: 'repair', source: 'invalid-json' }, context);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.request.store, false);
    assert.equal(call.options.maxRetries, 0);
    assert.equal(call.options.signal, context.signal);
    assert.equal(call.options.timeout, 1234);
    assert.equal(call.request.generation_config.max_output_tokens, 4321);
  }
  assert.equal(calls[0].request.input[1].type, 'image');
  assert.ok(calls[1].request.input.every((part: { type: string }) => part.type === 'text'));
});

test('typed adapter sends separate math data as text without image parts or storage', async () => {
  const calls: { request: any; options: any }[] = [];
  const client = { interactions: { create: async (request: unknown, options: unknown) => {
    calls.push({ request, options }); return { output_text: '{}' };
  } } } as unknown as GoogleGenAI;
  const provider = createMathProvider('fixture-only', client);
  const context = { signal: new AbortController().signal, timeoutMs: 321, maxOutputTokens: 123 };
  const problemLatex = String.raw`\frac{x}{2}=3`;
  for (const solutionLatex of [undefined, 'x=6']) {
    await provider.generate({ kind: 'math', prompt: 'math-only-instructions', problemLatex, solutionLatex }, context);
    const { request, options } = calls[calls.length - 1];
    assert.equal(request.store, false);
    assert.equal(request.input.length, 2);
    assert.ok(request.input.every((part: { type: string }) => part.type === 'text'));
    assert.equal(request.input[0].text, 'math-only-instructions');
    const data = JSON.parse(request.input[1].text.slice(request.input[1].text.indexOf('\n') + 1));
    assert.deepEqual(data, { problemLatex, ...(solutionLatex === undefined ? {} : { solutionLatex }) });
    assert.equal(options.maxRetries, 0);
    assert.equal(options.signal, context.signal);
    assert.equal(options.timeout, context.timeoutMs);
    assert.equal(request.generation_config.max_output_tokens, context.maxOutputTokens);
  }
});
