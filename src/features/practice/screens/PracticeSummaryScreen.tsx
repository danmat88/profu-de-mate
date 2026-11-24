import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
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
      mode: mode === 'ai' ? 'quick' : mode,
      category,
      formulaId,
    });
  };

  const startMistakesNow = () => {
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    beginAppTransition();
    navigation.replace('PracticeSession', { mode: 'mistakes' });
  };

  return (
    <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
      <ComicBackdrop />
      <ScreenHeader
        compact
        title="Rezultatul testului"
        eyebrow={`${correctCount} DIN ${totalCount} CORECTE · ${formatDuration(elapsedSeconds)}`}
        onBack={() => navigation.goBack()}
        rightIcon="trophy"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 18) + 22 },
        ]}
      >
        <View style={[styles.page, { maxWidth: contentWidth }]}>
          <View style={styles.heroCard}>
            <View style={styles.mascotStage}>
              <SpotlightAura size={138} tone={celebrate ? 'lime' : 'violet'} active={motionActive} />
              {celebrate ? <ConfettiBurst /> : null}
              <Mascot pose={celebrate ? 'cheer' : 'wave'} size={124} active={motionActive} interactive />
            </View>

            <Text style={styles.headline}>{headline}</Text>

            <View style={styles.statsRow}>
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

            {missedCount > 0 ? (
              <View style={styles.mistakesNotePill}>
                <Text style={styles.mistakesNoteText}>
                  {missedCount} {missedCount === 1 ? 'întrebare a intrat' : 'întrebări au intrat'} în Caiet → De repetat
                </Text>
              </View>
            ) : null}
          </View>

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
              <AppIcon name="practice" size={24} />
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
              <Text style={styles.backLinkText}>Înapoi la Teste & Practică</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {inspectQuestion ? (
        <ComicBottomSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
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
        </ComicBottomSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { flexGrow: 1, paddingTop: 4 },
  page: { width: '100%', alignSelf: 'center', gap: 16 },

  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    padding: 18,
    alignItems: 'center',
    gap: 12,
  },
  mascotStage: {
    width: 148,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headline: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 25,
    lineHeight: 29,
    textAlign: 'center',
  },
  statsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
  },
  statChip: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    backgroundColor: '#F7F2FF',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 2,
  },
  statChipLime: {
    backgroundColor: colors.limeSoft,
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
  mistakesNotePill: {
    borderRadius: radii.pill,
    backgroundColor: '#FFF1F3',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  mistakesNoteText: {
    fontFamily: fonts.bodyBold,
    color: colors.berryDeep,
    fontSize: 12,
    textAlign: 'center',
  },

  reviewSection: { gap: 9 },
  sectionKicker: {
    ...typography.kicker,
    fontSize: 10.5,
    color: colors.violetDeep,
  },
  reviewList: { gap: 8 },
  reviewCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 10,
  },
  reviewMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionsStack: { gap: 10 },
  repeatMistakesBtn: {
    minHeight: 52,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 109, 0.3)',
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
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 10,
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
    backgroundColor: 'rgba(124, 60, 255, 0.08)',
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
    borderWidth: 1,
    borderColor: '#D6F08A',
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
  pressed: { opacity: 0.78 },
});
