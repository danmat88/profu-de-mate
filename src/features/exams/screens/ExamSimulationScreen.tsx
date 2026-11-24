import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  InteractionManager,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { beginAppTransition } from '../../../shared/context/TransitionMotionContext';
import { useKeyboardHeight } from '../../../shared/hooks/useKeyboardHeight';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import * as Haptics from '../../../shared/services/haptics';
import {
  getMathReadingScale,
  mathReadingScaleBadge,
  nextMathReadingScale,
  setMathReadingScale,
  type MathReadingScale,
} from '../../../shared/storage/localPreferences';
import { colors, fonts, radii } from '../../../shared/theme';
import type { ExamResultItemSummary, RootStackParamList } from '../../../shared/types';
import { AiBlockingOverlay } from '../../../shared/ui/AiBlockingOverlay';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicBottomSheet } from '../../../shared/ui/ComicBottomSheet';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { StepTransitionStage } from '../../../shared/ui/StepTransitionStage';
import { Text, TextInput } from '../../../shared/ui/Typography';
import { useCommercial } from '../../access/context/CommercialContext';
import { commercialGateFromError } from '../../access/services/commercial';
import { StudyInlineText } from '../../study/components/StudyInlineText';
import { StudyBlocksView } from '../../study/components/StudyRichContent';
import { prewarmStudyMath } from '../../study/utils/prewarmStudyMath';
import { EXAM_SIMULATIONS, getExamSimulationById } from '../data/examSimulationsCatalog';
import { friendlyExamGradingError, gradeExamSolutionPhoto } from '../services/examGrading';
import { recordExamSimulation } from '../services/examStorage';
import type { AiRubricGradingResult, ExamItemKind, ExamSubjectKey } from '../types';
import {
  computeExamScore,
  evaluateAutoExamItem,
  getScopeDurationMinutes,
  getScopeItems,
} from '../utils/examEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'ExamSimulation'>;

const CHOICE_LETTERS = ['A', 'B', 'C', 'D'] as const;
const QUICK_MATH_SYMBOLS = ['−', ',', '/', '√', 'π'] as const;
const SUBJECT_ACCENT: Record<ExamSubjectKey, 'violet' | 'cyan' | 'peach'> = {
  s1: 'violet',
  s2: 'cyan',
  s3: 'peach',
};
const SUBJECT_BADGE_BG: Record<ExamSubjectKey, string> = {
  s1: colors.violetSoft,
  s2: colors.cyanSoft,
  s3: colors.peachSoft,
};
const SUBJECT_BADGE_TEXT: Record<ExamSubjectKey, string> = {
  s1: colors.violetDeep,
  s2: colors.cyanDeep,
  s3: colors.peachDeep,
};

const GRADING_AI_STAGES: readonly string[] = [
  'Citirea rezolvării scrise de mână din fotografie...',
  'Verificăm fiecare etapă din baremul oficial...',
  'Calculăm punctajul final și recomandările...',
];

