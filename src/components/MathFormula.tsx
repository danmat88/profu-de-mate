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
  containerWidth?: number;
  align?: 'left' | 'center';
  style?: StyleProp<ViewStyle>;
};

type InlineProps = Pick<Props, 'math' | 'color' | 'fontSize' | 'style'>;

function colorizeSvg(svg: string, color: string): string {
  return svg
    .replace(/\s(?:data|aria)-[\w:-]+="[^"]*"/g, '')
    .replace(/currentColor/g, color);
}

const superscript: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ',
};

const subscript: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ',
  m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
};

const mathSymbols: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', kappa: 'κ', lambda: 'λ', mu: 'μ', pi: 'π',
  rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω', pm: '±', mp: '∓', times: '×',
  cdot: '·', div: '÷', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', sim: '∼',
  in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇', cup: '∪', cap: '∩',
  perp: '⊥', parallel: '∥', angle: '∠', triangle: '△', infinity: '∞', circ: '°', emptyset: '∅',
  forall: '∀', exists: '∃', to: '→', rightarrow: '→', Rightarrow: '⇒', leftrightarrow: '↔', Leftrightarrow: '⇔',
  mid: '∣', ldots: '…', dots: '…',
};

function mapScript(value: string, alphabet: Record<string, string>): string | null {
  const mapped = [...value].map((character) => alphabet[character]);
  return mapped.every(Boolean) ? mapped.join('') : null;
}

export function latexToInlineText(latex: string): string | null {
  if (/\\(?:begin|end|frac|dfrac|tfrac|sqrt|sum|prod|int|lim|overline|vec|hat|bar|cases|matrix|array)\b/.test(latex)) return null;

  let failed = false;
  let value = latex.trim()
    .replace(/\\(?:left|right)/g, '')
    .replace(/\\(?:,|;|!|quad|qquad)/g, ' ')
    .replace(/\\(?:mathrm|mathbf|mathit|operatorname|text)\{([^{}]*)\}/g, '$1')
    .replace(/\^\{([^{}]+)\}|\^([A-Za-z0-9+\-=()])/g, (_match, group: string | undefined, single: string | undefined) => {
      const mapped = mapScript(group ?? single ?? '', superscript);
      if (!mapped) failed = true;
      return mapped ?? '';
    })
    .replace(/_\{([^{}]+)\}|_([A-Za-z0-9+\-=()])/g, (_match, group: string | undefined, single: string | undefined) => {
      const mapped = mapScript(group ?? single ?? '', subscript);
      if (!mapped) failed = true;
      return mapped ?? '';
    })
    .replace(/\\([A-Za-z]+)/g, (match, name: string) => mathSymbols[name] ?? match)
    .replace(/[{}]/g, '')
    .replace(/-/g, '−')
    .replace(/\s*(=|≤|≥|≠|≈|∈|∉|⊥|∥)\s*/g, ' $1 ')
    .replace(/([A-Za-z0-9₀-₉⁰-⁹)])\s*([+−·×÷])\s*([A-Za-z0-9₀-₉⁰-⁹])/g, '$1 $2 $3')
    .replace(/\s+/g, ' ')
    .trim();

  if (failed || !value || value.length > 42 || value.includes('\\')) return null;
  return value;
}

export function InlineMathFormula({ math, color, fontSize = 16, style }: InlineProps) {
  const inlineText = useMemo(() => latexToInlineText(math.latex), [math.latex]);
  const window = useWindowDimensions();
  const naturalWidth = Math.max(10, math.rendered.widthEx * fontSize * 0.5);
  const naturalHeight = Math.max(fontSize, math.rendered.heightEx * fontSize * 0.5);
  const width = Math.min(naturalWidth, window.width - 72);
  const height = naturalHeight * (width / naturalWidth);
  const viewBox = math.rendered.viewBox.split(/\s+/).map(Number);
  const fallbackDepthRatio = viewBox.length === 4 && viewBox.every(Number.isFinite)
    ? Math.max(0, viewBox[1] + viewBox[3]) / viewBox[3]
    : 0;
  const depth = math.rendered.depthEx !== undefined
    ? math.rendered.depthEx * fontSize * 0.5 * (width / naturalWidth)
    : fallbackDepthRatio * height;
  const xml = useMemo(() => colorizeSvg(math.rendered.svg, color), [color, math.rendered.svg]);

  if (inlineText) {
    return (
      <Text
        accessible
        accessibilityRole="text"
        accessibilityLabel={math.spoken}
        style={[styles.inlineText, { color, fontSize, lineHeight: Math.ceil(fontSize * 1.3) }, style]}
      >
        {inlineText}
      </Text>
    );
  }

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

export function MathFormula({
  math,
  color,
  fontSize = 20,
  minHeight = 32,
  horizontalPadding = 4,
  containerWidth,
  align = 'center',
  style,
}: Props) {
  const window = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const resolvedContainerWidth = (containerWidth ?? measuredWidth) || window.width - 64;
  const availableWidth = Math.max(80, resolvedContainerWidth - horizontalPadding * 2);
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
    alignSelf: 'baseline',
    justifyContent: 'center',
    marginHorizontal: 1,
  },
  inlineText: {
    alignSelf: 'baseline',
    fontFamily: fonts.bodyMedium,
    includeFontPadding: false,
    marginHorizontal: 1,
  },
  missing: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
});
