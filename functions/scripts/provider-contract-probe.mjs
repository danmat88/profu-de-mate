import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { createMathProvider } from '../lib/analysis/aiProvider.js';
import { runProviderPipeline } from '../lib/analysis/providerPipeline.js';

const imagePath = process.argv[2] ? resolve(process.argv[2]) : '';
const mode = process.argv[3] === 'check' ? 'check' : 'solve';
const apiKey = process.env.PROFU_OPENAI_DIAGNOSTIC_KEY;

if (!imagePath || !apiKey) {
  throw new Error('Set PROFU_OPENAI_DIAGNOSTIC_KEY and pass an image path.');
}

const extension = extname(imagePath).toLowerCase();
const mimeType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
const imageBase64 = (await readFile(imagePath)).toString('base64');
const provider = createMathProvider(apiKey);
const results = [];

function safeProviderError(error) {
  if (!error || typeof error !== 'object') return { name: typeof error };
  const message = typeof error.message === 'string'
    ? error.message.slice(0, 700).replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]')
    : undefined;
  return {
    name: typeof error.name === 'string' ? error.name.slice(0, 80) : 'UnknownError',
    ...(typeof error.status === 'number' ? { status: error.status } : {}),
    ...(typeof error.code === 'number' || typeof error.code === 'string' ? { code: error.code } : {}),
    ...(message ? { message } : {}),
  };
}

const startedAt = Date.now();
let callCount = 0;
try {
  const rendered = await runProviderPipeline({
    mode,
    imageBase64,
    mimeType,
    generate: async (request, context) => {
      callCount += 1;
      return provider.generate(request, context);
    },
    onRejected: (event) => results.push({ ...event, ok: false }),
  });
  results.push({
    call: callCount,
    model: provider.model,
    stage: 'complete',
    ok: true,
    status: rendered.status,
    mode: rendered.mode,
    problemBlocks: rendered.problem.length,
    steps: rendered.steps.length,
    explanationBlocks: rendered.steps.map((step) => step.explanation.length),
    durationMs: Date.now() - startedAt,
  });
} catch (error) {
  results.push({ call: callCount, model: provider.model, stage: 'failed', ok: false, error: safeProviderError(error), durationMs: Date.now() - startedAt });
}

process.stdout.write(`${JSON.stringify({ imageBytes: Buffer.byteLength(imageBase64, 'base64'), mode, model: provider.model, results }, null, 2)}\n`);
if (!results.some((result) => result.ok)) process.exitCode = 1;
