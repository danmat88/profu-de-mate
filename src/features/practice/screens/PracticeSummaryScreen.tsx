import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
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
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { SpotlightAura } from '../../../shared/ui/SpotlightAura';
import { Text } from '../../../shared/ui/Typography';
import { StudyInlineText } from '../../study/components/StudyInlineText';
import { StudyBlocksView } from '../../study/components/StudyRichContent';
import { getFormulaCategoryMeta } from '../../study/types';
import { getActiveStreakDays, usePracticeState } from '../services/practiceStorage';
import type { PracticeQuestion } from '../types';
import { getPracticeQuestionById } from '../utils/practiceEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'PracticeSummary'>;

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function PracticeSummaryScreen({ navigation, route }: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, contentWidth } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const motionActive = useScreenMotionActive(navigation, reducedMotion);
  const practiceState = usePracticeState();
  const { mode, category, formulaId, correctCount, totalCount, elapsedSeconds, answers } = route.params;

  const [inspectQuestion, setInspectQuestion] = useState<PracticeQuestion | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const percent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const celebrate = percent >= 60;
  const missedCount = totalCount - correctCount;
  const streakDays = getActiveStreakDays(practiceState);

  const headline = percent === 100
    ? 'Scor perfect!'
    : percent >= 80
      ? 'Super treabă!'
      : percent >= 60
        ? 'Ești pe drumul cel bun!'
        : 'Bun antrenament — continuă!';

  const startAnotherSession = () => {
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    beginAppTransition();
    navigation.replace('PracticeSession', {
      mode: mode === 'ai' || mode === 'mistakes' ? 'quick' : mode,
      category: mode === 'mistakes' ? undefined : category,
      formulaId: mode === 'mistakes' ? undefined : formulaId,
    });
  };

  const startMistakesNow = () => {
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    beginAppTransition();
    navigation.replace('PracticeSession', { mode: 'mistakes' });
  };

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      <ComicBackdrop />

      {/* Full-bleed curved Celebration Canopy */}
      <View style={[styles.canopy, { paddingTop: insets.top ?? 0 }]}>
        <LinearGradient
          colors={celebrate
            ? ['#823EFF', '#5A1EE0', '#380E9F']
            : ['#5B37E8', '#411EC2', '#2A1084']}
          start={{ x: 0.06, y: 0 }}
          end={{ x: 0.94, y: 1 }}
          style={styles.fill}
        />
        <View pointerEvents="none" style={styles.canopyGlowTop} />
        <View pointerEvents="none" style={styles.canopyGlowLime} />
        <View pointerEvents="none" style={styles.canopyOrbitArc} />
        <Text accessible={false} style={styles.canopyGlyphStar}>★</Text>
        <Text accessible={false} style={styles.canopyGlyphPi}>π</Text>

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
                Rezultatul <Text style={styles.canopyTitleAccent}>testului</Text>
              </Text>
              <View style={styles.canopyEyebrowRow}>
                <View style={styles.canopyEyebrowDot} />
                <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.canopyEyebrow}>
                  {correctCount} DIN {totalCount} CORECTE · {formatDuration(elapsedSeconds)}
                </Text>
              </View>
            </View>

            <View accessible={false} style={styles.canopyTrophyBadge}>
              <AppIcon name="trophy" size={24} />
            </View>
          </View>

          <View style={styles.canopyHeroRow}>
            <View style={styles.canopyHeroCopy}>
              <View style={styles.scorePercentPill}>
                <Text maxFontSizeMultiplier={1.15} style={styles.scorePercentText}>
                  {celebrate ? '★' : '✦'} {percent}% acuratețe
                </Text>
              </View>
              <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={styles.headline}>
                {headline}
              </Text>
            </View>

            <View style={styles.mascotStage}>
              <SpotlightAura size={92} tone="onViolet" active={motionActive} />
              {celebrate ? <ConfettiBurst /> : null}
              <Mascot pose={celebrate ? 'cheer' : 'wave'} size={86} active={motionActive} interactive />
            </View>
          </View>
        </View>
      </View>

      {/* Straddling 3D porcelain stats strip */}
      <View style={[styles.statsWrap, { paddingHorizontal: gutter }]}>
        <View style={[styles.statsRow, { maxWidth: contentWidth }]}>
          <View style={styles.statChip}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.statValue}>
              {correctCount}/{totalCount}
            </Text>
            <Text style={styles.statLabel}>Corecte ({percent}%)</Text>
          </View>
          <View style={styles.statChip}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.statValue}>
              {formatDuration(elapsedSeconds)}
            </Text>
            <Text style={styles.statLabel}>Timp</Text>
          </View>
          <View style={[styles.statChip, styles.statChipLime]}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.statValue}>
              🔥 {Math.max(1, streakDays)}
            </Text>
            <Text style={styles.statLabel}>{streakDays === 1 ? 'Zi serie' : 'Zile serie'}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 18) + 22 },
        ]}
      >
        <View style={[styles.page, { maxWidth: contentWidth }]}>
          {missedCount > 0 ? (
            <View style={styles.mistakesNotePill}>
              <Text style={styles.mistakesNoteText}>
                {missedCount} {missedCount === 1 ? 'întrebare a intrat' : 'întrebări au intrat'} în Caiet → De repetat
              </Text>
            </View>
          ) : null}

          <View style={styles.reviewSection}>
            <Text style={styles.sectionKicker}>SUMARUL ÎNTREBĂRILOR</Text>
            <View style={styles.reviewList}>
              {answers.map((item, idx) => {
                const cat = getFormulaCategoryMeta(item.category);
                const curated = getPracticeQuestionById(item.questionId);
                const canOpenFormula = !curated && Boolean(item.formulaId);
                const tappable = Boolean(curated || canOpenFormula);
                return (
                  <Pressable
                    key={`${item.questionId}-${idx}`}
                    accessibilityRole="button"
                    disabled={!tappable}
                    onPress={() => {
                      if (curated) {
                        Haptics.selection();
                        setInspectQuestion(curated);
                        setSheetOpen(true);
                        return;
                      }
                      if (item.formulaId) {
                        Haptics.selection();
                        beginAppTransition();
                        navigation.navigate('FormulaDetail', { formulaId: item.formulaId });
                      }
                    }}
                    style={({ pressed }) => [styles.reviewCard, pressed && tappable && styles.pressed]}
                  >
                    <View style={[styles.reviewMark, item.correct ? styles.reviewMarkOk : styles.reviewMarkBad]}>
                      <MiniGlyph
                        name={item.correct ? 'check' : 'wrong'}
                        size={13}
                        color={item.correct ? colors.ink : colors.paper}
                      />
                    </View>
                    <View style={styles.reviewCopy}>
                      <Text numberOfLines={2} style={styles.reviewTitle}>
                        {idx + 1}. {item.title}
                      </Text>
                      <StudyInlineText
                        text={item.correct
                          ? `${!curated ? '✦ AI · ' : ''}${cat.shortLabel} · Răspuns: ${item.correctAnswerLabel}`
                          : `${!curated ? '✦ AI · ' : ''}${cat.shortLabel} · Ai ales ${item.userAnswerLabel} · Corect: ${item.correctAnswerLabel}`}
                        scale={0.86}
                        color={colors.inkSoft}
                        textStyle={styles.reviewMeta}
                        maxMathWidth={180}
                      />
                    </View>
                    {tappable ? (
                      <View style={styles.reviewOpenBtn}>
                        <MiniGlyph name="next" size={14} color={colors.violetDeep} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.actionsStack}>
            {missedCount > 0 && practiceState.wrongQuestionIds.length > 0 ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Repetă acum întrebările greșite"
                pressedScale={0.97}
                haptic="medium"
                onPress={startMistakesNow}
                contentStyle={styles.repeatMistakesBtn}
              >
                <AppIcon name="retake" size={22} />
                <Text style={styles.repeatMistakesText}>Repetă greșelile acum</Text>
              </PressableScale>
            ) : null}

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Începe încă un test fulger"
              pressedScale={0.97}
              haptic="medium"
              onPress={startAnotherSession}
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
                <AppIcon name="practice" size={22} />
              </View>
              <Text style={styles.primaryBtnText}>Încă un test rapid</Text>
              <View style={styles.primaryArrow}>
                <MiniGlyph name="next" size={16} color={colors.paper} />
              </View>
            </PressableScale>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Înapoi"
              onPress={() => {
                Haptics.selection();
                beginAppTransition();
                navigation.goBack();
              }}
              style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}
            >
              <Text style={styles.backLinkText}>
                {mode === 'mistakes' ? 'Înapoi la De repetat' : mode === 'formula' ? 'Înapoi la formulă' : 'Înapoi'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {inspectQuestion ? (
        <ComicBottomSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onAfterClose={() => setInspectQuestion(null)}
          maxHeight="86%"
          sheetStyle={styles.sheetContainer}
        >
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderCopy}>
              <Text style={styles.sectionKicker}>EXPLICAȚIE PAS CU PAS</Text>
              <Text numberOfLines={2} style={styles.sheetTitle}>{inspectQuestion.title}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Închide explicația"
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
              <Text style={styles.sheetAnswerEyebrow}>RĂSPUNS CORECT</Text>
              <StudyInlineText
                text={inspectQuestion.answerDisplay}
                scale={1.08}
                textStyle={styles.sheetAnswerText}
                maxMathWidth={Math.max(220, contentWidth - 68)}
              />
            </View>

            <Text style={styles.sectionKicker}>ENUNȚ</Text>
            <StudyBlocksView
              blocks={inspectQuestion.prompt}
              maxWidth={Math.max(230, contentWidth - 52)}
            />

            <Text style={styles.sectionKicker}>REZOLVARE</Text>
            <StudyBlocksView
              blocks={inspectQuestion.explanation}
              maxWidth={Math.max(230, contentWidth - 52)}
            />
          </ScrollView>
          {practiceState.wrongQuestionIds.includes(inspectQuestion.id) ? (
            <View style={styles.sheetFooter}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Reia exercițiul ${inspectQuestion.title}`}
                pressedScale={0.97}
                haptic="medium"
                onPress={() => {
                  const targetId = inspectQuestion.id;
                  setSheetOpen(false);
                  setInspectQuestion(null);
                  beginAppTransition();
                  navigation.replace('PracticeSession', { mode: 'mistakes', questionId: targetId });
                }}
                contentStyle={styles.sheetRetryBtn}
              >
                <LinearGradient
                  colors={['#EDFF7A', '#D8FF3E', '#BCEF12']}
                  start={{ x: 0.08, y: 0 }}
                  end={{ x: 0.92, y: 1 }}
                  style={styles.fill}
                />
                <View pointerEvents="none" style={styles.ctaTopGloss} />
                <AppIcon name="retake" size={20} />
                <Text style={styles.sheetRetryText}>Reia acest exercițiu acum</Text>
              </PressableScale>
            </View>
          ) : null}
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
    paddingBottom: 38,
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
  canopyGlyphStar: {
    position: 'absolute',
    left: 24,
    bottom: 16,
    fontFamily: fonts.display,
    fontSize: 18,
    color: 'rgba(216, 255, 62, 0.28)',
  },
  canopyGlyphPi: {
    position: 'absolute',
    right: 112,
    bottom: 18,
    fontFamily: fonts.display,
    fontSize: 28,
    color: 'rgba(255, 255, 255, 0.12)',
    transform: [{ rotate: '-10deg' }],
  },
  canopyInner: {
    maxWidth: 560,
    alignSelf: 'center',
    paddingTop: 6,
    gap: 8,
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
    gap: 7,
  },
  scorePercentPill: {
    paddingHorizontal: 11,
    paddingVertical: 4.5,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
  },
  scorePercentText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 11.5,
    includeFontPadding: false,
  },
  mascotStage: {
    width: 96,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  headline: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 22,
    lineHeight: 26,
    textShadowColor: 'rgba(18, 6, 62, 0.28)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },

  statsWrap: {
    marginTop: -24,
    paddingBottom: 8,
    zIndex: 8,
    alignItems: 'center',
  },
  statsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
  },
  statChip: {
    flex: 1,
    minWidth: 0,
    borderRadius: 20,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 2,
  },
  statChipLime: {
    backgroundColor: '#F6FFD4',
    borderColor: '#DDF68E',
    borderBottomColor: '#B1D63D',
  },
  statValue: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 18,
    lineHeight: 22,
  },
  statLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.inkSoft,
    fontSize: 10.5,
    textAlign: 'center',
  },

  scrollContent: { flexGrow: 1, paddingTop: 4 },
  page: { width: '100%', alignSelf: 'center', gap: 15 },

  mistakesNotePill: {
    borderRadius: 18,
    borderWidth: 1.4,
    borderBottomWidth: 3.2,
    borderColor: '#FFD1DA',
    borderBottomColor: '#EE9FB0',
    backgroundColor: '#FFF2F5',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  mistakesNoteText: {
    fontFamily: fonts.bodyBold,
    color: colors.berryDeep,
    fontSize: 12.5,
    textAlign: 'center',
  },

  reviewSection: { gap: 9 },
  sectionKicker: {
    ...typography.kicker,
    fontSize: 10.5,
    color: colors.violetDeep,
  },
  reviewList: { gap: 9 },
  reviewCard: {
    borderRadius: 22,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 12,
    gap: 10,
  },
  reviewMark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewMarkOk: { backgroundColor: colors.lime },
  reviewMarkBad: { backgroundColor: colors.rose },
  reviewCopy: { flex: 1, minWidth: 0 },
  reviewTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 15.5,
    lineHeight: 19,
  },
  reviewMeta: {
    marginTop: 2,
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 12,
  },
  reviewOpenBtn: {
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
  repeatMistakesBtn: {
    minHeight: 52,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 3.8,
    borderColor: '#FFC5D0',
    borderBottomColor: '#E58A9D',
    backgroundColor: colors.roseSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    gap: 8,
  },
  repeatMistakesText: {
    flexShrink: 1,
    fontFamily: fonts.display,
    color: colors.berryDeep,
    fontSize: 16,
    textAlign: 'center',
  },
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
    height: '82%',
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
    paddingBottom: 22,
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
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
  },
  sheetFooter: {
    paddingTop: 10,
  },
  sheetRetryBtn: {
    minHeight: 50,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: '#E8FF78',
    borderBottomColor: '#7EA508',
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    overflow: 'hidden',
    position: 'relative',
  },
  sheetRetryText: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 16,
  },
  pressed: { opacity: 0.78 },
});
