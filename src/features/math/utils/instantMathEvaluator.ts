import { validateMathDocument, type MathDocument, type MathNode, type MathSymbol } from './mathEditor.ts';

export type InstantMathResult = {
  kind: 'value' | 'equation' | 'inequality' | 'truth' | 'warning';
  /** Short Romanian badge label (e.g. "CALCUL INSTANT", "ECUAȚIE", "VERIFICARE"). */
  badge: string;
  /** Primary formatted Romanian textbook answer (e.g. "= 8", "= 5/4", "x = 4", "x ∈ {−3, 3}"). */
  primary: string;
  /** Optional secondary form (e.g. "= 1,25", "≈ 4,2426", "Δ = 0 · rădăcină dublă"). */
  secondary?: string;
};

type Frac = { n: bigint; d: bigint };
type RelationOp = '=' | '<' | '>' | 'le' | 'ge';

type ExactVal =
  | { kind: 'rat'; q: Frac }
  | { kind: 'rad'; q: Frac; rad: bigint }
  | { kind: 'pi'; q: Frac }
  | { kind: 'float'; v: number };

type Poly = { a: Frac; b: Frac; c: Frac };

class MathDomainError extends Error {
  readonly userMessage: string;
  constructor(userMessage: string) {
    super(userMessage);
    this.userMessage = userMessage;
  }
}

const ZERO: Frac = { n: 0n, d: 1n };
const ONE: Frac = { n: 1n, d: 1n };
const MAX_BIGINT_ABS = 10n ** 18n;
const MAX_RADICAND_FACTOR = 10_000_000n;
const RELATION_OPS = new Set<MathSymbol>(['=', '<', '>', 'le', 'ge']);

function absBig(x: bigint): bigint {
  return x < 0n ? -x : x;
}

function gcdBig(a: bigint, b: bigint): bigint {
  let x = absBig(a);
  let y = absBig(b);
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x === 0n ? 1n : x;
}

function makeFrac(n: bigint, d: bigint = 1n): Frac | null {
  if (d === 0n) throw new MathDomainError('Împărțire la 0 nedefinită');
  if (n === 0n) return ZERO;
  const sign = d < 0n ? -1n : 1n;
  const nn = n * sign;
  const dd = d * sign;
  const g = gcdBig(nn, dd);
  const rn = nn / g;
  const rd = dd / g;
  if (absBig(rn) > MAX_BIGINT_ABS || rd > MAX_BIGINT_ABS) return null;
  return { n: rn, d: rd };
}

function addFrac(a: Frac, b: Frac): Frac | null {
  return makeFrac(a.n * b.d + b.n * a.d, a.d * b.d);
}

function subFrac(a: Frac, b: Frac): Frac | null {
  return makeFrac(a.n * b.d - b.n * a.d, a.d * b.d);
}

function mulFrac(a: Frac, b: Frac): Frac | null {
  return makeFrac(a.n * b.n, a.d * b.d);
}

function divFrac(a: Frac, b: Frac): Frac | null {
  if (b.n === 0n) throw new MathDomainError('Împărțire la 0 nedefinită');
  return makeFrac(a.n * b.d, a.d * b.n);
}

function negFrac(a: Frac): Frac {
  return a.n === 0n ? ZERO : { n: -a.n, d: a.d };
}

function powFracInt(base: Frac, exp: number): Frac | null {
  if (!Number.isInteger(exp) || Math.abs(exp) > 40) return null;
  if (exp === 0) {
    if (base.n === 0n) throw new MathDomainError('0⁰ este nedeterminat');
    return ONE;
  }
  let b = base;
  let e = exp;
  if (e < 0) {
    if (b.n === 0n) throw new MathDomainError('Împărțire la 0 nedefinită');
    b = makeFrac(b.d, b.n)!;
    e = -e;
  }
  let res: Frac = ONE;
  for (let i = 0; i < e; i++) {
    const next = mulFrac(res, b);
    if (!next) return null;
    res = next;
  }
  return res;
}

function fracToNumber(q: Frac): number {
  return Number(q.n) / Number(q.d);
}

function isqrtBig(n: bigint): bigint {
  if (n < 0n) return -1n;
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  if (x <= 0n) x = 1n;
  while (true) {
    const next = (x + n / x) >> 1n;
    if (next === x || next === x + 1n) {
      return next * next <= n ? next : x;
    }
    x = next;
  }
}

function exactSqrtFrac(q: Frac): Frac | null {
  if (q.n < 0n) return null;
  if (q.n === 0n) return ZERO;
  const sn = isqrtBig(q.n);
  if (sn * sn !== q.n) return null;
  const sd = isqrtBig(q.d);
  if (sd * sd !== q.d) return null;
  return makeFrac(sn, sd);
}

/** Decomposes positive integer n into out² · inside with square-free inside. */
function simplifyIntRadical(n: bigint): { out: bigint; inside: bigint } | null {
  if (n <= 0n || n > MAX_RADICAND_FACTOR) return null;
  const root = isqrtBig(n);
  if (root * root === n) return { out: root, inside: 1n };

  let rem = n;
  let out = 1n;
  while (rem % 4n === 0n) {
    out *= 2n;
    rem /= 4n;
  }
  let factor = 3n;
  while (factor * factor <= rem) {
    const sq = factor * factor;
    while (rem % sq === 0n) {
      out *= factor;
      rem /= sq;
    }
    factor += 2n;
  }
  return { out, inside: rem };
}

