import { HttpsError } from 'firebase-functions/v2/https';

export const MAX_MATH_INPUT_LENGTH = 1600;
export const MAX_MATH_INPUT_DEPTH = 12;
// Parser operations include groups and implicit products in addition to the
// editor's 256 tree nodes. Leave room for those while bounding hostile input.
export const MAX_MATH_INPUT_NODES = 1024;

type Token = { kind: 'number' | 'variable' | 'symbol'; value: string };
const RELATIONS = new Set(['=', '<', '>', '\\le', '\\ge']);
const PRODUCT_OPERATORS = new Set(['\\times', '\\div']);
const ATOM_COMMANDS = new Set(['\\pi', '\\frac', '\\sqrt']);
const ALLOWED_COMMANDS = new Set([...RELATIONS, ...PRODUCT_OPERATORS, ...ATOM_COMMANDS]);

/** A deliberately small expression grammar, not a general-purpose TeX interpreter. */
export function parseMathInput(value: unknown, field: 'problemLatex' | 'solutionLatex'): string {
  const label = field === 'problemLatex' ? 'Problema' : 'Rezolvarea';
  const invalid = () => new HttpsError('invalid-argument', `${label} trebuie să conțină o expresie matematică completă, scrisă cu tastatura aplicației.`);
  if (typeof value !== 'string' || value.length > MAX_MATH_INPUT_LENGTH || !value.trim()) throw invalid();
  // Only an ordinary space is whitespace in the editor protocol. In particular,
  // newlines, invisible controls, Unicode lookalikes and text commands are refused.
  const tokens: Token[] = [];
  for (let offset = 0; offset < value.length;) {
    const char = value[offset];
    if (char === ' ') { offset += 1; continue; }
    const remainder = value.slice(offset);
    const number = /^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)/.exec(remainder)?.[0];
    if (number) {
      tokens.push({ kind: 'number', value: number }); offset += number.length; continue;
    }
    if (/[xyz]/.test(char)) {
      tokens.push({ kind: 'variable', value: char }); offset += 1; continue;
    }
    const command = /^\\[a-zA-Z]+/.exec(remainder)?.[0];
    if (command && ALLOWED_COMMANDS.has(command)) {
      tokens.push({ kind: 'symbol', value: command }); offset += command.length; continue;
    }
    if ('()+-^{}=<>'.includes(char)) {
      tokens.push({ kind: 'symbol', value: char }); offset += 1; continue;
    }
    throw invalid();
  }

  let position = 0;
  let nodes = 0;
  const current = () => tokens[position]?.value ?? '';
  const countNode = () => { if (++nodes > MAX_MATH_INPUT_NODES) throw invalid(); };
  const consume = (expected: string) => {
    if (current() !== expected) throw invalid();
    position += 1;
  };
  const startsAtom = () => {
    const token = tokens[position];
    return token?.kind === 'number' || token?.kind === 'variable'
      || token?.value === '(' || token?.value === '{' || ATOM_COMMANDS.has(token?.value ?? '');
  };
  const group = (depth: number, opening = '{', closing = '}') => {
    if (depth >= MAX_MATH_INPUT_DEPTH) throw invalid();
    countNode();
    consume(opening);
    relation(depth + 1);
    consume(closing);
  };
  const atom = (depth: number): 'number' | 'other' => {
    const token = tokens[position];
    if (!token) throw invalid();
    countNode();
    if (token.kind === 'number' || token.kind === 'variable' || token.value === '\\pi') {
      position += 1;
      return token.kind === 'number' ? 'number' : 'other';
    }
    if (token.value === '(' || token.value === '{') {
      group(depth, token.value, token.value === '(' ? ')' : '}');
      return 'other';
    }
    if (token.value === '\\frac' || token.value === '\\sqrt') {
      position += 1;
      group(depth);
      if (token.value === '\\frac') group(depth);
      return 'other';
    }
    throw invalid();
  };
  const factor = (depth: number) => {
    // Iteration bounds even a malicious long sequence of unary signs.
    while (current() === '+' || current() === '-') { countNode(); position += 1; }
    let kind = atom(depth);
    if (current() === '^') {
      countNode(); position += 1; group(depth); kind = 'other';
    }
    return kind;
  };
  const product = (depth: number) => {
    let previous = factor(depth);
    while (PRODUCT_OPERATORS.has(current()) || startsAtom()) {
      if (PRODUCT_OPERATORS.has(current())) { position += 1; }
      else if (previous === 'number' && tokens[position]?.kind === 'number') throw invalid();
      countNode();
      previous = factor(depth);
    }
  };
  const sum = (depth: number) => {
    product(depth);
    while (current() === '+' || current() === '-') {
      countNode(); position += 1; product(depth);
    }
  };
  const relation = (depth: number) => {
    sum(depth);
    while (RELATIONS.has(current())) {
      countNode(); position += 1; sum(depth);
    }
  };
  relation(0);
  if (position !== tokens.length) throw invalid();
  return value.trim();
}
