import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateInstantMath } from '../../src/features/math/utils/instantMathEvaluator.ts';
import type { MathDocument, MathNode, MathSymbol } from '../../src/features/math/utils/mathEditor.ts';

const s = (value: MathSymbol): MathNode => ({ type: 'symbol', value });
const doc = (...nodes: MathNode[]): MathDocument => ({ version: 1, nodes });
const frac = (numerator: MathNode[], denominator: MathNode[]): MathNode => ({ type: 'fraction', numerator, denominator });
const pow = (base: MathNode[], exponent: MathNode[]): MathNode => ({ type: 'power', base, exponent });
const root = (...radicand: MathNode[]): MathNode => ({ type: 'root', radicand });
const grp = (...content: MathNode[]): MathNode => ({ type: 'group', content });

test('evaluates exact arithmetic, fractions, decimals, powers, simplified radicals, and pi multiples offline', () => {
  // 4 + 4 = 8
  assert.deepEqual(evaluateInstantMath(doc(s('4'), s('+'), s('4'))), {
    kind: 'value',
    badge: 'CALCUL INSTANT',
    primary: '= 8',
    secondary: undefined,
  });

  // Precedence: 15 - 3 × 4 = 3 vs (15 - 3) × 4 = 48
  assert.equal(evaluateInstantMath(doc(s('1'), s('5'), s('-'), s('3'), s('times'), s('4')))?.primary, '= 3');
  assert.equal(evaluateInstantMath(doc(grp(s('1'), s('5'), s('-'), s('3')), s('times'), s('4')))?.primary, '= 48');

  // Exact fractions + decimal: 3/4 + 1/2 = 5/4 (= 1,25)
  const fracRes = evaluateInstantMath(doc(frac([s('3')], [s('4')]), s('+'), frac([s('1')], [s('2')])));
  assert.equal(fracRes?.primary, '= 5/4');
  assert.equal(fracRes?.secondary, '= 1,25');

  // Exact decimal arithmetic without IEEE-754 floating-point drift: 0.1 + 0.2 = 3/10 (= 0,3)
  const decRes = evaluateInstantMath(doc(s('0'), s('.'), s('1'), s('+'), s('0'), s('.'), s('2')));
  assert.equal(decRes?.primary, '= 3/10');
  assert.equal(decRes?.secondary, '= 0,3');

  // Powers and unary minus precedence: -3^2 = -9, (-3)^2 = 9, 2^10 = 1024
  assert.equal(evaluateInstantMath(doc(s('-'), pow([s('3')], [s('2')])))?.primary, '= −9');
  assert.equal(evaluateInstantMath(doc(pow([grp(s('-'), s('3'))], [s('2')])))?.primary, '= 9');
  assert.equal(evaluateInstantMath(doc(pow([s('2')], [s('1'), s('0')])))?.primary, '= 1024');

  // Exact square roots & simplified radicals: √144 = 12, √18 = 3√2, √2 × √8 = 4, 2√3 + 5√3 = 7√3
  assert.equal(evaluateInstantMath(doc(root(s('1'), s('4'), s('4'))))?.primary, '= 12');
  const rad18 = evaluateInstantMath(doc(root(s('1'), s('8'))));
  assert.equal(rad18?.primary, '= 3√2');
  assert.equal(rad18?.secondary, '≈ 4,2426');
  assert.equal(evaluateInstantMath(doc(root(s('2')), s('times'), root(s('8'))))?.primary, '= 4');
  assert.equal(evaluateInstantMath(doc(s('2'), root(s('3')), s('+'), s('5'), root(s('3'))))?.primary, '= 7√3');

  // Exact π multiples: 2π + 3π = 5π
  const piRes = evaluateInstantMath(doc(s('2'), s('pi'), s('+'), s('3'), s('pi')));
  assert.equal(piRes?.primary, '= 5π');
  assert.equal(piRes?.secondary, '≈ 15,708');
});

test('solves linear equations, quadratic equations, linear inequalities, and numeric checks offline', () => {
  // 2x + 5 = 13 -> x = 4
  const lin = evaluateInstantMath(doc(s('2'), s('x'), s('+'), s('5'), s('='), s('1'), s('3')));
  assert.equal(lin?.kind, 'equation');
  assert.equal(lin?.primary, 'x = 4');

  // x/2 + 1 = 4 -> x = 6
  const fracLin = evaluateInstantMath(doc(frac([s('x')], [s('2')]), s('+'), s('1'), s('='), s('4')));
  assert.equal(fracLin?.primary, 'x = 6');

  // x^2 - 9 = 0 -> x ∈ {−3, 3}
  const quadDiff = evaluateInstantMath(doc(pow([s('x')], [s('2')]), s('-'), s('9'), s('='), s('0')));
  assert.equal(quadDiff?.primary, 'x ∈ {−3, 3}');

  // x^2 - 5x + 6 = 0 -> x ∈ {2, 3}
  const quadFact = evaluateInstantMath(doc(pow([s('x')], [s('2')]), s('-'), s('5'), s('x'), s('+'), s('6'), s('='), s('0')));
  assert.equal(quadFact?.primary, 'x ∈ {2, 3}');

  // Double root: x^2 - 4x + 4 = 0 -> x = 2
  const quadDouble = evaluateInstantMath(doc(pow([s('x')], [s('2')]), s('-'), s('4'), s('x'), s('+'), s('4'), s('='), s('0')));
  assert.equal(quadDouble?.primary, 'x = 2');

  // No real roots: x^2 + 1 = 0
  const quadNone = evaluateInstantMath(doc(pow([s('x')], [s('2')]), s('+'), s('1'), s('='), s('0')));
  assert.equal(quadNone?.primary, 'Nu are soluții reale');

  // Linear inequality with negative coefficient flips sign: -2x <= 6 -> x >= -3
  const ineq = evaluateInstantMath(doc(s('-'), s('2'), s('x'), s('le'), s('6')));
  assert.equal(ineq?.kind, 'inequality');
  assert.equal(ineq?.primary, 'x ≥ −3');

  // Constant truth checks
  const eqTrue = evaluateInstantMath(doc(s('4'), s('+'), s('4'), s('='), s('8')));
  assert.equal(eqTrue?.kind, 'truth');
  assert.equal(eqTrue?.primary, 'Adevărat');

  const cmpFalse = evaluateInstantMath(doc(s('3'), s('>'), s('5')));
  assert.equal(cmpFalse?.primary, 'Fals');
  assert.equal(cmpFalse?.secondary, '3 < 5');
});

