import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProviderPrompt, buildRepairPrompt } from './prompt.js';

test('adds the bounded recovery contract only to provider retries', () => {
  const firstAttempt = buildProviderPrompt('solve', 0);
  const retry = buildProviderPrompt('solve', 1);

  assert.doesNotMatch(firstAttempt, /Validarea răspunsului anterior/);
  assert.match(retry, /cel mult 32 de blocuri pentru problem/);
  assert.match(retry, /Figura 1/);
  assert.match(retry, /fără să scurtezi enunțul/);
  assert.match(firstAttempt, /title identifică exercițiul concret în 3-10 cuvinte/);
  assert.match(firstAttempt, /Nu repeta pur și simplu topic/);
});

test('builds a format-only repair prompt with safe issue paths', () => {
  const prompt = buildRepairPrompt('check', [{ code: 'custom', path: 'steps.1.explanation.2.text' }], 'schema');

  assert.match(prompt, /Nu recalcula problema/);
  assert.match(prompt, /steps\.1\.explanation\.2\.text/);
  assert.match(prompt, /modul "check"/);
});
