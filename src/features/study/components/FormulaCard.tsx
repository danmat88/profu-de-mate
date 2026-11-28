import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, radii } from '../../../shared/theme';
import { CachedInsetRelief, CachedOutsetShadow, CachedSurface, LIQUID_SHADOWS } from '../../../shared/ui/CachedRelief';
import { FavoriteStarButton } from '../../../shared/ui/FavoriteStarButton';
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
 * Favorite Formulas tab inside Caiet. Renders the final single-path MathJax
 * Fira SVG vector on Frame 0 (2 Fabric views total, zero text-to-SVG morph).
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
    <View style={styles.cardWrap}>
      <CachedOutsetShadow
        borderRadius={24}
        shadow={LIQUID_SHADOWS.cardOutsetSoft}
        padTop={10}
        padX={14}
        padBottom={18}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${formula.title}. ${categoryMeta.shortLabel}. ${formula.formulaSpoken}`}
        onPress={() => {
          Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
          onOpen(formula);
        }}
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
        ]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={['#FFFFFF', '#FBF8FF']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.fill}
        />
        <CachedInsetRelief borderRadius={23} shadow={LIQUID_SHADOWS.cardInsetSoft} zIndex={1} />
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

            <FavoriteStarButton
              active={isFavorite}
              variant="card"
              icon="star"
              stopPropagation
              accessibilityLabel={isFavorite ? `Scoate ${formula.title} din favorite` : `Adaugă ${formula.title} la favorite`}
              onPress={() => onToggleFavorite(formula.id)}
            />
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
                <CachedSurface
                  borderRadius={14}
                  backgroundColor={colors.violetSoft}
                  shadow={LIQUID_SHADOWS.orbSurface}
                  padTop={5}
                  padX={7}
                  padBottom={9}
                />
                <View style={styles.frontLayer}>
                  <MiniGlyph name="next" size={14} color={colors.violetDeep} />
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  cardWrap: {
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  frontLayer: {
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1.3,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.94,
  },
  rail: {
    width: 4.5,
    alignSelf: 'stretch',
    zIndex: 2,
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 11,
    zIndex: 2,
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
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.11)',
    backgroundColor: '#FAF7FF',
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
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
});
