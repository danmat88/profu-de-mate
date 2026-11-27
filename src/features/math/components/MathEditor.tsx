import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';
import Svg, { Path, Polyline } from 'react-native-svg';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { bundledImageSource } from '../../../shared/services/bundledImages';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts } from '../../../shared/theme';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { Text } from '../../../shared/ui/Typography';
import type { InstantMathResult } from '../utils/instantMathEvaluator';
import {
  applyMathEditorCommand,
  createMathEditorState,
  findFirstEmptySlotCursor,
  getCursorBreadcrumb,
  getMathDocumentVisualDepth,
  getNextSlotActionLabel,
  isMathDocument,
  mathPowerBaseNeedsGrouping,
  sameMathCursor,
  serializeMathDocument,
  synchronizeMathEditorDocument,
  validateMathDocument,
  type MathCursor,
  type MathDocument,
  type MathEditorCommand,
  type MathNode,
  type MathPathStep,
  type MathSlotName,
  type MathSymbol,
} from '../utils/mathEditor';

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
  radicand: 'Sub radical', content: 'Paranteze',
};
const NUMBER_ROWS: readonly (readonly MathSymbol[])[] = [
  ['7', '8', '9', 'div'],
  ['4', '5', '6', 'times'],
  ['1', '2', '3', '-'],
  ['0', '.', '=', '+'],
];
const VARIABLES: readonly MathSymbol[] = ['x', 'y', 'z', 'pi'];
const RELATIONS: readonly MathSymbol[] = ['<', 'le', '>', 'ge'];
const TEMPLATES = [
  { value: 'fraction', label: 'a/b', spoken: 'Inserează o fracție' },
  { value: 'square', label: 'a²', spoken: 'Ridică la pătrat' },
  { value: 'power', label: 'aⁿ', spoken: 'Inserează o putere' },
  { value: 'root', label: '√', spoken: 'Inserează un radical' },
  { value: 'group', label: '( )', spoken: 'Inserează paranteze' },
] as const;

type TemplateKind = (typeof TEMPLATES)[number]['value'];

export type MathEditorExample = {
  label: string;
  document: MathDocument;
};

