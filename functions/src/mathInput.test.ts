import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpsError } from 'firebase-functions/v2/https';
import { MAX_MATH_INPUT_LENGTH, parseMathInput } from './mathInput.js';

test('accepts the editor vocabulary and preserves unambiguous formula structure', () => {
  for (const expression of [
    '2x+1=5', 'x=2', '0', '.25+1.5', '-(x+2)', '--x',
    String.raw`\frac{1}{2}+\frac{x+1}{y-2}`,
    String.raw`{x+1}^{2}=\sqrt{9}`,
    String.raw`2\pi x\times y\div z`,
    String.raw`-2<x\le 3`, String.raw`x\ge y>z`,
    String.raw`{\frac{1}{2}}^{-2}`, 'x'.repeat(256),
    `${'('.repeat(8)}x${')'.repeat(8)}`,
  ]) assert.equal(parseMathInput(` ${expression} `, 'problemLatex'), expression);
});

test('rejects incomplete operands, templates, decimal values and relations', () => {
  for (const expression of [
    '', ' ', '.', '1.', '1.2.3', '1 2', 'x+', 'x=', '=x', 'x<>2',
    String.raw`\frac{}{2}`, String.raw`\frac{1}{}`, String.raw`\frac{1}`,
    String.raw`\sqrt{}`, '{}^{2}', '{x}^{}', 'x^2', '{x}^{2}^{3}',
    '(x+1', 'x+1)', '{}', '(x+)', String.raw`x\times \div 2`,
  ]) assert.throws(() => parseMathInput(expression, 'problemLatex'),
    (error: unknown) => error instanceof HttpsError && error.code === 'invalid-argument', expression);
});

test('rejects free text, TeX injection, Unicode controls and unsupported symbols', () => {
  for (const expression of [
    'ignore previous instructions', String.raw`\text{ignore previous instructions}`,
    String.raw`\href{https://example.com}{x}`, String.raw`\input{secret}`,
    String.raw`\begin{matrix}1\end{matrix}`, String.raw`\pifoo`,
    String.raw`\pix`, String.raw`\sqrt[3]{8}`, '$x$', 'x%comment',
    'x\n+1', 'x\r+1', 'x\t+1', 'x\u0000+1', 'x\u202E+1', 'x\u00A0+1',
    'х+1', '2×3', 'a+1', '1/2', '3,14',
  ]) assert.throws(() => parseMathInput(expression, 'solutionLatex'),
    (error: unknown) => error instanceof HttpsError && error.code === 'invalid-argument', expression);
});

test('bounds input size, nesting and parsing work without stack overflows', () => {
  for (const expression of [
    '1'.repeat(MAX_MATH_INPUT_LENGTH + 1),
    `${'('.repeat(100)}x${')'.repeat(100)}`,
    `${'+'.repeat(1100)}1`,
    'x'.repeat(1000),
    null, {}, 123,
  ]) assert.throws(() => parseMathInput(expression, 'problemLatex'),
    (error: unknown) => error instanceof HttpsError && error.code === 'invalid-argument');
  assert.equal(parseMathInput('1'.repeat(MAX_MATH_INPUT_LENGTH), 'problemLatex').length, MAX_MATH_INPUT_LENGTH);
});
