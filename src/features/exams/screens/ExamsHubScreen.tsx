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
  ExamGuideRouteId,
  ExamSimulationScopeParam,
  RootStackParamList,
} from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicBottomSheet } from '../../../shared/ui/ComicBottomSheet';
import { IconButton } from '../../../shared/ui/IconButton';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { SpotlightAura } from '../../../shared/ui/SpotlightAura';
import { Text } from '../../../shared/ui/Typography';
import { useStudyProfile } from '../../study/services/studyStorage';
import { getStudyTrackMeta } from '../../study/types';
import { EXAM_GUIDES, getExamGuide } from '../data/examGuidesCatalog';
import { getExamSimulationById, getExamSimulationsForExam } from '../data/examSimulationsCatalog';
import { clearExamDraft, useExamDraft } from '../services/examDraftStorage';
import { getBestGradeForExam, getBestGradeForVariant, useExamHistory } from '../services/examStorage';
import {
  countDraftAnsweredItems,
  formatExamCountdown,
  isDraftForSimulation,
} from '../utils/examDraft';
import {
  formatRomanianGrade,
  getScopeDurationMinutes,
  getScopeItems,
  getScopeTitle,
} from '../utils/examEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'ExamsHub'>;

const HERO_GRADIENTS: Record<ExamGuideRouteId, readonly [string, string, string, string]> = {
  en: ['#1B94C8', '#2F55E2', '#421CC6', '#2B1096'],
  bac_m1: ['#8D4BFF', '#6522EA', '#4814BE', '#310C90'],
  bac_m2: ['#7C3EF8', '#561FD4', '#3D13A6', '#290B78'],
  bac_m3: ['#DE4876', '#9D229E', '#5F15A8', '#3B0D82'],
};

const SUBJECT_ACCENTS = {
  s1: colors.violet,
  s2: colors.cyan,
  s3: colors.peach,
} as const;

