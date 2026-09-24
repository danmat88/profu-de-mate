import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import * as Haptics from '../services/haptics';
import { colors, fonts } from '../theme';
import {
  applyMathEditorCommand,
  createMathEditorState,
  isMathDocument,
  mathPowerBaseNeedsGrouping,
  sameMathCursor,
  serializeMathDocument,
  synchronizeMathEditorDocument,
  type MathCursor,
  type MathDocument,
  type MathEditorCommand,
  type MathNode,
  type MathPathStep,
  type MathSlotName,
  type MathSymbol,
} from '../utils/mathEditor';
import { Text } from './Typography';

const SYMBOL_LABELS: Partial<Record<MathSymbol, string>> = {
  pi: 'π', '.': ',', times: '×', div: '÷', '-': '−', le: '≤', ge: '≥',
};
const SYMBOL_SPOKEN: Partial<Record<MathSymbol, string>> = {
  pi: 'pi', '.': 'virgulă zecimală', times: 'înmulțit', div: 'împărțit',
  '+': 'plus', '-': 'minus', '=': 'egal', '<': 'mai mic', '>': 'mai mare',
  le: 'mai mic sau egal', ge: 'mai mare sau egal',
};
const SLOT_LABELS: Record<MathSlotName, string> = {
  numerator: 'Numărător', denominator: 'Numitor', base: 'Bază', exponent: 'Exponent',
  radicand: 'Sub radical', content: 'Între paranteze',
};
const NUMBER_ROWS: MathSymbol[][] = [
  ['7', '8', '9', 'div'],
  ['4', '5', '6', 'times'],
  ['1', '2', '3', '-'],
  ['0', '.', '=', '+'],
];
const VARIABLES: MathSymbol[] = ['x', 'y', 'z', 'pi'];
const RELATIONS: MathSymbol[] = ['<', 'le', '>', 'ge'];
const TEMPLATES = [
  { value: 'fraction', label: 'a/b', spoken: 'Inserează o fracție' },
  { value: 'power', label: 'aⁿ', spoken: 'Inserează o putere' },
  { value: 'root', label: '√', spoken: 'Inserează un radical' },
  { value: 'group', label: '( )', spoken: 'Inserează paranteze' },
] as const;

type ExpressionProps = {
  nodes: MathNode[];
  path: MathPathStep[];
  depth: number;
  cursor?: MathCursor;
  onSelect?: (cursor: MathCursor) => void;
  onCursorTarget?: (target: View | null) => void;
  label?: string;
};

function ExpressionSlot({ nodes, path, depth, cursor, onSelect, onCursorTarget, label = 'Expresie' }: ExpressionProps) {
  const fontSize = Math.max(17, 30 - depth * 3);
  const selected = cursor?.path.length === path.length
    && cursor.path.every((step, index) => step.index === path[index].index && step.slot === path[index].slot);
  const select = (offset: number) => onSelect?.({ path, offset });
  const position = (offset: number) => {
    const active = cursor && sameMathCursor(cursor, { path, offset });
    return onSelect ? (
      <Pressable
        key={`cursor-${offset}`}
        accessibilityRole="button"
        accessibilityLabel={`${label}: poziția ${offset + 1}`}
        accessibilityState={{ selected: Boolean(active) }}
        onPress={() => select(offset)}
        style={[styles.insertionPoint, { minHeight: fontSize + 16 }]}
      >
        <View ref={active ? onCursorTarget : undefined} style={[styles.caret, { height: fontSize + 3 }, !active && styles.invisible]} />
      </Pressable>
    ) : null;
  };

  if (!nodes.length) {
    return onSelect ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, căsuță goală`}
        accessibilityState={{ selected: Boolean(selected) }}
        onPress={() => select(0)}
        style={[styles.emptySlot, selected && styles.emptySlotSelected]}
      >
        {selected ? <View ref={onCursorTarget} style={[styles.caret, { height: fontSize + 3 }]} />
          : <Text style={[styles.placeholder, { fontSize }]}>□</Text>}
      </Pressable>
    ) : <Text style={[styles.placeholder, { fontSize }]}>□</Text>;
  }

  return (
    <View style={[styles.expressionRow, selected && depth > 0 && styles.selectedSlot]}>
      {position(0)}
      {nodes.map((node, index) => {
        const slot = (name: MathSlotName, childNodes: MathNode[]) => (
          <ExpressionSlot
            nodes={childNodes}
            path={[...path, { index, slot: name }]}
            depth={depth + 1}
            cursor={cursor}
            onSelect={onSelect}
            onCursorTarget={onCursorTarget}
            label={SLOT_LABELS[name]}
          />
        );
        let content;
        switch (node.type) {
          case 'symbol': {
            const symbol = <Text style={[styles.symbol, { fontSize }]}>{SYMBOL_LABELS[node.value] ?? node.value}</Text>;
            content = onSelect ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Plasează cursorul după ${SYMBOL_SPOKEN[node.value] ?? node.value}`}
                onPress={() => select(index + 1)}
                style={styles.symbolTarget}
              >{symbol}</Pressable>
            ) : symbol;
            break;
          }
          case 'fraction':
            content = <View style={styles.fraction}>{slot('numerator', node.numerator)}<View style={styles.fractionLine} />{slot('denominator', node.denominator)}</View>;
            break;
          case 'power':
            content = <View style={styles.power}><View style={styles.expressionRow}>
              {mathPowerBaseNeedsGrouping(node.base) ? <Text style={[styles.symbol, { fontSize }]}>(</Text> : null}
              {slot('base', node.base)}
              {mathPowerBaseNeedsGrouping(node.base) ? <Text style={[styles.symbol, { fontSize }]}>)</Text> : null}
            </View><View style={{ marginBottom: fontSize * 0.65 }}>{slot('exponent', node.exponent)}</View></View>;
            break;
          case 'root':
            content = <View style={styles.root}><Text style={[styles.symbol, { fontSize: fontSize * 1.45 }]}>√</Text><View style={styles.radicand}>{slot('radicand', node.radicand)}</View></View>;
            break;
          case 'group':
            content = <View style={styles.expressionRow}><Text style={[styles.symbol, { fontSize: fontSize * 1.18 }]}>(</Text>{slot('content', node.content)}<Text style={[styles.symbol, { fontSize: fontSize * 1.18 }]}>)</Text></View>;
            break;
        }
        return <View key={index} style={styles.expressionRow}>{content}{position(index + 1)}</View>;
      })}
    </View>
  );
}

