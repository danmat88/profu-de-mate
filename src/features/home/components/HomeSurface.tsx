import { LinearGradient } from 'expo-linear-gradient';
import { memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { computeHeroGeometry } from '../../../shared/layout/heroGeometry';
import {
  cosinePingPongRange,
  cosinePulseRange,
  createNativeLoop,
  SILKY_EASE_OUT,
  WAVE_INPUT_17,
} from '../../../shared/motion/nativeMotion';
import { bundledImageSource } from '../../../shared/services/bundledImages';
import { colors, fonts, radii } from '../../../shared/theme';
import type { FlowMode } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { Enter } from '../../../shared/ui/Enter';
import { IconButton } from '../../../shared/ui/IconButton';
import { Mascot, type MascotPose } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { ROYAL_HERO_GRADIENT, RoyalHeroCanopyBackdrop, StudioCardBackdrop } from '../../../shared/ui/RoyalHeroCanopyBackdrop';
import { SegmentedToggle, type SegmentedOption } from '../../../shared/ui/SegmentedToggle';
import { SpeechBubble, type SpeechBubbleTone } from '../../../shared/ui/SpeechBubble';
import { SpotlightAura, type SpotlightAuraTone } from '../../../shared/ui/SpotlightAura';
import { Text } from '../../../shared/ui/Typography';
import { ComicClockIcon, HomeResetPillNote } from '../../access/components/QuotaResetTimer';
import type { AllowancePresentation } from '../../access/utils/commercialPresentation';
import { HomeMotionReadyContext } from '../context/HomeMotionContext';

type Props = {
  mode: FlowMode;
  focused?: boolean;
  pending: boolean;
  pendingKind?: 'photo' | 'written' | null;
  galleryBusy: boolean;
  galleryError: string | null;
  allowance: AllowancePresentation;
  resetAt?: string | null;
  remaining?: number;
  limit?: number;
  premiumActive?: boolean;
  latestLessonTitle?: string | null;
  savedLessonsCount?: number;
  studyTrackLabel?: string;
  studyTrackChosen?: boolean;
  streakDays?: number;
  wrongCount?: number;
  showGuide?: boolean;
  embedded?: boolean;
  animateSkyDome?: boolean;
  bottomClearance?: number;
  onDismissGuide?: () => void;
  onClearGalleryError?: () => void;
  onDiscardPending?: () => void;
  onMode: (mode: FlowMode) => void;
  onCapture: () => void;
  onGallery: () => void;
  onMath: () => void;
  onNotebook: () => void;
  onStudy?: () => void;
  onChooseStudyTrack?: () => void;
  onQuickPractice?: () => void;
  onSettings: () => void;
  onAllowance: () => void;
};

const modeOptions: readonly [SegmentedOption<FlowMode>, SegmentedOption<FlowMode>] = [
  {
    value: 'solve',
    label: 'Rezolvă',
    subtitle: 'Explică pas cu pas',
    icon: 'camera',
    activeFill: colors.violet,
    activeGradient: ['#8E49FF', '#6520EC', '#4410B4'],
    activeText: colors.paper,
    dotFill: colors.lime,
    dotText: colors.ink,
  },
  {
    value: 'check',
    label: 'Verifică',
    subtitle: 'Enunț + rezolvare',
    icon: 'verify',
    activeFill: '#E63876',
    activeGradient: ['#FF7B63', '#E63876', '#B5175B'],
    activeText: colors.paper,
    dotFill: colors.gold,
    dotText: colors.ink,
  },
];

type TutorMessage = {
  title: string;
  body: string;
  compactBody: string;
  pose: MascotPose;
  tone: SpeechBubbleTone;
};

const LAST_PROBLEM_MESSAGE: TutorMessage = {
  title: 'Ultima problemă pe azi!',
  body: 'Alege una bună — revin la 00:00.',
  compactBody: 'Ultima pe azi — revin la 00:00.',
  pose: 'point',
  tone: 'peachSoft',
};

const SOLVE_CHEER_MESSAGES: readonly TutorMessage[] = [
  { title: 'Hai că poți!', body: 'Fiecare problemă devine clară pas cu pas.', compactBody: 'Clar, pas cu pas.', pose: 'cheer', tone: 'limeSoft' },
  { title: 'E mai simplu decât pare!', body: 'Fă o poză sau scrie enunțul direct.', compactBody: 'Fă o poză sau scrie enunțul.', pose: 'point', tone: 'limeSoft' },
  { title: 'Sunt aici cu tine!', body: 'Îți explic pe înțeles, fără grabă.', compactBody: 'Îți explic simplu, fără grabă.', pose: 'wave', tone: 'paper' },
  { title: 'Nivel de campion!', body: 'Un exercițiu pe zi face diferența.', compactBody: 'Un exercițiu pe zi contează.', pose: 'cheer', tone: 'limeSoft' },
];

const CHECK_CHEER_MESSAGES: readonly TutorMessage[] = [
  { title: 'Bravo că încerci întâi!', body: 'Așa înveți cel mai repede la mate.', compactBody: 'Așa înveți cel mai repede.', pose: 'cheer', tone: 'limeSoft' },
  { title: 'Verificăm fără stres!', body: 'Prinde enunțul și pașii tăi — vezi ce e bine.', compactBody: 'Enunțul și pașii tăi în cadru.', pose: 'point', tone: 'peachSoft' },
  { title: 'Fiecare pas contează!', body: 'Prinde enunțul și rezolvarea ta în cadru.', compactBody: 'Prinde enunțul și rezolvarea.', pose: 'wave', tone: 'peachSoft' },
];

const EXHAUSTED_FREE_MESSAGES: readonly TutorMessage[] = [
  { title: 'Super treabă azi!', body: 'Problemele revin automat la 00:00.', compactBody: 'Revin automat la 00:00.', pose: 'wave', tone: 'peachSoft' },
  { title: 'Caietul e mereu liber!', body: 'Recitește lecțiile salvate și offline.', compactBody: 'Lecțiile tale merg și offline.', pose: 'point', tone: 'limeSoft' },
  { title: 'Vrei mai multă practică?', body: 'Atinge cronometrul pentru Pro sau Max.', compactBody: 'Atinge sus pentru Pro & Max.', pose: 'cheer', tone: 'violetSoft' },
  { title: 'Pauză binemeritată!', body: 'Sus vezi exact cât mai e până la 00:00.', compactBody: 'Cronometrul arată timpul rămas.', pose: 'thinking', tone: 'peachSoft' },
];

const EXHAUSTED_PREMIUM_MESSAGES: readonly TutorMessage[] = [
  { title: 'Super ritm azi!', body: 'Toate problemele revin la 00:00.', compactBody: 'Revin automat la 00:00.', pose: 'wave', tone: 'limeSoft' },
  { title: 'Caietul e mereu liber!', body: 'Recitește lecțiile salvate și offline.', compactBody: 'Lecțiile tale merg și offline.', pose: 'point', tone: 'limeSoft' },
  { title: 'Pauză binemeritată!', body: 'Sus vezi exact cât mai e până la 00:00.', compactBody: 'Cronometrul arată timpul rămas.', pose: 'thinking', tone: 'peachSoft' },
];

const PENDING_MESSAGES: readonly TutorMessage[] = [
  { title: 'Aproape gata!', body: 'Apasă „Revino la analiză” să vezi starea.', compactBody: 'Apasă „Revino la analiză”.', pose: 'point', tone: 'limeSoft' },
  { title: 'Nu pierzi nimic!', body: 'Între timp poți răsfoi liniștit Caietul.', compactBody: 'Poți răsfoi Caietul între timp.', pose: 'wave', tone: 'limeSoft' },
];

const WAVE_INPUT = WAVE_INPUT_17;
const COS_PING_PONG = cosinePingPongRange(-1, 1);
const COS_PULSE = cosinePulseRange(0, 1);

function solveGreeting(hour: number): string {
  if (hour >= 6 && hour < 12) return 'Bună dimineața!';
  if (hour >= 18 && hour < 23) return 'Lucrăm ceva azi?';
  return 'Salut! Ce rezolvăm?';
}

export const HomeSurface = memo(function HomeSurface({
  mode,
  focused = true,
  pending,
  pendingKind = null,
  galleryBusy,
  galleryError,
  allowance,
  resetAt = null,
  remaining,
  limit,
  premiumActive = false,
  latestLessonTitle = null,
  savedLessonsCount = 0,
  studyTrackLabel,
  studyTrackChosen = true,
  streakDays = 0,
  wrongCount = 0,
  showGuide = false,
  embedded = false,
  animateSkyDome = true,
  bottomClearance = 8,
  onDismissGuide,
  onClearGalleryError,
  onDiscardPending,
  onMode,
  onCapture,
  onGallery,
  onMath,
  onNotebook,
  onStudy,
  onChooseStudyTrack,
  onQuickPractice,
  onSettings,
  onAllowance,
}: Props) {
  const frame = useSafeAreaFrame();
  const { contentWidth, fontScale, isVeryNarrow } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const hero = computeHeroGeometry({
    width: frame.width,
    height: frame.height,
    topInset: insets.top,
    fontScale,
  });
  const compact = hero.compact;
  const reducedMotion = useReducedMotion();
  const motionReady = useContext(HomeMotionReadyContext);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [ambientReady, setAmbientReady] = useState(false);
  const [cheer, setCheer] = useState<{ index: number; scope: string } | null>(null);
  const [mascotNudge, setMascotNudge] = useState(0);
  const cheerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousMode = useRef(mode);
  const skyDomePlayed = useRef(reducedMotion || !animateSkyDome);
  const initialRevealSettled = useRef(false);

  const isSolve = mode === 'solve';
  const hasPendingAnalysis = pending;
  const quotaExhausted = remaining !== undefined && remaining <= 0;
  const lastProblemLeft = !hasPendingAnalysis && !quotaExhausted && remaining === 1;
  const showPillResetTimer = Boolean(resetAt) && remaining !== undefined && limit !== undefined && remaining < limit;
  const energyRatio = remaining !== undefined && limit !== undefined && limit > 0
    ? Math.max(0, Math.min(1, remaining / limit))
    : null;
  const cheerScope = `${mode}:${hasPendingAnalysis}:${quotaExhausted}:${premiumActive}:${lastProblemLeft}:${galleryError ?? ''}`;
  const baseCheerPool: readonly TutorMessage[] = hasPendingAnalysis
    ? PENDING_MESSAGES
    : quotaExhausted
      ? (premiumActive ? EXHAUSTED_PREMIUM_MESSAGES : EXHAUSTED_FREE_MESSAGES)
      : isSolve
        ? SOLVE_CHEER_MESSAGES
        : CHECK_CHEER_MESSAGES;
  const cheerPool: readonly TutorMessage[] = lastProblemLeft
    ? [LAST_PROBLEM_MESSAGE, ...baseCheerPool]
    : baseCheerPool;
  const cheerIndex = cheer && cheer.scope === cheerScope ? cheer.index % cheerPool.length : null;
  const motionActive = motionReady && focused && foreground && !reducedMotion;

  const skyDomeEnter = useRef(new Animated.Value(reducedMotion || !animateSkyDome ? 1 : 0)).current;
  const stagePop = useRef(new Animated.Value(1)).current;
  const medallionPop = useRef(new Animated.Value(1)).current;
  const modeBlend = useRef(new Animated.Value(isSolve ? 0 : 1)).current;
  const beamProgress = useRef(new Animated.Value(0)).current;
  const beamVisible = useRef(new Animated.Value(0)).current;
  const sparkPulse = useRef(new Animated.Value(0)).current;
  const arrowNudge = useRef(new Animated.Value(0)).current;
  const ctaSheen = useRef(new Animated.Value(0)).current;
  const tapSpark = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => () => {
    if (cheerTimer.current) clearTimeout(cheerTimer.current);
  }, []);

  useEffect(() => {
    if (cheerTimer.current) {
      clearTimeout(cheerTimer.current);
      cheerTimer.current = null;
    }
  }, [cheerScope]);

  // Smoothly unfurl the curved Royal-Violet/Coral sky canopy with unhurried splash-like ease.
  useEffect(() => {
    if (reducedMotion || !animateSkyDome) {
      skyDomeEnter.stopAnimation();
      skyDomeEnter.setValue(1);
      skyDomePlayed.current = true;
      return undefined;
    }
    if (!motionReady) {
      if (!skyDomePlayed.current) skyDomeEnter.setValue(0);
      return undefined;
    }
    if (skyDomePlayed.current) {
      skyDomeEnter.setValue(1);
      return undefined;
    }
    skyDomePlayed.current = true;

    let anim: Animated.CompositeAnimation | undefined;
    const frame = requestAnimationFrame(() => {
      anim = Animated.timing(skyDomeEnter, {
        toValue: 1,
        duration: 580,
        easing: SILKY_EASE_OUT,
        useNativeDriver: true,
      });
      anim.start();
    });
    const watchdog = setTimeout(() => {
      skyDomeEnter.stopAnimation();
      skyDomeEnter.setValue(1);
    }, 820);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(watchdog);
      anim?.stop();
      skyDomeEnter.stopAnimation();
    };
  }, [animateSkyDome, motionReady, reducedMotion, skyDomeEnter]);

  // Gate all self-running Home ambient loops strictly AFTER the unhurried entrance lands
  // so cold-start reveal runs at an uninterrupted 60fps with zero RenderThread contention.
  useEffect(() => {
    if (!motionActive) {
      setAmbientReady(false);
      return undefined;
    }
    const wakeDelay = initialRevealSettled.current ? 180 : 1_080;
    const wakeTimer = setTimeout(() => {
      initialRevealSettled.current = true;
      setAmbientReady(true);
    }, wakeDelay);
    return () => clearTimeout(wakeTimer);
  }, [motionActive]);

  // Ambient studio loops execute via pure single-timing native _startNativeLoop(-1)
  // on Android RenderThread with zero JS callbacks, waking smoothly in Wave B after the owl.
  useEffect(() => {
    if (!ambientReady) {
      beamProgress.stopAnimation();
      beamVisible.stopAnimation();
      sparkPulse.stopAnimation();
      arrowNudge.stopAnimation();
      ctaSheen.stopAnimation();
      beamVisible.setValue(0);
      return undefined;
    }

    const loops: Animated.CompositeAnimation[] = [];
    let fadeAnim: Animated.CompositeAnimation | undefined;
    const startNativeLoop = (value: Animated.Value, duration: number) => {
      const loop = createNativeLoop(value, duration);
      loops.push(loop);
      loop.start();
    };

    const startTimer = setTimeout(() => {
      startNativeLoop(beamProgress, hasPendingAnalysis ? 2_600 : 3_400);
      startNativeLoop(sparkPulse, hasPendingAnalysis ? 2_200 : 2_800);
      startNativeLoop(arrowNudge, 1_900);
      startNativeLoop(ctaSheen, 3_600);
      fadeAnim = Animated.timing(beamVisible, {
        toValue: 0.96,
        duration: 320,
        easing: SILKY_EASE_OUT,
        useNativeDriver: true,
      });
      fadeAnim.start();
    }, 200);

    return () => {
      clearTimeout(startTimer);
      fadeAnim?.stop();
      loops.forEach((loop) => loop.stop());
      beamProgress.stopAnimation();
      beamVisible.stopAnimation();
      sparkPulse.stopAnimation();
      arrowNudge.stopAnimation();
      ctaSheen.stopAnimation();
    };
  }, [ambientReady, arrowNudge, beamProgress, beamVisible, ctaSheen, hasPendingAnalysis, sparkPulse]);

  useEffect(() => {
    const targetBlend = isSolve ? 0 : 1;
    const anims: Animated.CompositeAnimation[] = [];
    if (reducedMotion || !motionReady || !focused) {
      modeBlend.stopAnimation();
      modeBlend.setValue(targetBlend);
    } else {
      const blendAnim = Animated.timing(modeBlend, {
        toValue: targetBlend,
        duration: 320,
        easing: SILKY_EASE_OUT,
        useNativeDriver: true,
      });
      anims.push(blendAnim);
      blendAnim.start();
    }

    if (previousMode.current === mode) {
      return () => anims.forEach((anim) => anim.stop());
    }
    previousMode.current = mode;
    if (reducedMotion || !motionReady || !focused) {
      stagePop.stopAnimation();
      medallionPop.stopAnimation();
      stagePop.setValue(1);
      medallionPop.setValue(1);
      return () => anims.forEach((anim) => anim.stop());
    }
    stagePop.setValue(0.985);
    medallionPop.setValue(0.9);
    const stageAnim = Animated.spring(stagePop, {
      toValue: 1,
      tension: 220,
      friction: 20,
      useNativeDriver: true,
    });
    const medallionAnim = Animated.spring(medallionPop, {
      toValue: 1,
      tension: 200,
      friction: 16,
      useNativeDriver: true,
    });
    anims.push(stageAnim, medallionAnim);
    stageAnim.start();
    medallionAnim.start();

    return () => anims.forEach((anim) => anim.stop());
  }, [focused, hasPendingAnalysis, isSolve, medallionPop, mode, modeBlend, motionReady, reducedMotion, stagePop]);

  const cycleEncouragement = () => {
    if (!reducedMotion) {
      tapSpark.stopAnimation();
      tapSpark.setValue(0);
      Animated.timing(tapSpark, {
        toValue: 1,
        duration: 540,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    if (galleryError) {
      onClearGalleryError?.();
      setCheer(null);
      return;
    }
    if (cheerTimer.current) clearTimeout(cheerTimer.current);
    setCheer((current) => {
      const nextIndex = current && current.scope === cheerScope
        ? (current.index + 1) % cheerPool.length
        : 0;
      return { index: nextIndex, scope: cheerScope };
    });
    cheerTimer.current = setTimeout(() => setCheer(null), 4200);
  };

  const triggerTutorFromHeader = () => {
    setMascotNudge((value) => value + 1);
    cycleEncouragement();
  };

  const skyDomeAnimatedStyle = useMemo(() => ({
    opacity: skyDomeEnter.interpolate({
      inputRange: [0, 0.45, 1],
      outputRange: [0.01, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: skyDomeEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [-60, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [skyDomeEnter]);

  const stageAnimated = useMemo(() => ({
    transform: [{ scale: stagePop }],
  }), [stagePop]);

  const checkGradientStyle = useMemo(() => ({
    opacity: modeBlend,
  }), [modeBlend]);

  const medallionAnimated = useMemo(() => ({
    transform: [{ scale: medallionPop }],
  }), [medallionPop]);

  const beamRange = compact ? 22 : isVeryNarrow ? 29 : 34;
  const beamTranslateY = useMemo(
    () => beamProgress.interpolate({
      inputRange: WAVE_INPUT,
      outputRange: COS_PING_PONG.map((value) => value * beamRange),
    }),
    [beamProgress, beamRange],
  );
  const beamStyle = useMemo(() => ({
    opacity: beamVisible,
    transform: [{ translateY: beamTranslateY }],
  }), [beamTranslateY, beamVisible]);

  const sparkStyle = useMemo(() => ({
    opacity: sparkPulse.interpolate({
      inputRange: WAVE_INPUT,
      outputRange: COS_PULSE.map((value) => 0.72 + value * 0.28),
    }),
    transform: [
      {
        scale: sparkPulse.interpolate({
          inputRange: WAVE_INPUT,
          outputRange: COS_PULSE.map((value) => 0.92 + value * 0.18),
        }),
      },
      {
        rotate: sparkPulse.interpolate({
          inputRange: WAVE_INPUT,
          outputRange: COS_PULSE.map((value) => `${(-8 + value * 16).toFixed(2)}deg`),
        }),
      },
    ],
  }), [sparkPulse]);

  const lensHaloStyle = useMemo(() => ({
    opacity: sparkPulse.interpolate({
      inputRange: WAVE_INPUT,
      outputRange: COS_PULSE.map((value) => 0.24 + value * 0.36),
    }),
    transform: [
      {
        scale: sparkPulse.interpolate({
          inputRange: WAVE_INPUT,
          outputRange: COS_PULSE.map((value) => 0.96 + value * 0.08),
        }),
      },
    ],
  }), [sparkPulse]);

  const arrowStyle = useMemo(() => ({
    transform: [
      {
        translateX: arrowNudge.interpolate({
          inputRange: WAVE_INPUT,
          outputRange: COS_PULSE.map((value) => value * 3.5),
        }),
      },
    ],
  }), [arrowNudge]);

  const ctaSheenStyle = useMemo(() => ({
    opacity: ctaSheen.interpolate({
      inputRange: [0, 0.1, 0.14, 0.3, 0.34, 1],
      outputRange: [0, 0, 0.46, 0.46, 0, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: ctaSheen.interpolate({
          inputRange: [0, 0.1, 0.34, 1],
          outputRange: [-90, -90, 340, 340],
        }),
      },
      { skewX: '-22deg' },
    ],
  }), [ctaSheen]);

  const { sparkTopStyle, sparkRightStyle, sparkLeftStyle } = useMemo(() => {
    const arcOpacity = tapSpark.interpolate({
      inputRange: [0, 0.22, 0.5, 0.78, 1],
      outputRange: [0, 0.78, 1, 0.78, 0],
      extrapolate: 'clamp',
    });
    return {
      sparkTopStyle: {
        opacity: arcOpacity,
        transform: [
          { translateX: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) },
          { translateY: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0, -22] }) },
          { scale: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.25] }) },
          { rotate: tapSpark.interpolate({ inputRange: [0, 1], outputRange: ['-16deg', '18deg'] }) },
        ],
      },
      sparkRightStyle: {
        opacity: arcOpacity,
        transform: [
          { translateX: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) },
          { translateY: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }) },
          { scale: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.2] }) },
          { rotate: tapSpark.interpolate({ inputRange: [0, 1], outputRange: ['18deg', '-18deg'] }) },
        ],
      },
      sparkLeftStyle: {
        opacity: arcOpacity,
        transform: [
          { translateX: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0, -22] }) },
          { translateY: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) },
          { scale: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.15] }) },
          { rotate: tapSpark.interpolate({ inputRange: [0, 1], outputRange: ['-10deg', '18deg'] }) },
        ],
      },
    };
  }, [tapSpark]);

  const activeCheer = !galleryError && cheerIndex !== null
    ? cheerPool[cheerIndex]
    : null;

  const mascotPose: MascotPose = galleryError
    ? 'oops'
    : activeCheer
      ? activeCheer.pose
      : hasPendingAnalysis
        ? 'thinking'
        : quotaExhausted
          ? 'cheer'
          : isSolve
            ? 'wave'
            : 'point';

  const bubbleTone: SpeechBubbleTone = galleryError
    ? 'roseSoft'
    : activeCheer
      ? activeCheer.tone
      : hasPendingAnalysis
        ? 'limeSoft'
        : quotaExhausted
          ? 'peachSoft'
          : isSolve
            ? 'paper'
            : 'peachSoft';

  const auraTone: SpotlightAuraTone = galleryError ? 'rose' : 'onViolet';

  const greetingTitle = galleryError
    ? 'Hopa! Încearcă alta.'
    : activeCheer
      ? activeCheer.title
      : hasPendingAnalysis
        ? 'Încă lucrez la ea!'
        : quotaExhausted
          ? 'Ai terminat pe azi!'
          : isSolve
            ? solveGreeting(new Date().getHours())
            : 'Hai să verificăm!';

  const isWrittenPending = hasPendingAnalysis && pendingKind === 'written';
  const fullGreetingBody = galleryError
    ?? activeCheer?.body
    ?? (hasPendingAnalysis
      ? (isWrittenPending ? 'Exercițiul scris și progresul sunt păstrate.' : 'Fotografia și progresul sunt păstrate.')
      : quotaExhausted
        ? 'Revin la 00:00. Offline merge mereu.'
        : isSolve
          ? 'Poză sau scrie enunțul — îți explic pas cu pas.'
          : 'Prinde enunțul și pașii tăi — îți verific rezolvarea.');

  const compactGreetingBody = galleryError
    ?? activeCheer?.compactBody
    ?? (hasPendingAnalysis
      ? 'Progresul tău este păstrat.'
      : quotaExhausted
        ? 'Revin la 00:00. Offline e liber.'
        : isSolve
          ? 'Poză sau scrie enunțul.'
          : 'Prinde enunțul și pașii tăi.');

  const greetingBody = compact ? compactGreetingBody : fullGreetingBody;

  const mascotSize = hero.homeMascotSize;
  const spotlightSize = hero.homeSpotlightSize;
  // Curved sky dome matches LaunchSplash's retracting curtain height & arch radius pixel-for-pixel.
  const skyDomeHeight = hero.homeCanopyHeight;
  const isCheckTheme = !isSolve;
  const cornerColor = isCheckTheme ? colors.gold : colors.lime;
  const energyPercent = energyRatio !== null
    ? `${Math.round((energyRatio > 0 ? Math.max(0.08, energyRatio) : 0) * 100)}%` as `${number}%`
    : null;
  const savedCountLabel = savedLessonsCount > 0
    ? `${savedLessonsCount} ${savedLessonsCount === 1 ? 'lecție' : 'lecții'}`
    : null;
  const showTrackSetupBanner = !studyTrackChosen && wrongCount === 0 && !hasPendingAnalysis && Boolean(onChooseStudyTrack || onStudy);
  const trackPillLabel = !studyTrackChosen
    ? 'Alege clasa'
    : studyTrackLabel
      ? (streakDays > 0 && !isVeryNarrow ? `${studyTrackLabel} · ${streakDays}z` : studyTrackLabel)
      : (streakDays > 0 ? `Serie · ${streakDays} ${streakDays === 1 ? 'zi' : 'zile'}` : 'Clasa ta');
  const handleTrackPillPress = onChooseStudyTrack ?? onStudy ?? triggerTutorFromHeader;

  const hardwareEntranceLayer = !ambientReady && !reducedMotion;

  return (
    <View style={styles.safe}>
      <ComicBackdrop />
      <View style={styles.homeScene}>
        <View
          style={[
            styles.page,
            compact && styles.pageCompact,
            { width: contentWidth, paddingTop: insets.top + (compact ? 2 : 4) },
            embedded && { paddingBottom: bottomClearance },
          ]}
        >
          <Enter
            ready={motionReady}
            delay={150}
            duration={300}
            distance={8}
            scaleFrom={0.99}
            preRasterize
            hardwareLayer={hardwareEntranceLayer}
            style={[styles.header, compact && styles.headerCompact]}
          >
            <View style={[styles.brandRow, isVeryNarrow && styles.brandRowNarrow]}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Profu’ de mate"
                pressedScale={0.92}
                haptic="selection"
                onPress={triggerTutorFromHeader}
                contentStyle={[styles.logo, (compact || isVeryNarrow) && styles.logoCompact]}
              >
                <Image
                  accessible={false}
                  source={bundledImageSource(require('../../../../assets/brand/profu_mark_v2.png'))}
                  resizeMode="contain"
                  style={[styles.logoImage, (compact || isVeryNarrow) && styles.logoImageCompact]}
                />
              </PressableScale>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={
                  !studyTrackChosen
                    ? 'Alege clasa sau examenul pentru a personaliza aplicația'
                    : studyTrackLabel
                      ? `Nivel activ: ${studyTrackLabel}. Schimbă nivelul`
                      : 'Deschide nivelul de studiu'
                }
                pressedScale={0.95}
                haptic="selection"
                onPress={handleTrackPillPress}
                style={styles.trackPillWrap}
                contentStyle={[
                  styles.trackPill,
                  !studyTrackChosen && styles.trackPillSetup,
                  (compact || isVeryNarrow) && styles.trackPillCompact,
                ]}
              >
                <View
                  style={[
                    styles.trackPillDot,
                    !studyTrackChosen
                      ? styles.trackPillDotSetup
                      : isCheckTheme && styles.trackPillDotCheck,
                  ]}
                />
                <Text
                  maxFontSizeMultiplier={1.2}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                  style={[
                    styles.trackPillText,
                    !studyTrackChosen && styles.trackPillTextSetup,
                    (compact || isVeryNarrow) && styles.trackPillTextCompact,
                  ]}
                >
                  {trackPillLabel}
                </Text>
                <Text
                  accessible={false}
                  style={[styles.trackPillChevron, !studyTrackChosen && styles.trackPillChevronSetup]}
                >
                  ▾
                </Text>
              </PressableScale>
            </View>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={allowance.accessibilityLabel}
              pressedScale={0.95}
              haptic="selection"
              onPress={onAllowance}
              style={[styles.allowanceWrap, isVeryNarrow && styles.allowanceWrapNarrow]}
              contentStyle={[
                styles.allowancePill,
                (compact || isVeryNarrow) && styles.allowancePillCompact,
                premiumActive && !quotaExhausted && styles.allowancePillPremium,
                quotaExhausted && styles.allowancePillExhausted,
              ]}
            >
              <View pointerEvents="none" style={styles.pillTopGloss} />
              {quotaExhausted ? (
                <ComicClockIcon size={14} color={colors.peachDeep} accent={colors.peach} />
              ) : (
                <MiniGlyph name="spark" size={14} color={colors.violetDeep} />
              )}
              <View style={styles.allowanceCopy}>
                <Text
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                  style={styles.allowanceText}
                >
                  {allowance.label}
                </Text>
                {showPillResetTimer ? (
                  <HomeResetPillNote
                    resetAt={resetAt}
                    exhausted={quotaExhausted}
                    active={focused}
                    fallbackNote={allowance.note}
                  />
                ) : (
                  <Text
                    maxFontSizeMultiplier={1.3}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    style={styles.allowanceNote}
                  >
                    {allowance.note}
                  </Text>
                )}
              </View>
              {energyPercent !== null ? (
                <View pointerEvents="none" style={styles.energyTrack}>
                  <View
                    style={[
                      styles.energyFill,
                      premiumActive && styles.energyFillPremium,
                      quotaExhausted && styles.energyFillEmpty,
                      { width: energyPercent },
                    ]}
                  />
                </View>
              ) : null}
            </PressableScale>

            <IconButton
              label="Deschide setările"
              onPress={onSettings}
              size={compact ? 38 : 42}
              style={[styles.settingsWrap, compact && styles.settingsWrapCompact]}
            >
              <AppIcon name="settings" size={compact ? 25 : 28} />
            </IconButton>
          </Enter>

          <Enter
            ready={motionReady}
            delay={180}
            duration={520}
            distance={18}
            scaleFrom={0.96}
            preRasterize
            hardwareLayer={hardwareEntranceLayer}
            style={[styles.tutorRow, compact && styles.tutorRowCompact]}
          >
            <SpeechBubble
              variant="sky"
              title={greetingTitle}
              body={greetingBody}
              tone={bubbleTone}
              tail="none"
              compact={compact}
              messageKey={`${greetingTitle}:${greetingBody}`}
              onPress={triggerTutorFromHeader}
            />
            <View style={[styles.tutorMascotStage, { width: mascotSize + 4, height: mascotSize + 2 }]}>
              <SpotlightAura size={spotlightSize} tone={auraTone} active={ambientReady} />
              <View pointerEvents="none" style={[styles.mascotFloorGlow, compact && styles.mascotFloorGlowCompact]} />
              <Animated.View pointerEvents="none" style={[styles.tapSpark, styles.tapSparkTop, sparkTopStyle]}>
                <Text accessible={false} style={styles.tapSparkLime}>✦</Text>
              </Animated.View>
              <Animated.View pointerEvents="none" style={[styles.tapSpark, styles.tapSparkRight, sparkRightStyle]}>
                <Text accessible={false} style={styles.tapSparkGold}>✦</Text>
              </Animated.View>
              <Animated.View pointerEvents="none" style={[styles.tapSpark, styles.tapSparkLeft, sparkLeftStyle]}>
                <Text accessible={false} style={styles.tapSparkCyan}>✦</Text>
              </Animated.View>
              <Mascot
                pose={mascotPose}
                size={mascotSize}
                active={ambientReady}
                interactive
                nudgeSignal={mascotNudge}
                onPress={cycleEncouragement}
              />
            </View>
          </Enter>

          <Enter
            ready={motionReady}
            delay={260}
            duration={500}
            distance={16}
            scaleFrom={0.96}
            preRasterize
            hardwareLayer={hardwareEntranceLayer}
            style={styles.modeSwitchEnter}
          >
            <SegmentedToggle
              options={modeOptions}
              value={mode}
              onChange={onMode}
              disabled={pending || galleryBusy}
              dimWhenDisabled={false}
              compact={compact}
              style={styles.modeSwitchFloating}
            />
          </Enter>

          <Enter
            ready={motionReady}
            delay={330}
            duration={540}
            distance={22}
            scaleFrom={0.95}
            preRasterize
            hardwareLayer={hardwareEntranceLayer}
            style={styles.cameraStageEnter}
          >
            <Animated.View
              style={[
                styles.cameraStageShadow,
                isCheckTheme && styles.cameraStageShadowCheck,
                stageAnimated,
              ]}
            >
              <View style={[styles.cameraStage, isCheckTheme && styles.cameraStageCheck, compact && styles.cameraStageCompact]}>
                <StudioCardBackdrop checkTheme={isCheckTheme} />

                {/* Top quiet studio bar: mode indicator + truthful framing hint */}
                <View style={styles.stageHudBar}>
                  <View
                    style={[
                      styles.stageEyebrowPill,
                      hasPendingAnalysis && styles.stageEyebrowPillPending,
                      !hasPendingAnalysis && isCheckTheme && styles.stageEyebrowPillCheck,
                    ]}
                  >
                    <Animated.View style={sparkStyle}>
                      <View
                        style={[
                          styles.stageEyebrowDot,
                          {
                            backgroundColor: hasPendingAnalysis
                              ? colors.limeDeep
                              : isCheckTheme
                                ? '#D92567'
                                : colors.violet,
                          },
                        ]}
                      />
                    </Animated.View>
                    <Text
                      maxFontSizeMultiplier={1.12}
                      numberOfLines={1}
                      style={[
                        styles.stageEyebrowText,
                        hasPendingAnalysis && styles.stageEyebrowPending,
                        !hasPendingAnalysis && isCheckTheme && styles.stageEyebrowCheck,
                      ]}
                    >
                      {hasPendingAnalysis
                        ? 'ANALIZĂ ÎN CURS'
                        : isSolve
                          ? 'REZOLVARE AI'
                          : 'VERIFICARE AI'}
                    </Text>
                  </View>

                  {!isVeryNarrow ? (
                    <Text
                      maxFontSizeMultiplier={1.1}
                      numberOfLines={1}
                      style={[
                        styles.hudScopeHint,
                        isCheckTheme && styles.hudScopeHintCheck,
                        hasPendingAnalysis && styles.hudScopeHintPending,
                      ]}
                    >
                      {hasPendingAnalysis
                        ? 'În fundal'
                        : isSolve
                          ? 'Doar enunțul'
                          : 'Enunț + rezolvare'}
                    </Text>
                  ) : null}
                </View>

                {/* Centered Focal Optical Shutter Portal — spacious, iconic, tappable */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={hasPendingAnalysis ? 'Revino la analiza în curs' : 'Deschide camera din cadru'}
                  disabled={galleryBusy}
                  onPress={onCapture}
                  style={({ pressed }) => [
                    styles.portalStage,
                    compact && styles.portalStageCompact,
                    pressed && styles.portalStagePressed,
                  ]}
                >
                  <View style={[styles.portalFinder, compact && styles.portalFinderCompact]}>
                    <View pointerEvents="none" style={[styles.corner, styles.cornerTL, isCheckTheme && styles.cornerCheck]} />
                    <View pointerEvents="none" style={[styles.corner, styles.cornerTR, isCheckTheme && styles.cornerCheck]} />
                    <View pointerEvents="none" style={[styles.corner, styles.cornerBL, isCheckTheme && styles.cornerCheck]} />
                    <View pointerEvents="none" style={[styles.corner, styles.cornerBR, isCheckTheme && styles.cornerCheck]} />

                    <Animated.View pointerEvents="none" style={[styles.scanBeamWrap, beamStyle]}>
                      <View
                        style={[
                          styles.scanBeamHalo,
                          { backgroundColor: isCheckTheme ? 'rgba(232,62,120,0.22)' : 'rgba(124,60,255,0.22)' },
                        ]}
                      />
                      <View style={[styles.scanBeam, { backgroundColor: isCheckTheme ? '#E83E78' : colors.violet }]} />
                    </Animated.View>

                    <View style={[styles.shutterRingWrap, compact && styles.shutterRingWrapCompact]}>
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.shutterAuraRing,
                          compact && styles.shutterAuraRingCompact,
                          { borderColor: isCheckTheme ? '#FF8A65' : colors.violet },
                          lensHaloStyle,
                        ]}
                      />
                      <View style={[styles.shutterOrb, compact && styles.shutterOrbCompact]}>
                        <LinearGradient
                          colors={['#8E49FF', '#621EEB', '#400EB0']}
                          start={{ x: 0.12, y: 0 }}
                          end={{ x: 0.88, y: 1 }}
                          style={styles.fill}
                        />
                        <Animated.View pointerEvents="none" style={[styles.fill, checkGradientStyle]}>
                          <LinearGradient
                            colors={['#FF7C62', '#E53574', '#AD1455']}
                            start={{ x: 0.12, y: 0 }}
                            end={{ x: 0.88, y: 1 }}
                            style={styles.fill}
                          />
                        </Animated.View>
                        <View pointerEvents="none" style={styles.shutterOrbRim} />
                        <Animated.View pointerEvents="none" style={[styles.shutterIconPlate, compact && styles.shutterIconPlateCompact, medallionAnimated]}>
                          <AppIcon
                            name={isWrittenPending ? 'practice' : isSolve ? 'camera' : 'verify'}
                            size={compact ? 30 : 40}
                          />
                        </Animated.View>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.portalCopy, compact && styles.portalCopyCompact]}>
                    <Text
                      maxFontSizeMultiplier={1.3}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.82}
                      style={[styles.stageTitle, isVeryNarrow && styles.stageTitleNarrow, compact && styles.stageTitleCompact]}
                    >
                      {hasPendingAnalysis
                        ? 'Analiză în curs'
                        : isSolve
                          ? 'Fotografiază enunțul'
                          : 'Enunțul și rezolvarea'}
                    </Text>
                    <Text
                      maxFontSizeMultiplier={1.25}
                      numberOfLines={compact ? 1 : 2}
                      style={[styles.stageNote, compact && styles.stageNoteCompact]}
                    >
                      {hasPendingAnalysis
                        ? (isWrittenPending
                          ? (isSolve ? 'Exercițiul scris se rezolvă în fundal.' : 'Rezolvarea scrisă se verifică în fundal.')
                          : (isSolve ? 'Fotografia ta se analizează în fundal.' : 'Rezolvarea fotografiată se verifică în fundal.'))
                        : isSolve
                          ? 'Încadrezi enunțul clar și primești rezolvarea pas cu pas.'
                          : 'Prinde atât problema, cât și pașii tăi, să îi verific.'}
                    </Text>
                  </View>
                </Pressable>

                {/* Unified Bottom Studio Controls: Primary Shutter Pill + Integrated Tonal Galerie|Scrie Tray */}
                <View style={[styles.monolithControls, compact && styles.monolithControlsCompact]}>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={
                      hasPendingAnalysis
                        ? 'Revino la analiza în curs'
                        : isSolve
                          ? 'Fotografiază o problemă de rezolvat'
                          : 'Fotografiază o rezolvare de verificat'
                    }
                    disabled={galleryBusy}
                    dimWhenDisabled={false}
                    pressedScale={0.975}
                    haptic="medium"
                    onPress={onCapture}
                    contentStyle={[
                      styles.captureCta,
                      compact && styles.captureCtaCompact,
                    ]}
                  >
                    <LinearGradient
                      colors={isCheckTheme ? ['#FF7A63', '#E43573', '#B4165B'] : ['#8B47FF', '#621EEB', '#4310B4']}
                      start={{ x: 0.06, y: 0 }}
                      end={{ x: 0.94, y: 1 }}
                      style={styles.fill}
                    />
                    <View pointerEvents="none" style={styles.ctaTopGloss} />
                    <Animated.View pointerEvents="none" style={[styles.ctaSweep, ctaSheenStyle]} />
                    <View style={[styles.ctaAccentDot, { backgroundColor: cornerColor }]} />
                    <Text
                      maxFontSizeMultiplier={1.3}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.84}
                      style={[styles.captureCtaText, compact && styles.captureCtaTextCompact]}
                    >
                      {hasPendingAnalysis ? 'Revino la analiză' : 'Deschide camera'}
                    </Text>
                    <Animated.View
                      style={[
                        styles.captureArrow,
                        compact && styles.captureArrowCompact,
                        { backgroundColor: cornerColor },
                        arrowStyle,
                      ]}
                    >
                      <MiniGlyph name="next" size={compact ? 14 : 16} color={colors.ink} />
                    </Animated.View>
                  </PressableScale>

                  {hasPendingAnalysis ? (
                    <View style={[styles.inputSplitTray, isCheckTheme && styles.inputSplitTrayCheck, compact && styles.inputSplitTrayCompact]}>
                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel="Anulează analiza în curs și începe altă problemă"
                        disabled={galleryBusy}
                        dimWhenDisabled={false}
                        pressedScale={0.97}
                        haptic="light"
                        onPress={onDiscardPending}
                        style={styles.splitSlotWrap}
                        contentStyle={[styles.splitSlot, compact && styles.splitSlotCompact]}
                      >
                        <View style={[styles.splitIconWrap, styles.splitIconDiscard, compact && styles.splitIconWrapCompact]}>
                          <MiniGlyph name="close" size={compact ? 14 : 16} color={colors.berryDeep} />
                        </View>
                        <View style={styles.splitCopy}>
                          <Text maxFontSizeMultiplier={1.25} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.splitTitle, styles.discardTitle, compact && styles.splitTitleCompact]}>
                            Anulează
                          </Text>
                          {!compact ? (
                            <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.splitNote}>
                              Începe alta
                            </Text>
                          ) : null}
                        </View>
                      </PressableScale>

                      <View style={[styles.splitDivider, isCheckTheme && styles.splitDividerCheck]} />

                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel={savedCountLabel ? `Deschide caietul cu ${savedCountLabel} salvate` : 'Deschide caietul cu lecții salvate'}
                        disabled={galleryBusy}
                        dimWhenDisabled={false}
                        pressedScale={0.97}
                        haptic="light"
                        onPress={onNotebook}
                        style={styles.splitSlotWrap}
                        contentStyle={[styles.splitSlot, compact && styles.splitSlotCompact]}
                      >
                        <View style={[styles.splitIconWrap, compact && styles.splitIconWrapCompact]}>
                          <AppIcon name="notebook" size={compact ? 21 : 25} />
                        </View>
                        <View style={styles.splitCopy}>
                          <Text maxFontSizeMultiplier={1.25} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.splitTitle, compact && styles.splitTitleCompact]}>
                            Caiet
                          </Text>
                          {!compact ? (
                            <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.splitNote}>
                              {savedCountLabel ?? 'Lecții salvate'}
                            </Text>
                          ) : null}
                        </View>
                      </PressableScale>
                    </View>
                  ) : (
                    <View style={[styles.inputSplitTray, isCheckTheme && styles.inputSplitTrayCheck, compact && styles.inputSplitTrayCompact]}>
                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel="Alege o fotografie din galerie"
                        accessibilityState={{ disabled: galleryBusy, busy: galleryBusy }}
                        disabled={galleryBusy}
                        dimWhenDisabled={false}
                        pressedScale={0.97}
                        haptic="light"
                        onPress={onGallery}
                        style={styles.splitSlotWrap}
                        contentStyle={[styles.splitSlot, compact && styles.splitSlotCompact]}
                      >
                        <View style={[styles.splitIconWrap, compact && styles.splitIconWrapCompact]}>
                          {galleryBusy ? (
                            <PlayfulLoader micro />
                          ) : (
                            <AppIcon name="gallery" size={compact ? 22 : 26} />
                          )}
                        </View>
                        <View style={styles.splitCopy}>
                          <Text maxFontSizeMultiplier={1.25} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.splitTitle, compact && styles.splitTitleCompact]}>
                            Galerie
                          </Text>
                          {!compact ? (
                            <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.splitNote}>
                              {isSolve ? 'Poză cu enunțul' : 'Enunț + pașii tăi'}
                            </Text>
                          ) : null}
                        </View>
                      </PressableScale>

                      <View style={[styles.splitDivider, isCheckTheme && styles.splitDividerCheck]} />

                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel="Scrie o problemă sau o rezolvare"
                        accessibilityState={{ disabled: galleryBusy }}
                        disabled={galleryBusy}
                        dimWhenDisabled={false}
                        pressedScale={0.97}
                        haptic="light"
                        onPress={onMath}
                        style={styles.splitSlotWrap}
                        contentStyle={[styles.splitSlot, compact && styles.splitSlotCompact]}
                      >
                        <View style={[styles.splitIconWrap, compact && styles.splitIconWrapCompact]}>
                          <AppIcon name="practice" size={compact ? 22 : 26} />
                        </View>
                        <View style={styles.splitCopy}>
                          <Text maxFontSizeMultiplier={1.25} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.splitTitle, compact && styles.splitTitleCompact]}>
                            Scrie
                          </Text>
                          {!compact ? (
                            <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.splitNote}>
                              {isSolve ? 'Scrie enunțul' : 'Enunț + soluția ta'}
                            </Text>
                          ) : null}
                        </View>
                      </PressableScale>
                    </View>
                  )}
                </View>
              </View>
            </Animated.View>
          </Enter>

          {/* Sleek Velvet-Indigo Daily Practice Strip harmonizing with the bottom dock */}
          <View style={[styles.bottomStripWrap, compact && styles.bottomStripWrapCompact]}>
            {embedded && (onQuickPractice || showTrackSetupBanner) ? (
              <Enter
                ready={motionReady}
                delay={430}
                duration={500}
                distance={14}
                scaleFrom={0.97}
                preRasterize
                hardwareLayer={hardwareEntranceLayer}
              >
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={
                    showTrackSetupBanner
                      ? 'Alege nivelul de studiu pentru a personaliza aplicația'
                      : wrongCount > 0
                        ? (wrongCount === 1 ? 'Reia exercițiul greșit' : `Reia cele ${wrongCount} exerciții greșite`)
                        : 'Începe un antrenament fulger de 5 minute'
                  }
                  accessibilityState={{ disabled: galleryBusy }}
                  disabled={galleryBusy}
                  dimWhenDisabled={false}
                  pressedScale={0.975}
                  haptic="medium"
                  onPress={showTrackSetupBanner ? (onChooseStudyTrack ?? onStudy) : onQuickPractice}
                  contentStyle={[
                    styles.velvetStrip,
                    showTrackSetupBanner
                      ? styles.velvetStripSetup
                      : wrongCount > 0 && styles.velvetStripMistakes,
                    compact && styles.velvetStripCompact,
                  ]}
                >
                  <LinearGradient
                    pointerEvents="none"
                    colors={
                      showTrackSetupBanner
                        ? ['#391B88', '#250F64', '#180846']
                        : wrongCount > 0
                          ? ['#64133D', '#430B2D', '#29061D']
                          : ['#2E1478', '#1D0B54', '#13063A']
                    }
                    start={{ x: 0.05, y: 0 }}
                    end={{ x: 0.95, y: 1 }}
                    style={styles.fill}
                  />
                  <View pointerEvents="none" style={styles.velvetTopRim} />
                  <View
                    style={[
                      styles.velvetIconOrb,
                      compact && styles.velvetIconOrbCompact,
                    ]}
                  >
                    <AppIcon name={showTrackSetupBanner ? 'class' : wrongCount > 0 ? 'retake' : 'streak'} size={compact ? 22 : 28} />
                  </View>
                  <View style={styles.velvetCopy}>
                    <View style={styles.velvetTitleRow}>
                      <Text
                        maxFontSizeMultiplier={1.25}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.84}
                        style={[styles.velvetTitle, compact && styles.velvetTitleCompact]}
                      >
                        {showTrackSetupBanner
                          ? 'Alege clasa'
                          : wrongCount > 0
                            ? 'Repetă greșelile'
                            : 'Antrenament fulger'}
                      </Text>
                      {showTrackSetupBanner ? (
                        <View collapsable={false} style={styles.velvetPillGold}>
                          <Text maxFontSizeMultiplier={1.05} style={styles.velvetPillDarkText}>
                            Începe
                          </Text>
                        </View>
                      ) : wrongCount > 0 ? (
                        <View collapsable={false} style={styles.velvetPillCoral}>
                          <Text maxFontSizeMultiplier={1.05} style={styles.velvetPillLightText}>
                            {wrongCount}
                          </Text>
                        </View>
                      ) : (
                        <View collapsable={false} style={styles.velvetPillLime}>
                          <Text maxFontSizeMultiplier={1.05} style={styles.velvetPillDarkText}>
                            {streakDays > 0 ? `${streakDays} ${streakDays === 1 ? 'zi' : 'zile'}` : '5 min'}
                          </Text>
                        </View>
                      )}
                    </View>
                    {!compact ? (
                      <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.velvetNote}>
                        {showTrackSetupBanner
                          ? 'Formule, teste și simulări pe nivelul tău'
                          : wrongCount > 0
                            ? 'Reia rapid exercițiile greșite la practică'
                            : '5 întrebări · offline'}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.velvetActionOrb,
                      showTrackSetupBanner
                        ? styles.velvetActionGold
                        : wrongCount > 0 && styles.velvetActionCoral,
                      compact && styles.velvetActionOrbCompact,
                    ]}
                  >
                    <MiniGlyph
                      name="next"
                      size={compact ? 13 : 15}
                      color={wrongCount > 0 ? colors.paper : colors.ink}
                    />
                  </View>
                </PressableScale>
              </Enter>
            ) : null}

            {!embedded ? (
              <Enter ready={motionReady} delay={250} distance={12} scaleFrom={0.97} style={styles.notebookGroup}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={savedCountLabel ? `Deschide caietul cu ${savedCountLabel} salvate` : 'Deschide caietul cu lecții salvate'}
                  pressedScale={0.975}
                  haptic="selection"
                  onPress={onNotebook}
                  contentStyle={[styles.velvetStrip, compact && styles.velvetStripCompact]}
                >
                  <LinearGradient
                    pointerEvents="none"
                    colors={['#2E1478', '#1D0B54', '#13063A']}
                    start={{ x: 0.05, y: 0 }}
                    end={{ x: 0.95, y: 1 }}
                    style={styles.fill}
                  />
                  <View pointerEvents="none" style={styles.velvetTopRim} />
                  <View style={[styles.velvetIconOrb, compact && styles.velvetIconOrbCompact]}>
                    <AppIcon name="notebook" size={compact ? 22 : 28} />
                  </View>
                  <View style={styles.velvetCopy}>
                    <View style={styles.velvetTitleRow}>
                      <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={[styles.velvetTitle, compact && styles.velvetTitleCompact]}>
                        Caietul meu
                      </Text>
                      {savedCountLabel ? (
                        <View collapsable={false} style={styles.velvetPillLime}>
                          <Text maxFontSizeMultiplier={1.05} style={styles.velvetPillDarkText}>{savedCountLabel}</Text>
                        </View>
                      ) : null}
                    </View>
                    {!compact ? (
                      <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.velvetNote}>
                        {latestLessonTitle ? latestLessonTitle : 'Lecțiile tale salvate, disponibile și offline'}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.velvetActionOrb, compact && styles.velvetActionOrbCompact]}>
                    <MiniGlyph name="next" size={compact ? 13 : 15} color={colors.ink} />
                  </View>
                </PressableScale>

                {showGuide && !compact && !hasPendingAnalysis ? (
                  <View
                    accessible
                    accessibilityLabel="Cum funcționează: fotografiezi, înțelegi și salvezi lecția"
                    style={styles.guidePill}
                  >
                    <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.guideText}>
                      ✦  Fotografiezi  →  Înțelegi  →  Salvezi
                    </Text>
                    {onDismissGuide ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Ascunde ghidul"
                        hitSlop={10}
                        onPress={onDismissGuide}
                        style={styles.guideDismiss}
                      >
                        <MiniGlyph name="close" size={14} color={colors.violetDeep} />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </Enter>
            ) : null}
          </View>
        </View>
      </View>

      {/* Full-bleed curved Royal-Violet / Coral-Berry hero canopy unified with LaunchSplash & Onboarding */}
      <Animated.View
        pointerEvents="none"
        renderToHardwareTextureAndroid={hardwareEntranceLayer}
        style={[
          styles.skyDome,
          {
            height: skyDomeHeight,
            borderBottomLeftRadius: hero.canopyRadius,
            borderBottomRightRadius: hero.canopyRadius,
          },
          skyDomeAnimatedStyle,
        ]}
      >
        <LinearGradient
          colors={ROYAL_HERO_GRADIENT}
          start={{ x: 0.08, y: 0 }}
          end={{ x: 0.92, y: 1 }}
          style={styles.fill}
        />
        <Animated.View style={[styles.fill, checkGradientStyle]}>
          <LinearGradient
            colors={['#FF8764', '#EE457C', '#C42064', '#94144F']}
            start={{ x: 0.08, y: 0 }}
            end={{ x: 0.92, y: 1 }}
            style={styles.fill}
          />
        </Animated.View>
        <RoyalHeroCanopyBackdrop
          width={hero.width}
          height={skyDomeHeight}
          showGradient={false}
        />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  safe: { flex: 1, overflow: 'hidden', backgroundColor: colors.canvas },
  homeScene: { flex: 1, overflow: 'hidden', zIndex: 2 },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  behind: { zIndex: 0 },
  page: { flex: 1, minHeight: 0, maxWidth: 560, alignSelf: 'center', gap: 10, paddingTop: 4, paddingBottom: 8 },
  pageCompact: { gap: 6, paddingTop: 2 },

  // Full-bleed curved sky dome canopy (smooth gradient arch matching LaunchSplash curtain)
  skyDome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    overflow: 'hidden',
  },

  // Brand top bar floating over curved sky dome
  header: { height: 58, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCompact: { height: 44 },
  brandRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandRowNarrow: { gap: 6 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: colors.lime,
    borderBottomWidth: 3.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoCompact: { width: 35, height: 35, borderRadius: 17.5, borderWidth: 2, borderBottomWidth: 2.5 },
  logoImage: { width: 35, height: 35 },
  logoImageCompact: { width: 28, height: 28 },
  trackPillWrap: { flexShrink: 1, minWidth: 0 },
  trackPill: {
    height: 36,
    borderRadius: radii.pill,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
  },
  trackPillSetup: {
    backgroundColor: 'rgba(255, 212, 71, 0.22)',
    borderColor: 'rgba(255, 224, 112, 0.56)',
  },
  trackPillCompact: {
    height: 32,
    paddingHorizontal: 9,
    gap: 5,
  },
  trackPillDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.lime,
    flexShrink: 0,
  },
  trackPillDotCheck: {
    backgroundColor: '#FFE169',
  },
  trackPillDotSetup: {
    backgroundColor: '#FFD84D',
  },
  trackPillText: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 12.5,
    lineHeight: 15,
    letterSpacing: -0.1,
    includeFontPadding: false,
  },
  trackPillTextSetup: {
    color: '#FFF6D1',
  },
  trackPillTextCompact: {
    fontSize: 11,
    lineHeight: 13.5,
  },
  trackPillChevron: {
    fontFamily: fonts.bodyBold,
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 11,
    lineHeight: 13,
    includeFontPadding: false,
    flexShrink: 0,
  },
  trackPillChevronSetup: {
    color: '#FFE37A',
  },

  allowanceWrap: { marginLeft: 8 },
  allowanceWrapNarrow: { marginLeft: 6 },
  allowancePill: {
    minWidth: 100,
    maxWidth: 134,
    height: 42,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#FFFFFF',
    borderBottomColor: '#D6C4FA',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingBottom: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  allowancePillCompact: { minWidth: 90, height: 36, paddingHorizontal: 9 },
  allowancePillPremium: { backgroundColor: '#F4FFE0', borderColor: '#E5FFAD', borderBottomColor: '#A9D632' },
  allowancePillExhausted: { backgroundColor: '#FFF2EC', borderColor: '#FFD9CB', borderBottomColor: '#EE9E84' },
  pillTopGloss: {
    position: 'absolute',
    top: 1,
    left: 14,
    right: 14,
    height: 1.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  energyTrack: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 2,
    height: 3,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(124, 60, 255, 0.13)',
    overflow: 'hidden',
  },
  energyFill: {
    height: '100%',
    backgroundColor: colors.violet,
    borderRadius: radii.pill,
  },
  energyFillPremium: { backgroundColor: colors.limeDeep },
  energyFillEmpty: { backgroundColor: colors.peach },
  allowanceCopy: { flexShrink: 1, minWidth: 0, alignItems: 'flex-start' },
  allowanceText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11.5, lineHeight: 13.5, includeFontPadding: false },
  allowanceNote: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 9.5, letterSpacing: 0.4, lineHeight: 11.5, includeFontPadding: false },
  settingsWrap: {
    marginLeft: 8,
    borderRadius: 21,
    borderBottomWidth: 3.5,
    borderBottomColor: '#D6C4FA',
    backgroundColor: '#FFFFFF',
  },
  settingsWrapCompact: {
    borderRadius: 19,
    borderBottomWidth: 3,
  },

  // Hero owl + borderless luminous message row inside the sky dome
  tutorRow: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tutorRowCompact: { gap: 4 },
  tutorMascotStage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  mascotFloorGlow: {
    position: 'absolute',
    bottom: 2,
    width: 66,
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(20, 4, 64, 0.24)',
  },
  mascotFloorGlowCompact: { width: 44, height: 8 },
  tapSpark: { position: 'absolute', zIndex: 8 },
  tapSparkTop: { top: 8, left: '42%' },
  tapSparkRight: { top: 18, right: 6 },
  tapSparkLeft: { bottom: 26, left: 6 },
  tapSparkLime: { fontFamily: fonts.display, fontSize: 17, color: colors.lime },
  tapSparkGold: { fontFamily: fonts.display, fontSize: 15, color: colors.gold },
  tapSparkCyan: { fontFamily: fonts.display, fontSize: 14, color: colors.cyan },

  // Solid white 3D mode switcher straddling the smooth curved sky arch
  modeSwitchEnter: { zIndex: 4 },
  modeSwitchFloating: {
    borderRadius: radii.pill,
  },

  // Unified Luminous Ceramic-White Capture Studio Monolith
  cameraStageEnter: { flex: 1, minHeight: 0, width: '100%', zIndex: 3 },
  cameraStageShadow: { flex: 1, minHeight: 0, width: '100%', borderRadius: 30, shadowColor: '#3E14B2', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.11, shadowRadius: 24 },
  cameraStageShadowCheck: { shadowColor: '#A81C54' },
  cameraStage: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EAE1FB',
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
    padding: 15,
    position: 'relative',
  },
  cameraStageCheck: {
    borderColor: '#F8D4E0',
  },
  cameraStageCompact: { padding: 10 },
  stageHudBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 2,
  },
  stageEyebrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: '#F3ECFF',
  },
  stageEyebrowPillCheck: {
    backgroundColor: '#FFEFF4',
  },
  stageEyebrowPillPending: {
    backgroundColor: '#ECFFD6',
  },
  stageEyebrowDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
  },
  stageEyebrowText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 0.85,
    color: colors.violetDeep,
    includeFontPadding: false,
  },
  stageEyebrowCheck: {
    color: '#B01955',
  },
  stageEyebrowPending: {
    color: colors.limeDeep,
  },
  hudScopeHint: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    color: colors.inkSoft,
    includeFontPadding: false,
  },
  hudScopeHintCheck: {
    color: '#A52458',
  },
  hudScopeHintPending: {
    color: colors.limeDeep,
  },

  // Spacious centered Optical Shutter Portal
  portalStage: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 10,
    zIndex: 2,
  },
  portalStageCompact: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 12,
    paddingHorizontal: 4,
  },
  portalStagePressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  portalFinder: {
    width: 148,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  portalFinderCompact: {
    width: 78,
    height: 70,
    flexShrink: 0,
  },
  corner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: 'rgba(115, 44, 244, 0.34)',
    zIndex: 2,
  },
  cornerCheck: {
    borderColor: 'rgba(229, 53, 116, 0.36)',
  },
  cornerTL: { top: 2, left: 4, borderTopWidth: 2.2, borderLeftWidth: 2.2, borderTopLeftRadius: 7 },
  cornerTR: { top: 2, right: 4, borderTopWidth: 2.2, borderRightWidth: 2.2, borderTopRightRadius: 7 },
  cornerBL: { bottom: 2, left: 4, borderBottomWidth: 2.2, borderLeftWidth: 2.2, borderBottomLeftRadius: 7 },
  cornerBR: { bottom: 2, right: 4, borderBottomWidth: 2.2, borderRightWidth: 2.2, borderBottomRightRadius: 7 },
  scanBeamWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 12,
    justifyContent: 'center',
    zIndex: 1,
  },
  scanBeamHalo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 6,
  },
  scanBeam: { width: '100%', height: 2, borderRadius: 2, opacity: 0.72 },
  shutterRingWrap: {
    width: 82,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 3,
  },
  shutterRingWrapCompact: {
    width: 58,
    height: 58,
  },
  shutterAuraRing: {
    position: 'absolute',
    top: -7,
    right: -7,
    bottom: -7,
    left: -7,
    borderRadius: 48,
    borderWidth: 2,
  },
  shutterAuraRingCompact: {
    top: -4,
    right: -4,
    bottom: -4,
    left: -4,
    borderRadius: 34,
  },
  shutterOrb: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#4813C4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
  },
  shutterOrbCompact: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  shutterOrbRim: {
    position: 'absolute',
    top: 2,
    left: 16,
    right: 16,
    height: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  shutterIconPlate: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterIconPlateCompact: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  portalCopy: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  portalCopyCompact: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
    paddingHorizontal: 0,
  },
  stageTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 22,
    lineHeight: 25,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  stageTitleNarrow: { fontSize: 19.5, lineHeight: 22.5 },
  stageTitleCompact: { fontSize: 17, lineHeight: 20, textAlign: 'left' },
  stageNote: {
    marginTop: 3,
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 12.5,
    lineHeight: 16.5,
    textAlign: 'center',
  },
  stageNoteCompact: { marginTop: 2, fontSize: 11.5, lineHeight: 15, textAlign: 'left' },

  // Integrated Capture CTA + Tonal Split Input Tray inside the Ceramic Monolith
  monolithControls: {
    gap: 8,
    zIndex: 3,
  },
  monolithControlsCompact: {
    gap: 6,
  },
  captureCta: {
    height: 50,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  captureCtaCompact: { height: 42, paddingLeft: 14, paddingRight: 6, gap: 8 },
  ctaTopGloss: {
    position: 'absolute',
    top: 1,
    left: 24,
    right: 24,
    height: 1.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
    zIndex: 1,
  },
  ctaSweep: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    width: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 1,
  },
  ctaAccentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 2,
  },
  captureCtaText: { flex: 1, fontFamily: fonts.display, color: colors.paper, fontSize: 18, lineHeight: 21, zIndex: 2 },
  captureCtaTextCompact: { fontSize: 15.5, lineHeight: 18.5 },
  captureArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  captureArrowCompact: { width: 28, height: 28, borderRadius: 14 },

  // Unified Whisper-Soft Tonal Tray for Galerie | Scrie (zero clashing bricks)
  inputSplitTray: {
    height: 52,
    borderRadius: 18,
    backgroundColor: '#F6F2FF',
    borderWidth: 1,
    borderColor: '#EAE1FC',
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  inputSplitTrayCheck: {
    backgroundColor: '#FFF3F6',
    borderColor: '#FADCE5',
  },
  inputSplitTrayCompact: {
    height: 40,
    borderRadius: 14,
  },
  splitSlotWrap: { flex: 1, minWidth: 0 },
  splitSlot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  splitSlotCompact: {
    paddingHorizontal: 8,
    gap: 6,
  },
  splitIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  splitIconWrapCompact: {
    width: 26,
    height: 26,
    borderRadius: 9,
  },
  splitIconDiscard: {
    backgroundColor: '#FFE8E4',
  },
  splitCopy: { flexShrink: 1, minWidth: 0, alignItems: 'flex-start' },
  splitTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 15.5, lineHeight: 18.5, letterSpacing: -0.2 },
  splitTitleCompact: { fontSize: 13.5, lineHeight: 16.5 },
  discardTitle: { color: colors.berryDeep },
  splitNote: { marginTop: 0.5, fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 10.5, lineHeight: 13 },
  splitDivider: {
    width: 1,
    marginVertical: 10,
    backgroundColor: 'rgba(104, 54, 224, 0.14)',
  },
  splitDividerCheck: {
    backgroundColor: 'rgba(208, 36, 98, 0.16)',
  },

  // Sleek Deep Velvet-Indigo Daily Practice Strip matching the bottom dock
  bottomStripWrap: { flexShrink: 0, zIndex: 3 },
  bottomStripWrapCompact: {},
  velvetStrip: {
    height: 68,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(182, 148, 255, 0.3)',
    backgroundColor: '#1C0A50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 11,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#22086E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  velvetStripSetup: {
    borderColor: 'rgba(255, 220, 104, 0.42)',
  },
  velvetStripMistakes: {
    borderColor: 'rgba(255, 146, 174, 0.38)',
  },
  velvetStripCompact: {
    height: 52,
    borderRadius: 18,
    paddingHorizontal: 10,
    gap: 9,
  },
  velvetTopRim: {
    position: 'absolute',
    top: 1,
    left: 24,
    right: 24,
    height: 1.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
    zIndex: 1,
  },
  velvetIconOrb: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    zIndex: 2,
  },
  velvetIconOrbCompact: {
    width: 34,
    height: 34,
    borderRadius: 12,
  },
  velvetCopy: { flex: 1, minWidth: 0, zIndex: 2 },
  velvetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  velvetTitle: {
    flexShrink: 1,
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 16.5,
    lineHeight: 19.5,
    letterSpacing: -0.2,
  },
  velvetTitleCompact: { fontSize: 14.5, lineHeight: 17.5 },
  velvetNote: {
    marginTop: 1.5,
    fontFamily: fonts.bodyMedium,
    color: 'rgba(232, 224, 255, 0.8)',
    fontSize: 11.5,
    lineHeight: 14.5,
  },
  velvetPillLime: {
    height: 19,
    paddingHorizontal: 7.5,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  velvetPillGold: {
    height: 19,
    paddingHorizontal: 7.5,
    borderRadius: radii.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  velvetPillCoral: {
    minWidth: 20,
    height: 19,
    paddingHorizontal: 6.5,
    borderRadius: radii.pill,
    backgroundColor: '#FF5D8F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  velvetPillDarkText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 10,
    lineHeight: 12,
    includeFontPadding: false,
  },
  velvetPillLightText: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 10,
    lineHeight: 12,
    includeFontPadding: false,
  },
  velvetActionOrb: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    zIndex: 2,
  },
  velvetActionGold: { backgroundColor: colors.gold },
  velvetActionCoral: { backgroundColor: '#FF5D8F' },
  velvetActionOrbCompact: { width: 26, height: 26, borderRadius: 13 },

  notebookGroup: { gap: 7 },
  guidePill: {
    minHeight: 34,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#E4D8FA',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 5,
    gap: 8,
  },
  guideText: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 11.5,
    lineHeight: 15,
    textAlign: 'center',
  },
  guideDismiss: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F2EAFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