function formatCountdown(secondsLeft: number): string {
  const safe = Math.max(0, secondsLeft);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Pure native 60fps timed EN/BAC exam simulation screen. Paints every item,
 * subpoint, MathJax SVG choice, and official rubric sheet synchronously on
 * Frame 0 with zero WebView boot lag, full keyboard ergonomics, timer pause
 * during AI photo grading, and airtight interaction locks.
 */
export function ExamSimulationScreen({ navigation, route }: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, contentWidth } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { keyboardInset, keyboardVisible } = useKeyboardHeight();
  const { access, refresh: refreshAccess } = useCommercial();
  const { variantId, scope } = route.params;

  const variant = useMemo(
    () => getExamSimulationById(variantId) ?? EXAM_SIMULATIONS[0],
    [variantId],
  );
  const items = useMemo(() => getScopeItems(variant, scope), [scope, variant]);
  const totalSeconds = useMemo(
    () => getScopeDurationMinutes(variant, scope) * 60,
    [scope, variant],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [stepTransition, setStepTransition] = useState<{ direction: -1 | 0 | 1; animate: boolean }>({
    direction: 0,
    animate: false,
  });
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [readingScale, setReadingScale] = useState<MathReadingScale>(() => getMathReadingScale());
  const [choiceAnswers, setChoiceAnswers] = useState<Record<string, number>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [checkedRubricSteps, setCheckedRubricSteps] = useState<Record<string, readonly string[]>>({});
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({});
  const [aiGradingResults, setAiGradingResults] = useState<Record<string, AiRubricGradingResult>>({});
  const [gradingBusy, setGradingBusy] = useState(false);
  const [gradingTargetLabel, setGradingTargetLabel] = useState('');
  const [gradingError, setGradingError] = useState<string | null>(null);
  const [rubricSheetOpen, setRubricSheetOpen] = useState(false);
  const [rubricSheetEverOpened, setRubricSheetEverOpened] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'submit' | 'exit' | null>(null);

  const mountedRef = useRef(true);
  const gradingLockRef = useRef(false);
  const leavingAllowedRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const timeExpiredNotifiedRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const navStripRef = useRef<ScrollView>(null);
  const navChipPositionsRef = useRef<Record<number, number>>({});
  const currentItem = items[currentIndex] ?? items[0];

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  // Reset scroll synchronously right as the newly keyed exam item mounts.
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [currentIndex]);

  // Silently pre-parse neighboring exam item SVG ASTs so stepping paints in 0ms.
  useEffect(() => {
    const neighbors = [items[currentIndex + 1], items[currentIndex - 1]].filter(Boolean);
    if (neighbors.length === 0) return undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      for (const neighbor of neighbors) {
        prewarmStudyMath({
          blocks: neighbor.prompt,
          inlineTexts: [
            ...(neighbor.choices ?? []),
            neighbor.answerDisplay,
          ],
        });
      }
    });
    return () => task.cancel();
  }, [currentIndex, items]);

  // Pause the exam countdown fairly while Profu AI is grading a photo.
  useEffect(() => {
    if (gradingBusy) {
      if (pausedAtRef.current === null) pausedAtRef.current = Date.now();
    } else if (pausedAtRef.current !== null && startedAtRef.current !== null) {
      startedAtRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
  }, [gradingBusy]);

  useEffect(() => {
    if (startedAtRef.current === null) {
      startedAtRef.current = Date.now();
    }
    const interval = setInterval(() => {
      if (startedAtRef.current === null || pausedAtRef.current !== null) return;
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setSecondsLeft(Math.max(0, totalSeconds - elapsed));
    }, 1000);
    return () => clearInterval(interval);
  }, [totalSeconds]);

  useEffect(() => {
    if (secondsLeft > 0 || timeExpiredNotifiedRef.current || gradingBusy) return;
    timeExpiredNotifiedRef.current = true;
    Keyboard.dismiss();
    Haptics.notification(Haptics.NotificationFeedbackType.Warning);
    setRubricSheetOpen(false);
    setConfirmMode('submit');
  }, [gradingBusy, secondsLeft]);

  // Auto-scroll smoothly into short-answer input when the soft keyboard opens.
  useEffect(() => {
    if (!keyboardVisible || currentItem.kind !== 'short_answer') return undefined;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 90);
    return () => clearTimeout(timer);
  }, [currentItem.kind, keyboardVisible]);

  const cycleScale = useCallback(() => {
    if (gradingBusy) return;
    Keyboard.dismiss();
    Haptics.selection();
    setReadingScale((current) => {
      const next = nextMathReadingScale(current);
      setMathReadingScale(next);
      return next;
    });
  }, [gradingBusy]);

  const isItemAnswered = useCallback((itemId: string, kind: ExamItemKind): boolean => {
    if (kind === 'choice') return choiceAnswers[itemId] !== undefined;
    if (kind === 'short_answer') return Boolean(textAnswers[itemId]?.trim());
    return rubricScores[itemId] !== undefined || aiGradingResults[itemId] !== undefined;
  }, [aiGradingResults, choiceAnswers, rubricScores, textAnswers]);

  const unansweredItems = useMemo(
    () => items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => !isItemAnswered(item.id, item.kind)),
    [isItemAnswered, items],
  );
  const answeredCount = items.length - unansweredItems.length;

  // Block navigation gestures and hardware Back completely while AI grades a photo.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !gradingBusy && answeredCount === 0 });
  }, [answeredCount, gradingBusy, navigation]);

  useEffect(() => {
    if (!gradingBusy) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    const removeUnsub = navigation.addListener('beforeRemove', (event) => {
      if (!leavingAllowedRef.current && event.data.action.type !== 'RESET') {
        event.preventDefault();
      }
    });
    return () => {
      sub.remove();
      removeUnsub();
    };
  }, [gradingBusy, navigation]);

  useEffect(() => {
    if (gradingBusy || answeredCount === 0 || confirmMode !== null || rubricSheetOpen) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Keyboard.dismiss();
      Haptics.selection();
      setConfirmMode('exit');
      return true;
    });
    return () => sub.remove();
  }, [answeredCount, confirmMode, gradingBusy, rubricSheetOpen]);

  const jumpToIndex = (nextIdx: number) => {
    if (gradingBusy || nextIdx < 0 || nextIdx >= items.length || nextIdx === currentIndex) return;
    Keyboard.dismiss();
    const stepDirection: -1 | 1 = nextIdx > currentIndex ? 1 : -1;
    Haptics.selection();
    setGradingError(null);
    setStepTransition({ direction: stepDirection, animate: true });
    setCurrentIndex(nextIdx);
    const chipX = navChipPositionsRef.current[nextIdx];
    if (chipX !== undefined) {
      navStripRef.current?.scrollTo({
        x: Math.max(0, chipX - Math.round(frame.width * 0.32)),
        animated: !reducedMotion,
      });
    }
  };

  const toggleRubricCriterion = (criterionId: string) => {
    if (!currentItem.rubric || gradingBusy) return;
    Keyboard.dismiss();
    Haptics.selection();
    const prev = checkedRubricSteps[currentItem.id] ?? [];
    const nextIds = prev.includes(criterionId)
      ? prev.filter((id) => id !== criterionId)
      : [...prev, criterionId];
    const nextPoints = currentItem.rubric
      .filter((c) => nextIds.includes(c.id))
      .reduce((sum, c) => sum + c.points, 0);
    setCheckedRubricSteps((map) => ({ ...map, [currentItem.id]: nextIds }));
    setRubricScores((map) => ({ ...map, [currentItem.id]: nextPoints }));
  };

  const launchPhotoGrading = async (source: 'camera' | 'gallery') => {
    if (gradingLockRef.current || gradingBusy) return;
    Keyboard.dismiss();
    if (access && !access.canAnalyze) {
      beginAppTransition();
      navigation.navigate('Paywall', { source: 'quota', access });
      return;
    }

    const targetItem = currentItem;
    gradingLockRef.current = true;
    setGradingError(null);
    try {
      let picked: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          gradingLockRef.current = false;
          if (mountedRef.current) {
            setGradingError('Permisiunea pentru cameră este necesară ca să fotografiezi rezolvarea.');
          }
          return;
        }
        picked = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.9,
          exif: false,
        });
      } else {
        picked = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.9,
          exif: false,
        });
      }
      if (!mountedRef.current) return;
      if (picked.canceled || !picked.assets?.[0]?.uri) {
        gradingLockRef.current = false;
        return;
      }

      setGradingTargetLabel(`${targetItem.numberLabel} · ${targetItem.maxPoints} PUNCTE`);
      setGradingBusy(true);
      Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
      const grading = await gradeExamSolutionPhoto({
        examId: variant.examId,
        item: targetItem,
        imageUri: picked.assets[0].uri,
      });
      if (!mountedRef.current) return;
      void refreshAccess();
      setAiGradingResults((map) => ({ ...map, [targetItem.id]: grading }));
      if (grading.status === 'graded') {
        setRubricScores((map) => ({ ...map, [targetItem.id]: grading.awardedPoints }));
        Haptics.notification(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notification(Haptics.NotificationFeedbackType.Warning);
      }
      gradingLockRef.current = false;
      setGradingBusy(false);
    } catch (error) {
      if (!mountedRef.current) return;
      gradingLockRef.current = false;
      setGradingBusy(false);
      const gate = commercialGateFromError(error);
      if (gate) {
        beginAppTransition();
        navigation.navigate('Paywall', { source: 'quota', ...(access ? { access } : {}) });
        return;
      }
      setGradingError(friendlyExamGradingError(error));
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    }
  };

  const finishExam = () => {
    if (gradingBusy) return;
    Keyboard.dismiss();
    setConfirmMode(null);
    const itemAwarded: Record<string, number> = {};
    const summaryItems: ExamResultItemSummary[] = items.map((item) => {
      let pts = 0;
      if (item.kind === 'choice') {
        pts = evaluateAutoExamItem(item, { choiceIndex: choiceAnswers[item.id] }).awardedPoints;
      } else if (item.kind === 'short_answer') {
        pts = evaluateAutoExamItem(item, { text: textAnswers[item.id] }).awardedPoints;
      } else {
        pts = rubricScores[item.id] ?? 0;
      }
      itemAwarded[item.id] = pts;
      return {
        itemId: item.id,
        numberLabel: item.numberLabel,
        title: item.title,
        subject: item.subject,
        awardedPoints: pts,
        maxPoints: item.maxPoints,
      };
    });

    const score = computeExamScore(variant, scope, itemAwarded);
    const elapsedSeconds = Math.max(1, Math.floor((Date.now() - (startedAtRef.current ?? Date.now())) / 1000));

    recordExamSimulation({
      id: `exam-${Date.now()}`,
      variantId: variant.id,
      examId: variant.examId,
      scope,
      completedAt: new Date().toISOString(),
      awardedPoints: score.awardedPoints,
      maxPoints: score.maxPoints,
      grade: score.grade,
      elapsedSeconds,
      subjectPoints: score.subjectPoints,
    });

    Haptics.notification(Haptics.NotificationFeedbackType.Success);
    leavingAllowedRef.current = true;
    beginAppTransition();
    navigation.replace('ExamResult', {
      variantId: variant.id,
      examId: variant.examId,
      scope,
      officePoints: score.officePoints,
      subjectPoints: score.subjectPoints,
      awardedPoints: score.awardedPoints,
      maxPoints: score.maxPoints,
      grade: score.grade,
      elapsedSeconds,
      items: summaryItems,
    });
  };

  const lowTime = secondsLeft < 600;
  const currentRubricScore = rubricScores[currentItem.id];
  const currentAiResult = aiGradingResults[currentItem.id];
  const currentCheckedSteps = checkedRubricSteps[currentItem.id] ?? [];
  const currentTextValue = textAnswers[currentItem.id] ?? '';
  const innerMathWidth = Math.max(200, Math.min(contentWidth, frame.width - gutter * 2) - 42);
  const showShortKeyboardDock = currentItem.kind === 'short_answer' && keyboardVisible;
  const scrollBottomPadding = keyboardVisible ? 18 : 22;
  const unansweredPreview = unansweredItems
    .slice(0, 4)
    .map(({ item }) => item.numberLabel)
    .join(', ');

  return (
    <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
      <ComicBackdrop />

      <Pressable
        accessible={false}
        onPress={Keyboard.dismiss}
        style={[styles.topBar, { paddingHorizontal: gutter }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ieși din simulare"
          disabled={gradingBusy}
          hitSlop={8}
          onPress={() => {
            Keyboard.dismiss();
            Haptics.selection();
            if (answeredCount > 0) setConfirmMode('exit');
            else {
              leavingAllowedRef.current = true;
              beginAppTransition();
              navigation.goBack();
            }
          }}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
        >
          <MiniGlyph name="close" size={16} color={colors.ink} />
        </Pressable>

        <View style={[styles.timerPill, lowTime && styles.timerPillLow]}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.84}
            maxFontSizeMultiplier={1.12}
            style={[styles.timerText, lowTime && styles.timerTextLow]}
          >
            ⏱ {formatCountdown(secondsLeft)}
          </Text>
        </View>

        <View style={styles.progressPill}>
          <Text maxFontSizeMultiplier={1.12} style={styles.progressPillText}>
            {answeredCount}/{items.length}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Mărime text: ${mathReadingScaleBadge(readingScale)}`}
          disabled={gradingBusy}
          hitSlop={6}
          onPress={cycleScale}
          style={({ pressed }) => [styles.scalePill, pressed && styles.pressed]}
        >
          <Text maxFontSizeMultiplier={1.12} style={styles.scalePillText}>
            {mathReadingScaleBadge(readingScale)}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Predă lucrarea și calculează nota"
          disabled={gradingBusy}
          onPress={() => {
            Keyboard.dismiss();
            Haptics.selection();
            setConfirmMode('submit');
          }}
          style={({ pressed }) => [styles.submitPill, pressed && styles.pressed]}
        >
          <Text maxFontSizeMultiplier={1.12} style={styles.submitPillText}>Predă</Text>
        </Pressable>
      </Pressable>

      <View style={styles.navStripWrap}>
        <ScrollView
          ref={navStripRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.navStrip, { paddingHorizontal: gutter }]}
        >
          {items.map((item, idx) => {
            const active = idx === currentIndex;
            const answered = isItemAnswered(item.id, item.kind);
            return (
              <Pressable
                key={item.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active, disabled: gradingBusy }}
                disabled={gradingBusy}
                onLayout={(event) => {
                  navChipPositionsRef.current[idx] = event.nativeEvent.layout.x;
                }}
                onPress={() => jumpToIndex(idx)}
                style={({ pressed }) => [
                  styles.navChip,
                  active && styles.navChipActive,
                  !active && answered && styles.navChipAnswered,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.navChipText, active && styles.navChipTextActive]}>
                  {item.numberLabel}
                </Text>
                {answered ? (
                  <View style={[styles.answeredDot, active && styles.answeredDotActive]} />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={[styles.flexBody, keyboardVisible && { paddingBottom: keyboardInset }]}>
        <ScrollView
          ref={scrollRef}
          style={styles.flexBody}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.scrollBody,
            { paddingHorizontal: gutter, paddingBottom: scrollBottomPadding },
          ]}
        >
          <StepTransitionStage
            key={currentItem.id}
            direction={stepTransition.direction}
            animate={stepTransition.animate}
            style={[styles.stageWrap, { maxWidth: contentWidth }]}
          >
            <Pressable
              accessible={false}
              onPress={Keyboard.dismiss}
              style={styles.promptCard}
            >
              <View style={styles.itemMetaRow}>
                <View style={[styles.subjectBadge, { backgroundColor: SUBJECT_BADGE_BG[currentItem.subject] }]}>
                  <Text style={[styles.subjectBadgeText, { color: SUBJECT_BADGE_TEXT[currentItem.subject] }]}>
                    {currentItem.numberLabel}
                  </Text>
                </View>
                <View style={styles.pointsBadge}>
                  <Text style={styles.pointsBadgeText}>{currentItem.maxPoints} puncte</Text>
                </View>
              </View>

              <Text style={styles.itemTitle}>{currentItem.title}</Text>

              <StudyBlocksView
                blocks={currentItem.prompt}
                scale={readingScale}
                maxWidth={innerMathWidth}
                accent={SUBJECT_ACCENT[currentItem.subject]}
              />
            </Pressable>

          {currentItem.kind === 'choice' && currentItem.choices ? (
            <View style={styles.choicesStack}>
              {currentItem.choices.map((label, idx) => {
                const selected = choiceAnswers[currentItem.id] === idx;
                return (
                  <Pressable
                    key={`${currentItem.id}-c-${idx}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, disabled: gradingBusy }}
                    disabled={gradingBusy}
                    onPress={() => {
                      Keyboard.dismiss();
                      Haptics.selection();
                      setChoiceAnswers((map) => ({ ...map, [currentItem.id]: idx }));
                    }}
                    style={({ pressed }) => [
                      styles.choiceCard,
                      selected && styles.choiceCardSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.choiceBadge, selected && styles.choiceBadgeSelected]}>
                      <Text style={[styles.choiceBadgeText, selected && styles.choiceBadgeTextSelected]}>
                        {CHOICE_LETTERS[idx]}
                      </Text>
                    </View>
                    <View style={styles.choiceBody}>
                      <StudyInlineText
                        text={label}
                        scale={readingScale}
                        mathSize="choice"
                        maxMathWidth={innerMathWidth - 58}
                        textStyle={styles.choiceLabel}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : currentItem.kind === 'short_answer' ? (
            <View style={styles.shortAnswerBox}>
              <View style={[styles.inputWrap, Boolean(currentTextValue.trim()) && styles.inputWrapFilled]}>
                <TextInput
                  editable={!gradingBusy}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType={currentIndex + 1 < items.length ? 'next' : 'done'}
                  value={currentTextValue}
                  onFocus={() => {
                    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 140);
                  }}
                  onSubmitEditing={() => {
                    Keyboard.dismiss();
                    if (currentTextValue.trim() && currentIndex + 1 < items.length) {
                      jumpToIndex(currentIndex + 1);
                    }
                  }}
                  onChangeText={(value) => setTextAnswers((map) => ({ ...map, [currentItem.id]: value }))}
                  placeholder={currentItem.inputHint ?? 'Scrie răspunsul final'}
                  placeholderTextColor={colors.inkMuted}
                  selectionColor={colors.violet}
                  style={styles.shortInput}
                />
                {currentTextValue ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Șterge răspunsul"
                    hitSlop={8}
                    onPress={() => setTextAnswers((map) => ({ ...map, [currentItem.id]: '' }))}
                    style={styles.clearInputBtn}
                  >
                    <MiniGlyph name="close" size={14} color={colors.ink} />
                  </Pressable>
                ) : null}
              </View>

              {!showShortKeyboardDock ? (
                <>
                  <View style={styles.symbolChipsRow}>
                    {QUICK_MATH_SYMBOLS.map((sym) => (
                      <Pressable
                        key={sym}
                        accessibilityRole="button"
                        accessibilityLabel={`Inserează simbolul ${sym}`}
                        onPress={() => {
                          Haptics.selection();
                          setTextAnswers((map) => ({
                            ...map,
                            [currentItem.id]: `${map[currentItem.id] ?? ''}${sym === '−' ? '-' : sym}`,
                          }));
                        }}
                        style={({ pressed }) => [styles.symbolChip, pressed && styles.pressed]}
                      >
                        <Text style={styles.symbolChipText}>{sym}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {currentTextValue.trim() ? (
                    <View style={styles.savedInlinePill}>
                      <MiniGlyph name="check" size={12} color={colors.limeDeep} />
                      <Text style={styles.savedInlineText}>Răspuns salvat pentru acest item</Text>
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : (
            <View style={styles.rubricWorkspace}>
              <View style={styles.rubricHeaderRow}>
                <View style={styles.rubricHeaderCopy}>
                  <Text style={styles.cardKicker}>REDACTARE PE CAIET · {currentItem.maxPoints} PUNCTE</Text>
                  <Text style={styles.rubricTitle}>Verifică rezolvarea pe barem</Text>
                </View>
                <View style={[styles.rubricPtsPill, currentRubricScore !== undefined && styles.rubricPtsPillScored]}>
                  <Text style={[styles.rubricPtsText, currentRubricScore !== undefined && styles.rubricPtsTextScored]}>
                    {currentRubricScore !== undefined ? `${currentRubricScore}/${currentItem.maxPoints}p` : `0/${currentItem.maxPoints}p`}
                  </Text>
                </View>
              </View>

              <Text style={styles.rubricNote}>
                Rezolvă problema pe hârtie ca la examen, apoi fotografiază pagina pentru corectare pe barem cu Profu’ AI sau notează-te offline după baremul oficial.
              </Text>

              <View style={styles.photoActionsRow}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Fotografiază rezolvarea pentru corectare pe barem cu Profu AI"
                  disabled={gradingBusy}
                  pressedScale={0.97}
                  haptic="medium"
                  onPress={() => void launchPhotoGrading('camera')}
                  style={styles.cameraBtnWrap}
                  contentStyle={styles.cameraBtn}
                >
                  <AppIcon name="camera" size={22} />
                  <Text numberOfLines={2} style={styles.cameraBtnText}>
                    Corectează poza (AI)
                  </Text>
                </PressableScale>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Alege o fotografie din galerie pentru barem"
                  disabled={gradingBusy}
                  onPress={() => void launchPhotoGrading('gallery')}
                  style={({ pressed }) => [styles.galleryMiniBtn, pressed && styles.pressed]}
                >
                  <AppIcon name="gallery" size={22} />
                </Pressable>
              </View>

              {gradingError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{gradingError}</Text>
                </View>
              ) : null}

              {currentAiResult ? (
                <View style={styles.aiResultCard}>
                  <View style={styles.aiResultTop}>
                    <Text style={styles.aiResultTag}>✦ CORECTARE PE BAREM · PROFU’ AI</Text>
                    <Text style={styles.aiResultPts}>
                      {currentAiResult.awardedPoints}/{currentAiResult.maxPoints}p
                    </Text>
                  </View>
                  <Text style={styles.aiResultSummary}>{currentAiResult.summary}</Text>
                  {currentAiResult.criteriaScores.map((crit, cIdx) => (
                    <View key={`${crit.step}-${cIdx}`} style={styles.aiCritRow}>
                      <View style={styles.aiCritPts}>
                        <Text style={styles.aiCritPtsText}>{crit.awardedPoints}/{crit.maxPoints}p</Text>
                      </View>
                      <View style={styles.aiCritCopy}>
                        <StudyInlineText
                          text={crit.step}
                          scale={0.9}
                          textStyle={styles.aiCritStep}
                          maxMathWidth={innerMathWidth - 96}
                        />
                        <Text style={styles.aiCritComment}>{crit.comment}</Text>
                      </View>
                    </View>
                  ))}
                  <View style={styles.aiTipPill}>
                    <Text style={styles.aiTipText}>💡 {currentAiResult.improvementTip}</Text>
                  </View>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Deschide baremul oficial și notează-te offline"
                disabled={gradingBusy}
                onPress={() => {
                  Keyboard.dismiss();
                  Haptics.selection();
                  setRubricSheetEverOpened(true);
                  setRubricSheetOpen(true);
                }}
                style={({ pressed }) => [styles.manualRubricBtn, pressed && styles.pressed]}
              >
                <AppIcon name="explain" size={20} />
                <Text numberOfLines={2} style={styles.manualRubricText}>
                  Vezi baremul oficial & notează-te offline
                </Text>
                <MiniGlyph name="next" size={14} color={colors.violetDeep} />
              </Pressable>
            </View>
          )}
          </StepTransitionStage>
        </ScrollView>

      {showShortKeyboardDock ? (
        <View style={[styles.keyboardDock, { paddingHorizontal: gutter }]}>
          <View style={[styles.keyboardDockInner, { maxWidth: contentWidth }]}>
            <View style={styles.symbolChipsRow}>
              {QUICK_MATH_SYMBOLS.map((sym) => (
                <Pressable
                  key={`dock-${sym}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Inserează simbolul ${sym}`}
                  onPress={() => {
                    Haptics.selection();
                    setTextAnswers((map) => ({
                      ...map,
                      [currentItem.id]: `${map[currentItem.id] ?? ''}${sym === '−' ? '-' : sym}`,
                    }));
                  }}
                  style={({ pressed }) => [styles.dockSymbolChip, pressed && styles.pressed]}
                >
                  <Text style={styles.symbolChipText}>{sym}</Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ascunde tastatura"
                onPress={() => {
                  Haptics.selection();
                  Keyboard.dismiss();
                }}
                style={({ pressed }) => [styles.dockHideBtn, pressed && styles.pressed]}
              >
                <Text style={styles.dockHideText}>Gata ↓</Text>
              </Pressable>
            </View>

            <View style={styles.keyboardActionRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Itemul anterior"
                disabled={currentIndex === 0 || gradingBusy}
                onPress={() => jumpToIndex(currentIndex - 1)}
                style={({ pressed }) => [
                  styles.dockPrevBtn,
                  currentIndex === 0 && styles.stepNavBtnDisabled,
                  pressed && currentIndex > 0 && styles.pressed,
                ]}
              >
                <MiniGlyph name="back" size={17} color={currentIndex > 0 ? colors.ink : colors.inkMuted} />
              </Pressable>

              {currentIndex + 1 < items.length ? (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Salvează și mergi la itemul următor"
                  disabled={gradingBusy}
                  pressedScale={0.97}
                  haptic="selection"
                  onPress={() => jumpToIndex(currentIndex + 1)}
                  style={styles.mainNavWrap}
                  contentStyle={styles.dockNextBtn}
                >
                  <Text numberOfLines={2} style={styles.keyboardNextText}>
                    Itemul următor →
                  </Text>
                </PressableScale>
              ) : (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Predă lucrarea și vezi nota finală"
                  disabled={gradingBusy}
                  pressedScale={0.97}
                  haptic="medium"
                  onPress={() => {
                    Keyboard.dismiss();
                    setConfirmMode('submit');
                  }}
                  style={styles.mainNavWrap}
                  contentStyle={styles.dockNextBtn}
                >
                  <Text numberOfLines={2} style={styles.keyboardNextText}>
                    Predă lucrarea ★
                  </Text>
                </PressableScale>
              )}
            </View>
          </View>
        </View>
      ) : !keyboardVisible ? (
        <View
          style={[
            styles.bottomBar,
            { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 12) + 6 },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Itemul anterior"
            disabled={currentIndex === 0 || gradingBusy}
            onPress={() => jumpToIndex(currentIndex - 1)}
            style={({ pressed }) => [
              styles.stepNavBtn,
              currentIndex === 0 && styles.stepNavBtnDisabled,
              pressed && currentIndex > 0 && styles.pressed,
            ]}
          >
            <MiniGlyph name="back" size={18} color={currentIndex > 0 ? colors.ink : colors.inkMuted} />
          </Pressable>

          {currentIndex + 1 < items.length ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Itemul următor"
              disabled={gradingBusy}
              pressedScale={0.97}
              haptic="selection"
              onPress={() => jumpToIndex(currentIndex + 1)}
              style={styles.mainNavWrap}
              contentStyle={styles.mainNavBtn}
            >
              <Text numberOfLines={2} style={styles.mainNavText}>Itemul următor</Text>
              <View style={styles.mainNavArrow}>
                <MiniGlyph name="next" size={16} color={colors.paper} />
              </View>
            </PressableScale>
          ) : (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Predă lucrarea și vezi nota finală"
              disabled={gradingBusy}
              pressedScale={0.97}
              haptic="medium"
              onPress={() => setConfirmMode('submit')}
              style={styles.mainNavWrap}
              contentStyle={styles.mainNavBtn}
            >
              <Text numberOfLines={2} style={styles.mainNavText}>Predă lucrarea ★</Text>
              <View style={styles.mainNavArrow}>
                <MiniGlyph name="check" size={16} color={colors.paper} />
              </View>
            </PressableScale>
          )}
        </View>
      ) : null}
      </View>

      {rubricSheetEverOpened ? (
        <ComicBottomSheet
          visible={rubricSheetOpen}
          onClose={() => setRubricSheetOpen(false)}
          maxHeight="90%"
          sheetStyle={styles.rubricSheetContainer}
        >
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderCopy}>
              <Text style={styles.cardKicker}>{currentItem.numberLabel} · BAREM OFICIAL</Text>
              <Text numberOfLines={2} style={styles.sheetTitle}>{currentItem.title}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Închide baremul"
              hitSlop={8}
              onPress={() => setRubricSheetOpen(false)}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <MiniGlyph name="close" size={16} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetScrollBody}
          >
            <View style={styles.sheetAnswerCard}>
              <Text style={styles.sheetAnswerEyebrow}>RĂSPUNS OFICIAL · {currentItem.maxPoints} PUNCTE</Text>
              <StudyInlineText
                text={currentItem.answerDisplay}
                scale={readingScale * 1.02}
                textStyle={styles.sheetAnswerText}
                maxMathWidth={innerMathWidth - 20}
              />
            </View>

            <Text style={styles.cardKicker}>REZOLVARE MODEL PAS CU PAS</Text>
            <StudyBlocksView
              key={`sol-${currentItem.id}`}
              blocks={currentItem.solution}
              scale={readingScale}
              maxWidth={innerMathWidth - 10}
              accent={SUBJECT_ACCENT[currentItem.subject]}
            />

            {currentItem.rubric && currentItem.rubric.length > 0 ? (
              <View style={styles.checklistBox}>
                <Text style={styles.checklistTitle}>Bifează etapele rezolvate corect pe caiet:</Text>
                {currentItem.rubric.map((criterion) => {
                  const checked = currentCheckedSteps.includes(criterion.id);
                  return (
                    <Pressable
                      key={criterion.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                      onPress={() => toggleRubricCriterion(criterion.id)}
                      style={({ pressed }) => [
                        styles.checkRow,
                        checked && styles.checkRowActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={[styles.checkboxBox, checked && styles.checkboxBoxActive]}>
                        {checked ? <MiniGlyph name="check" size={12} color={colors.ink} /> : null}
                      </View>
                      <View style={styles.checkRowBody}>
                        <StudyInlineText
                          text={criterion.step}
                          scale={readingScale * 0.9}
                          maxMathWidth={innerMathWidth - 102}
                          textStyle={styles.checkRowText}
                        />
                      </View>
                      <Text style={styles.checkRowPts}>+{criterion.points}p</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Salvează punctajul de ${currentRubricScore ?? 0} din ${currentItem.maxPoints} puncte`}
            pressedScale={0.97}
            haptic="selection"
            onPress={() => setRubricSheetOpen(false)}
            contentStyle={styles.rubricSaveBtn}
          >
            <Text numberOfLines={2} style={styles.rubricSaveBtnText}>
              Salvează punctajul ({currentRubricScore ?? 0}/{currentItem.maxPoints}p)
            </Text>
            <MiniGlyph name="check" size={15} color={colors.ink} />
          </PressableScale>
        </ComicBottomSheet>
      ) : null}

      <ComicBottomSheet
        visible={confirmMode !== null}
        onClose={() => setConfirmMode(null)}
        maxHeight="62%"
      >
        <Text style={styles.confirmTitle}>
          {confirmMode === 'submit'
            ? secondsLeft === 0
              ? 'Timpul alocat a expirat!'
              : 'Predai lucrarea acum?'
            : 'Părăsești simularea?'}
        </Text>
        <Text style={styles.confirmText}>
          {confirmMode === 'submit'
            ? secondsLeft === 0
              ? `Ai completat ${answeredCount} din ${items.length} itemi. Poți preda lucrarea acum pentru nota oficială sau poți finaliza punctarea pe barem.`
              : `Ai completat ${answeredCount} din ${items.length} itemi. Calculăm punctajul și afișăm baremul complet.`
            : 'Progresul din această sesiune nu va fi păstrat dacă ieși înainte să predai lucrarea.'}
        </Text>

        {confirmMode === 'submit' && unansweredItems.length > 0 ? (
          <View style={styles.unansweredNotice}>
            <Text style={styles.unansweredNoticeText}>
              Necompletați ({unansweredItems.length}): {unansweredPreview}
              {unansweredItems.length > 4 ? ` +${unansweredItems.length - 4}` : ''}
            </Text>
          </View>
        ) : null}

        <View style={styles.confirmActions}>
          {confirmMode === 'submit' && unansweredItems.length > 0 && secondsLeft > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mergi la primul item necompletat: ${unansweredItems[0].item.numberLabel}`}
              onPress={() => {
                const targetIdx = unansweredItems[0].idx;
                setConfirmMode(null);
                jumpToIndex(targetIdx);
              }}
              style={({ pressed }) => [styles.jumpUnansweredBtn, pressed && styles.pressed]}
            >
              <Text numberOfLines={2} style={styles.jumpUnansweredText}>
                Mergi la {unansweredItems[0].item.numberLabel} (necompletat)
              </Text>
            </Pressable>
          ) : null}

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={confirmMode === 'submit' ? 'Confirmă predarea lucrării' : 'Ieși din simulare'}
            pressedScale={0.97}
            haptic="medium"
            onPress={() => {
              if (confirmMode === 'submit') {
                finishExam();
              } else {
                setConfirmMode(null);
                leavingAllowedRef.current = true;
                beginAppTransition();
                navigation.goBack();
              }
            }}
            contentStyle={[
              styles.confirmPrimaryBtn,
              confirmMode === 'exit' && styles.confirmExitBtn,
            ]}
          >
            <Text numberOfLines={2} style={[styles.confirmPrimaryText, confirmMode === 'exit' && styles.confirmExitText]}>
              {confirmMode === 'submit' ? 'Da, predă și calculează nota' : 'Da, ieși acum'}
            </Text>
          </PressableScale>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rămâi în simulare"
            onPress={() => setConfirmMode(null)}
            style={({ pressed }) => [styles.confirmSecondaryBtn, pressed && styles.pressed]}
          >
            <Text style={styles.confirmSecondaryText}>Rămâi la simulare</Text>
          </Pressable>
        </View>
      </ComicBottomSheet>

      <AiBlockingOverlay
        visible={gradingBusy}
        eyebrow={`BAREM OFICIAL · ${gradingTargetLabel || currentItem.numberLabel}`}
        title="Profu’ AI corectează rezolvarea"
        stages={GRADING_AI_STAGES}
        subtitle="Cronometrul simulării este pus pe pauză până terminăm corectarea."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flexBody: { flex: 1, minHeight: 0 },
  topBar: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  timerPill: {
    flex: 1,
    minWidth: 80,
    minHeight: 34,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.14)',
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  timerPillLow: {
    borderColor: '#F3A6B3',
    backgroundColor: colors.roseSoft,
  },
  timerText: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 13,
    includeFontPadding: false,
  },
  timerTextLow: {
    color: '#A51D36',
  },
  progressPill: {
    minHeight: 34,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  progressPillText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 11.5,
    includeFontPadding: false,
  },
  scalePill: {
    minWidth: 34,
    minHeight: 34,
    paddingHorizontal: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.16)',
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scalePillText: {
    fontFamily: fonts.display,
    color: colors.violetDeep,
    fontSize: 12,
    includeFontPadding: false,
  },
  submitPill: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  submitPillText: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 13,
    includeFontPadding: false,
  },

  navStripWrap: {
    paddingBottom: 8,
  },
  navStrip: {
    gap: 7,
    alignItems: 'center',
  },
  navChip: {
    minHeight: 32,
    paddingHorizontal: 11,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  navChipActive: {
    borderColor: colors.violet,
    backgroundColor: colors.violet,
  },
  navChipAnswered: {
    borderColor: '#C5EA63',
    backgroundColor: '#F5FFD6',
  },
  navChipText: {
    fontFamily: fonts.bodyBold,
    color: colors.inkSoft,
    fontSize: 11.5,
  },
  navChipTextActive: {
    color: colors.paper,
  },
  answeredDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.limeDeep,
  },
  answeredDotActive: {
    backgroundColor: colors.lime,
  },

  scrollBody: {
    flexGrow: 1,
    paddingTop: 4,
    alignItems: 'center',
  },
  stageWrap: {
    width: '100%',
    gap: 12,
  },
  promptCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.13)',
    backgroundColor: colors.paper,
    paddingHorizontal: 17,
    paddingVertical: 15,
    gap: 10,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  subjectBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  subjectBadgeText: {
    fontFamily: fonts.display,
    fontSize: 12,
  },
  pointsBadge: {
    borderRadius: radii.pill,
    backgroundColor: colors.limeSoft,
    borderWidth: 1,
    borderColor: '#D6F08A',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pointsBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.limeDeep,
  },
  itemTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 19.5,
    lineHeight: 24,
  },

  choicesStack: { gap: 9 },
  choiceCard: {
    minHeight: 56,
    borderRadius: 19,
    borderWidth: 1.4,
    borderColor: 'rgba(124, 60, 255, 0.14)',
    backgroundColor: colors.paper,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  choiceCardSelected: {
    borderColor: colors.violet,
    backgroundColor: colors.violetSoft,
  },
  choiceBadge: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: 'rgba(124, 60, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  choiceBadgeSelected: { backgroundColor: colors.violet },
  choiceBadgeText: {
    fontFamily: fonts.display,
    color: colors.violetDeep,
    fontSize: 14.5,
  },
  choiceBadgeTextSelected: { color: colors.paper },
  choiceBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  choiceLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 15.5,
    lineHeight: 22,
  },

  shortAnswerBox: { gap: 9 },
  inputWrap: {
    minHeight: 56,
    borderRadius: 19,
    borderWidth: 1.4,
    borderColor: 'rgba(124, 60, 255, 0.2)',
    backgroundColor: colors.paper,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputWrapFilled: {
    borderColor: colors.violet,
  },
  shortInput: {
    flex: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 19,
    paddingVertical: 9,
  },
  clearInputBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolChipsRow: { flexDirection: 'row', gap: 7 },
  symbolChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.14)',
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolChipText: {
    fontFamily: fonts.display,
    color: colors.violetDeep,
    fontSize: 17.5,
  },
  keyboardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  keyboardDock: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 60, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    paddingTop: 9,
    paddingBottom: 10,
    alignItems: 'center',
  },
  keyboardDockInner: {
    width: '100%',
    gap: 8,
  },
  dockSymbolChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.14)',
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockHideBtn: {
    minHeight: 38,
    paddingHorizontal: 11,
    borderRadius: 12,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dockHideText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 12.5,
  },
  dockPrevBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.16)',
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dockNextBtn: {
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardNextText: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 15.5,
    textAlign: 'center',
  },
  savedInlinePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: '#F4FFD2',
  },
  savedInlineText: {
    fontFamily: fonts.bodyBold,
    color: colors.limeDeep,
    fontSize: 11.5,
  },

  rubricWorkspace: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.13)',
    backgroundColor: colors.paper,
    padding: 15,
    gap: 11,
  },
  rubricHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rubricHeaderCopy: { flex: 1, minWidth: 0 },
  cardKicker: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 10.5,
    letterSpacing: 0.75,
  },
  rubricTitle: {
    marginTop: 2,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17.5,
  },
  rubricPtsPill: {
    minHeight: 32,
    paddingHorizontal: 11,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rubricPtsPillScored: { backgroundColor: colors.lime },
  rubricPtsText: {
    fontFamily: fonts.display,
    color: colors.violetDeep,
    fontSize: 13.5,
  },
  rubricPtsTextScored: { color: colors.ink },
  rubricNote: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18.5,
  },
  photoActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  cameraBtnWrap: { flex: 1, minWidth: 0 },
  cameraBtn: {
    minHeight: 52,
    borderRadius: 17,
    backgroundColor: colors.lime,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cameraBtnText: {
    flexShrink: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    textAlign: 'center',
  },
  galleryMiniBtn: {
    width: 52,
    height: 52,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.14)',
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  errorBox: {
    borderRadius: 14,
    backgroundColor: colors.roseSoft,
    padding: 10,
  },
  errorText: {
    fontFamily: fonts.bodyMedium,
    color: '#991F33',
    fontSize: 12.5,
    lineHeight: 17.5,
  },

  aiResultCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.16)',
    backgroundColor: '#F8F4FF',
    padding: 12,
    gap: 8,
  },
  aiResultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  aiResultTag: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 10.5,
    letterSpacing: 0.6,
  },
  aiResultPts: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 16,
    flexShrink: 0,
  },
  aiResultSummary: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
  },
  aiCritRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 60, 255, 0.08)',
  },
  aiCritPts: {
    minWidth: 42,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    flexShrink: 0,
  },
  aiCritPtsText: {
    fontFamily: fonts.bodyBold,
    color: colors.limeDeep,
    fontSize: 11,
  },
  aiCritCopy: { flex: 1, minWidth: 0, gap: 2 },
  aiCritStep: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 12.5,
  },
  aiCritComment: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 16.5,
  },
  aiTipPill: {
    borderRadius: 12,
    backgroundColor: colors.paper,
    padding: 9,
  },
  aiTipText: {
    fontFamily: fonts.bodyMedium,
    color: colors.violetDeep,
    fontSize: 12,
    lineHeight: 16.5,
  },

  manualRubricBtn: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.14)',
    backgroundColor: colors.violetSoft,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  manualRubricText: {
    flex: 1,
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 12.5,
    lineHeight: 17,
  },

  bottomBar: {
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepNavBtn: {
    width: 48,
    height: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.14)',
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNavBtnDisabled: { opacity: 0.4 },
  mainNavWrap: { flex: 1, minWidth: 0 },
  mainNavBtn: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: colors.lime,
    paddingLeft: 18,
    paddingRight: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  mainNavText: {
    flex: 1,
    flexShrink: 1,
    textAlign: 'center',
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 16.5,
    lineHeight: 20,
  },
  mainNavArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  rubricSheetContainer: {
    height: '88%',
    paddingHorizontal: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  sheetHeaderCopy: { flex: 1, minWidth: 0 },
  sheetTitle: {
    marginTop: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17.5,
    lineHeight: 21.5,
  },
  sheetScrollBody: {
    paddingTop: 4,
    paddingBottom: 18,
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
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  checklistBox: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 60, 255, 0.1)',
    gap: 7,
  },
  checklistTitle: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 12.5,
  },
  checkRow: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.12)',
    backgroundColor: colors.paper,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  checkRowActive: {
    borderColor: colors.limeDeep,
    backgroundColor: '#F4FFD2',
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.violet,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxBoxActive: {
    borderColor: colors.limeDeep,
    backgroundColor: colors.lime,
  },
  checkRowBody: {
    flex: 1,
    minWidth: 0,
  },
  checkRowText: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 12.5,
    lineHeight: 17.5,
  },
  checkRowPts: {
    fontFamily: fonts.display,
    color: colors.violetDeep,
    fontSize: 13,
    flexShrink: 0,
  },
  rubricSaveBtn: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: colors.lime,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  rubricSaveBtnText: {
    flexShrink: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 15,
    textAlign: 'center',
  },

  confirmTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 22,
    textAlign: 'center',
  },
  confirmText: {
    marginTop: 6,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  unansweredNotice: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFE08A',
    backgroundColor: '#FFFBEF',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  unansweredNoticeText: {
    fontFamily: fonts.bodyBold,
    color: '#8C5800',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  confirmActions: {
    marginTop: 14,
    gap: 9,
  },
  jumpUnansweredBtn: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.2)',
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  jumpUnansweredText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 13,
    textAlign: 'center',
  },
  confirmPrimaryBtn: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  confirmExitBtn: {
    backgroundColor: colors.rose,
  },
  confirmPrimaryText: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 16,
    textAlign: 'center',
  },
  confirmExitText: {
    color: colors.paper,
  },
  confirmSecondaryBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  confirmSecondaryText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 13.5,
  },
  pressed: { opacity: 0.78 },
});