function terminatingDecimalLength(d: bigint): number | null {
  let rem = d;
  let pow2 = 0;
  let pow5 = 0;
  while (rem % 2n === 0n) {
    rem /= 2n;
    pow2 += 1;
  }
  while (rem % 5n === 0n) {
    rem /= 5n;
    pow5 += 1;
  }
  return rem === 1n ? Math.max(pow2, pow5) : null;
}

function formatExactTerminatingDecimal(q: Frac, decimals: number): string {
  const negative = q.n < 0n;
  const absN = negative ? -q.n : q.n;
  const scale = 10n ** BigInt(decimals);
  const scaled = (absN * scale) / q.d;
  const intPart = scaled / scale;
  const fracPart = (scaled % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  const body = fracPart.length > 0 ? `${intPart.toString()},${fracPart}` : intPart.toString();
  return negative && body !== '0' ? `−${body}` : body;
}

function formatNumberRo(value: number, maxDecimals = 4): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0 || Object.is(value, -0)) return '0';
  const negative = value < 0;
  const abs = Math.abs(value);
  const minFixed = 10 ** (-maxDecimals);

  if (abs >= 1e12 || (abs > 0 && abs < minFixed)) {
    const exp = abs.toExponential(3).replace('.', ',');
    return negative ? `−${exp}` : exp;
  }

  const roundedInt = Math.round(abs);
  if (roundedInt !== 0 && Math.abs(abs - roundedInt) < 1e-10 * roundedInt) {
    return negative ? `−${roundedInt}` : `${roundedInt}`;
  }

  const fixed = abs.toFixed(maxDecimals).replace(/0+$/, '').replace(/\.$/, '');
  const formatted = fixed.replace('.', ',');
  if (formatted === '0') return '0';
  return negative ? `−${formatted}` : formatted;
}

function formatFrac(q: Frac): string {
  if (q.d === 1n) {
    return q.n < 0n ? `−${(-q.n).toString()}` : q.n.toString();
  }
  return q.n < 0n ? `−${(-q.n).toString()}/${q.d.toString()}` : `${q.n.toString()}/${q.d.toString()}`;
}

function formatFracDecimalNote(q: Frac): string | undefined {
  if (q.d === 1n) return undefined;
  const termLen = terminatingDecimalLength(q.d);
  if (termLen !== null && termLen <= 6) {
    return `= ${formatExactTerminatingDecimal(q, termLen)}`;
  }
  const val = fracToNumber(q);
  if (!Number.isFinite(val)) return undefined;
  const str = formatNumberRo(val, 4);
  return str ? `≈ ${str}` : undefined;
}

function formatRadicalPrimary(q: Frac, rad: bigint): string {
  const neg = q.n < 0n;
  const absN = absBig(q.n);
  const sign = neg ? '−' : '';
  const radStr = `√${rad.toString()}`;
  if (q.d === 1n) {
    return absN === 1n ? `${sign}${radStr}` : `${sign}${absN.toString()}${radStr}`;
  }
  const numStr = absN === 1n ? radStr : `${absN.toString()}${radStr}`;
  return `${sign}${numStr}/${q.d.toString()}`;
}

function formatPiPrimary(q: Frac): string {
  const neg = q.n < 0n;
  const absN = absBig(q.n);
  const sign = neg ? '−' : '';
  if (q.d === 1n) {
    return absN === 1n ? `${sign}π` : `${sign}${absN.toString()}π`;
  }
  const numStr = absN === 1n ? 'π' : `${absN.toString()}π`;
  return `${sign}${numStr}/${q.d.toString()}`;
}

function valToNumber(v: ExactVal): number {
  switch (v.kind) {
    case 'rat': return fracToNumber(v.q);
    case 'rad': return fracToNumber(v.q) * Math.sqrt(Number(v.rad));
    case 'pi': return fracToNumber(v.q) * Math.PI;
    case 'float': return v.v;
  }
}

function toFloatVal(v: number): ExactVal | null {
  if (!Number.isFinite(v)) return null;
  return { kind: 'float', v };
}

function addExact(a: ExactVal, b: ExactVal): ExactVal | null {
  if (a.kind === 'rat' && b.kind === 'rat') {
    const sum = addFrac(a.q, b.q);
    return sum ? { kind: 'rat', q: sum } : toFloatVal(valToNumber(a) + valToNumber(b));
  }
  if (a.kind === 'rad' && b.kind === 'rad' && a.rad === b.rad) {
    const sum = addFrac(a.q, b.q);
    if (!sum) return toFloatVal(valToNumber(a) + valToNumber(b));
    return sum.n === 0n ? { kind: 'rat', q: ZERO } : { kind: 'rad', q: sum, rad: a.rad };
  }
  if (a.kind === 'pi' && b.kind === 'pi') {
    const sum = addFrac(a.q, b.q);
    if (!sum) return toFloatVal(valToNumber(a) + valToNumber(b));
    return sum.n === 0n ? { kind: 'rat', q: ZERO } : { kind: 'pi', q: sum };
  }
  if (a.kind === 'rat' && a.q.n === 0n) return b;
  if (b.kind === 'rat' && b.q.n === 0n) return a;
  return toFloatVal(valToNumber(a) + valToNumber(b));
}

