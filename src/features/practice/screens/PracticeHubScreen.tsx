import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
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
import { IconButton } from '../../../shared/ui/IconButton';
import { LiquidProgressBar } from '../../../shared/ui/LiquidProgressBar';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { SpotlightAura } from '../../../shared/ui/SpotlightAura';
import { Text } from '../../../shared/ui/Typography';
import { formatRoCount } from '../../../shared/utils/romanianGrammar';
import { StudyTrackSheet } from '../../study/components/StudyTrackSheet';
import { setStudyTrack, useStudyProfile } from '../../study/services/studyStorage';
import { getStudyTrackMeta, type StudyTrackId } from '../../study/types';
import { AiPracticeSheet } from '../components/AiPracticeSheet';
import { StreakInfoSheet } from '../components/StreakInfoSheet';
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
  const [streakSheetOpen, setStreakSheetOpen] = useState(false);
  const [streakSheetEverOpened, setStreakSheetEverOpened] = useState(false);
  const navLockRef = useRef(false);

  useFocusEffect(useCallback(() => {
    navLockRef.current = false;
  }, []));

  const trackMeta = getStudyTrackMeta(studyProfile.track);
  const streakDays = getActiveStreakDays(practiceState);

  const categoryStats = useMemo(
    () => computeCategoryStats(
      PRACTICE_BANK,
      studyProfile.hasChosenTrack ? studyProfile.track : null,
      practiceState.masteredQuestionIds,
      practiceState.wrongQuestionIds,
    ),
    [practiceState.masteredQuestionIds, practiceState.wrongQuestionIds, studyProfile.hasChosenTrack, studyProfile.track],
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

  const openStreakSheet = () => {
    Haptics.selection();
    setStreakSheetEverOpened(true);
    setStreakSheetOpen(true);
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
    <View style={styles.safe}>
      <StatusBar style="light" />
      <ComicBackdrop />

      {/* Full-bleed curved Royal-Violet practice arena canopy */}
      <View style={[styles.canopy, { paddingTop: insets.top ?? 0 }]}>
        <LinearGradient
          colors={['#8F4BFF', '#6822EE', '#4B15C2', '#350D94']}
          start={{ x: 0.06, y: 0 }}
          end={{ x: 0.94, y: 1 }}
          style={styles.fill}
        />
        <View pointerEvents="none" style={styles.canopyGlowCyan} />
        <View pointerEvents="none" style={styles.canopyGlowLime} />
        <View pointerEvents="none" style={styles.canopyOrbitArc} />
        <Text accessible={false} style={styles.canopyGlyphDelta}>∆</Text>
        <Text accessible={false} style={styles.canopyStar}>✦</Text>

        <View style={[styles.canopyInner, { width: contentWidth }]}>
          <View style={styles.canopyHeaderRow}>
            <IconButton
              label="Înapoi"
              onPress={() => navigation.goBack()}
              size={42}
              style={styles.canopyActionBtn}
            >
              <MiniGlyph name="back" size={18} color={colors.violetDeep} />
            </IconButton>

            <View style={styles.canopyTitleCopy}>
              <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={styles.canopyTitle}>
                Teste <Text style={styles.canopyTitleAccent}>&amp; Practică</Text>
              </Text>
              <View style={styles.canopyEyebrowRow}>
                <View style={styles.canopyEyebrowDot} />
                <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.canopyEyebrow}>
                  {`${studyProfile.hasChosenTrack ? trackMeta.shortLabel.toUpperCase() : 'TOATĂ PROGRAMA'} · ${trackTotals.mastered}/${trackTotals.total} STĂPÂNITE`}
                </Text>
              </View>
            </View>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={studyProfile.hasChosenTrack ? 'Schimbă nivelul de studiu' : 'Alege nivelul de studiu'}
              pressedScale={0.95}
              haptic="selection"
              onPress={openTrackPicker}
              contentStyle={[styles.trackPill, !studyProfile.hasChosenTrack && styles.trackPillUnchosen]}
            >
              <View style={[styles.trackPillDot, !studyProfile.hasChosenTrack && styles.trackPillDotUnchosen]} />
              <Text
                maxFontSizeMultiplier={1.15}
                numberOfLines={1}
                style={[styles.trackPillText, !studyProfile.hasChosenTrack && styles.trackPillTextUnchosen]}
              >
                {studyProfile.hasChosenTrack ? `${trackMeta.shortLabel} ▾` : 'Nivel ▾'}
              </Text>
            </PressableScale>
          </View>

          <View style={styles.canopyHeroRow}>
            <View style={styles.canopyHeroCopy}>
              <View style={styles.canopyPillsRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Vezi detalii despre seria ta zilnică"
                  hitSlop={6}
                  onPress={openStreakSheet}
                  style={({ pressed }) => [styles.streakPill, pressed && styles.pressed]}
                >
                  <AppIcon name="streak" size={15} />
                  <Text maxFontSizeMultiplier={1.1} style={styles.streakText}>
                    {streakDays > 0
                      ? `${streakDays} ${streakDays === 1 ? 'zi' : 'zile'} la rând`
                      : 'Seria de azi'} ›
                  </Text>
                </Pressable>
                {accuracyPercent !== null ? (
                  <View style={styles.accuracyPill}>
                    <Text maxFontSizeMultiplier={1.1} style={styles.accuracyText}>
                      ★ {accuracyPercent}%
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.canopyProgressWrap}>
                <View style={styles.heroProgressHeader}>
                  <Text style={styles.heroProgressLabel}>
                    {studyProfile.hasChosenTrack ? `Progres ${trackMeta.shortLabel}` : 'Progres general'}
                  </Text>
                  <Text style={styles.heroProgressValue}>
                    {trackTotals.mastered} / {trackTotals.total}
                  </Text>
                </View>
                <LiquidProgressBar
                  progress={Math.max(trackTotals.ratio, trackTotals.mastered > 0 ? 0.1 : 0.06)}
                  height={7}
                  tone="dark"
                  shimmer={motionActive}
                  active={motionActive}
                />
              </View>
            </View>

            <View style={styles.heroMascotWrap}>
              <SpotlightAura size={76} tone="onViolet" active={motionActive} />
              <Mascot pose="point" size={78} active={motionActive} />
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
          {/* Pure-white 3D Quick-Test Quest Studio Card */}
          <View style={styles.questCard}>
            <View pointerEvents="none" style={styles.studioTopGloss} />
            <View pointerEvents="none" style={styles.questTintCorner} />
            <View style={styles.questHeaderRow}>
              <View style={styles.questStatusPill}>
                <Text accessible={false} style={styles.questSpark}>✦</Text>
                <Text maxFontSizeMultiplier={1.15} style={styles.questStatusLabel}>
                  ANTRENAMENT RAPID
                </Text>
              </View>
              <View style={styles.questOfflinePill}>
                <Text maxFontSizeMultiplier={1.1} style={styles.questOfflineText}>
                  Offline · Instant
                </Text>
              </View>
            </View>

            <Text style={styles.questTitle}>Test fulger · 5 întrebări</Text>
            <Text style={styles.questSubtitle}>
              {studyProfile.hasChosenTrack
                ? `Grilă și răspuns scurt pentru ${trackMeta.shortLabel}, cu explicații pas cu pas.`
                : 'Grilă și răspuns scurt din toată programa, cu explicații pas cu pas.'}
            </Text>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Începe testul fulger de 5 întrebări"
              pressedScale={0.97}
              haptic="medium"
              onPress={startQuickTest}
              contentStyle={styles.heroCta}
            >
              <LinearGradient
                colors={['#EDFF7A', '#D8FF3E', '#BCEF12']}
                start={{ x: 0.08, y: 0 }}
                end={{ x: 0.92, y: 1 }}
                style={styles.fill}
              />
              <View pointerEvents="none" style={styles.ctaTopGloss} />
              <View style={styles.heroCtaBadge}>
                <AppIcon name="practice" size={24} />
              </View>
              <Text numberOfLines={2} style={styles.heroCtaText}>Începe testul fulger</Text>
              <View style={styles.heroCtaArrow}>
                <MiniGlyph name="next" size={16} color={colors.paper} />
              </View>
            </PressableScale>
          </View>

          {wrongCount > 0 ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={wrongCount === 1 ? 'Repetă întrebarea greșită' : `Repetă cele ${wrongCount} întrebări greșite`}
              pressedScale={0.975}
              haptic="light"
              onPress={startMistakesReview}
              contentStyle={styles.mistakesCard}
            >
              <LinearGradient
                pointerEvents="none"
                colors={['#FFF9FA', '#FFE6EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fill}
              />
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
            <LinearGradient
              pointerEvents="none"
              colors={['#FCF9FF', '#EFE3FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fill}
            />
            <View style={styles.aiRail} />
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
                Alegi capitolul și dificultatea (Ușor · Mediu · Examen) și primești un exercițiu original cu rezolvare.
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
                        <View style={styles.chapterRatioPill}>
                          <Text style={styles.chapterRatio}>
                            {stat.mastered}/{stat.total}
                          </Text>
                        </View>
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
                            ? `${stat.wrong} de repetat · ${formatRoCount(stat.total, 'exercițiu', 'exerciții')}`
                            : stat.total === 1
                              ? '1 exercițiu disponibil'
                              : `${formatRoCount(stat.total, 'exercițiu', 'exerciții')} disponibile`}
                        </Text>
                        <View style={styles.chapterStartPill}>
                          <Text style={styles.chapterStartText}>Exersează →</Text>
                        </View>
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
          selectedTrack={studyProfile.hasChosenTrack ? studyProfile.track : null}
          onSelect={handleSelectTrack}
          onClose={() => setTrackSheetOpen(false)}
        />
      ) : null}

      {aiSheetEverOpened ? (
        <AiPracticeSheet
          visible={aiSheetOpen}
          track={studyProfile.track}
          hasChosenTrack={studyProfile.hasChosenTrack}
          onGenerated={handleAiGenerated}
          onClose={() => setAiSheetOpen(false)}
        />
      ) : null}

      {streakSheetEverOpened ? (
        <StreakInfoSheet
          visible={streakSheetOpen}
          practiceState={practiceState}
          onClose={() => setStreakSheetOpen(false)}
          onStartQuickPractice={startQuickTest}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },

  canopy: {
    width: '100%',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    paddingBottom: 16,
    position: 'relative',
    zIndex: 4,
  },
  canopyGlowCyan: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -80,
    left: -55,
    backgroundColor: 'rgba(67, 214, 230, 0.2)',
  },
  canopyGlowLime: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    bottom: -80,
    right: 16,
    backgroundColor: 'rgba(216, 255, 62, 0.16)',
  },
  canopyOrbitArc: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.11)',
    top: -120,
    right: -85,
  },
  canopyGlyphDelta: {
    position: 'absolute',
    right: 108,
    top: 56,
    fontFamily: fonts.display,
    fontSize: 26,
    color: 'rgba(67, 214, 230, 0.2)',
    transform: [{ rotate: '12deg' }],
  },
  canopyStar: {
    position: 'absolute',
    left: 22,
    bottom: 18,
    fontFamily: fonts.display,
    fontSize: 13,
    color: 'rgba(216, 255, 62, 0.34)',
  },
  canopyInner: {
    maxWidth: 560,
    alignSelf: 'center',
    paddingTop: 6,
    gap: 10,
  },
  canopyHeaderRow: {
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
  canopyTitleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  canopyTitle: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 23,
    lineHeight: 27,
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
    color: 'rgba(242, 238, 255, 0.9)',
    fontSize: 10,
    letterSpacing: 0.85,
    includeFontPadding: false,
  },
  trackPill: {
    minHeight: 38,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#FFFFFF',
    borderBottomColor: '#C5B8FA',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  trackPillDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
    backgroundColor: colors.violet,
  },
  trackPillUnchosen: {
    backgroundColor: '#FFF7CF',
    borderColor: '#F6E076',
    borderBottomColor: '#C49F12',
  },
  trackPillDotUnchosen: {
    backgroundColor: '#B87B00',
  },
  trackPillText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 11.5,
    includeFontPadding: false,
  },
  trackPillTextUnchosen: {
    color: '#6E4600',
  },

  canopyHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  canopyHeroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 9,
  },
  canopyPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(18, 10, 48, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(216, 255, 62, 0.34)',
  },
  streakText: {
    fontFamily: fonts.bodyBold,
    color: colors.lime,
    fontSize: 11,
    includeFontPadding: false,
  },
  accuracyPill: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  accuracyText: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 11,
    includeFontPadding: false,
  },
  canopyProgressWrap: {
    gap: 5,
  },
  heroProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroProgressLabel: {
    fontFamily: fonts.bodyBold,
    color: 'rgba(244, 240, 255, 0.92)',
    fontSize: 11.5,
  },
  heroProgressValue: {
    fontFamily: fonts.bodyBold,
    color: colors.lime,
    fontSize: 11.5,
  },
  heroMascotWrap: {
    width: 82,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },

  scrollContent: { flexGrow: 1, paddingTop: 14 },
  page: { width: '100%', alignSelf: 'center', gap: 13 },

  questCard: {
    borderRadius: 28,
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
  studioTopGloss: {
    position: 'absolute',
    top: 0,
    left: 22,
    right: 22,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  questTintCorner: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    top: -64,
    right: -46,
    backgroundColor: 'rgba(124, 60, 255, 0.06)',
  },
  questHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  questStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
  },
  questSpark: {
    fontFamily: fonts.display,
    color: colors.violet,
    fontSize: 11,
  },
  questStatusLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 10,
    letterSpacing: 0.75,
    includeFontPadding: false,
  },
  questOfflinePill: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: radii.pill,
    backgroundColor: colors.cyanSoft,
  },
  questOfflineText: {
    fontFamily: fonts.bodyBold,
    color: colors.cyanDeep,
    fontSize: 10.5,
    includeFontPadding: false,
  },
  questTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 21,
    lineHeight: 25,
    letterSpacing: -0.2,
  },
  questSubtitle: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  heroCta: {
    marginTop: 2,
    minHeight: 56,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderBottomWidth: 4.5,
    borderColor: '#C5F228',
    borderBottomColor: '#7EA508',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  ctaTopGloss: {
    position: 'absolute',
    top: 1,
    left: 20,
    right: 20,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  heroCtaBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
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
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#FBCBD4',
    borderBottomColor: '#EBA5B5',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F9C5CF',
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
    paddingVertical: 2.5,
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
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  aiCard: {
    borderRadius: 24,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#DFD2FF',
    borderBottomColor: '#C2AEF9',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 13,
    gap: 11,
    overflow: 'hidden',
  },
  aiRail: {
    width: 5,
    alignSelf: 'stretch',
    backgroundColor: colors.violet,
  },
  aiIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFD2FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  aiCopy: { flex: 1, minWidth: 0, paddingVertical: 13 },
  aiTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
  },
  aiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radii.pill,
    backgroundColor: colors.violet,
  },
  aiBadgeText: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 9.5,
    letterSpacing: 0.45,
    includeFontPadding: false,
  },
  aiSubMeta: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
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
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  chaptersBlock: { gap: 9, marginTop: 2 },
  sectionKicker: {
    ...typography.kicker,
    fontSize: 10.5,
    color: colors.violetDeep,
    paddingHorizontal: 2,
  },
  chaptersList: { gap: 10 },
  chapterCard: {
    borderRadius: 22,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E8E0FC',
    borderBottomColor: '#D4C7F7',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  chapterRail: {
    width: 5,
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
  chapterRatioPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
  },
  chapterRatio: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 11.5,
    includeFontPadding: false,
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
  chapterStartPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.limeSoft,
  },
  chapterStartText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 11.5,
    includeFontPadding: false,
  },
  pressed: { opacity: 0.82 },
});
