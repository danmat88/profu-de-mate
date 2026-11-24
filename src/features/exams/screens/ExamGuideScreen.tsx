import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { InteractionManager, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { beginAppTransition } from '../../../shared/context/TransitionMotionContext';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
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
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
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
  const { gutter, isNarrow } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
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

  // Silently pre-parse the model problem & solution SVGs for this guide's subjects.
  useEffect(() => {
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
  }, [guide]);

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
    <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
      <ComicBackdrop />
      <ScreenHeader
        compact
        title="Cum arată examenul"
        eyebrow={guide.eyebrow}
        onBack={() => navigation.goBack()}
        rightIcon="trophy"
      />

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
        <View style={styles.heroCard}>
          <LinearGradient
            colors={HERO_GRADIENTS[guide.accent]}
            start={{ x: 0.05, y: 0 }}
            end={{ x: 0.95, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.heroGlow} />
          <View pointerEvents="none" style={styles.heroTopShine} />

          <View style={styles.heroBadgesRow}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>⏱ {guide.durationMinutes} min</Text>
            </View>
            <View style={styles.heroBadgeLime}>
              <Text style={styles.heroBadgeLimeText}>★ {guide.totalPoints} puncte</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{guide.title}</Text>
          <Text style={styles.heroSubtitle}>{guide.subtitle}</Text>

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
            color="rgba(255, 255, 255, 0.92)"
            textStyle={styles.heroOverview}
            maxMathWidth={Math.max(220, frame.width - gutter * 2 - 44)}
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
            <AppIcon name="trophy" size={22} />
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
                    color={colors.inkSoft}
                    textStyle={styles.gradingTipText}
                    maxMathWidth={Math.max(190, frame.width - gutter * 2 - 74)}
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
                    scale={0.86}
                    color={colors.ink}
                    textStyle={styles.rubricPillStep}
                    maxMathWidth={Math.max(170, frame.width - gutter * 2 - 110)}
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
            <AppIcon name="explain" size={24} />
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
                maxWidth={Math.max(230, frame.width - 72)}
                accent={guide.accent === 'gold' ? 'lime' : guide.accent}
              />
            </View>

            <View style={styles.sheetSectionCard}>
              <Text style={styles.cardEyebrow}>REZOLVARE PAS CU PAS</Text>
              <StudyBlocksView
                key={`sol-${examId}-${subjectId}`}
                blocks={subject.modelSolution}
                scale={readingScale}
                maxWidth={Math.max(230, frame.width - 72)}
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
                        maxMathWidth={Math.max(180, frame.width - 134)}
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
  subjectStage: { gap: 14 },
  examPickerWrap: {
    paddingTop: 2,
    paddingBottom: 10,
  },
  examPickerRow: {
    gap: 8,
    alignItems: 'center',
  },
  examPill: {
    minHeight: 36,
    paddingHorizontal: 15,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.13)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  examPillActive: {
    borderColor: colors.violet,
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
    gap: 14,
  },

  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    padding: 18,
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
    left: 24,
    right: 24,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
  },
  heroBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroBadge: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(18, 12, 46, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroBadgeText: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 11.5,
    includeFontPadding: false,
  },
  heroBadgeLime: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
  },
  heroBadgeLimeText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 11.5,
    includeFontPadding: false,
  },
  heroTitle: {
    marginTop: 12,
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 22,
    lineHeight: 26,
  },
  heroSubtitle: {
    marginTop: 4,
    fontFamily: fonts.bodyMedium,
    color: 'rgba(244, 238, 255, 0.9)',
    fontSize: 12.5,
    lineHeight: 17,
  },
  pointsBarWrap: {
    marginTop: 14,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(18, 12, 46, 0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
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
    color: colors.paper,
    fontSize: 11,
    includeFontPadding: false,
  },
  heroOverview: {
    marginTop: 12,
    fontFamily: fonts.body,
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: 12.5,
    lineHeight: 18,
  },
  heroSimCta: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 9,
    gap: 9,
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
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.11)',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 14,
  },
  strategyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  strategyIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
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
    width: 32,
    height: 32,
    borderRadius: 16,
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
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.11)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
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
    paddingVertical: 4,
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
    paddingVertical: 4,
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
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.1)',
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
    flex: 1,
    fontFamily: fonts.body,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18.5,
  },

  modelCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.16)',
    backgroundColor: '#F6F0FF',
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
    paddingVertical: 4,
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
    alignItems: 'center',
    gap: 8,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  rubricPillPoints: {
    minWidth: 30,
    textAlign: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: colors.lime,
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 11,
    includeFontPadding: false,
    flexShrink: 0,
  },
  rubricPillStep: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 12.5,
  },
  modelCta: {
    marginTop: 2,
    minHeight: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 9,
    gap: 10,
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
    gap: 8,
  },
  miniFormulaRow: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
    width: 28,
    height: 28,
    borderRadius: 14,
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
    minWidth: 42,
    height: 34,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.14)',
    backgroundColor: colors.paper,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(124, 60, 255, 0.08)',
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAE1FA',
    backgroundColor: colors.paper,
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
    borderWidth: 1,
    borderColor: '#EFE8FC',
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