function negExact(a: ExactVal): ExactVal {
  switch (a.kind) {
    case 'rat': return { kind: 'rat', q: negFrac(a.q) };
    case 'rad': return { kind: 'rad', q: negFrac(a.q), rad: a.rad };
    case 'pi': return { kind: 'pi', q: negFrac(a.q) };
    case 'float': return { kind: 'float', v: -a.v };
  }
}

function subExact(a: ExactVal, b: ExactVal): ExactVal | null {
  return addExact(a, negExact(b));
}

function mulExact(a: ExactVal, b: ExactVal): ExactVal | null {
  if ((a.kind === 'rat' && a.q.n === 0n) || (b.kind === 'rat' && b.q.n === 0n)) {
    return { kind: 'rat', q: ZERO };
  }
  if (a.kind === 'rat' && b.kind === 'rat') {
    const p = mulFrac(a.q, b.q);
    return p ? { kind: 'rat', q: p } : toFloatVal(valToNumber(a) * valToNumber(b));
  }
  if (a.kind === 'rat' && b.kind === 'rad') {
    const p = mulFrac(a.q, b.q);
    return p ? { kind: 'rad', q: p, rad: b.rad } : toFloatVal(valToNumber(a) * valToNumber(b));
  }
  if (a.kind === 'rad' && b.kind === 'rat') {
    return mulExact(b, a);
  }
  if (a.kind === 'rad' && b.kind === 'rad') {
    const coeff = mulFrac(a.q, b.q);
    const prodRad = a.rad * b.rad;
    const simp = coeff ? simplifyIntRadical(prodRad) : null;
    if (coeff && simp) {
      const nextCoeff = mulFrac(coeff, { n: simp.out, d: 1n });
      if (nextCoeff) {
        return simp.inside === 1n
          ? { kind: 'rat', q: nextCoeff }
          : { kind: 'rad', q: nextCoeff, rad: simp.inside };
      }
    }
    return toFloatVal(valToNumber(a) * valToNumber(b));
  }
  if (a.kind === 'rat' && b.kind === 'pi') {
    const p = mulFrac(a.q, b.q);
    return p ? { kind: 'pi', q: p } : toFloatVal(valToNumber(a) * valToNumber(b));
  }
  if (a.kind === 'pi' && b.kind === 'rat') {
    return mulExact(b, a);
  }
  return toFloatVal(valToNumber(a) * valToNumber(b));
}

function divExact(a: ExactVal, b: ExactVal): ExactVal | null {
  if (b.kind !== 'float') {
    if (b.q.n === 0n) {
      throw new MathDomainError('Împărțire la 0 nedefinită');
    }
  } else if (Math.abs(b.v) < 1e-15) {
    throw new MathDomainError('Împărțire la 0 nedefinită');
  }
  const bNum = valToNumber(b);
  if (a.kind === 'rat' && a.q.n === 0n) return { kind: 'rat', q: ZERO };
  if (a.kind === 'rat' && b.kind === 'rat') {
    const q = divFrac(a.q, b.q);
    return q ? { kind: 'rat', q } : toFloatVal(valToNumber(a) / bNum);
  }
  if (a.kind === 'rad' && b.kind === 'rat') {
    const q = divFrac(a.q, b.q);
    return q ? { kind: 'rad', q, rad: a.rad } : toFloatVal(valToNumber(a) / bNum);
  }
  if (a.kind === 'rat' && b.kind === 'rad') {
    // Rationalize: (a / (b * √r)) = (a / (b * r)) * √r
    const denom = mulFrac(b.q, { n: b.rad, d: 1n });
    const q = denom ? divFrac(a.q, denom) : null;
    return q ? { kind: 'rad', q, rad: b.rad } : toFloatVal(valToNumber(a) / bNum);
  }
  if (a.kind === 'rad' && b.kind === 'rad') {
    // (a√r1)/(b√r2) = (a/(b*r2)) * √(r1*r2)
    const denom = mulFrac(b.q, { n: b.rad, d: 1n });
    const coeff = denom ? divFrac(a.q, denom) : null;
    const simp = coeff ? simplifyIntRadical(a.rad * b.rad) : null;
    if (coeff && simp) {
      const nextCoeff = mulFrac(coeff, { n: simp.out, d: 1n });
      if (nextCoeff) {
        return simp.inside === 1n
          ? { kind: 'rat', q: nextCoeff }
          : { kind: 'rad', q: nextCoeff, rad: simp.inside };
      }
    }
    return toFloatVal(valToNumber(a) / bNum);
  }
  if (a.kind === 'pi' && b.kind === 'rat') {
    const q = divFrac(a.q, b.q);
    return q ? { kind: 'pi', q } : toFloatVal(valToNumber(a) / bNum);
  }
  if (a.kind === 'pi' && b.kind === 'pi') {
    const q = divFrac(a.q, b.q);
    return q ? { kind: 'rat', q } : toFloatVal(valToNumber(a) / bNum);
  }
  return toFloatVal(valToNumber(a) / bNum);
}