export function ExamsHubScreen({ navigation, route }: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, contentWidth } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const motionActive = useScreenMotionActive(navigation, reducedMotion);
  const studyProfile = useStudyProfile();
  const history = useExamHistory();
  const savedDraft = useExamDraft();

  const defaultExamId = route.params?.examId ?? getStudyTrackMeta(studyProfile.track).examGuideId;
  const [examId, setExamId] = useState<ExamGuideRouteId>(defaultExamId);
  const [selectedVariantByExam, setSelectedVariantByExam] = useState<Partial<Record<ExamGuideRouteId, string>>>({});
  const [pendingStart, setPendingStart] = useState<{ variantId: string; scope: ExamSimulationScopeParam } | null>(null);
  const [discardSheetOpen, setDiscardSheetOpen] = useState(false);
  const navLockRef = useRef(false);

  useFocusEffect(useCallback(() => {
    navLockRef.current = false;
  }, []));

  const guide = useMemo(() => getExamGuide(examId), [examId]);
  const variants = useMemo(() => getExamSimulationsForExam(examId), [examId]);
  const activeVariant = useMemo(
    () => variants.find((item) => item.id === selectedVariantByExam[examId]) ?? variants[0],
    [examId, selectedVariantByExam, variants],
  );
  const activeVariantIndex = useMemo(() => {
    const idx = variants.findIndex((item) => item.id === activeVariant?.id);
    return idx >= 0 ? idx : 0;
  }, [activeVariant?.id, variants]);
  const bestGrade = useMemo(() => getBestGradeForExam(history, examId), [examId, history]);
  const recentExamRecords = useMemo(
    () => history.records.filter((record) => record.examId === examId).slice(0, 4),
    [examId, history.records],
  );

  const draftSummary = useMemo(() => {
    if (!savedDraft) return null;
    const draftVariant = getExamSimulationById(savedDraft.variantId);
    if (!draftVariant) return null;
    const draftGuide = getExamGuide(savedDraft.examId);
    const examVariants = getExamSimulationsForExam(savedDraft.examId);
    const variantIdx = examVariants.findIndex((item) => item.id === draftVariant.id);
    const draftItems = getScopeItems(draftVariant, savedDraft.scope);
    const answered = countDraftAnsweredItems(savedDraft, draftItems);
    return {
      draft: savedDraft,
      guideShortTitle: draftGuide.shortTitle,
      variantLabel: variantIdx >= 0 ? `Varianta ${variantIdx + 1}` : draftVariant.title,
      scopeTitle: getScopeTitle(savedDraft.scope),
      answered,
      total: draftItems.length,
      remainingLabel: formatExamCountdown(savedDraft.secondsLeft),
    };
  }, [savedDraft]);

  const activeFullDraftMatches = Boolean(
    activeVariant && isDraftForSimulation(savedDraft, activeVariant.id, 'full'),
  );

  const resumeSavedDraft = () => {
    if (!savedDraft || navLockRef.current) return;
    navLockRef.current = true;
    setPendingStart(null);
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    beginAppTransition();
    navigation.navigate('ExamSimulation', {
      variantId: savedDraft.variantId,
      scope: savedDraft.scope,
    });
  };

  const launchSimulation = (scope: ExamSimulationScopeParam) => {
    if (!activeVariant || navLockRef.current) return;
    if (savedDraft && !isDraftForSimulation(savedDraft, activeVariant.id, scope)) {
      Haptics.selection();
      setPendingStart({ variantId: activeVariant.id, scope });
      return;
    }
    navLockRef.current = true;
    beginAppTransition();
    navigation.navigate('ExamSimulation', {
      variantId: activeVariant.id,
      scope,
    });
  };

  const confirmStartFreshSimulation = () => {
    if (!pendingStart || navLockRef.current) return;
    const target = pendingStart;
    setPendingStart(null);
    clearExamDraft();
    navLockRef.current = true;
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    beginAppTransition();
    navigation.navigate('ExamSimulation', {
      variantId: target.variantId,
      scope: target.scope,
      fresh: true,
    });
  };

  const openGuide = useCallback(() => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    beginAppTransition();
    navigation.navigate('ExamGuide', { examId });
  }, [examId, navigation]);

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      <ComicBackdrop />

      {/* Full-bleed curved dynamic jewel canopy tuned to the selected exam */}
      <View style={[styles.canopy, { paddingTop: insets.top ?? 0 }]}>
        <LinearGradient
          colors={HERO_GRADIENTS[examId]}
          start={{ x: 0.06, y: 0 }}
          end={{ x: 0.94, y: 1 }}
          style={styles.fill}
        />
        <View pointerEvents="none" style={styles.canopyGlowLeft} />
        <View pointerEvents="none" style={styles.canopyGlowRight} />
        <View pointerEvents="none" style={styles.canopyOrbitArc} />
        <Text accessible={false} style={styles.canopyGlyphSum}>∑</Text>
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
                Examene <Text style={styles.canopyTitleAccent}>EN &amp; BAC</Text>
              </Text>
              <View style={styles.canopyEyebrowRow}>
                <View style={styles.canopyEyebrowDot} />
                <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.canopyEyebrow}>
                  {guide.eyebrow}
                </Text>
              </View>
            </View>

            <View style={styles.canopyTrophyBadge}>
              <AppIcon name="trophy" size={26} />
            </View>
          </View>

          <View style={styles.canopyHeroRow}>
            <View style={styles.canopyHeroCopy}>
              <View style={styles.heroBadgeRow}>
                <View style={styles.heroBadge}>
                  <Text maxFontSizeMultiplier={1.1} style={styles.heroBadgeText}>
                    ⏱ {guide.durationMinutes} min · 100p
                  </Text>
                </View>
                {bestGrade !== null ? (
                  <View style={styles.bestGradeBadge}>
                    <Text maxFontSizeMultiplier={1.1} style={styles.bestGradeText}>
                      ★ Record: {formatRomanianGrade(bestGrade)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={styles.canopyHeroTitle}>
                {activeVariant?.title ?? guide.title}
              </Text>
            </View>

            <View style={styles.heroMascotWrap}>
              <SpotlightAura size={76} tone="onViolet" active={motionActive} />
              <Mascot pose="cheer" size={78} active={motionActive} />
            </View>
          </View>
        </View>
      </View>

      {/* Straddling 3D tactile exam switcher */}
      <View style={styles.examPickerWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.examPickerRow, { paddingHorizontal: gutter }]}
        >
          {EXAM_GUIDES.map((item) => {
            const active = item.id === examId;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  if (active) return;
                  Haptics.selection();
                  setExamId(item.id);
                }}
                style={({ pressed }) => [
                  styles.examPill,
                  active && styles.examPillActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.examPillText, active && styles.examPillTextActive]}>
                  {item.shortTitle}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 18) + 24 },
        ]}
      >
        <View style={[styles.page, { maxWidth: contentWidth }]}>
          {draftSummary ? (
            <View style={styles.resumeCard}>
              <LinearGradient
                pointerEvents="none"
                colors={['#FFFDF2', '#FFF0B8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fill}
              />
              <View pointerEvents="none" style={styles.studioTopGloss} />
              <View style={styles.resumeRail} />
              <View style={styles.resumeTopRow}>
                <View style={styles.resumeBadge}>
                  <Text style={styles.resumeBadgeText}>
                    ⏸ SIMULARE ÎN PAUZĂ · {draftSummary.guideShortTitle.toUpperCase()}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Șterge simularea salvată"
                  hitSlop={8}
                  onPress={() => {
                    Haptics.selection();
                    setDiscardSheetOpen(true);
                  }}
                  style={({ pressed }) => [styles.resumeDiscardBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.resumeDiscardText}>Șterge</Text>
                </Pressable>
              </View>
              <Text style={styles.resumeTitle}>
                {draftSummary.variantLabel} · {draftSummary.scopeTitle}
              </Text>
              <Text style={styles.resumeMeta}>
                {draftSummary.answered}/{draftSummary.total} itemi completați · ⏱ {draftSummary.remainingLabel} timp rămas
              </Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Continuă simularea salvată ${draftSummary.guideShortTitle} ${draftSummary.variantLabel}`}
                pressedScale={0.97}
                haptic="medium"
                onPress={resumeSavedDraft}
                contentStyle={styles.resumeCta}
              >
                <LinearGradient
                  colors={['#EDFF7A', '#D8FF3E', '#BCEF12']}
                  start={{ x: 0.08, y: 0 }}
                  end={{ x: 0.92, y: 1 }}
                  style={styles.fill}
                />
                <View pointerEvents="none" style={styles.ctaTopGloss} />
                <Text style={styles.resumeCtaText}>Continuă de unde ai rămas</Text>
                <View style={styles.heroCtaArrow}>
                  <MiniGlyph name="next" size={16} color={colors.paper} />
                </View>
              </PressableScale>
            </View>
          ) : null}

          {/* Pure-white 3D Simulation Launch Studio Card */}
          <View style={styles.simStudioCard}>
            <View pointerEvents="none" style={styles.studioTopGloss} />
            <View pointerEvents="none" style={styles.studioCornerGlow} />
            <View style={styles.studioHeaderRow}>
              <View style={styles.studioKickerPill}>
                <Text accessible={false} style={styles.studioKickerSpark}>✦</Text>
                <Text maxFontSizeMultiplier={1.15} style={styles.studioKickerText}>
                  SIMULARE TIP EXAMEN · 1–10
                </Text>
              </View>
              <Text style={styles.studioOfficeText}>
                {variants.length > 1 ? `${variants.length} variante · 10p oficiu` : '10p oficiu'}
              </Text>
            </View>

            {variants.length > 1 ? (
              <View style={styles.variantGrid}>
                {variants.map((variant, index) => {
                  const selected = variant.id === activeVariant?.id;
                  const variantBest = getBestGradeForVariant(history, variant.id);
                  return (
                    <Pressable
                      key={variant.id}
                      accessibilityRole="tab"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Alege Varianta ${index + 1} pentru ${guide.shortTitle}`}
                      onPress={() => {
                        if (selected) return;
                        Haptics.selection();
                        setSelectedVariantByExam((prev) => ({ ...prev, [examId]: variant.id }));
                      }}
                      style={({ pressed }) => [
                        styles.variantPill,
                        selected && styles.variantPillActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.82}
                        maxFontSizeMultiplier={1.15}
                        style={[styles.variantPillTitle, selected && styles.variantPillTitleActive]}
                      >
                        Varianta {index + 1}
                      </Text>
                      <Text
                        numberOfLines={1}
                        maxFontSizeMultiplier={1.1}
                        style={[
                          styles.variantPillMeta,
                          variantBest !== null && styles.variantPillMetaScored,
                          selected && styles.variantPillMetaActive,
                        ]}
                      >
                        {variantBest !== null ? `★ ${formatRomanianGrade(variantBest)}` : '100p · nouă'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <Text style={styles.studioSubtitle}>
              {examId === 'en'
                ? 'Cronometru real, barem model pas cu pas, corectare foto AI la Subiectul III și notă estimată.'
                : 'Cronometru real, barem model pas cu pas, corectare foto AI la Subiectele II și III și notă estimată.'}
            </Text>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Începe simularea completă ${activeVariant?.title ?? guide.title}`}
              pressedScale={0.97}
              haptic="medium"
              onPress={() => launchSimulation('full')}
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
                <AppIcon name="trophy" size={24} />
              </View>
              <Text numberOfLines={2} style={styles.heroCtaText}>
                {activeFullDraftMatches && draftSummary
                  ? `Continuă Varianta ${activeVariantIndex + 1} (${draftSummary.answered}/${draftSummary.total})`
                  : variants.length > 1
                    ? `Începe Varianta ${activeVariantIndex + 1} completă`
                    : 'Începe simularea completă'}
              </Text>
              <View style={styles.heroCtaArrow}>
                <MiniGlyph name="next" size={16} color={colors.paper} />
              </View>
            </PressableScale>
          </View>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Vezi structura vizuală și modelele rezolvate pentru ${guide.title}`}
            pressedScale={0.975}
            haptic="light"
            onPress={openGuide}
            contentStyle={styles.guideCard}
          >
            <LinearGradient
              pointerEvents="none"
              colors={['#F5FEFF', '#DCF7FE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fill}
            />
            <View style={styles.guideRail} />
            <View style={styles.guideIcon}>
              <AppIcon name="explain" size={28} />
            </View>
            <View style={styles.guideCopy}>
              <Text style={styles.cardKicker}>STRUCTURĂ &amp; MODELE PE BAREM</Text>
              <Text style={styles.guideTitle}>Cum arată examenul ({guide.shortTitle})</Text>
              <Text numberOfLines={2} style={styles.guideNote}>
                10p oficiu + 30p S.I + 30p S.II + 30p S.III, strategia pe minute și modele rezolvate.
              </Text>
            </View>
            <View style={styles.guideArrow}>
              <MiniGlyph name="next" size={16} color={colors.cyanDeep} />
            </View>
          </PressableScale>

          <View style={styles.subjectsBlock}>
            <Text style={styles.sectionKicker}>
              ANTRENAMENT PE UN SINGUR SUBIECT · VARIANTA {activeVariantIndex + 1}
            </Text>
            <View style={styles.subjectsList}>
              {guide.subjects.map((subject) => {
                const mins = activeVariant ? getScopeDurationMinutes(activeVariant, subject.id) : subject.recommendedMinutes;
                const isRubric = subject.id === 's3' || (examId !== 'en' && subject.id === 's2');
                const subjectPaused = Boolean(
                  activeVariant && isDraftForSimulation(savedDraft, activeVariant.id, subject.id),
                );
                return (
                  <Pressable
                    key={subject.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Antrenament ${subject.label}, ${subject.points} puncte`}
                    onPress={() => {
                      Haptics.selection();
                      launchSimulation(subject.id);
                    }}
                    style={({ pressed }) => [styles.subjectCard, pressed && styles.pressed]}
                  >
                    <View style={[styles.subjectRail, { backgroundColor: SUBJECT_ACCENTS[subject.id] }]} />
                    <View style={styles.subjectBody}>
                      <View style={styles.subjectMetaRow}>
                        <View style={styles.subjectPtsPill}>
                          <Text style={styles.subjectPtsText}>{subject.points}p</Text>
                        </View>
                        <Text style={styles.subjectTimeText}>⏱ ~{mins} min</Text>
                        {subjectPaused ? (
                          <View style={styles.pausedSubjectTag}>
                            <Text style={styles.pausedSubjectTagText}>⏸ În pauză</Text>
                          </View>
                        ) : isRubric ? (
                          <View style={styles.aiPhotoTag}>
                            <Text style={styles.aiPhotoTagText}>📷 Corectare foto AI</Text>
                          </View>
                        ) : (
                          <View style={styles.autoTag}>
                            <Text style={styles.autoTagText}>⚡ Corectare automată</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.subjectTitle}>{subject.label}</Text>
                      <Text numberOfLines={2} style={styles.subjectFormat}>
                        {subject.formatLabel} · {subject.summary}
                      </Text>
                    </View>
                    <View style={styles.subjectArrow}>
                      <MiniGlyph name="next" size={15} color={colors.violetDeep} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {recentExamRecords.length > 0 ? (
            <View style={styles.historyBlock}>
              <Text style={styles.sectionKicker}>ULTIMELE TALE SIMULĂRI · {guide.shortTitle}</Text>
              <View style={styles.historyList}>
                {recentExamRecords.map((record) => {
                  const recVariantIdx = variants.findIndex((item) => item.id === record.variantId);
                  const variantPrefix = recVariantIdx >= 0 ? `Varianta ${recVariantIdx + 1} · ` : '';
                  return (
                    <View key={record.id} style={styles.historyRow}>
                      <View style={styles.historyGradeBadge}>
                        <Text style={styles.historyGradeText}>
                          {record.grade !== null
                            ? formatRomanianGrade(record.grade)
                            : `${record.awardedPoints}p`}
                        </Text>
                      </View>
                      <View style={styles.historyCopy}>
                        <Text style={styles.historyTitle}>
                          {variantPrefix}{getScopeTitle(record.scope)}
                        </Text>
                        <Text style={styles.historyMeta}>
                          {record.awardedPoints} din {record.maxPoints} puncte · {Math.max(1, Math.round(record.elapsedSeconds / 60))} min
                        </Text>
                        {typeof record.pauseCount === 'number' ? (
                          <View
                            style={[
                              styles.historyConditionTag,
                              record.pauseCount === 0 ? styles.historyConditionReal : styles.historyConditionPaused,
                            ]}
                          >
                            <Text
                              style={[
                                styles.historyConditionText,
                                record.pauseCount === 0 ? styles.historyConditionTextReal : styles.historyConditionTextPaused,
                              ]}
                            >
                              {record.pauseCount === 0
                                ? '✓ Condiții reale de examen'
                                : record.pauseCount === 1
                                  ? '⏸ Cu 1 pauză'
                                  : `⏸ Cu ${record.pauseCount} pauze`}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <ComicBottomSheet
        visible={pendingStart !== null}
        onClose={() => setPendingStart(null)}
        maxHeight="72%"
      >
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          <Text style={styles.sheetTitle}>Ai o simulare în pauză</Text>
          <Text style={styles.sheetBody}>
            {draftSummary
              ? `Ai progres salvat la ${draftSummary.guideShortTitle} · ${draftSummary.variantLabel} (${draftSummary.answered}/${draftSummary.total} itemi, ${draftSummary.remainingLabel} timp rămas). Vrei să o continui sau să începi simularea nouă?`
              : 'Ai deja o simulare salvată. Vrei să o continui sau să începi una nouă?'}
          </Text>
          <View style={styles.sheetActions}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Continuă simularea salvată"
              pressedScale={0.97}
              haptic="medium"
              onPress={resumeSavedDraft}
              contentStyle={styles.sheetPrimaryBtn}
            >
              <Text style={styles.sheetPrimaryText}>Continuă simularea salvată</Text>
            </PressableScale>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Începe simularea nouă și înlocuiește progresul salvat"
              onPress={confirmStartFreshSimulation}
              style={({ pressed }) => [styles.sheetDangerBtn, pressed && styles.pressed]}
            >
              <Text style={styles.sheetDangerText}>Începe simularea nouă (înlocuiește progresul)</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Anulează"
              onPress={() => setPendingStart(null)}
              style={({ pressed }) => [styles.sheetCancelBtn, pressed && styles.pressed]}
            >
              <Text style={styles.sheetCancelText}>Anulează</Text>
            </Pressable>
          </View>
        </ScrollView>
      </ComicBottomSheet>

      <ComicBottomSheet
        visible={discardSheetOpen}
        onClose={() => setDiscardSheetOpen(false)}
        maxHeight="62%"
      >
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          <Text style={styles.sheetTitle}>Ștergi simularea salvată?</Text>
          <Text style={styles.sheetBody}>
            {draftSummary
              ? `Progresul salvat pentru ${draftSummary.guideShortTitle} · ${draftSummary.variantLabel} (${draftSummary.answered}/${draftSummary.total} itemi) va fi șters definitiv.`
              : 'Progresul simulării în pauză va fi șters.'}
          </Text>
          <View style={styles.sheetActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Șterge definitiv simularea salvată"
              onPress={() => {
                Haptics.selection();
                clearExamDraft();
                setDiscardSheetOpen(false);
              }}
              style={({ pressed }) => [styles.sheetDangerBtn, pressed && styles.pressed]}
            >
              <Text style={styles.sheetDangerText}>Da, șterge progresul salvat</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Păstrează simularea salvată"
              onPress={() => setDiscardSheetOpen(false)}
              style={({ pressed }) => [styles.sheetCancelBtn, pressed && styles.pressed]}
            >
              <Text style={styles.sheetCancelText}>Păstrează</Text>
            </Pressable>
          </View>
        </ScrollView>
      </ComicBottomSheet>
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
    paddingBottom: 28,
    position: 'relative',
    zIndex: 4,
  },
  canopyGlowLeft: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -80,
    left: -50,
    backgroundColor: 'rgba(67, 214, 230, 0.2)',
  },
  canopyGlowRight: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    bottom: -75,
    right: 20,
    backgroundColor: 'rgba(216, 255, 62, 0.16)',
  },
  canopyOrbitArc: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    top: -120,
    right: -85,
  },
  canopyGlyphSum: {
    position: 'absolute',
    right: 112,
    top: 56,
    fontFamily: fonts.display,
    fontSize: 26,
    color: 'rgba(255, 255, 255, 0.12)',
    transform: [{ rotate: '-10deg' }],
  },
  canopyStar: {
    position: 'absolute',
    left: 24,
    bottom: 24,
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
    gap: 6,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
  },
  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(18, 12, 46, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroBadgeText: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 11,
    includeFontPadding: false,
  },
  bestGradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
  },
  bestGradeText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 11,
    includeFontPadding: false,
  },
  canopyHeroTitle: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 19,
    lineHeight: 23,
    textShadowColor: 'rgba(18, 6, 62, 0.24)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heroMascotWrap: {
    width: 82,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },

  examPickerWrap: { marginTop: -20, paddingBottom: 10, zIndex: 8 },
  examPickerRow: { gap: 8, alignItems: 'center' },
  examPill: {
    minHeight: 38,
    paddingHorizontal: 15,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  examPillActive: {
    borderColor: colors.violet,
    borderBottomColor: '#3C12A8',
    backgroundColor: colors.violet,
  },
  examPillText: {
    fontFamily: fonts.bodyBold,
    color: colors.inkSoft,
    fontSize: 12.5,
    includeFontPadding: false,
  },
  examPillTextActive: { color: colors.paper },

  scrollContent: { flexGrow: 1, paddingTop: 2 },
  page: { width: '100%', alignSelf: 'center', gap: 13 },

  simStudioCard: {
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
  studioCornerGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    top: -64,
    right: -46,
    backgroundColor: 'rgba(255, 208, 44, 0.14)',
  },
  studioHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  studioKickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.goldSoft,
  },
  studioKickerSpark: {
    fontFamily: fonts.display,
    color: '#A56A00',
    fontSize: 11,
  },
  studioKickerText: {
    fontFamily: fonts.bodyBold,
    color: '#7D4E00',
    fontSize: 10,
    letterSpacing: 0.7,
    includeFontPadding: false,
  },
  studioOfficeText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 11,
  },
  variantGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  variantPill: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1.4,
    borderBottomWidth: 3.2,
    borderColor: '#E5DCFF',
    borderBottomColor: '#D4C7F7',
    backgroundColor: '#FAF8FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  variantPillActive: {
    borderColor: colors.violet,
    borderBottomColor: '#3C12A8',
    backgroundColor: colors.violet,
  },
  variantPillTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 13.5,
    includeFontPadding: false,
  },
  variantPillTitleActive: {
    color: colors.paper,
  },
  variantPillMeta: {
    fontFamily: fonts.bodyBold,
    color: colors.inkMuted,
    fontSize: 10.5,
    includeFontPadding: false,
  },
  variantPillMetaScored: {
    color: '#2A7A16',
  },
  variantPillMetaActive: {
    color: colors.lime,
  },
  studioSubtitle: {
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
    fontSize: 16.5,
    lineHeight: 20.5,
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

  guideCard: {
    borderRadius: 24,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#BCEBF7',
    borderBottomColor: '#8ED4E8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 13,
    gap: 11,
    overflow: 'hidden',
  },
  guideRail: {
    width: 5,
    alignSelf: 'stretch',
    backgroundColor: colors.cyan,
  },
  guideIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BCEBF7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  guideCopy: { flex: 1, minWidth: 0, paddingVertical: 13 },
  cardKicker: {
    ...typography.kicker,
    fontSize: 9.5,
    color: colors.cyanDeep,
  },
  guideTitle: {
    marginTop: 2,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 20.5,
  },
  guideNote: {
    marginTop: 2,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 16.5,
  },
  guideArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  subjectsBlock: { gap: 9, marginTop: 2 },
  sectionKicker: {
    ...typography.kicker,
    fontSize: 10.5,
    color: colors.violetDeep,
    paddingHorizontal: 2,
  },
  subjectsList: { gap: 10 },
  subjectCard: {
    borderRadius: 22,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E8E0FC',
    borderBottomColor: '#D4C7F7',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    gap: 10,
    overflow: 'hidden',
  },
  subjectRail: {
    width: 5,
    alignSelf: 'stretch',
  },
  subjectBody: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    paddingLeft: 2,
    gap: 4,
  },
  subjectMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  subjectPtsPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
  },
  subjectPtsText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 10.5,
    includeFontPadding: false,
  },
  subjectTimeText: {
    fontFamily: fonts.bodyBold,
    color: colors.inkMuted,
    fontSize: 11,
  },
  aiPhotoTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.limeSoft,
  },
  aiPhotoTagText: {
    fontFamily: fonts.bodyBold,
    color: colors.limeDeep,
    fontSize: 10,
    includeFontPadding: false,
  },
  autoTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.cyanSoft,
  },
  autoTagText: {
    fontFamily: fonts.bodyBold,
    color: colors.cyanDeep,
    fontSize: 10,
    includeFontPadding: false,
  },
  subjectTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 16.5,
    lineHeight: 20,
  },
  subjectFormat: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 16.5,
  },
  subjectArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  historyBlock: { gap: 9, marginTop: 2 },
  historyList: { gap: 9 },
  historyRow: {
    borderRadius: 20,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E8E0FC',
    borderBottomColor: '#D4C7F7',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    gap: 11,
  },
  historyGradeBadge: {
    minWidth: 54,
    height: 42,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#C5E67A',
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  historyGradeText: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17,
  },
  historyCopy: { flex: 1, minWidth: 0 },
  historyTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 15.5,
  },
  historyMeta: {
    marginTop: 2,
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 12,
  },
  historyConditionTag: {
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  historyConditionReal: {
    backgroundColor: colors.limeSoft,
    borderColor: '#C5E67A',
  },
  historyConditionPaused: {
    backgroundColor: '#FAF6FF',
    borderColor: '#E5DCFF',
  },
  historyConditionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    includeFontPadding: false,
  },
  historyConditionTextReal: {
    color: colors.limeDeep,
  },
  historyConditionTextPaused: {
    color: colors.inkSoft,
  },
  resumeCard: {
    borderRadius: 26,
    borderWidth: 1.5,
    borderBottomWidth: 5,
    borderColor: '#ECCB5B',
    borderBottomColor: '#D0A51E',
    backgroundColor: '#FFF9DC',
    paddingVertical: 15,
    paddingLeft: 18,
    paddingRight: 15,
    gap: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  resumeRail: {
    position: 'absolute',
    left: 0,
    top: 16,
    bottom: 16,
    width: 4.5,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: '#D49600',
    zIndex: 2,
  },
  resumeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 2,
  },
  resumeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: '#FFF2B2',
    borderWidth: 1,
    borderColor: '#E5BF3A',
    flexShrink: 1,
  },
  resumeBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.7,
    color: '#6E4600',
    includeFontPadding: false,
  },
  resumeDiscardBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: '#E8D08A',
  },
  resumeDiscardText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#8C5800',
    includeFontPadding: false,
  },
  resumeTitle: {
    fontFamily: fonts.display,
    fontSize: 18.5,
    lineHeight: 22.5,
    color: '#5A3600',
    zIndex: 2,
  },
  resumeMeta: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.inkSoft,
    zIndex: 2,
  },
  resumeCta: {
    marginTop: 4,
    minHeight: 50,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderColor: '#EEFF96',
    borderBottomWidth: 4,
    borderBottomColor: '#8CB600',
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 18,
    paddingRight: 10,
    paddingVertical: 8,
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 2,
  },
  resumeCtaText: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 15.5,
    color: colors.ink,
  },
  pausedSubjectTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: '#FFF3BF',
    borderWidth: 1,
    borderColor: '#E5BE3A',
  },
  pausedSubjectTagText: {
    fontFamily: fonts.bodyBold,
    color: '#6E4600',
    fontSize: 10,
    includeFontPadding: false,
  },
  sheetTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 21,
    textAlign: 'center',
  },
  sheetBody: {
    marginTop: 6,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  sheetActions: {
    marginTop: 14,
    gap: 9,
  },
  sheetPrimaryBtn: {
    minHeight: 50,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: '#E8FF78',
    borderBottomColor: '#7EA508',
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sheetPrimaryText: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 15.5,
    textAlign: 'center',
  },
  sheetDangerBtn: {
    minHeight: 46,
    borderRadius: radii.pill,
    borderWidth: 1.2,
    borderBottomWidth: 2.8,
    borderColor: '#F8B9C7',
    borderBottomColor: '#E07990',
    backgroundColor: '#FFF1F4',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  sheetDangerText: {
    fontFamily: fonts.bodyBold,
    color: '#A51D36',
    fontSize: 13,
    textAlign: 'center',
  },
  sheetCancelBtn: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  sheetCancelText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 13.5,
  },
  pressed: { opacity: 0.82 },
});
