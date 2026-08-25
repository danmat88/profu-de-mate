import { memo, useMemo, useState } from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { MathContentBlock } from '../types';
import { colors, fonts, hardShadow } from '../theme';
import { Text } from './Typography';

type Props = {
  math: MathContentBlock;
  color: string;
  fontSize?: number;
  minHeight?: number;
  horizontalPadding?: number;
  containerWidth?: number;
  align?: 'left' | 'center';
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
};

type InlineProps = Pick<Props, 'math' | 'color' | 'fontSize' | 'style'>;

type ZoomProps = {
  visible: boolean;
  onClose: () => void;
  spoken: string;
  xml: string;
  width: number;
  height: number;
};

function FormulaZoom({ visible, onClose, spoken, xml, width, height }: ZoomProps) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const viewportWidth = Math.max(240, window.width - 32);
  const zoomWidth = Math.max(viewportWidth - 40, width * 1.45);
  const zoomHeight = height * (zoomWidth / width);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      <View style={styles.zoomOverlay}>
        <Pressable accessible={false} onPress={onClose} style={StyleSheet.absoluteFill} />
        <View
          accessibilityViewIsModal
          style={[
            styles.zoomCard,
            {
              marginTop: Math.max(insets.top, 16),
              marginBottom: Math.max(insets.bottom, 16),
              width: viewportWidth,
            },
          ]}
        >
          <View style={styles.zoomHeader}>
            <View style={styles.zoomHeaderCopy}>
              <Text style={styles.zoomEyebrow}>VIZUALIZARE MĂRITĂ</Text>
              <Text style={styles.zoomTitle}>Formula completă</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Închide formula mărită"
              onPress={onClose}
              style={({ pressed }) => [styles.zoomClose, pressed && styles.zoomClosePressed]}
            >
              <Text style={styles.zoomCloseText}>×</Text>
            </Pressable>
          </View>
          <View style={styles.zoomCanvas}>
            <ScrollView
              horizontal
              bounces={false}
              nestedScrollEnabled
              showsHorizontalScrollIndicator
              accessibilityLabel={spoken}
              accessibilityHint="Glisează orizontal pentru a parcurge formula completă."
              contentContainerStyle={[styles.zoomScroll, { minWidth: viewportWidth - 44 }]}
            >
              <View style={{ width: zoomWidth, height: zoomHeight }}>
                <SvgXml xml={xml} width={zoomWidth} height={zoomHeight} />
              </View>
            </ScrollView>
          </View>
          <Text style={styles.zoomHelp}>Glisează formula spre stânga sau spre dreapta.</Text>
        </View>
      </View>
    </Modal>
  );
}

function colorizeSvg(svg: string, color: string): string {
  return svg
    .replace(/\s(?:data|aria)-[\w:-]+="[^"]*"/g, '')
    .replace(/currentColor/g, color);
}

function sameMath(previous: MathContentBlock, next: MathContentBlock) {
  return previous.latex === next.latex
    && previous.spoken === next.spoken
    && previous.rendered.svg === next.rendered.svg
    && previous.rendered.viewBox === next.rendered.viewBox
    && previous.rendered.widthEx === next.rendered.widthEx
    && previous.rendered.heightEx === next.rendered.heightEx
    && previous.rendered.depthEx === next.rendered.depthEx;
}

function InlineMathFormulaComponent({ math, color, fontSize = 16, style }: InlineProps) {
  const { width: windowWidth } = useWindowDimensions();
  const svgFontSize = fontSize;
  const naturalWidth = Math.max(10, math.rendered.widthEx * svgFontSize * 0.5);
  const naturalHeight = Math.max(svgFontSize, math.rendered.heightEx * svgFontSize * 0.5);
  const width = Math.min(naturalWidth, windowWidth - 72);
  const height = naturalHeight * (width / naturalWidth);
  const viewBox = math.rendered.viewBox.split(/\s+/).map(Number);
  const fallbackDepthRatio = viewBox.length === 4 && viewBox.every(Number.isFinite)
    ? Math.max(0, viewBox[1] + viewBox[3]) / viewBox[3]
    : 0;
  const depth = math.rendered.depthEx !== undefined
    ? math.rendered.depthEx * svgFontSize * 0.5 * (width / naturalWidth)
    : fallbackDepthRatio * height;
  const xml = useMemo(() => colorizeSvg(math.rendered.svg, color), [color, math.rendered.svg]);

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={math.spoken}
      style={[styles.inline, { width, height, transform: [{ translateY: depth }] }, style]}
    >
      <SvgXml xml={xml} width={width} height={height} />
    </View>
  );
}

export const InlineMathFormula = memo(InlineMathFormulaComponent, (previous, next) => (
  sameMath(previous.math, next.math)
  && previous.color === next.color
  && previous.fontSize === next.fontSize
  && previous.style === next.style
));