function sqrtExact(a: ExactVal): ExactVal | null {
  if (a.kind !== 'float') {
    if (a.q.n < 0n) {
      throw new MathDomainError('Radical din număr negativ nu există în ℝ');
    }
    if (a.q.n === 0n) return { kind: 'rat', q: ZERO };
    if (a.kind === 'rat') {
      const exact = exactSqrtFrac(a.q);
      if (exact) return { kind: 'rat', q: exact };
      // Simplify √(n/d) = √(n*d) / d
      const prod = a.q.n * a.q.d;
      const simp = simplifyIntRadical(prod);
      if (simp) {
        const coeff = makeFrac(simp.out, a.q.d);
        if (coeff) {
          return simp.inside === 1n
            ? { kind: 'rat', q: coeff }
            : { kind: 'rad', q: coeff, rad: simp.inside };
        }
      }
    }
    return toFloatVal(Math.sqrt(valToNumber(a)));
  }
  if (a.v < -1e-12) {
    throw new MathDomainError('Radical din număr negativ nu există în ℝ');
  }
  if (Math.abs(a.v) < 1e-12) return { kind: 'rat', q: ZERO };
  return toFloatVal(Math.sqrt(a.v));
}

function powExact(base: ExactVal, exp: ExactVal): ExactVal | null {
  if (exp.kind === 'rat' && exp.q.d === 1n) {
    const e = Number(exp.q.n);
    if (Number.isInteger(e) && Math.abs(e) <= 40) {
      if (base.kind === 'rat') {
        const res = powFracInt(base.q, e);
        if (res) return { kind: 'rat', q: res };
      } else if (base.kind === 'rad' && e >= 0 && e <= 10) {
        let acc: ExactVal = { kind: 'rat', q: ONE };
        for (let i = 0; i < e; i++) {
          const next = mulExact(acc, base);
          if (!next) return toFloatVal(Math.pow(valToNumber(base), e));
          acc = next;
        }
        return acc;
      }
    }
  }
  if (exp.kind === 'rat' && exp.q.n === 1n && exp.q.d === 2n) {
    return sqrtExact(base);
  }
  const bNum = valToNumber(base);
  const eNum = valToNumber(exp);
  if (bNum === 0 && eNum === 0) throw new MathDomainError('0⁰ este nedeterminat');
  if (bNum === 0 && eNum < 0) throw new MathDomainError('Împărțire la 0 nedefinită');
  if (bNum < 0 && !Number.isInteger(eNum)) throw new MathDomainError('Putere neîntreagă din număr negativ');
  if (Math.abs(eNum) > 300) return null;
  return toFloatVal(Math.pow(bNum, eNum));
}

// ── Tokenizer over MathNode[] ─────────────────────────────────────────────────
type Token =
  | { type: 'number'; q: Frac; raw: string }
  | { type: 'var'; name: 'x' | 'y' | 'z' }
  | { type: 'pi' }
  | { type: 'op'; value: '+' | '-' | 'times' | 'div' }
  | { type: 'fraction'; numerator: MathNode[]; denominator: MathNode[] }
  | { type: 'power'; base: MathNode[]; exponent: MathNode[] }
  | { type: 'root'; radicand: MathNode[] }
  | { type: 'group'; content: MathNode[] };

function parseDecimalToFrac(raw: string): Frac | null {
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)) return null;
  const parts = raw.split('.');
  const intPart = parts[0] || '0';
  const fracPart = parts[1] || '';
  if (intPart.length + fracPart.length > 16) return null;
  const denom = 10n ** BigInt(fracPart.length);
  const num = BigInt(intPart + fracPart);
  return makeFrac(num, denom);
}

function tokenizeNodes(nodes: MathNode[]): Token[] | null {
  const tokens: Token[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === 'symbol') {
      if (RELATION_OPS.has(node.value)) return null;
      if (/^[\d.]$/.test(node.value)) {
        let raw: string = node.value;
        while (i + 1 < nodes.length) {
          const next = nodes[i + 1];
          if (next.type !== 'symbol' || !/^[\d.]$/.test(next.value)) break;
          raw += next.value;
          i++;
        }
        const q = parseDecimalToFrac(raw);
        if (!q) return null;
        tokens.push({ type: 'number', q, raw });
      } else if (node.value === 'x' || node.value === 'y' || node.value === 'z') {
        tokens.push({ type: 'var', name: node.value });
      } else if (node.value === 'pi') {
        tokens.push({ type: 'pi' });
      } else if (node.value === '+' || node.value === '-' || node.value === 'times' || node.value === 'div') {
        tokens.push({ type: 'op', value: node.value });
      } else {
        return null;
      }
    } else if (node.type === 'fraction') {
      tokens.push({ type: 'fraction', numerator: node.numerator, denominator: node.denominator });
    } else if (node.type === 'power') {
      tokens.push({ type: 'power', base: node.base, exponent: node.exponent });
    } else if (node.type === 'root') {
      tokens.push({ type: 'root', radicand: node.radicand });
    } else if (node.type === 'group') {
      tokens.push({ type: 'group', content: node.content });
    }
  }
  return tokens;
}

function canImplicitMultiply(prev: Token, next: Token): boolean {
  if (prev.type === 'op' || next.type === 'op') return false;
  // Avoid silently interpreting `2 1/2` as `2 * 1/2` in case a student intended a mixed fraction.
  if (prev.type === 'number' && next.type === 'fraction') return false;
  if (prev.type === 'number' && next.type === 'number') return false;
  return true;
}

