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
  ExamGuideRouteId,
  ExamSimulationScopeParam,
  RootStackParamList,
} from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { SpotlightAura } from '../../../shared/ui/SpotlightAura';
import { Text } from '../../../shared/ui/Typography';
import { useStudyProfile } from '../../study/services/studyStorage';
import { getStudyTrackMeta } from '../../study/types';
import { EXAM_GUIDES, getExamGuide } from '../data/examGuidesCatalog';
import { getExamSimulationsForExam } from '../data/examSimulationsCatalog';
import { getBestGradeForExam, useExamHistory } from '../services/examStorage';
import {
  formatRomanianGrade,
  getScopeDurationMinutes,
  getScopeTitle,
} from '../utils/examEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'ExamsHub'>;

const HERO_GRADIENTS: Record<ExamGuideRouteId, readonly [string, string, string]> = {
  en: ['#188AA8', '#3B5BE0', '#4D1FC9'],
  bac_m1: ['#8D50FF', '#6222E6', '#3E11A8'],
  bac_m2: ['#7B38EA', '#5320C9', '#32107C'],
  bac_m3: ['#D94A6B', '#8E28A8', '#4A1694'],
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

  const defaultExamId = route.params?.examId ?? getStudyTrackMeta(studyProfile.track).examGuideId;
  const [examId, setExamId] = useState<ExamGuideRouteId>(defaultExamId);
  const navLockRef = useRef(false);

  useFocusEffect(useCallback(() => {
    navLockRef.current = false;
  }, []));

  const guide = useMemo(() => getExamGuide(examId), [examId]);
  const variants = useMemo(() => getExamSimulationsForExam(examId), [examId]);
  const primaryVariant = variants[0];
  const bestGrade = useMemo(() => getBestGradeForExam(history, examId), [examId, history]);
  const recentExamRecords = useMemo(
    () => history.records.filter((record) => record.examId === examId).slice(0, 4),
    [examId, history.records],
  );

  const launchSimulation = useCallback((scope: ExamSimulationScopeParam) => {
    if (!primaryVariant || navLockRef.current) return;
    navLockRef.current = true;
    beginAppTransition();
    navigation.navigate('ExamSimulation', {
      variantId: primaryVariant.id,
      scope,
    });
  }, [navigation, primaryVariant]);

  const openGuide = useCallback(() => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    beginAppTransition();
    navigation.navigate('ExamGuide', { examId });
  }, [examId, navigation]);

  return (
    <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
      <ComicBackdrop />
      <ScreenHeader
        compact
        title="Examene EN & BAC"
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
          <View style={styles.heroShadow}>
            <View style={styles.heroCard}>
              <LinearGradient
                colors={HERO_GRADIENTS[examId]}
                start={{ x: 0.06, y: 0 }}
                end={{ x: 0.94, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View pointerEvents="none" style={styles.heroGlow} />
              <View pointerEvents="none" style={styles.heroTopShine} />

              <View style={styles.heroBadgeRow}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>⏱ {guide.durationMinutes} min · 100p</Text>
                </View>
                {bestGrade !== null ? (
                  <View style={styles.bestGradeBadge}>
                    <Text style={styles.bestGradeText}>★ Record: {formatRomanianGrade(bestGrade)}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.heroMainRow}>
                <View style={styles.heroMascotWrap}>
                  <SpotlightAura size={78} tone="lime" active={motionActive} />
                  <Mascot pose="cheer" size={82} active={motionActive} />
                </View>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroTitle}>{primaryVariant?.title ?? guide.title}</Text>
                  <Text style={styles.heroSubtitle}>
                    Simulare reală cu cronometru, barem oficial pas cu pas, corectare foto AI la Subiectul II/III și notă 1–10.
                  </Text>
                </View>
              </View>

              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Începe simularea completă ${guide.title}`}
                pressedScale={0.97}
                haptic="medium"
                onPress={() => launchSimulation('full')}
                contentStyle={styles.heroCta}
              >
                <View style={styles.heroCtaBadge}>
                  <AppIcon name="trophy" size={24} />
                </View>
                <Text numberOfLines={2} style={styles.heroCtaText}>
                  Începe simularea completă
                </Text>
                <View style={styles.heroCtaArrow}>
                  <MiniGlyph name="next" size={16} color={colors.paper} />
                </View>
              </PressableScale>
            </View>
          </View>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Vezi structura vizuală și modelele rezolvate pentru ${guide.title}`}
            pressedScale={0.975}
            haptic="light"
            onPress={openGuide}
            contentStyle={styles.guideCard}
          >
            <View style={styles.guideIcon}>
              <AppIcon name="explain" size={28} />
            </View>
            <View style={styles.guideCopy}>
              <Text style={styles.cardKicker}>STRUCTURĂ & MODELE PE BAREM</Text>
              <Text style={styles.guideTitle}>Cum arată examenul ({guide.shortTitle})</Text>
              <Text numberOfLines={2} style={styles.guideNote}>
                10p oficiu + 30p S.I + 30p S.II + 30p S.III, strategia pe minute și modele rezolvate.
              </Text>
            </View>
            <View style={styles.guideArrow}>
              <MiniGlyph name="next" size={16} color={colors.violetDeep} />
            </View>
          </PressableScale>

          <View style={styles.subjectsBlock}>
            <Text style={styles.sectionKicker}>ANTRENAMENT PE UN SINGUR SUBIECT</Text>
            <View style={styles.subjectsList}>
              {guide.subjects.map((subject) => {
                const mins = primaryVariant ? getScopeDurationMinutes(primaryVariant, subject.id) : subject.recommendedMinutes;
                const isRubric = subject.id === 's3' || (examId !== 'en' && subject.id === 's2');
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
                        {isRubric ? (
                          <View style={styles.aiPhotoTag}>
                            <Text style={styles.aiPhotoTagText}>📷 Foto pe barem AI</Text>
                          </View>
                        ) : (
                          <View style={styles.autoTag}>
                            <Text style={styles.autoTagText}>⚡ Scor instant</Text>
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
                {recentExamRecords.map((record) => (
                  <View key={record.id} style={styles.historyRow}>
                    <View style={styles.historyGradeBadge}>
                      <Text style={styles.historyGradeText}>
                        {record.grade !== null
                          ? formatRomanianGrade(record.grade)
                          : `${record.awardedPoints}p`}
                      </Text>
                    </View>
                    <View style={styles.historyCopy}>
                      <Text style={styles.historyTitle}>{getScopeTitle(record.scope)}</Text>
                      <Text style={styles.historyMeta}>
                        {record.awardedPoints} din {record.maxPoints} puncte · {Math.max(1, Math.round(record.elapsedSeconds / 60))} min
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  examPickerWrap: { paddingTop: 2, paddingBottom: 10 },
  examPickerRow: { gap: 8, alignItems: 'center' },
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
  examPillActive: { borderColor: colors.violet, backgroundColor: colors.violet },
  examPillText: {
    fontFamily: fonts.bodyBold,
    color: colors.inkSoft,
    fontSize: 12.5,
    includeFontPadding: false,
  },
  examPillTextActive: { color: colors.paper },

  scrollContent: { flexGrow: 1 },
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
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    fontSize: 11,
    includeFontPadding: false,
  },
  bestGradeBadge: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
  },
  bestGradeText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
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
    fontSize: 20,
    lineHeight: 24,
  },
  heroSubtitle: {
    fontFamily: fonts.bodyMedium,
    color: 'rgba(244, 238, 255, 0.92)',
    fontSize: 12,
    lineHeight: 16.5,
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
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    gap: 11,
  },
  guideIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.cyanSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideCopy: { flex: 1, minWidth: 0 },
  cardKicker: {
    ...typography.kicker,
    fontSize: 9.5,
    color: colors.violetDeep,
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
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  subjectsBlock: { gap: 9 },
  sectionKicker: {
    ...typography.kicker,
    fontSize: 10.5,
    color: colors.violetDeep,
  },
  subjectsList: { gap: 10 },
  subjectCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.11)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
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

  historyBlock: { gap: 9 },
  historyList: { gap: 8 },
  historyRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    gap: 11,
  },
  historyGradeBadge: {
    minWidth: 52,
    height: 40,
    borderRadius: 14,
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
  pressed: { opacity: 0.78 },
});
