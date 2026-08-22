import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import type { ContentBlock, MathContentBlock, RichContent } from '../types';
import { fonts } from '../theme';
import { contentToAccessibleText } from '../utils/mathContent';
import { InlineMathFormula, latexToInlineText, MathFormula } from './MathFormula';

type Props = {
  content: RichContent;
  color: string;
  textStyle: StyleProp<TextStyle>;
  mathFontSize?: number;
  inlineMathFontSize?: number;
  mathMinHeight?: number;
  mathAlign?: 'left' | 'center';
  mathContainerWidth?: number;
  containerStyle?: StyleProp<ViewStyle>;
  mathBlockStyle?: StyleProp<ViewStyle>;
  textNumberOfLines?: number;
  inlineCompactMath?: boolean;
  gap?: number;
};

function isAtomicMath(latex: string) {
  const normalized = latex.trim();
  const symbol = /^(?:[A-Za-z]|\\[A-Za-z]+)(?:_(?:[A-Za-z0-9]|\{[A-Za-z0-9]+\}))?$/.test(normalized);
  const scalar = /^[+-]?\d+(?:[.,]\d+)?(?:\^\{?(?:\\circ|\d+)\}?)?$/.test(normalized);
  return symbol || scalar;
}

function separatorBefore(previous: ContentBlock | undefined, current: ContentBlock, currentText: string) {
  if (!previous) return '';
  if (/^[,.;:!?…%)\]}]/.test(currentText)) return '';
  if (previous.type === 'math' && current.type === 'math') return ', ';
  const previousText = previous.type === 'text'
    ? previous.text.trim()
    : latexToInlineText(previous.latex) ?? '';
  return /[([{\u201e\u201c]$/.test(previousText) ? '' : ' ';
}

export function RichMathContent({
  content,
  color,
  textStyle,
  mathFontSize = 19,
  inlineMathFontSize = Math.max(12, mathFontSize * 0.78),
  mathMinHeight = 32,
  mathAlign = 'center',
  mathContainerWidth,
  containerStyle,
  mathBlockStyle,
  textNumberOfLines,
  inlineCompactMath = false,
  gap = 6,
}: Props) {
  const visibleContent = content
    .filter((block) => block.type === 'math' || block.text.trim().length > 0);

  const rows: Array<
    | { kind: 'flow'; blocks: ContentBlock[] }
    | { kind: 'phrase'; blocks: ContentBlock[] }
    | { kind: 'display'; block: MathContentBlock }
  > = [];
  let flow: ContentBlock[] = [];
  const flushFlow = () => {
    if (flow.length > 0) rows.push({ kind: 'flow', blocks: flow });
    flow = [];
  };

  for (let index = 0; index < visibleContent.length; index += 1) {
    const block = visibleContent[index];
    const previous = visibleContent[index - 1];
    const next = visibleContent[index + 1];
    const nativeInlineValue = block.type === 'math' ? latexToInlineText(block.latex) : null;
    const inlineMath = block.type === 'math'
      && (previous?.type === 'text' || next?.type === 'text')
      && (isAtomicMath(block.latex)
        || (nativeInlineValue !== null && block.rendered.widthEx <= (inlineCompactMath ? 13 : 9) && block.rendered.heightEx <= 3.4)
        || (inlineCompactMath
        && block.rendered.widthEx <= 7
        && block.rendered.heightEx <= 3.4
        && !/\\begin\{|\\(?:aligned|cases|matrix|pmatrix|bmatrix|array)/.test(block.latex)))
      && block.rendered.heightEx <= 3.2;

    if (block.type === 'text' || inlineMath) {
      flow.push(block);
      continue;
    }

    flushFlow();

    const connector = visibleContent[index + 1];
    const followingMath = visibleContent[index + 2];
    const connectorText = connector?.type === 'text' ? connector.text.trim() : '';
    const isShortConnector = connector?.type === 'text'
      && connectorText.length <= 28
      && !/[.!?:;]/.test(connectorText);
    const isCompactPhrase = block.type === 'math'
      && isShortConnector
      && followingMath?.type === 'math'
      && block.rendered.widthEx + followingMath.rendered.widthEx <= 12;

    if (isCompactPhrase) {
      rows.push({ kind: 'phrase', blocks: [block, connector, followingMath] });
      index += 2;
      continue;
    }

    rows.push({ kind: 'display', block });
  }
  flushFlow();

  const groupedRows: Array<
    | { kind: 'flow'; blocks: ContentBlock[] }
    | { kind: 'phrase'; blocks: ContentBlock[] }
    | { kind: 'derivation'; blocks: MathContentBlock[] }
  > = [];
  rows.forEach((row) => {
    if (row.kind !== 'display') {
      groupedRows.push(row);
      return;
    }
    const previous = groupedRows[groupedRows.length - 1];
    if (previous?.kind === 'derivation') previous.blocks.push(row.block);
    else groupedRows.push({ kind: 'derivation', blocks: [row.block] });
  });

  return (
    <View style={[styles.content, { gap }, containerStyle]}>
      {groupedRows.map((row, index) => row.kind === 'flow' ? (() => {
        const inlineValues = row.blocks.map((block) => block.type === 'math' ? latexToInlineText(block.latex) : block.text.trim());
        const isNativeParagraph = inlineValues.every((value) => Boolean(value));

        return isNativeParagraph ? (
          <Text
            key={`flow-${index}`}
            accessible
            accessibilityRole="text"
            accessibilityLabel={contentToAccessibleText(row.blocks)}
            numberOfLines={textNumberOfLines}
            style={textStyle}
          >
            {row.blocks.map((block, blockIndex) => {
              const value = inlineValues[blockIndex] ?? '';
              const prefix = separatorBefore(row.blocks[blockIndex - 1], block, value);
              return block.type === 'math' ? (
                <Text key={`inline-${blockIndex}`} style={[styles.nativeMath, { color, fontSize: inlineMathFontSize }]}>
                  {prefix}{value}
                </Text>
              ) : <Text key={`text-${blockIndex}`}>{prefix}{value}</Text>;
            })}
          </Text>
        ) : (
          <View key={`flow-${index}`} style={[styles.flow, { rowGap: Math.max(1, gap / 3) }]}>
            {row.blocks.map((block, blockIndex) => block.type === 'math'
              ? <InlineMathFormula key={`inline-${blockIndex}`} math={block} color={color} fontSize={inlineMathFontSize} />
              : <Text key={`text-${blockIndex}`} numberOfLines={textNumberOfLines} style={[textStyle, styles.textChunk]}>{block.text.trim()}</Text>)}
          </View>
        );
      })() : row.kind === 'phrase' ? (
        <View key={`phrase-${index}`} style={[styles.phrase, mathBlockStyle]}>
          {row.blocks.map((block, blockIndex) => block.type === 'math'
            ? <InlineMathFormula key={`phrase-math-${blockIndex}`} math={block} color={color} fontSize={Math.max(inlineMathFontSize, mathFontSize * 0.86)} />
            : <Text key={`phrase-text-${blockIndex}`} style={textStyle}>{block.text.trim()}</Text>)}
        </View>
      ) : (
        <View key={`math-${index}`} style={[mathBlockStyle, styles.derivation]}>
          {row.blocks.map((block, blockIndex) => (
            <View key={`derivation-${blockIndex}`} style={blockIndex > 0 && styles.derivationLine}>
              <MathFormula
                math={block}
                color={color}
                fontSize={mathFontSize}
                minHeight={mathMinHeight}
                containerWidth={mathContainerWidth}
                align={mathAlign}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%' },
  flow: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 3 },
  phrase: { width: '100%', minHeight: 28, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 5 },
  derivation: { width: '100%' },
  derivationLine: { borderTopWidth: 1, borderTopColor: '#DED7ED' },
  textChunk: { flexShrink: 1 },
  nativeMath: { fontFamily: fonts.bodyMedium, includeFontPadding: false },
});