// ── Constant arithmetic evaluator ─────────────────────────────────────────────
function evalConstantNodes(nodes: MathNode[]): ExactVal | null {
  const tokens = tokenizeNodes(nodes);
  if (!tokens || tokens.length === 0) return null;
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];

  const parsePrimary = (): ExactVal | null => {
    const tok = peek();
    if (!tok) return null;
    if (tok.type === 'number') {
      pos++;
      return { kind: 'rat', q: tok.q };
    }
    if (tok.type === 'pi') {
      pos++;
      return { kind: 'pi', q: ONE };
    }
    if (tok.type === 'var') return null;
    if (tok.type === 'group') {
      pos++;
      return evalConstantNodes(tok.content);
    }
    if (tok.type === 'fraction') {
      pos++;
      const num = evalConstantNodes(tok.numerator);
      const den = evalConstantNodes(tok.denominator);
      if (!num || !den) return null;
      return divExact(num, den);
    }
    if (tok.type === 'root') {
      pos++;
      const inside = evalConstantNodes(tok.radicand);
      if (!inside) return null;
      return sqrtExact(inside);
    }
    if (tok.type === 'power') {
      pos++;
      const base = evalConstantNodes(tok.base);
      const exp = evalConstantNodes(tok.exponent);
      if (!base || !exp) return null;
      return powExact(base, exp);
    }
    return null;
  };

  const parseUnary = (): ExactVal | null => {
    const tok = peek();
    if (tok?.type === 'op' && tok.value === '+') {
      pos++;
      return parseUnary();
    }
    if (tok?.type === 'op' && tok.value === '-') {
      pos++;
      const inner = parseUnary();
      return inner ? negExact(inner) : null;
    }
    return parsePrimary();
  };

  const parseTerm = (): ExactVal | null => {
    let left = parseUnary();
    if (!left) return null;
    while (pos < tokens.length) {
      const next = peek();
      if (!next) break;
      if (next.type === 'op' && (next.value === 'times' || next.value === 'div')) {
        pos++;
        const right = parseUnary();
        if (!right) return null;
        left = next.value === 'times' ? mulExact(left, right) : divExact(left, right);
        if (!left) return null;
      } else if (pos > 0 && canImplicitMultiply(tokens[pos - 1], next)) {
        const right = parsePrimary();
        if (!right) return null;
        left = mulExact(left, right);
        if (!left) return null;
      } else {
        break;
      }
    }
    return left;
  };

  const parseExpr = (): ExactVal | null => {
    let left = parseTerm();
    if (!left) return null;
    while (pos < tokens.length) {
      const next = peek();
      if (next?.type === 'op' && (next.value === '+' || next.value === '-')) {
        pos++;
        const right = parseTerm();
        if (!right) return null;
        left = next.value === '+' ? addExact(left, right) : subExact(left, right);
        if (!left) return null;
      } else {
        break;
      }
    }
    return left;
  };

  const result = parseExpr();
  return pos === tokens.length ? result : null;
}

// ── Single-variable polynomial evaluator (degree ≤ 2 over exact Q) ────────────
function polyConst(c: Frac): Poly {
  return { a: ZERO, b: ZERO, c };
}

function polyVar(): Poly {
  return { a: ZERO, b: ONE, c: ZERO };
}

function addPoly(p: Poly, q: Poly): Poly | null {
  const a = addFrac(p.a, q.a);
  const b = addFrac(p.b, q.b);
  const c = addFrac(p.c, q.c);
  return a && b && c ? { a, b, c } : null;
}

function subPoly(p: Poly, q: Poly): Poly | null {
  const a = subFrac(p.a, q.a);
  const b = subFrac(p.b, q.b);
  const c = subFrac(p.c, q.c);
  return a && b && c ? { a, b, c } : null;
}

function negPoly(p: Poly): Poly {
  return { a: negFrac(p.a), b: negFrac(p.b), c: negFrac(p.c) };
}

function polyDegree(p: Poly): number {
  if (p.a.n !== 0n) return 2;
  if (p.b.n !== 0n) return 1;
  return 0;
}

function mulPoly(p: Poly, q: Poly): Poly | null {
  if (polyDegree(p) + polyDegree(q) > 2) return null;
  // (p.a x^2 + p.b x + p.c)(q.a x^2 + q.b x + q.c)
  const a1 = mulFrac(p.a, q.c);
  const a2 = mulFrac(p.b, q.b);
  const a3 = mulFrac(p.c, q.a);
  const b1 = mulFrac(p.b, q.c);
  const b2 = mulFrac(p.c, q.b);
  const c = mulFrac(p.c, q.c);
  if (!a1 || !a2 || !a3 || !b1 || !b2 || !c) return null;
  const a12 = addFrac(a1, a2);
  const a = a12 ? addFrac(a12, a3) : null;
  const b = addFrac(b1, b2);
  return a && b ? { a, b, c } : null;
}

function divPoly(p: Poly, q: Poly): Poly | null {
  if (polyDegree(q) > 0) return null;
  if (q.c.n === 0n) throw new MathDomainError('Împărțire la 0 nedefinită');
  const a = divFrac(p.a, q.c);
  const b = divFrac(p.b, q.c);
  const c = divFrac(p.c, q.c);
  return a && b && c ? { a, b, c } : null;
}

