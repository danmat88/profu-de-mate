import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
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
import { useAfterKeyboardDismiss } from '../../../shared/hooks/useAfterKeyboardDismiss';
import { useKeyboardHeight } from '../../../shared/hooks/useKeyboardHeight';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { useTransitionSettled } from '../../../shared/hooks/useTransitionSettled';
import { SILKY_EASE_OUT } from '../../../shared/motion/nativeMotion';
import { RoyalHeroCanopyBackdrop } from '../../../shared/ui/RoyalHeroCanopyBackdrop';
import { initializeVerifiedFirebaseServices } from '../../../shared/services/firebase';
import * as Haptics from '../../../shared/services/haptics';
import {
  getMathReadingScale,
  mathReadingScaleBadge,
  nextMathReadingScale,
  setMathReadingScale,
  type MathReadingScale,
} from '../../../shared/storage/localPreferences';
import { colors, fonts, radii } from '../../../shared/theme';
import type {
  PracticeSummaryAnswerItem,
  RootStackParamList,
} from '../../../shared/types';
import { AiBlockingOverlay } from '../../../shared/ui/AiBlockingOverlay';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicBottomSheet } from '../../../shared/ui/ComicBottomSheet';
import { LiquidProgressBar } from '../../../shared/ui/LiquidProgressBar';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { StepTransitionStage } from '../../../shared/ui/StepTransitionStage';
import { Text, TextInput } from '../../../shared/ui/Typography';
import { useCommercial } from '../../access/context/CommercialContext';
import { commercialGateFromError, isTemporaryCommercialLimit } from '../../access/services/commercial';
import { createAnalysisRequestId } from '../../analysis/services/mathAnalysis';
import { NativeMathFormula } from '../../math/components/NativeMathFormula';
import { StudyInlineText } from '../../study/components/StudyInlineText';
import { LiveRichContentView, StudyBlocksView } from '../../study/components/StudyRichContent';
import { getStudyProfile } from '../../study/services/studyStorage';
import { getFormulaCategoryMeta } from '../../study/types';
import { prewarmStudyMath } from '../../study/utils/prewarmStudyMath';
import { getFormulaById } from '../../study/utils/studyDocumentBuilder';
import { PRACTICE_BANK } from '../data/practiceBank';
import {
  aiPayloadToPracticeQuestion,
  friendlyAiPracticeError,
  generateAiPracticeExercise,
} from '../services/aiPractice';
import {
  getPracticeState,
  recordCompletedPracticeSession,
  recordPracticeAnswer,
  usePracticeState,
} from '../services/practiceStorage';
import type { PracticeDifficulty, PracticeQuestion } from '../types';
import {
  evaluatePracticeAnswer,
  getPracticeQuestionById,
  selectPracticeQuestions,
  shuffleQuestionChoices,
} from '../utils/practiceEngine';

type Props = NativeStackScreenProps<RootStackParamList, 'PracticeSession'>;

const CHOICE_LETTERS = ['A', 'B', 'C', 'D'] as const;
const QUICK_MATH_SYMBOLS = ['−', ',', '/', '√', 'π'] as const;
const DIFFICULTY_META: Record<PracticeDifficulty, { label: string; bg: string; fg: string }> = {
  easy: { label: 'Ușor', bg: colors.limeSoft, fg: colors.limeDeep },
  medium: { label: 'Mediu', bg: colors.cyanSoft, fg: colors.cyanDeep },
  exam: { label: 'Nivel examen', bg: colors.peachSoft, fg: colors.peachDeep },
};

const SIMILAR_AI_STAGES: readonly string[] = [
  'Compunem un exercițiu nou pe aceeași temă...',
  'Construim cele 4 variante, indiciul și pașii...',
  'Verificăm calculele — nu închide ecranul...',
];

const LESSON_AI_STAGES: readonly string[] = [
  'Pregătim lecția completă pas cu pas...',
  'Deschidem explicația detaliată cu Profu’ AI...',
];