function RadicalHook({ height }: { height: number }) {
  const h = Math.max(22, Math.round(height));
  const w = Math.max(12, Math.min(20, Math.round(h * 0.34)));
  const points = `1,${(h * 0.6).toFixed(1)} ${(w * 0.28).toFixed(1)},${(h * 0.52).toFixed(1)} ${(w * 0.54).toFixed(1)},${(h - 1.5).toFixed(1)} ${(w - 1).toFixed(1)},1.2 ${w},1.2`;
  return (
    <Svg accessible={false} width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Polyline
        points={points}
        fill="none"
        stroke={colors.ink}
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function StretchedParen({ side, height }: { side: 'left' | 'right'; height: number }) {
  const h = Math.max(34, Math.round(height));
  const w = 10;
  const d = side === 'left'
    ? `M ${w - 1.5} 2 Q 1.5 ${(h / 2).toFixed(1)} ${w - 1.5} ${h - 2}`
    : `M 1.5 2 Q ${w - 1.5} ${(h / 2).toFixed(1)} 1.5 ${h - 2}`;
  return (
    <Svg accessible={false} width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Path d={d} fill="none" stroke={colors.violetDeep} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ExpandGlyph({ expanded }: { expanded: boolean }) {
  return (
    <Svg accessible={false} width={15} height={15} viewBox="0 0 24 24">
      {expanded ? (
        <Path
          d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"
          fill="none"
          stroke={colors.ink}
          strokeWidth={2.3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <Path
          d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
          fill="none"
          stroke={colors.ink}
          strokeWidth={2.3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

function RadicalNode({ fontSize, children }: { fontSize: number; children: React.ReactNode }) {
  const minHeight = Math.max(24, Math.round(fontSize * 1.3));
  const [measured, setMeasured] = useState(minHeight);
  const hookHeight = Math.max(minHeight, measured);

  return (
    <View style={styles.root}>
      <RadicalHook height={hookHeight} />
      <View
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.height);
          if (next > 0 && Math.abs(next - measured) >= 2) setMeasured(next);
        }}
        style={[styles.radicand, { minHeight }]}
      >
        {children}
      </View>
    </View>
  );
}

function GroupNode({ fontSize, children }: { fontSize: number; children: React.ReactNode }) {
  const [measured, setMeasured] = useState(0);
  const tall = measured > fontSize * 1.65;
  const parenSize = Math.round(fontSize * 1.12);

  return (
    <View style={styles.expressionRow}>
      {tall
        ? <StretchedParen side="left" height={measured} />
        : <Text style={[styles.symbol, styles.parenSymbol, { fontSize: parenSize }]}>(</Text>}
      <View
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.height);
          if (next > 0 && Math.abs(next - measured) >= 3) setMeasured(next);
        }}
      >
        {children}
      </View>
      {tall
        ? <StretchedParen side="right" height={measured} />
        : <Text style={[styles.symbol, styles.parenSymbol, { fontSize: parenSize }]}>)</Text>}
    </View>
  );
}

function CaretBar({ height, onTarget }: { height: number; onTarget?: (target: View | null) => void }) {
  return (
    <View ref={onTarget} collapsable={false} style={styles.caretWrap}>
      <View style={styles.caretCap} />
      <View style={[styles.caret, { height }]} />
    </View>
  );
}

type ExpressionProps = {
  nodes: MathNode[];
  path: MathPathStep[];
  depth: number;
  baseFontSize: number;
  cursor?: MathCursor;
  highlightEmpty?: boolean;
  onSelect?: (cursor: MathCursor) => void;
  onCursorTarget?: (target: View | null) => void;
  label?: string;
};

function ExpressionSlot({
  nodes,
  path,
  depth,
  baseFontSize,
  cursor,
  highlightEmpty = false,
  onSelect,
  onCursorTarget,
  label = 'Expresie',
}: ExpressionProps) {
  const fontSize = Math.max(12, Math.round(baseFontSize - depth * 3.5));
  const selected = cursor?.path.length === path.length
    && cursor.path.every((step, index) => step.index === path[index].index && step.slot === path[index].slot);
  const select = (offset: number) => onSelect?.({ path, offset });
  const caretHeight = Math.max(15, Math.round(fontSize * 1.1));

  const position = (offset: number) => {
    const active = cursor && sameMathCursor(cursor, { path, offset });
    return onSelect ? (
      <Pressable
        key={`cursor-${offset}`}
        accessibilityRole="button"
        accessibilityLabel={`${label}: poziția ${offset + 1}`}
        accessibilityState={{ selected: Boolean(active) }}
        onPress={() => select(offset)}
        style={[styles.insertionPoint, { minHeight: fontSize + 6 }]}
      >
        {active
          ? <CaretBar height={caretHeight} onTarget={onCursorTarget} />
          : <View style={[styles.caret, { height: caretHeight }, styles.invisible]} />}
      </Pressable>
    ) : null;
  };

  if (!nodes.length) {
    const slotMinHeight = depth === 0 ? 34 : Math.max(20, Math.round(fontSize * 1.24));
    const slotMinWidth = depth === 0 ? 30 : Math.max(22, Math.round(fontSize * 1.22));
    return onSelect ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, căsuță goală`}
        accessibilityState={{ selected: Boolean(selected) }}
        onPress={() => select(0)}
        style={[
          styles.emptySlot,
          { minWidth: slotMinWidth, minHeight: slotMinHeight },
          selected && styles.emptySlotSelected,
          highlightEmpty && depth > 0 && styles.emptySlotAlert,
        ]}
      >
        {selected
          ? <CaretBar height={caretHeight} onTarget={onCursorTarget} />
          : <Text style={[styles.placeholder, { fontSize: Math.max(11, fontSize - 3) }]}>□</Text>}
      </Pressable>
    ) : <Text style={[styles.placeholder, { fontSize: Math.max(11, fontSize - 3) }]}>□</Text>;
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
            baseFontSize={baseFontSize}
            cursor={cursor}
            highlightEmpty={highlightEmpty}
            onSelect={onSelect}
            onCursorTarget={onCursorTarget}
            label={SLOT_LABELS[name]}
          />
        );
        let content;
        switch (node.type) {
          case 'symbol': {
            const symbol = (
              <Text style={[styles.symbol, { fontSize, lineHeight: Math.round(fontSize * 1.16) }]}>
                {SYMBOL_LABELS[node.value] ?? node.value}
              </Text>
            );
            content = onSelect ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Plasează cursorul după ${SYMBOL_SPOKEN[node.value] ?? node.value}`}
                onPress={() => select(index + 1)}
                style={[styles.symbolTarget, { minHeight: fontSize + 6 }]}
              >
                {symbol}
              </Pressable>
            ) : symbol;
            break;
          }
          case 'fraction':
            content = (
              <View style={[styles.fraction, depth === 0 && styles.fractionRoot]}>
                {slot('numerator', node.numerator)}
                <View style={[styles.fractionLine, depth > 0 && styles.fractionLineNested]} />
                {slot('denominator', node.denominator)}
              </View>
            );
            break;
          case 'power': {
            const groupBase = mathPowerBaseNeedsGrouping(node.base);
            const baseContent = (
              <View style={[styles.expressionRow, { marginTop: Math.round(fontSize * 0.22) }]}>
                {groupBase
                  ? <GroupNode fontSize={fontSize}>{slot('base', node.base)}</GroupNode>
                  : slot('base', node.base)}
              </View>
            );
            content = (
              <View style={styles.power}>
                {baseContent}
                <View style={styles.powerExponent}>
                  {slot('exponent', node.exponent)}
                </View>
              </View>
            );
            break;
          }
          case 'root':
            content = (
              <RadicalNode fontSize={fontSize}>
                {slot('radicand', node.radicand)}
              </RadicalNode>
            );
            break;
          case 'group':
            content = (
              <GroupNode fontSize={fontSize}>
                {slot('content', node.content)}
              </GroupNode>
            );
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
  const { maxDepth, fractionDepth, hasFraction } = getMathDocumentVisualDepth(document);
  const baseFontSize = fractionDepth >= 2 || maxDepth >= 3 ? 18 : hasFraction || maxDepth >= 2 ? 22 : 26;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.readOnlyExpression}>
      <View accessible accessibilityLabel={accessibilityLabel ?? serializeMathDocument(document)}>
        <ExpressionSlot nodes={document.nodes} path={[]} depth={0} baseFontSize={baseFontSize} />
      </View>
    </ScrollView>
  );
}

type KeyTone = 'plain' | 'operator' | 'equals' | 'variable' | 'relation' | 'template' | 'danger';

type KeyProps = {
  label: string;
  spoken: string;
  onPress: () => void;
  tone?: KeyTone;
  disabled?: boolean;
  compact?: boolean;
  slim?: boolean;
};

function keyContainerStyles(tone: KeyTone, slim: boolean, compact: boolean, pressed: boolean, disabled: boolean) {
  return [
    styles.key,
    slim && styles.keySlim,
    compact && (slim ? styles.keySlimCompact : styles.keyCompact),
    tone === 'operator' && styles.operatorKey,
    tone === 'equals' && styles.equalsKey,
    tone === 'variable' && styles.variableKey,
    tone === 'relation' && styles.relationKey,
    tone === 'template' && styles.templateKey,
    tone === 'danger' && styles.dangerKey,
    pressed && !disabled && styles.keyPressed,
    disabled && styles.keyDisabled,
  ];
}

function keyLabelStyles(tone: KeyTone, slim: boolean, compact: boolean) {
  return [
    styles.keyLabel,
    slim && styles.keyLabelSlim,
    tone === 'operator' && styles.operatorLabel,
    tone === 'equals' && styles.equalsLabel,
    tone === 'variable' && styles.variableLabel,
    tone === 'relation' && styles.relationLabel,
    tone === 'template' && styles.templateLabel,
    tone === 'danger' && styles.dangerLabel,
    compact && (slim ? styles.keyLabelSlimCompact : styles.keyLabelCompact),
  ];
}