test('handles domain errors gracefully and returns null silently for bare, incomplete, or complex formulas', () => {
  assert.equal(evaluateInstantMath(doc(s('5'), s('div'), s('0')))?.kind, 'warning');
  assert.equal(evaluateInstantMath(doc(root(s('-'), s('4'))))?.kind, 'warning');

  // Bare number (no operation) -> silent null
  assert.equal(evaluateInstantMath(doc(s('4'), s('2'))), null);
  // Incomplete expression -> silent null
  assert.equal(evaluateInstantMath(doc(s('4'), s('+'))), null);
  // Multi-variable expression -> silent null (delegated to AI)
  assert.equal(evaluateInstantMath(doc(s('x'), s('+'), s('y'), s('='), s('5'))), null);
  // Cubic equation -> silent null (delegated to AI)
  assert.equal(evaluateInstantMath(doc(pow([s('x')], [s('3')]), s('='), s('8'))), null);
  // Huge power -> silent null, zero hang
  assert.equal(evaluateInstantMath(doc(pow([s('9')], [s('9'), s('9'), s('9')]))), null);
});

test('preserves exact rational comparisons, micro-value domain rules, clean decimals, and Citardauq quadratic stability', () => {
  const tenPow = (negExp: string): MathNode => pow([s('1'), s('0')], [s('-'), ...negExp.split('').map((c) => s(c as MathSymbol))]);

  // Exact BigInt comparison: 10^(-11) = 0 is Fals, 10^(-11) > 0 is Adevărat
  assert.equal(evaluateInstantMath(doc(tenPow('11'), s('='), s('0')))?.primary, 'Fals');
  assert.equal(evaluateInstantMath(doc(tenPow('11'), s('>'), s('0')))?.primary, 'Adevărat');
  assert.equal(evaluateInstantMath(doc(s('x'), s('+'), tenPow('11'), s('>'), s('x')))?.primary, 'Orice x ∈ ℝ');

  // Exact divExact / sqrtExact: 1 ÷ 10^(-16) is 10^16 (not div-by-0), √(-10^(-13)) warns, √(10^(-14)) = 1/10000000
  assert.equal(evaluateInstantMath(doc(s('1'), s('div'), tenPow('16')))?.primary, '= 10000000000000000');
  assert.equal(evaluateInstantMath(doc(root(s('-'), tenPow('13'))))?.kind, 'warning');
  assert.equal(evaluateInstantMath(doc(root(tenPow('14'))))?.primary, '= 1/10000000');

  // Terminating decimal length: 1/8 is exact (= 0,125), 1/128 (7 decimals) uses ≈, negative micro-values never print −0
  assert.equal(evaluateInstantMath(doc(frac([s('1')], [s('8')])))?.secondary, '= 0,125');
  assert.match(evaluateInstantMath(doc(frac([s('1')], [s('1'), s('2'), s('8')])))?.secondary ?? '', /^≈ /);
  const negMicro = evaluateInstantMath(doc(s('-'), frac([s('1')], [s('3'), s('0'), s('0'), s('0'), s('0')])));
  assert.ok(negMicro?.secondary && !negMicro.secondary.endsWith('−0'), `unexpected negative zero: ${negMicro?.secondary}`);

  // Polynomial 0^0 domain exclusion delegates (x - 3)^0 = 1 to AI instead of falsely claiming Orice x ∈ ℝ
  assert.equal(evaluateInstantMath(doc(pow([grp(s('x'), s('-'), s('3'))], [s('0')]), s('='), s('1'))), null);

  // Citardauq stability: x² + 100000000x + 1 = 0 has smaller root -1.000e-8 (not -7.451e-9)
  const stiffQuad = evaluateInstantMath(doc(
    pow([s('x')], [s('2')]),
    s('+'),
    s('1'), s('0'), s('0'), s('0'), s('0'), s('0'), s('0'), s('0'), s('0'),
    s('x'),
    s('+'),
    s('1'),
    s('='),
    s('0'),
  ));
  assert.match(stiffQuad?.primary ?? '', /−1,000e-8/);
});