function evalPolyNodes(nodes: MathNode[], variable: 'x' | 'y' | 'z'): Poly | null {
  const tokens = tokenizeNodes(nodes);
  if (!tokens || tokens.length === 0) return null;
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];

  const parsePrimary = (): Poly | null => {
    const tok = peek();
    if (!tok) return null;
    if (tok.type === 'number') {
      pos++;
      return polyConst(tok.q);
    }
    if (tok.type === 'var') {
      if (tok.name !== variable) return null;
      pos++;
      return polyVar();
    }
    if (tok.type === 'pi') return null;
    if (tok.type === 'group') {
      pos++;
      return evalPolyNodes(tok.content, variable);
    }
    if (tok.type === 'fraction') {
      pos++;
      const num = evalPolyNodes(tok.numerator, variable);
      const den = evalPolyNodes(tok.denominator, variable);
      if (!num || !den) return null;
      return divPoly(num, den);
    }
    if (tok.type === 'root') {
      pos++;
      const inner = evalPolyNodes(tok.radicand, variable);
      if (!inner || polyDegree(inner) > 0) return null;
      const root = exactSqrtFrac(inner.c);
      return root ? polyConst(root) : null;
    }
    if (tok.type === 'power') {
      pos++;
      const base = evalPolyNodes(tok.base, variable);
      const exp = evalPolyNodes(tok.exponent, variable);
      if (!base || !exp || polyDegree(exp) > 0 || exp.c.d !== 1n) return null;
      const e = Number(exp.c.n);
      if (!Number.isInteger(e)) return null;
      if (polyDegree(base) === 0) {
        const val = powFracInt(base.c, e);
        return val ? polyConst(val) : null;
      }
      // Delegate (expr)^0 to AI so domain exclusions (base ≠ 0) are never lost.
      if (e === 0) return null;
      if (e === 1) return base;
      if (e === 2) return mulPoly(base, base);
      return null;
    }
    return null;
  };

  const parseUnary = (): Poly | null => {
    const tok = peek();
    if (tok?.type === 'op' && tok.value === '+') {
      pos++;
      return parseUnary();
    }
    if (tok?.type === 'op' && tok.value === '-') {
      pos++;
      const inner = parseUnary();
      return inner ? negPoly(inner) : null;
    }
    return parsePrimary();
  };

  const parseTerm = (): Poly | null => {
    let left = parseUnary();
    if (!left) return null;
    while (pos < tokens.length) {
      const next = peek();
      if (!next) break;
      if (next.type === 'op' && (next.value === 'times' || next.value === 'div')) {
        pos++;
        const right = parseUnary();
        if (!right) return null;
        left = next.value === 'times' ? mulPoly(left, right) : divPoly(left, right);
        if (!left) return null;
      } else if (pos > 0 && canImplicitMultiply(tokens[pos - 1], next)) {
        const right = parsePrimary();
        if (!right) return null;
        left = mulPoly(left, right);
        if (!left) return null;
      } else {
        break;
      }
    }
    return left;
  };

  const parseExpr = (): Poly | null => {
    let left = parseTerm();
    if (!left) return null;
    while (pos < tokens.length) {
      const next = peek();
      if (next?.type === 'op' && (next.value === '+' || next.value === '-')) {
        pos++;
        const right = parseTerm();
        if (!right) return null;
        left = next.value === '+' ? addPoly(left, right) : subPoly(left, right);
        if (!left) return null;
      } else {
        break;
      }
    }
    return left;
  };

  const result = parseExpr();
  return pos === tokens.length ? result : null;
}

// ── Inspection helpers ────────────────────────────────────────────────────────
function collectVariables(nodes: MathNode[], out: Set<'x' | 'y' | 'z'>): void {
  for (const node of nodes) {
    if (node.type === 'symbol') {
      if (node.value === 'x' || node.value === 'y' || node.value === 'z') {
        out.add(node.value);
      }
    } else if (node.type === 'fraction') {
      collectVariables(node.numerator, out);
      collectVariables(node.denominator, out);
    } else if (node.type === 'power') {
      collectVariables(node.base, out);
      collectVariables(node.exponent, out);
    } else if (node.type === 'root') {
      collectVariables(node.radicand, out);
    } else if (node.type === 'group') {
      collectVariables(node.content, out);
    }
  }
}

function hasAnyOperationOrTemplate(nodes: MathNode[]): boolean {
  let seenNonLeadingSign = false;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type !== 'symbol') return true;
    if (node.value === 'pi') return true;
    if (node.value === 'times' || node.value === 'div' || RELATION_OPS.has(node.value)) return true;
    if (node.value === '+' || node.value === '-') {
      if (seenNonLeadingSign) return true;
    } else {
      seenNonLeadingSign = true;
    }
  }
  return false;
}

function splitTopLevelRelation(
  nodes: MathNode[],
): { op: RelationOp; left: MathNode[]; right: MathNode[] } | null {
  let opIndex = -1;
  let op: RelationOp | null = null;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === 'symbol' && RELATION_OPS.has(node.value)) {
      if (opIndex !== -1) return null; // Multiple relations (e.g., 1 < x < 5)
      opIndex = i;
      op = node.value as RelationOp;
    }
  }
  if (opIndex === -1 || !op) return null;
  const left = nodes.slice(0, opIndex);
  const right = nodes.slice(opIndex + 1);
  if (left.length === 0 || right.length === 0) return null;
  return { op, left, right };
}

function formatRelationSymbol(op: RelationOp): string {
  switch (op) {
    case '=': return '=';
    case '<': return '<';
    case '>': return '>';
    case 'le': return '≤';
    case 'ge': return '≥';
  }
}

