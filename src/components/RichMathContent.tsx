import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import type { ContentBlock, MathContentBlock, RichContent } from '../types';
import { InlineMathFormula, MathFormula } from './MathFormula';

type Props = {
  content: RichContent;
  color: string;
  textStyle: StyleProp<TextStyle>;
  mathFontSize?: number;
  mathMinHeight?: number;
  mathAlign?: 'left' | 'center';
  containerStyle?: StyleProp<ViewStyle>;
  mathBlockStyle?: StyleProp<ViewStyle>;
  gap?: number;
};

function isAtomicMath(latex: string) {
  const normalized = latex.trim();
  return /^(?:[A-Za-z]|\\[A-Za-z]+)(?:_(?:[A-Za-z0-9]|\{[A-Za-z0-9]+\}))?$/.test(normalized);
}

export function RichMathContent({
  content,
  color,
  textStyle,
  mathFontSize = 19,
  mathMinHeight = 32,
  mathAlign = 'center',
  containerStyle,
  mathBlockStyle,
  gap = 6,
}: Props) {
  const visibleContent = content
    .filter((block) => block.type === 'math' || !/^[,.;:!?…\s]+$/.test(block.text))
    .map((block, index, blocks) => block.type === 'text' && blocks[index - 1]?.type === 'math'
      ? { ...block, text: block.text.replace(/^[,;:]\s*/, '') }
      : block)
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
    const inlineMath = block.type === 'math'
      && (previous?.type === 'text' || next?.type === 'text')
      && isAtomicMath(block.latex)
      && block.rendered.widthEx <= 3
      && block.rendered.heightEx <= 3.2
      && !/\\begin\{|\\(?:aligned|cases|matrix)/.test(block.latex);

    if (block.type === 'text' || inlineMath) {
      flow.push(block);
      continue;
    }

    flushFlow();

    const connector = visibleContent[index + 1];
    const followingMath = visibleContent[index + 2];
    const isShortConnector = connector?.type === 'text'
      && /^(?:și|sau|ori|respectiv)$/.test(connector.text.trim().toLocaleLowerCase('ro-RO'));
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

  return (
    <View style={[styles.content, { gap }, containerStyle]}>
      {rows.map((row, index) => row.kind === 'flow' ? (
        <View key={`flow-${index}`} style={[styles.flow, { rowGap: Math.max(1, gap / 3) }]}>
          {row.blocks.map((block, blockIndex) => block.type === 'math'
            ? <InlineMathFormula key={`inline-${blockIndex}`} math={block} color={color} fontSize={mathFontSize} />
            : (
              <Text key={`text-${blockIndex}`} style={[textStyle, styles.textChunk]}>
                {block.text.trim()}
              </Text>
            ))}
        </View>
      ) : row.kind === 'phrase' ? (
        <View key={`phrase-${index}`} style={[styles.phrase, mathBlockStyle]}>
          {row.blocks.map((block, blockIndex) => block.type === 'math'
            ? <InlineMathFormula key={`phrase-math-${blockIndex}`} math={block} color={color} fontSize={mathFontSize} />
            : <Text key={`phrase-text-${blockIndex}`} style={textStyle}>{block.text.trim()}</Text>)}
        </View>
      ) : (
        <View key={`math-${index}`} style={mathBlockStyle}>
          <MathFormula
            math={row.block}
            color={color}
            fontSize={mathFontSize}
            minHeight={mathMinHeight}
            align={mathAlign}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%' },
  flow: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 3 },
  phrase: { width: '100%', minHeight: 28, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  textChunk: { flexShrink: 1 },
});