/** Stateless native 3D comic keycap with zero hooks for ultra-fast full-keypad mount. */
const SimpleEditorKey = memo(function SimpleEditorKey({
  label,
  spoken,
  onPress,
  tone = 'plain',
  disabled = false,
  compact = false,
  slim = false,
}: KeyProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={2}
      onPress={() => {
        Haptics.selection();
        onPress();
      }}
      style={({ pressed }) => keyContainerStyles(tone, slim, compact, pressed, disabled)}
    >
      <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={keyLabelStyles(tone, slim, compact)}>
        {label}
      </Text>
    </Pressable>
  );
});

/** Repeat-on-hold native comic keycap used exclusively by backspace. */
const RepeatEditorKey = memo(function RepeatEditorKey({
  label,
  spoken,
  onPress,
  tone = 'danger',
  disabled = false,
  compact = false,
  slim = false,
}: KeyProps) {
  const holdDelay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const repeatedRef = useRef(false);
  const latestPress = useRef(onPress);

  useEffect(() => {
    latestPress.current = onPress;
  }, [onPress]);

  const stopRepeat = useCallback(() => {
    if (holdDelay.current) {
      clearTimeout(holdDelay.current);
      holdDelay.current = null;
    }
    if (holdInterval.current) {
      clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
  }, []);

  useEffect(() => stopRepeat, [stopRepeat]);
  useEffect(() => {
    if (disabled) stopRepeat();
  }, [disabled, stopRepeat]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={2}
      onPressIn={() => {
        if (disabled) return;
        stopRepeat();
        repeatedRef.current = false;
        holdDelay.current = setTimeout(() => {
          holdInterval.current = setInterval(() => {
            repeatedRef.current = true;
            Haptics.selection();
            latestPress.current();
          }, 80);
        }, 320);
      }}
      onPressOut={stopRepeat}
      onPress={() => {
        if (repeatedRef.current) {
          repeatedRef.current = false;
          return;
        }
        Haptics.selection();
        onPress();
      }}
      style={({ pressed }) => keyContainerStyles(tone, slim, compact, pressed, disabled)}
    >
      <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={keyLabelStyles(tone, slim, compact)}>
        {label}
      </Text>
    </Pressable>
  );
});

type KeypadProps = {
  showRelations: boolean;
  isEmpty: boolean;
  disabled: boolean;
  compact: boolean;
  onSymbol: (value: MathSymbol) => void;
  onTemplate: (value: TemplateKind) => void;
  onBackspace: () => void;
};

/** Memoized comic math keypad: 6 quick templates + 5×4 numpad; zero re-renders on normal typing. */
const KeypadGrid = memo(function KeypadGrid({
  showRelations,
  isEmpty,
  disabled,
  compact,
  onSymbol,
  onTemplate,
  onBackspace,
}: KeypadProps) {
  const sideColumn = showRelations ? RELATIONS : VARIABLES;

  return (
    <View style={styles.keypad}>
      <View style={styles.templateRow}>
        {TEMPLATES.map((item) => (
          <SimpleEditorKey
            key={item.value}
            slim
            compact={compact}
            label={item.label}
            spoken={item.spoken}
            tone="template"
            disabled={disabled}
            onPress={() => onTemplate(item.value)}
          />
        ))}
        <RepeatEditorKey
          slim
          compact={compact}
          label="⌫"
          spoken="Șterge înaintea cursorului"
          tone="danger"
          disabled={disabled || isEmpty}
          onPress={onBackspace}
        />
      </View>

      {NUMBER_ROWS.map((row, rowIndex) => {
        const sideSymbol = sideColumn[rowIndex];
        return (
          <View key={rowIndex} style={styles.keyRow}>
            {row.map((value) => (
              <SimpleEditorKey
                key={value}
                label={SYMBOL_LABELS[value] ?? value}
                spoken={`Inserează ${SYMBOL_SPOKEN[value] ?? value}`}
                tone={value === '=' ? 'equals' : /^[0-9.]$/.test(value) ? 'plain' : 'operator'}
                disabled={disabled}
                compact={compact}
                onPress={() => onSymbol(value)}
              />
            ))}
            <SimpleEditorKey
              key={sideSymbol}
              label={SYMBOL_LABELS[sideSymbol] ?? sideSymbol}
              spoken={`Inserează ${SYMBOL_SPOKEN[sideSymbol] ?? sideSymbol}`}
              tone={showRelations ? 'relation' : 'variable'}
              disabled={disabled}
              compact={compact}
              onPress={() => onSymbol(sideSymbol)}
            />
          </View>
        );
      })}
    </View>
  );
});

export type MathEditorProps = {
  document: MathDocument;
  /** Change this key when switching fields/modes to reset cursor & undo without remounting the keypad. */
  documentKey?: string;
  onChange: (document: MathDocument) => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  accent?: 'solve' | 'check';
  examples?: readonly MathEditorExample[];
  errorSignal?: number;
  placeholder?: string;
  referenceText?: string;
  onPressReference?: () => void;
  /** Optional offline instant calculator result shown live inside the formula card. */
  instantResult?: InstantMathResult | null;
};

/** Native formula studio: notebook spine, 2D bounded scrolling, auto-scaling, zero Reanimated churn. */
export function MathEditor({
  document,
  documentKey,
  onChange,
  accessibilityLabel = 'Editor matematic',
  disabled = false,
  accent = 'solve',
  examples,
  errorSignal = 0,
  placeholder = 'Tastează formula cu tastele de mai jos',
  referenceText,
  onPressReference,
  instantResult,
}: MathEditorProps) {
  const frame = useSafeAreaFrame();
  const { isVeryShort, isShort } = useResponsiveLayout(frame);
  const compact = isVeryShort || isShort;
  const [showRelations, setShowRelations] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeKey, setActiveKey] = useState(documentKey);
  const [state, setState] = useState(() => createMathEditorState(document));
  const [alertEmptySlots, setAlertEmptySlots] = useState(false);
  const [clearedToast, setClearedToast] = useState(false);

  if (activeKey !== documentKey) {
    setActiveKey(documentKey);
    setState(createMathEditorState(document));
    setAlertEmptySlots(false);
    setClearedToast(false);
    setExpanded(false);
  }

  const stateRef = useRef(state);
  const lastDocument = useRef(document);
  const lastKey = useRef(documentKey);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  const clearedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hScroll = useRef<ScrollView>(null);
  const vScroll = useRef<ScrollView>(null);
  const formula = useRef<View>(null);
  const cursorTarget = useRef<View | null>(null);
  const hViewport = useRef({ width: 0, offset: 0 });
  const vViewport = useRef({ height: 0, offset: 0 });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => () => {
    if (clearedTimer.current) clearTimeout(clearedTimer.current);
  }, []);

  const revealCursor = useCallback(() => {
    requestAnimationFrame(() => {
      const target = cursorTarget.current;
      const content = formula.current;
      if (!target || !content) return;
      try {
        target.measureLayout(
          content,
          (left, top, width, height) => {
            if (cursorTarget.current !== target) return;
            if (hViewport.current.width > 0) {
              const x = left + 14;
              const { offset, width: visibleW } = hViewport.current;
              const nextX = x < offset + 18 ? Math.max(0, x - 24)
                : x + width > offset + visibleW - 18 ? x + width - visibleW + 24 : offset;
              if (Math.abs(nextX - offset) > 1) {
                hViewport.current.offset = nextX;
                hScroll.current?.scrollTo({ x: nextX, animated: false });
              }
            }
            if (vViewport.current.height > 0) {
              const y = top + 10;
              const { offset, height: visibleH } = vViewport.current;
              const nextY = y < offset + 14 ? Math.max(0, y - 18)
                : y + height > offset + visibleH - 14 ? y + height - visibleH + 18 : offset;
              if (Math.abs(nextY - offset) > 1) {
                vViewport.current.offset = nextY;
                vScroll.current?.scrollTo({ y: nextY, animated: false });
              }
            }
          },
          () => undefined,
        );
      } catch {
        // Ignore transient measurements when a cursor node unmounts mid-frame.
      }
    });
  }, []);

  const selectCursorTarget = useCallback((target: View | null) => {
    cursorTarget.current = target;
    if (target) revealCursor();
  }, [revealCursor]);

  useLayoutEffect(() => {
    if (documentKey !== lastKey.current) {
      lastKey.current = documentKey;
      lastDocument.current = document;
      stateRef.current = state;
      hViewport.current.offset = 0;
      vViewport.current.offset = 0;
      hScroll.current?.scrollTo({ x: 0, animated: false });
      vScroll.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    if (document !== lastDocument.current) {
      const next = synchronizeMathEditorDocument(stateRef.current, document);
      lastDocument.current = document;
      stateRef.current = next;
      setState(next);
      setAlertEmptySlots(false);
      setClearedToast(false);
    }
  }, [document, documentKey, state]);

  useEffect(() => {
    if (errorSignal <= 0) return;
    setExpanded(false);
    setAlertEmptySlots(true);
    const missing = findFirstEmptySlotCursor(stateRef.current.document);
    if (missing) {
      const next = applyMathEditorCommand(stateRef.current, { type: 'select', cursor: missing });
      stateRef.current = next;
      setState(next);
    }
  }, [errorSignal]);

  const run = useCallback((command: MathEditorCommand) => {
    if (disabledRef.current) return;
    const previous = stateRef.current;
    const next = applyMathEditorCommand(previous, command);
    stateRef.current = next;
    setState(next);
    setAlertEmptySlots(false);
    if (command.type === 'clear' && previous.document.nodes.length > 0) {
      setExpanded(false);
      setClearedToast(true);
      if (clearedTimer.current) clearTimeout(clearedTimer.current);
      clearedTimer.current = setTimeout(() => setClearedToast(false), 3500);
    } else if (command.type !== 'select') {
      setClearedToast(false);
    }
    if (next.document !== previous.document) {
      lastDocument.current = next.document;
      onChangeRef.current(next.document);
    }
  }, []);

  const handleSymbol = useCallback((value: MathSymbol) => run({ type: 'symbol', value }), [run]);
  const handleTemplate = useCallback((value: TemplateKind) => run({ type: 'template', value }), [run]);
  const handleBackspace = useCallback(() => run({ type: 'backspace' }), [run]);

  const jumpToMissingSlot = () => {
    const missing = findFirstEmptySlotCursor(stateRef.current.document);
    if (!missing) return;
    Haptics.selection();
    run({ type: 'select', cursor: missing });
  };

  const isEmpty = state.document.nodes.length === 0;

  useEffect(() => {
    if (!isEmpty) return;
    hViewport.current.offset = 0;
    vViewport.current.offset = 0;
  }, [isEmpty]);
  const inSlot = state.cursor.path.length > 0;
  const breadcrumb = useMemo(
    () => getCursorBreadcrumb(state.document, state.cursor),
    [state.cursor, state.document],
  );
  const nextSlotLabel = useMemo(
    () => getNextSlotActionLabel(state.document, state.cursor),
    [state.cursor, state.document],
  );
  const validationMessage = useMemo(
    () => (isEmpty ? null : validateMathDocument(state.document)),
    [isEmpty, state.document],
  );
  const { maxDepth, hasFraction, fractionDepth } = useMemo(
    () => getMathDocumentVisualDepth(state.document),
    [state.document],
  );
  const isComplexTall = fractionDepth >= 2 || maxDepth >= 3;

  const rawBaseFontSize = compact
    ? (fractionDepth >= 3 ? 14 : fractionDepth === 2 || maxDepth >= 3 ? 16 : hasFraction || maxDepth >= 2 ? 19 : 24)
    : (fractionDepth >= 3 ? 15 : fractionDepth === 2 || maxDepth >= 3 ? 17 : hasFraction || maxDepth >= 2 ? 22 : 28);
  const baseFontSize = expanded ? Math.min(31, rawBaseFontSize + 4) : rawBaseFontSize;

  const spineColor = alertEmptySlots
    ? colors.rose
    : accent === 'check'
      ? colors.peach
      : colors.cyan;

  return (
    <View style={[styles.editor, compact && styles.editorCompact]} accessibilityLabel={accessibilityLabel}>
      <View style={styles.writingShadow}>
        <View style={[styles.writingSurface, alertEmptySlots && styles.writingSurfaceAlert]}>
          <View style={[styles.notebookRail, { backgroundColor: spineColor }]} />

          <View style={styles.writingMain}>
            <View style={[styles.surfaceToolbar, accent === 'check' && styles.surfaceToolbarCheck]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={inSlot ? `${breadcrumb}. Atinge pentru a trece mai departe.` : breadcrumb}
                disabled={!inSlot || disabled}
                onPress={inSlot ? () => { Haptics.selection(); run({ type: 'next-slot' }); } : undefined}
                style={[styles.slotPill, inSlot && styles.slotPillActive]}
              >
                <Text numberOfLines={1} style={styles.slotLabel}>{breadcrumb}</Text>
              </Pressable>

              <View style={styles.toolbarActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Anulează ultima modificare"
                  accessibilityState={{ disabled: disabled || !state.undo.length }}
                  disabled={disabled || !state.undo.length}
                  onPress={() => { Haptics.selection(); run({ type: 'undo' }); }}
                  style={({ pressed }) => [
                    styles.miniTool,
                    pressed && styles.toolChipPressed,
                    (disabled || !state.undo.length) && styles.keyDisabled,
                  ]}
                >
                  <Text maxFontSizeMultiplier={1.2} style={styles.miniToolText}>↶</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Refă modificarea"
                  accessibilityState={{ disabled: disabled || !state.redo.length }}
                  disabled={disabled || !state.redo.length}
                  onPress={() => { Haptics.selection(); run({ type: 'redo' }); }}
                  style={({ pressed }) => [
                    styles.miniTool,
                    pressed && styles.toolChipPressed,
                    (disabled || !state.redo.length) && styles.keyDisabled,
                  ]}
                >
                  <Text maxFontSizeMultiplier={1.2} style={styles.miniToolText}>↷</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Golește formula. Poți anula această acțiune."
                  accessibilityState={{ disabled: disabled || isEmpty }}
                  disabled={disabled || isEmpty}
                  onPress={() => { Haptics.selection(); run({ type: 'clear' }); }}
                  style={({ pressed }) => [
                    styles.clearButton,
                    pressed && styles.toolChipPressed,
                    (disabled || isEmpty) && styles.keyDisabled,
                  ]}
                >
                  <Text maxFontSizeMultiplier={1.2} style={styles.clearLabel}>C</Text>
                </Pressable>

                {!isEmpty ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={expanded ? 'Arată tastatura matematică' : 'Mărește zona formulei'}
                    accessibilityState={{ expanded }}
                    disabled={disabled}
                    onPress={() => { Haptics.selection(); setExpanded((value) => !value); }}
                    style={({ pressed }) => [
                      styles.expandButton,
                      isComplexTall && !expanded && styles.expandButtonHint,
                      expanded && styles.expandButtonActive,
                      pressed && styles.toolChipPressed,
                    ]}
                  >
                    <ExpandGlyph expanded={expanded} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {referenceText ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Problema ta: ${referenceText}. Atinge pentru a o edita.`}
                onPress={onPressReference}
                style={({ pressed }) => [styles.referenceStrip, pressed && styles.toolChipPressed]}
              >
                <Text style={styles.referenceTag}>PROBLEMA</Text>
                <Text numberOfLines={1} style={styles.referenceFormula}>{referenceText}</Text>
                <MiniGlyph name="next" size={12} color={colors.violetDeep} />
              </Pressable>
            ) : null}

            <View
              style={styles.canvasArea}
              onLayout={(event) => {
                vViewport.current.height = event.nativeEvent.layout.height;
                hViewport.current.width = event.nativeEvent.layout.width;
                revealCursor();
              }}
            >
              <View pointerEvents="none" style={styles.canvasGridLines}>
                <View style={styles.canvasGridLine} />
                <View style={styles.canvasGridLine} />
                <View style={styles.canvasGridLine} />
              </View>

              {isEmpty ? (
                <View style={[styles.emptyCanvas, compact && styles.emptyCanvasCompact]}>
                  <View style={styles.emptyPromptRow}>
                    {!isVeryShort ? (
                      <Image
                        accessible={false}
                        fadeDuration={0}
                        source={bundledImageSource(require('../../../../assets/mascot/owl_point.png'))}
                        resizeMode="contain"
                        style={[styles.emptyMascot, compact && styles.emptyMascotCompact]}
                      />
                    ) : null}
                    <CaretBar height={compact ? 22 : 26} />
                    <Text numberOfLines={2} style={[styles.writingHint, compact && styles.writingHintCompact]}>
                      {placeholder}
                    </Text>
                  </View>

                  {examples && examples.length > 0 && !isVeryShort ? (
                    <View style={styles.examplesRow}>
                      <Text style={styles.examplesLabel}>Încearcă:</Text>
                      {examples.map((example) => (
                        <Pressable
                          key={example.label}
                          accessibilityRole="button"
                          accessibilityLabel={`Completează exemplul ${example.label}`}
                          disabled={disabled}
                          onPress={() => {
                            Haptics.selection();
                            run({ type: 'replace', document: example.document });
                          }}
                          style={({ pressed }) => [
                            styles.exampleChip,
                            alertEmptySlots && styles.exampleChipHighlight,
                            pressed && styles.toolChipPressed,
                          ]}
                        >
                          <Text maxFontSizeMultiplier={1.2} style={styles.exampleChipText}>{example.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : (
                <ScrollView
                  ref={vScroll}
                  style={styles.vScroll}
                  nestedScrollEnabled
                  persistentScrollbar
                  showsVerticalScrollIndicator
                  contentContainerStyle={styles.vScrollContent}
                  onScroll={(event) => { vViewport.current.offset = event.nativeEvent.contentOffset.y; }}
                  scrollEventThrottle={16}
                  onContentSizeChange={revealCursor}
                >
                  <ScrollView
                    ref={hScroll}
                    horizontal
                    style={styles.hScroll}
                    nestedScrollEnabled
                    persistentScrollbar
                    showsHorizontalScrollIndicator
                    contentContainerStyle={styles.hScrollContent}
                    onScroll={(event) => { hViewport.current.offset = event.nativeEvent.contentOffset.x; }}
                    scrollEventThrottle={16}
                    onContentSizeChange={revealCursor}
                  >
                    <Pressable
                      accessible={false}
                      onPress={() => run({ type: 'select', cursor: { path: [], offset: state.document.nodes.length } })}
                      style={styles.canvasTapTarget}
                    >
                      <View ref={formula} collapsable={false} style={styles.expressionRow}>
                        <ExpressionSlot
                          nodes={state.document.nodes}
                          path={[]}
                          depth={0}
                          baseFontSize={baseFontSize}
                          cursor={state.cursor}
                          highlightEmpty={alertEmptySlots}
                          onSelect={(cursor) => run({ type: 'select', cursor })}
                          onCursorTarget={selectCursorTarget}
                        />
                      </View>
                    </Pressable>
                  </ScrollView>
                </ScrollView>
              )}
            </View>

            {instantResult && !isEmpty ? (
              <View
                testID="math-instant-result"
                accessibilityLiveRegion="polite"
                accessibilityLabel={`${instantResult.badge}: ${instantResult.primary}${instantResult.secondary ? ` ${instantResult.secondary}` : ''}`}
                style={[
                  styles.instantBar,
                  compact && styles.instantBarCompact,
                  instantResult.kind === 'warning' && styles.instantBarWarning,
                ]}
              >
                <View
                  style={[
                    styles.instantBadge,
                    instantResult.kind === 'warning' && styles.instantBadgeWarning,
                  ]}
                >
                  <Text
                    maxFontSizeMultiplier={1.1}
                    numberOfLines={1}
                    style={[
                      styles.instantBadgeText,
                      instantResult.kind === 'warning' && styles.instantBadgeTextWarning,
                    ]}
                  >
                    {instantResult.kind === 'warning' ? '! ATENȚIE' : '⚡ INSTANT'}
                  </Text>
                </View>

                <View style={styles.instantValues}>
                  <Text
                    maxFontSizeMultiplier={1.2}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.78}
                    style={[
                      styles.instantPrimary,
                      compact && styles.instantPrimaryCompact,
                      instantResult.kind === 'warning' && styles.instantPrimaryWarning,
                    ]}
                  >
                    {instantResult.primary}
                  </Text>
                  {instantResult.secondary ? (
                    <Text
                      maxFontSizeMultiplier={1.15}
                      numberOfLines={1}
                      style={styles.instantSecondary}
                    >
                      {instantResult.secondary}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={styles.canvasFooter}>
              <View style={styles.navCluster}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mută cursorul la stânga"
                  disabled={disabled || isEmpty}
                  onPress={() => { Haptics.selection(); run({ type: 'left' }); }}
                  style={({ pressed }) => [
                    styles.navButton,
                    pressed && styles.toolChipPressed,
                    (disabled || isEmpty) && styles.keyDisabled,
                  ]}
                >
                  <Text style={styles.navButtonText}>←</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mută cursorul la dreapta"
                  disabled={disabled || isEmpty}
                  onPress={() => { Haptics.selection(); run({ type: 'right' }); }}
                  style={({ pressed }) => [
                    styles.navButton,
                    pressed && styles.toolChipPressed,
                    (disabled || isEmpty) && styles.keyDisabled,
                  ]}
                >
                  <Text style={styles.navButtonText}>→</Text>
                </Pressable>
              </View>

              <View style={styles.footerCenter}>
                {clearedToast && isEmpty && state.undo.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Anulează golirea formulei"
                    onPress={() => { Haptics.selection(); run({ type: 'undo' }); }}
                    style={({ pressed }) => [styles.nextSlotPill, pressed && styles.toolChipPressed]}
                  >
                    <Text numberOfLines={1} style={styles.nextSlotText}>Șters · Anulează ↶</Text>
                  </Pressable>
                ) : expanded ? (
                  <View style={styles.expandedFooterActions}>
                    {nextSlotLabel ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Treci la următoarea căsuță sau ieși din structură"
                        disabled={disabled}
                        onPress={() => { Haptics.selection(); run({ type: 'next-slot' }); }}
                        style={({ pressed }) => [styles.hintBadge, pressed && styles.toolChipPressed]}
                      >
                        <Text numberOfLines={1} style={styles.hintBadgeText}>{nextSlotLabel}</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Deschide tastatura matematică"
                      onPress={() => { Haptics.selection(); setExpanded(false); }}
                      style={({ pressed }) => [styles.nextSlotPill, pressed && styles.toolChipPressed]}
                    >
                      <Text numberOfLines={1} style={styles.nextSlotText}>Tastatură</Text>
                    </Pressable>
                  </View>
                ) : nextSlotLabel ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Treci la următoarea căsuță sau ieși din structură"
                    disabled={disabled}
                    onPress={() => { Haptics.selection(); run({ type: 'next-slot' }); }}
                    style={({ pressed }) => [styles.nextSlotPill, pressed && styles.toolChipPressed]}
                  >
                    <Text numberOfLines={1} style={styles.nextSlotText}>{nextSlotLabel}</Text>
                  </Pressable>
                ) : isEmpty ? (
                  <Text numberOfLines={1} style={styles.footerTip}>Atinge orice simbol din formulă</Text>
                ) : validationMessage === null ? (
                  <View style={styles.readyBadge}>
                    <MiniGlyph name="check" size={12} color={colors.ink} />
                    <Text numberOfLines={1} style={styles.readyBadgeText}>Validă</Text>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={validationMessage}
                    onPress={jumpToMissingSlot}
                    style={({ pressed }) => [styles.hintBadge, pressed && styles.toolChipPressed]}
                  >
                    <Text numberOfLines={1} style={styles.hintBadgeText}>{validationMessage}</Text>
                  </Pressable>
                )}
              </View>

              {!expanded ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showRelations ? 'Afișează variabilele x, y, z și pi' : 'Afișează semnele de inegalitate'}
                  accessibilityState={{ selected: showRelations, disabled }}
                  disabled={disabled}
                  onPress={() => { Haptics.selection(); setShowRelations((value) => !value); }}
                  style={({ pressed }) => [
                    styles.paletteButton,
                    showRelations && styles.paletteSelected,
                    pressed && styles.toolChipPressed,
                  ]}
                >
                  <Text maxFontSizeMultiplier={1.2} style={styles.paletteLabel}>{showRelations ? 'x, π' : '≤ ≥'}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      {!expanded ? (
        <KeypadGrid
          showRelations={showRelations}
          isEmpty={isEmpty}
          disabled={disabled}
          compact={compact}
          onSymbol={handleSymbol}
          onTemplate={handleTemplate}
          onBackspace={handleBackspace}
        />
      ) : null}

      {state.message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{state.message}</Text> : null}
    </View>
  );
}

export default MathEditor;

const styles = StyleSheet.create({
  editor: { flex: 1, minHeight: 0, overflow: 'hidden', gap: 7 },
  editorCompact: { gap: 5 },

  writingShadow: {
    flex: 1,
    minHeight: 0,
    borderRadius: 22,
  },
  writingSurface: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  writingSurfaceAlert: {
    borderColor: colors.rose,
    borderBottomColor: '#C94460',
  },
  notebookRail: {
    width: 5.5,
    alignSelf: 'stretch',
  },
  writingMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  },

  surfaceToolbar: {
    flexShrink: 0,
    height: 40,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
    borderBottomWidth: 1.2,
    borderBottomColor: '#EAE0FA',
    backgroundColor: '#F7F2FF',
  },
  surfaceToolbarCheck: {
    backgroundColor: '#FFF3EE',
    borderBottomColor: '#FFE0D4',
  },
  slotPill: {
    flexShrink: 1,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 999,
    borderWidth: 1.2,
    borderBottomWidth: 2.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
  },
  slotPillActive: {
    backgroundColor: colors.lime,
    borderColor: '#E8FF78',
    borderBottomColor: '#8BB509',
  },
  slotLabel: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.6, color: colors.ink },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  miniTool: {
    width: 30,
    height: 28,
    borderRadius: 10,
    borderWidth: 1.2,
    borderBottomWidth: 2.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniToolText: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  clearButton: {
    width: 30,
    height: 28,
    borderRadius: 10,
    borderWidth: 1.2,
    borderBottomWidth: 2.5,
    borderColor: '#FFD1BE',
    borderBottomColor: '#E39A7E',
    backgroundColor: colors.peachSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearLabel: { color: colors.peachDeep, fontFamily: fonts.display, fontSize: 13.5 },
  expandButton: {
    width: 30,
    height: 28,
    borderRadius: 10,
    borderWidth: 1.2,
    borderBottomWidth: 2.5,
    borderColor: '#B2EAF0',
    borderBottomColor: '#6CCBD6',
    backgroundColor: colors.cyanSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandButtonHint: {
    backgroundColor: colors.gold,
    borderColor: '#FFE88A',
    borderBottomColor: '#C99610',
  },
  expandButtonActive: {
    backgroundColor: colors.lime,
    borderColor: '#E8FF78',
    borderBottomColor: '#8BB509',
  },
  toolChipPressed: { transform: [{ scale: 0.94 }], opacity: 0.88 },

  referenceStrip: {
    flexShrink: 0,
    height: 28,
    paddingHorizontal: 9,
    borderBottomWidth: 1.25,
    borderBottomColor: '#E8DFF6',
    backgroundColor: '#F8F4FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  referenceTag: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 0.65,
    color: colors.violetDeep,
  },
  referenceFormula: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },

  instantBar: {
    flexShrink: 0,
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderTopWidth: 1.25,
    borderTopColor: '#D6EC8C',
    backgroundColor: '#F4FFD2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  instantBarCompact: {
    minHeight: 31,
    paddingVertical: 3,
  },
  instantBarWarning: {
    borderTopColor: '#F5C2CC',
    backgroundColor: '#FFF2F4',
  },
  instantBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 999,
    backgroundColor: colors.lime,
    borderWidth: 1,
    borderColor: '#B5DF26',
    flexShrink: 0,
  },
  instantBadgeWarning: {
    backgroundColor: colors.roseSoft,
    borderColor: '#F2B0BE',
  },
  instantBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.55,
    color: colors.ink,
    includeFontPadding: false,
  },
  instantBadgeTextWarning: {
    color: colors.berryDeep,
  },
  instantValues: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 7,
  },
  instantPrimary: {
    flexShrink: 1,
    fontFamily: fonts.display,
    fontSize: 16.5,
    lineHeight: 20,
    color: colors.ink,
  },
  instantPrimaryCompact: {
    fontSize: 15,
    lineHeight: 18,
  },
  instantPrimaryWarning: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: colors.berryDeep,
  },
  instantSecondary: {
    flexShrink: 0,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.limeDeep,
  },

  canvasArea: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#FFFEFB',
  },
  canvasGridLines: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 14,
    bottom: 14,
    justifyContent: 'space-evenly',
    opacity: 0.45,
  },
  canvasGridLine: {
    height: 1,
    backgroundColor: '#EFE8FA',
  },

  emptyCanvas: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  emptyCanvasCompact: {
    gap: 5,
    paddingVertical: 4,
  },
  emptyPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyMascot: { width: 42, height: 42 },
  emptyMascotCompact: { width: 34, height: 34 },
  writingHint: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13.5, lineHeight: 18, color: colors.inkSoft },
  writingHintCompact: { fontSize: 12.5, lineHeight: 16.5 },
  examplesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  examplesLabel: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.violetDeep },
  exampleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 999,
    borderWidth: 1.2,
    borderBottomWidth: 2.8,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
  },
  exampleChipHighlight: {
    backgroundColor: colors.limeSoft,
    borderColor: '#D2EC82',
    borderBottomColor: '#A0C828',
  },
  exampleChipText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },

  vScroll: { flex: 1, minHeight: 0, width: '100%' },
  vScrollContent: { flexGrow: 1, justifyContent: 'center' },
  hScroll: { width: '100%', flexGrow: 0, flexShrink: 0 },
  hScrollContent: { flexGrow: 1, minWidth: '100%', paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  canvasTapTarget: { flexGrow: 1, minWidth: '100%', justifyContent: 'center' },
  readOnlyExpression: { minWidth: '100%', paddingVertical: 8 },
  emptyText: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft, paddingVertical: 14 },

  expressionRow: { flexDirection: 'row', alignItems: 'center' },
  selectedSlot: {
    backgroundColor: colors.violetSoft,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.violet,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  symbol: { color: colors.ink, fontFamily: 'serif', textAlign: 'center' },
  parenSymbol: { color: colors.violetDeep },
  symbolTarget: { justifyContent: 'center', minWidth: 11 },
  insertionPoint: { width: 7, alignItems: 'center', justifyContent: 'center' },
  caretWrap: { alignItems: 'center' },
  caretCap: { width: 5, height: 3, borderRadius: 2, backgroundColor: colors.violet, marginBottom: -1 },
  caret: { width: 2.5, borderRadius: 2, backgroundColor: colors.violet },
  invisible: { opacity: 0 },
  emptySlot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: 7,
    margin: 2,
    backgroundColor: colors.paperTint,
  },
  emptySlotSelected: { backgroundColor: colors.violetSoft, borderColor: colors.violet, borderStyle: 'solid' },
  emptySlotAlert: { backgroundColor: colors.roseSoft, borderColor: colors.rose, borderStyle: 'solid' },
  placeholder: { color: colors.inkMuted, textAlign: 'center' },
  fraction: { alignItems: 'center', paddingHorizontal: 3 },
  fractionRoot: { paddingHorizontal: 5 },
  fractionLine: { height: 2.4, alignSelf: 'stretch', minWidth: 28, borderRadius: 1.5, backgroundColor: colors.ink, marginVertical: 2.5 },
  fractionLineNested: { height: 1.75, backgroundColor: colors.violetDeep, marginVertical: 1.5 },
  power: { flexDirection: 'row', alignItems: 'flex-start' },
  powerExponent: { marginLeft: 1 },
  root: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 1 },
  radicand: {
    borderTopWidth: 2,
    borderColor: colors.ink,
    paddingTop: 2,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },

  canvasFooter: {
    flexShrink: 0,
    height: 38,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#EFE9FA',
    backgroundColor: colors.paperTint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
  },
  navCluster: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  navButton: {
    width: 32,
    height: 27,
    borderRadius: 10,
    borderWidth: 1.2,
    borderBottomWidth: 2.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: { fontFamily: fonts.display, fontSize: 14, color: colors.ink, lineHeight: 16 },
  footerCenter: { flex: 1, minWidth: 0, alignItems: 'center' },
  expandedFooterActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nextSlotPill: {
    paddingHorizontal: 11,
    paddingVertical: 3.5,
    borderRadius: 999,
    borderWidth: 1.2,
    borderBottomWidth: 2.5,
    borderColor: '#E8FF78',
    borderBottomColor: '#8BB509',
    backgroundColor: colors.lime,
  },
  nextSlotText: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.ink },
  footerTip: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.inkMuted },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.limeSoft,
  },
  readyBadgeText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.ink },
  hintBadge: {
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.goldSoft,
  },
  hintBadgeText: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.ink },
  paletteButton: {
    minWidth: 48,
    height: 27,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1.2,
    borderBottomWidth: 2.5,
    borderColor: '#F3DF8E',
    borderBottomColor: '#D6AE3A',
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteSelected: { backgroundColor: colors.lime, borderColor: '#E8FF78', borderBottomColor: '#8BB509' },
  paletteLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },

  keypad: { gap: 6, flexShrink: 0 },
  templateRow: { flexDirection: 'row', gap: 5 },
  keyRow: { flexDirection: 'row', gap: 6 },
  key: {
    flex: 1,
    minWidth: 0,
    height: 44,
    paddingHorizontal: 2,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.3,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  keyCompact: { height: 38, borderRadius: 13 },
  keySlim: { height: 38, borderRadius: 13 },
  keySlimCompact: { height: 34, borderRadius: 11 },
  keyPressed: {
    transform: [{ translateY: 1.5 }, { scale: 0.96 }],
    borderBottomWidth: 1.5,
    opacity: 0.94,
  },
  operatorKey: { backgroundColor: '#F3ECFF', borderColor: '#DDD0F9', borderBottomColor: '#B89CF2' },
  equalsKey: { backgroundColor: '#E4FAED', borderColor: '#B5EACA', borderBottomColor: '#69C694' },
  variableKey: { backgroundColor: '#FFF7D6', borderColor: '#F3DF8E', borderBottomColor: '#D6AE3A' },
  relationKey: { backgroundColor: '#F4FFD1', borderColor: '#D2EC82', borderBottomColor: '#9AC224' },
  templateKey: { backgroundColor: '#E5FAFC', borderColor: '#B8EDF2', borderBottomColor: '#6CCBD6' },
  dangerKey: { backgroundColor: '#FFEDE6', borderColor: '#FFD1BE', borderBottomColor: '#E39A7E' },
  keyLabel: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, textAlign: 'center' },
  keyLabelSlim: { fontSize: 16.5 },
  keyLabelCompact: { fontSize: 17 },
  keyLabelSlimCompact: { fontSize: 14.5 },
  operatorLabel: { color: colors.violetDeep },
  equalsLabel: { color: colors.mintDeep },
  variableLabel: { color: colors.ink },
  relationLabel: { color: colors.ink },
  templateLabel: { fontSize: 15.5, color: colors.ink },
  dangerLabel: { color: colors.peachDeep },
  keyDisabled: { opacity: 0.35 },
  message: { flexShrink: 0, color: colors.violetDeep, fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 15 },
});
