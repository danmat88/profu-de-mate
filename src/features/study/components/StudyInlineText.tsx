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
  const scaledTextStyle = useMemo<TextStyle>(() => {
    const baseSize = flatStyle?.fontSize ?? 14.5;
    const baseLine = flatStyle?.lineHeight ?? Math.round(baseSize * 1.42);
    return {
      ...flatStyle,
      color: flatStyle?.color ?? color,
      fontSize: Number((baseSize * scale).toFixed(1)),
      lineHeight: Math.round(baseLine * scale),
    };
  }, [color, flatStyle, scale]);

  if (!hasInlineMath || !atoms) {
    return (
      <Text
        numberOfLines={numberOfLines}
        style={[
          styles.baseText,
          scaledTextStyle,
          align === 'center' && styles.textCenter,
        ]}
      >
        {text}
      </Text>
    );
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
            align === 'center' ? styles.singleMathCenter : styles.singleMathLeft,
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
        align === 'center' && styles.inlineFlowCenter,
        containerStyle,
      ]}
    >
      {atoms.map((atom, index) => {
        if (atom.kind === 'word') {
          return (
            <Text key={`w-${index}`} style={[styles.baseText, scaledTextStyle]}>
              {atom.text}
            </Text>
          );
        }
        const rendered = getRenderedStudyMath(atom.latex, 'inline');
        if (!rendered) {
          return (
            <Text key={`m-${index}`} style={[styles.baseText, scaledTextStyle]}>
              {`${atom.prefix}${atom.latex}${atom.suffix}`}
            </Text>
          );
        }
        return (
          <View key={`m-${index}-${atom.latex}`} style={styles.gluedAtom}>
            {atom.prefix ? (
              <Text style={[styles.baseText, scaledTextStyle]}>{atom.prefix}</Text>
            ) : null}
            <NativeMathFormula
              rendered={rendered}
              size={mathSize}
              scale={scale}
              color={String(flatStyle?.color ?? color)}
              maxWidth={maxMathWidth}
            />
            {atom.suffix ? (
              <Text style={[styles.baseText, scaledTextStyle]}>{atom.suffix}</Text>
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
    columnGap: 3.5,
    rowGap: 3,
    overflow: 'hidden',
  },
  inlineFlowCenter: {
    justifyContent: 'center',
  },
  gluedAtom: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    paddingHorizontal: 1,
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
