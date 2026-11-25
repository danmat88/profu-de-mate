import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, Share, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { beginAppTransition } from '../../../shared/context/TransitionMotionContext';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { useScreenMotionActive, useTransitionSettled } from '../../../shared/hooks/useTransitionSettled';
import * as Haptics from '../../../shared/services/haptics';
import {
  getMathReadingScale,
  mathReadingScaleBadge,
  nextMathReadingScale,
  setMathReadingScale,
  type MathReadingScale,
} from '../../../shared/storage/localPreferences';
import { colors, fonts, radii, typography } from '../../../shared/theme';
import type { AnalysisVerdict, CapturedImage, RichContent, RootStackParamList } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { ComicTabBar, type ComicTabOption } from '../../../shared/ui/ComicTabBar';
import { IconButton } from '../../../shared/ui/IconButton';
import { LiquidProgressBar } from '../../../shared/ui/LiquidProgressBar';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { ProgressDots } from '../../../shared/ui/ProgressDots';
import { Text } from '../../../shared/ui/Typography';
import { useCommercial } from '../../access/context/CommercialContext';
import { deleteTemporaryCapturedImages } from '../../capture/services/temporaryImages';
import { FeedbackSheet } from '../../feedback/components/FeedbackSheet';
import { MathDocumentView } from '../../math/components/MathDocumentView';
import { contentToAccessibleText } from '../../math/utils/mathContent';
import type { MathDocumentDefinition, MathDocumentTone } from '../../math/utils/mathDocument';
import { LessonRoadmapModal } from '../components/LessonRoadmapModal';
import { RemoveFromNotebookModal } from '../components/RemoveFromNotebookModal';
import { forgetLessonPresentation, markLessonPresentationReady } from '../services/lessonPresentation';
import { setLessonFavorite } from '../services/lessons';
import { formatLessonShareMessage } from '../utils/lessonShare';

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

const ribbonSoftBg: Record<MathDocumentTone, string> = {
  cyan: '#E8FAFC',
  peach: '#FFF2EC',
  lime: '#F5FFD6',
  violet: '#F3ECFF',
  rose: '#FFE8EC',
};

const problemViewTabs: readonly ComicTabOption<ProblemView>[] = [
  { value: 'statement', label: 'Enunț citit', activeFill: colors.violet, activeText: colors.paper },
  { value: 'photo', label: 'Fotografia ta', activeFill: colors.cyan, activeText: colors.ink },
];

function verdictChipMeta(verdict: AnalysisVerdict, isCheck: boolean): { label: string; bg: string; color: string } | null {
  if (!isCheck || verdict === 'not_applicable') return null;
  if (verdict === 'correct') return { label: '✓ Corectă', bg: colors.lime, color: colors.ink };
  if (verdict === 'partially_correct') return { label: '★ Aproape', bg: colors.gold, color: colors.ink };
  return { label: '! De corectat', bg: colors.roseSoft, color: '#991F33' };
}

function LessonSaveToast({ kind, reducedMotion, topOffset }: { kind: 'saved' | 'removed'; reducedMotion: boolean; topOffset: number }) {
  const reveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    reveal.stopAnimation();
    if (reducedMotion) {
      reveal.setValue(1);
      return undefined;
    }
    reveal.setValue(0);
    Animated.spring(reveal, {
      toValue: 1,
      tension: 260,
      friction: 18,
      useNativeDriver: true,
    }).start();
    return () => {
      reveal.stopAnimation();
    };
  }, [kind, reducedMotion, reveal]);

  const opacity = reveal.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0, 1, 1] });
  const translateY = reveal.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] });
  const scale = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.savedToast,
        kind === 'removed' && styles.removedToast,
        { top: topOffset, opacity, transform: [{ translateY }, { scale }] },
      ]}
    >
      <MiniGlyph name={kind === 'saved' ? 'check' : 'wrong'} size={15} color={colors.ink} />
      <Text style={styles.savedText}>
        {kind === 'saved' ? 'Lecție salvată în Caiet' : 'Scoasă din Caiet'}
      </Text>
    </Animated.View>
  );
}