function flipRelation(op: Exclude<RelationOp, '='>): Exclude<RelationOp, '='> {
  switch (op) {
    case '<': return '>';
    case '>': return '<';
    case 'le': return 'ge';
    case 'ge': return 'le';
  }
}

function compareFracs(a: Frac, b: Frac): -1 | 0 | 1 {
  const left = a.n * b.d;
  const right = b.n * a.d;
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareExactOrder(a: ExactVal, b: ExactVal): -1 | 0 | 1 {
  if (a.kind === 'rat' && b.kind === 'rat') return compareFracs(a.q, b.q);
  if (a.kind === 'rad' && b.kind === 'rad' && a.rad === b.rad) return compareFracs(a.q, b.q);
  if (a.kind === 'pi' && b.kind === 'pi') return compareFracs(a.q, b.q);
  if (a.kind !== 'float' && b.kind === 'rat' && b.q.n === 0n) {
    return a.q.n < 0n ? -1 : a.q.n > 0n ? 1 : 0;
  }
  if (b.kind !== 'float' && a.kind === 'rat' && a.q.n === 0n) {
    return b.q.n > 0n ? -1 : b.q.n < 0n ? 1 : 0;
  }
  const aNum = valToNumber(a);
  const bNum = valToNumber(b);
  const eps = 1e-10 * Math.max(1, Math.abs(aNum), Math.abs(bNum));
  if (Math.abs(aNum - bNum) <= eps) return 0;
  return aNum < bNum ? -1 : 1;
}

function orderMatchesRelation(order: -1 | 0 | 1, op: RelationOp): boolean {
  switch (op) {
    case '=': return order === 0;
    case '<': return order < 0;
    case '>': return order > 0;
    case 'le': return order <= 0;
    case 'ge': return order >= 0;
  }
}

function formatExactValueResult(val: ExactVal): InstantMathResult | null {
  if (val.kind === 'rat') {
    const primary = `= ${formatFrac(val.q)}`;
    const secondary = formatFracDecimalNote(val.q);
    return { kind: 'value', badge: 'CALCUL INSTANT', primary, secondary };
  }
  if (val.kind === 'rad') {
    const approx = formatNumberRo(valToNumber(val), 4);
    return {
      kind: 'value',
      badge: 'CALCUL INSTANT',
      primary: `= ${formatRadicalPrimary(val.q, val.rad)}`,
      secondary: approx ? `≈ ${approx}` : undefined,
    };
  }
  if (val.kind === 'pi') {
    const approx = formatNumberRo(valToNumber(val), 4);
    return {
      kind: 'value',
      badge: 'CALCUL INSTANT',
      primary: `= ${formatPiPrimary(val.q)}`,
      secondary: approx ? `≈ ${approx}` : undefined,
    };
  }
  const formatted = formatNumberRo(val.v, 4);
  if (!formatted) return null;
  return {
    kind: 'value',
    badge: 'CALCUL INSTANT',
    primary: `≈ ${formatted}`,
  };
}

function formatShortExactVal(val: ExactVal): string {
  if (val.kind === 'rat') return formatFrac(val.q);
  if (val.kind === 'rad') return formatRadicalPrimary(val.q, val.rad);
  if (val.kind === 'pi') return formatPiPrimary(val.q);
  return formatNumberRo(val.v, 4);
}

/**
 * Evaluates a structured `MathDocument` completely offline in <0.2ms:
 * - Exact rational arithmetic, fractions, powers, simplified radicals, π multiples
 * - Linear and quadratic equations in one variable (`x`, `y`, `z`)
 * - Linear and numeric inequalities & numeric equalities
 *
 * Returns `null` silently whenever the expression is incomplete, trivial (a bare
 * number with no operation), or beyond local algebraic scope so the user can
 * seamlessly send it to Profu’ AI without visual noise.
 */
export function evaluateInstantMath(document: MathDocument): InstantMathResult | null {
  if (!document || document.nodes.length === 0) return null;
  if (validateMathDocument(document) !== null) return null;

  try {
    const relation = splitTopLevelRelation(document.nodes);
    const vars = new Set<'x' | 'y' | 'z'>();
    collectVariables(document.nodes, vars);

    // 1. Relation: equation, inequality, or constant truth check
    if (relation) {
      if (vars.size === 0) {
        const left = evalConstantNodes(relation.left);
        const right = evalConstantNodes(relation.right);
        if (!left || !right) return null;
        const order = compareExactOrder(left, right);
        const holds = orderMatchesRelation(order, relation.op);
        const actualRel = order === 0 ? '=' : order < 0 ? '<' : '>';
        const sym = holds ? formatRelationSymbol(relation.op) : (relation.op === '=' ? '≠' : actualRel);
        const lStr = formatShortExactVal(left);
        const rStr = formatShortExactVal(right);
        return {
          kind: 'truth',
          badge: 'VERIFICARE INSTANT',
          primary: holds ? 'Adevărat' : 'Fals',
          secondary: `${lStr} ${sym} ${rStr}`,
        };
      }

      if (vars.size !== 1) return null;
      const variable = Array.from(vars)[0];
      const leftP = evalPolyNodes(relation.left, variable);
      const rightP = evalPolyNodes(relation.right, variable);
      if (!leftP || !rightP) return null;

      // Move everything to left: A·v² + B·v + C (op) 0
      const diff = subPoly(leftP, rightP);
      if (!diff) return null;

      if (relation.op === '=') {
        // Degree 0
        if (diff.a.n === 0n && diff.b.n === 0n) {
          return {
            kind: 'equation',
            badge: 'ECUAȚIE',
            primary: diff.c.n === 0n ? `Orice ${variable} ∈ ℝ` : 'Nu are soluții',
            secondary: diff.c.n === 0n ? 'Identitate adevărată' : 'Ecuație imposibilă',
          };
        }
        // Linear: B·v + C = 0 => v = -C/B
        if (diff.a.n === 0n) {
          const sol = divFrac(negFrac(diff.c), diff.b);
          if (!sol) return null;
          return {
            kind: 'equation',
            badge: 'SOLUȚIE INSTANT',
            primary: `${variable} = ${formatFrac(sol)}`,
            secondary: formatFracDecimalNote(sol),
          };
        }
        // Quadratic: A·v² + B·v + C = 0
        const b2 = mulFrac(diff.b, diff.b);
        const a4 = mulFrac({ n: 4n, d: 1n }, diff.a);
        const ac4 = a4 ? mulFrac(a4, diff.c) : null;
        const delta = b2 && ac4 ? subFrac(b2, ac4) : null;
        if (!delta) return null;

        if (delta.n < 0n) {
          return {
            kind: 'equation',
            badge: 'ECUAȚIE GR. II',
            primary: 'Nu are soluții reale',
            secondary: `Δ = ${formatFrac(delta)} < 0`,
          };
        }
        const twoA = mulFrac({ n: 2n, d: 1n }, diff.a);
        if (!twoA) return null;

        if (delta.n === 0n) {
          const root = divFrac(negFrac(diff.b), twoA);
          if (!root) return null;
          const dec = formatFracDecimalNote(root);
          return {
            kind: 'equation',
            badge: 'SOLUȚIE INSTANT',
            primary: `${variable} = ${formatFrac(root)}`,
            secondary: dec ? `${dec} · Δ = 0` : 'Δ = 0 · rădăcină dublă',
          };
        }

        const sqrtDelta = exactSqrtFrac(delta);
        if (sqrtDelta) {
          const num1 = subFrac(negFrac(diff.b), sqrtDelta);
          const num2 = addFrac(negFrac(diff.b), sqrtDelta);
          const r1 = num1 ? divFrac(num1, twoA) : null;
          const r2 = num2 ? divFrac(num2, twoA) : null;
          if (!r1 || !r2) return null;
          const sorted = compareFracs(r1, r2) <= 0 ? [r1, r2] : [r2, r1];
          return {
            kind: 'equation',
            badge: 'SOLUȚII INSTANT',
            primary: `${variable} ∈ {${formatFrac(sorted[0])}, ${formatFrac(sorted[1])}}`,
            secondary: `Δ = ${formatFrac(delta)}`,
          };
        }

        // Irrational real roots -> Citardauq's formula avoids catastrophic cancellation
        // when b² >> 4ac (e.g. x² + 10⁸x + 1 = 0).
        const aNum = fracToNumber(diff.a);
        const bNum = fracToNumber(diff.b);
        const cNum = fracToNumber(diff.c);
        const dSqrt = Math.sqrt(fracToNumber(delta));
        const q = -0.5 * (bNum + (bNum >= 0 ? dSqrt : -dSqrt));
        const x1 = q !== 0 ? q / aNum : (-bNum - dSqrt) / (2 * aNum);
        const x2 = q !== 0 ? cNum / q : (-bNum + dSqrt) / (2 * aNum);
        const [lo, hi] = x1 <= x2 ? [x1, x2] : [x2, x1];
        return {
          kind: 'equation',
          badge: 'SOLUȚII INSTANT',
          primary: `${variable}₁ ≈ ${formatNumberRo(lo, 3)}, ${variable}₂ ≈ ${formatNumberRo(hi, 3)}`,
          secondary: `Δ = ${formatFrac(delta)}`,
        };
      }

      // Linear inequality: B·v + C (op) 0
      if (diff.a.n !== 0n) return null;
      if (diff.b.n === 0n) {
        const order: -1 | 0 | 1 = diff.c.n < 0n ? -1 : diff.c.n > 0n ? 1 : 0;
        const holds = orderMatchesRelation(order, relation.op);
        return {
          kind: 'inequality',
          badge: 'INECUAȚIE',
          primary: holds ? `Orice ${variable} ∈ ℝ` : 'Nu are soluții',
        };
      }
      const bound = divFrac(negFrac(diff.c), diff.b);
      if (!bound) return null;
      const finalOp = diff.b.n < 0n ? flipRelation(relation.op) : relation.op;
      return {
        kind: 'inequality',
        badge: 'SOLUȚIE INSTANT',
        primary: `${variable} ${formatRelationSymbol(finalOp)} ${formatFrac(bound)}`,
        secondary: formatFracDecimalNote(bound),
      };
    }

    // 2. Pure arithmetic expression (no variables, no relations)
    if (vars.size > 0) return null;
    if (!hasAnyOperationOrTemplate(document.nodes)) return null;

    const evaluated = evalConstantNodes(document.nodes);
    if (!evaluated) return null;
    return formatExactValueResult(evaluated);
  } catch (error) {
    if (error instanceof MathDomainError) {
      return {
        kind: 'warning',
        badge: 'ATENȚIE',
        primary: error.userMessage,
      };
    }
    return null;
  }
}
