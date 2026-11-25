import { memo, useMemo } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { colors, fonts } from '../../../shared/theme';
import { Text } from '../../../shared/ui/Typography';
import { NativeMathFormula } from '../../math/components/NativeMathFormula';
import type { NativeMathSize } from '../../math/utils/nativeMathSvg';
import { getRenderedStudyMath } from '../data/renderedMath.generated';
import { stripInlineMathDelimiters, tokenizeInlineMathText } from '../utils/inlineMath';

type Props = {
  text: string;
  scale?: number;
  color?: string;
  mathSize?: NativeMathSize;
  maxMathWidth?: number;
  align?: 'left' | 'center';
  textStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  numberOfLines?: number;
};

/**
 * Renders Romanian prose seamlessly mixed with inline `$...$` MathJax Fira SVG
 * expressions natively on Frame 0. Pure-text sentences render as a single fast
 * `<Text>`, while mixed math sentences flow cleanly inside bounds with glued
 * punctuation so periods and parentheses never break orphaned.
 */
export const StudyInlineText = memo(function StudyInlineText({
  text,
  scale = 1,
  color = colors.ink,
  mathSize = 'inline',
  maxMathWidth = 250,
  align = 'left',
  textStyle,
  containerStyle,
  numberOfLines,
}: Props) {
  const hasInlineMath = text.includes('$');
  const atoms = useMemo(
    () => (hasInlineMath ? tokenizeInlineMathText(text) : null),
    [hasInlineMath, text],
  );

  const flatStyle = useMemo(() => StyleSheet.flatten(textStyle), [textStyle]);

  // Separate container layout props (flex, margins, widths) from pure typography
  // so properties like `flex: 1` or `marginTop: 12` on `textStyle` NEVER leak
  // onto individual word `<Text>` atoms inside `inlineFlow`!
  const { extractedContainerStyle, hasFlexContainer, pureTextStyle, inlineAtomStyle } = useMemo(() => {
    const baseSize = flatStyle?.fontSize ?? 14.5;
    const scaledSize = Number((baseSize * scale).toFixed(1));
    const baseLine = flatStyle?.lineHeight ?? Math.round(baseSize * 1.42);
    const scaledLine = Math.round(baseLine * scale);

    const container: ViewStyle = {};
    if (flatStyle) {
      if (flatStyle.flex !== undefined) container.flex = flatStyle.flex;
      if (flatStyle.flexGrow !== undefined) container.flexGrow = flatStyle.flexGrow;
      if (flatStyle.flexShrink !== undefined) container.flexShrink = flatStyle.flexShrink;
      if (flatStyle.flexBasis !== undefined) container.flexBasis = flatStyle.flexBasis;
      if (flatStyle.alignSelf !== undefined) container.alignSelf = flatStyle.alignSelf;
      if (flatStyle.width !== undefined) container.width = flatStyle.width;
      if (flatStyle.minWidth !== undefined) container.minWidth = flatStyle.minWidth;
      if (flatStyle.maxWidth !== undefined) container.maxWidth = flatStyle.maxWidth;
      if (flatStyle.margin !== undefined) container.margin = flatStyle.margin;
      if (flatStyle.marginTop !== undefined) container.marginTop = flatStyle.marginTop;
      if (flatStyle.marginBottom !== undefined) container.marginBottom = flatStyle.marginBottom;
      if (flatStyle.marginLeft !== undefined) container.marginLeft = flatStyle.marginLeft;
      if (flatStyle.marginRight !== undefined) container.marginRight = flatStyle.marginRight;
      if (flatStyle.marginHorizontal !== undefined) container.marginHorizontal = flatStyle.marginHorizontal;
      if (flatStyle.marginVertical !== undefined) container.marginVertical = flatStyle.marginVertical;
    }

    const typographyOnly: TextStyle = {
      ...(flatStyle?.fontFamily ? { fontFamily: flatStyle.fontFamily } : null),
      ...(flatStyle?.fontWeight ? { fontWeight: flatStyle.fontWeight } : null),
      ...(flatStyle?.fontStyle ? { fontStyle: flatStyle.fontStyle } : null),
      ...(flatStyle?.letterSpacing !== undefined ? { letterSpacing: flatStyle.letterSpacing } : null),
      ...(flatStyle?.textTransform ? { textTransform: flatStyle.textTransform } : null),
      ...(flatStyle?.textDecorationLine ? { textDecorationLine: flatStyle.textDecorationLine } : null),
      ...(flatStyle?.opacity !== undefined ? { opacity: flatStyle.opacity } : null),
      color: flatStyle?.color ?? color,
      fontSize: scaledSize,
      lineHeight: scaledLine,
    };

    const atomTypography: TextStyle = {
      ...typographyOnly,
      lineHeight: Math.max(Math.round(scaledSize * 1.28), Math.round(scaledLine * 0.92)),
      includeFontPadding: false,
    };

    const hasFlex = container.flex !== undefined || container.flexGrow !== undefined;
    return {
      extractedContainerStyle: Object.keys(container).length > 0 ? container : undefined,
      hasFlexContainer: hasFlex,
      pureTextStyle: typographyOnly,
      inlineAtomStyle: atomTypography,
    };
  }, [color, flatStyle, scale]);

  if (!hasInlineMath || !atoms) {
    const textNode = (
      <Text
        numberOfLines={numberOfLines}
        style={[
          styles.baseText,
          extractedContainerStyle,
          pureTextStyle,
          align === 'center' && styles.textCenter,
        ]}
      >
        {text}
      </Text>
    );
    return containerStyle ? <View style={containerStyle}>{textNode}</View> : textNode;
  }

  // Single standalone math chip (e.g. choice label "$\\frac{5}{12}$") renders centered & crisp.
  if (atoms.length === 1 && atoms[0].kind === 'math' && !atoms[0].prefix && !atoms[0].suffix) {
    const rendered = getRenderedStudyMath(atoms[0].latex, mathSize === 'choice' ? 'display' : 'inline');
    if (rendered) {
      return (
        <View
          accessible
          accessibilityLabel={stripInlineMathDelimiters(text)}
          style={[
            styles.singleMathWrap,
            hasFlexContainer && styles.flexFlowOverride,
            align === 'center' ? styles.singleMathCenter : styles.singleMathLeft,
            extractedContainerStyle,
            containerStyle,
          ]}
        >
          <NativeMathFormula
            rendered={rendered}
            size={mathSize}
            scale={scale}
            color={String(flatStyle?.color ?? color)}
            maxWidth={maxMathWidth}
            align={align}
          />
        </View>
      );
    }
  }

  return (
    <View
      accessible
      accessibilityLabel={stripInlineMathDelimiters(text)}
      style={[
        styles.inlineFlow,
        hasFlexContainer && styles.flexFlowOverride,
        align === 'center' && styles.inlineFlowCenter,
        extractedContainerStyle,
        containerStyle,
      ]}
    >
      {atoms.map((atom, index) => {
        if (atom.kind === 'word') {
          return (
            <Text key={`w-${index}`} style={[styles.baseText, inlineAtomStyle]}>
              {atom.text}
            </Text>
          );
        }
        const rendered = getRenderedStudyMath(atom.latex, 'inline');
        if (!rendered) {
          return (
            <Text key={`m-${index}`} style={[styles.baseText, inlineAtomStyle]}>
              {`${atom.prefix}${atom.latex}${atom.suffix}`}
            </Text>
          );
        }
        return (
          <View key={`m-${index}-${atom.latex}`} style={styles.gluedAtom}>
            {atom.prefix ? (
              <Text style={[styles.baseText, inlineAtomStyle]}>{atom.prefix}</Text>
            ) : null}
            <NativeMathFormula
              rendered={rendered}
              size={mathSize}
              scale={scale}
              color={String(flatStyle?.color ?? color)}
              maxWidth={maxMathWidth}
            />
            {atom.suffix ? (
              <Text style={[styles.baseText, inlineAtomStyle]}>{atom.suffix}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  baseText: {
    fontFamily: fonts.body,
    color: colors.ink,
  },
  textCenter: {
    textAlign: 'center',
  },
  inlineFlow: {
    width: '100%',
    maxWidth: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 4,
    rowGap: 4,
    overflow: 'hidden',
  },
  flexFlowOverride: {
    width: undefined,
    minWidth: 0,
  },
  inlineFlowCenter: {
    justifyContent: 'center',
  },
  gluedAtom: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  singleMathWrap: {
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  singleMathCenter: {
    alignItems: 'center',
  },
  singleMathLeft: {
    alignItems: 'flex-start',
  },
});
