import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAnalyzeRequest } from './validation.js';

const validRequest = {
  mode: 'solve',
  imageBase64: 'AQ==',
  mimeType: 'image/jpeg',
  requestId: 'analysis-mep7xk2a-a1b2c3d4',
};

test('accepts a well-formed idempotent analysis request', () => {
  assert.deepEqual(parseAnalyzeRequest(validRequest), validRequest);
});

test('rejects a missing or malformed analysis request id', () => {
  assert.throws(() => parseAnalyzeRequest({ ...validRequest, requestId: '' }));
  assert.throws(() => parseAnalyzeRequest({ ...validRequest, requestId: '../same-request' }));
  assert.throws(() => parseAnalyzeRequest({ ...validRequest, requestId: 'analysis-short-id' }));
});
