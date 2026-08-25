import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import type { ContentBlock, MathContentBlock, RichContent, VisualContentBlock } from '../types';
import { contentToAccessibleText, prepareRichContentForPresentation } from '../utils/mathContent';
import { InlineMathFormula, MathFormula } from './MathFormula';
import { StructuredVisual } from './StructuredVisual';
import { Text } from './Typography';

type FlowContentBlock = Exclude<ContentBlock, VisualContentBlock>;

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

const subproblemLabelPattern = /^(?:[a-z]|[ivxlcdm]+|\d+)[).:]$/iu;

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
  const visibleContent = prepareRichContentForPresentation(content)
    .filter((block) => block.type === 'math' || block.type === 'visual' || block.text.trim().length > 0);

  const rows: Array<
    | { kind: 'flow'; blocks: FlowContentBlock[] }
    | { kind: 'phrase'; blocks: FlowContentBlock[] }
    | { kind: 'display'; block: MathContentBlock; prefix?: Extract<FlowContentBlock, { type: 'text' }> }
    | { kind: 'visual'; block: VisualContentBlock }
  > = [];
  let flow: FlowContentBlock[] = [];
  const flushFlow = () => {
    if (flow.length > 0) rows.push({ kind: 'flow', blocks: flow });
    flow = [];
  };

  for (let index = 0; index < visibleContent.length; index += 1) {
    const block = visibleContent[index];
    const previous = visibleContent[index - 1];
    const next = visibleContent[index + 1];
    if (block.type === 'visual') {
      flushFlow();
      rows.push({ kind: 'visual', block });
      continue;
    }
    const inlineMath = block.type === 'math'
      && (previous?.type === 'text' || next?.type === 'text')
      && isAtomicMath(block.latex)
      && block.rendered.heightEx <= 3.2;

    if (block.type === 'text' || inlineMath) {
      flow.push(block);
      continue;
    }

    const possiblePrefix = flow.at(-1);
    const prefix = possiblePrefix?.type === 'text' && subproblemLabelPattern.test(possiblePrefix.text.trim())
      ? possiblePrefix
      : undefined;
    if (prefix) flow.pop();
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

    rows.push({ kind: 'display', block, prefix });
  }
  flushFlow();

  const groupedRows: Array<
    | { kind: 'flow'; blocks: FlowContentBlock[] }
    | { kind: 'phrase'; blocks: FlowContentBlock[] }
    | { kind: 'derivation'; blocks: MathContentBlock[]; prefix?: Extract<FlowContentBlock, { type: 'text' }> }
    | { kind: 'visual'; block: VisualContentBlock }
  > = [];
  rows.forEach((row) => {
    if (row.kind !== 'display') {
      groupedRows.push(row);
      return;
    }
    const previous = groupedRows[groupedRows.length - 1];
    if (!row.prefix && previous?.kind === 'derivation' && !previous.prefix) previous.blocks.push(row.block);
    else groupedRows.push({ kind: 'derivation', blocks: [row.block], prefix: row.prefix });
  });

  return (
    <View style={[styles.content, { gap }, containerStyle]}>
      {groupedRows.map((row, index) => row.kind === 'visual' ? (
        <StructuredVisual key={`visual-${index}`} block={row.block} containerWidth={mathContainerWidth} />
      ) : row.kind === 'flow' ? (
        <View
          key={`flow-${index}`}
          accessible
          accessibilityRole="text"
          accessibilityLabel={contentToAccessibleText(row.blocks)}
          style={[styles.flow, { rowGap: Math.max(1, gap / 3) }]}
        >
          {row.blocks.map((block, blockIndex) => block.type === 'math'
            ? <InlineMathFormula key={`inline-${blockIndex}`} math={block} color={color} fontSize={inlineMathFontSize} />
            : <Text key={`text-${blockIndex}`} numberOfLines={textNumberOfLines} style={[textStyle, styles.textChunk]}>{block.text.trim()}</Text>)}
        </View>
      ) : row.kind === 'phrase' ? (
        <View key={`phrase-${index}`} style={[styles.phrase, mathBlockStyle]}>
          {row.blocks.map((block, blockIndex) => block.type === 'math'
            ? <InlineMathFormula key={`phrase-math-${blockIndex}`} math={block} color={color} fontSize={Math.max(inlineMathFontSize, mathFontSize * 0.86)} />
            : <Text key={`phrase-text-${blockIndex}`} style={textStyle}>{block.text.trim()}</Text>)}
        </View>
      ) : (
        <View key={`math-${index}`} style={[mathBlockStyle, styles.derivation]}>
          {row.prefix ? (
            <View style={styles.labeledDerivation}>
              <Text style={[textStyle, styles.displayPrefix]}>{row.prefix.text.trim()}</Text>
              <View style={styles.labeledFormula}>
                {row.blocks.map((block, blockIndex) => (
                  <View key={`derivation-${blockIndex}`} style={blockIndex > 0 && styles.derivationLine}>
                    <MathFormula
                      math={block}
                      color={color}
                      fontSize={mathFontSize}
                      minHeight={mathMinHeight}
                      containerWidth={mathContainerWidth === undefined ? undefined : Math.max(80, mathContainerWidth - 28)}
                      align={mathAlign}
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : row.blocks.map((block, blockIndex) => (
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
  labeledDerivation: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  displayPrefix: { flexShrink: 0, paddingTop: 5 },
  labeledFormula: { flex: 1, minWidth: 0 },
  derivationLine: { borderTopWidth: 1, borderTopColor: '#DED7ED' },
  textChunk: { flexShrink: 1 },
});