export function MathExpression({ document, accessibilityLabel, emptyText = 'Nicio expresie încă' }: {
  document: MathDocument;
  accessibilityLabel?: string;
  emptyText?: string;
}) {
  if (!isMathDocument(document) || document.nodes.length === 0) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.readOnlyExpression}>
      <View accessible accessibilityLabel={accessibilityLabel ?? serializeMathDocument(document)}>
        <ExpressionSlot nodes={document.nodes} path={[]} depth={0} />
      </View>
    </ScrollView>
  );
}

type KeyProps = {
  label: string;
  spoken: string;
  onPress: () => void;
  tone?: 'plain' | 'symbol' | 'primary' | 'tool';
  disabled?: boolean;
  compact?: boolean;
};

function EditorKey({ label, spoken, onPress, tone = 'plain', disabled = false, compact = false }: KeyProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => { Haptics.selection(); onPress(); }}
      style={({ pressed }) => [
        styles.key, tone === 'symbol' && styles.symbolKey, tone === 'primary' && styles.primaryKey,
        tone === 'tool' && styles.toolKey, compact && styles.keyCompact, pressed && styles.keyPressed, disabled && styles.keyDisabled,
      ]}
    >
      <Text maxFontSizeMultiplier={1.4} style={[styles.keyLabel, tone === 'primary' && styles.primaryLabel]}>{label}</Text>
    </Pressable>
  );
}

export type MathEditorProps = {
  document: MathDocument;
  onChange: (document: MathDocument) => void;
  accessibilityLabel?: string;
  disabled?: boolean;
};

