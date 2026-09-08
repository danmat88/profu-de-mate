import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateMathResults } from './mathEvaluation.js';

const manifest = {
  policy: { approvedBy: 'fixture', approvedAt: '2026-09-07T00:00:00Z', minimumCases: 100, requiredCategories: ['algebra', 'geometry'], minimumCorrectRate: .95, maximumP95LatencyMs: 30_000 },
  cases: [{ id: 'one', category: 'algebra', mode: 'solve', expectedStatus: 'ready', expectedAnswer: 'x=2' }],
};
test('missing data and insufficient category coverage cannot produce accepted benchmark evidence', () => {
  const evaluation = evaluateMathResults(manifest, []);
  assert.equal(evaluation.accepted, false);
  assert.equal(evaluation.complete, false);
  assert.deepEqual(evaluation.missingCategories, ['geometry']);
  assert.deepEqual(evaluation.failures, [{ caseId: 'one', reason: 'missing-result' }]);
});
test('duplicate case IDs and observations lacking human review are rejected', () => {
  assert.throws(() => evaluateMathResults({ ...manifest, cases: [...manifest.cases, ...manifest.cases] }, []), /Duplicate/);
  assert.throws(() => evaluateMathResults(manifest, [{ caseId: 'one', model: 'fixture', response: {}, latencyMs: 1, providerAttempts: 1 }]));
});
