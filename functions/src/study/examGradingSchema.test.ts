import assert from 'node:assert/strict';
import test from 'node:test';
import {
  examGradingResultSchema,
  normalizeExamGradingResult,
  normalizeRawExamGrading,
  parseGradeExamSolutionRequest,
} from './examGradingSchema.js';
import { buildExamGradingPrompt } from './examGradingService.js';

const validToken = 'b'.repeat(64);
const validRequestId = 'analysis-abcd1234-efgh5678';
const sampleBase64 = Buffer.from('fake-jpeg-bytes').toString('base64');

test('parseGradeExamSolutionRequest validates exam payload, rubric criteria, and photo limits', () => {
  const parsed = parseGradeExamSolutionRequest({
    examId: 'en',
    itemTitle: 'S.III · 1 — Problemă cu ecuație',
    maxPoints: 5,
    problemText: 'Ana cumpără 3 caiete și 2 pixuri și plătește 31 lei.',
    rubricCriteria: [
      { step: 'a) Verificare 36 ≠ 31', points: 2 },
      { step: 'b) Ecuație și soluție p = 5, c = 7', points: 3 },
    ],
    imageBase64: sampleBase64,
    mimeType: 'image/jpeg',
    requestId: validRequestId,
    installationToken: validToken,
  });

  assert.equal(parsed.examId, 'en');
  assert.equal(parsed.maxPoints, 5);
  assert.equal(parsed.rubricCriteria.length, 2);

  assert.throws(() => parseGradeExamSolutionRequest({
    examId: 'en',
    itemTitle: 'S.III',
    maxPoints: 5,
    problemText: 'Enunț valid aici.',
    rubricCriteria: [],
    imageBase64: sampleBase64,
    mimeType: 'image/jpeg',
    requestId: validRequestId,
    installationToken: validToken,
  }));

  const prompt = buildExamGradingPrompt(parsed);
  assert.match(prompt, /Evaluarea Națională/);
  assert.match(prompt, /\[2p\]/);
  assert.match(prompt, /\[3p\]/);
});

test('normalizeExamGradingResult clamps points strictly to rubric maximums and zeros unclear photos', () => {
  const rawOver = examGradingResultSchema.parse({
    status: 'graded',
    awardedPoints: 20,
    verdict: 'complete',
    summary: 'Rezolvare bună, cu o mică omisiune la final.',
    criteriaScores: [
      { step: 'Etapa a)', awardedPoints: 5, maxPoints: 2, comment: 'Corect.' },
      { step: 'Etapa b)', awardedPoints: 2, maxPoints: 3, comment: 'Lipsește concluzia finală.' },
    ],
    improvementTip: 'Scrie mereu unitatea de măsură în concluzie.',
  });

  const normalized = normalizeExamGradingResult(rawOver, {
    maxPoints: 5,
    rubricCriteria: [
      { step: 'Etapa a)', points: 2 },
      { step: 'Etapa b)', points: 3 },
    ],
  });

  assert.equal(normalized.awardedPoints, 4);
  assert.equal(normalized.maxPoints, 5);
  assert.equal(normalized.verdict, 'partial');
  assert.equal(normalized.criteriaScores[0].awardedPoints, 2);
  assert.equal(normalized.criteriaScores[1].awardedPoints, 2);

  const unclear = normalizeExamGradingResult({
    status: 'unclear',
    awardedPoints: 3,
    verdict: 'partial',
    summary: 'Fotografia este mișcată.',
    criteriaScores: [],
    improvementTip: 'Fă poza la lumină mai bună.',
  }, { maxPoints: 5, rubricCriteria: [{ step: 'Etapa 1', points: 5 }] });

  assert.equal(unclear.awardedPoints, 0);
  assert.equal(unclear.verdict, 'needs_work');

  // Dirty Gemini grading payload with fractional points and missing fields normalizes cleanly
  const dirtyGrading = normalizeRawExamGrading({
    status: 'graded',
    awardedPoints: 3.6,
    verdict: 'partial',
    summary: '  Rezolvare parțială corectă.  ',
    criteriaScores: [
      { step: 'Etapa a)', awardedPoints: '1.8', maxPoints: 2, comment: '' },
      { step: 'Etapa b)', awardedPoints: 2.2, maxPoints: 3, comment: '  Bun!  ' },
    ],
    improvementTip: '',
  }, {
    maxPoints: 5,
    rubricCriteria: [
      { step: 'Etapa a)', points: 2 },
      { step: 'Etapa b)', points: 3 },
    ],
  });
  const parsedDirty = examGradingResultSchema.parse(dirtyGrading);
  assert.equal(parsedDirty.criteriaScores[0].awardedPoints, 2);
  assert.equal(parsedDirty.criteriaScores[1].awardedPoints, 2);
  assert.ok(parsedDirty.criteriaScores[0].comment.length > 0);
  assert.ok(parsedDirty.improvementTip.length >= 4);
});
