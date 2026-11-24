import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { beginAppTransition } from '../../../shared/context/TransitionMotionContext';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, radii, typography } from '../../../shared/theme';
import type { RootStackParamList } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { IconButton } from '../../../shared/ui/IconButton';
import { LiquidProgressBar } from '../../../shared/ui/LiquidProgressBar';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { SpotlightAura } from '../../../shared/ui/SpotlightAura';
import { Text } from '../../../shared/ui/Typography';
import { getExamGuide } from '../../exams/data/examGuidesCatalog';
import { getBestGradeForExam, useExamHistory } from '../../exams/services/examStorage';
import { formatRomanianGrade } from '../../exams/utils/examEngine';
import { getActiveStreakDays, usePracticeState } from '../../practice/services/practiceStorage';
import { FormulaCard } from '../components/FormulaCard';
import { StudyTrackSheet } from '../components/StudyTrackSheet';
import { setStudyTrack, toggleFavoriteFormula, useStudyProfile } from '../services/studyStorage';
import {
  FORMULA_CATEGORIES,
  getStudyTrackMeta,
  type FormulaCategoryId,
  type FormulaEntry,
  type StudyTrackId,
} from '../types';
import { getFormulasForTrack } from '../utils/studyDocumentBuilder';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  active: boolean;
  bottomClearance: number;
};

/**
 * Tab 2 Study Hub ("Invata"): LaunchSplash-grade learning center with active
 * curriculum selector (EN VIII / BAC M1-M3 / Gimnaziu / Liceu), offline
 * formula progress, visual exam blueprint entry, category shortcuts, and
 * curated track formulas.
 */