/** Native formula tree and keypad: no system keyboard or executable math markup. */
export function MathEditor({ document, onChange, accessibilityLabel = 'Editor matematic', disabled = false }: MathEditorProps) {
  const { isVeryShort, isShort } = useResponsiveLayout();
  const compact = isVeryShort || isShort;
  const [showRelations, setShowRelations] = useState(false);
  const [state, setState] = useState(() => createMathEditorState(document));
  const stateRef = useRef(state);
  const lastDocument = useRef(document);
  const scroll = useRef<ScrollView>(null);
  const formula = useRef<View>(null);
  const cursorTarget = useRef<View | null>(null);
  const viewport = useRef({ width: 0, offset: 0 });
  stateRef.current = state;

  const revealCursor = useCallback(() => {
    requestAnimationFrame(() => {
      const target = cursorTarget.current;
      const content = formula.current;
      if (!target || !content || !viewport.current.width) return;
      target.measureLayout(content, (left, _top, width) => {
        if (cursorTarget.current !== target) return;
        // Formula coordinates exclude the scroll content's 16-point padding.
        const x = left + 16;
        const { offset, width: visibleWidth } = viewport.current;
        const next = x < offset + 16 ? Math.max(0, x - 16)
          : x + width > offset + visibleWidth - 16 ? x + width - visibleWidth + 16 : offset;
        if (next !== offset) {
          viewport.current.offset = next;
          scroll.current?.scrollTo({ x: next, animated: false });
        }
      });
    });
  }, []);
  const selectCursorTarget = useCallback((target: View | null) => {
    cursorTarget.current = target;
    if (target) revealCursor();
  }, [revealCursor]);

  useLayoutEffect(() => {
    if (document !== lastDocument.current) {
      const next = synchronizeMathEditorDocument(stateRef.current, document);
      lastDocument.current = document;
      stateRef.current = next;
      setState(next);
    }
  }, [document]);

  const run = (command: MathEditorCommand) => {
    if (disabled) return;
    const previous = stateRef.current;
    const next = applyMathEditorCommand(previous, command);
    stateRef.current = next;
    setState(next);
    if (next.document !== previous.document) {
      lastDocument.current = next.document;
      onChange(next.document);
    }
  };
  const cursorSlot = state.cursor.path[state.cursor.path.length - 1]?.slot;
  const template = (value: 'fraction' | 'power' | 'root' | 'group') => () => run({ type: 'template', value });

  return (
    <View style={[styles.editor, compact && styles.editorCompact]} accessibilityLabel={accessibilityLabel}>
      <View style={styles.writingSurface}>
        <View style={styles.surfaceToolbar}>
          <Text numberOfLines={1} style={styles.slotLabel}>{cursorSlot ? SLOT_LABELS[cursorSlot] : 'FORMULA TA'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={showRelations ? 'Afișează variabilele x, y, z și pi' : 'Afișează semnele de inegalitate'}
            accessibilityState={{ selected: showRelations, disabled }} disabled={disabled}
            onPress={() => { Haptics.selection(); setShowRelations(value => !value); }}
            style={({ pressed }) => [styles.paletteButton, showRelations && styles.paletteSelected, pressed && styles.keyPressed]}>
            <Text maxFontSizeMultiplier={1.4} style={styles.paletteLabel}>{showRelations ? 'x, π' : '≤ ≥'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Golește formula. Poți anula această acțiune."
            accessibilityState={{ disabled: disabled || !state.document.nodes.length }} disabled={disabled || !state.document.nodes.length}
            onPress={() => { Haptics.selection(); run({ type: 'clear' }); }}
            style={({ pressed }) => [styles.clearButton, pressed && styles.keyPressed, (disabled || !state.document.nodes.length) && styles.keyDisabled]}>
            <Text maxFontSizeMultiplier={1.4} style={styles.clearLabel}>C</Text>
          </Pressable>
        </View>
        <ScrollView
          ref={scroll}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.writingContent, compact && styles.writingContentCompact]}
          onLayout={event => { viewport.current.width = event.nativeEvent.layout.width; revealCursor(); }}
          onScroll={event => { viewport.current.offset = event.nativeEvent.contentOffset.x; }}
          scrollEventThrottle={16}
          onContentSizeChange={revealCursor}
        >
          <View ref={formula} collapsable={false} style={styles.expressionRow}>
            <ExpressionSlot nodes={state.document.nodes} path={[]} depth={0} cursor={state.cursor} onSelect={cursor => run({ type: 'select', cursor })} onCursorTarget={selectCursorTarget} />
            {!state.document.nodes.length ? <Text style={styles.writingHint}>Alege cifrele și semnele de mai jos.</Text> : null}
          </View>
        </ScrollView>
      </View>

      <View style={styles.tools}>
        <EditorKey compact={compact} label="↶" spoken="Anulează ultima modificare" tone="tool" disabled={disabled || !state.undo.length} onPress={() => run({ type: 'undo' })} />
        <EditorKey compact={compact} label="↷" spoken="Refă modificarea" tone="tool" disabled={disabled || !state.redo.length} onPress={() => run({ type: 'redo' })} />
        <EditorKey compact={compact} label="←" spoken="Mută cursorul la stânga" tone="tool" disabled={disabled} onPress={() => run({ type: 'left' })} />
        <EditorKey compact={compact} label="→" spoken="Mută cursorul la dreapta" tone="tool" disabled={disabled} onPress={() => run({ type: 'right' })} />
        <EditorKey compact={compact} label="⌫" spoken="Șterge înaintea cursorului" tone="tool" disabled={disabled || !state.document.nodes.length} onPress={() => run({ type: 'backspace' })} />
        <EditorKey compact={compact} label="↗" spoken="Treci la următoarea căsuță sau ieși din structură" tone="primary" disabled={disabled || !cursorSlot} onPress={() => run({ type: 'next-slot' })} />
      </View>
      {NUMBER_ROWS.map((row, index) => (
        <View key={index} style={styles.keyRow}>
          {[...row, (showRelations ? RELATIONS : VARIABLES)[index]].map(value => (
            <EditorKey
              key={value}
              label={SYMBOL_LABELS[value] ?? value}
              spoken={`Inserează ${SYMBOL_SPOKEN[value] ?? value}`}
              tone={/^[0-9.]$/.test(value) ? 'plain' : 'symbol'}
              disabled={disabled}
              compact={compact}
              onPress={() => run({ type: 'symbol', value })}
            />
          ))}
          <EditorKey compact={compact} label={TEMPLATES[index].label} spoken={TEMPLATES[index].spoken} tone="symbol" disabled={disabled} onPress={template(TEMPLATES[index].value)} />
        </View>
      ))}
      {state.message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{state.message}</Text> : null}
    </View>
  );
}

