/** Serializable formula tree. Only the editor's finite symbol vocabulary is stored. */
export type MathSymbol = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'x' | 'y' | 'z' | 'pi' | '.' | '+' | '-' | 'times' | 'div' | '=' | '<' | '>' | 'le' | 'ge';

export type MathNode =
  | { type: 'symbol'; value: MathSymbol }
  | { type: 'fraction'; numerator: MathNode[]; denominator: MathNode[] }
  | { type: 'power'; base: MathNode[]; exponent: MathNode[] }
  | { type: 'root'; radicand: MathNode[] }
  | { type: 'group'; content: MathNode[] };

export interface MathDocument { version: 1; nodes: MathNode[] }
export type MathSlotName = 'numerator' | 'denominator' | 'base' | 'exponent' | 'radicand' | 'content';
export interface MathPathStep { index: number; slot: MathSlotName }
export interface MathCursor { path: MathPathStep[]; offset: number }
export interface MathSnapshot { document: MathDocument; cursor: MathCursor }
export interface MathEditorState extends MathSnapshot {
  undo: MathSnapshot[];
  redo: MathSnapshot[];
  message: string | null;
}

export type MathEditorCommand =
  | { type: 'symbol'; value: MathSymbol }
  | { type: 'template'; value: 'fraction' | 'power' | 'root' | 'group' }
  | { type: 'select'; cursor: MathCursor }
  | { type: 'replace'; document: MathDocument }
  | { type: 'left' | 'right' | 'next-slot' | 'backspace' | 'clear' | 'undo' | 'redo' };

export const MATH_EDITOR_LIMITS = { depth: 8, nodes: 256, latexLength: 1600, history: 50 } as const;
const SYMBOLS = new Set<string>('0123456789'.split('').concat(['x', 'y', 'z', 'pi', '.', '+', '-', 'times', 'div', '=', '<', '>', 'le', 'ge']));
const OPERATORS = new Set<MathSymbol>(['+', '-', 'times', 'div', '=', '<', '>', 'le', 'ge']);
const TEX_SYMBOLS: Partial<Record<MathSymbol, string>> = {
  pi: '\\pi ', times: '\\times ', div: '\\div ', le: '\\le ', ge: '\\ge ',
};

export function createEmptyMathDocument(): MathDocument { return { version: 1, nodes: [] }; }

export function getMathNodeSlots(node: MathNode): { name: MathSlotName; nodes: MathNode[] }[] {
  switch (node.type) {
    case 'fraction': return [{ name: 'numerator', nodes: node.numerator }, { name: 'denominator', nodes: node.denominator }];
    case 'power': return [{ name: 'base', nodes: node.base }, { name: 'exponent', nodes: node.exponent }];
    case 'root': return [{ name: 'radicand', nodes: node.radicand }];
    case 'group': return [{ name: 'content', nodes: node.content }];
    default: return [];
  }
}

export function mathPowerBaseNeedsGrouping(base: MathNode[]): boolean {
  return base.length > 1 || base[0]?.type === 'power';
}

function serializeNodes(nodes: MathNode[]): string {
  return nodes.map(node => {
    switch (node.type) {
      case 'symbol': return TEX_SYMBOLS[node.value] ?? node.value;
      case 'fraction': return `\\frac{${serializeNodes(node.numerator)}}{${serializeNodes(node.denominator)}}`;
      case 'power': {
        const base = serializeNodes(node.base);
        return `${mathPowerBaseNeedsGrouping(node.base) ? `(${base})` : `{${base}}`}^{${serializeNodes(node.exponent)}}`;
      }
      case 'root': return `\\sqrt{${serializeNodes(node.radicand)}}`;
      case 'group': return `(${serializeNodes(node.content)})`;
    }
  }).join('');
}

