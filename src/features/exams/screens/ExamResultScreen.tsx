import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { beginAppTransition } from '../../../shared/context/TransitionMotionContext';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { useScreenMotionActive } from '../../../shared/hooks/useTransitionSettled';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, radii, typography } from '../../../shared/theme';
import type { RootStackParamList } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicBottomSheet } from '../../../shared/ui/ComicBottomSheet';
import { ConfettiBurst } from '../../../shared/ui/ConfettiBurst';
import { IconButton } from '../../../shared/ui/IconButton';
import { LiquidProgressBar } from '../../../shared/ui/LiquidProgressBar';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { SpotlightAura } from '../../../shared/ui/SpotlightAura';
import { Text } from '../../../shared/ui/Typography';
import { StudyInlineText } from '../../study/components/StudyInlineText';
import { StudyBlocksView } from '../../study/components/StudyRichContent';
import { getExamGuide } from '../data/examGuidesCatalog';
import { getExamSimulationById } from '../data/examSimulationsCatalog';
import type { ExamSimulationItem } from '../types';
import {
  formatRomanianGrade,
  getScopeTitle,
} from '../utils/examEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'ExamResult'>;

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins} min`;
}

export function ExamResultScreen({ navigation, route }: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, contentWidth } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const motionActive = useScreenMotionActive(navigation, reducedMotion);
  const {
    variantId,
    examId,
    scope,
    officePoints,
    subjectPoints,
    awardedPoints,
    maxPoints,
    grade,
    elapsedSeconds,
    items,
  } = route.params;

  const [inspectItem, setInspectItem] = useState<ExamSimulationItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const guide = useMemo(() => getExamGuide(examId), [examId]);
  const variant = useMemo(() => getExamSimulationById(variantId), [variantId]);

  const percent = maxPoints > 0 ? Math.round((awardedPoints / maxPoints) * 100) : 0;
  const celebrate = grade !== null ? grade >= 7 : percent >= 70;
  const headline = grade !== null
    ? grade >= 9
      ? 'Notă de premiant!'
      : grade >= 7.5
        ? 'Rezultat foarte bun!'
        : grade >= 5
          ? 'Ai trecut pragul — poți și mai sus!'
          : 'Bună simulare — vezi baremul pe pași!'
    : percent >= 80
      ? 'Subiect stăpânit excelent!'
      : percent >= 50
        ? 'Antrenament solid!'
        : 'Revizuiește baremul și mai încearcă!';

  const handleRestart = () => {
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    beginAppTransition();
    navigation.replace('ExamSimulation', { variantId, scope });
  };

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      <ComicBackdrop />

      {/* Full-bleed curved Exam Result Celebration Canopy */}
      <View style={[styles.canopy, { paddingTop: insets.top ?? 0 }]}>
        <LinearGradient
          colors={celebrate
            ? ['#823EFF', '#5A1EE0', '#380E9F']
            : ['#4D2EE0', '#3518AC', '#230D75']}
          start={{ x: 0.06, y: 0 }}
          end={{ x: 0.94, y: 1 }}
          style={styles.fill}
        />
        <View pointerEvents="none" style={styles.canopyGlowTop} />
        <View pointerEvents="none" style={styles.canopyGlowLime} />
        <View pointerEvents="none" style={styles.canopyOrbitArc} />
        <Text accessible={false} style={styles.canopyGlyphSum}>∑</Text>
        <Text accessible={false} style={styles.canopyGlyphStar}>★</Text>

        <View style={[styles.canopyInner, { width: contentWidth }]}>
          <View style={styles.canopyRow}>
            <IconButton
              label="Înapoi"
              onPress={() => navigation.goBack()}
              size={42}
              style={styles.canopyActionBtn}
            >
              <MiniGlyph name="back" size={18} color={colors.violetDeep} />
            </IconButton>

            <View style={styles.canopyCopy}>
              <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={styles.canopyTitle}>
                Rezultat <Text style={styles.canopyTitleAccent}>simulare</Text>
              </Text>
              <View style={styles.canopyEyebrowRow}>
                <View style={styles.canopyEyebrowDot} />
                <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.canopyEyebrow}>
                  {guide.shortTitle} · {getScopeTitle(scope).toUpperCase()}
                </Text>
              </View>
            </View>

            <View accessible={false} style={styles.canopyTrophyBadge}>
              <AppIcon name="trophy" size={24} />
            </View>
          </View>

          <View style={styles.canopyHeroRow}>
            <View style={styles.canopyHeroCopy}>
              <View style={styles.gradeBadge}>
                <Text style={styles.gradeBadgeText}>
                  {grade !== null ? `Nota ${formatRomanianGrade(grade)}` : `${awardedPoints} / ${maxPoints}p`}
                </Text>
              </View>
              <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={styles.headline}>
                {headline}
              </Text>
              <Text numberOfLines={2} style={styles.subSummary}>
                {awardedPoints} din {maxPoints} puncte ({percent}%) · Timp: {formatElapsed(elapsedSeconds)}
              </Text>
            </View>

            <View style={styles.mascotStage}>
              <SpotlightAura size={94} tone="onViolet" active={motionActive} />
              {celebrate ? <ConfettiBurst /> : null}
              <Mascot pose={celebrate ? 'cheer' : 'wave'} size={88} active={motionActive} interactive />
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 18) + 24 },
        ]}
      >
        <View style={[styles.page, { maxWidth: contentWidth }]}>
          {scope === 'full' ? (
            <View style={styles.breakdownCard}>
              <View pointerEvents="none" style={styles.cardTopGloss} />
              <Text style={styles.sectionKicker}>DISTRIBUȚIA PUNCTAJULUI</Text>

              <View style={styles.breakdownBox}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Din oficiu</Text>
                  <Text style={styles.breakdownPts}>{officePoints} / 10p</Text>
                </View>
                <LiquidProgressBar progress={1} height={6} tone="lime" shimmer={false} />

                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Subiectul I</Text>
                  <Text style={styles.breakdownPts}>{subjectPoints.s1} / 30p</Text>
                </View>
                <LiquidProgressBar progress={Math.max(0.04, subjectPoints.s1 / 30)} height={6} tone="studio" shimmer={false} />

                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Subiectul II</Text>
                  <Text style={styles.breakdownPts}>{subjectPoints.s2} / 30p</Text>
                </View>
                <LiquidProgressBar progress={Math.max(0.04, subjectPoints.s2 / 30)} height={6} tone="studio" shimmer={false} />

                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Subiectul III</Text>
                  <Text style={styles.breakdownPts}>{subjectPoints.s3} / 30p</Text>
                </View>
                <LiquidProgressBar progress={Math.max(0.04, subjectPoints.s3 / 30)} height={6} tone="warm" shimmer={false} />
              </View>
            </View>
          ) : null}

          <View style={styles.itemsSection}>
            <Text style={styles.sectionKicker}>PUNCTAJ PE FIECARE ITEM (ATINGE PENTRU BAREM)</Text>
            <View style={styles.itemsList}>
              {items.map((entry) => {
                const fullScore = entry.awardedPoints >= entry.maxPoints;
                const partialScore = entry.awardedPoints > 0 && !fullScore;
                const fullItem = variant?.items.find((it) => it.id === entry.itemId);
                return (
                  <Pressable
                    key={entry.itemId}
                    accessibilityRole="button"
                    disabled={!fullItem}
                    onPress={() => {
                      if (!fullItem) return;
                      Haptics.selection();
                      setInspectItem(fullItem);
                      setSheetOpen(true);
                    }}
                    style={({ pressed }) => [styles.itemRow, pressed && styles.pressed]}
                  >
                    <View style={[
                      styles.scorePill,
                      fullScore && styles.scorePillFull,
                      partialScore && styles.scorePillPartial,
                    ]}>
                      <Text style={[
                        styles.scorePillText,
                        fullScore && styles.scorePillTextFull,
                        partialScore && styles.scorePillTextPartial,
                      ]}>
                        {entry.awardedPoints}/{entry.maxPoints}p
                      </Text>
                    </View>
                    <View style={styles.itemCopy}>
                      <Text numberOfLines={1} style={styles.itemLabel}>{entry.numberLabel}</Text>
                      <Text numberOfLines={1} style={styles.itemTitle}>{entry.title}</Text>
                    </View>
                    <View style={styles.itemArrow}>
                      <MiniGlyph name="next" size={14} color={colors.violetDeep} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.actionsStack}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Reia simularea de la început"
              pressedScale={0.97}
              haptic="medium"
              onPress={handleRestart}
              contentStyle={styles.primaryBtn}
            >
              <LinearGradient
                colors={['#EDFF7A', '#D8FF3E', '#BCEF12']}
                start={{ x: 0.08, y: 0 }}
                end={{ x: 0.92, y: 1 }}
                style={styles.fill}
              />
              <View pointerEvents="none" style={styles.ctaTopGloss} />
              <View style={styles.primaryCtaBadge}>
                <AppIcon name="retake" size={22} />
              </View>
              <Text style={styles.primaryBtnText}>Reia simularea</Text>
              <View style={styles.primaryArrow}>
                <MiniGlyph name="next" size={16} color={colors.paper} />
              </View>
            </PressableScale>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Înapoi la Examene"
              onPress={() => {
                Haptics.selection();
                beginAppTransition();
                navigation.goBack();
              }}
              style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}
            >
              <Text style={styles.backLinkText}>Înapoi la Examene EN & BAC</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {inspectItem ? (
        <ComicBottomSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          maxHeight="88%"
          sheetStyle={styles.sheetContainer}
        >
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderCopy}>
              <Text style={styles.sectionKicker}>{inspectItem.numberLabel} · BAREM OFICIAL ({inspectItem.maxPoints}p)</Text>
              <Text numberOfLines={2} style={styles.sheetTitle}>{inspectItem.title}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Închide baremul"
              hitSlop={8}
              onPress={() => {
                Haptics.selection();
                setSheetOpen(false);
              }}
              style={({ pressed }) => [styles.sheetCloseBtn, pressed && styles.pressed]}
            >
              <MiniGlyph name="close" size={16} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetScrollBody}
          >
            <View style={styles.sheetAnswerCard}>
              <Text style={styles.sheetAnswerEyebrow}>RĂSPUNS OFICIAL</Text>
              <StudyInlineText
                text={inspectItem.answerDisplay}
                scale={1.04}
                textStyle={styles.sheetAnswerText}
                maxMathWidth={Math.max(220, contentWidth - 68)}
              />
            </View>

            <Text style={styles.sectionKicker}>REZOLVARE MODEL PAS CU PAS</Text>
            <StudyBlocksView
              blocks={inspectItem.solution}
              maxWidth={Math.max(230, contentWidth - 52)}
            />

            {inspectItem.rubric && inspectItem.rubric.length > 0 ? (
              <View style={styles.rubricListBox}>
                <Text style={styles.sectionKicker}>PUNCTAJ PE ETAPE</Text>
                {inspectItem.rubric.map((step) => (
                  <View key={step.id} style={styles.rubricStepRow}>
                    <View style={styles.rubricStepPts}>
                      <Text style={styles.rubricStepPtsText}>{step.points}p</Text>
                    </View>
                    <View style={styles.rubricStepBody}>
                      <StudyInlineText
                        text={step.step}
                        scale={0.95}
                        maxMathWidth={Math.max(190, contentWidth - 110)}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </ComicBottomSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },

  canopy: {
    width: '100%',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    paddingBottom: 20,
    position: 'relative',
    zIndex: 4,
  },
  canopyGlowTop: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -80,
    right: -45,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  canopyGlowLime: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    bottom: -70,
    left: -35,
    backgroundColor: 'rgba(216, 255, 62, 0.16)',
  },
  canopyOrbitArc: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    top: -120,
    right: -85,
  },
  canopyGlyphSum: {
    position: 'absolute',
    right: 112,
    bottom: 14,
    fontFamily: fonts.display,
    fontSize: 28,
    color: 'rgba(255, 255, 255, 0.12)',
    transform: [{ rotate: '-10deg' }],
  },
  canopyGlyphStar: {
    position: 'absolute',
    left: 24,
    bottom: 12,
    fontFamily: fonts.display,
    fontSize: 18,
    color: 'rgba(216, 255, 62, 0.28)',
  },
  canopyInner: {
    maxWidth: 560,
    alignSelf: 'center',
    paddingTop: 6,
    gap: 10,
  },
  canopyRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  canopyActionBtn: {
    borderRadius: 21,
    borderBottomWidth: 3.5,
    borderBottomColor: '#C5B8FA',
    backgroundColor: '#FFFFFF',
  },
  canopyCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  canopyTitle: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(18, 6, 62, 0.28)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },
  canopyTitleAccent: {
    color: colors.lime,
  },
  canopyEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  canopyEyebrowDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
    backgroundColor: colors.lime,
  },
  canopyEyebrow: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: 'rgba(242, 240, 255, 0.92)',
    fontSize: 10,
    letterSpacing: 0.85,
    includeFontPadding: false,
  },
  canopyTrophyBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderBottomWidth: 3.5,
    borderColor: colors.lime,
    borderBottomColor: '#98C40E',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  canopyHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  canopyHeroCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
    gap: 6,
  },
  mascotStage: {
    width: 98,
    height: 94,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  gradeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#ECFF8A',
    borderBottomColor: '#8BB509',
    backgroundColor: colors.lime,
  },
  gradeBadgeText: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 21,
    lineHeight: 25,
  },
  headline: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 19,
    lineHeight: 23,
    textShadowColor: 'rgba(18, 6, 62, 0.28)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },
  subSummary: {
    fontFamily: fonts.bodyBold,
    color: 'rgba(242, 240, 255, 0.9)',
    fontSize: 12,
    lineHeight: 16.5,
  },

  scrollContent: { flexGrow: 1, paddingTop: 14 },
  page: { width: '100%', alignSelf: 'center', gap: 16 },

  breakdownCard: {
    borderRadius: 26,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  cardTopGloss: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  breakdownBox: {
    width: '100%',
    padding: 13,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#ECE4FC',
    backgroundColor: '#F8F4FF',
    gap: 7,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  breakdownLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 12.5,
  },
  breakdownPts: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 12.5,
  },

  itemsSection: { gap: 9 },
  sectionKicker: {
    ...typography.kicker,
    fontSize: 10,
    color: colors.violetDeep,
  },
  itemsList: { gap: 9 },
  itemRow: {
    borderRadius: 22,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 11,
  },
  scorePill: {
    minWidth: 56,
    minHeight: 34,
    borderRadius: radii.pill,
    borderWidth: 1.2,
    borderBottomWidth: 2.8,
    borderColor: '#FFC8D3',
    borderBottomColor: '#E691A2',
    backgroundColor: colors.roseSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  scorePillFull: {
    backgroundColor: colors.lime,
    borderColor: '#E8FF78',
    borderBottomColor: '#98C40E',
  },
  scorePillPartial: {
    backgroundColor: colors.goldSoft,
    borderColor: '#FBE08A',
    borderBottomColor: '#DDB038',
  },
  scorePillText: {
    fontFamily: fonts.bodyBold,
    color: colors.berryDeep,
    fontSize: 11.5,
    includeFontPadding: false,
  },
  scorePillTextFull: { color: colors.ink },
  scorePillTextPartial: { color: '#7D4E00' },
  itemCopy: { flex: 1, minWidth: 0 },
  itemLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.inkMuted,
    fontSize: 10.5,
  },
  itemTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 15.5,
    lineHeight: 19,
  },
  itemArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.2,
    borderBottomWidth: 2.5,
    borderColor: '#E2D6FF',
    borderBottomColor: '#C8B5FA',
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionsStack: { gap: 10 },
  primaryBtn: {
    minHeight: 54,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderBottomWidth: 4.5,
    borderColor: '#E8FF78',
    borderBottomColor: '#7EA508',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  ctaTopGloss: {
    position: 'absolute',
    top: 2,
    left: 22,
    right: 22,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  primaryCtaBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  primaryBtnText: {
    flex: 1,
    flexShrink: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 21,
  },
  primaryArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  backLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLinkText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 13.5,
  },

  sheetContainer: {
    height: '84%',
    paddingHorizontal: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sheetHeaderCopy: { flex: 1, minWidth: 0 },
  sheetTitle: {
    marginTop: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 18,
    lineHeight: 22,
  },
  sheetCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.3,
    borderBottomWidth: 3,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScrollBody: {
    paddingTop: 4,
    paddingBottom: 20,
    gap: 14,
  },
  sheetAnswerCard: {
    borderRadius: 18,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#D6F08A',
    borderBottomColor: '#AED442',
    backgroundColor: '#F5FFD6',
    padding: 13,
    gap: 4,
  },
  sheetAnswerEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.8,
    color: colors.limeDeep,
  },
  sheetAnswerText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  rubricListBox: {
    gap: 8,
    paddingTop: 4,
  },
  rubricStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1.2,
    borderBottomWidth: 2.5,
    borderColor: '#ECE4FC',
    borderBottomColor: '#D8CAF8',
    backgroundColor: '#FAF8FF',
    padding: 11,
  },
  rubricStepPts: {
    minWidth: 34,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rubricStepPtsText: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: colors.violetDeep,
  },
  rubricStepBody: {
    flex: 1,
    paddingTop: 1,
  },
  pressed: { opacity: 0.78 },
});