export default MathEditor;

const styles = StyleSheet.create({
  editor: { flex: 1, minHeight: 0, gap: 5 },
  editorCompact: { gap: 3 },
  writingSurface: { flex: 1, minHeight: 0, backgroundColor: colors.paper, borderWidth: 1.5, borderColor: colors.ink, borderRadius: 18, overflow: 'hidden' },
  writingContent: { flexGrow: 1, minWidth: '100%', minHeight: 92, paddingHorizontal: 14, paddingVertical: 5, alignItems: 'center' },
  writingContentCompact: { minHeight: 45, paddingVertical: 2 },
  writingHint: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: colors.inkSoft, marginLeft: 8, maxWidth: 178 },
  surfaceToolbar: { minHeight: 40, paddingLeft: 12, paddingRight: 2, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: '#F3ECFF' },
  slotLabel: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.5, color: colors.violetDeep },
  paletteButton: { minWidth: 52, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  paletteSelected: { backgroundColor: colors.lime },
  paletteLabel: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.violetDeep },
  readOnlyExpression: { minWidth: '100%', paddingVertical: 9 },
  emptyText: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft, paddingVertical: 14 },
  expressionRow: { flexDirection: 'row', alignItems: 'center' },
  selectedSlot: { backgroundColor: '#F5F0FF', borderRadius: 5 },
  symbol: { color: colors.ink, fontFamily: 'serif', textAlign: 'center' },
  symbolTarget: { minHeight: 44, justifyContent: 'center', minWidth: 14 },
  insertionPoint: { width: 7, alignItems: 'center', justifyContent: 'center' },
  caret: { width: 2, backgroundColor: colors.violet },
  invisible: { opacity: 0 },
  emptySlot: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, borderRadius: 5, margin: 3 },
  emptySlotSelected: { backgroundColor: colors.violetSoft, borderColor: colors.violet, borderStyle: 'solid' },
  placeholder: { color: colors.inkSoft, textAlign: 'center' },
  fraction: { alignItems: 'center', paddingHorizontal: 2 },
  fractionLine: { height: 1.5, alignSelf: 'stretch', minWidth: 35, backgroundColor: colors.ink, marginVertical: 2 },
  power: { flexDirection: 'row', alignItems: 'flex-end' },
  root: { flexDirection: 'row', alignItems: 'center' },
  radicand: { borderTopWidth: 1.5, borderColor: colors.ink, marginTop: 3, paddingTop: 2 },
  tools: { flexDirection: 'row', gap: 4, paddingVertical: 1 },
  keyRow: { flexDirection: 'row', gap: 4 },
  key: { flex: 1, minWidth: 44, minHeight: 48, paddingVertical: 2, paddingHorizontal: 1, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 1.25, borderBottomWidth: 2.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  keyCompact: { minHeight: 44, paddingVertical: 1 },
  symbolKey: { backgroundColor: colors.violetSoft },
  primaryKey: { backgroundColor: colors.lime },
  toolKey: { backgroundColor: 'rgba(255,248,236,0.78)', borderColor: colors.line, borderBottomWidth: 1.5 },
  keyLabel: { fontFamily: fonts.display, fontSize: 21, color: colors.ink, textAlign: 'center' },
  primaryLabel: { color: colors.ink },
  keyPressed: { opacity: 0.85, transform: [{ translateY: 2 }] },
  keyDisabled: { opacity: 0.35 },
  clearButton: { minWidth: 44, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  clearLabel: { color: colors.inkSoft, fontFamily: fonts.bodyBold, fontSize: 15 },
  message: { color: colors.violetDeep, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
});