/** Reject malformed, cyclic, excessive or unsupported drafts before rendering them. */
export function isMathDocument(value: unknown): value is MathDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const doc = value as Record<string, unknown>;
  if (doc.version !== 1 || !Array.isArray(doc.nodes) || Object.keys(doc).some(key => !['version', 'nodes'].includes(key))) return false;
  let count = 0;
  const seen = new Set<unknown>();
  const inspect = (nodes: unknown, depth: number): boolean => {
    if (!Array.isArray(nodes) || depth > MATH_EDITOR_LIMITS.depth || seen.has(nodes)) return false;
    seen.add(nodes);
    for (const raw of nodes) {
      if (++count > MATH_EDITOR_LIMITS.nodes || !raw || typeof raw !== 'object' || Array.isArray(raw) || seen.has(raw)) return false;
      seen.add(raw);
      const node = raw as Record<string, unknown>;
      const keys = Object.keys(node);
      if (node.type === 'symbol') {
        if (typeof node.value !== 'string' || !SYMBOLS.has(node.value) || keys.some(key => !['type', 'value'].includes(key))) return false;
      } else {
        const names = node.type === 'fraction' ? ['numerator', 'denominator']
          : node.type === 'power' ? ['base', 'exponent']
            : node.type === 'root' ? ['radicand'] : node.type === 'group' ? ['content'] : null;
        if (!names || keys.some(key => key !== 'type' && !names.includes(key))) return false;
        if (!names.every(name => inspect(node[name], depth + 1))) return false;
      }
    }
    return true;
  };
  return inspect(doc.nodes, 0) && serializeNodes(doc.nodes as MathNode[]).trim().length <= MATH_EDITOR_LIMITS.latexLength;
}

export function serializeMathDocument(document: MathDocument): string {
  if (!isMathDocument(document)) throw new Error('Formula nu are un format valid.');
  return serializeNodes(document.nodes).trim();
}

const SLOT_LABEL: Record<MathSlotName, string> = {
  numerator: 'numărătorul', denominator: 'numitorul', base: 'baza puterii', exponent: 'exponentul', radicand: 'expresia de sub radical', content: 'expresia dintre paranteze',
};

export function validateMathDocument(document: MathDocument): string | null {
  if (!isMathDocument(document)) return 'Formula este prea mare sau nu are un format valid.';
  const validate = (nodes: MathNode[], slot?: MathSlotName): string | null => {
    if (nodes.length === 0) return slot ? `Completează ${SLOT_LABEL[slot]}.` : 'Scrie mai întâi o expresie sau o ecuație.';
    let expectsOperand = true;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type !== 'symbol') {
        for (const child of getMathNodeSlots(node)) {
          const error = validate(child.nodes, child.name);
          if (error) return error;
        }
        expectsOperand = false;
      } else if (/^[\d.]$/.test(node.value)) {
        let number = node.value as string;
        while (i + 1 < nodes.length) {
          const next = nodes[i + 1];
          if (next.type !== 'symbol' || !/^[\d.]$/.test(next.value)) break;
          number += next.value;
          i++;
        }
        if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(number)) return 'Completează numărul zecimal; folosește o singură virgulă între cifre.';
        expectsOperand = false;
      } else if (OPERATORS.has(node.value)) {
        if (expectsOperand && node.value !== '+' && node.value !== '-') return 'Lipsește o expresie înaintea semnului de operație sau de comparație.';
        expectsOperand = true;
      } else expectsOperand = false;
    }
    return expectsOperand ? 'Completează expresia după ultimul semn.' : null;
  };
  return validate(document.nodes);
}

export function getMathSlot(document: MathDocument, path: MathPathStep[]): MathNode[] | null {
  let nodes = document.nodes;
  for (const step of path) {
    if (!Number.isInteger(step.index) || step.index < 0 || step.index >= nodes.length) return null;
    const slot = getMathNodeSlots(nodes[step.index]).find(child => child.name === step.slot);
    if (!slot) return null;
    nodes = slot.nodes;
  }
  return nodes;
}

