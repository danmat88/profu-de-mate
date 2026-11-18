import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { requestFingerprint } from './analysisRequests.js';

test('image request fingerprints retain the exact legacy byte protocol', () => {
  for (const mode of ['solve', 'check'] as const) {
    const input = { mode, mimeType: 'image/jpeg' as const, imageBase64: 'AQ==' };
    const legacyHash = createHash('sha256').update(`${mode}\nimage/jpeg\n`).update('AQ==').digest('hex');
    assert.equal(requestFingerprint(input), legacyHash);
    assert.equal(requestFingerprint({ ...input, kind: 'image' }), legacyHash);
  }
});

test('typed fingerprints bind problem, attempted solution, mode and input protocol', () => {
  const input = { kind: 'math' as const, mode: 'check' as const, problemLatex: 'x+1=2', solutionLatex: 'x=1' };
  const fingerprint = requestFingerprint(input);
  assert.equal(requestFingerprint({ ...input }), fingerprint);
  assert.notEqual(requestFingerprint({ ...input, problemLatex: 'x+1=3' }), fingerprint);
  assert.notEqual(requestFingerprint({ ...input, solutionLatex: 'x=2' }), fingerprint);
  assert.notEqual(requestFingerprint({ ...input, mode: 'solve' }), fingerprint);
  assert.notEqual(requestFingerprint({ ...input, solutionLatex: undefined }), fingerprint);
  assert.notEqual(requestFingerprint({ mode: 'check', mimeType: 'image/jpeg', imageBase64: input.problemLatex }), fingerprint);
  // Field boundaries must not collide even when concatenated bytes would match.
  assert.notEqual(
    requestFingerprint({ ...input, problemLatex: '12', solutionLatex: '3' }),
    requestFingerprint({ ...input, problemLatex: '1', solutionLatex: '23' }),
  );
});
