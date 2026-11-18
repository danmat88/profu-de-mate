import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAnalysisStatusRequest, parseAnalyzeRequest } from './validation.js';

const validRequest = {
  mode: 'solve',
  imageBase64: 'AQ==',
  mimeType: 'image/jpeg',
  requestId: 'analysis-mep7xk2a-a1b2c3d4',
  installationToken: 'a'.repeat(64),
};

test('accepts a well-formed idempotent analysis request', () => {
  assert.deepEqual(parseAnalyzeRequest(validRequest), validRequest);
});

test('rejects a missing or malformed analysis request id', () => {
  assert.throws(() => parseAnalyzeRequest({ ...validRequest, requestId: '' }));
  assert.throws(() => parseAnalyzeRequest({ ...validRequest, requestId: '../same-request' }));
  assert.throws(() => parseAnalyzeRequest({ ...validRequest, requestId: 'analysis-short-id' }));
});

test('requires the stable installation credential on every analysis', () => {
  assert.throws(() => parseAnalyzeRequest({ ...validRequest, installationToken: '' }));
  assert.throws(() => parseAnalyzeRequest({ ...validRequest, installationToken: 'a'.repeat(63) }));
});

test('status lookup accepts only the scoped analysis request identifier', () => {
  assert.deepEqual(parseAnalysisStatusRequest({ requestId: validRequest.requestId }), {
    requestId: validRequest.requestId,
  });
  assert.throws(() => parseAnalysisStatusRequest({ requestId: '../another-user' }));
  assert.throws(() => parseAnalysisStatusRequest(null));
});

const validMathRequest = {
  kind: 'math', mode: 'solve', problemLatex: '2x+1=5',
  requestId: validRequest.requestId, installationToken: validRequest.installationToken,
};

test('accepts typed problems without an image and requires the same request credentials', () => {
  assert.deepEqual(parseAnalyzeRequest(validMathRequest), validMathRequest);
  assert.deepEqual(parseAnalyzeRequest({ ...validMathRequest, mode: 'check', solutionLatex: 'x=2' }),
    { ...validMathRequest, mode: 'check', solutionLatex: 'x=2' });
  assert.throws(() => parseAnalyzeRequest({ ...validMathRequest, requestId: '../request' }));
  assert.throws(() => parseAnalyzeRequest({ ...validMathRequest, installationToken: '' }));
  assert.throws(() => parseAnalyzeRequest({ ...validMathRequest, mode: 'anything' }));
});

test('typed verification requires an attempted solution and solve mode refuses one', () => {
  for (const solutionLatex of [undefined, null, '', 'x=']) {
    assert.throws(() => parseAnalyzeRequest({ ...validMathRequest, mode: 'check', solutionLatex }));
  }
  for (const solutionLatex of [null, '', 'x=2']) {
    assert.throws(() => parseAnalyzeRequest({ ...validMathRequest, solutionLatex }));
  }
});

test('does not accept mixed input, an unknown kind, or a malformed math expression', () => {
  for (const request of [
    { ...validRequest, kind: 'text' }, { ...validRequest, kind: null },
    { ...validRequest, problemLatex: 'x' }, { ...validRequest, solutionLatex: 'x' },
    { ...validMathRequest, mimeType: 'image/jpeg' },
    { ...validMathRequest, imageBase64: 'AQ==' },
    { ...validMathRequest, kind: undefined },
    { ...validMathRequest, problemLatex: String.raw`\text{hello}` },
    [],
  ]) assert.throws(() => parseAnalyzeRequest(request));
  assert.deepEqual(parseAnalyzeRequest({ ...validRequest, kind: 'image' }), validRequest);
});