/** Finds the first empty nested slot so validation can focus the cursor right inside it. */
export function findFirstEmptySlotCursor(document: MathDocument): MathCursor | null {
  const visit = (nodes: MathNode[], path: MathPathStep[]): MathCursor | null => {
    for (let index = 0; index < nodes.length; index++) {
      for (const slot of getMathNodeSlots(nodes[index])) {
        const nextPath = [...path, { index, slot: slot.name }];
        if (slot.nodes.length === 0) return { path: nextPath, offset: 0 };
        const nested = visit(slot.nodes, nextPath);
        if (nested) return nested;
      }
    }
    return null;
  };
  return visit(document.nodes, []);
}

/** Measures nesting depth and nested fractions so the canvas scales smoothly without clipping. */
export function getMathDocumentVisualDepth(document: MathDocument): { maxDepth: number; hasFraction: boolean; fractionDepth: number } {
  let maxDepth = 0;
  let hasFraction = false;
  let fractionDepth = 0;
  const visit = (nodes: MathNode[], depth: number, fractions: number) => {
    if (depth > maxDepth) maxDepth = depth;
    if (fractions > fractionDepth) fractionDepth = fractions;
    for (const node of nodes) {
      const nextFractions = node.type === 'fraction' ? fractions + 1 : fractions;
      if (node.type === 'fraction') hasFraction = true;
      for (const slot of getMathNodeSlots(node)) {
        visit(slot.nodes, depth + 1, nextFractions);
      }
    }
  };
  visit(document.nodes, 0, 0);
  return { maxDepth, hasFraction, fractionDepth };
}

const SLOT_SHORT_TITLE: Record<MathSlotName, string> = {
  numerator: 'NUMĂRĂTOR',
  denominator: 'NUMITOR',
  base: 'BAZĂ',
  exponent: 'EXPONENT',
  radicand: 'RADICAL',
  content: 'PARANTEZE',
};

const NODE_SHORT_TITLE: Record<Exclude<MathNode['type'], 'symbol'>, string> = {
  fraction: 'FRACȚIE',
  power: 'PUTERE',
  root: 'RADICAL',
  group: 'PARANTEZE',
};

/** Compact uppercase breadcrumb showing where inside nested structures the cursor sits. */
export function getCursorBreadcrumb(document: MathDocument, cursor: MathCursor): string {
  if (cursor.path.length === 0) return 'FORMULA TA';
  const last = cursor.path[cursor.path.length - 1];
  const leafLabel = SLOT_SHORT_TITLE[last.slot];
  if (cursor.path.length === 1) return leafLabel;
  const parentStep = cursor.path[cursor.path.length - 2];
  const grandParent = getMathSlot(document, cursor.path.slice(0, -2));
  const parentNode = grandParent?.[parentStep.index];
  const parentLabel = parentNode && parentNode.type !== 'symbol'
    ? NODE_SHORT_TITLE[parentNode.type]
    : SLOT_SHORT_TITLE[parentStep.slot];
  return `${parentLabel} › ${leafLabel}`;
}

/** Human-readable Romanian label describing what the next-slot button will do from the current cursor. */
export function getNextSlotActionLabel(document: MathDocument, cursor: MathCursor): string | null {
  if (cursor.path.length === 0) return null;
  const parentPath = cursor.path.slice(0, -1);
  const step = cursor.path[cursor.path.length - 1];
  const parentNodes = getMathSlot(document, parentPath);
  const owner = parentNodes?.[step.index];
  if (!owner) return 'Ieși ↗';
  if (owner.type === 'fraction') {
    return step.slot === 'numerator' ? 'Numitor →' : 'Ieși din fracție ↗';
  }
  if (owner.type === 'power') {
    return step.slot === 'base' ? 'Exponent →' : 'Ieși din putere ↗';
  }
  if (owner.type === 'root') return 'Ieși din radical ↗';
  if (owner.type === 'group') return 'Ieși din paranteze ↗';
  return 'Ieși ↗';
}

