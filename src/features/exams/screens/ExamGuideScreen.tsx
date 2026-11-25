import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { InteractionManager, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { beginAppTransition } from '../../../shared/context/TransitionMotionContext';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { useTransitionSettled } from '../../../shared/hooks/useTransitionSettled';
import * as Haptics from '../../../shared/services/haptics';
import {
  getMathReadingScale,
  mathReadingScaleBadge,
  nextMathReadingScale,
  setMathReadingScale,
  type MathReadingScale,
} from '../../../shared/storage/localPreferences';
import { colors, fonts, radii, typography } from '../../../shared/theme';
import type { RootStackParamList } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicBottomSheet } from '../../../shared/ui/ComicBottomSheet';
import { ComicTabBar, type ComicTabOption } from '../../../shared/ui/ComicTabBar';
import { IconButton } from '../../../shared/ui/IconButton';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { StepTransitionStage } from '../../../shared/ui/StepTransitionStage';
import { Text } from '../../../shared/ui/Typography';
import { StudyInlineText } from '../../study/components/StudyInlineText';
import { StudyBlocksView } from '../../study/components/StudyRichContent';
import { useStudyProfile } from '../../study/services/studyStorage';
import {
  getFormulaCategoryMeta,
  getStudyTrackMeta,
  type ExamGuide,
  type ExamGuideId,
  type FormulaEntry,
} from '../../study/types';
import { prewarmStudyMath } from '../../study/utils/prewarmStudyMath';
import { getFormulaById } from '../../study/utils/studyDocumentBuilder';
import { EXAM_GUIDES, getExamGuide } from '../data/examGuidesCatalog';
import { getExamSimulationsForExam } from '../data/examSimulationsCatalog';

type Props = NativeStackScreenProps<RootStackParamList, 'ExamGuide'>;
type SubjectId = 's1' | 's2' | 's3';

const HERO_GRADIENTS: Record<ExamGuide['accent'], readonly [string, string, string]> = {
  cyan: ['#188AA8', '#3B5BE0', '#4D1FC9'],
  violet: ['#8D50FF', '#6222E6', '#3E11A8'],
  peach: ['#D94A6B', '#8E28A8', '#4A1694'],
  gold: ['#7B38EA', '#5320C9', '#32107C'],
};

const SEGMENT_COLORS = {
  office: colors.lime,
  s1: colors.cyan,
  s2: colors.gold,
  s3: colors.peach,
} as const;

