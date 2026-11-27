import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { beginAppTransition } from '../../../shared/context/TransitionMotionContext';
import { useActionToast } from '../../../shared/hooks/useActionToast';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, radii, typography } from '../../../shared/theme';
import type { RootStackParamList } from '../../../shared/types';
import { ActionToast } from '../../../shared/ui/ActionToast';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { IconButton } from '../../../shared/ui/IconButton';
import { LiquidProgressBar } from '../../../shared/ui/LiquidProgressBar';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { RoyalHeroCanopyBackdrop } from '../../../shared/ui/RoyalHeroCanopyBackdrop';
import { SpotlightAura } from '../../../shared/ui/SpotlightAura';
import { Text } from '../../../shared/ui/Typography';
import { formatRoCount } from '../../../shared/utils/romanianGrammar';
import { getExamGuide } from '../../exams/data/examGuidesCatalog';
import { getExamSimulationById } from '../../exams/data/examSimulationsCatalog';
import { useExamDraft } from '../../exams/services/examDraftStorage';
import { getBestGradeForExam, useExamHistory } from '../../exams/services/examStorage';
import { countDraftAnsweredItems, formatExamCountdown } from '../../exams/utils/examDraft';
import { formatRomanianGrade, getScopeItems, getScopeTitle } from '../../exams/utils/examEngine';
import { StreakInfoSheet } from '../../practice/components/StreakInfoSheet';
import { getActiveStreakDays, usePracticeState } from '../../practice/services/practiceStorage';
import { FormulaCard } from '../components/FormulaCard';
import { StudyTrackSheet } from '../components/StudyTrackSheet';
import { FORMULAS_CATALOG } from '../data/formulasCatalog';
import { setStudyTrack, toggleFavoriteFormula, useStudyProfile } from '../services/studyStorage';
import {
  FORMULA_CATEGORIES,
  getStudyTrackMeta,
  type FormulaCategoryId,
  type FormulaEntry,
  type StudyTrackId,
} from '../types';
import { prewarmStudyMath } from '../utils/prewarmStudyMath';
import { getFormulasForTrack } from '../utils/studyDocumentBuilder';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  active: boolean;
  bottomClearance: number;
};

/**
 * Tab 2 Study Hub ("Învață"): full-bleed curved Sapphire-Violet academy canopy
 * with cheering Profu mascot, live curriculum progress, pure-white 3D quick
 * quiz quest studio, glossy pastel hub cards, and curated track formulas.
 */