/** Lazily mounted alternate explanation sheet so Frame 0 carries zero hidden sheet worklets. */
function LessonAlternateModal({
  stepNumber,
  alternative,
  readingScale,
  bottomSpace,
  reducedMotion,
  onClosed,
}: {
  stepNumber: number;
  alternative: RichContent;
  readingScale: MathReadingScale;
  bottomSpace: number;
  reducedMotion: boolean;
  onClosed: () => void;
}) {
  const reveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const closingRef = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const alternateDocument = useMemo<MathDocumentDefinition>(() => ({
    accessibilityLabel: `O altă explicație. ${contentToAccessibleText(alternative)}`,
    variant: 'alternate',
    sections: [{ kind: 'content', content: alternative }],
  }), [alternative]);

  useEffect(() => {
    if (reducedMotion) {
      reveal.setValue(1);
    } else {
      Animated.spring(reveal, {
        toValue: 1,
        tension: 250,
        friction: 24,
        useNativeDriver: true,
      }).start();
    }
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      reveal.stopAnimation();
    };
  }, [reducedMotion, reveal]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (reducedMotion) {
      reveal.setValue(0);
      onClosed();
      return;
    }
    Animated.timing(reveal, {
      toValue: 0,
      duration: 150,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
    closeTimer.current = setTimeout(onClosed, 155);
  }, [onClosed, reducedMotion, reveal]);

  const sheetOpacity = reveal.interpolate({ inputRange: [0, 0.78, 1], outputRange: [0, 1, 1] });
  const sheetTranslateY = reveal.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={requestClose}
    >
      <View style={styles.modalLayer}>
        <Animated.View pointerEvents="none" style={[styles.scrim, { opacity: reveal }]} />
        <Pressable accessible={false} onPress={requestClose} style={StyleSheet.absoluteFill} />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { paddingBottom: bottomSpace + 14, opacity: sheetOpacity, transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetBanner}>
            <View style={styles.sheetMascotBadge}>
              <Mascot pose="point" size={52} active />
            </View>
            <View style={styles.sheetCopy}>
              <View style={styles.sheetTagRow}>
                <View collapsable={false} style={styles.sheetLimeStamp}>
                  <Text style={styles.sheetLimeStampText}>PASUL {stepNumber} · ALTFEL</Text>
                </View>
              </View>
              <Text style={styles.sheetTitle}>Profu’ explică mai simplu</Text>
            </View>
            <IconButton label="Închide explicația" onPress={requestClose} size={40}>
              <MiniGlyph name="close" size={19} color={colors.ink} />
            </IconButton>
          </View>
          <View style={styles.sheetPaper}>
            <MathDocumentView definition={alternateDocument} readingScale={readingScale} style={styles.sheetDocument} testID="alternate-math-document" />
          </View>
          <ComicButton compact title="Am înțeles!" trailingIcon="check" tone="lime" onPress={requestClose} />
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Lazily mounted full problem sheet so Frame 0 avoids hidden document and tab worklets. */
function LessonProblemModal({
  title,
  topic,
  isCheck,
  stepCount,
  problem,
  problemAccessible,
  readingScale,
  sourceImage,
  bottomSpace,
  reducedMotion,
  onShare,
  onClosed,
}: {
  title: string;
  topic: string;
  isCheck: boolean;
  stepCount: number;
  problem: RichContent;
  problemAccessible: string;
  readingScale: MathReadingScale;
  sourceImage?: CapturedImage;
  bottomSpace: number;
  reducedMotion: boolean;
  onShare: () => void;
  onClosed: () => void;
}) {
  const [problemView, setProblemView] = useState<ProblemView>('statement');
  const reveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const tabProgress = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const problemDocument = useMemo<MathDocumentDefinition>(() => ({
    accessibilityLabel: `Enunțul complet. ${problemAccessible}`,
    variant: 'problem',
    sections: [{ kind: 'content', content: problem }],
  }), [problem, problemAccessible]);

  useEffect(() => {
    if (reducedMotion) {
      reveal.setValue(1);
    } else {
      Animated.spring(reveal, {
        toValue: 1,
        tension: 250,
        friction: 24,
        useNativeDriver: true,
      }).start();
    }
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      reveal.stopAnimation();
      tabProgress.stopAnimation();
    };
  }, [reducedMotion, reveal, tabProgress]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (reducedMotion) {
      reveal.setValue(0);
      onClosed();
      return;
    }
    Animated.timing(reveal, {
      toValue: 0,
      duration: 150,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
    closeTimer.current = setTimeout(onClosed, 155);
  }, [onClosed, reducedMotion, reveal]);

  const chooseProblemView = (next: ProblemView) => {
    if (next === problemView) return;
    setProblemView(next);
    const target = next === 'photo' ? 1 : 0;
    tabProgress.stopAnimation();
    if (reducedMotion) {
      tabProgress.setValue(target);
      return;
    }
    Animated.spring(tabProgress, {
      toValue: target,
      tension: 250,
      friction: 24,
      useNativeDriver: true,
    }).start();
  };

  const sheetOpacity = reveal.interpolate({ inputRange: [0, 0.78, 1], outputRange: [0, 1, 1] });
  const sheetTranslateY = reveal.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });
  const statementOpacity = tabProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const statementShift = tabProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });
  const photoOpacity = tabProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const photoShift = tabProgress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={requestClose}
    >
      <View style={styles.modalLayer}>
        <Animated.View pointerEvents="none" style={[styles.scrim, { opacity: reveal }]} />
        <Pressable accessible={false} onPress={requestClose} style={StyleSheet.absoluteFill} />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.problemSheet,
            { paddingBottom: bottomSpace + 14, opacity: sheetOpacity, transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetBanner}>
            <View style={[styles.sheetIcon, styles.problemSheetIcon]}>
              <AppIcon name="notebook" size={32} />
            </View>
            <View style={styles.sheetCopy}>
              <View style={styles.sheetTagRow}>
                <View collapsable={false} style={[styles.sheetModePill, isCheck && styles.sheetModePillCheck]}>
                  <Text style={styles.sheetModePillText}>{isCheck ? 'VERIFICARE' : 'ENUNȚ COMPLET'}</Text>
                </View>
                <View collapsable={false} style={styles.sheetTopicPill}>
                  <Text numberOfLines={1} style={styles.sheetTopicPillText}>{topic} · {stepCount} {stepCount === 1 ? 'pas' : 'pași'}</Text>
                </View>
              </View>
              <Text numberOfLines={2} style={styles.sheetTitle}>{title}</Text>
            </View>
            <IconButton label="Închide enunțul" onPress={requestClose} size={40}>
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
              style={[styles.problemPane, { opacity: statementOpacity, transform: [{ translateX: statementShift }] }]}
            >
              <MathDocumentView definition={problemDocument} readingScale={readingScale} testID="problem-math-document" />
            </Animated.View>
            {sourceImage ? (
              <Animated.View
                pointerEvents={problemView === 'photo' ? 'auto' : 'none'}
                accessibilityElementsHidden={problemView !== 'photo'}
                importantForAccessibility={problemView === 'photo' ? 'yes' : 'no-hide-descendants'}
                style={[styles.problemPaneOverlay, { opacity: photoOpacity, transform: [{ translateX: photoShift }] }]}
              >
                <View accessible accessibilityRole="image" accessibilityLabel="Fotografia originală a problemei" style={styles.sourceImageCard}>
                  <Image accessible={false} source={{ uri: sourceImage.uri }} resizeMode="contain" style={styles.sourceImage} />
                </View>
              </Animated.View>
            ) : null}
          </View>
          <View style={styles.problemSheetFooter}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Distribuie problema și rezolvarea"
              onPress={onShare}
              style={({ pressed }) => [styles.sheetShareButton, pressed && styles.quickResultPillPressed]}
            >
              <Text style={styles.sheetShareText}>↗ Trimite lecția</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Înapoi la rezolvare"
              onPress={requestClose}
              style={({ pressed }) => [styles.sheetDoneButton, pressed && styles.quickResultPillPressed]}
            >
              <Text style={styles.sheetDoneText}>Înapoi la pași</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function LessonScreen({ navigation, route }: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, isNarrow, isShort } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const screenFocused = useIsFocused();
  const transitionSettled = useTransitionSettled(navigation, reducedMotion);
  const motionActive = useScreenMotionActive(navigation, reducedMotion);
  const { refresh: refreshCommercialAccess } = useCommercial();
  const lesson = route.params.lesson;
  const sourceImage = route.params.sourceImage;
  const isCheck = lesson.mode === 'check';
  const isFromNotebook = route.params.source === 'notebook';
  const mountMathDocument = !isFromNotebook || transitionSettled;
  const [stepState, setStepState] = useState<{ step: number; direction: -1 | 0 | 1 }>({
    step: 0,
    direction: 0,
  });
  const step = stepState.step;
  const [alternate, setAlternate] = useState(false);
  const [problemOpen, setProblemOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [readingScale, setReadingScale] = useState<MathReadingScale>(() => getMathReadingScale());
  const [saved, setSaved] = useState(route.params.isFavorite ?? false);
  const [saveToast, setSaveToast] = useState<'saved' | 'removed' | null>(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removeEverOpened, setRemoveEverOpened] = useState(false);
  const [removingFromNotebook, setRemovingFromNotebook] = useState(false);
  const [removeError, setRemoveError] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackEverOpened, setFeedbackEverOpened] = useState(false);
  const [arrivalPulse, setArrivalPulse] = useState(0);

  if (removeConfirmOpen && !removeEverOpened) {
    setRemoveEverOpened(true);
  }

  const cardShiftX = useRef(new Animated.Value(0)).current;
  const ribbonSweep = useRef(new Animated.Value(0)).current;

  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveLocked = useRef(false);
  const removedToastPending = useRef(false);
  const pagingLocked = useRef(false);
  const pagingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arrivalPlayed = useRef(false);
  const previousStep = useRef(0);

  const current = lesson.steps[step];
  const nextStep = lesson.steps[step + 1];
  const tone = documentTones[step % documentTones.length];
  const verdictChip = verdictChipMeta(lesson.verdict, isCheck);
  const bottomSpace = Math.max(insets.bottom, 8);
  const problemAccessible = useMemo(() => contentToAccessibleText(lesson.problem), [lesson.problem]);
  const isLastStep = step === lesson.steps.length - 1;
  const nextTitle = isLastStep ? 'Vezi rezultatul' : 'Pasul următor';
  const nextSubtitle = isShort
    ? undefined
    : isLastStep
      ? (lesson.takeaways.length > 0 ? 'Răspuns final și idei cheie' : 'Răspunsul final și concluzia')
      : nextStep?.title
        ? `Urmează: ${nextStep.title}`
        : undefined;
  const stepStamp = `PASUL ${String(step + 1).padStart(2, '0')} / ${String(lesson.steps.length).padStart(2, '0')}`;

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

  const playRibbonSweep = useCallback(() => {
    if (reducedMotion || !motionActive) return;
    ribbonSweep.stopAnimation();
    ribbonSweep.setValue(0);
    Animated.timing(ribbonSweep, {
      toValue: 1,
      duration: 540,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [motionActive, reducedMotion, ribbonSweep]);

  // Immediately halt all animations whenever a transition begins out of LessonScreen.
  useEffect(() => {
    if (motionActive) return;
    cardShiftX.stopAnimation();
    ribbonSweep.stopAnimation();
    cardShiftX.setValue(0);
    ribbonSweep.setValue(0);
  }, [cardShiftX, motionActive, ribbonSweep]);

  // Choreographed arrival flourish strictly AFTER the native slide transition finishes.
  useEffect(() => {
    if (!motionActive || arrivalPlayed.current) return;
    arrivalPlayed.current = true;
    if (reducedMotion) return;
    setArrivalPulse((value) => value + 1);
    playRibbonSweep();
  }, [motionActive, playRibbonSweep, reducedMotion]);

  // Immediate single-phase arrival spring synchronized with MathDocumentView's instant swap.
  useLayoutEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    setAlternate(false);
    if (reducedMotion || !motionActive || stepState.direction === 0) return;

    const direction = stepState.direction;
    cardShiftX.stopAnimation();
    cardShiftX.setValue(direction * 12);
    Animated.spring(cardShiftX, {
      toValue: 0,
      tension: 320,
      friction: 26,
      useNativeDriver: true,
    }).start();
    playRibbonSweep();
  }, [cardShiftX, motionActive, playRibbonSweep, reducedMotion, step, stepState.direction]);

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    if (pagingTimer.current) clearTimeout(pagingTimer.current);
    cardShiftX.stopAnimation();
    ribbonSweep.stopAnimation();
  }, [cardShiftX, ribbonSweep]);

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
    pagingTimer.current = setTimeout(() => { pagingLocked.current = false; }, 210);
    return true;
  }, []);

  const openSummary = useCallback(() => {
    beginAppTransition();
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
  }, [isFromNotebook, lesson, navigation, route.params.lessonId, saved]);

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
    openSummary();
  }, [lesson.steps.length, lockPaging, openSummary, step]);

  const back = useCallback(() => {
    if (!lockPaging()) return;
    Haptics.selection();
    if (step > 0) {
      setStepState((current) => ({ step: current.step - 1, direction: -1 }));
      return;
    }
    beginAppTransition();
    if (isFromNotebook) navigation.goBack();
    else if (navigation.canGoBack()) navigation.popToTop();
    else navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }, [isFromNotebook, lockPaging, navigation, step]);

  const swipePrev = useCallback(() => {
    if (step > 0) back();
  }, [back, step]);

  const swipeGesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetX([-28, 28])
      .failOffsetY([-14, 14])
      .onEnd((event) => {
        if (event.translationX < -54 || event.velocityX < -480) {
          scheduleOnRN(next);
        } else if (event.translationX > 54 || event.velocityX > 480) {
          scheduleOnRN(swipePrev);
        }
      }),
    [next, swipePrev],
  );

  const openAlternate = () => {
    Haptics.selection();
    setAlternate(true);
  };

  const openProblem = () => {
    Haptics.selection();
    setProblemOpen(true);
  };

  const openFeedback = () => {
    setFeedbackEverOpened(true);
    setFeedbackOpen(true);
  };

  const jumpToResult = () => {
    if (!lockPaging()) return;
    Haptics.selection();
    openSummary();
  };

  const openRoadmap = () => {
    Haptics.selection();
    setRoadmapOpen(true);
  };

  const cycleReadingScale = () => {
    Haptics.selection();
    setReadingScale((currentScale) => {
      const nextScale = nextMathReadingScale(currentScale);
      setMathReadingScale(nextScale);
      return nextScale;
    });
    playRibbonSweep();
  };

  const shareLesson = () => {
    Haptics.selection();
    void Share.share({
      title: lesson.title,
      message: formatLessonShareMessage(lesson),
    }).catch(() => undefined);
  };

  const showNotebookToast = useCallback((kind: 'saved' | 'removed') => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSaveToast(kind);
    savedTimer.current = setTimeout(() => setSaveToast(null), 1750);
  }, []);

  const toggleSaved = async () => {
    if (saveLocked.current || removingFromNotebook) return;
    if (saved) {
      Haptics.selection();
      setRemoveError(false);
      setRemoveConfirmOpen(true);
      return;
    }
    saveLocked.current = true;
    setSaved(true);
    showNotebookToast('saved');
    try {
      await setLessonFavorite(route.params.lessonId, true);
    } catch {
      setSaved(false);
      setSaveToast(null);
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    } finally {
      saveLocked.current = false;
    }
  };

  const confirmRemoveFromNotebook = async () => {
    if (removingFromNotebook || saveLocked.current) return;
    setRemovingFromNotebook(true);
    setRemoveError(false);
    try {
      await setLessonFavorite(route.params.lessonId, false);
      Haptics.notification(Haptics.NotificationFeedbackType.Success);
      setSaved(false);
      removedToastPending.current = true;
      setRemovingFromNotebook(false);
      setRemoveConfirmOpen(false);
    } catch {
      setRemoveError(true);
      setRemovingFromNotebook(false);
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleRemoveModalClosed = useCallback(() => {
    setRemoveError(false);
    if (removedToastPending.current) {
      removedToastPending.current = false;
      showNotebookToast('removed');
    }
  }, [showNotebookToast]);

  const ribbonSweepStyle = useMemo(
    () => ({
      opacity: ribbonSweep.interpolate({
        inputRange: [0, 0.15, 0.85, 1],
        outputRange: [0, 0.78, 0.78, 0],
      }),
      transform: [
        {
          translateX: ribbonSweep.interpolate({
            inputRange: [0, 1],
            outputRange: [-90, 420],
          }),
        },
        { skewX: '-24deg' },
      ],
    }),
    [ribbonSweep],
  );

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      <ComicBackdrop />

      {/* Compact curved Lesson Canopy */}
      <View style={[styles.canopy, { paddingTop: insets.top ?? 0 }]}>
        <LinearGradient
          colors={isCheck
            ? ['#C83B67', '#7F23A8', '#44138F']
            : ['#7A38FF', '#581EE0', '#380E9F']}
          start={{ x: 0.06, y: 0 }}
          end={{ x: 0.94, y: 1 }}
          style={styles.fill}
        />
        <View pointerEvents="none" style={styles.canopyGlow} />
        <View pointerEvents="none" style={styles.canopyOrbitArc} />

        <View style={[styles.canopyInner, { paddingHorizontal: gutter }]}>
          <View style={styles.canopyRow}>
            <IconButton
              label="Înapoi"
              onPress={back}
              size={42}
              style={styles.canopyActionBtn}
            >
              <MiniGlyph name="back" size={18} color={colors.violetDeep} />
            </IconButton>

            <View style={styles.canopyCopy}>
              <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={styles.canopyTitle}>
                {isCheck ? 'Verificarea rezolvării' : 'Rezolvarea pas cu pas'}
              </Text>
              <View style={styles.canopyEyebrowRow}>
                <View style={styles.canopyEyebrowDot} />
                <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.canopyEyebrow}>
                  {isFromNotebook ? 'DIN CAIETUL TĂU' : `PASUL ${step + 1} DIN ${lesson.steps.length}`}
                </Text>
              </View>
            </View>

            <IconButton
              label={saved ? 'Scoate din Caiet' : 'Salvează în Caiet'}
              onPress={toggleSaved}
              size={42}
              style={[styles.canopyActionBtn, saved && styles.canopyFavActive]}
            >
              <AppIcon name="bookmark" size={22} />
            </IconButton>
          </View>

          <LiquidProgressBar
            progress={(step + 1) / Math.max(1, lesson.steps.length)}
            height={6}
            tone={isCheck ? 'warm' : 'dark'}
            active={motionActive}
          />
        </View>
      </View>

      {saveToast ? (
        <LessonSaveToast
          kind={saveToast}
          reducedMotion={reducedMotion}
          topOffset={(insets.top ?? 0) + 58}
        />
      ) : null}

      <View style={[styles.progressBlock, { marginHorizontal: gutter }]}>
        <ProgressDots
          total={lesson.steps.length}
          current={step}
          active={motionActive}
          pulseSignal={arrivalPulse}
          onSelectStep={jumpToStep}
        />
      </View>

      <View style={[styles.stage, { paddingHorizontal: gutter }]}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Deschide enunțul: ${problemAccessible}`}
          pressedScale={0.98}
          haptic="selection"
          onPress={openProblem}
          style={styles.problemWrap}
          contentStyle={styles.problemRow}
        >
          <View style={[styles.problemIcon, isCheck && styles.problemIconCheck]}>
            <Text style={styles.problemIconText}>{isCheck ? '✓' : 'ƒ'}</Text>
          </View>
          <View style={styles.problemCopy}>
            <View style={styles.problemMetaRow}>
              <Text numberOfLines={1} style={styles.problemTopic}>{lesson.topic}</Text>
              {verdictChip ? (
                <View collapsable={false} style={[styles.verdictMicroChip, { backgroundColor: verdictChip.bg }]}>
                  <Text style={[styles.verdictMicroText, { color: verdictChip.color }]}>{verdictChip.label}</Text>
                </View>
              ) : null}
            </View>
            <Text numberOfLines={1} style={styles.problem}>{lesson.title}</Text>
          </View>
          <View collapsable={false} style={styles.problemActionPill}>
            <Text style={styles.problemAction}>Enunț</Text>
            <MiniGlyph name="next" size={11} color={colors.paper} />
          </View>
        </PressableScale>

        <GestureDetector gesture={swipeGesture}>
          <Animated.View
            collapsable={false}
            style={[
              styles.cardWrap,
              { transform: [{ translateX: cardShiftX }] },
            ]}
          >
            <View collapsable={false} style={styles.cardFace}>
              <View style={[styles.cardRibbon, { backgroundColor: ribbonColors[tone] }]}>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.cardRibbonSweep, ribbonSweepStyle]}
                />
              </View>

              <View collapsable={false} style={[styles.cardMetaBar, { backgroundColor: ribbonSoftBg[tone] }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Deschide harta pașilor: ${stepStamp}`}
                  hitSlop={6}
                  onPress={openRoadmap}
                  style={({ pressed }) => [styles.stepStampPill, pressed && styles.quickResultPillPressed]}
                >
                  <View collapsable={false} style={styles.stepStampInner}>
                    <View style={[styles.stepStampDot, { backgroundColor: ribbonColors[tone] }]} />
                    <Text style={styles.stepStampText}>{stepStamp}</Text>
                    <Text style={styles.stepStampCaret}>▾</Text>
                  </View>
                </Pressable>

                <View style={styles.cardMetaRight}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Mărime text ${mathReadingScaleBadge(readingScale)}. Apasă pentru a mări sau reseta`}
                    hitSlop={6}
                    onPress={cycleReadingScale}
                    style={({ pressed }) => [
                      styles.scalePill,
                      readingScale > 1 && styles.scalePillActive,
                      pressed && styles.quickResultPillPressed,
                    ]}
                  >
                    <View collapsable={false} style={styles.pillInner}>
                      <Text style={[styles.scalePillText, readingScale > 1 && styles.scalePillTextActive]}>
                        {mathReadingScaleBadge(readingScale)}
                      </Text>
                    </View>
                  </Pressable>

                  {isFromNotebook && !isLastStep ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Sari direct la rezultatul final"
                      hitSlop={6}
                      onPress={jumpToResult}
                      style={({ pressed }) => [styles.quickResultPill, pressed && styles.quickResultPillPressed]}
                    >
                      <View collapsable={false} style={styles.pillRow}>
                        <Text style={styles.quickResultStar}>★</Text>
                        <Text style={styles.quickResultText}>Rezultat</Text>
                      </View>
                    </Pressable>
                  ) : (
                    <View collapsable={false} style={[styles.cardCuePill, isLastStep && styles.cardCuePillFinal]}>
                      {isLastStep ? (
                        <View collapsable={false} style={styles.pillRowCompact}>
                          <Text style={styles.quickResultStar}>★</Text>
                          <Text style={[styles.cardCueText, styles.cardCueTextFinal]}>Final</Text>
                        </View>
                      ) : (
                        <Text style={styles.cardCueText}>
                          {lesson.steps.length > 1 ? '← Glisează →' : 'Explicație'}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.documentFrame}>
                {mountMathDocument ? (
                  <MathDocumentView definition={lessonDocument}
                    transitionDirection={stepState.direction}
                    readingScale={readingScale}
                    animateInitialReveal={screenFocused}
                    testID="lesson-math-document"
                    onReady={() => markLessonPresentationReady(route.params.lessonId)}
                  />
                ) : null}
              </View>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={[styles.actionDock, { paddingHorizontal: gutter, paddingBottom: bottomSpace }]}>
        <View style={styles.secondaryRow}>
          {step > 0 ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Pasul anterior"
              pressedScale={0.94}
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
            pressedScale={0.97}
            haptic="selection"
            onPress={openAlternate}
            style={styles.secondaryActionWrap}
            contentStyle={styles.secondaryAction}
          >
            <View style={styles.hintIconBadge}>
              <AppIcon name="hint" size={20} />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.secondaryTitle}>
              Explică-mi altfel
            </Text>
            {!isNarrow ? (
              <View collapsable={false} style={styles.secondaryTag}>
                <Text style={styles.secondaryTagText}>Mai simplu</Text>
              </View>
            ) : (
              <MiniGlyph name="next" size={14} color={colors.violetDeep} />
            )}
          </PressableScale>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Raportează o problemă în explicație"
            pressedScale={0.94}
            haptic="selection"
            onPress={openFeedback}
            contentStyle={styles.reportAction}
          >
            <MiniGlyph name="wrong" size={16} color={colors.inkSoft} />
          </PressableScale>
        </View>

        <ComicButton
          compact
          title={nextTitle}
          subtitle={nextSubtitle}
          icon={isLastStep ? 'trophy' : undefined}
          trailingIcon={isLastStep ? 'check' : 'next'}
          tone={isLastStep ? 'gold' : 'lime'}
          onPress={next}
        />
      </View>

      {alternate ? (
        <LessonAlternateModal
          stepNumber={step + 1}
          alternative={current.alternative}
          readingScale={readingScale}
          bottomSpace={bottomSpace}
          reducedMotion={reducedMotion}
          onClosed={() => setAlternate(false)}
        />
      ) : null}

      {problemOpen ? (
        <LessonProblemModal
          title={lesson.title}
          topic={lesson.topic}
          isCheck={isCheck}
          stepCount={lesson.steps.length}
          problem={lesson.problem}
          problemAccessible={problemAccessible}
          readingScale={readingScale}
          sourceImage={sourceImage}
          bottomSpace={bottomSpace}
          reducedMotion={reducedMotion}
          onShare={shareLesson}
          onClosed={() => setProblemOpen(false)}
        />
      ) : null}

      {roadmapOpen ? (
        <LessonRoadmapModal
          lesson={lesson}
          currentStep={step}
          bottomSpace={bottomSpace}
          reducedMotion={reducedMotion}
          onSelectStep={jumpToStep}
          onOpenSummary={openSummary}
          onClosed={() => setRoadmapOpen(false)}
        />
      ) : null}

      {removeEverOpened ? (
        <RemoveFromNotebookModal
          visible={removeConfirmOpen}
          lessonTitle={lesson.title}
          description="Lecția va dispărea din Caietul tău. O poți salva din nou oricând cât ești aici."
          removing={removingFromNotebook}
          error={removeError}
          onConfirm={() => void confirmRemoveFromNotebook()}
          onCancel={() => {
            if (removingFromNotebook) return;
            setRemoveConfirmOpen(false);
          }}
          onAfterClose={handleRemoveModalClosed}
        />
      ) : null}

      {feedbackEverOpened ? (
        <FeedbackSheet visible={feedbackOpen} lessonId={route.params.lessonId} onClose={() => setFeedbackOpen(false)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },

  canopy: {
    width: '100%',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    paddingBottom: 12,
    position: 'relative',
    zIndex: 4,
  },
  canopyGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -85,
    right: -40,
    backgroundColor: 'rgba(216, 255, 62, 0.14)',
  },
  canopyOrbitArc: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    top: -120,
    left: -70,
  },
  canopyInner: {
    width: '100%',
    paddingTop: 5,
    gap: 8,
  },
  canopyRow: {
    minHeight: 48,
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
  canopyFavActive: {
    backgroundColor: '#FFE57A',
    borderColor: '#FFF3B8',
    borderBottomColor: '#D6A118',
  },
  canopyCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  canopyTitle: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.2,
    textShadowColor: 'rgba(18, 6, 62, 0.28)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
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

  progressBlock: { marginTop: 9, marginBottom: 8 },
  savedToast: {
    position: 'absolute',
    zIndex: 20,
    right: 18,
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1.3,
    borderBottomWidth: 3,
    borderColor: '#ECFF8A',
    borderBottomColor: '#8BB509',
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    elevation: 5,
  },
  removedToast: {
    backgroundColor: colors.peachSoft,
    borderColor: '#FFD1BE',
    borderBottomColor: '#E5A68E',
  },
  savedText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12.5 },
  stage: { flex: 1, minHeight: 0, gap: 9, paddingBottom: 2 },

  // Pure-white 3D porcelain statement header bar
  problemWrap: {},
  problemRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 20,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 7,
    overflow: 'hidden',
  },
  problemIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  problemIconCheck: {
    backgroundColor: colors.gold,
  },
  problemIconText: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 14.5,
    lineHeight: 18,
    includeFontPadding: false,
  },
  problemCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  problemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  problemTopic: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
  verdictMicroChip: {
    flexShrink: 0,
    minHeight: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verdictMicroText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    lineHeight: 13,
    paddingHorizontal: 1,
    includeFontPadding: false,
  },
  problem: {
    fontFamily: fonts.displaySemi,
    color: colors.ink,
    fontSize: 13.5,
    lineHeight: 17,
    includeFontPadding: false,
  },
  problemActionPill: {
    flexShrink: 0,
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.violet,
  },
  problemAction: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
  },

  // Pure floating paper canvas
  cardWrap: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  cardFace: {
    flex: 1,
    minHeight: 0,
    borderRadius: 26,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFDF9',
    overflow: 'hidden',
  },
  cardRibbon: {
    height: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  cardRibbonSweep: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    left: 0,
    width: 72,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  cardMetaBar: {
    minHeight: 38,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124, 60, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardMetaRight: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillInner: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  scalePill: {
    flexShrink: 0,
    minWidth: 36,
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.12)',
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scalePillActive: {
    backgroundColor: colors.violetSoft,
    borderColor: '#C9B2FA',
  },
  scalePillText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 11,
    lineHeight: 15,
    paddingHorizontal: 1,
    includeFontPadding: false,
  },
  scalePillTextActive: {
    color: colors.violetDeep,
  },
  stepStampPill: {
    flexShrink: 1,
    minHeight: 28,
    borderRadius: 999,
    backgroundColor: colors.paper,
    justifyContent: 'center',
  },
  stepStampInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepStampDot: {
    flexShrink: 0,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  stepStampText: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 10.5,
    lineHeight: 15,
    letterSpacing: 0.3,
    paddingHorizontal: 1,
    includeFontPadding: false,
  },
  stepStampCaret: {
    fontFamily: fonts.bodyBold,
    color: colors.inkSoft,
    fontSize: 10.5,
    lineHeight: 15,
    includeFontPadding: false,
  },
  quickResultPill: {
    flexShrink: 0,
    minHeight: 28,
    borderRadius: 999,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickResultPillPressed: {
    transform: [{ scale: 0.96 }],
  },
  quickResultStar: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 11.5,
    lineHeight: 15,
    includeFontPadding: false,
  },
  quickResultText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 11,
    lineHeight: 15,
    paddingHorizontal: 1,
    includeFontPadding: false,
  },
  cardCuePill: {
    flexShrink: 0,
    minHeight: 28,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCuePillFinal: {
    backgroundColor: colors.lime,
  },
  cardCueText: {
    fontFamily: fonts.bodyBold,
    color: colors.inkSoft,
    fontSize: 10.5,
    lineHeight: 15,
    paddingHorizontal: 1,
    includeFontPadding: false,
  },
  cardCueTextFinal: {
    color: colors.ink,
  },
  documentFrame: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: '#FFFDF9' },

  // Action dock
  actionDock: { backgroundColor: colors.canvas, paddingTop: 7, gap: 7 },
  secondaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prevStepAction: {
    width: 46,
    height: 46,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionWrap: { flex: 1 },
  secondaryAction: {
    height: 46,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#DFD2FA',
    borderBottomColor: '#C2ADF4',
    backgroundColor: '#F6F1FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    overflow: 'hidden',
  },
  hintIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryTitle: { flex: 1, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12.5 },
  secondaryTag: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.paper,
  },
  secondaryTagText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 10,
    lineHeight: 13,
    includeFontPadding: false,
  },
  reportAction: {
    width: 46,
    height: 46,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bottom sheets
  modalLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 30, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(20, 15, 46, 0.48)' },
  sheet: {
    width: '100%',
    maxWidth: 640,
    height: '82%',
    alignSelf: 'center',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1.25,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.borderHairline,
    backgroundColor: colors.canvas,
    paddingHorizontal: 16,
    paddingTop: 12,
    elevation: 18,
  },
  problemSheet: {
    width: '100%',
    maxWidth: 640,
    height: '86%',
    alignSelf: 'center',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1.25,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.borderHairline,
    backgroundColor: colors.canvas,
    paddingHorizontal: 16,
    paddingTop: 12,
    elevation: 18,
  },
  sheetHandle: { width: 40, height: 4.5, borderRadius: 999, backgroundColor: '#DBD1F0', alignSelf: 'center', marginBottom: 12 },
  sheetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 12,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1.25,
    borderColor: colors.borderHairline,
    backgroundColor: colors.paper,
    elevation: 2,
  },
  sheetMascotBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.cyanSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  problemSheetIcon: { backgroundColor: colors.limeSoft },
  sheetCopy: { flex: 1, minWidth: 0, gap: 3 },
  sheetTagRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  sheetLimeStamp: {
    paddingHorizontal: 9,
    paddingVertical: 2.5,
    borderRadius: 999,
    backgroundColor: colors.lime,
  },
  sheetLimeStampText: {
    ...typography.kicker,
    fontSize: 9.5,
    color: colors.ink,
    includeFontPadding: false,
  },
  sheetModePill: {
    paddingHorizontal: 9,
    paddingVertical: 2.5,
    borderRadius: 999,
    backgroundColor: colors.cyanSoft,
  },
  sheetModePillCheck: {
    backgroundColor: colors.peachSoft,
  },
  sheetModePillText: {
    ...typography.kicker,
    fontSize: 9.5,
    color: colors.ink,
    includeFontPadding: false,
  },
  sheetTopicPill: {
    flexShrink: 1,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 999,
    backgroundColor: colors.violetSoft,
  },
  sheetTopicPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 13,
    color: colors.violetDeep,
    includeFontPadding: false,
  },
  sheetTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 17.5, lineHeight: 21 },
  sheetPaper: {
    flex: 1,
    minHeight: 0,
    borderRadius: 22,
    borderWidth: 1.25,
    borderColor: colors.borderHairline,
    backgroundColor: '#FFFDF9',
    overflow: 'hidden',
    marginBottom: 10,
    paddingHorizontal: 6,
    elevation: 2,
  },
  sheetDocument: { flex: 1 },
  problemTabs: { marginBottom: 10 },
  problemContent: {
    flex: 1,
    minHeight: 0,
    borderRadius: 22,
    borderWidth: 1.25,
    borderColor: colors.borderHairline,
    overflow: 'hidden',
    backgroundColor: '#FFFDF9',
    position: 'relative',
    paddingHorizontal: 6,
    elevation: 2,
  },
  problemPane: { flex: 1 },
  problemPaneOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, padding: 8 },
  problemSheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  sheetShareButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1.25,
    borderColor: '#DDD0F9',
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  sheetShareText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 13,
    lineHeight: 16,
    includeFontPadding: false,
  },
  sheetDoneButton: {
    flex: 1.2,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    elevation: 2,
  },
  sheetDoneText: {
    fontFamily: fonts.displaySemi,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 17,
    includeFontPadding: false,
  },
  sourceImageCard: { flex: 1, padding: 8, borderRadius: 18, borderWidth: 1.25, borderColor: colors.borderHairline, backgroundColor: '#F6F0FF' },
  sourceImage: { width: '100%', height: '100%', borderRadius: 12 },
});
