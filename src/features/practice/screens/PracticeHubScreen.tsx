import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { beginAppTransition } from '../../../shared/context/TransitionMotionContext';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { useScreenMotionActive } from '../../../shared/hooks/useTransitionSettled';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, radii, typography } from '../../../shared/theme';
import type {
  AiPracticeExercisePayload,
  RootStackParamList,
  StudyFormulaCategoryParam,
} from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { LiquidProgressBar } from '../../../shared/ui/LiquidProgressBar';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { SpotlightAura } from '../../../shared/ui/SpotlightAura';
import { Text } from '../../../shared/ui/Typography';
import { StudyTrackSheet } from '../../study/components/StudyTrackSheet';
import { setStudyTrack, useStudyProfile } from '../../study/services/studyStorage';
import { getStudyTrackMeta, type StudyTrackId } from '../../study/types';
import { AiPracticeSheet } from '../components/AiPracticeSheet';
import { PRACTICE_BANK } from '../data/practiceBank';
import { getActiveStreakDays, usePracticeState } from '../services/practiceStorage';
import { computeCategoryStats } from '../utils/practiceEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'PracticeHub'>;

export function PracticeHubScreen({ navigation }: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, contentWidth } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const motionActive = useScreenMotionActive(navigation, reducedMotion);
  const studyProfile = useStudyProfile();
  const practiceState = usePracticeState();

  const [trackSheetOpen, setTrackSheetOpen] = useState(false);
  const [trackSheetEverOpened, setTrackSheetEverOpened] = useState(false);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [aiSheetEverOpened, setAiSheetEverOpened] = useState(false);
  const navLockRef = useRef(false);

  useFocusEffect(useCallback(() => {
    navLockRef.current = false;
  }, []));

  const trackMeta = getStudyTrackMeta(studyProfile.track);
  const streakDays = getActiveStreakDays(practiceState);

  const categoryStats = useMemo(
    () => computeCategoryStats(
      PRACTICE_BANK,
      studyProfile.track,
      practiceState.masteredQuestionIds,
      practiceState.wrongQuestionIds,
    ),
    [practiceState.masteredQuestionIds, practiceState.wrongQuestionIds, studyProfile.track],
  );

  const trackTotals = useMemo(() => {
    let total = 0;
    let mastered = 0;
    for (const stat of categoryStats) {
      total += stat.total;
      mastered += stat.mastered;
    }
    return { total, mastered, ratio: total > 0 ? mastered / total : 0 };
  }, [categoryStats]);

  const wrongCount = practiceState.wrongQuestionIds.length;
  const accuracyPercent = practiceState.totalAnswered > 0
    ? Math.round((practiceState.totalCorrect / practiceState.totalAnswered) * 100)
    : null;

  const openTrackPicker = () => {
    Haptics.selection();
    setTrackSheetEverOpened(true);
    setTrackSheetOpen(true);
  };

  const openAiGenerator = () => {
    Haptics.selection();
    setAiSheetEverOpened(true);
    setAiSheetOpen(true);
  };

  const handleSelectTrack = useCallback((next: StudyTrackId) => {
    setStudyTrack(next);
  }, []);

  const startQuickTest = useCallback(() => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    beginAppTransition();
    navigation.navigate('PracticeSession', { mode: 'quick' });
  }, [navigation]);

  const startMistakesReview = useCallback(() => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    beginAppTransition();
    navigation.navigate('PracticeSession', { mode: 'mistakes' });
  }, [navigation]);

  const startCategoryPractice = useCallback((category: StudyFormulaCategoryParam) => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    Haptics.selection();
    beginAppTransition();
    navigation.navigate('PracticeSession', { mode: 'category', category });
  }, [navigation]);

  const handleAiGenerated = useCallback((exercise: AiPracticeExercisePayload) => {
    beginAppTransition();
    navigation.navigate('PracticeSession', {
      mode: 'ai',
      category: exercise.category,
      aiExercise: exercise,
    });
  }, [navigation]);

  return (
    <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
      <ComicBackdrop />
      <ScreenHeader
        compact
        title="Teste & Practică"
        eyebrow={`${trackMeta.shortLabel.toUpperCase()} · ${trackTotals.mastered}/${trackTotals.total} STĂPÂNITE`}
        onBack={() => navigation.goBack()}
        rightIcon="class"
        rightLabel="Schimbă nivelul de studiu"
        onRight={openTrackPicker}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 18) + 24 },
        ]}
      >
        <View style={[styles.page, { maxWidth: contentWidth }]}>
          <View style={styles.heroShadow}>
            <View style={styles.heroCard}>
              <LinearGradient
                colors={['#8D50FF', '#6222E6', '#3E11A8']}
                start={{ x: 0.08, y: 0 }}
                end={{ x: 0.92, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View pointerEvents="none" style={styles.heroGlow} />
              <View pointerEvents="none" style={styles.heroTopShine} />

              <View style={styles.heroTopRow}>
                <View style={styles.streakPill}>
                  <AppIcon name="streak" size={16} />
                  <Text style={styles.streakText}>
                    {streakDays > 0
                      ? `${streakDays} ${streakDays === 1 ? 'zi' : 'zile'} la rând`
                      : 'Începe seria de azi'}
                  </Text>
                </View>

                {accuracyPercent !== null ? (
                  <View style={styles.accuracyPill}>
                    <Text style={styles.accuracyText}>★ {accuracyPercent}% acuratețe</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.heroMainRow}>
                <View style={styles.heroMascotWrap}>
                  <SpotlightAura size={78} tone="lime" active={motionActive} />
                  <Mascot pose="point" size={80} active={motionActive} />
                </View>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroTitle}>Test fulger · 5 întrebări</Text>
                  <Text style={styles.heroSubtitle}>
                    Grilă + răspuns scurt pentru {trackMeta.shortLabel}. Instant, offline și cu explicații pas cu pas.
                  </Text>
                </View>
              </View>

              <View style={styles.heroProgressWrap}>
                <View style={styles.heroProgressHeader}>
                  <Text style={styles.heroProgressLabel}>Progres {trackMeta.shortLabel}</Text>
                  <Text style={styles.heroProgressValue}>
                    {trackTotals.mastered} din {trackTotals.total} rezolvate
                  </Text>
                </View>
                <LiquidProgressBar
                  progress={Math.max(trackTotals.ratio, trackTotals.mastered > 0 ? 0.1 : 0.06)}
                  height={8}
                  tone="dark"
                  shimmer={motionActive}
                  active={motionActive}
                />
              </View>

              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Începe testul fulger de 5 întrebări"
                pressedScale={0.97}
                haptic="medium"
                onPress={startQuickTest}
                contentStyle={styles.heroCta}
              >
                <View style={styles.heroCtaBadge}>
                  <AppIcon name="practice" size={24} />
                </View>
                <Text style={styles.heroCtaText}>Începe testul fulger</Text>
                <View style={styles.heroCtaArrow}>
                  <MiniGlyph name="next" size={16} color={colors.paper} />
                </View>
              </PressableScale>
            </View>
          </View>

          {wrongCount > 0 ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Repetă cele ${wrongCount} întrebări greșite`}
              pressedScale={0.975}
              haptic="light"
              onPress={startMistakesReview}
              contentStyle={styles.mistakesCard}
            >
              <View style={styles.mistakesRail} />
              <View style={styles.mistakesIcon}>
                <AppIcon name="retake" size={28} />
              </View>
              <View style={styles.mistakesCopy}>
                <View style={styles.mistakesHeader}>
                  <Text style={styles.mistakesTitle}>De repetat</Text>
                  <View style={styles.mistakesCountBadge}>
                    <Text style={styles.mistakesCountText}>
                      {wrongCount} {wrongCount === 1 ? 'întrebare' : 'întrebări'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.mistakesNote}>
                  Reia greșelile din testele anterioare — dispar automat când le rezolvi corect!
                </Text>
              </View>
              <View style={styles.mistakesArrow}>
                <MiniGlyph name="next" size={16} color={colors.berryDeep} />
              </View>
            </PressableScale>
          ) : null}

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Generează un exercițiu nou personalizat cu Profu AI"
            pressedScale={0.975}
            haptic="light"
            onPress={openAiGenerator}
            contentStyle={styles.aiCard}
          >
            <View style={styles.aiIcon}>
              <AppIcon name="hint" size={28} />
            </View>
            <View style={styles.aiCopy}>
              <View style={styles.aiTagRow}>
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>✦ PROFU’ AI</Text>
                </View>
                <Text style={styles.aiSubMeta}>Personalizat pe capitol</Text>
              </View>
              <Text style={styles.aiTitle}>Generează un exercițiu nou</Text>
              <Text style={styles.aiNote}>
                Alegi capitolul și dificultatea (Ușor · Mediu · Examen) și primești un item original cu rezolvare.
              </Text>
            </View>
            <View style={styles.aiArrow}>
              <MiniGlyph name="next" size={16} color={colors.violetDeep} />
            </View>
          </PressableScale>

          <View style={styles.chaptersBlock}>
            <Text style={styles.sectionKicker}>ANTRENAMENT PE CAPITOLE</Text>
            <View style={styles.chaptersList}>
              {categoryStats.map((stat) => {
                const ratio = stat.total > 0 ? stat.mastered / stat.total : 0;
                return (
                  <Pressable
                    key={stat.categoryId}
                    accessibilityRole="button"
                    accessibilityLabel={`Antrenament la ${stat.label}: ${stat.mastered} din ${stat.total} stăpânite`}
                    onPress={() => startCategoryPractice(stat.categoryId)}
                    style={({ pressed }) => [styles.chapterCard, pressed && styles.pressed]}
                  >
                    <View style={[styles.chapterRail, { backgroundColor: stat.accent }]} />
                    <View style={styles.chapterBody}>
                      <View style={styles.chapterHeader}>
                        <Text numberOfLines={1} style={styles.chapterTitle}>{stat.label}</Text>
                        <Text style={styles.chapterRatio}>
                          {stat.mastered}/{stat.total}
                        </Text>
                      </View>
                      <LiquidProgressBar
                        progress={Math.max(ratio, stat.mastered > 0 ? 0.12 : 0.04)}
                        height={6}
                        tone="studio"
                        shimmer={false}
                        active={motionActive}
                      />
                      <View style={styles.chapterFooter}>
                        <Text style={styles.chapterMeta}>
                          {stat.wrong > 0
                            ? `${stat.wrong} de repetat · ${stat.total} exerciții`
                            : `${stat.total} ${stat.total === 1 ? 'exercițiu' : 'exerciții'} disponibile`}
                        </Text>
                        <Text style={styles.chapterStartText}>Exersează →</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      {trackSheetEverOpened ? (
        <StudyTrackSheet
          visible={trackSheetOpen}
          selectedTrack={studyProfile.track}
          onSelect={handleSelectTrack}
          onClose={() => setTrackSheetOpen(false)}
        />
      ) : null}

      {aiSheetEverOpened ? (
        <AiPracticeSheet
          visible={aiSheetOpen}
          track={studyProfile.track}
          onGenerated={handleAiGenerated}
          onClose={() => setAiSheetOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { flexGrow: 1, paddingTop: 4 },
  page: { width: '100%', alignSelf: 'center', gap: 14 },

  heroShadow: {
    borderRadius: 30,
    elevation: 6,
    shadowColor: '#4B1FB8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  heroCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    padding: 16,
    gap: 13,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -100,
    right: -60,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  heroTopShine: {
    position: 'absolute',
    top: 0,
    left: 26,
    right: 26,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(18, 12, 46, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  streakText: {
    fontFamily: fonts.bodyBold,
    color: colors.lime,
    fontSize: 11,
    includeFontPadding: false,
  },
  accuracyPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  accuracyText: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 11,
    includeFontPadding: false,
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroMascotWrap: {
    width: 82,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroCopy: { flex: 1, minWidth: 0, gap: 4 },
  heroTitle: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 21,
    lineHeight: 25,
  },
  heroSubtitle: {
    fontFamily: fonts.bodyMedium,
    color: 'rgba(244, 238, 255, 0.9)',
    fontSize: 12.5,
    lineHeight: 17,
  },
  heroProgressWrap: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(18, 12, 46, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    gap: 7,
  },
  heroProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroProgressLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 11.5,
  },
  heroProgressValue: {
    fontFamily: fonts.bodyBold,
    color: colors.lime,
    fontSize: 11.5,
  },
  heroCta: {
    minHeight: 54,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 10,
  },
  heroCtaBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroCtaText: {
    flex: 1,
    flexShrink: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 21,
  },
  heroCtaArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  mistakesCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 109, 0.22)',
    backgroundColor: '#FFF5F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 13,
    gap: 11,
    overflow: 'hidden',
  },
  mistakesRail: {
    width: 5,
    alignSelf: 'stretch',
    backgroundColor: colors.rose,
  },
  mistakesIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: colors.roseSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mistakesCopy: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
  },
  mistakesHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
  },
  mistakesTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 21,
  },
  mistakesCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.rose,
  },
  mistakesCountText: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 10,
    includeFontPadding: false,
  },
  mistakesNote: {
    marginTop: 2,
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 16.5,
  },
  mistakesArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.roseSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  aiCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    gap: 11,
  },
  aiIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  aiCopy: { flex: 1, minWidth: 0 },
  aiTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
  },
  aiBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
  },
  aiBadgeText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 9.5,
    letterSpacing: 0.4,
    includeFontPadding: false,
  },
  aiSubMeta: {
    fontFamily: fonts.bodyBold,
    color: colors.inkMuted,
    fontSize: 10.5,
  },
  aiTitle: {
    marginTop: 4,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 20.5,
  },
  aiNote: {
    marginTop: 2,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 16.5,
  },
  aiArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chaptersBlock: { gap: 9 },
  sectionKicker: {
    ...typography.kicker,
    fontSize: 10.5,
    color: colors.violetDeep,
  },
  chaptersList: { gap: 10 },
  chapterCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  chapterRail: {
    width: 4.5,
    alignSelf: 'stretch',
  },
  chapterBody: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chapterTitle: {
    flex: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 16.5,
    lineHeight: 20,
  },
  chapterRatio: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 12.5,
  },
  chapterFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chapterMeta: {
    flex: 1,
    flexShrink: 1,
    fontFamily: fonts.bodyMedium,
    color: colors.inkMuted,
    fontSize: 11.5,
  },
  chapterStartText: {
    fontFamily: fonts.bodyBold,
    color: colors.violet,
    fontSize: 12,
  },
  pressed: { opacity: 0.78 },
});