function formatTimer(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function extractSeedProblemText(question: PracticeQuestion): string {
  if (question.prompt.length > 0) {
    const joined = question.prompt
      .map((block) => (
        block.type === 'text' || block.type === 'subpoint' || block.type === 'step'
          ? block.text
          : block.type === 'math'
            ? block.spoken
            : ''
      ))
      .join(' ')
      .trim();
    if (joined) return joined;
  }
  if (question.renderedPrompt && question.renderedPrompt.length > 0) {
    const joined = question.renderedPrompt
      .map((block) => (block.type === 'text' ? block.text : block.type === 'math' ? block.spoken : ''))
      .join(' ')
      .trim();
    if (joined) return joined;
  }
  return question.title;
}

/**
 * Pure native 60fps interactive practice screen. Paints questions, MathJax SVG
 * choices, hints, feedback, and step-by-step explanations synchronously on
 * Frame 0 with zero WebView boot lag, full keyboard ergonomics, and airtight
 * interaction locks during AI operations.
 */
export function PracticeSessionScreen({ navigation, route }: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, contentWidth, isNarrow } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const transitionSettled = useTransitionSettled(navigation, reducedMotion);
  const { keyboardInset, keyboardVisible } = useKeyboardHeight();
  const { runAfterKeyboardDismiss, cancelPending: cancelPendingKeyboardAction } = useAfterKeyboardDismiss(keyboardVisible);
  const { access, refresh: refreshAccess, applyServerAccess } = useCommercial();
  const practiceState = usePracticeState();
  const { mode, category, formulaId, questionId, aiExercise } = route.params;
  const isTargetedMistake = mode === 'mistakes' && Boolean(questionId);

  const [sessionTrack] = useState(() => getStudyProfile().track);
  const [questions, setQuestions] = useState<PracticeQuestion[]>(() => {
    if (aiExercise) {
      return [shuffleQuestionChoices(aiPayloadToPracticeQuestion(aiExercise, getStudyProfile().track), Date.now())];
    }
    const currentProfile = getStudyProfile();
    const state = getPracticeState();
    return selectPracticeQuestions(PRACTICE_BANK, {
      mode,
      track: currentProfile.hasChosenTrack ? currentProfile.track : null,
      category,
      formulaId,
      questionId,
      wrongIds: state.wrongQuestionIds,
      masteredIds: state.masteredQuestionIds,
      limit: mode === 'mistakes' ? Math.max(20, state.wrongQuestionIds.length) : 5,
      seed: Date.now(),
    });
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [stepTransition, setStepTransition] = useState<{ direction: -1 | 0 | 1; animate: boolean }>({
    direction: 0,
    animate: false,
  });
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [shortInput, setShortInput] = useState('');
  const [submittingShort, setSubmittingShort] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [answers, setAnswers] = useState<PracticeSummaryAnswerItem[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [readingScale, setReadingScale] = useState<MathReadingScale>(() => getMathReadingScale());
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [explanationEverOpened, setExplanationEverOpened] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [similarBusy, setSimilarBusy] = useState(false);
  const [similarError, setSimilarError] = useState<string | null>(null);
  const [explainAiBusy, setExplainAiBusy] = useState(false);
  const [appBackgrounded, setAppBackgrounded] = useState(false);

  const aiBusy = similarBusy || explainAiBusy;

  const mountedRef = useRef(true);
  const aiLockRef = useRef(false);
  const submittingShortRef = useRef(false);
  const feedbackScrolledRef = useRef(false);
  const leavingAllowedRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const feedbackReveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const currentQuestion = questions[currentIndex];

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useFocusEffect(useCallback(() => {
    leavingAllowedRef.current = false;
  }, []));

  // Reset scroll synchronously right as the newly keyed question mounts.
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [currentIndex]);

  // Smooth pure native-driver entrance for the post-answer verdict block.
  useEffect(() => {
    feedbackReveal.stopAnimation();
    if (!submitted) {
      feedbackScrolledRef.current = false;
      feedbackReveal.setValue(reducedMotion ? 1 : 0);
      return undefined;
    }
    if (reducedMotion) {
      feedbackReveal.setValue(1);
      return undefined;
    }
    feedbackReveal.setValue(0);
    const anim = Animated.timing(feedbackReveal, {
      toValue: 1,
      duration: 240,
      easing: SILKY_EASE_OUT,
      useNativeDriver: true,
    });
    anim.start();
    return () => {
      anim.stop();
      feedbackReveal.stopAnimation();
    };
  }, [feedbackReveal, reducedMotion, submitted]);

  const feedbackRevealStyle = useMemo(() => ({
    opacity: feedbackReveal,
    transform: [
      {
        translateY: feedbackReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  }), [feedbackReveal]);

  // Silently pre-parse current answer/hint + next question SVG ASTs so verdict
  // reveal and question stepping paint in 0ms with zero JS jank.
  useEffect(() => {
    const upcoming = questions[currentIndex + 1];
    const current = questions[currentIndex];
    if (!current && !upcoming) return undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      if (current) {
        prewarmStudyMath({
          inlineTexts: [current.hint, current.answerDisplay],
          blocks: current.explanation,
          liveContent: current.renderedExplanation,
        });
      }
      if (upcoming) {
        prewarmStudyMath({
          blocks: upcoming.prompt,
          liveContent: upcoming.renderedPrompt,
          inlineTexts: [
            upcoming.hint,
            upcoming.answerDisplay,
            ...(upcoming.choices?.map((choice) => choice.label) ?? []),
          ],
        });
      }
    });
    return () => task.cancel();
  }, [currentIndex, questions]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      setAppBackgrounded(nextState !== 'active');
    });
    return () => sub.remove();
  }, []);

  // Pause session clock cleanly while an AI request is running or app is backgrounded.
  const clockPaused = aiBusy || appBackgrounded;
  useEffect(() => {
    if (clockPaused) {
      if (pausedAtRef.current === null) pausedAtRef.current = Date.now();
    } else if (pausedAtRef.current !== null && startedAtRef.current !== null) {
      startedAtRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
  }, [clockPaused]);

  useEffect(() => {
    if (!currentQuestion) return undefined;
    if (startedAtRef.current === null) {
      startedAtRef.current = Date.now();
    }
    const timer = setInterval(() => {
      if (startedAtRef.current !== null && pausedAtRef.current === null) {
        setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [currentQuestion]);

  // Block gestures and navigation completely while Profu AI is generating/opening a lesson.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !aiBusy && (answers.length === 0 || isTargetedMistake) });
  }, [aiBusy, answers.length, isTargetedMistake, navigation]);

  useEffect(() => {
    if (!aiBusy) return undefined;
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
  }, [aiBusy, navigation]);

  // Guard hardware Back when user already answered at least 1 question in a multi-question session.
  useEffect(() => {
    if (aiBusy || answers.length === 0 || isTargetedMistake || explanationOpen || exitConfirmOpen) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Keyboard.dismiss();
      Haptics.selection();
      setExitConfirmOpen(true);
      return true;
    });
    return () => sub.remove();
  }, [aiBusy, answers.length, exitConfirmOpen, explanationOpen, isTargetedMistake]);

  // Auto-scroll smoothly into short-answer input when the soft keyboard opens.
  useEffect(() => {
    if (!keyboardVisible || !currentQuestion || currentQuestion.kind !== 'short_answer' || submitted || submittingShort) {
      return undefined;
    }
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 90);
    return () => clearTimeout(timer);
  }, [currentQuestion, keyboardVisible, submitted, submittingShort]);

  const linkedFormula = useMemo(
    () => (currentQuestion?.formulaId ? getFormulaById(currentQuestion.formulaId) : undefined),
    [currentQuestion],
  );

  const correctSoFar = useMemo(
    () => answers.filter((item) => item.correct).length,
    [answers],
  );

  const cycleScale = useCallback(() => {
    if (aiBusy) return;
    Keyboard.dismiss();
    Haptics.selection();
    setReadingScale((current) => {
      const next = nextMathReadingScale(current);
      setMathReadingScale(next);
      return next;
    });
  }, [aiBusy]);

  const remainingOtherMistakeIds = useMemo(
    () => practiceState.wrongQuestionIds.filter((id) => id !== currentQuestion?.id),
    [currentQuestion?.id, practiceState.wrongQuestionIds],
  );

  const leaveToPrevious = useCallback(() => {
    if (aiBusy) return;
    cancelPendingKeyboardAction();
    Keyboard.dismiss();
    Haptics.selection();
    leavingAllowedRef.current = true;
    beginAppTransition();
    navigation.goBack();
  }, [aiBusy, cancelPendingKeyboardAction, navigation]);

  const requestCloseSession = useCallback(() => {
    if (aiBusy) return;
    Haptics.selection();
    if (answers.length > 0 && !isTargetedMistake) {
      runAfterKeyboardDismiss(() => {
        if (mountedRef.current) setExitConfirmOpen(true);
      });
      return;
    }
    Keyboard.dismiss();
    leavingAllowedRef.current = true;
    beginAppTransition();
    navigation.goBack();
  }, [aiBusy, answers.length, isTargetedMistake, navigation, runAfterKeyboardDismiss]);

  const commitQuestionAnswer = useCallback((
    question: PracticeQuestion,
    correct: boolean,
    userAnswerLabel: string,
  ) => {
    if (!mountedRef.current) return;
    submittingShortRef.current = false;
    setSubmittingShort(false);
    setSubmitted(true);
    setLastCorrect(correct);
    Haptics.notification(
      correct
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    );
    setAnswers((prev) => [
      ...prev,
      {
        questionId: question.id,
        title: question.title,
        category: question.category,
        formulaId: question.formulaId,
        correct,
        userAnswerLabel,
        correctAnswerLabel: question.answerDisplay,
      },
    ]);
    InteractionManager.runAfterInteractions(() => {
      recordPracticeAnswer(question.id, correct, !question.aiGenerated);
    });
  }, []);

  const handleSelectChoice = useCallback((index: number) => {
    if (!currentQuestion || submitted || submittingShortRef.current || aiBusy || currentQuestion.kind !== 'choice' || !currentQuestion.choices) return;
    setSelectedChoice(index);
    const correct = evaluatePracticeAnswer(currentQuestion, { choiceIndex: index });
    const label = currentQuestion.choices[index]?.label ?? CHOICE_LETTERS[index];
    runAfterKeyboardDismiss(() => commitQuestionAnswer(currentQuestion, correct, label));
  }, [aiBusy, commitQuestionAnswer, currentQuestion, runAfterKeyboardDismiss, submitted]);

  const handleSubmitShortAnswer = useCallback(() => {
    if (!currentQuestion || submitted || submittingShortRef.current || aiBusy || currentQuestion.kind !== 'short_answer') return;
    const trimmed = shortInput.trim();
    if (!trimmed) return;
    const question = currentQuestion;
    const correct = evaluatePracticeAnswer(question, { text: trimmed });
    if (keyboardVisible) {
      // Lock cleanly and let Android IME finish closing BEFORE revealing the verdict
      // so keyboardInset collapse, dock unmount, and feedback entrance never collide.
      submittingShortRef.current = true;
      setSubmittingShort(true);
      runAfterKeyboardDismiss(() => commitQuestionAnswer(question, correct, trimmed));
      return;
    }
    commitQuestionAnswer(question, correct, trimmed);
  }, [aiBusy, commitQuestionAnswer, currentQuestion, keyboardVisible, runAfterKeyboardDismiss, shortInput, submitted]);

  const advanceToIndex = useCallback((nextIdx: number) => {
    cancelPendingKeyboardAction();
    submittingShortRef.current = false;
    setSubmittingShort(false);
    Keyboard.dismiss();
    setStepTransition({ direction: nextIdx >= currentIndex ? 1 : -1, animate: true });
    setCurrentIndex(nextIdx);
    setSelectedChoice(null);
    setShortInput('');
    setSubmitted(false);
    setLastCorrect(false);
    setShowHint(false);
    setSimilarError(null);
  }, [cancelPendingKeyboardAction, currentIndex]);

  const handleRetryCurrentQuestion = useCallback(() => {
    if (!currentQuestion || aiBusy) return;
    cancelPendingKeyboardAction();
    submittingShortRef.current = false;
    setSubmittingShort(false);
    Keyboard.dismiss();
    Haptics.selection();
    const reshuffled = shuffleQuestionChoices(currentQuestion, Date.now());
    setQuestions((prev) => prev.map((q, idx) => (idx === currentIndex ? reshuffled : q)));
    setRetryCount((value) => value + 1);
    setStepTransition({ direction: 0, animate: true });
    setSelectedChoice(null);
    setShortInput('');
    setSubmitted(false);
    setLastCorrect(false);
    setShowHint(false);
    setSimilarError(null);
    scrollRef.current?.scrollTo({ y: 0, animated: !reducedMotion });
  }, [aiBusy, cancelPendingKeyboardAction, currentIndex, currentQuestion, reducedMotion]);

  const handleNextRemainingMistake = useCallback(() => {
    if (aiBusy) return;
    const nextMistakeId = remainingOtherMistakeIds[0];
    const nextQuestion = nextMistakeId ? getPracticeQuestionById(nextMistakeId) : undefined;
    if (!nextQuestion) {
      leaveToPrevious();
      return;
    }
    Haptics.selection();
    const shuffled = shuffleQuestionChoices(nextQuestion, Date.now());
    const nextIdx = questions.length;
    setQuestions((prev) => [...prev, shuffled]);
    advanceToIndex(nextIdx);
  }, [advanceToIndex, aiBusy, leaveToPrevious, questions.length, remainingOtherMistakeIds]);

  const handleNext = useCallback(() => {
    if (!submitted || aiBusy) return;
    Keyboard.dismiss();
    Haptics.selection();
    if (currentIndex + 1 < questions.length) {
      advanceToIndex(currentIndex + 1);
      return;
    }
    const totalElapsed = Math.max(1, Math.floor((Date.now() - (startedAtRef.current ?? Date.now())) / 1000));
    const correctCount = answers.filter((item) => item.correct).length;
    recordCompletedPracticeSession({
      id: `sess-${Date.now()}`,
      completedAt: new Date().toISOString(),
      mode,
      track: sessionTrack,
      category,
      correctCount,
      totalCount: answers.length,
      elapsedSeconds: totalElapsed,
    });
    leavingAllowedRef.current = true;
    beginAppTransition();
    navigation.replace('PracticeSummary', {
      mode,
      category,
      formulaId,
      correctCount,
      totalCount: answers.length,
      elapsedSeconds: totalElapsed,
      answers,
    });
  }, [advanceToIndex, aiBusy, answers, category, currentIndex, formulaId, mode, navigation, questions.length, sessionTrack, submitted]);

  const handleOpenExplanation = () => {
    if (aiBusy) return;
    Haptics.selection();
    runAfterKeyboardDismiss(() => {
      if (!mountedRef.current) return;
      setExplanationEverOpened(true);
      setExplanationOpen(true);
    });
  };

  const handleOpenFormula = useCallback(() => {
    if (!linkedFormula || aiBusy) return;
    Keyboard.dismiss();
    setExplanationOpen(false);
    beginAppTransition();
    navigation.navigate('FormulaDetail', { formulaId: linkedFormula.id });
  }, [aiBusy, linkedFormula, navigation]);

  const handleExplainWithAiLesson = async () => {
    if (!currentQuestion?.editorLatex || aiLockRef.current || aiBusy) return;
    Keyboard.dismiss();
    if (access && !access.canAnalyze) {
      beginAppTransition();
      navigation.navigate('Paywall', { source: 'quota', access });
      return;
    }
    aiLockRef.current = true;
    setExplainAiBusy(true);
    setSimilarError(null);
    try {
      const user = await initializeVerifiedFirebaseServices();
      if (!mountedRef.current) return;
      aiLockRef.current = false;
      setExplainAiBusy(false);
      beginAppTransition();
      navigation.navigate('MathProcessing', {
        mode: 'solve',
        math: { problemLatex: currentQuestion.editorLatex },
        requestId: createAnalysisRequestId(),
        userId: user.uid,
        origin: 'home',
      });
    } catch {
      if (!mountedRef.current) return;
      aiLockRef.current = false;
      setExplainAiBusy(false);
      setSimilarError('Nu putem porni lecția AI fără conexiune la internet.');
    }
  };

  const handleGenerateSimilar = async () => {
    if (!currentQuestion || aiLockRef.current || aiBusy) return;
    Keyboard.dismiss();
    if (access && !access.canAnalyze) {
      beginAppTransition();
      navigation.navigate('Paywall', { source: 'quota', access });
      return;
    }
    aiLockRef.current = true;
    setSimilarBusy(true);
    setSimilarError(null);
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    try {
      const seedText = extractSeedProblemText(currentQuestion);
      const generated = await generateAiPracticeExercise({
        track: sessionTrack,
        category: currentQuestion.category,
        difficulty: currentQuestion.difficulty,
        formulaTitle: linkedFormula?.title ?? currentQuestion.title,
        seedProblemText: seedText,
      });
      if (!mountedRef.current) return;
      void refreshAccess();
      const enriched = currentQuestion.formulaId && !generated.formulaId
        ? { ...generated, formulaId: currentQuestion.formulaId }
        : generated;
      const nextQuestion = shuffleQuestionChoices(
        aiPayloadToPracticeQuestion(enriched, sessionTrack),
        Date.now(),
      );
      const nextIdx = questions.length;
      setQuestions((prev) => [...prev, nextQuestion]);
      aiLockRef.current = false;
      setSimilarBusy(false);
      advanceToIndex(nextIdx);
    } catch (error) {
      if (!mountedRef.current) return;
      aiLockRef.current = false;
      setSimilarBusy(false);
      const gate = commercialGateFromError(error);
      if (gate) {
        if (gate.access) applyServerAccess(gate.access);
        if (isTemporaryCommercialLimit(gate.reason)) {
          setSimilarError(gate.message);
          Haptics.notification(Haptics.NotificationFeedbackType.Warning);
          return;
        }
        const gateAccess = gate.access ?? access;
        beginAppTransition();
        navigation.navigate('Paywall', { source: 'quota', ...(gateAccess ? { access: gateAccess } : {}) });
        return;
      }
      setSimilarError(friendlyAiPracticeError(error));
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    }
  };

  if (!currentQuestion) {
    return (
      <View style={[styles.safe, styles.emptyWrap, { paddingTop: insets.top ?? 0 }]}>
        <StatusBar style="dark" />
        <ComicBackdrop />
        <Mascot pose="cheer" size={118} active />
        <Text style={styles.emptyTitle}>Nu ai nicio greșeală rămasă!</Text>
        <Text style={styles.emptySubtitle}>
          Ai rezolvat toate întrebările din lista De repetat. Poți începe oricând un test fulger nou.
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Înapoi"
          pressedScale={0.97}
          haptic="selection"
          onPress={() => {
            beginAppTransition();
            navigation.goBack();
          }}
          contentStyle={styles.emptyBackBtn}
        >
          <Text style={styles.emptyBackText}>
            {mode === 'mistakes' ? 'Înapoi la Caiet' : 'Înapoi la Teste'}
          </Text>
        </PressableScale>
      </View>
    );
  }

  const categoryMeta = getFormulaCategoryMeta(currentQuestion.category);
  const diffMeta = DIFFICULTY_META[currentQuestion.difficulty];
  const progressValue = isTargetedMistake
    ? submitted
      ? (lastCorrect ? 1 : 0.48)
      : 0.18
    : (currentIndex + (submitted ? 1 : 0)) / Math.max(1, questions.length);
  const isLast = currentIndex + 1 >= questions.length;
  const showTargetedPostFlow = isTargetedMistake && isLast;
  const innerMathWidth = Math.max(220, Math.min(contentWidth, frame.width - gutter * 2) - 32);
  const showShortKeyboardDock = currentQuestion.kind === 'short_answer' && !submitted && keyboardVisible;
  const scrollBottomPadding = keyboardVisible ? 18 : Math.max(insets.bottom, 14) + 20;

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      <ComicBackdrop />

      {/* Compact curved Royal-Violet Session Canopy */}
      <Pressable
        accessible={false}
        onPress={Keyboard.dismiss}
        style={[styles.canopy, { paddingTop: insets.top ?? 0 }]}
      >
        <LinearGradient
          colors={['#7A38FF', '#581EE0', '#380E9F']}
          start={{ x: 0.06, y: 0 }}
          end={{ x: 0.94, y: 1 }}
          style={styles.fill}
        />
        <RoyalHeroCanopyBackdrop showGradient={false} />

        <View style={[styles.topBar, { paddingHorizontal: gutter }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Închide testul"
            disabled={aiBusy}
            hitSlop={8}
            onPress={requestCloseSession}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <MiniGlyph name="close" size={16} color={colors.violetDeep} />
          </Pressable>

          <View style={styles.progressWrap}>
            <LiquidProgressBar
              progress={Math.max(0.06, progressValue)}
              height={9}
              tone="dark"
              shimmer={!reducedMotion && !aiBusy && transitionSettled}
              active={transitionSettled && !aiBusy}
            />
          </View>

          <View style={styles.metaPills}>
            <View style={styles.countPill}>
              <Text maxFontSizeMultiplier={1.15} style={styles.countText}>
                {isTargetedMistake ? 'De repetat' : `${currentIndex + 1}/${questions.length}`}
              </Text>
            </View>
            {answers.length > 0 && !isNarrow ? (
              <View style={styles.scorePill}>
                <Text maxFontSizeMultiplier={1.15} style={styles.scoreText}>
                  ✓ {correctSoFar}
                </Text>
              </View>
            ) : null}
            <View style={styles.timerPill}>
              <Text maxFontSizeMultiplier={1.15} style={styles.timerText}>
                {formatTimer(elapsedSeconds)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mărime text: ${mathReadingScaleBadge(readingScale)}`}
              disabled={aiBusy}
              hitSlop={6}
              onPress={cycleScale}
              style={({ pressed }) => [styles.scalePill, pressed && styles.pressed]}
            >
              <Text maxFontSizeMultiplier={1.15} style={styles.scalePillText}>
                {mathReadingScaleBadge(readingScale)}
              </Text>
            </Pressable>
          </View>
        </View>
      </Pressable>

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
            key={currentQuestion.id}
            direction={stepTransition.direction}
            animate={stepTransition.animate}
            style={[styles.stageWrap, { maxWidth: contentWidth }]}
          >
            <Pressable
              accessible={false}
              onPress={Keyboard.dismiss}
              style={styles.promptCard}
            >
              <View style={styles.promptHeaderRow}>
                <View style={styles.promptMetaLeft}>
                  <View style={[styles.catDot, { backgroundColor: categoryMeta.accent }]} />
                  <Text numberOfLines={1} style={styles.promptEyebrow}>
                    {currentQuestion.aiGenerated ? 'EXERCIȚIU PROFU’ AI' : categoryMeta.shortLabel.toUpperCase()}
                  </Text>
                </View>
                <View style={[styles.diffPill, { backgroundColor: diffMeta.bg }]}>
                  <Text numberOfLines={1} style={[styles.diffPillText, { color: diffMeta.fg }]}>
                    {diffMeta.label}
                  </Text>
                </View>
              </View>

              <Text style={styles.promptTitle}>{currentQuestion.title}</Text>

              {currentQuestion.renderedPrompt ? (
                <LiveRichContentView
                  content={currentQuestion.renderedPrompt}
                  scale={readingScale}
                  maxWidth={innerMathWidth}
                />
              ) : (
                <StudyBlocksView
                  blocks={currentQuestion.prompt}
                  scale={readingScale}
                  maxWidth={innerMathWidth}
                />
              )}
            </Pressable>

            {!submitted ? (
              showHint ? (
                <Pressable
                  accessible={false}
                  onPress={Keyboard.dismiss}
                  style={styles.hintCard}
                >
                  <Text style={styles.hintLabel}>✦ INDICIU</Text>
                  {currentQuestion.renderedHint && currentQuestion.renderedHint.length > 0 ? (
                    <LiveRichContentView
                      content={currentQuestion.renderedHint}
                      scale={readingScale * 0.94}
                      maxWidth={innerMathWidth - 12}
                    />
                  ) : (
                    <StudyInlineText
                      text={currentQuestion.hint}
                      scale={readingScale * 0.94}
                      maxMathWidth={innerMathWidth - 12}
                      textStyle={styles.hintText}
                    />
                  )}
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Arată un indiciu"
                  disabled={aiBusy}
                  onPress={() => {
                    Keyboard.dismiss();
                    Haptics.selection();
                    setShowHint(true);
                  }}
                  style={({ pressed }) => [styles.hintButton, pressed && styles.pressed]}
                >
                  <AppIcon name="hint" size={18} />
                  <Text style={styles.hintButtonText}>Ai nevoie de un indiciu?</Text>
                </Pressable>
              )
            ) : null}

          {currentQuestion.kind === 'choice' && currentQuestion.choices ? (
            <View style={styles.choicesStack}>
              {currentQuestion.choices.map((choice, idx) => {
                const isSelected = selectedChoice === idx;
                const isCorrectChoice = idx === currentQuestion.correctIndex;
                const showAsCorrect = submitted && isCorrectChoice;
                const showAsWrong = submitted && isSelected && !isCorrectChoice;
                const dimmed = submitted && !showAsCorrect && !showAsWrong;

                return (
                  <Pressable
                    key={`${currentQuestion.id}-r${retryCount}-opt-${idx}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected, disabled: submitted || aiBusy }}
                    disabled={submitted || aiBusy}
                    onPress={() => handleSelectChoice(idx)}
                    style={({ pressed }) => [
                      styles.choiceCard,
                      showAsCorrect && styles.choiceCardCorrect,
                      showAsWrong && styles.choiceCardWrong,
                      dimmed && styles.choiceCardDimmed,
                      pressed && !submitted && styles.choiceCardPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.choiceBadge,
                        showAsCorrect && styles.choiceBadgeCorrect,
                        showAsWrong && styles.choiceBadgeWrong,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceBadgeText,
                          showAsCorrect && styles.choiceBadgeTextCorrect,
                          showAsWrong && styles.choiceBadgeTextWrong,
                        ]}
                      >
                        {showAsCorrect ? '✓' : showAsWrong ? '×' : CHOICE_LETTERS[idx]}
                      </Text>
                    </View>
                    <View style={styles.choiceBody}>
                      {choice.rendered ? (
                        <NativeMathFormula
                          rendered={choice.rendered}
                          size="choice"
                          scale={readingScale}
                          maxWidth={innerMathWidth - 58}
                          align="left"
                          accessibilityLabel={choice.label}
                        />
                      ) : (
                        <StudyInlineText
                          text={choice.label}
                          scale={readingScale}
                          mathSize="choice"
                          maxMathWidth={innerMathWidth - 58}
                          textStyle={styles.choiceLabel}
                        />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.shortAnswerBox}>
              <View
                style={[
                  styles.inputWrap,
                  submitted && (lastCorrect ? styles.inputCorrect : styles.inputWrong),
                ]}
              >
                <TextInput
                  editable={!submitted && !aiBusy}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="done"
                  value={shortInput}
                  onChangeText={setShortInput}
                  onSubmitEditing={handleSubmitShortAnswer}
                  placeholder={currentQuestion.inputHint ?? 'Scrie răspunsul tău'}
                  placeholderTextColor={colors.inkMuted}
                  selectionColor={colors.violet}
                  style={styles.shortInput}
                />
                {shortInput && !submitted && !submittingShort ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Șterge răspunsul"
                    hitSlop={8}
                    onPress={() => setShortInput('')}
                    style={styles.clearInputBtn}
                  >
                    <MiniGlyph name="close" size={14} color={colors.ink} />
                  </Pressable>
                ) : null}
              </View>

              {!submitted && !submittingShort && !showShortKeyboardDock ? (
                <>
                  <View style={styles.symbolChipsRow}>
                    {QUICK_MATH_SYMBOLS.map((sym) => (
                      <Pressable
                        key={sym}
                        accessibilityRole="button"
                        accessibilityLabel={`Inserează simbolul ${sym}`}
                        onPress={() => {
                          Haptics.selection();
                          setShortInput((prev) => `${prev}${sym === '−' ? '-' : sym}`);
                        }}
                        style={({ pressed }) => [styles.symbolChip, pressed && styles.pressed]}
                      >
                        <Text style={styles.symbolChipText}>{sym}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel="Verifică răspunsul scris"
                    disabled={!shortInput.trim() || aiBusy}
                    pressedScale={0.97}
                    haptic="medium"
                    onPress={handleSubmitShortAnswer}
                    contentStyle={[
                      styles.verifyBtn,
                      !shortInput.trim() && styles.verifyBtnDisabled,
                    ]}
                  >
                    <LinearGradient
                      colors={['#EDFF7A', '#D8FF3E', '#BCEF12']}
                      start={{ x: 0.08, y: 0 }}
                      end={{ x: 0.92, y: 1 }}
                      style={styles.fill}
                    />
                    <View pointerEvents="none" style={styles.ctaTopGloss} />
                    <Text numberOfLines={2} style={styles.verifyBtnText}>
                      Verifică răspunsul
                    </Text>
                    <MiniGlyph name="check" size={16} color={colors.ink} />
                  </PressableScale>
                </>
              ) : null}
            </View>
          )}

          {submitted ? (
            <Animated.View
              onLayout={() => {
                if (feedbackScrolledRef.current) return;
                feedbackScrolledRef.current = true;
                requestAnimationFrame(() => {
                  scrollRef.current?.scrollToEnd({ animated: !reducedMotion });
                });
              }}
              style={[styles.feedbackSection, feedbackRevealStyle]}
            >
              <View style={[styles.verdictBanner, lastCorrect ? styles.verdictCorrect : styles.verdictWrong]}>
                <View style={[styles.verdictIcon, lastCorrect ? styles.verdictIconCorrect : styles.verdictIconWrong]}>
                  <MiniGlyph
                    name={lastCorrect ? 'check' : 'wrong'}
                    size={14}
                    color={lastCorrect ? colors.ink : colors.paper}
                  />
                </View>
                <View style={styles.verdictCopy}>
                  {lastCorrect ? (
                    <Text style={styles.verdictTitle}>
                      {mode === 'mistakes' && !currentQuestion.aiGenerated
                        ? remainingOtherMistakeIds.length === 0
                          ? 'Corect! Lista De repetat e acum curată ★'
                          : 'Corect! Eliminată din De repetat'
                        : 'Corect! Foarte bine!'}
                    </Text>
                  ) : (
                    <StudyInlineText
                      text={`Răspuns corect: ${currentQuestion.answerDisplay}`}
                      scale={readingScale * 0.96}
                      textStyle={styles.verdictTitle}
                      maxMathWidth={innerMathWidth - 64}
                    />
                  )}
                  {!lastCorrect && !currentQuestion.aiGenerated ? (
                    <Text style={styles.verdictSub}>
                      {mode === 'mistakes'
                        ? 'A rămas în Caiet → De repetat. Verifică explicația și încearcă din nou.'
                        : 'Am salvat întrebarea în Caiet → De repetat ca să o reiei ușor.'}
                    </Text>
                  ) : null}
                </View>
              </View>

              {!lastCorrect && linkedFormula ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Recitește fișa formulei: ${linkedFormula.title}`}
                  disabled={aiBusy}
                  onPress={handleOpenFormula}
                  style={({ pressed }) => [styles.quickFormulaPill, pressed && styles.pressed]}
                >
                  <AppIcon name="bookmark" size={18} />
                  <Text numberOfLines={2} style={styles.quickFormulaText}>
                    Recitește formula: {linkedFormula.title}
                  </Text>
                  <MiniGlyph name="next" size={14} color={colors.violetDeep} />
                </Pressable>
              ) : null}

              <View style={styles.postActionsRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Vezi explicația pas cu pas"
                  disabled={aiBusy}
                  onPress={handleOpenExplanation}
                  style={({ pressed }) => [styles.secondaryActionPill, styles.explainActionPill, pressed && styles.pressed]}
                >
                  <AppIcon name="explain" size={18} />
                  <Text numberOfLines={2} style={styles.secondaryActionText}>
                    Explicație pas cu pas
                  </Text>
                </Pressable>

                {currentQuestion.editorLatex ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Deschide lecția completă cu Profu AI"
                    disabled={aiBusy}
                    onPress={() => void handleExplainWithAiLesson()}
                    style={({ pressed }) => [styles.secondaryActionPill, styles.aiPillTint, pressed && styles.pressed]}
                  >
                    <MiniGlyph name="spark" size={13} color={colors.violet} />
                    <Text numberOfLines={2} style={styles.secondaryActionText}>
                      Lecție AI
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Generează un exercițiu asemănător cu Profu AI"
                disabled={aiBusy}
                onPress={() => void handleGenerateSimilar()}
                style={({ pressed }) => [styles.similarAiBtn, pressed && styles.pressed]}
              >
                <MiniGlyph name="spark" size={14} color={colors.violetDeep} />
                <Text numberOfLines={2} style={styles.similarAiText}>
                  Dă-mi unul asemănător (Profu’ AI)
                </Text>
              </Pressable>

              {similarError ? (
                <Text style={styles.similarErrorText}>{similarError}</Text>
              ) : null}

              {showTargetedPostFlow ? (
                <>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={
                      !lastCorrect
                        ? 'Reîncearcă acest exercițiu'
                        : remainingOtherMistakeIds.length > 0
                          ? `Continuă cu următoarea problemă din De repetat (${remainingOtherMistakeIds.length} rămase)`
                          : 'Gata, înapoi'
                    }
                    disabled={aiBusy}
                    pressedScale={0.97}
                    haptic="medium"
                    onPress={
                      !lastCorrect
                        ? handleRetryCurrentQuestion
                        : remainingOtherMistakeIds.length > 0
                          ? handleNextRemainingMistake
                          : leaveToPrevious
                    }
                    contentStyle={styles.nextBtn}
                  >
                    <LinearGradient
                      colors={['#EDFF7A', '#D8FF3E', '#BCEF12']}
                      start={{ x: 0.08, y: 0 }}
                      end={{ x: 0.92, y: 1 }}
                      style={styles.fill}
                    />
                    <View pointerEvents="none" style={styles.ctaTopGloss} />
                    <Text numberOfLines={2} style={styles.nextBtnText}>
                      {!lastCorrect
                        ? 'Reîncearcă exercițiul'
                        : remainingOtherMistakeIds.length > 0
                          ? `Următoarea din De repetat (${remainingOtherMistakeIds.length})`
                          : 'Gata · Lista e curată ★'}
                    </Text>
                    {!lastCorrect ? (
                      <View style={styles.retryBadge}>
                        <AppIcon name="retake" size={22} />
                      </View>
                    ) : (
                      <View style={styles.nextArrow}>
                        <MiniGlyph
                          name={remainingOtherMistakeIds.length > 0 ? 'next' : 'check'}
                          size={16}
                          color={colors.paper}
                        />
                      </View>
                    )}
                  </PressableScale>

                  {(!lastCorrect || remainingOtherMistakeIds.length > 0) ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Înapoi"
                      disabled={aiBusy}
                      onPress={leaveToPrevious}
                      style={({ pressed }) => [styles.returnNotebookBtn, pressed && styles.pressed]}
                    >
                      <Text style={styles.returnNotebookText}>Înapoi</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={isLast ? 'Vezi rezultatul testului' : 'Treci la întrebarea următoare'}
                  disabled={aiBusy}
                  pressedScale={0.97}
                  haptic="medium"
                  onPress={handleNext}
                  contentStyle={styles.nextBtn}
                >
                  <LinearGradient
                    colors={['#EDFF7A', '#D8FF3E', '#BCEF12']}
                    start={{ x: 0.08, y: 0 }}
                    end={{ x: 0.92, y: 1 }}
                    style={styles.fill}
                  />
                  <View pointerEvents="none" style={styles.ctaTopGloss} />
                  <Text numberOfLines={2} style={styles.nextBtnText}>
                    {isLast ? 'Vezi rezultatul ★' : 'Următoarea întrebare'}
                  </Text>
                  <View style={styles.nextArrow}>
                    <MiniGlyph name="next" size={16} color={colors.paper} />
                  </View>
                </PressableScale>
              )}
            </Animated.View>
          ) : null}
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
                  disabled={submittingShort}
                  onPress={() => {
                    Haptics.selection();
                    setShortInput((prev) => `${prev}${sym === '−' ? '-' : sym}`);
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

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Verifică răspunsul scris"
              disabled={!shortInput.trim() || aiBusy || submittingShort}
              dimWhenDisabled={!submittingShort}
              pressedScale={0.97}
              haptic="medium"
              onPress={handleSubmitShortAnswer}
              contentStyle={[
                styles.dockVerifyBtn,
                !shortInput.trim() && styles.verifyBtnDisabled,
              ]}
            >
              <LinearGradient
                colors={['#EDFF7A', '#D8FF3E', '#BCEF12']}
                start={{ x: 0.08, y: 0 }}
                end={{ x: 0.92, y: 1 }}
                style={styles.fill}
              />
              <View pointerEvents="none" style={styles.ctaTopGloss} />
              <Text numberOfLines={2} style={styles.verifyBtnText}>
                {submittingShort ? 'Verificăm...' : 'Verifică răspunsul'}
              </Text>
              <MiniGlyph name="check" size={16} color={colors.ink} />
            </PressableScale>
          </View>
        </View>
      ) : null}
      </View>

      {explanationEverOpened ? (
        <ComicBottomSheet
          visible={explanationOpen}
          onClose={() => setExplanationOpen(false)}
          maxHeight="88%"
          sheetStyle={styles.explanationSheet}
        >
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderCopy}>
              <Text style={styles.sheetEyebrow}>REZOLVARE PAS CU PAS</Text>
              <Text numberOfLines={2} style={styles.sheetTitle}>{currentQuestion.title}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Închide explicația"
              hitSlop={8}
              onPress={() => {
                Haptics.selection();
                setExplanationOpen(false);
              }}
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
              <Text style={styles.sheetAnswerEyebrow}>RĂSPUNS CORECT</Text>
              <StudyInlineText
                text={currentQuestion.answerDisplay}
                scale={readingScale * 1.06}
                textStyle={styles.sheetAnswerText}
                maxMathWidth={innerMathWidth - 20}
              />
            </View>

            {currentQuestion.renderedExplanation ? (
              <LiveRichContentView
                key={`exp-live-${currentQuestion.id}`}
                content={currentQuestion.renderedExplanation}
                scale={readingScale}
                maxWidth={innerMathWidth - 10}
              />
            ) : (
              <StudyBlocksView
                key={`exp-study-${currentQuestion.id}`}
                blocks={currentQuestion.explanation}
                scale={readingScale}
                maxWidth={innerMathWidth - 10}
              />
            )}
          </ScrollView>

          {linkedFormula ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Vezi fișa formulei: ${linkedFormula.title}`}
              onPress={handleOpenFormula}
              style={({ pressed }) => [styles.formulaLinkBtn, pressed && styles.pressed]}
            >
              <AppIcon name="bookmark" size={20} />
              <Text numberOfLines={2} style={styles.formulaLinkText}>
                Fișa formulei: {linkedFormula.title}
              </Text>
              <MiniGlyph name="next" size={14} color={colors.violetDeep} />
            </Pressable>
          ) : null}
        </ComicBottomSheet>
      ) : null}

      <ComicBottomSheet
        visible={exitConfirmOpen}
        onClose={() => setExitConfirmOpen(false)}
        maxHeight="52%"
      >
        <Text style={styles.confirmTitle}>Închizi testul acum?</Text>
        <Text style={styles.confirmText}>
          Ai răspuns deja la {answers.length} din {questions.length}{' '}
          {questions.length === 1 ? 'întrebare' : 'întrebări'}.{' '}
          {mode === 'ai'
            ? 'Rezultatul final al sesiunii nu va fi înregistrat.'
            : 'Întrebările greșite din bancă au fost deja salvate în Caiet, dar rezultatul final al sesiunii nu va fi înregistrat.'}
        </Text>
        <View style={styles.confirmActions}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Confirmă ieșirea din test"
            pressedScale={0.97}
            haptic="medium"
            onPress={() => {
              setExitConfirmOpen(false);
              leavingAllowedRef.current = true;
              beginAppTransition();
              navigation.goBack();
            }}
            contentStyle={styles.confirmExitBtn}
          >
            <Text numberOfLines={2} style={styles.confirmExitText}>
              Da, închide testul
            </Text>
          </PressableScale>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continuă testul"
            onPress={() => setExitConfirmOpen(false)}
            style={({ pressed }) => [styles.confirmStayBtn, pressed && styles.pressed]}
          >
            <Text style={styles.confirmStayText}>Continuă testul</Text>
          </Pressable>
        </View>
      </ComicBottomSheet>

      <AiBlockingOverlay
        visible={aiBusy}
        eyebrow={similarBusy ? `PROFU’ AI · ${categoryMeta.shortLabel.toUpperCase()}` : 'PROFU’ AI · LECȚIE COMPLETĂ'}
        title={similarBusy ? 'Compunem un exercițiu asemănător' : 'Pregătim lecția detaliată'}
        stages={similarBusy ? SIMILAR_AI_STAGES : LESSON_AI_STAGES}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  flexBody: { flex: 1, minHeight: 0 },

  canopy: {
    width: '100%',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    paddingBottom: 6,
    position: 'relative',
    zIndex: 4,
  },
  canopyGlowTop: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    top: -90,
    right: -40,
    backgroundColor: 'rgba(216, 255, 62, 0.14)',
  },
  canopyOrbitArc: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    top: -120,
    left: -70,
  },
  topBar: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 7,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.3,
    borderBottomWidth: 3,
    borderColor: '#FFFFFF',
    borderBottomColor: '#C5B8FA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  progressWrap: { flex: 1, minWidth: 36 },
  metaPills: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  countPill: {
    minHeight: 30,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(18, 12, 46, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 11.5,
    includeFontPadding: false,
  },
  scorePill: {
    minHeight: 30,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 11,
    includeFontPadding: false,
  },
  timerPill: {
    minHeight: 30,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(18, 12, 46, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontFamily: fonts.bodyBold,
    color: 'rgba(248, 245, 255, 0.94)',
    fontSize: 11,
    includeFontPadding: false,
  },
  scalePill: {
    minWidth: 36,
    minHeight: 32,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    borderWidth: 1.3,
    borderBottomWidth: 2.8,
    borderColor: '#FFFFFF',
    borderBottomColor: '#C5B8FA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scalePillText: {
    fontFamily: fonts.display,
    color: colors.violetDeep,
    fontSize: 12,
    includeFontPadding: false,
  },

  scrollBody: {
    flexGrow: 1,
    paddingTop: 12,
    alignItems: 'center',
  },
  stageWrap: {
    width: '100%',
    gap: 12,
  },
  promptCard: {
    borderRadius: 26,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 10,
  },
  promptHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  promptMetaLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  promptEyebrow: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.75,
    color: colors.violetDeep,
  },
  diffPill: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  diffPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    includeFontPadding: false,
  },
  promptTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 20,
    lineHeight: 25,
  },

  hintButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1.3,
    borderBottomWidth: 3,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
  },
  hintButtonText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 12.5,
  },
  hintCard: {
    borderRadius: 20,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#FFE08A',
    borderBottomColor: '#DFB646',
    backgroundColor: '#FFFBEF',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 4,
  },
  hintLabel: {
    fontFamily: fonts.bodyBold,
    color: '#9A6200',
    fontSize: 10.5,
    letterSpacing: 0.7,
  },
  hintText: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 13.5,
    lineHeight: 20,
  },

  choicesStack: { gap: 9 },
  choiceCard: {
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  choiceCardPressed: {
    transform: [{ scale: 0.985 }],
    backgroundColor: '#F7F3FF',
  },
  choiceCardCorrect: {
    borderColor: '#A8D832',
    borderBottomColor: '#7EA508',
    backgroundColor: '#F4FFD2',
  },
  choiceCardWrong: {
    borderColor: '#F5A5B4',
    borderBottomColor: '#D6637A',
    backgroundColor: colors.roseSoft,
  },
  choiceCardDimmed: { opacity: 0.56 },
  choiceBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  choiceBadgeCorrect: { backgroundColor: colors.lime },
  choiceBadgeWrong: { backgroundColor: colors.rose },
  choiceBadgeText: {
    fontFamily: fonts.display,
    color: colors.violetDeep,
    fontSize: 15,
    includeFontPadding: false,
  },
  choiceBadgeTextCorrect: { color: colors.ink },
  choiceBadgeTextWrong: { color: colors.paper },
  choiceBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  choiceLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
  },

  shortAnswerBox: { gap: 10 },
  inputWrap: {
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: '#DFD2FA',
    borderBottomColor: '#C5B0F4',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputCorrect: {
    borderColor: '#A8D832',
    borderBottomColor: '#7EA508',
    backgroundColor: '#F4FFD2',
  },
  inputWrong: {
    borderColor: '#F5A5B4',
    borderBottomColor: '#D6637A',
    backgroundColor: colors.roseSoft,
  },
  shortInput: {
    flex: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 19,
    paddingVertical: 10,
  },
  clearInputBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolChipsRow: {
    flexDirection: 'row',
    gap: 7,
  },
  symbolChip: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1.3,
    borderBottomWidth: 3,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolChipText: {
    fontFamily: fonts.display,
    color: colors.violetDeep,
    fontSize: 18,
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
  verifyBtn: {
    minHeight: 54,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderBottomWidth: 4.5,
    borderColor: '#E8FF78',
    borderBottomColor: '#7EA508',
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  verifyBtnDisabled: { opacity: 0.5 },
  verifyBtnText: {
    flexShrink: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 16.5,
    textAlign: 'center',
  },
  keyboardDock: {
    borderTopWidth: 1.4,
    borderTopColor: '#E5DCFF',
    backgroundColor: '#FFFFFF',
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
    borderWidth: 1.2,
    borderBottomWidth: 2.8,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FAF7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockHideBtn: {
    minHeight: 38,
    paddingHorizontal: 11,
    borderRadius: 12,
    borderWidth: 1.2,
    borderBottomWidth: 2.8,
    borderColor: '#E2D6FF',
    borderBottomColor: '#C8B5FA',
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
  dockVerifyBtn: {
    minHeight: 48,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 4,
    borderColor: '#E8FF78',
    borderBottomColor: '#7EA508',
    paddingHorizontal: 18,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
    position: 'relative',
  },

  feedbackSection: { gap: 10, marginTop: 2 },
  verdictBanner: {
    borderRadius: 22,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  verdictCorrect: {
    backgroundColor: '#F2FFC7',
    borderColor: '#C5EA63',
    borderBottomColor: '#98C40E',
  },
  verdictWrong: {
    backgroundColor: colors.roseSoft,
    borderColor: '#F7B7C2',
    borderBottomColor: '#DF8094',
  },
  verdictIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  verdictIconCorrect: { backgroundColor: colors.lime },
  verdictIconWrong: { backgroundColor: colors.rose },
  verdictCopy: { flex: 1, minWidth: 0, gap: 2 },
  verdictTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 15.5,
    lineHeight: 21,
  },
  verdictSub: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 12.5,
    lineHeight: 17,
  },
  quickFormulaPill: {
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1.3,
    borderBottomWidth: 3.2,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FAF7FF',
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  quickFormulaText: {
    flex: 1,
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 12.5,
    lineHeight: 17,
  },
  postActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryActionPill: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1.3,
    borderBottomWidth: 3.2,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  explainActionPill: {
    flex: 1.35,
  },
  aiPillTint: {
    backgroundColor: colors.violetSoft,
    borderColor: '#DFD2FA',
    borderBottomColor: '#C2ADF4',
  },
  secondaryActionText: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 12.5,
    lineHeight: 16,
    textAlign: 'center',
  },
  similarAiBtn: {
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1.3,
    borderBottomWidth: 3.2,
    borderColor: '#DFD2FA',
    borderBottomColor: '#C2ADF4',
    backgroundColor: '#F6F1FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  similarAiText: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'center',
  },
  similarErrorText: {
    fontFamily: fonts.bodyMedium,
    color: '#A51D36',
    fontSize: 12.5,
    textAlign: 'center',
  },
  nextBtn: {
    minHeight: 54,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderBottomWidth: 4.5,
    borderColor: '#E8FF78',
    borderBottomColor: '#7EA508',
    paddingLeft: 18,
    paddingRight: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  nextBtnText: {
    flex: 1,
    flexShrink: 1,
    textAlign: 'center',
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 21,
  },
  nextArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  retryBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  returnNotebookBtn: {
    minHeight: 46,
    borderRadius: radii.pill,
    borderWidth: 1.3,
    borderBottomWidth: 3,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  returnNotebookText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 14,
  },

  explanationSheet: {
    height: '86%',
    paddingHorizontal: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sheetHeaderCopy: { flex: 1, minWidth: 0 },
  sheetEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.75,
    color: colors.violetDeep,
  },
  sheetTitle: {
    marginTop: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 18,
    lineHeight: 22,
  },
  sheetScrollBody: {
    paddingTop: 4,
    paddingBottom: 18,
    gap: 14,
  },
  sheetAnswerCard: {
    borderRadius: 18,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#D6F08A',
    borderBottomColor: '#AED442',
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
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
  },
  formulaLinkBtn: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1.3,
    borderBottomWidth: 3,
    borderColor: '#DFD2FA',
    borderBottomColor: '#C2ADF4',
    backgroundColor: colors.violetSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  formulaLinkText: {
    flex: 1,
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 13,
    lineHeight: 17,
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
  confirmActions: {
    marginTop: 16,
    gap: 9,
  },
  confirmExitBtn: {
    minHeight: 50,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 3.8,
    borderColor: '#FF8EA0',
    borderBottomColor: '#B5203E',
    backgroundColor: colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  confirmExitText: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 16,
    textAlign: 'center',
  },
  confirmStayBtn: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  confirmStayText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 14,
  },

  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 23,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyBackBtn: {
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 4,
    borderColor: '#E8FF78',
    borderBottomColor: '#7EA508',
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBackText: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 15.5,
  },
  pressed: { opacity: 0.78 },
});
