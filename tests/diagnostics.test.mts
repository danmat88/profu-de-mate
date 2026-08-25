import assert from 'node:assert/strict';
import test from 'node:test';
import { createSafeDiagnosticError } from '../src/utils/diagnostics.ts';

test('diagnostics retain a safe code but never the upstream message', () => {
  const source = Object.assign(new Error('secret provider response and photographed text'), {
    code: 'functions/internal',
  });
  const report = createSafeDiagnosticError('analysis_request', source);

  assert.equal(report.message, 'analysis_request:functions/internal');
  assert.doesNotMatch(report.stack ?? '', /secret provider|photographed text/i);
});

test('diagnostics reject arbitrary values masquerading as error codes', () => {
  const report = createSafeDiagnosticError('app_render', {
    code: 'image content = x^2; auth token = 123',
    message: 'private',
  });

  assert.equal(report.message, 'app_render:unclassified');
});
