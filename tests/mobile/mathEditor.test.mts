import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyMathEditorCommand as edit, createMathEditorState, createEmptyMathDocument,
  findFirstEmptySlotCursor, formatMathPreview, getCursorBreadcrumb, getMathDocumentVisualDepth, getNextSlotActionLabel,
  isMathDocument, serializeMathDocument as latex, validateMathDocument as validate,
  synchronizeMathEditorDocument, type MathDocument, type MathEditorState, type MathSymbol,
} from '../../src/features/math/utils/mathEditor.ts';
import { serviceLoader } from '../helpers/loadService.mts';

const symbol = (value: MathSymbol) => ({ type: 'symbol' as const, value });
const doc = (...values: MathSymbol[]): MathDocument => ({ version: 1, nodes: values.map(symbol) });
const type = (state: MathEditorState, ...values: MathSymbol[]) => values.reduce((s, value) => edit(s, { type: 'symbol', value }), state);
const load = serviceLoader({ 'firebase-functions/v2/https': { HttpsError: class extends Error {} } });
const { parseMathInput } = load('functions/src/analysis/mathInput.ts');

test('fraction wraps a complete previous number and places cursor in denominator', () => {
  let state = type(createMathEditorState(), '1', '2');
  state = edit(state, { type: 'template', value: 'fraction' });
  assert.equal(state.cursor.path[0].slot, 'denominator');
  assert.match(validate(state.document)!, /numitorul/);
  state = type(state, '3');
  assert.equal(latex(state.document), '\\frac{12}{3}');
  assert.equal(validate(state.document), null);
  state = edit(state, { type: 'next-slot' });
  state = type(state, '+', 'x', '=', '5');
  assert.equal(latex(state.document), '\\frac{12}{3}+x=5');
});

test('root, power and parentheses remain structured and serializable through nested editing', () => {
  let state = edit(createMathEditorState(), { type: 'template', value: 'root' });
  state = type(state, 'x');
  state = edit(state, { type: 'template', value: 'power' });
  state = type(state, '2');
  state = edit(state, { type: 'next-slot' });
  state = type(state, '+', '1');
  state = edit(state, { type: 'next-slot' });
  assert.equal(latex(state.document), '\\sqrt{{x}^{2}+1}');
  assert.equal(validate(state.document), null);
  assert.equal(parseMathInput(latex(state.document), 'problemLatex'), latex(state.document));
});

test('powers preserve visible grouping and server meaning for compound and nested bases', () => {
  let state = edit(createMathEditorState(), { type: 'template', value: 'power' });
  state = type(state, 'x', '+', '1');
  state = type(edit(state, { type: 'next-slot' }), '2');
  assert.equal(latex(state.document), '(x+1)^{2}');
  assert.equal(parseMathInput(latex(state.document), 'problemLatex'), '(x+1)^{2}');
  state = edit(edit(state, { type: 'next-slot' }), { type: 'template', value: 'power' });
  state = type(state, '3');
  assert.equal(latex(state.document), '((x+1)^{2})^{3}');
  assert.equal(validate(state.document), null);
  assert.equal(parseMathInput(latex(state.document), 'problemLatex'), latex(state.document));
  // The largest supported nesting must still fit the server grammar.
  for (let i = 2; i < 8; i++) {
    state = type(edit(edit(state, { type: 'next-slot' }), { type: 'template', value: 'power' }), '2');
  }
  assert.equal(validate(state.document), null);
  assert.equal(parseMathInput(latex(state.document), 'problemLatex'), latex(state.document));
});

test('cursor can edit numerator and traverse to denominator without discarding content', () => {
  let state = createMathEditorState({ version: 1, nodes: [{ type: 'fraction', numerator: [symbol('1')], denominator: [symbol('2')] }] });
  state = edit(state, { type: 'select', cursor: { path: [{ index: 0, slot: 'numerator' }], offset: 1 } });
  state = type(state, '0');
  state = edit(state, { type: 'next-slot' });
  assert.equal(state.cursor.path[0].slot, 'denominator');
  state = edit(state, { type: 'backspace' });
  assert.match(validate(state.document)!, /numitorul/);
  state = type(state, '5');
  assert.equal(latex(state.document), '\\frac{10}{5}');
});

test('backspace at a filled structure first enters it; empty structures can be removed', () => {
  let state = createMathEditorState({ version: 1, nodes: [{ type: 'root', radicand: [symbol('9')] }] });
  state = edit(state, { type: 'backspace' });
  assert.equal(state.cursor.path[0].slot, 'radicand');
  assert.equal(latex(state.document), '\\sqrt{9}');
  state = edit(edit(state, { type: 'backspace' }), { type: 'backspace' });
  assert.equal(latex(state.document), '');
});

test('undo and redo restore formula and selection; new edits discard the redo branch', () => {
  let state = type(createMathEditorState(), 'x', '+', '1');
  state = edit(state, { type: 'clear' });
  assert.equal(latex(state.document), '');
  state = edit(state, { type: 'undo' });
  assert.equal(latex(state.document), 'x+1');
  state = edit(state, { type: 'redo' });
  assert.equal(latex(state.document), '');
  state = type(edit(state, { type: 'undo' }), '2');
  assert.equal(state.redo.length, 0);
  assert.equal(latex(state.document), 'x+12');
});

test('controlled document echoes preserve undo; a different external document resets it', () => {
  const state = type(createMathEditorState(), '2');
  assert.equal(synchronizeMathEditorDocument(state, JSON.parse(JSON.stringify(state.document))), state);
  const reset = synchronizeMathEditorDocument(state, doc('x'));
  assert.equal(reset.undo.length, 0);
  assert.equal(latex(reset.document), 'x');
});

