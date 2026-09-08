import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_PROVIDER_OUTPUT_CHARS,
  MAX_PROVIDER_OUTPUT_TOKENS,
  PROVIDER_CALL_TIMEOUT_MS,
  PROVIDER_PIPELINE_TIMEOUT_MS,
  ProviderDeadlineError,
  runProviderPipeline,
  type ProviderGenerationRequest,
} from './providerPipeline.js';

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

test('repairs a wrong-mode candidate and returns only the requested mode', async () => {
  const requests: ProviderGenerationRequest[] = [];
  const result = await runProviderPipeline({
    mode: 'solve', imageBase64: 'image', mimeType: 'image/jpeg',
    generate: async (request) => {
      requests.push(request);
      return serialize(requests.length === 1
        ? providerLesson({ mode: 'check', verdict: 'correct' })
        : providerLesson());
    },
  });
  assert.equal(result.mode, 'solve');
  assert.deepEqual(requests.map((request) => request.kind), ['image', 'repair']);
  assert.match(requests[1].prompt, /mode/);
});

test('commits capacity before every image and repair and stops without retry when capacity rejects', async () => {
  const events: string[] = [];
  const exhausted = new Error('capacity exhausted');
  await assert.rejects(() => runProviderPipeline({
    mode: 'solve', imageBase64: 'image', mimeType: 'image/jpeg',
    beforeGenerate: async (request) => {
      events.push(`reserve:${request.kind}`);
      if (request.kind === 'repair') throw exhausted;
    },
    generate: async (request, context) => {
      events.push(`generate:${request.kind}`);
      assert.equal(context.maxOutputTokens, MAX_PROVIDER_OUTPUT_TOKENS);
      assert.equal(context.signal.aborted, false);
      return serialize(providerLesson({ summary: [text('x = 2')] }));
    },
  }), (error) => error === exhausted);
  assert.deepEqual(events, ['reserve:image', 'generate:image', 'reserve:repair']);
});

test('an oversized candidate is not parsed or retransmitted as a repair', async () => {
  const requests: ProviderGenerationRequest[] = [];
  await assert.rejects(() => runProviderPipeline({
    mode: 'solve', imageBase64: 'image', mimeType: 'image/jpeg',
    generate: async (request) => {
      requests.push(request);
      return ' '.repeat(MAX_PROVIDER_OUTPUT_CHARS + 1);
    },
  }), /output size budget/);
  assert.deepEqual(requests.map((request) => request.kind), ['image', 'image']);
});

test('aborts an unresponsive provider and never launches an overlapping retry', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  let signal: AbortSignal | undefined;
  const pending = runProviderPipeline({
    mode: 'solve', imageBase64: 'image', mimeType: 'image/jpeg',
    generate: (_request, context) => {
      calls += 1;
      signal = context.signal;
      return new Promise(() => undefined);
    },
  });
  const rejection = assert.rejects(pending, ProviderDeadlineError);
  await Promise.resolve();
  t.mock.timers.tick(PROVIDER_CALL_TIMEOUT_MS);
  await rejection;
  assert.equal(calls, 1);
  assert.equal(signal?.aborted, true);
});

test('a late budget commit cannot start provider I/O after the caller timed out', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finishBudget!: () => void;
  let calls = 0;
  const pending = runProviderPipeline({
    mode: 'solve', imageBase64: 'image', mimeType: 'image/jpeg',
    beforeGenerate: () => new Promise<void>((resolve) => { finishBudget = resolve; }),
    generate: async () => { calls += 1; return serialize(providerLesson()); },
  });
  const rejection = assert.rejects(pending, ProviderDeadlineError);
  t.mock.timers.tick(PROVIDER_CALL_TIMEOUT_MS);
  await rejection;
  finishBudget();
  await Promise.resolve();
  assert.equal(calls, 0);
});

test('an exhausted overall deadline prevents another budget reservation or call', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1 });
  let reserved = 0;
  let calls = 0;
  await assert.rejects(() => runProviderPipeline({
    mode: 'solve', imageBase64: 'image', mimeType: 'image/jpeg',
    beforeGenerate: async () => { reserved += 1; },
    generate: async () => {
      calls += 1;
      t.mock.timers.setTime(PROVIDER_PIPELINE_TIMEOUT_MS + 1);
      throw new Error('late provider failure');
    },
  }), ProviderDeadlineError);
  assert.equal(calls, 1);
  assert.equal(reserved, 1);
});

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

for (const mode of ['solve', 'check'] as const) {
  test(`rejects a valid response for the opposite ${mode} flow before returning it`, async () => {
    const wrongMode = mode === 'solve' ? 'check' : 'solve';
    let calls = 0;
    const rejected: string[] = [];
    await assert.rejects(() => runProviderPipeline({
      mode, imageBase64: 'image', mimeType: 'image/jpeg',
      generate: async () => {
        calls += 1;
        return serialize(providerLesson({ mode: wrongMode, verdict: wrongMode === 'check' ? 'correct' : 'not_applicable' }));
      },
      onRejected: (event) => { rejected.push(...event.issues.map((issue) => issue.path)); },
    }));
    assert.equal(calls, 3);
    assert.ok(rejected.includes('mode'));
  });
}
