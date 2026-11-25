import { memo, useMemo } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, radii } from '../../../shared/theme';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { Text } from '../../../shared/ui/Typography';
import { NativeMathFormula } from '../../math/components/NativeMathFormula';
import { getRenderedStudyMath } from '../data/renderedMath.generated';
import { getFormulaCategoryMeta, type FormulaEntry } from '../types';

type Props = {
  formula: FormulaEntry;
  isFavorite: boolean;
  compact?: boolean;
  onOpen: (formula: FormulaEntry) => void;
  onToggleFavorite: (formulaId: string) => void;
};

/**
 * Editorial formula card shared across StudyHub, FormulasScreen, and the
 * Favorite Formulas tab inside Caiet. Renders the clean primary MathJax Fira
 * SVG formula natively in Skia on Frame 0, strictly bounded within card margins.
 */
export const FormulaCard = memo(function FormulaCard({
  formula,
  isFavorite,
  compact = false,
  onOpen,
  onToggleFavorite,
}: Props) {
  const categoryMeta = getFormulaCategoryMeta(formula.category);
  const headlineLatex = formula.formulas?.[0]?.latex ?? formula.formulaLatex;
  const extraCount = formula.formulas && formula.formulas.length > 1
    ? formula.formulas.length - 1
    : 0;
  const renderedFormula = useMemo(
    () => getRenderedStudyMath(headlineLatex, 'display'),
    [headlineLatex],
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formula.title}. ${categoryMeta.shortLabel}. ${formula.formulaSpoken}`}
      onPress={() => {
        Keyboard.dismiss();
        Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
        onOpen(formula);
      }}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.rail, { backgroundColor: categoryMeta.accent }]} />

      <View style={[styles.body, compact && styles.bodyCompact]}>
        <View style={styles.metaRow}>
          <View style={styles.metaLeft}>
            <View style={[styles.catDot, { backgroundColor: categoryMeta.accent }]} />
            <Text numberOfLines={1} style={styles.catLabel}>
              {categoryMeta.shortLabel}
            </Text>
            {formula.examTag ? (
              <View collapsable={false} style={styles.examBadge}>
                <Text numberOfLines={1} style={styles.examBadgeText}>
                  {formula.examTag}
                </Text>
              </View>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? `Scoate ${formula.title} din favorite` : `Adaugă ${formula.title} la favorite`}
            accessibilityState={{ selected: isFavorite }}
            hitSlop={10}
            onPress={(event) => {
              event.stopPropagation();
              Keyboard.dismiss();
              Haptics.selection();
              onToggleFavorite(formula.id);
            }}
            style={({ pressed }) => [
              styles.starButton,
              isFavorite && styles.starButtonActive,
              pressed && styles.starPressed,
            ]}
          >
            <Text style={[styles.starGlyph, isFavorite && styles.starGlyphActive]}>
              {isFavorite ? '★' : '☆'}
            </Text>
          </Pressable>
        </View>

        <Text numberOfLines={2} style={[styles.title, compact && styles.titleCompact]}>
          {formula.title}
        </Text>

        <View style={styles.previewBox}>
          {renderedFormula ? (
            <NativeMathFormula
              rendered={renderedFormula}
              size="card"
              align="left"
            />
          ) : (
            <Text numberOfLines={2} style={styles.previewText}>
              {formula.preview}
            </Text>
          )}
        </View>

        {!compact ? (
          <View style={styles.footer}>
            <Text numberOfLines={1} style={styles.footerHint}>
              {extraCount > 0
                ? `+${extraCount} ${extraCount === 1 ? 'formulă' : 'formule'} · exemplu pas cu pas`
                : 'Fișă completă + exemplu pas cu pas'}
            </Text>
            <View style={styles.openArrow}>
              <MiniGlyph name="next" size={14} color={colors.violetDeep} />
            </View>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1.4,
    borderBottomWidth: 4,
    borderColor: '#E5DAFA',
    borderBottomColor: '#D4C2F8',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.94,
  },
  rail: {
    width: 4.5,
    alignSelf: 'stretch',
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 11,
  },
  bodyCompact: {
    paddingVertical: 11,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  catLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    includeFontPadding: false,
  },
  examBadge: {
    flexShrink: 1,
    minHeight: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  examBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    color: colors.limeDeep,
    letterSpacing: 0.3,
    includeFontPadding: false,
  },
  starButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(124, 60, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  starButtonActive: {
    backgroundColor: colors.goldSoft,
  },
  starPressed: {
    opacity: 0.72,
  },
  starGlyph: {
    fontFamily: fonts.display,
    fontSize: 16,
    lineHeight: 19,
    color: colors.inkMuted,
    includeFontPadding: false,
  },
  starGlyphActive: {
    color: '#B87400',
  },
  title: {
    marginTop: 5,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 21,
  },
  titleCompact: {
    fontSize: 16,
    lineHeight: 20,
  },
  previewBox: {
    marginTop: 8,
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECE4FA',
    backgroundColor: '#FAF8FF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewText: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 17.5,
  },
  footer: {
    marginTop: 9,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 60, 255, 0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  footerHint: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    color: colors.inkMuted,
  },
  openArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
