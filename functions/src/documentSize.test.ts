import assert from 'node:assert/strict';
import test from 'node:test';
import { assertFirestoreSafeAnalysis, MAX_ANALYSIS_JSON_BYTES } from './documentSize.js';

test('accepts a rendered analysis with safe Firestore headroom', () => {
  assert.doesNotThrow(() => assertFirestoreSafeAnalysis({ svg: '<svg></svg>', title: 'Ecuație' }));
});

test('rejects an analysis that could exceed the Firestore document limit', () => {
  const oversized = { svg: 'x'.repeat(MAX_ANALYSIS_JSON_BYTES + 1) };
  assert.throws(() => assertFirestoreSafeAnalysis(oversized), /too large for Firestore/);
});