export const StudyHubScreen = memo(function StudyHubScreen({
  active,
  bottomClearance,
}: Props) {
  const navigation = useNavigation<Navigation>();
  const frame = useSafeAreaFrame();
  const { gutter, contentWidth } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const profile = useStudyProfile();
  const practiceState = usePracticeState();
  const examHistory = useExamHistory();
  const examDraft = useExamDraft();
  const streakDays = getActiveStreakDays(practiceState);
  const wrongCount = practiceState.wrongQuestionIds.length;

  const [trackSheetOpen, setTrackSheetOpen] = useState(false);
  const [trackSheetEverOpened, setTrackSheetEverOpened] = useState(false);
  const [streakSheetOpen, setStreakSheetOpen] = useState(false);
  const [streakSheetEverOpened, setStreakSheetEverOpened] = useState(false);
  const { toast, showToast } = useActionToast();
  const navLockRef = useRef(false);

  useFocusEffect(useCallback(() => {
    navLockRef.current = false;
  }, []));

  const trackMeta = getStudyTrackMeta(profile.track);
  const examGuide = useMemo(() => getExamGuide(trackMeta.examGuideId), [trackMeta.examGuideId]);
  const draftBanner = useMemo(() => {
    if (!examDraft) return null;
    const draftVariant = getExamSimulationById(examDraft.variantId);
    if (!draftVariant) return null;
    const draftGuide = getExamGuide(examDraft.examId);
    const draftItems = getScopeItems(draftVariant, examDraft.scope);
    return {
      variantId: examDraft.variantId,
      scope: examDraft.scope,
      guideTitle: draftGuide.shortTitle,
      scopeTitle: getScopeTitle(examDraft.scope),
      answered: countDraftAnsweredItems(examDraft, draftItems),
      total: draftItems.length,
      remaining: formatExamCountdown(examDraft.secondsLeft),
    };
  }, [examDraft]);
  const bestExamGrade = useMemo(
    () => (profile.hasChosenTrack ? getBestGradeForExam(examHistory, trackMeta.examGuideId) : null),
    [examHistory, profile.hasChosenTrack, trackMeta.examGuideId],
  );
  const trackFormulas = useMemo(
    () => (profile.hasChosenTrack ? getFormulasForTrack(profile.track) : FORMULAS_CATALOG),
    [profile.hasChosenTrack, profile.track],
  );
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

  const openStreakSheet = useCallback(() => {
    Haptics.selection();
    setStreakSheetEverOpened(true);
    setStreakSheetOpen(true);
  }, []);

  const handleSelectTrack = useCallback((next: StudyTrackId) => {
    setStudyTrack(next);
    const chosenMeta = getStudyTrackMeta(next);
    showToast({
      message: `Nivel activ: ${chosenMeta.label}`,
      tone: 'lime',
    });
  }, [showToast]);

  // Quietly pre-flatten the first visible track cards & featured formula sheets
  // while idle so Formulas and FormulaDetail open in 0ms JS math time.
  useEffect(() => {
    if (!active) return undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      const topTrack = trackFormulas.slice(0, 6);
      prewarmStudyMath({
        displayLatex: topTrack.map((item) => item.formulas?.[0]?.latex ?? item.formulaLatex),
      });
      for (const entry of featuredFormulas) {
        prewarmStudyMath({
          displayLatex: [
            entry.formulaLatex,
            ...(entry.formulas?.map((item) => item.latex) ?? []),
          ],
          inlineTexts: [
            entry.whenToUse,
            entry.pitfall,
            ...(entry.formulas?.map((item) => item.label) ?? []),
          ],
          blocks: entry.example,
        });
      }
    });
    return () => task.cancel();
  }, [active, featuredFormulas, trackFormulas]);

  const openSettings = useCallback(() => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    beginAppTransition();
    navigation.navigate('Settings');
  }, [navigation]);

  const openFormulas = useCallback((category?: FormulaCategoryId) => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    beginAppTransition();
    navigation.navigate('Formulas', category ? { initialCategory: category } : undefined);
  }, [navigation]);

  const openExamsHub = useCallback(() => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    beginAppTransition();
    navigation.navigate('ExamsHub', { examId: trackMeta.examGuideId });
  }, [navigation, trackMeta.examGuideId]);

  const resumeExamDraft = () => {
    if (!draftBanner || navLockRef.current) return;
    navLockRef.current = true;
    beginAppTransition();
    navigation.navigate('ExamSimulation', {
      variantId: draftBanner.variantId,
      scope: draftBanner.scope,
    });
  };

  const openPracticeHub = useCallback(() => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    beginAppTransition();
    navigation.navigate('PracticeHub');
  }, [navigation]);

  const startQuickQuiz = useCallback(() => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    beginAppTransition();
    navigation.navigate('PracticeSession', { mode: 'quick' });
  }, [navigation]);

  const openFormulaDetail = useCallback((formula: FormulaEntry) => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    beginAppTransition();
    navigation.navigate('FormulaDetail', {
      formulaId: formula.id,
      formulaIds: trackFormulas.map((item) => item.id),
    });
  }, [navigation, trackFormulas]);

  const handleToggleFavorite = useCallback((formulaId: string) => {
    const added = toggleFavoriteFormula(formulaId);
    if (added) {
      showToast({
        message: 'Salvată în Caiet → Formule',
        tone: 'gold',
      });
    } else {
      showToast({
        message: 'Scoasă din favorite',
        tone: 'neutral',
        actionLabel: 'Anulează',
        onAction: () => {
          toggleFavoriteFormula(formulaId);
        },
      });
    }
  }, [showToast]);

  const motionActive = active && !reducedMotion;

  return (
    <View style={styles.safe}>
      <ComicBackdrop />

      {/* Full-bleed curved Sapphire-Violet sky canopy matching Home architectural language */}
      <View style={[styles.canopy, { paddingTop: (insets.top ?? 0) + 4 }]}>
        <LinearGradient
          colors={['#7344FF', '#5225EE', '#3B19C8', '#2C119F']}
          start={{ x: 0.08, y: 0 }}
          end={{ x: 0.92, y: 1 }}
          style={styles.fill}
        />
        <RoyalHeroCanopyBackdrop showGradient={false} />

        <View style={[styles.canopyInner, { width: contentWidth }]}>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.brandBadge}>
                <AppIcon name="class" size={28} />
              </View>
              <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={styles.headerTitle}>
                Învață
              </Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  streakDays > 0
                    ? `Seria zilnică: ${streakDays} zile. Apasă pentru detalii`
                    : 'Seria zilnică. Apasă pentru detalii'
                }
                hitSlop={6}
                onPress={openStreakSheet}
                style={({ pressed }) => [styles.headerStreakPill, pressed && styles.pressed]}
              >
                <AppIcon name="streak" size={14} />
                <Text maxFontSizeMultiplier={1.1} style={styles.headerStreakText}>
                  {streakDays > 0 ? `${streakDays}z` : 'Seria'}
                </Text>
              </Pressable>

              <IconButton
                label="Deschide setările"
                onPress={openSettings}
                size={42}
                style={styles.settingsWrap}
              >
                <AppIcon name="settings" size={27} />
              </IconButton>
            </View>
          </View>

          <View style={styles.heroRow}>
            <View style={styles.heroCopy}>
              <View style={styles.heroEyebrowRow}>
                <View style={styles.heroEyebrowPill}>
                  <View style={styles.heroEyebrowDot} />
                  <Text maxFontSizeMultiplier={1.1} numberOfLines={1} style={styles.heroEyebrowText}>
                    {profile.hasChosenTrack ? trackMeta.eyebrow : 'EN & BAC · RECAPITULARE V–XII'}
                  </Text>
                </View>
                {profile.hasChosenTrack ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Nivel activ: ${trackMeta.label}. Apasă pentru a schimba`}
                    hitSlop={6}
                    onPress={openTrackPicker}
                    style={({ pressed }) => [styles.heroSwitchPill, pressed && styles.pressed]}
                  >
                    <Text maxFontSizeMultiplier={1.1} style={styles.heroSwitchText}>
                      Schimbă ▾
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <Text maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.heroTitle}>
                {profile.hasChosenTrack ? trackMeta.label : 'Toată programa'}
              </Text>
              <View style={styles.heroProgressWrap}>
                <View style={styles.progressHeader}>
                  <Text maxFontSizeMultiplier={1.15} style={styles.progressLabel}>
                    {profile.hasChosenTrack
                      ? `${exploredCount} / ${trackFormulas.length} fișe`
                      : `${trackFormulas.length} fișe disponibile`}
                  </Text>
                  <Text maxFontSizeMultiplier={1.15} style={styles.progressFavs}>
                    ★ {trackFavoritesCount} favorite
                  </Text>
                </View>
                <LiquidProgressBar
                  progress={Math.max(exploredRatio, exploredCount > 0 ? 0.1 : 0.06)}
                  height={7}
                  tone="dark"
                  shimmer={motionActive}
                  active={motionActive}
                />
              </View>
            </View>

            <View style={styles.heroMascotStage}>
              <SpotlightAura size={84} tone="onViolet" active={motionActive} />
              <View pointerEvents="none" style={styles.mascotFloorGlow} />
              <Mascot pose="cheer" size={86} active={motionActive} interactive />
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomClearance },
        ]}
      >
        <View style={[styles.page, { width: contentWidth }]}>
          {!profile.hasChosenTrack ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Alege clasa sau examenul pentru a personaliza formulele, testele și simulările"
              pressedScale={0.975}
              haptic="selection"
              onPress={openTrackPicker}
              contentStyle={styles.trackBannerCard}
            >
              <LinearGradient
                pointerEvents="none"
                colors={['#FFFDF2', '#FFF1BE']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fill}
              />
              <View pointerEvents="none" style={styles.cardTopGloss} />
              <View style={styles.trackBannerRail} />
              <View style={styles.trackBannerIcon}>
                <AppIcon name="class" size={30} />
              </View>
              <View style={styles.trackBannerCopy}>
                <Text maxFontSizeMultiplier={1.1} style={styles.trackBannerKicker}>
                  PERSONALIZEAZĂ NIVELUL
                </Text>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86} style={styles.trackBannerTitle}>
                  Alege clasa sau examenul
                </Text>
                <Text numberOfLines={2} style={styles.trackBannerNote}>
                  Adaptăm formulele, testele și simulările pentru tine.
                </Text>
              </View>
              <View style={styles.trackBannerArrow}>
                <MiniGlyph name="next" size={16} color="#8A5600" />
              </View>
            </PressableScale>
          ) : null}

          {draftBanner ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Continuă simularea în pauză ${draftBanner.guideTitle}, ${draftBanner.answered} din ${draftBanner.total} itemi`}
              pressedScale={0.975}
              haptic="medium"
              onPress={resumeExamDraft}
              contentStyle={[styles.trackBannerCard, styles.draftBannerCard]}
            >
              <LinearGradient
                pointerEvents="none"
                colors={['#F8FFDE', '#E7FFA0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fill}
              />
              <View pointerEvents="none" style={styles.cardTopGloss} />
              <View style={[styles.trackBannerRail, { backgroundColor: colors.limeDeep }]} />
              <View style={[styles.trackBannerIcon, { borderColor: '#BFE452' }]}>
                <AppIcon name="trophy" size={30} />
              </View>
              <View style={styles.trackBannerCopy}>
                <Text maxFontSizeMultiplier={1.1} style={[styles.trackBannerKicker, { color: colors.limeDeep }]}>
                  ⏸ SIMULARE ÎN PAUZĂ · {draftBanner.guideTitle.toUpperCase()}
                </Text>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86} style={[styles.trackBannerTitle, { color: colors.ink }]}>
                  Continuă simularea
                </Text>
                <Text numberOfLines={1} style={styles.trackBannerNote}>
                  {draftBanner.answered}/{draftBanner.total} itemi · ⏱ {draftBanner.remaining} rămas
                </Text>
              </View>
              <View style={[styles.trackBannerArrow, { borderColor: '#BFE452' }]}>
                <MiniGlyph name="next" size={16} color={colors.ink} />
              </View>
            </PressableScale>
          ) : null}

          {/* Pure-white 3D Quick-Start Quest Card matching Home optical studio craft */}
          <View style={styles.questCard}>
            <View pointerEvents="none" style={styles.studioTopGloss} />
            <View pointerEvents="none" style={styles.questTintCorner} />
            <View pointerEvents="none" style={styles.questDotGrid}>
              <View style={styles.questDotRow}>
                <View style={styles.questDot} />
                <View style={styles.questDot} />
                <View style={styles.questDot} />
              </View>
              <View style={styles.questDotRow}>
                <View style={styles.questDot} />
                <View style={styles.questDot} />
                <View style={styles.questDot} />
              </View>
            </View>

            <View style={styles.questTopRow}>
              <View style={styles.questStatusPill}>
                <Text accessible={false} style={styles.questSpark}>✦</Text>
                <Text maxFontSizeMultiplier={1.15} style={styles.questStatusLabel}>
                  ANTRENAMENT RAPID
                </Text>
              </View>
              {wrongCount > 0 ? (
                <View style={styles.questWrongPill}>
                  <Text maxFontSizeMultiplier={1.1} style={styles.questWrongText}>
                    {wrongCount} de repetat
                  </Text>
                </View>
              ) : bestExamGrade !== null ? (
                <View style={styles.questRecordPill}>
                  <Text maxFontSizeMultiplier={1.1} style={styles.questRecordText}>
                    ★ {formatRomanianGrade(bestExamGrade)}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text numberOfLines={2} style={styles.questDesc}>
              {profile.hasChosenTrack
                ? trackMeta.description
                : 'Test rapid de 5 întrebări cu explicații pas cu pas. Alege nivelul tău mai sus pentru programă personalizată.'}
            </Text>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Începe un test fulger de 5 întrebări pentru ${trackMeta.label}`}
              pressedScale={0.97}
              haptic="medium"
              onPress={startQuickQuiz}
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
                <AppIcon name="practice" size={25} />
              </View>
              <Text numberOfLines={2} style={styles.heroCtaText}>
                Test fulger · 5 întrebări
              </Text>
              <View style={styles.heroCtaArrow}>
                <MiniGlyph name="next" size={16} color={colors.paper} />
              </View>
            </PressableScale>
          </View>

          {/* Full-width glossy soft-violet AI Practice banner */}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Deschide secțiunea Teste și Practică"
            pressedScale={0.975}
            haptic="light"
            onPress={openPracticeHub}
            contentStyle={styles.practiceCard}
          >
            <LinearGradient
              pointerEvents="none"
              colors={['#FCF9FF', '#EFE3FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fill}
            />
            <View pointerEvents="none" style={styles.cardTopGloss} />
            <View style={styles.practiceRail} />
            <View style={styles.practiceIcon}>
              <AppIcon name="streak" size={32} />
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
                Capitole, grilă + răspuns scurt și exerciții noi cu Profu’ AI
              </Text>
            </View>
            <View style={styles.practiceArrow}>
              <MiniGlyph name="next" size={16} color={colors.violetDeep} />
            </View>
          </PressableScale>

          {/* 2-Column Glossy Sky-Cyan & Sunny-Gold 3D Hub Cards */}
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
              <LinearGradient
                pointerEvents="none"
                colors={['#F5FEFF', '#DCF7FE']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fill}
              />
              <View pointerEvents="none" style={styles.cardTopGloss} />
              <View style={[styles.tileIcon, styles.formulasTileIcon]}>
                <AppIcon name="explain" size={32} />
              </View>
              <Text numberOfLines={2} style={styles.tileTitle}>Formule & Fișe</Text>
              <Text numberOfLines={2} style={styles.tileNote}>
                {trackFormulas.length} fișe offline · exemple & capcane
              </Text>
              <View style={styles.tileFooterPill}>
                <Text style={styles.tileLinkText}>Deschide</Text>
                <MiniGlyph name="next" size={13} color={colors.cyanDeep} />
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
              <LinearGradient
                pointerEvents="none"
                colors={['#FFFDF2', '#FFF1BE']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fill}
              />
              <View pointerEvents="none" style={styles.cardTopGloss} />
              <View style={[styles.tileIcon, styles.examTileIcon]}>
                <AppIcon name="trophy" size={32} />
              </View>
              <Text numberOfLines={2} style={styles.tileTitle}>EN & BAC</Text>
              <Text numberOfLines={2} style={styles.tileNote}>
                {draftBanner
                  ? `⏸ În pauză: ${draftBanner.answered}/${draftBanner.total} itemi · ${draftBanner.remaining}`
                  : bestExamGrade !== null
                    ? `Record ${examGuide.shortTitle}: ${formatRomanianGrade(bestExamGrade)}`
                    : 'Simulări cronometrate, barem & ghid'}
              </Text>
              <View style={styles.tileFooterPillGold}>
                <Text style={styles.tileLinkTextGold}>{draftBanner ? 'Continuă' : 'Simulări'}</Text>
                <MiniGlyph name="next" size={13} color={colors.ink} />
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
                <Text style={styles.sectionTitle}>
                  {profile.hasChosenTrack ? `Formule cheie · ${trackMeta.shortLabel}` : 'Formule cheie · EN, BAC & baze'}
                </Text>
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
              accessibilityLabel={`Vezi toate cele ${formatRoCount(trackFormulas.length, 'formulă', 'formule')}${profile.hasChosenTrack ? ` pentru ${trackMeta.label}` : ''}`}
              pressedScale={0.975}
              haptic="selection"
              onPress={() => openFormulas()}
              contentStyle={styles.allFormulasCta}
            >
              <Text style={styles.allFormulasCtaText}>
                Deschide toate cele {formatRoCount(trackFormulas.length, 'fișă', 'fișe')} de formule
              </Text>
              <MiniGlyph name="next" size={16} color={colors.violetDeep} />
            </PressableScale>
          </View>
        </View>
      </ScrollView>

      {trackSheetEverOpened ? (
        <StudyTrackSheet
          visible={trackSheetOpen}
          selectedTrack={profile.hasChosenTrack ? profile.track : null}
          onSelect={handleSelectTrack}
          onClose={() => setTrackSheetOpen(false)}
        />
      ) : null}

      {streakSheetEverOpened ? (
        <StreakInfoSheet
          visible={streakSheetOpen}
          practiceState={practiceState}
          onClose={() => setStreakSheetOpen(false)}
          onStartQuickPractice={startQuickQuiz}
        />
      ) : null}

      <ActionToast toast={toast} bottomOffset={bottomClearance + 10} />
    </View>
  );
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },

  // Full-bleed curved Sapphire-Violet academy canopy
  canopy: {
    width: '100%',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    paddingBottom: 14,
    position: 'relative',
    zIndex: 4,
  },
  canopyGlowCyan: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -70,
    left: -60,
    backgroundColor: 'rgba(67, 214, 230, 0.2)',
  },
  canopyGlowRight: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    top: -20,
    right: -36,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  canopyGlowLime: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: -80,
    right: 28,
    backgroundColor: 'rgba(216, 255, 62, 0.14)',
  },
  canopyOrbitArc: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    top: -120,
    right: -90,
  },
  canopyStarA: {
    position: 'absolute',
    left: 24,
    bottom: 24,
    fontFamily: fonts.display,
    fontSize: 13,
    color: 'rgba(216, 255, 62, 0.36)',
  },
  canopyGlyphDelta: {
    position: 'absolute',
    right: 118,
    top: 58,
    fontFamily: fonts.display,
    fontSize: 28,
    color: 'rgba(67, 214, 230, 0.18)',
    transform: [{ rotate: '12deg' }],
  },
  canopyGlyphSum: {
    position: 'absolute',
    left: '44%',
    bottom: 12,
    fontFamily: fonts.display,
    fontSize: 26,
    color: 'rgba(255, 255, 255, 0.08)',
    transform: [{ rotate: '-8deg' }],
  },
  canopyInner: {
    maxWidth: 560,
    alignSelf: 'center',
    gap: 8,
  },

  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flexShrink: 1,
    minWidth: 0,
  },
  brandBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.2,
    borderColor: colors.lime,
    borderBottomWidth: 3.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTitle: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.35,
    textShadowColor: 'rgba(20, 6, 68, 0.28)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  headerStreakPill: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(216, 255, 62, 0.2)',
    borderWidth: 1.2,
    borderColor: 'rgba(216, 255, 62, 0.52)',
  },
  headerStreakText: {
    fontFamily: fonts.bodyBold,
    color: colors.lime,
    fontSize: 12,
    lineHeight: 15,
    includeFontPadding: false,
  },
  settingsWrap: {
    borderRadius: 21,
    borderBottomWidth: 3.5,
    borderBottomColor: '#C5B8FA',
    backgroundColor: '#FFFFFF',
  },

  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
  },
  heroEyebrowPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5.5,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  heroSwitchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.34)',
  },
  heroSwitchText: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 10.5,
    lineHeight: 13,
    includeFontPadding: false,
  },
  heroEyebrowDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
    backgroundColor: colors.lime,
  },
  heroEyebrowText: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 9.5,
    letterSpacing: 0.9,
    includeFontPadding: false,
  },
  heroTitle: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 22,
    lineHeight: 25.5,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(20, 6, 68, 0.24)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },
  heroProgressWrap: {
    marginTop: 2,
    gap: 5,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  progressLabel: {
    fontFamily: fonts.bodyBold,
    color: 'rgba(244, 240, 255, 0.92)',
    fontSize: 11,
  },
  progressFavs: {
    fontFamily: fonts.bodyBold,
    color: colors.lime,
    fontSize: 11,
  },
  heroMascotStage: {
    width: 88,
    height: 86,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  mascotFloorGlow: {
    position: 'absolute',
    bottom: 2,
    width: 56,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 4, 58, 0.26)',
  },

  scrollContent: {
    flexGrow: 1,
    paddingTop: 14,
  },
  page: {
    maxWidth: 560,
    alignSelf: 'center',
    gap: 13,
  },

  // Pure-white 3D Quick-Start Quest Card
  questCard: {
    borderRadius: 28,
    borderWidth: 1.5,
    borderBottomWidth: 5,
    borderColor: '#E5DAFA',
    borderBottomColor: '#D2C0F8',
    backgroundColor: '#FFFFFF',
    padding: 15,
    gap: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  studioTopGloss: {
    position: 'absolute',
    top: 1,
    left: 26,
    right: 26,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    zIndex: 2,
  },
  questTintCorner: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    top: -85,
    right: -60,
    backgroundColor: 'rgba(124, 60, 255, 0.06)',
  },
  questDotGrid: {
    position: 'absolute',
    top: 44,
    right: 18,
    gap: 6,
  },
  questDotRow: {
    flexDirection: 'row',
    gap: 6,
  },
  questDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(124, 60, 255, 0.12)',
  },
  questTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 2,
  },
  questStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#E1D3FE',
    backgroundColor: '#F4EEFF',
  },
  questSpark: {
    fontFamily: fonts.display,
    fontSize: 12,
    lineHeight: 14,
    color: colors.violet,
  },
  questStatusLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.85,
    color: colors.violetDeep,
    includeFontPadding: false,
  },
  questWrongPill: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: radii.pill,
    backgroundColor: colors.roseSoft,
    borderWidth: 1,
    borderColor: '#FAC0CE',
  },
  questWrongText: {
    fontFamily: fonts.bodyBold,
    color: colors.berryDeep,
    fontSize: 10,
    includeFontPadding: false,
  },
  questRecordPill: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: radii.pill,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: '#F6D778',
  },
  questRecordText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 10.5,
    includeFontPadding: false,
  },
  questDesc: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 17.5,
    zIndex: 2,
  },
  heroCta: {
    minHeight: 54,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderColor: '#EEFF96',
    borderBottomWidth: 4.5,
    borderBottomColor: '#8CB600',
    backgroundColor: colors.lime,
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
    top: 1.5,
    left: 24,
    right: 24,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    zIndex: 1,
  },
  heroCtaBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.paper,
    borderWidth: 1.2,
    borderColor: 'rgba(86, 120, 0, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    zIndex: 2,
  },
  heroCtaText: {
    flex: 1,
    flexShrink: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17.5,
    lineHeight: 21,
    zIndex: 2,
  },
  heroCtaArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    zIndex: 2,
  },

  // Full-width glossy AI Practice banner
  cardTopGloss: {
    position: 'absolute',
    top: 1,
    left: 16,
    right: 16,
    height: 1.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    zIndex: 1,
  },
  practiceCard: {
    borderRadius: 24,
    borderWidth: 1.4,
    borderBottomWidth: 4,
    borderColor: '#D6BEFF',
    borderBottomColor: '#B18CFF',
    backgroundColor: '#F4EEFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingLeft: 14,
    paddingRight: 13,
    gap: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  practiceRail: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 4.5,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors.violet,
    zIndex: 2,
  },
  practiceIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#DFD0FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    zIndex: 2,
  },
  practiceCopy: {
    flex: 1,
    minWidth: 0,
    zIndex: 2,
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
    backgroundColor: colors.rose,
  },
  practiceWrongText: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFD0FF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },

  // 2-Column Glossy Pastel 3D Hub Cards
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
    borderWidth: 1.4,
    borderBottomWidth: 4.5,
    padding: 14,
    gap: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  formulasTile: {
    backgroundColor: '#EBFBFF',
    borderColor: '#9EE8F7',
    borderBottomColor: '#5BC9DE',
  },
  examTile: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F8DC82',
    borderBottomColor: '#E5B72F',
  },
  tileIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    zIndex: 2,
  },
  formulasTileIcon: { borderColor: '#BCEFFA' },
  examTileIcon: { borderColor: '#FAE5A2' },
  tileTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17.5,
    lineHeight: 21,
    zIndex: 2,
  },
  tileNote: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 16,
    zIndex: 2,
  },
  tileFooterPill: {
    marginTop: 'auto',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BCEFFA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 2,
  },
  tileFooterPillGold: {
    marginTop: 'auto',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F8DA7A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 2,
  },
  tileLinkText: {
    fontFamily: fonts.bodyBold,
    color: colors.cyanDeep,
    fontSize: 11.5,
    includeFontPadding: false,
  },
  tileLinkTextGold: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 11.5,
    includeFontPadding: false,
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
    fontSize: 19.5,
    lineHeight: 23.5,
  },
  seeAllPill: {
    minHeight: 30,
    paddingHorizontal: 11,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderBottomWidth: 2.5,
    borderColor: '#DCD0F8',
    borderBottomColor: '#C5B3F5',
    backgroundColor: '#FFFFFF',
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
    minHeight: 38,
    borderRadius: radii.pill,
    borderWidth: 1.2,
    borderBottomWidth: 3,
    borderColor: '#E5DAFA',
    borderBottomColor: '#D4C2F8',
    backgroundColor: '#FFFFFF',
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
    minHeight: 50,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DAFA',
    borderBottomColor: '#D4C2F8',
    backgroundColor: '#FFFFFF',
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
    fontSize: 13.5,
    textAlign: 'center',
  },

  trackBannerCard: {
    borderRadius: 24,
    borderWidth: 1.4,
    borderBottomWidth: 4.5,
    borderColor: '#ECCB5B',
    borderBottomColor: '#D0A51E',
    backgroundColor: '#FFF9DC',
    paddingVertical: 13,
    paddingLeft: 15,
    paddingRight: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  draftBannerCard: {
    borderColor: '#C5EA63',
    borderBottomColor: '#8CB600',
    backgroundColor: '#F3FFD1',
  },
  trackBannerRail: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 4.5,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: '#D49600',
    zIndex: 2,
  },
  trackBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#F0D576',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    zIndex: 2,
  },
  trackBannerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    zIndex: 2,
  },
  trackBannerKicker: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.85,
    color: '#8A5600',
    includeFontPadding: false,
  },
  trackBannerTitle: {
    fontFamily: fonts.display,
    fontSize: 17.5,
    lineHeight: 21,
    color: '#5F3B00',
  },
  trackBannerNote: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16.5,
    color: colors.inkSoft,
  },
  trackBannerArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#F0D576',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    zIndex: 2,
  },
  pressed: { opacity: 0.78 },
});
