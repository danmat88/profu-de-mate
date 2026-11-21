import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import * as Haptics from '../../../shared/services/haptics';
import { borders, colors, fonts, shadows, springs, typography } from '../../../shared/theme';
import type { RootStackParamList } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { ComicTabBar, type ComicTabOption } from '../../../shared/ui/ComicTabBar';
import { IconButton } from '../../../shared/ui/IconButton';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { ProgressDots } from '../../../shared/ui/ProgressDots';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { Text } from '../../../shared/ui/Typography';
import { useCommercial } from '../../access/context/CommercialContext';
import { deleteTemporaryCapturedImages } from '../../capture/services/temporaryImages';
import { FeedbackSheet } from '../../feedback/components/FeedbackSheet';
import { MathDocumentView } from '../../math/components/MathDocumentView';
import { contentToAccessibleText } from '../../math/utils/mathContent';
import type { MathDocumentDefinition, MathDocumentTone } from '../../math/utils/mathDocument';
import { forgetLessonPresentation, markLessonPresentationReady } from '../services/lessonPresentation';
import { setLessonFavorite } from '../services/lessons';

type Props = NativeStackScreenProps<RootStackParamList, 'Lesson'>;
type ProblemView = 'statement' | 'photo';

const documentTones: MathDocumentTone[] = ['cyan', 'peach', 'lime', 'violet'];
const ribbonColors: Record<MathDocumentTone, string> = {
  cyan: colors.cyan,
  peach: colors.peach,
  lime: colors.lime,
  violet: colors.violetBright,
  rose: colors.rose,
};

const problemViewTabs: readonly ComicTabOption<ProblemView>[] = [
  { value: 'statement', label: 'Enunț citit', activeFill: colors.violet, activeText: colors.paper },
  { value: 'photo', label: 'Fotografia ta', activeFill: colors.cyan, activeText: colors.ink },
];

