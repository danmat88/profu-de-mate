import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { friendlyAnalysisError } from '../../src/features/analysis/utils/analysisErrors.ts';

test('separates an offline device from a server timeout', () => {
  const offline = friendlyAnalysisError({ code: 'functions/unavailable' });
  const timeout = friendlyAnalysisError({ code: 'functions/deadline-exceeded' });

  assert.match(offline, /internet/i);
  assert.match(timeout, /durat prea mult/i);
  assert.notEqual(offline, timeout);
});

test('keeps security, quota and invalid-image recovery messages specific', () => {
  assert.match(friendlyAnalysisError({ code: 'app-check/not-ready' }), /verifica această instalare/i);
  assert.match(friendlyAnalysisError({ code: 'functions/resource-exhausted' }), /limita de analize/i);
  assert.match(friendlyAnalysisError({ code: 'functions/invalid-argument' }), /problema completă/i);
});

test('does not expose an unexpected provider error message to the user', () => {
  const message = friendlyAnalysisError(new Error('provider secret: raw upstream failure'));

  assert.doesNotMatch(message, /provider|secret|upstream/i);
  assert.match(message, /Nu am putut analiza fotografia/i);
});

test('AI practice and exam grading error mappers never return raw error.message verbatim and exempt server-wide temporary limits from Paywall', async () => {
  const [practiceSource, gradingSource, processingSource, mathProcessingSource, mathInputSource, reviewSource, sheetSource, examSimSource] = await Promise.all([
    readFile(new URL('../../src/features/practice/services/aiPractice.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/exams/services/examGrading.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/analysis/screens/ProcessingScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/analysis/screens/MathProcessingScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/math/screens/MathInputScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/capture/screens/ReviewScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/practice/components/AiPracticeSheet.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/exams/screens/ExamSimulationScreen.tsx', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(practiceSource, /return error\.message;/);
  assert.doesNotMatch(gradingSource, /return error\.message;/);
  assert.match(practiceSource, /app-check/);
  assert.match(gradingSource, /app-check/);

  for (const screen of [processingSource, mathProcessingSource, mathInputSource, reviewSource, sheetSource, examSimSource]) {
    assert.match(screen, /isTemporaryCommercialLimit/);
  }
});