export const StudyHubScreen = memo(function StudyHubScreen({
  active,
  bottomClearance,
}: Props) {
  const navigation = useNavigation<Navigation>();
  const frame = useSafeAreaFrame();
  const { gutter, contentWidth, isVeryNarrow } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const profile = useStudyProfile();
  const practiceState = usePracticeState();
  const examHistory = useExamHistory();
  const streakDays = getActiveStreakDays(practiceState);
  const wrongCount = practiceState.wrongQuestionIds.length;

  const [trackSheetOpen, setTrackSheetOpen] = useState(false);
  const [trackSheetEverOpened, setTrackSheetEverOpened] = useState(false);

  const trackMeta = getStudyTrackMeta(profile.track);
  const examGuide = useMemo(() => getExamGuide(trackMeta.examGuideId), [trackMeta.examGuideId]);
  const bestExamGrade = useMemo(
    () => getBestGradeForExam(examHistory, trackMeta.examGuideId),
    [examHistory, trackMeta.examGuideId],
  );
  const trackFormulas = useMemo(() => getFormulasForTrack(profile.track), [profile.track]);
  const favoriteSet = useMemo(() => new Set(profile.favoriteFormulaIds), [profile.favoriteFormulaIds]);
  const exploredSet = useMemo(() => new Set(profile.exploredFormulaIds), [profile.exploredFormulaIds]);

  const exploredCount = useMemo(
    () => trackFormulas.filter((item) => exploredSet.has(item.id)).length,
    [exploredSet, trackFormulas],
  );
  const trackFavoritesCount = useMemo(
    () => trackFormulas.filter((item) => favoriteSet.has(item.id)).length,
    [favoriteSet, trackFormulas],
  );
  const exploredRatio = trackFormulas.length > 0 ? exploredCount / trackFormulas.length : 0;

  const trackCategories = useMemo(() => {
    const present = new Set(trackFormulas.map((item) => item.category));
    return FORMULA_CATEGORIES.filter((cat) => present.has(cat.id));
  }, [trackFormulas]);

  const featuredFormulas = useMemo(() => {
    const prioritized = [
      ...trackFormulas.filter((item) => Boolean(item.examTag)),
      ...trackFormulas.filter((item) => !item.examTag),
    ];
    return prioritized.slice(0, 4);
  }, [trackFormulas]);

  const openTrackPicker = useCallback(() => {
    Haptics.selection();
    setTrackSheetEverOpened(true);
    setTrackSheetOpen(true);
  }, []);

  const handleSelectTrack = useCallback((next: StudyTrackId) => {
    setStudyTrack(next);
  }, []);

  const openSettings = useCallback(() => {
    beginAppTransition();
    navigation.navigate('Settings');
  }, [navigation]);

  const openFormulas = useCallback((category?: FormulaCategoryId) => {
    beginAppTransition();
    navigation.navigate('Formulas', category ? { initialCategory: category } : undefined);
  }, [navigation]);

  const openExamsHub = useCallback(() => {
    beginAppTransition();
    navigation.navigate('ExamsHub', { examId: trackMeta.examGuideId });
  }, [navigation, trackMeta.examGuideId]);

  const openPracticeHub = useCallback(() => {
    beginAppTransition();
    navigation.navigate('PracticeHub');
  }, [navigation]);

  const startQuickQuiz = useCallback(() => {
    beginAppTransition();
    navigation.navigate('PracticeSession', { mode: 'quick' });
  }, [navigation]);

  const openFormulaDetail = useCallback((formula: FormulaEntry) => {
    beginAppTransition();
    navigation.navigate('FormulaDetail', {
      formulaId: formula.id,
      formulaIds: trackFormulas.map((item) => item.id),
    });
  }, [navigation, trackFormulas]);

  const handleToggleFavorite = useCallback((formulaId: string) => {
    toggleFavoriteFormula(formulaId);
  }, []);

  const motionActive = active && !reducedMotion;

  return (
    <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
      <ComicBackdrop />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomClearance },
        ]}
      >
        <View style={[styles.page, { width: contentWidth }]}>
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <View pointerEvents="none" style={styles.titleHighlight} />
              <Text maxFontSizeMultiplier={1.25} style={styles.headerTitle}>
                Învață
              </Text>
            </View>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Nivel de studiu: ${trackMeta.label}. Apasă pentru a schimba`}
              pressedScale={0.95}
              haptic="selection"
              onPress={openTrackPicker}
              style={styles.trackPillWrap}
              contentStyle={styles.trackPill}
            >
              <AppIcon name="class" size={18} />
              <Text
                maxFontSizeMultiplier={1.15}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                style={[styles.trackPillText, isVeryNarrow && styles.trackPillTextNarrow]}
              >
                {trackMeta.shortLabel} ▾
              </Text>
            </PressableScale>

            <IconButton
              label="Deschide setările"
              onPress={openSettings}
              size={42}
            >
              <AppIcon name="settings" size={27} />
            </IconButton>
          </View>

          <View style={styles.heroShadow}>
            <View style={styles.heroCard}>
              <LinearGradient
                colors={['#8D50FF', '#6222E6', '#4212B0']}
                start={{ x: 0.08, y: 0 }}
                end={{ x: 0.92, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View pointerEvents="none" style={styles.heroGlowTop} />
              <View pointerEvents="none" style={styles.heroGlowBottom} />
              <View pointerEvents="none" style={styles.heroTopShine} />

              <View style={styles.heroRow}>
                <View style={styles.heroMascotStage}>
                  <SpotlightAura size={82} tone="lime" active={motionActive} />
                  <Mascot pose="cheer" size={86} active={motionActive} interactive />
                </View>

                <View style={styles.heroCopy}>
                  <View style={styles.heroTopPills}>
                    <View style={styles.heroEyebrowPill}>
                      <Text numberOfLines={1} style={styles.heroEyebrowText}>
                        ✦ {trackMeta.eyebrow}
                      </Text>
                    </View>
                    {streakDays > 0 ? (
                      <View style={styles.heroStreakPill}>
                        <Text numberOfLines={1} style={styles.heroStreakText}>
                          🔥 {streakDays} {streakDays === 1 ? 'zi' : 'zile'}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text numberOfLines={2} style={styles.heroTitle}>
                    {trackMeta.label}
                  </Text>
                  <Text numberOfLines={2} style={styles.heroDesc}>
                    {trackMeta.description}
                  </Text>
                </View>
              </View>

              <View style={styles.progressBox}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>
                    {exploredCount} din {trackFormulas.length} fișe explorate
                  </Text>
                  <Text style={styles.progressFavs}>
                    ★ {trackFavoritesCount} favorite
                  </Text>
                </View>
                <LiquidProgressBar
                  progress={Math.max(exploredRatio, exploredCount > 0 ? 0.1 : 0.06)}
                  height={8}
                  tone="dark"
                  shimmer={motionActive}
                  active={motionActive}
                />
              </View>

              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Începe un test fulger de 5 întrebări pentru ${trackMeta.label}`}
                pressedScale={0.97}
                haptic="medium"
                onPress={startQuickQuiz}
                contentStyle={styles.heroCta}
              >
                <View style={styles.heroCtaBadge}>
                  <AppIcon name="practice" size={24} />
                </View>
                <Text numberOfLines={2} style={styles.heroCtaText}>
                  Test fulger · 5 întrebări
                </Text>
                <View style={styles.heroCtaArrow}>
                  <MiniGlyph name="next" size={16} color={colors.paper} />
                </View>
              </PressableScale>
            </View>
          </View>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Deschide secțiunea Teste și Practică"
            pressedScale={0.975}
            haptic="light"
            onPress={openPracticeHub}
            contentStyle={styles.practiceCard}
          >
            <View style={styles.practiceRail} />
            <View style={styles.practiceIcon}>
              <AppIcon name="practice" size={30} />
            </View>
            <View style={styles.practiceCopy}>
              <View style={styles.practiceTitleRow}>
                <Text style={styles.practiceTitle}>Teste & Practică AI</Text>
                {wrongCount > 0 ? (
                  <View style={styles.practiceWrongBadge}>
                    <Text style={styles.practiceWrongText}>{wrongCount} de repetat</Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={2} style={styles.practiceNote}>
                Antrenament pe capitole, grilă + răspuns scurt și exerciții originale cu Profu’ AI
              </Text>
            </View>
            <View style={styles.practiceArrow}>
              <MiniGlyph name="next" size={16} color={colors.violetDeep} />
            </View>
          </PressableScale>

          <View style={styles.cardsGrid}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Deschide biblioteca de Formule și Fișe, ${trackFormulas.length} fișe disponibile`}
              pressedScale={0.965}
              haptic="light"
              onPress={() => openFormulas()}
              style={styles.gridTileWrap}
              contentStyle={[styles.gridTile, styles.formulasTile]}
            >
              <View style={[styles.tileIcon, styles.formulasTileIcon]}>
                <AppIcon name="explain" size={30} />
              </View>
              <Text numberOfLines={2} style={styles.tileTitle}>Formule & Fișe</Text>
              <Text numberOfLines={2} style={styles.tileNote}>
                {trackFormulas.length} fișe offline · exemple & capcane
              </Text>
              <View style={styles.tileFooter}>
                <Text style={styles.tileLinkText}>Deschide</Text>
                <MiniGlyph name="next" size={14} color={colors.violetDeep} />
              </View>
            </PressableScale>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Deschide simulările și ghidul pentru ${examGuide.title}`}
              pressedScale={0.965}
              haptic="light"
              onPress={openExamsHub}
              style={styles.gridTileWrap}
              contentStyle={[styles.gridTile, styles.examTile]}
            >
              <View style={[styles.tileIcon, styles.examTileIcon]}>
                <AppIcon name="trophy" size={30} />
              </View>
              <Text numberOfLines={2} style={styles.tileTitle}>EN & BAC</Text>
              <Text numberOfLines={2} style={styles.tileNote}>
                {bestExamGrade !== null
                  ? `Record ${examGuide.shortTitle}: ${formatRomanianGrade(bestExamGrade)} · simulări & barem`
                  : 'Simulări cronometrate, barem & ghid vizual'}
              </Text>
              <View style={styles.tileFooter}>
                <Text style={styles.tileLinkText}>Simulări</Text>
                <MiniGlyph name="next" size={14} color={colors.violetDeep} />
              </View>
            </PressableScale>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionKicker}>CAPITOLE RAPIDE</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.categoriesRow, { paddingRight: gutter }]}
            >
              {trackCategories.map((category) => (
                <Pressable
                  key={category.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Formule pentru ${category.label}`}
                  onPress={() => {
                    Haptics.selection();
                    openFormulas(category.id);
                  }}
                  style={({ pressed }) => [styles.categoryPill, pressed && styles.pressed]}
                >
                  <View style={[styles.categoryDot, { backgroundColor: category.accent }]} />
                  <Text style={styles.categoryLabel}>{category.shortLabel}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderCopy}>
                <Text style={styles.sectionKicker}>ESENȚIALE PENTRU TINE</Text>
                <Text style={styles.sectionTitle}>Formule cheie · {trackMeta.shortLabel}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Vezi toate formulele"
                hitSlop={8}
                onPress={() => {
                  Haptics.selection();
                  openFormulas();
                }}
                style={({ pressed }) => [styles.seeAllPill, pressed && styles.pressed]}
              >
                <Text style={styles.seeAllText}>Toate ({trackFormulas.length})</Text>
              </Pressable>
            </View>

            <View style={styles.featuredStack}>
              {featuredFormulas.map((formula) => (
                <FormulaCard
                  key={formula.id}
                  formula={formula}
                  compact
                  isFavorite={favoriteSet.has(formula.id)}
                  onOpen={openFormulaDetail}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </View>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Vezi toate cele ${trackFormulas.length} formule pentru ${trackMeta.label}`}
              pressedScale={0.975}
              haptic="selection"
              onPress={() => openFormulas()}
              contentStyle={styles.allFormulasCta}
            >
              <Text style={styles.allFormulasCtaText}>
                Deschide toate cele {trackFormulas.length} fișe de formule
              </Text>
              <MiniGlyph name="next" size={16} color={colors.violetDeep} />
            </PressableScale>
          </View>
        </View>
      </ScrollView>

      {trackSheetEverOpened ? (
        <StudyTrackSheet
          visible={trackSheetOpen}
          selectedTrack={profile.track}
          onSelect={handleSelectTrack}
          onClose={() => setTrackSheetOpen(false)}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 4,
  },
  page: {
    maxWidth: 560,
    alignSelf: 'center',
    gap: 14,
  },

  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  titleHighlight: {
    position: 'absolute',
    left: 0,
    bottom: 2,
    width: 72,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(216, 255, 62, 0.72)',
  },
  headerTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  trackPillWrap: {
    marginLeft: 'auto',
    flexShrink: 1,
    minWidth: 0,
  },
  trackPill: {
    minHeight: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  trackPillText: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 12,
    lineHeight: 15,
    includeFontPadding: false,
  },
  trackPillTextNarrow: {
    fontSize: 11,
  },

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
  heroGlowTop: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -110,
    right: -60,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  heroGlowBottom: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: -85,
    left: -50,
    backgroundColor: 'rgba(23, 19, 55, 0.22)',
  },
  heroTopShine: {
    position: 'absolute',
    top: 0,
    left: 26,
    right: 26,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroMascotStage: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  heroTopPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  heroStreakPill: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(216, 255, 62, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(216, 255, 62, 0.42)',
  },
  heroStreakText: {
    fontFamily: fonts.bodyBold,
    color: colors.lime,
    fontSize: 9.5,
    includeFontPadding: false,
  },
  heroEyebrowPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(18, 12, 46, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  heroEyebrowText: {
    fontFamily: fonts.bodyBold,
    color: colors.lime,
    fontSize: 9.5,
    letterSpacing: 0.7,
    includeFontPadding: false,
  },
  heroTitle: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 20,
    lineHeight: 23.5,
  },
  heroDesc: {
    fontFamily: fonts.bodyMedium,
    color: 'rgba(244, 238, 255, 0.9)',
    fontSize: 12,
    lineHeight: 16.5,
  },
  progressBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(18, 12, 46, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    gap: 7,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  progressLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 11.5,
  },
  progressFavs: {
    fontFamily: fonts.bodyBold,
    color: colors.lime,
    fontSize: 11.5,
  },
  heroCta: {
    minHeight: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 10,
  },
  heroCtaBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
    fontSize: 16,
    lineHeight: 20,
  },
  heroCtaArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  practiceCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 13,
    gap: 11,
    overflow: 'hidden',
  },
  practiceRail: {
    width: 5,
    alignSelf: 'stretch',
    backgroundColor: colors.lime,
  },
  practiceIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  practiceCopy: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
  },
  practiceTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
  },
  practiceTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17.5,
    lineHeight: 21,
  },
  practiceWrongBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.roseSoft,
  },
  practiceWrongText: {
    fontFamily: fonts.bodyBold,
    color: colors.berryDeep,
    fontSize: 10,
    includeFontPadding: false,
  },
  practiceNote: {
    marginTop: 2,
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 16,
  },
  practiceArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardsGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  gridTileWrap: {
    flex: 1,
    minWidth: 0,
  },
  gridTile: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  formulasTile: {
    backgroundColor: 'rgba(241, 253, 255, 0.96)',
    borderColor: 'rgba(67, 214, 230, 0.3)',
  },
  examTile: {
    backgroundColor: 'rgba(255, 251, 236, 0.96)',
    borderColor: 'rgba(255, 212, 71, 0.42)',
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  formulasTileIcon: { backgroundColor: '#DCF7FB' },
  examTileIcon: { backgroundColor: '#FFF0BD' },
  tileTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 20,
  },
  tileNote: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 16,
  },
  tileFooter: {
    marginTop: 'auto',
    paddingTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tileLinkText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 12,
  },

  sectionBlock: {
    gap: 9,
  },
  sectionKicker: {
    ...typography.kicker,
    fontSize: 10.5,
    color: colors.violetDeep,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    marginTop: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 19,
    lineHeight: 23,
  },
  seeAllPill: {
    minHeight: 30,
    paddingHorizontal: 11,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeAllText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 11.5,
    includeFontPadding: false,
  },
  categoriesRow: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryPill: {
    minHeight: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 12.5,
    includeFontPadding: false,
  },

  featuredStack: {
    gap: 10,
  },
  allFormulasCta: {
    minHeight: 48,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  allFormulasCtaText: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 13,
    textAlign: 'center',
  },
  pressed: { opacity: 0.78 },
});