function normalizeCursor(document: MathDocument, cursor: MathCursor): MathCursor {
  const nodes = getMathSlot(document, cursor.path);
  if (!nodes) return { path: [], offset: document.nodes.length };
  return { path: cursor.path, offset: Math.max(0, Math.min(nodes.length, Number.isInteger(cursor.offset) ? cursor.offset : nodes.length)) };
}

export function sameMathCursor(a: MathCursor, b: MathCursor): boolean {
  return a.offset === b.offset && a.path.length === b.path.length
    && a.path.every((step, index) => step.index === b.path[index].index && step.slot === b.path[index].slot);
}

export function createMathEditorState(document: MathDocument = createEmptyMathDocument()): MathEditorState {
  const safe = isMathDocument(document) ? document : createEmptyMathDocument();
  return { document: safe, cursor: { path: [], offset: safe.nodes.length }, undo: [], redo: [], message: null };
}

/** A controlled parent may clone an emitted draft; keep selection/history on that echo. */
export function synchronizeMathEditorDocument(state: MathEditorState, document: MathDocument): MathEditorState {
  if (isMathDocument(document) && JSON.stringify(document) === JSON.stringify(state.document)) return state;
  return createMathEditorState(document);
}

function allCursors(document: MathDocument): MathCursor[] {
  const positions: MathCursor[] = [];
  const visit = (nodes: MathNode[], path: MathPathStep[]) => {
    positions.push({ path, offset: 0 });
    nodes.forEach((node, index) => {
      getMathNodeSlots(node).forEach(slot => visit(slot.nodes, [...path, { index, slot: slot.name }]));
      positions.push({ path, offset: index + 1 });
    });
  };
  visit(document.nodes, []);
  return positions;
}

function nextSlot(document: MathDocument, cursor: MathCursor): MathCursor {
  if (cursor.path.length === 0) return { path: [], offset: document.nodes.length };
  const path = cursor.path.slice(0, -1);
  const step = cursor.path[cursor.path.length - 1];
  const siblings = getMathNodeSlots(getMathSlot(document, path)![step.index]);
  const next = siblings[siblings.findIndex(slot => slot.name === step.slot) + 1];
  return next ? { path: [...path, { index: step.index, slot: next.name }], offset: next.nodes.length }
    : { path, offset: step.index + 1 };
}

function takePreviousOperand(nodes: MathNode[], offset: number): { nodes: MathNode[]; start: number } {
  if (offset === 0) return { nodes: [], start: offset };
  const previous = nodes[offset - 1];
  if (previous.type === 'symbol' && OPERATORS.has(previous.value)) return { nodes: [], start: offset };
  let start = offset - 1;
  if (previous.type === 'symbol' && /^[\d.]$/.test(previous.value)) {
    while (start > 0) {
      const candidate = nodes[start - 1];
      if (candidate.type !== 'symbol' || !/^[\d.]$/.test(candidate.value)) break;
      start--;
    }
  }
  return { nodes: nodes.splice(start, offset - start), start };
}

