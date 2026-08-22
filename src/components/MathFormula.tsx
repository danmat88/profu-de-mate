import { useMemo, useState } from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { MathContentBlock } from '../types';
import { fonts } from '../theme';

type Props = {
  math: MathContentBlock;
  color: string;
  fontSize?: number;
  minHeight?: number;
  horizontalPadding?: number;
  align?: 'left' | 'center';
  style?: StyleProp<ViewStyle>;
};

type InlineProps = Pick<Props, 'math' | 'color' | 'fontSize' | 'style'>;

function colorizeSvg(svg: string, color: string): string {
  return svg
    .replace(/\s(?:data|aria)-[\w:-]+="[^"]*"/g, '')
    .replace(/currentColor/g, color);
}

export function InlineMathFormula({ math, color, fontSize = 16, style }: InlineProps) {
  const window = useWindowDimensions();
  const naturalWidth = Math.max(10, math.rendered.widthEx * fontSize * 0.5);
  const naturalHeight = Math.max(fontSize, math.rendered.heightEx * fontSize * 0.5);
  const width = Math.min(naturalWidth, window.width - 72);
  const height = naturalHeight * (width / naturalWidth);
  const xml = useMemo(() => colorizeSvg(math.rendered.svg, color), [color, math.rendered.svg]);

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={math.spoken}
      style={[styles.inline, { width, height }, style]}
    >
      <SvgXml xml={xml} width={width} height={height} />
    </View>
  );
}

export function MathFormula({
  math,
  color,
  fontSize = 20,
  minHeight = 32,
  horizontalPadding = 4,
  align = 'center',
  style,
}: Props) {
  const window = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const availableWidth = Math.max(80, (measuredWidth || window.width - 64) - horizontalPadding * 2);
  const naturalWidth = Math.max(18, math.rendered.widthEx * fontSize * 0.5);
  const naturalHeight = Math.max(18, math.rendered.heightEx * fontSize * 0.5);
  const minimumScale = 0.78;
  const needsHorizontalScroll = naturalWidth * minimumScale > availableWidth;
  const renderedWidth = needsHorizontalScroll
    ? naturalWidth * minimumScale
    : Math.min(naturalWidth, availableWidth);
  const renderedHeight = naturalHeight * (renderedWidth / naturalWidth);
  const frameHeight = Math.max(minHeight, Math.ceil(renderedHeight + 8));
  const xml = useMemo(
    () => colorizeSvg(math.rendered.svg, color),
    [color, math.rendered.svg],
  );

  const measure = (event: LayoutChangeEvent) => {
    const nextWidth = Math.floor(event.nativeEvent.layout.width);
    setMeasuredWidth((current) => current === nextWidth ? current : nextWidth);
  };

  const formula = (
    <View style={{ width: renderedWidth, height: renderedHeight }}>
      <SvgXml xml={xml} width={renderedWidth} height={renderedHeight} />
    </View>
  );

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={math.spoken}
      onLayout={measure}
      style={[styles.frame, { minHeight: frameHeight, paddingHorizontal: horizontalPadding }, style]}
    >
      {needsHorizontalScroll ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, align === 'center' && { minWidth: availableWidth }]}
        >
          {formula}
        </ScrollView>
      ) : (
        <View style={[styles.formula, align === 'left' ? styles.left : styles.center]}>{formula}</View>
      )}
    </View>
  );
}

export function MissingMath({ label }: { label: string }) {
  return <Text accessibilityRole="alert" style={styles.missing}>{label}</Text>;
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  formula: {
    width: '100%',
    justifyContent: 'center',
  },
  left: { alignItems: 'flex-start' },
  center: { alignItems: 'center' },
  scrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: {
    alignSelf: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  missing: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
});