export function ExamGuideScreen({ navigation, route }: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, contentWidth, isNarrow } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const transitionSettled = useTransitionSettled(navigation, reducedMotion);
  const profile = useStudyProfile();
  const defaultExamId = route.params?.examId ?? getStudyTrackMeta(profile.track).examGuideId;

  const [examId, setExamId] = useState<ExamGuideId>(defaultExamId);
  const [subjectId, setSubjectId] = useState<SubjectId>('s1');
  const [subjectTransition, setSubjectTransition] = useState<{ direction: -1 | 0 | 1; animate: boolean }>({
    direction: 0,
    animate: false,
  });
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [modelSheetVisible, setModelSheetVisible] = useState(false);
  const [modelSheetEverOpened, setModelSheetEverOpened] = useState(false);
  const [readingScale, setReadingScale] = useState<MathReadingScale>(() => getMathReadingScale());

  const guide = useMemo(() => getExamGuide(examId), [examId]);
  const subject = useMemo(
    () => guide.subjects.find((item) => item.id === subjectId) ?? guide.subjects[0],
    [guide, subjectId],
  );
  const boundedPageWidth = Math.min(contentWidth, frame.width - gutter * 2);

  // Silently pre-parse the model problem & solution SVGs strictly after the
  // push transition settles so opening Cum arată examenul stays locked at 60fps.
  useEffect(() => {
    if (!transitionSettled) return undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      for (const item of guide.subjects) {
        prewarmStudyMath({
          blocks: [...item.modelProblem, ...item.modelSolution],
          inlineTexts: [
            ...item.gradingTips,
            ...item.rubricBreakdown.map((crit) => crit.step),
          ],
        });
      }
    });
    return () => task.cancel();
  }, [guide, transitionSettled]);

  const subjectTabs = useMemo<readonly ComicTabOption<SubjectId>[]>(() => [
    {
      value: 's1',
      label: isNarrow ? 'S. I' : 'Sub. I',
      badge: `${guide.subjects[0].points}p`,
      activeFill: colors.violet,
      activeText: colors.paper,
      badgeFill: colors.lime,
      badgeText: colors.ink,
    },
    {
      value: 's2',
      label: isNarrow ? 'S. II' : 'Sub. II',
      badge: `${guide.subjects[1].points}p`,
      activeFill: colors.cyan,
      activeText: colors.ink,
      badgeFill: colors.paper,
      badgeText: colors.ink,
    },
    {
      value: 's3',
      label: isNarrow ? 'S. III' : 'Sub. III',
      badge: `${guide.subjects[2].points}p`,
      activeFill: colors.peach,
      activeText: colors.ink,
      badgeFill: colors.paper,
      badgeText: colors.ink,
    },
  ], [guide.subjects, isNarrow]);

  const relatedFormulas = useMemo(
    () => subject.relatedFormulaIds
      .map((id) => getFormulaById(id))
      .filter((item): item is FormulaEntry => Boolean(item)),
    [subject.relatedFormulaIds],
  );

  const selectExam = useCallback((nextId: ExamGuideId) => {
    if (nextId === examId) return;
    Haptics.selection();
    setSubjectTransition({ direction: 0, animate: false });
    setExamId(nextId);
    setSubjectId('s1');
  }, [examId]);

  const selectSubject = useCallback((next: SubjectId) => {
    if (next === subjectId) return;
    const order: Record<SubjectId, number> = { s1: 0, s2: 1, s3: 2 };
    setSubjectTransition({ direction: order[next] > order[subjectId] ? 1 : -1, animate: true });
    setSubjectId(next);
  }, [subjectId]);

  const openModelSheet = useCallback(() => {
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    setModelSheetEverOpened(true);
    setModelSheetVisible(true);
  }, []);

  const cycleScale = useCallback(() => {
    Haptics.selection();
    setReadingScale((current) => {
      const next = nextMathReadingScale(current);
      setMathReadingScale(next);
      return next;
    });
  }, []);

  const openFormula = useCallback((formulaId: string) => {
    Haptics.selection();
    beginAppTransition();
    navigation.navigate('FormulaDetail', {
      formulaId,
      formulaIds: relatedFormulas.map((item) => item.id),
    });
  }, [navigation, relatedFormulas]);

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      <ComicBackdrop />

      {/* Full-bleed curved dynamic Exam Guide Canopy */}
      <View style={[styles.canopy, { paddingTop: insets.top ?? 0 }]}>
        <LinearGradient
          colors={HERO_GRADIENTS[guide.accent]}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={styles.fill}
        />
        <View pointerEvents="none" style={styles.canopyGlow} />
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
                Cum arată <Text style={styles.canopyTitleAccent}>examenul</Text>
              </Text>
              <View style={styles.canopyEyebrowRow}>
                <View style={styles.canopyEyebrowDot} />
                <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.canopyEyebrow}>
                  {guide.eyebrow}
                </Text>
              </View>
            </View>

            <View accessible={false} style={styles.canopyTrophyBadge}>
              <AppIcon name="trophy" size={24} />
            </View>
          </View>

          <View style={styles.canopyMetaRow}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>⏱ {guide.durationMinutes} min</Text>
            </View>
            <View style={styles.heroBadgeLime}>
              <Text style={styles.heroBadgeLimeText}>★ {guide.totalPoints} puncte</Text>
            </View>
            <Text numberOfLines={1} style={styles.canopyExamTitle}>
              {guide.title}
            </Text>
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
                onPress={() => selectExam(item.id)}
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
          styles.content,
          { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 18) + 22 },
        ]}
      >
        <View style={[styles.page, { maxWidth: contentWidth }]}>
        {/* Pure-white 3D porcelain structure & points breakdown studio card */}
        <View style={styles.overviewCard}>
          <View pointerEvents="none" style={styles.cardTopGloss} />

          <Text style={styles.overviewTitle}>{guide.title}</Text>
          <Text style={styles.overviewSubtitle}>{guide.subtitle}</Text>

          <View style={styles.pointsBarWrap}>
            <View style={styles.pointsBarTrack}>
              <View style={[styles.pointsSeg, { flex: guide.officePoints, backgroundColor: SEGMENT_COLORS.office }]} />
              <View style={[styles.pointsSeg, { flex: guide.subjects[0].points, backgroundColor: SEGMENT_COLORS.s1 }]} />
              <View style={[styles.pointsSeg, { flex: guide.subjects[1].points, backgroundColor: SEGMENT_COLORS.s2 }]} />
              <View style={[styles.pointsSeg, { flex: guide.subjects[2].points, backgroundColor: SEGMENT_COLORS.s3 }]} />
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: SEGMENT_COLORS.office }]} />
                <Text style={styles.legendText}>{guide.officePoints}p oficiu</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: SEGMENT_COLORS.s1 }]} />
                <Text style={styles.legendText}>30p S.I</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: SEGMENT_COLORS.s2 }]} />
                <Text style={styles.legendText}>30p S.II</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: SEGMENT_COLORS.s3 }]} />
                <Text style={styles.legendText}>30p S.III</Text>
              </View>
            </View>
          </View>

          <StudyInlineText
            text={guide.overviewNote}
            scale={0.93}
            color={colors.inkSoft}
            textStyle={styles.heroOverview}
            containerStyle={styles.heroOverviewWrap}
            maxMathWidth={Math.max(210, boundedPageWidth - 38)}
          />

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Începe simularea completă pentru ${guide.title}`}
            pressedScale={0.97}
            haptic="medium"
            onPress={() => {
              const sim = getExamSimulationsForExam(examId)[0];
              if (!sim) return;
              beginAppTransition();
              navigation.navigate('ExamSimulation', { variantId: sim.id, scope: 'full' });
            }}
            contentStyle={styles.heroSimCta}
          >
            <LinearGradient
              colors={['#EDFF7A', '#D8FF3E', '#BCEF12']}
              start={{ x: 0.08, y: 0 }}
              end={{ x: 0.92, y: 1 }}
              style={styles.fill}
            />
            <View pointerEvents="none" style={styles.ctaTopGloss} />
            <View style={styles.ctaIconBadge}>
              <AppIcon name="trophy" size={22} />
            </View>
            <Text numberOfLines={2} style={styles.heroSimCtaText}>
              Simulare completă · {guide.shortTitle}
            </Text>
            <View style={styles.heroSimCtaArrow}>
              <MiniGlyph name="next" size={15} color={colors.paper} />
            </View>
          </PressableScale>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: strategyOpen }}
          onPress={() => {
            Haptics.selection();
            setStrategyOpen((value) => !value);
          }}
          style={({ pressed }) => [styles.strategyCard, pressed && styles.pressed]}
        >
          <View style={styles.strategyHeader}>
            <View style={styles.strategyIcon}>
              <AppIcon name="hint" size={24} />
            </View>
            <View style={styles.strategyCopy}>
              <Text style={styles.cardEyebrow}>PLANIFICARE ÎN SALĂ</Text>
              <Text style={styles.cardTitle}>Strategia de timp ({guide.durationMinutes} min)</Text>
            </View>
            <View style={styles.chevronBadge}>
              <Text style={styles.chevronText}>{strategyOpen ? '▴' : '▾'}</Text>
            </View>
          </View>

          {strategyOpen ? (
            <View style={styles.strategyList}>
              {guide.timeStrategy.map((tip, index) => (
                <View key={tip} style={styles.tipRow}>
                  <View style={styles.tipIndex}>
                    <Text style={styles.tipIndexText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Pressable>

        <View style={styles.subjectSection}>
          <Text style={styles.sectionKicker}>EXPLOREAZĂ SUBIECTELE</Text>
          <ComicTabBar
            options={subjectTabs}
            value={subjectId}
            onChange={selectSubject}
          />
        </View>

        <StepTransitionStage
          key={`${examId}-${subjectId}`}
          direction={subjectTransition.direction}
          animate={subjectTransition.animate}
          style={styles.subjectStage}
        >
        <View style={styles.detailCard}>
          <View style={styles.detailMetaRow}>
            <View style={styles.formatPill}>
              <Text style={styles.formatPillText}>{subject.formatLabel}</Text>
            </View>
            <View style={styles.timePill}>
              <Text style={styles.timePillText}>⏱ ~{subject.recommendedMinutes} min</Text>
            </View>
          </View>

          <Text style={styles.detailTitle}>{subject.label}</Text>
          <Text style={styles.detailSummary}>{subject.summary}</Text>

          <Text style={styles.subHeading}>Ce pică cel mai des</Text>
          <View style={styles.topicChipGrid}>
            {subject.frequentTopics.map((topic) => (
              <View key={topic} style={styles.topicChip}>
                <Text style={styles.topicChipText}>{topic}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.subHeading}>Cum punctează baremul</Text>
          <View style={styles.tipsStack}>
            {subject.gradingTips.map((tip) => (
              <View key={tip} style={styles.gradingTipRow}>
                <View style={styles.checkDot}>
                  <MiniGlyph name="check" size={11} color={colors.ink} />
                </View>
                <View style={styles.flexOne}>
                  <StudyInlineText
                    text={tip}
                    scale={0.93}
                    color={colors.ink}
                    textStyle={styles.gradingTipText}
                    maxMathWidth={Math.max(180, boundedPageWidth - 72)}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.modelCard}>
          <View style={styles.modelTopRow}>
            <View style={styles.modelBadge}>
              <Text style={styles.modelBadgeText}>✦ MODEL PE BAREM</Text>
            </View>
            <Text style={styles.modelPointsCount}>{subject.rubricBreakdown.length} {subject.rubricBreakdown.length === 1 ? 'criteriu' : 'criterii'}</Text>
          </View>

          <Text style={styles.modelTitle}>{subject.modelTitle}</Text>

          <View style={styles.rubricPreviewRow}>
            {subject.rubricBreakdown.map((item) => (
              <View key={`${item.points}-${item.step}`} style={styles.rubricPill}>
                <Text style={styles.rubricPillPoints}>{item.points}</Text>
                <View style={styles.flexOne}>
                  <StudyInlineText
                    text={item.step}
                    scale={0.9}
                    color={colors.ink}
                    textStyle={styles.rubricPillStep}
                    maxMathWidth={Math.max(170, boundedPageWidth - 96)}
                  />
                </View>
              </View>
            ))}
          </View>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Deschide modelul rezolvat: ${subject.modelTitle}`}
            pressedScale={0.97}
            haptic="medium"
            onPress={openModelSheet}
            contentStyle={styles.modelCta}
          >
            <LinearGradient
              colors={['#EDFF7A', '#D8FF3E', '#BCEF12']}
              start={{ x: 0.08, y: 0 }}
              end={{ x: 0.92, y: 1 }}
              style={styles.fill}
            />
            <View pointerEvents="none" style={styles.ctaTopGloss} />
            <View style={styles.ctaIconBadge}>
              <AppIcon name="explain" size={22} />
            </View>
            <Text numberOfLines={2} style={styles.modelCtaText}>
              Vezi modelul rezolvat pe barem
            </Text>
            <View style={styles.modelCtaArrow}>
              <MiniGlyph name="next" size={15} color={colors.paper} />
            </View>
          </PressableScale>
        </View>

        {relatedFormulas.length > 0 ? (
          <View style={styles.formulasBlock}>
            <Text style={styles.sectionKicker}>FORMULE CHEIE PENTRU {subject.shortLabel.toUpperCase()}</Text>
            <View style={styles.formulasList}>
              {relatedFormulas.map((formula) => {
                const cat = getFormulaCategoryMeta(formula.category);
                return (
                  <Pressable
                    key={formula.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Deschide formula ${formula.title}`}
                    onPress={() => openFormula(formula.id)}
                    style={({ pressed }) => [styles.miniFormulaRow, pressed && styles.pressed]}
                  >
                    <View style={[styles.miniFormulaDot, { backgroundColor: cat.accent }]} />
                    <View style={styles.miniFormulaCopy}>
                      <Text numberOfLines={1} style={styles.miniFormulaTitle}>{formula.title}</Text>
                      <Text numberOfLines={1} style={styles.miniFormulaPreview}>{formula.preview}</Text>
                    </View>
                    <View style={styles.miniFormulaArrow}>
                      <MiniGlyph name="next" size={14} color={colors.violetDeep} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        </StepTransitionStage>
        </View>
      </ScrollView>

      {modelSheetEverOpened ? (
        <ComicBottomSheet
          visible={modelSheetVisible}
          onClose={() => setModelSheetVisible(false)}
          maxHeight="90%"
          sheetStyle={styles.modelSheetContainer}
        >
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderCopy}>
              <Text style={styles.cardEyebrow}>{guide.shortTitle} · {subject.shortLabel.toUpperCase()}</Text>
              <Text numberOfLines={2} style={styles.sheetTitle}>{subject.modelTitle}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mărime text formule: ${mathReadingScaleBadge(readingScale)}`}
              hitSlop={6}
              onPress={cycleScale}
              style={({ pressed }) => [styles.scaleButton, pressed && styles.pressed]}
            >
              <Text style={styles.scaleButtonText}>{mathReadingScaleBadge(readingScale)}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Închide modelul rezolvat"
              hitSlop={8}
              onPress={() => {
                Haptics.selection();
                setModelSheetVisible(false);
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
            <View style={styles.sheetSectionCard}>
              <Text style={styles.cardEyebrow}>ENUNȚ MODEL · {subject.formatLabel.toUpperCase()}</Text>
              <StudyBlocksView
                key={`prob-${examId}-${subjectId}`}
                blocks={subject.modelProblem}
                scale={readingScale}
                maxWidth={Math.max(220, boundedPageWidth - 32)}
                accent={guide.accent === 'gold' ? 'lime' : guide.accent}
              />
            </View>

            <View style={styles.sheetSectionCard}>
              <Text style={styles.cardEyebrow}>REZOLVARE PAS CU PAS</Text>
              <StudyBlocksView
                key={`sol-${examId}-${subjectId}`}
                blocks={subject.modelSolution}
                scale={readingScale}
                maxWidth={Math.max(220, boundedPageWidth - 32)}
                accent={guide.accent === 'gold' ? 'lime' : guide.accent}
              />
            </View>

            <View style={styles.sheetSectionCard}>
              <Text style={styles.cardEyebrow}>BAREM OFICIAL DE PUNCTARE</Text>
              <View style={styles.sheetRubricList}>
                {subject.rubricBreakdown.map((item, idx) => (
                  <View key={`sr-${idx}`} style={styles.sheetRubricRow}>
                    <View style={styles.sheetRubricPts}>
                      <Text style={styles.sheetRubricPtsText}>{item.points}</Text>
                    </View>
                    <View style={styles.flexOne}>
                      <StudyInlineText
                        text={item.step}
                        scale={readingScale * 0.94}
                        maxMathWidth={Math.max(180, boundedPageWidth - 94)}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </ComicBottomSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  page: { width: '100%', alignSelf: 'center', gap: 14 },
  subjectStage: { gap: 14 },

  canopy: {
    width: '100%',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    paddingBottom: 32,
    position: 'relative',
    zIndex: 4,
  },
  canopyGlow: {
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
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: -70,
    left: -30,
    backgroundColor: 'rgba(216, 255, 62, 0.15)',
  },
  canopyOrbitArc: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    top: -120,
    right: -85,
  },
  canopyGlyphSum: {
    position: 'absolute',
    right: 78,
    bottom: 14,
    fontFamily: fonts.display,
    fontSize: 28,
    color: 'rgba(255, 255, 255, 0.12)',
    transform: [{ rotate: '-10deg' }],
  },
  canopyGlyphStar: {
    position: 'absolute',
    left: 24,
    bottom: 10,
    fontFamily: fonts.display,
    fontSize: 18,
    color: 'rgba(216, 255, 62, 0.25)',
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
  canopyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  canopyExamTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bodyBold,
    color: 'rgba(248, 245, 255, 0.94)',
    fontSize: 12,
    includeFontPadding: false,
  },

  examPickerWrap: {
    marginTop: -20,
    paddingBottom: 10,
    zIndex: 8,
  },
  examPickerRow: {
    gap: 8,
    alignItems: 'center',
  },
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
    lineHeight: 16,
    includeFontPadding: false,
  },
  examPillTextActive: {
    color: colors.paper,
  },
  content: {
    paddingTop: 2,
    alignItems: 'center',
  },

  overviewCard: {
    borderRadius: 26,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    padding: 18,
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
  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(18, 12, 46, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    flexShrink: 0,
  },
  heroBadgeText: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 11,
    includeFontPadding: false,
  },
  heroBadgeLime: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    flexShrink: 0,
  },
  heroBadgeLimeText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 11,
    includeFontPadding: false,
  },
  overviewTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 20,
    lineHeight: 24,
  },
  overviewSubtitle: {
    marginTop: 4,
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  pointsBarWrap: {
    marginTop: 14,
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#F7F2FF',
    borderWidth: 1.3,
    borderBottomWidth: 3,
    borderColor: '#E5DCFF',
    borderBottomColor: '#D2C2FA',
    gap: 9,
  },
  pointsBarTrack: {
    height: 11,
    borderRadius: radii.pill,
    flexDirection: 'row',
    overflow: 'hidden',
    gap: 2.5,
  },
  pointsSeg: {
    height: '100%',
    borderRadius: 4,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 11,
    includeFontPadding: false,
  },
  heroOverviewWrap: {
    marginTop: 12,
  },
  heroOverview: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 13.5,
    lineHeight: 19.5,
  },
  heroSimCta: {
    marginTop: 14,
    minHeight: 54,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderBottomWidth: 4.5,
    borderColor: '#E8FF78',
    borderBottomColor: '#7EA508',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 9,
    gap: 9,
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
  ctaIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroSimCtaText: {
    flex: 1,
    flexShrink: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 15.5,
    lineHeight: 19.5,
  },
  heroSimCtaArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  strategyCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    padding: 15,
  },
  strategyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  strategyIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1.3,
    borderBottomWidth: 3,
    borderColor: '#FBE08A',
    borderBottomColor: '#E2B84A',
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strategyCopy: { flex: 1, minWidth: 0 },
  cardEyebrow: {
    ...typography.kicker,
    fontSize: 10,
    color: colors.violetDeep,
  },
  cardTitle: {
    marginTop: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 16.5,
    lineHeight: 20,
  },
  chevronBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.2,
    borderBottomWidth: 2.8,
    borderColor: '#E2D6FF',
    borderBottomColor: '#C8B5FA',
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronText: {
    fontFamily: fonts.display,
    color: colors.violetDeep,
    fontSize: 15,
  },
  strategyList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 60, 255, 0.08)',
    gap: 9,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  tipIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tipIndexText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 11,
    includeFontPadding: false,
  },
  tipText: {
    flex: 1,
    fontFamily: fonts.body,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18.5,
  },

  subjectSection: {
    gap: 8,
  },
  sectionKicker: {
    ...typography.kicker,
    fontSize: 10.5,
    color: colors.violetDeep,
    paddingHorizontal: 2,
  },

  detailCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  detailMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
  },
  formatPill: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
  },
  formatPillText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 11,
    includeFontPadding: false,
  },
  timePill: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: radii.pill,
    backgroundColor: colors.cyanSoft,
  },
  timePillText: {
    fontFamily: fonts.bodyBold,
    color: colors.cyanDeep,
    fontSize: 11,
    includeFontPadding: false,
  },
  detailTitle: {
    marginTop: 10,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 19,
    lineHeight: 23,
  },
  detailSummary: {
    marginTop: 6,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 13.5,
    lineHeight: 19.5,
  },
  subHeading: {
    marginTop: 14,
    marginBottom: 8,
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 12.5,
    letterSpacing: 0.2,
  },
  topicChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  topicChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: '#F7F2FF',
    borderWidth: 1.2,
    borderBottomWidth: 2.8,
    borderColor: '#E5DCFF',
    borderBottomColor: '#D0C0F8',
  },
  topicChipText: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 12,
    includeFontPadding: false,
  },
  tipsStack: {
    gap: 8,
  },
  gradingTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  checkDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  gradingTipText: {
    fontFamily: fonts.body,
    color: colors.ink,
    fontSize: 13.5,
    lineHeight: 19.5,
  },

  modelCard: {
    borderRadius: 26,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: '#DFD2FA',
    borderBottomColor: '#C2ADF4',
    backgroundColor: '#F7F2FF',
    padding: 16,
    gap: 10,
  },
  modelTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  modelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: radii.pill,
    backgroundColor: colors.violet,
  },
  modelBadgeText: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 10.5,
    letterSpacing: 0.5,
    includeFontPadding: false,
  },
  modelPointsCount: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 11.5,
  },
  modelTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 18,
    lineHeight: 22,
  },
  rubricPreviewRow: {
    gap: 6,
  },
  rubricPill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderRadius: 14,
    borderWidth: 1.2,
    borderBottomWidth: 2.8,
    borderColor: '#E8E0FC',
    borderBottomColor: '#D4C7F7',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rubricPillPoints: {
    minWidth: 30,
    textAlign: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 1,
    borderRadius: 8,
    backgroundColor: colors.lime,
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 11,
    includeFontPadding: false,
    flexShrink: 0,
  },
  rubricPillStep: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18.5,
  },
  modelCta: {
    marginTop: 2,
    minHeight: 54,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderBottomWidth: 4.5,
    borderColor: '#E8FF78',
    borderBottomColor: '#7EA508',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 9,
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  modelCtaText: {
    flex: 1,
    flexShrink: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 15.5,
    lineHeight: 19.5,
  },
  modelCtaArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  formulasBlock: {
    gap: 8,
  },
  formulasList: {
    gap: 9,
  },
  miniFormulaRow: {
    borderRadius: 20,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 10,
  },
  miniFormulaDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  miniFormulaCopy: {
    flex: 1,
    minWidth: 0,
  },
  miniFormulaTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
  },
  miniFormulaPreview: {
    marginTop: 2,
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 12,
  },
  miniFormulaArrow: {
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

  modelSheetContainer: {
    height: '86%',
    paddingHorizontal: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sheetHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  sheetTitle: {
    marginTop: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17.5,
    lineHeight: 21,
  },
  scaleButton: {
    minWidth: 44,
    minHeight: 36,
    borderRadius: radii.pill,
    borderWidth: 1.3,
    borderBottomWidth: 3,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleButtonText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 12,
    includeFontPadding: false,
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
  flexOne: {
    flex: 1,
    minWidth: 0,
  },
  sheetScrollBody: {
    paddingTop: 4,
    paddingBottom: 24,
    gap: 14,
  },
  sheetSectionCard: {
    borderRadius: 22,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 10,
  },
  sheetRubricList: {
    gap: 8,
  },
  sheetRubricRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    backgroundColor: '#FAF8FF',
    borderWidth: 1.2,
    borderBottomWidth: 2.5,
    borderColor: '#ECE4FC',
    borderBottomColor: '#D8CAF8',
    padding: 10,
  },
  sheetRubricPts: {
    minWidth: 34,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRubricPtsText: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: colors.limeDeep,
  },
  pressed: { opacity: 0.78 },
});