test('incomplete operands, decimals and nested slots are rejected before submission', () => {
  for (const candidate of [doc(), doc('1', '+'), doc('times', '2'), doc('1', '.'), doc('1', '.', '2', '.', '3'), { version: 1, nodes: [{ type: 'power', base: [symbol('2')], exponent: [] }] } as MathDocument]) {
    assert.notEqual(validate(candidate), null);
  }
  for (const candidate of [doc('.', '5'), doc('-', '2'), doc('x', 'le', '3'), doc('2', 'times', '-', '3')]) {
    assert.equal(validate(candidate), null);
    assert.equal(parseMathInput(latex(candidate), 'problemLatex'), latex(candidate));
  }
});

test('macro boundaries survive adjacent variables and implicit products', () => {
  const candidate = doc('pi', 'x', 'times', 'y', 'le', 'z');
  assert.equal(latex(candidate), '\\pi x\\times y\\le z');
  assert.equal(parseMathInput(latex(candidate), 'problemLatex'), latex(candidate));
});

test('malformed and cyclic persisted trees never enter the renderer', () => {
  const cyclic: any = { version: 1, nodes: [] };
  cyclic.nodes.push({ type: 'root', radicand: cyclic.nodes });
  for (const candidate of [cyclic, { version: 1, nodes: [{ type: 'symbol', value: '\\input' }] }, { version: 1, nodes: [], secret: 'extra' }, null]) {
    assert.equal(isMathDocument(candidate), false);
  }
});

test('editor and server agree at the 256-node and eight-level limits', () => {
  const max: MathDocument = { version: 1, nodes: Array.from({ length: 256 }, () => symbol('x')) };
  assert.equal(validate(max), null);
  assert.equal(parseMathInput(latex(max), 'problemLatex'), latex(max));
  const unchanged = edit(createMathEditorState(max), { type: 'symbol', value: 'x' });
  assert.equal(unchanged.document, max);
  assert.match(unchanged.message!, /limita/);
  let nested: MathDocument = doc('x');
  for (let i = 0; i < 8; i++) nested = { version: 1, nodes: [{ type: 'root', radicand: nested.nodes }] };
  assert.equal(validate(nested), null);
  assert.equal(parseMathInput(latex(nested), 'problemLatex'), latex(nested));
  assert.equal(isMathDocument({ version: 1, nodes: [{ type: 'root', radicand: nested.nodes }] }), false);
});

test('arrows remain bounded at the start and end of the expression', () => {
  let state = createMathEditorState(createEmptyMathDocument());
  state = edit(edit(state, { type: 'left' }), { type: 'right' });
  assert.deepEqual(state.cursor, { path: [], offset: 0 });
  state = type(state, '2');
  state = edit(state, { type: 'right' });
  assert.equal(state.cursor.offset, 1);
});

test('replace command loads starter examples with undo support and server-valid LaTeX', () => {
  const example: MathDocument = {
    version: 1,
    nodes: [
      { type: 'fraction', numerator: [symbol('3')], denominator: [symbol('4')] },
      symbol('+'),
      { type: 'fraction', numerator: [symbol('1')], denominator: [symbol('2')] },
    ],
  };
  let state = type(createMathEditorState(), '9');
  state = edit(state, { type: 'replace', document: example });
  assert.equal(latex(state.document), '\\frac{3}{4}+\\frac{1}{2}');
  assert.equal(validate(state.document), null);
  assert.equal(parseMathInput(latex(state.document), 'problemLatex'), latex(state.document));
  state = edit(state, { type: 'undo' });
  assert.equal(latex(state.document), '9');
});

test('finds first empty nested slot, reports contextual next-slot labels, and measures visual depth', () => {
  let state = type(createMathEditorState(), '2');
  state = edit(state, { type: 'template', value: 'fraction' });
  assert.deepEqual(findFirstEmptySlotCursor(state.document), { path: [{ index: 0, slot: 'denominator' }], offset: 0 });
  assert.equal(getNextSlotActionLabel(state.document, { path: [{ index: 0, slot: 'numerator' }], offset: 1 }), 'Numitor →');
  assert.equal(getNextSlotActionLabel(state.document, state.cursor), 'Ieși din fracție ↗');
  assert.equal(getNextSlotActionLabel(state.document, { path: [], offset: 1 }), null);
  assert.equal(getCursorBreadcrumb(state.document, { path: [], offset: 1 }), 'FORMULA TA');
  assert.equal(getCursorBreadcrumb(state.document, state.cursor), 'NUMITOR');
  assert.deepEqual(getMathDocumentVisualDepth(state.document), { maxDepth: 1, hasFraction: true, fractionDepth: 1 });
  state = edit(state, { type: 'template', value: 'fraction' });
  assert.equal(getCursorBreadcrumb(state.document, state.cursor), 'FRACȚIE › NUMĂRĂTOR');
  assert.deepEqual(getMathDocumentVisualDepth(state.document), { maxDepth: 2, hasFraction: true, fractionDepth: 2 });
});

test('square template wraps previous operand and exits cleanly, and formatMathPreview renders readable single-line math', () => {
  let state = type(createMathEditorState(), 'x');
  state = edit(state, { type: 'template', value: 'square' });
  assert.deepEqual(state.cursor, { path: [], offset: 1 });
  state = type(state, '-', '9', '=', '0');
  assert.equal(latex(state.document), '{x}^{2}-9=0');
  assert.equal(validate(state.document), null);
  assert.equal(parseMathInput(latex(state.document), 'problemLatex'), '{x}^{2}-9=0');
  assert.equal(formatMathPreview(state.document), 'x² − 9 = 0');

  const emptySquare = edit(createMathEditorState(), { type: 'template', value: 'square' });
  assert.deepEqual(emptySquare.cursor, { path: [{ index: 0, slot: 'base' }], offset: 0 });
});