export function LessonScreen({ navigation, route }: Props) {
  const frame = useSafeAreaFrame();
  const { gutter } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { refresh: refreshCommercialAccess } = useCommercial();
  const lesson = route.params.lesson;
  const sourceImage = route.params.sourceImage;
  const isCheck = lesson.mode === 'check';
  const isFromNotebook = route.params.source === 'notebook';
  const [stepState, setStepState] = useState<{ step: number; direction: -1 | 0 | 1 }>({
    step: 0,
    direction: 0,
  });
  const step = stepState.step;
  const [alternate, setAlternate] = useState(false);
  const [problemOpen, setProblemOpen] = useState(false);
  const [problemView, setProblemView] = useState<ProblemView>('statement');
  const [saved, setSaved] = useState(route.params.isFavorite ?? false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const alternateReveal = useSharedValue(0);
  const problemReveal = useSharedValue(0);
  const problemTabProgress = useSharedValue(0);
  const savedReveal = useSharedValue(0);

  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeAlternateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeProblemTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveLocked = useRef(false);
  const pagingLocked = useRef(false);
  const pagingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = lesson.steps[step];
  const tone = documentTones[step % documentTones.length];
  const bottomSpace = Math.max(insets.bottom, 8);
  const problemAccessible = contentToAccessibleText(lesson.problem);
  const isLastStep = step === lesson.steps.length - 1;
  const nextTitle = isLastStep ? 'Vezi rezultatul' : 'Continuă';

  const lessonDocument = useMemo<MathDocumentDefinition>(() => ({
    accessibilityLabel: `${current.title}. ${contentToAccessibleText(current.explanation)}. ${contentToAccessibleText(current.note)}`,
    variant: 'lesson',
    sections: [
      { kind: 'heading', eyebrow: current.kicker, title: current.title, tone },
      { kind: 'content', content: current.explanation },
      ...(current.note.length > 0
        ? [{ kind: 'note' as const, label: 'DE ȚINUT MINTE', content: current.note, tone: 'lime' as const }]
        : []),
    ],
  }), [current, tone]);

  const alternateDocument = useMemo<MathDocumentDefinition>(() => ({
    accessibilityLabel: `O altă explicație. ${contentToAccessibleText(current.alternative)}`,
    variant: 'alternate',
    sections: [{ kind: 'content', content: current.alternative }],
  }), [current.alternative]);

  const problemDocument = useMemo<MathDocumentDefinition>(() => ({
    accessibilityLabel: `Enunțul complet. ${problemAccessible}`,
    variant: 'problem',
    sections: [{ kind: 'content', content: lesson.problem }],
  }), [lesson.problem, problemAccessible]);

  useEffect(() => {
    setAlternate(false);
    alternateReveal.set(0);
  }, [alternateReveal, step]);

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    if (pagingTimer.current) clearTimeout(pagingTimer.current);
    if (closeAlternateTimer.current) clearTimeout(closeAlternateTimer.current);
    if (closeProblemTimer.current) clearTimeout(closeProblemTimer.current);
  }, []);

  useEffect(() => navigation.addListener('beforeRemove', () => {
    forgetLessonPresentation(route.params.lessonId);
    deleteTemporaryCapturedImages([sourceImage?.uri]);
  }), [navigation, route.params.lessonId, sourceImage?.uri]);

  useEffect(() => {
    if (route.params.source !== 'flow') return undefined;
    let refreshed = false;
    return navigation.addListener('transitionEnd', (event) => {
      if (event.data.closing || refreshed) return;
      refreshed = true;
      void refreshCommercialAccess();
    });
  }, [navigation, refreshCommercialAccess, route.params.source]);

  const lockPaging = useCallback(() => {
    if (pagingLocked.current) return false;
    pagingLocked.current = true;
    pagingTimer.current = setTimeout(() => { pagingLocked.current = false; }, 340);
    return true;
  }, []);

  const jumpToStep = useCallback((target: number) => {
    if (target < 0 || target >= lesson.steps.length || target === step) return;
    if (!lockPaging()) return;
    setStepState({ step: target, direction: target > step ? 1 : -1 });
  }, [lesson.steps.length, lockPaging, step]);

  const next = useCallback(() => {
    if (!lockPaging()) return;
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    if (step < lesson.steps.length - 1) {
      setStepState((current) => ({ step: current.step + 1, direction: 1 }));
      return;
    }
    if (isFromNotebook) {
      navigation.replace('Summary', { lesson, lessonId: route.params.lessonId, isFavorite: saved });
      return;
    }
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Home' },
        { name: 'Summary', params: { lesson, lessonId: route.params.lessonId, isFavorite: saved } },
      ],
    });
  }, [isFromNotebook, lesson, lockPaging, navigation, route.params.lessonId, saved, step]);

  const back = useCallback(() => {
    if (!lockPaging()) return;
    Haptics.selection();
    if (step > 0) {
      setStepState((current) => ({ step: current.step - 1, direction: -1 }));
      return;
    }
    if (isFromNotebook) navigation.goBack();
    else if (navigation.canGoBack()) navigation.popToTop();
    else navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }, [isFromNotebook, lockPaging, navigation, step]);

  const swipePrev = useCallback(() => {
    if (step > 0) back();
  }, [back, step]);

  const swipeGesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetX([-36, 36])
      .failOffsetY([-16, 16])
      .onEnd((event) => {
        if (event.translationX < -68 || event.velocityX < -580) {
          scheduleOnRN(next);
        } else if (event.translationX > 68 || event.velocityX > 580) {
          scheduleOnRN(swipePrev);
        }
      }),
    [next, swipePrev],
  );

  const closeAlternate = () => {
    if (closeAlternateTimer.current) clearTimeout(closeAlternateTimer.current);
    if (reducedMotion) {
      alternateReveal.set(0);
      setAlternate(false);
      return;
    }
    alternateReveal.set(withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) }));
    closeAlternateTimer.current = setTimeout(() => setAlternate(false), 155);
  };

  const explainDifferently = () => {
    Haptics.selection();
    if (alternate) {
      closeAlternate();
      return;
    }
    if (closeAlternateTimer.current) clearTimeout(closeAlternateTimer.current);
    setAlternate(true);
    alternateReveal.set(0);
    if (reducedMotion) alternateReveal.set(1);
    else alternateReveal.set(withSpring(1, springs.snappy));
  };

  const closeProblem = () => {
    if (closeProblemTimer.current) clearTimeout(closeProblemTimer.current);
    if (reducedMotion) {
      problemReveal.set(0);
      setProblemOpen(false);
      return;
    }
    problemReveal.set(withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) }));
    closeProblemTimer.current = setTimeout(() => setProblemOpen(false), 155);
  };

  const toggleProblem = () => {
    Haptics.selection();
    if (problemOpen) {
      closeProblem();
      return;
    }
    if (closeProblemTimer.current) clearTimeout(closeProblemTimer.current);
    setProblemView('statement');
    problemTabProgress.set(0);
    setProblemOpen(true);
    problemReveal.set(0);
    if (reducedMotion) problemReveal.set(1);
    else problemReveal.set(withSpring(1, springs.snappy));
  };

  const chooseProblemView = (next: ProblemView) => {
    if (next === problemView) return;
    setProblemView(next);
    const target = next === 'photo' ? 1 : 0;
    problemTabProgress.set(reducedMotion ? target : withSpring(target, springs.snappy));
  };

  const toggleSaved = async () => {
    if (saveLocked.current) return;
    saveLocked.current = true;
    const nextSaved = !saved;
    setSaved(nextSaved);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    if (!nextSaved) {
      setShowSavedToast(false);
    } else {
      setShowSavedToast(true);
      savedReveal.set(0);
      if (reducedMotion) savedReveal.set(1);
      else savedReveal.set(withSpring(1, springs.bouncy));
      savedTimer.current = setTimeout(() => setShowSavedToast(false), 1750);
    }
    try {
      await setLessonFavorite(route.params.lessonId, nextSaved);
    } catch {
      setSaved(!nextSaved);
      setShowSavedToast(false);
    } finally {
      saveLocked.current = false;
    }
  };

  const toastAnimated = useAnimatedStyle(() => {
    const p = savedReveal.get();
    return {
      opacity: Math.min(1, p * 1.2),
      transform: [{ translateY: (1 - p) * -10 }, { scale: 0.9 + p * 0.1 }],
    };
  });

  const alternateScrimStyle = useAnimatedStyle(() => ({ opacity: alternateReveal.get() }));
  const alternateSheetStyle = useAnimatedStyle(() => {
    const p = alternateReveal.get();
    return {
      opacity: Math.min(1, p * 1.3),
      transform: [{ translateY: (1 - p) * 60 }],
    };
  });

  const problemScrimStyle = useAnimatedStyle(() => ({ opacity: problemReveal.get() }));
  const problemSheetStyle = useAnimatedStyle(() => {
    const p = problemReveal.get();
    return {
      opacity: Math.min(1, p * 1.3),
      transform: [{ translateY: (1 - p) * 60 }],
    };
  });

  const statementPaneStyle = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, problemTabProgress.get()));
    return {
      opacity: 1 - p,
      transform: [{ translateX: -p * 18 }],
    };
  });

  const photoPaneStyle = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, problemTabProgress.get()));
    return {
      opacity: p,
      transform: [{ translateX: (1 - p) * 18 }],
    };
  });

  return (
    <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <ScreenHeader
        compact
        title={isCheck ? 'Verificarea rezolvării' : 'Rezolvarea pas cu pas'}
        eyebrow={`PASUL ${step + 1} DIN ${lesson.steps.length}`}
        onBack={back}
        rightIcon="bookmark"
        rightLabel={saved ? 'Scoate din Caiet' : 'Salvează în Caiet'}
        rightActive={saved}
        onRight={toggleSaved}
      />

      {showSavedToast ? (
        <Animated.View pointerEvents="none" style={[styles.savedToast, toastAnimated]}>
          <MiniGlyph name="check" size={16} color={colors.ink} />
          <Text style={styles.savedText}>Lecție salvată</Text>
        </Animated.View>
      ) : null}

      <ProgressDots
        total={lesson.steps.length}
        current={step}
        onSelectStep={jumpToStep}
        style={[styles.progress, { marginHorizontal: gutter }]}
      />

      <View style={[styles.stage, { paddingHorizontal: gutter }]}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Deschide enunțul: ${problemAccessible}`}
          depth={shadows.sm}
          radius={14}
          shadowColor={colors.ink}
          haptic="selection"
          onPress={toggleProblem}
          style={styles.problemWrap}
          contentStyle={styles.problemRow}
        >
          <View style={styles.problemIcon}>
            <Text style={styles.problemIconText}>x²</Text>
          </View>
          <Text numberOfLines={1} style={styles.problem}>{lesson.title}</Text>
          <View style={styles.problemActionPill}>
            <Text style={styles.problemAction}>Enunț</Text>
            <MiniGlyph name="next" size={13} color={colors.violetDeep} />
          </View>
        </PressableScale>

        <GestureDetector gesture={swipeGesture}>
          <View style={styles.cardWrap}>
            <View pointerEvents="none" style={styles.cardShadow} />
            <View style={styles.cardFace}>
              <View style={[styles.cardRibbon, { backgroundColor: ribbonColors[tone] }]}>
                <View pointerEvents="none" style={styles.cardRibbonShine} />
              </View>
              <View style={styles.documentFrame}>
                <MathDocumentView definition={lessonDocument}
                  transitionDirection={stepState.direction}
                  testID="lesson-math-document"
                  onReady={() => markLessonPresentationReady(route.params.lessonId)}
                />
              </View>
            </View>
          </View>
        </GestureDetector>
      </View>

      <View style={[styles.actionDock, { paddingHorizontal: gutter, paddingBottom: bottomSpace }]}>
        <View style={styles.secondaryRow}>
          {step > 0 ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Pasul anterior"
              depth={shadows.sm}
              radius={14}
              shadowColor={colors.ink}
              haptic="selection"
              onPress={back}
              contentStyle={styles.prevStepAction}
            >
              <MiniGlyph name="back" size={18} color={colors.ink} />
            </PressableScale>
          ) : null}

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Explică-mi altfel"
            depth={shadows.sm}
            radius={14}
            shadowColor={colors.ink}
            haptic="selection"
            onPress={explainDifferently}
            style={styles.secondaryActionWrap}
            contentStyle={styles.secondaryAction}
          >
            <AppIcon name="hint" size={24} />
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86} style={styles.secondaryTitle}>
              Explică-mi altfel
            </Text>
            <MiniGlyph name="next" size={14} color={colors.violetDeep} />
          </PressableScale>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Raportează o problemă în explicație"
            depth={shadows.sm}
            radius={14}
            shadowColor={colors.ink}
            haptic="selection"
            onPress={() => setFeedbackOpen(true)}
            contentStyle={styles.reportAction}
          >
            <MiniGlyph name="wrong" size={16} color={colors.inkSoft} />
          </PressableScale>
        </View>

        <ComicButton
          compact
          title={nextTitle}
          trailingIcon={isLastStep ? 'check' : 'next'}
          tone="lime"
          onPress={next}
        />
      </View>

      {alternate ? (
        <Modal visible transparent animationType="none" onRequestClose={closeAlternate}>
          <View style={styles.modalLayer}>
            <Animated.View pointerEvents="none" style={[styles.scrim, alternateScrimStyle]} />
            <Pressable accessible={false} onPress={closeAlternate} style={StyleSheet.absoluteFill} />
            <Animated.View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: bottomSpace + 14 }, alternateSheetStyle]}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeading}>
                <Mascot pose="point" size={56} active />
                <View style={styles.sheetCopy}>
                  <Text style={styles.sheetEyebrow}>PROFU’ ÎȚI ARATĂ ALTFEL</Text>
                  <Text style={styles.sheetTitle}>O explicație mai simplă</Text>
                </View>
                <IconButton label="Închide explicația" onPress={closeAlternate} size={40}>
                  <MiniGlyph name="close" size={19} color={colors.ink} />
                </IconButton>
              </View>
              <MathDocumentView definition={alternateDocument} style={styles.sheetDocument} testID="alternate-math-document" />
              <ComicButton compact title="Am înțeles" trailingIcon="check" tone="lime" onPress={closeAlternate} />
            </Animated.View>
          </View>
        </Modal>
      ) : null}

      {problemOpen ? (
        <Modal visible transparent animationType="none" onRequestClose={closeProblem}>
          <View style={styles.modalLayer}>
            <Animated.View pointerEvents="none" style={[styles.scrim, problemScrimStyle]} />
            <Pressable accessible={false} onPress={closeProblem} style={StyleSheet.absoluteFill} />
            <Animated.View accessibilityViewIsModal style={[styles.problemSheet, { paddingBottom: bottomSpace + 14 }, problemSheetStyle]}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeading}>
                <View style={[styles.sheetIcon, styles.problemSheetIcon]}>
                  <AppIcon name="notebook" size={34} />
                </View>
                <View style={styles.sheetCopy}>
                  <Text style={styles.sheetEyebrow}>PROBLEMA TA</Text>
                  <Text numberOfLines={2} style={styles.sheetTitle}>{lesson.title}</Text>
                </View>
                <IconButton label="Închide enunțul" onPress={closeProblem} size={40}>
                  <MiniGlyph name="close" size={19} color={colors.ink} />
                </IconButton>
              </View>
              {sourceImage ? (
                <ComicTabBar
                  compact
                  options={problemViewTabs}
                  value={problemView}
                  onChange={chooseProblemView}
                  style={styles.problemTabs}
                />
              ) : null}
              <View style={styles.problemContent}>
                <Animated.View
                  pointerEvents={problemView === 'statement' ? 'auto' : 'none'}
                  accessibilityElementsHidden={problemView !== 'statement'}
                  importantForAccessibility={problemView === 'statement' ? 'yes' : 'no-hide-descendants'}
                  style={[styles.problemPane, statementPaneStyle]}
                >
                  <MathDocumentView definition={problemDocument} testID="problem-math-document" />
                </Animated.View>
                {sourceImage ? (
                  <Animated.View
                    pointerEvents={problemView === 'photo' ? 'auto' : 'none'}
                    accessibilityElementsHidden={problemView !== 'photo'}
                    importantForAccessibility={problemView === 'photo' ? 'yes' : 'no-hide-descendants'}
                    style={[styles.problemPaneOverlay, photoPaneStyle]}
                  >
                    <View accessible accessibilityRole="image" accessibilityLabel="Fotografia originală a problemei" style={styles.sourceImageCard}>
                      <Image accessible={false} source={{ uri: sourceImage.uri }} resizeMode="contain" style={styles.sourceImage} />
                    </View>
                  </Animated.View>
                ) : null}
              </View>
            </Animated.View>
          </View>
        </Modal>
      ) : null}
      <FeedbackSheet visible={feedbackOpen} lessonId={route.params.lessonId} onClose={() => setFeedbackOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  progress: { marginBottom: 7 },
  savedToast: {
    position: 'absolute',
    zIndex: 20,
    right: 18,
    top: 56,
    minHeight: 36,
    borderRadius: 13,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  savedText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12.5 },
  stage: { flex: 1, minHeight: 0, gap: 7, paddingBottom: 2 },

  problemWrap: {},
  problemRow: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.paperTint,
    paddingHorizontal: 8,
  },
  problemIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  problemIconText: { fontFamily: fonts.display, color: colors.ink, fontSize: 12.5 },
  problem: { flex: 1, minWidth: 0, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12.5, lineHeight: 16 },
  problemActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: colors.violetSoft,
  },
  problemAction: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 11.5 },

  // Illustrated step card deck
  cardWrap: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    paddingBottom: shadows.md,
  },
  cardShadow: {
    position: 'absolute',
    top: shadows.md,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 23,
    backgroundColor: colors.ink,
  },
  cardFace: {
    flex: 1,
    minHeight: 0,
    borderRadius: 23,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    overflow: 'hidden',
  },
  cardRibbon: {
    height: 9,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.ink,
    position: 'relative',
  },
  cardRibbonShine: {
    position: 'absolute',
    top: 1.5,
    left: 14,
    right: 14,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: colors.shine,
  },
  documentFrame: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: colors.paper },

  // Action dock
  actionDock: { backgroundColor: colors.canvas, paddingTop: 5, gap: 6 },
  secondaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prevStepAction: {
    width: 42,
    height: 40,
    borderRadius: 14,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionWrap: { flex: 1 },
  secondaryAction: {
    height: 40,
    borderRadius: 14,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.violetSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
  },
  secondaryTitle: { flex: 1, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12.5 },
  reportAction: {
    width: 42,
    height: 40,
    borderRadius: 14,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bottom sheets
  modalLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 30, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(23,19,55,0.5)' },
  sheet: {
    width: '100%',
    maxWidth: 640,
    height: '82%',
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: borders.thick,
    borderBottomWidth: 0,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  problemSheet: {
    width: '100%',
    maxWidth: 640,
    height: '86%',
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: borders.thick,
    borderBottomWidth: 0,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  sheetHandle: { width: 46, height: 5, borderRadius: 3, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 10 },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  sheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.cyanSoft,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  problemSheetIcon: { backgroundColor: colors.violetSoft },
  sheetCopy: { flex: 1, minWidth: 0 },
  sheetEyebrow: { ...typography.kicker, color: colors.violetDeep },
  sheetTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 18, lineHeight: 22, marginTop: 1 },
  sheetDocument: { marginBottom: 10 },
  problemTabs: { marginBottom: 10 },
  problemContent: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: colors.paper, position: 'relative' },
  problemPane: { flex: 1 },
  problemPaneOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sourceImageCard: { flex: 1, padding: 8, borderRadius: 16, borderWidth: borders.thin, borderColor: colors.line, backgroundColor: '#F4EEFF' },
  sourceImage: { width: '100%', height: '100%', borderRadius: 12 },
});
