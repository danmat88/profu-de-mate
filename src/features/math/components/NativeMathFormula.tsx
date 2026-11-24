import { memo, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { parse, SvgAst, type JsxAST } from 'react-native-svg';
import { colors } from '../../../shared/theme';
import type { RenderedMath } from '../../../shared/types';
import {
  computeNativeMathDimensions,
  prepareNativeMathSvg,
  type NativeMathSize,
} from '../utils/nativeMathSvg';

type Props = {
  rendered: RenderedMath;
  size?: NativeMathSize;
  scale?: number;
  color?: string;
  maxWidth?: number;
  align?: 'left' | 'center';
  accessibilityLabel?: string;
};

const MAX_AST_CACHE_ENTRIES = 800;
const parsedAstCache = new Map<string, JsxAST | null>();
const SVG_FILL_OVERRIDE = { width: '100%', height: '100%' } as const;

function getOrParseSvgAst(rawSvg: string, color: string): { key: string; ast: JsxAST | null } {
  const xml = prepareNativeMathSvg(rawSvg, color);
  if (!xml) return { key: '', ast: null };

  const cached = parsedAstCache.get(xml);
  if (cached !== undefined) {
    return { key: xml, ast: cached };
  }

  let ast: JsxAST | null = null;
  try {
    ast = parse(xml);
  } catch {
    ast = null;
  }

  if (parsedAstCache.size >= MAX_AST_CACHE_ENTRIES) {
    const oldestKey = parsedAstCache.keys().next().value;
    if (oldestKey !== undefined) parsedAstCache.delete(oldestKey);
  }
  parsedAstCache.set(xml, ast);
  return { key: xml, ast };
}

/**
 * Pre-parses a compiled MathJax SVG into the module-level AST cache so the
 * next question, exam item, or formula sheet mounts in 0ms with zero JS jank.
 */
export function prewarmNativeMathSvg(rawSvg: string, color: string = colors.ink): void {
  if (!rawSvg) return;
  getOrParseSvgAst(rawSvg, color);
}

/**
 * Pure native Skia SVG renderer for pre-compiled and server-rendered MathJax
 * Fira equations. Caches parsed SVG AST trees globally (0ms repeat/prewarmed
 * mount), keys every `<SvgAst>` by content so Android Fabric never paints
 * stale glyphs across step swaps, and enforces `maxWidth: '100%'` + exact
 * `aspectRatio` so formulas never overflow card margins.
 */
export const NativeMathFormula = memo(function NativeMathFormula({
  rendered,
  size = 'display',
  scale = 1,
  color = colors.ink,
  maxWidth,
  align = 'center',
  accessibilityLabel,
}: Props) {
  const { key: astKey, ast } = useMemo(
    () => getOrParseSvgAst(rendered.svg, color),
    [color, rendered.svg],
  );

  const dims = useMemo(
    () => computeNativeMathDimensions(rendered, { size, scale, maxWidth }),
    [maxWidth, rendered, scale, size],
  );

  if (!ast) return null;

  if (size === 'inline') {
    return (
      <View
        accessible={Boolean(accessibilityLabel)}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.inlineBox,
          {
            width: dims.width,
            maxWidth: '100%',
            aspectRatio: dims.aspectRatio,
          },
        ]}
      >
        <SvgAst key={astKey} ast={ast} override={SVG_FILL_OVERRIDE} />
      </View>
    );
  }

  if (dims.needsHorizontalScroll) {
    return (
      <View style={styles.scrollOuter}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          bounces={false}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          style={styles.scrollWrap}
          contentContainerStyle={styles.scrollContent}
          accessibilityLabel={accessibilityLabel}
        >
          <View style={{ width: dims.width, height: dims.height }}>
            <SvgAst key={astKey} ast={ast} override={SVG_FILL_OVERRIDE} />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.blockOuter,
        align === 'left' ? styles.blockLeft : styles.blockCenter,
      ]}
    >
      <View
        style={[
          styles.fitBox,
          {
            width: dims.width,
            maxWidth: '100%',
            aspectRatio: dims.aspectRatio,
          },
        ]}
      >
        <SvgAst key={astKey} ast={ast} override={SVG_FILL_OVERRIDE} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  inlineBox: {
    flexShrink: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  blockOuter: {
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  blockCenter: {
    alignItems: 'center',
  },
  blockLeft: {
    alignItems: 'flex-start',
  },
  fitBox: {
    overflow: 'hidden',
  },
  scrollOuter: {
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  scrollWrap: {
    width: '100%',
    flexGrow: 0,
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
});
