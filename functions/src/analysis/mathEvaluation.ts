import { z } from 'zod';
import { mathAnalysisSchema, normalizeProviderAnalysis } from './analysisSchema.js';

const caseSchema = z.object({
  id: z.string().min(1), category: z.string().min(1), mode: z.enum(['solve', 'check']),
  expectedStatus: z.enum(['ready', 'unclear', 'not_math']),
  expectedAnswer: z.string().min(1),
});
const rubricSchema = z.object({
  reviewer: z.string().min(1), reviewedAt: z.iso.datetime(),
  mathematicsCorrect: z.boolean(), explanationCorrect: z.boolean(), safe: z.boolean(),
});
const resultSchema = z.object({
  caseId: z.string(), model: z.string().min(1), response: z.unknown(),
  latencyMs: z.number().nonnegative(), providerAttempts: z.number().int().min(1).max(3),
  review: rubricSchema,
});
const policySchema = z.object({
  approvedBy: z.string().min(1), approvedAt: z.iso.datetime(),
  minimumCases: z.number().int().min(100), requiredCategories: z.array(z.string().min(1)).min(1),
  minimumCorrectRate: z.number().min(0).max(1), maximumP95LatencyMs: z.number().positive(),
});

/** Offline release evidence. A schema-valid AI answer alone never passes the math rubric. */
export function evaluateMathResults(manifest: unknown, observations: unknown) {
  const dataset = z.object({ policy: policySchema, cases: z.array(caseSchema) }).parse(manifest);
  const results = z.array(resultSchema).parse(observations);
  const ids = new Set(dataset.cases.map((item) => item.id));
  if (ids.size !== dataset.cases.length) throw new Error('Duplicate benchmark case ID.');
  const byId = new Map(results.map((item) => [item.caseId, item]));
  if (byId.size !== results.length || results.some((item) => !ids.has(item.caseId))) throw new Error('Duplicate or unknown observation.');
  const failures: { caseId: string; reason: string }[] = [];
  let correct = 0;
  for (const item of dataset.cases) {
    const observation = byId.get(item.id);
    if (!observation) { failures.push({ caseId: item.id, reason: 'missing-result' }); continue; }
    const response = mathAnalysisSchema.safeParse(normalizeProviderAnalysis(observation.response));
    if (!response.success || response.data.mode !== item.mode || response.data.status !== item.expectedStatus) {
      failures.push({ caseId: item.id, reason: 'contract' }); continue;
    }
    if (!observation.review.safe) { failures.push({ caseId: item.id, reason: 'unsafe' }); continue; }
    if (!observation.review.mathematicsCorrect || !observation.review.explanationCorrect) {
      failures.push({ caseId: item.id, reason: 'human-rubric' }); continue;
    }
    correct++;
  }
  const categories = new Set(dataset.cases.map((item) => item.category));
  const missingCategories = dataset.policy.requiredCategories.filter((category) => !categories.has(category));
  const latency = results.map((item) => item.latencyMs).sort((a, b) => a - b);
  const p95LatencyMs = latency.length ? latency[Math.ceil(latency.length * .95) - 1] : null;
  const correctRate = dataset.cases.length ? correct / dataset.cases.length : 0;
  const complete = results.length === dataset.cases.length && dataset.cases.length >= dataset.policy.minimumCases && missingCategories.length === 0;
  return {
    accepted: complete && correctRate >= dataset.policy.minimumCorrectRate
      && !failures.some((item) => item.reason === 'unsafe' || item.reason === 'contract')
      && p95LatencyMs !== null && p95LatencyMs <= dataset.policy.maximumP95LatencyMs,
    complete, total: dataset.cases.length, correct, correctRate, p95LatencyMs, missingCategories, failures,
    models: [...new Set(results.map((item) => item.model))],
    policy: dataset.policy,
  };
}