function MathFormulaComponent({
  math,
  color,
  fontSize = 20,
  minHeight = 32,
  horizontalPadding = 4,
  containerWidth,
  align = 'center',
  interactive = true,
  style,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const svgFontSize = fontSize;
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const resolvedContainerWidth = (containerWidth ?? measuredWidth) || windowWidth - 64;
  const availableWidth = Math.max(80, resolvedContainerWidth - horizontalPadding * 2);
  const naturalWidth = Math.max(18, math.rendered.widthEx * svgFontSize * 0.5);
  const naturalHeight = Math.max(18, math.rendered.heightEx * svgFontSize * 0.5);
  const minimumScale = 0.78;
  const needsHorizontalScroll = interactive && naturalWidth * minimumScale > availableWidth;
  const renderedWidth = needsHorizontalScroll
    ? naturalWidth * minimumScale
    : Math.min(naturalWidth, availableWidth);
  const renderedHeight = naturalHeight * (renderedWidth / naturalWidth);
  const frameHeight = Math.max(minHeight, Math.ceil(renderedHeight + 8)) + (needsHorizontalScroll ? 36 : 0);
  const xml = useMemo(
    () => colorizeSvg(math.rendered.svg, color),
    [color, math.rendered.svg],
  );

  const measure = (event: LayoutChangeEvent) => {
    if (containerWidth !== undefined) return;
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
      accessible={!needsHorizontalScroll}
      accessibilityRole={!needsHorizontalScroll ? 'text' : undefined}
      accessibilityLabel={!needsHorizontalScroll ? math.spoken : undefined}
      onLayout={measure}
      style={[styles.frame, { minHeight: frameHeight, paddingHorizontal: horizontalPadding }, style]}
    >
      {needsHorizontalScroll ? (
        <>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            accessibilityLabel={math.spoken}
            accessibilityHint="Glisează orizontal pentru a vedea formula completă sau folosește butonul Mărește."
            contentContainerStyle={[styles.scrollContent, align === 'center' && { minWidth: availableWidth }]}
          >
            {formula}
          </ScrollView>
          <View style={styles.formulaActions}>
            <Text style={styles.scrollHintText}>↔ GLISEAZĂ FORMULA</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mărește formula"
              onPress={() => setZoomOpen(true)}
              style={({ pressed }) => [styles.zoomButton, pressed && styles.zoomButtonPressed]}
            >
              <Text style={styles.zoomButtonText}>MĂREȘTE</Text>
            </Pressable>
          </View>
          <FormulaZoom
            visible={zoomOpen}
            onClose={() => setZoomOpen(false)}
            spoken={math.spoken}
            xml={xml}
            width={naturalWidth}
            height={naturalHeight}
          />
        </>
      ) : (
        <View style={[styles.formula, align === 'left' ? styles.left : styles.center]}>{formula}</View>
      )}
    </View>
  );
}

export const MathFormula = memo(MathFormulaComponent, (previous, next) => (
  sameMath(previous.math, next.math)
  && previous.color === next.color
  && previous.fontSize === next.fontSize
  && previous.minHeight === next.minHeight
  && previous.horizontalPadding === next.horizontalPadding
  && previous.containerWidth === next.containerWidth
  && previous.align === next.align
  && previous.interactive === next.interactive
  && previous.style === next.style
));

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
  formulaActions: {
    minHeight: 32,
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: '#E9DEFF',
    paddingLeft: 9,
    paddingRight: 3,
    marginTop: 2,
  },
  scrollHintText: {
    fontFamily: fonts.bodyBold,
    color: '#4D22B8',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  zoomButton: {
    minHeight: 32,
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: colors.violetDeep,
    paddingHorizontal: 9,
  },
  zoomButtonPressed: { opacity: 0.78 },
  zoomButtonText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 12, letterSpacing: 0.5 },
  zoomOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23,19,55,0.72)',
    paddingHorizontal: 16,
  },
  zoomCard: {
    maxHeight: '78%',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    padding: 14,
    ...hardShadow,
  },
  zoomHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  zoomHeaderCopy: { flex: 1, minWidth: 0 },
  zoomEyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 12, letterSpacing: 1 },
  zoomTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 21, lineHeight: 26 },
  zoomClose: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
  },
  zoomClosePressed: { transform: [{ translateY: 2 }] },
  zoomCloseText: { fontFamily: fonts.display, color: colors.ink, fontSize: 29, lineHeight: 32 },
  zoomCanvas: {
    minHeight: 140,
    maxHeight: 300,
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: '#FAF7FF',
    overflow: 'hidden',
  },
  zoomScroll: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 24 },
  zoomHelp: { marginTop: 10, fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 13, textAlign: 'center' },
  inline: {
    alignSelf: 'baseline',
    justifyContent: 'center',
    marginHorizontal: 1,
  },
  missing: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
});