/** Pure editing/history reducer; mutations operate on a fresh, bounded tree. */
export function applyMathEditorCommand(state: MathEditorState, command: MathEditorCommand): MathEditorState {
  const cursor = normalizeCursor(state.document, state.cursor);
  const clean = { ...state, cursor, message: null };
  if (command.type === 'select') return { ...clean, cursor: normalizeCursor(state.document, command.cursor) };
  if (command.type === 'undo' || command.type === 'redo') {
    const source = state[command.type];
    const snapshot = source[source.length - 1];
    if (!snapshot) return clean;
    const opposite = command.type === 'undo' ? 'redo' : 'undo';
    return { ...clean, ...snapshot, [command.type]: source.slice(0, -1), [opposite]: [...state[opposite], { document: state.document, cursor }].slice(-MATH_EDITOR_LIMITS.history) };
  }
  if (command.type === 'left' || command.type === 'right') {
    const positions = allCursors(state.document);
    const current = positions.findIndex(position => sameMathCursor(position, cursor));
    const index = Math.max(0, Math.min(positions.length - 1, current + (command.type === 'left' ? -1 : 1)));
    return { ...clean, cursor: positions[index] };
  }
  if (command.type === 'next-slot') return { ...clean, cursor: nextSlot(state.document, cursor) };

  const document: MathDocument = JSON.parse(JSON.stringify(state.document));
  const nodes = getMathSlot(document, cursor.path)!;
  let nextCursor: MathCursor = cursor;
  if (command.type === 'clear') {
    if (document.nodes.length === 0) return clean;
    document.nodes = [];
    nextCursor = { path: [], offset: 0 };
  } else if (command.type === 'replace') {
    if (!isMathDocument(command.document)) return clean;
    const replacement: MathDocument = JSON.parse(JSON.stringify(command.document));
    document.nodes = replacement.nodes;
    nextCursor = { path: [], offset: document.nodes.length };
  } else if (command.type === 'symbol') {
    nodes.splice(cursor.offset, 0, { type: 'symbol', value: command.value });
    nextCursor = { ...cursor, offset: cursor.offset + 1 };
  } else if (command.type === 'template') {
    const previous = command.value === 'fraction' || command.value === 'power'
      ? takePreviousOperand(nodes, cursor.offset) : { nodes: [], start: cursor.offset };
    const index = previous.start;
    let node: MathNode;
    let slot: MathSlotName;
    switch (command.value) {
      case 'fraction': node = { type: 'fraction', numerator: previous.nodes, denominator: [] }; slot = previous.nodes.length ? 'denominator' : 'numerator'; break;
      case 'power': node = { type: 'power', base: previous.nodes, exponent: [] }; slot = previous.nodes.length ? 'exponent' : 'base'; break;
      case 'root': node = { type: 'root', radicand: [] }; slot = 'radicand'; break;
      case 'group': node = { type: 'group', content: [] }; slot = 'content'; break;
    }
    nodes.splice(index, 0, node);
    nextCursor = { path: [...cursor.path, { index, slot }], offset: 0 };
  } else if (command.type === 'backspace') {
    if (cursor.offset > 0) {
      const previous = nodes[cursor.offset - 1];
      const children = getMathNodeSlots(previous);
      if (children.some(child => child.nodes.length > 0)) {
        const last = children[children.length - 1];
        return { ...clean, cursor: { path: [...cursor.path, { index: cursor.offset - 1, slot: last.name }], offset: last.nodes.length } };
      }
      nodes.splice(cursor.offset - 1, 1);
      nextCursor = { ...cursor, offset: cursor.offset - 1 };
    } else if (cursor.path.length > 0) {
      const path = cursor.path.slice(0, -1);
      const step = cursor.path[cursor.path.length - 1];
      const parent = getMathSlot(document, path)!;
      const siblings = getMathNodeSlots(parent[step.index]);
      if (siblings.every(child => child.nodes.length === 0)) {
        parent.splice(step.index, 1);
        nextCursor = { path, offset: step.index };
      } else {
        const previous = siblings[siblings.findIndex(slot => slot.name === step.slot) - 1];
        return { ...clean, cursor: previous ? { path: [...path, { index: step.index, slot: previous.name }], offset: previous.nodes.length } : { path, offset: step.index } };
      }
    } else return clean;
  }
  if (!isMathDocument(document)) return { ...clean, message: `Formula a atins limita editorului (${MATH_EDITOR_LIMITS.nodes} simboluri, ${MATH_EDITOR_LIMITS.depth} niveluri).` };
  return { document, cursor: nextCursor, undo: [...state.undo, { document: state.document, cursor }].slice(-MATH_EDITOR_LIMITS.history), redo: [], message: null };
}
