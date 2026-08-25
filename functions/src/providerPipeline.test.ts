import assert from 'node:assert/strict';
import test from 'node:test';
import { runProviderPipeline, type ProviderGenerationRequest } from './providerPipeline.js';

const text = (value: string) => ({ type: 'text', text: value, latex: '', spoken: '', visual: '' });
const math = (latex: string, spoken: string) => ({ type: 'math', text: '', latex, spoken, visual: '' });

function providerLesson(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ready', mode: 'solve', title: 'Ecuație de gradul întâi',
    problem: [math('2x+1=5', 'doi x plus unu este egal cu cinci')],
    topic: 'Ecuații de gradul întâi', verdict: 'not_applicable',
    headline: 'Izolăm necunoscuta.', summary: [text('Mutăm termenul liber.')],
    finalAnswer: [math('x=2', 'x este egal cu doi')],
    steps: [{
      kicker: 'CALCULĂM', title: 'Izolăm necunoscuta',
      explanation: [text('Scădem aceeași valoare din ambii membri.'), math('2x=4', 'doi x este egal cu patru')],
      note: [text('Păstrăm egalitatea echilibrată.')],
      alternative: [text('Putem verifica prin înlocuire.')],
    }],
    takeaways: [{ content: [text('Aplicăm aceeași operație în ambii membri.')] }],
    ...overrides,
  };
}

const serialize = (value: unknown) => JSON.stringify(value);

test('repairs a schema-valid JSON response that mixes math into prose', async () => {
  const requests: ProviderGenerationRequest[] = [];
  const invalid = providerLesson({ summary: [text('Obținem x = 2.')] });
  const result = await runProviderPipeline({
    mode: 'solve', imageBase64: 'image', mimeType: 'image/jpeg',
    generate: async (request) => {
      requests.push(request);
      return requests.length === 1 ? serialize(invalid) : serialize(providerLesson());
    },
  });

  assert.equal(result.status, 'ready');
  assert.deepEqual(requests.map((request) => request.kind), ['image', 'repair']);
  assert.match(requests[1].prompt, /summary\.0\.text/);
});

test('retries the image after a provider failure', async () => {
  const requests: ProviderGenerationRequest[] = [];
  const result = await runProviderPipeline({
    mode: 'solve', imageBase64: 'image', mimeType: 'image/jpeg',
    generate: async (request) => {
      requests.push(request);
      if (requests.length === 1) throw new Error('temporary');
      return serialize(providerLesson());
    },
  });

  assert.equal(result.status, 'ready');
  assert.deepEqual(requests.map((request) => request.kind), ['image', 'image']);
  assert.match(requests[1].prompt, /Validarea răspunsului anterior/);
});

test('repairs invalid LaTeX before it can reach storage', async () => {
  const requests: ProviderGenerationRequest[] = [];
  const invalidLatex = providerLesson({ finalAnswer: [math('\\frac{1}{', 'o fracție incompletă')] });
  const result = await runProviderPipeline({
    mode: 'solve', imageBase64: 'image', mimeType: 'image/jpeg',
    generate: async (request) => {
      requests.push(request);
      return requests.length === 1 ? serialize(invalidLatex) : serialize(providerLesson());
    },
  });

  assert.equal(result.status, 'ready');
  assert.deepEqual(requests.map((request) => request.kind), ['image', 'repair']);
  assert.match(requests[1].prompt, /Etapa respinsă: render/);
});

test('never exceeds three calls and preserves the last failure', async () => {
  const requests: ProviderGenerationRequest[] = [];
  const invalid = serialize(providerLesson({ summary: [text('x = 2')] }));

  await assert.rejects(() => runProviderPipeline({
    mode: 'solve', imageBase64: 'image', mimeType: 'image/jpeg',
    generate: async (request) => {
      requests.push(request);
      return invalid;
    },
  }));

  assert.equal(requests.length, 3);
  assert.deepEqual(requests.map((request) => request.kind), ['image', 'repair', 'image']);
});
