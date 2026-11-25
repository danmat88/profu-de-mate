import { LinearGradient } from 'expo-linear-gradient';
import { memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
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
  streakDays?: number;
  wrongCount?: number;
  showGuide?: boolean;
  embedded?: boolean;
  bottomClearance?: number;
  onDismissGuide?: () => void;
  onClearGalleryError?: () => void;
  onMode: (mode: FlowMode) => void;
  onCapture: () => void;
  onGallery: () => void;
  onMath: () => void;
  onNotebook: () => void;
  onStudy?: () => void;
  onQuickPractice?: () => void;
  onSettings: () => void;
  onAllowance: () => void;
};

const modeOptions: readonly [SegmentedOption<FlowMode>, SegmentedOption<FlowMode>] = [
  {
    value: 'solve',
    label: 'Rezolvă',
    icon: 'camera',
    activeFill: colors.violet,
    activeText: colors.paper,
    dotFill: colors.lime,
    dotText: colors.ink,
  },
  {
    value: 'check',
    label: 'Verifică',
    icon: 'verify',
    activeFill: colors.peach,
    activeText: colors.ink,
    dotFill: colors.ink,
    dotText: colors.paper,
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
  { title: 'E mai simplu decât pare!', body: 'Fă o poză sau scrie formula direct.', compactBody: 'Fă o poză sau scrie direct.', pose: 'point', tone: 'limeSoft' },
  { title: 'Sunt aici cu tine!', body: 'Îți explic pe înțeles, fără grabă.', compactBody: 'Îți explic simplu, fără grabă.', pose: 'wave', tone: 'paper' },
  { title: 'Nivel de campion!', body: 'Un exercițiu pe zi face diferența.', compactBody: 'Un exercițiu pe zi contează.', pose: 'cheer', tone: 'limeSoft' },
];

const CHECK_CHEER_MESSAGES: readonly TutorMessage[] = [
  { title: 'Bravo că încerci întâi!', body: 'Așa înveți cel mai repede la mate.', compactBody: 'Așa înveți cel mai repede.', pose: 'cheer', tone: 'limeSoft' },
  { title: 'Verificăm fără stres!', body: 'Îți arăt ce e bine și ce corectezi.', compactBody: 'Vezi ce e bine și ce corectezi.', pose: 'point', tone: 'peachSoft' },
  { title: 'Fiecare pas contează!', body: 'Prinde enunțul și pașii tăi în cadru.', compactBody: 'Prinde enunțul și pașii tăi.', pose: 'wave', tone: 'peachSoft' },
];

const EXHAUSTED_FREE_MESSAGES: readonly TutorMessage[] = [
  { title: 'Super treabă azi!', body: 'Problemele revin automat la 00:00.', compactBody: 'Revin automat la 00:00.', pose: 'wave', tone: 'peachSoft' },
  { title: 'Caietul e mereu liber!', body: 'Recitește lecțiile salvate și offline.', compactBody: 'Lecțiile tale merg și offline.', pose: 'point', tone: 'limeSoft' },
  { title: 'Vrei mai multă practică?', body: 'Atinge cronometrul pentru Premium.', compactBody: 'Atinge sus pentru Premium.', pose: 'cheer', tone: 'violetSoft' },
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
  streakDays = 0,
  wrongCount = 0,
  showGuide = false,
  embedded = false,
  bottomClearance = 8,
  onDismissGuide,
  onClearGalleryError,
  onMode,
  onCapture,
  onGallery,
  onMath,
  onNotebook,
  onStudy,
  onQuickPractice,
  onSettings,
  onAllowance,
}: Props) {
  const frame = useSafeAreaFrame();
  const { contentWidth, height, fontScale, isVeryNarrow } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const compact = height - insets.top < 690 || fontScale >= 1.3;
  const reducedMotion = useReducedMotion();
  const motionReady = useContext(HomeMotionReadyContext);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [cheer, setCheer] = useState<{ index: number; scope: string } | null>(null);
  const [mascotNudge, setMascotNudge] = useState(0);
  const cheerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousMode = useRef(mode);

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

  const stagePop = useRef(new Animated.Value(1)).current;
  const medallionPop = useRef(new Animated.Value(1)).current;
  const modeBlend = useRef(new Animated.Value(isSolve || hasPendingAnalysis ? 0 : 1)).current;
  const beamProgress = useRef(new Animated.Value(0)).current;
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

  // Ambient studio loops execute via pure single-timing native _startNativeLoop(-1)
  // on Android RenderThread with zero JS callbacks, pausing cleanly when unfocused.
  useEffect(() => {
    if (!motionActive) {
      beamProgress.stopAnimation();
      sparkPulse.stopAnimation();
      arrowNudge.stopAnimation();
      ctaSheen.stopAnimation();
      return undefined;
    }

    const loops: Animated.CompositeAnimation[] = [];
    const startNativeLoop = (value: Animated.Value, duration: number) => {
      const loop = createNativeLoop(value, duration);
      loops.push(loop);
      loop.start();
    };

    const startTimer = setTimeout(() => {
      if (hasPendingAnalysis) {
        beamProgress.stopAnimation();
        sparkPulse.stopAnimation();
        arrowNudge.stopAnimation();
        ctaSheen.stopAnimation();
        beamProgress.setValue(0.25);
        sparkPulse.setValue(0);
        arrowNudge.setValue(0);
        ctaSheen.setValue(0);
        return;
      }
      startNativeLoop(beamProgress, 3_400);
      startNativeLoop(sparkPulse, 2_800);
      startNativeLoop(arrowNudge, 1_900);
      startNativeLoop(ctaSheen, 3_600);
    }, 240);

    return () => {
      clearTimeout(startTimer);
      loops.forEach((loop) => loop.stop());
      beamProgress.stopAnimation();
      sparkPulse.stopAnimation();
      arrowNudge.stopAnimation();
      ctaSheen.stopAnimation();
    };
  }, [arrowNudge, beamProgress, ctaSheen, hasPendingAnalysis, motionActive, sparkPulse]);

  useEffect(() => {
    const targetBlend = isSolve || hasPendingAnalysis ? 0 : 1;
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
    opacity: hasPendingAnalysis ? 0 : 0.96,
    transform: [{ translateY: beamTranslateY }],
  }), [beamTranslateY, hasPendingAnalysis]);

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

  const fullGreetingBody = galleryError
    ?? activeCheer?.body
    ?? (hasPendingAnalysis
      ? 'Fotografia și progresul sunt păstrate.'
      : quotaExhausted
        ? 'Revin la 00:00. Între timp vezi Caietul.'
        : isSolve
          ? 'Fă o poză sau scrie problema, pas cu pas.'
          : 'Arată-mi rezolvarea ta, pas cu pas.');

  const compactGreetingBody = galleryError
    ?? activeCheer?.compactBody
    ?? (hasPendingAnalysis
      ? 'Progresul tău este păstrat.'
      : quotaExhausted
        ? 'Revin la 00:00. Vezi Caietul.'
        : isSolve
          ? 'Fă o poză sau scrie formula.'
          : 'Arată-mi rezolvarea ta.');

  const greetingBody = compact ? compactGreetingBody : fullGreetingBody;

  const mascotSize = compact ? 68 : isVeryNarrow ? 92 : 102;
  const spotlightSize = compact ? 66 : isVeryNarrow ? 90 : 100;
  // Curved sky dome extends seamlessly behind the StatusBar down to the vertical midpoint of SegmentedToggle.
  const skyDomeHeight = insets.top + (compact ? 83 : 110) + mascotSize;
  const cornerColor = isSolve || hasPendingAnalysis ? colors.lime : colors.gold;
  const isCheckTheme = !isSolve && !hasPendingAnalysis;
  const energyPercent = energyRatio !== null
    ? `${Math.round((energyRatio > 0 ? Math.max(0.08, energyRatio) : 0) * 100)}%` as `${number}%`
    : null;
  const savedCountLabel = savedLessonsCount > 0
    ? `${savedLessonsCount} ${savedLessonsCount === 1 ? 'lecție' : 'lecții'}`
    : null;

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
          <Enter ready={motionReady} delay={20} distance={10} scaleFrom={0.98} style={[styles.header, compact && styles.headerCompact]}>
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
              <View style={styles.brandWordWrap}>
                <Text
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.68}
                  style={[styles.brand, (compact || isVeryNarrow) && styles.brandCompact]}
                >
                  Profu’ <Text style={[styles.brandAccent, isCheckTheme && styles.brandAccentCheck]}>de mate</Text>
                </Text>
              </View>
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
              style={styles.settingsWrap}
            >
              <AppIcon name="settings" size={compact ? 25 : 28} />
            </IconButton>
          </Enter>

          <Enter ready={motionReady} delay={65} distance={12} scaleFrom={0.97} style={[styles.tutorRow, compact && styles.tutorRowCompact]}>
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
              <SpotlightAura size={spotlightSize} tone={auraTone} active={motionActive} />
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
                active={motionActive}
                interactive
                nudgeSignal={mascotNudge}
                onPress={cycleEncouragement}
              />
            </View>
          </Enter>

          <Enter ready={motionReady} delay={110} distance={12} scaleFrom={0.97} style={styles.modeSwitchEnter}>
            <SegmentedToggle
              options={modeOptions}
              value={mode}
              onChange={onMode}
              disabled={pending || galleryBusy}
              dimWhenDisabled={!galleryBusy}
              compact={compact}
              style={styles.modeSwitchFloating}
            />
          </Enter>

          <Enter ready={motionReady} delay={155} distance={14} scaleFrom={0.96} style={styles.cameraStageEnter}>
            <Animated.View
              style={[
                styles.cameraStageShadow,
                isCheckTheme && styles.cameraStageShadowCheck,
                stageAnimated,
              ]}
            >
              <View style={[styles.cameraStage, isCheckTheme && styles.cameraStageCheck, compact && styles.cameraStageCompact]}>
                <View pointerEvents="none" style={[styles.studioTintCorner, isCheckTheme && styles.studioTintCornerCheck]} />
                <View pointerEvents="none" style={[styles.studioTintBottom, isCheckTheme && styles.studioTintBottomCheck]} />
                <Text accessible={false} style={[styles.stageWatermark, isCheckTheme && styles.stageWatermarkCheck]}>
                  {isSolve ? 'π' : '✓'}
                </Text>

                <View style={[styles.stageTopRow, compact && styles.stageTopRowCompact]}>
                  <View
                    collapsable={false}
                    style={[
                      styles.stageStatusPill,
                      hasPendingAnalysis && styles.stageStatusPillPending,
                      isCheckTheme && styles.stageStatusPillCheck,
                    ]}
                  >
                    <Animated.View style={sparkStyle}>
                      <Text
                        accessible={false}
                        style={[
                          styles.stageSpark,
                          { color: hasPendingAnalysis ? colors.limeDeep : isCheckTheme ? colors.peachDeep : colors.violet },
                        ]}
                      >
                        ✦
                      </Text>
                    </Animated.View>
                    <Text
                      maxFontSizeMultiplier={1.15}
                      style={[
                        styles.stageStatusLabel,
                        hasPendingAnalysis && styles.stageStatusLabelPending,
                        isCheckTheme && styles.stageStatusLabelCheck,
                      ]}
                    >
                      {hasPendingAnalysis
                        ? 'ANALIZĂ ÎN CURS'
                        : isSolve
                          ? 'MOD FOTO'
                          : 'MOD VERIFICARE'}
                    </Text>
                  </View>

                  {studyTrackLabel && onStudy ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Nivel activ: ${studyTrackLabel}. Deschide secțiunea Învață`}
                      hitSlop={6}
                      onPress={onStudy}
                      style={({ pressed }) => [styles.stageTrackChip, pressed && styles.stageTrackChipPressed]}
                    >
                      <Text maxFontSizeMultiplier={1.1} numberOfLines={1} style={styles.stageTrackText}>
                        {studyTrackLabel} ↗
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={[styles.stageContent, compact && styles.stageContentCompact]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={hasPendingAnalysis ? 'Revino la analiza în curs' : 'Deschide camera din cadru'}
                    disabled={galleryBusy}
                    onPress={onCapture}
                    style={({ pressed }) => [
                      styles.lensPodWrap,
                      isVeryNarrow && styles.lensPodWrapNarrow,
                      compact && styles.lensPodWrapCompact,
                      pressed && styles.focusFramePressed,
                    ]}
                  >
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.focusLensHalo,
                        compact && styles.focusLensHaloCompact,
                        { borderColor: isCheckTheme ? '#FF9278' : colors.lime },
                        lensHaloStyle,
                      ]}
                    />
                    <View
                      style={[
                        styles.lensPod,
                        isCheckTheme && styles.lensPodCheck,
                        compact && styles.lensPodCompact,
                      ]}
                    >
                      <LinearGradient
                        colors={['#904EFF', '#6522EB', '#4512BA']}
                        start={{ x: 0.1, y: 0 }}
                        end={{ x: 0.9, y: 1 }}
                        style={styles.fill}
                      />
                      <Animated.View pointerEvents="none" style={[styles.fill, checkGradientStyle]}>
                        <LinearGradient
                          colors={['#FF7C64', '#E53D78', '#A51E5B']}
                          start={{ x: 0.1, y: 0 }}
                          end={{ x: 0.9, y: 1 }}
                          style={styles.fill}
                        />
                      </Animated.View>

                      <View pointerEvents="none" style={[styles.corner, styles.cornerTL, { borderColor: cornerColor }]} />
                      <View pointerEvents="none" style={[styles.corner, styles.cornerTR, { borderColor: cornerColor }]} />
                      <View pointerEvents="none" style={[styles.corner, styles.cornerBL, { borderColor: cornerColor }]} />
                      <View pointerEvents="none" style={[styles.corner, styles.cornerBR, { borderColor: cornerColor }]} />

                      <Animated.View pointerEvents="none" style={[styles.focusMedallion, compact && styles.focusMedallionCompact, medallionAnimated]}>
                        <AppIcon
                          name={hasPendingAnalysis || isSolve ? 'scan' : 'verify'}
                          size={compact ? 38 : isVeryNarrow ? 46 : 52}
                        />
                      </Animated.View>

                      <Animated.View pointerEvents="none" style={[styles.scanBeamWrap, beamStyle]}>
                        <View
                          style={[
                            styles.scanBeamHalo,
                            { backgroundColor: isCheckTheme ? 'rgba(255,212,71,0.38)' : 'rgba(216,255,62,0.38)' },
                          ]}
                        />
                        <View style={[styles.scanBeam, { backgroundColor: cornerColor }]} />
                      </Animated.View>
                    </View>
                  </Pressable>

                  <View style={styles.stageCopy}>
                    <Text
                      maxFontSizeMultiplier={1.3}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.82}
                      style={[styles.stageTitle, isVeryNarrow && styles.stageTitleNarrow, compact && styles.stageTitleCompact]}
                    >
                      {hasPendingAnalysis ? 'Revino la analiză' : isSolve ? 'Fotografiază problema' : 'Fotografiază rezolvarea'}
                    </Text>
                    <Text
                      maxFontSizeMultiplier={1.3}
                      numberOfLines={2}
                      style={[styles.stageNote, compact && styles.stageNoteCompact]}
                    >
                      {hasPendingAnalysis
                        ? 'Rezultatul tău se pregătește.'
                        : isSolve
                          ? 'Încadrezi enunțul și primești pașii clari.'
                          : 'Vezi ce ai făcut bine și ce corectezi.'}
                    </Text>
                    {!compact && !hasPendingAnalysis ? (
                      <View style={styles.featurePillsRow}>
                        <View style={[styles.featurePill, isCheckTheme && styles.featurePillCheck]}>
                          <Text maxFontSizeMultiplier={1.1} style={[styles.featurePillText, isCheckTheme && styles.featurePillTextCheck]}>
                            {isSolve ? '✦ Pas cu pas' : '✦ Corectare'}
                          </Text>
                        </View>
                        <View style={[styles.featurePill, isCheckTheme && styles.featurePillCheck]}>
                          <Text maxFontSizeMultiplier={1.1} style={[styles.featurePillText, isCheckTheme && styles.featurePillTextCheck]}>
                            {isSolve ? '✦ Clar' : '✦ Indicii'}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.stageCtaWrap}>
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
                    pressedScale={0.97}
                    haptic="medium"
                    onPress={onCapture}
                    contentStyle={[
                      styles.captureCta,
                      compact && styles.captureCtaCompact,
                      isCheckTheme && styles.captureCtaCheck,
                    ]}
                  >
                    <Animated.View pointerEvents="none" style={[styles.ctaSweep, ctaSheenStyle]} />
                    <View style={[styles.captureIconBadge, compact && styles.captureIconBadgeCompact]}>
                      <AppIcon name={hasPendingAnalysis ? 'scan' : 'camera'} size={compact ? 26 : 31} />
                    </View>
                    <Text
                      maxFontSizeMultiplier={1.3}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.82}
                      style={[styles.captureCtaText, compact && styles.captureCtaTextCompact]}
                    >
                      {hasPendingAnalysis ? 'Revino la analiză' : 'Deschide camera'}
                    </Text>
                    <Animated.View style={[styles.captureArrow, compact && styles.captureArrowCompact, arrowStyle]}>
                      <MiniGlyph name="next" size={compact ? 16 : 18} color={colors.paper} />
                    </Animated.View>
                  </PressableScale>
                </View>
              </View>
            </Animated.View>
          </Enter>

          <View style={[styles.lowerStack, compact && styles.lowerStackCompact]}>
            {!hasPendingAnalysis ? (
              <Enter ready={motionReady} delay={205} distance={14} scaleFrom={0.96} style={[styles.inputPairRow, compact && styles.inputPairRowCompact]}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Alege o fotografie din galerie"
                  accessibilityState={{ disabled: galleryBusy, busy: galleryBusy }}
                  disabled={galleryBusy}
                  dimWhenDisabled={false}
                  pressedScale={0.96}
                  haptic="light"
                  onPress={onGallery}
                  style={styles.inputPairWrap}
                  contentStyle={[
                    styles.secondaryTile,
                    styles.galleryTile,
                    compact && styles.secondaryTileCompact,
                  ]}
                >
                  <View style={[styles.tileIconBadge, styles.galleryIconBadge, (compact || isVeryNarrow) && styles.tileIconBadgeCompact]}>
                    {galleryBusy ? (
                      <PlayfulLoader micro />
                    ) : (
                      <AppIcon name="gallery" size={compact || isVeryNarrow ? 26 : 33} />
                    )}
                  </View>
                  <View style={styles.tileCopy}>
                    <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.tileTitle, compact && styles.tileTitleCompact]}>
                      Galerie
                    </Text>
                    {!compact ? (
                      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.tileNote}>
                        {isSolve ? 'Din telefon' : 'Poză pași'}
                      </Text>
                    ) : null}
                  </View>
                </PressableScale>

                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Scrie o problemă sau o rezolvare"
                  accessibilityState={{ disabled: galleryBusy }}
                  disabled={galleryBusy}
                  dimWhenDisabled={false}
                  pressedScale={0.96}
                  haptic="light"
                  onPress={onMath}
                  style={styles.inputPairWrap}
                  contentStyle={[
                    styles.secondaryTile,
                    styles.mathTile,
                    compact && styles.secondaryTileCompact,
                  ]}
                >
                  <View style={[styles.tileIconBadge, styles.mathIconBadge, (compact || isVeryNarrow) && styles.tileIconBadgeCompact]}>
                    <AppIcon name="practice" size={compact || isVeryNarrow ? 26 : 33} />
                  </View>
                  <View style={styles.tileCopy}>
                    <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.tileTitle, compact && styles.tileTitleCompact]}>
                      Scrie
                    </Text>
                    {!compact ? (
                      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.tileNote}>
                        {isSolve ? 'Fără poză' : 'Soluția ta'}
                      </Text>
                    ) : null}
                  </View>
                </PressableScale>
              </Enter>
            ) : null}

            {!hasPendingAnalysis && embedded && onQuickPractice ? (
              <Enter ready={motionReady} delay={245} distance={12} scaleFrom={0.97}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={
                    wrongCount > 0
                      ? `Reia cele ${wrongCount} exerciții greșite`
                      : 'Începe un antrenament fulger de 5 minute'
                  }
                  accessibilityState={{ disabled: galleryBusy }}
                  disabled={galleryBusy}
                  dimWhenDisabled={false}
                  pressedScale={0.975}
                  haptic="medium"
                  onPress={onQuickPractice}
                  contentStyle={[
                    styles.practiceBanner,
                    wrongCount > 0 ? styles.practiceBannerMistakes : styles.practiceBannerQuiz,
                    compact && styles.practiceBannerCompact,
                  ]}
                >
                  <View style={[styles.practiceSpine, wrongCount > 0 && styles.practiceSpineMistakes]} />
                  <View
                    style={[
                      styles.practiceIconBadge,
                      wrongCount > 0 ? styles.mistakesIconBadge : styles.quizIconBadge,
                      compact && styles.practiceIconBadgeCompact,
                    ]}
                  >
                    <AppIcon name="streak" size={compact ? 25 : 31} />
                  </View>
                  <View style={styles.practiceCopy}>
                    <View style={styles.practiceHeaderRow}>
                      <Text
                        maxFontSizeMultiplier={1.25}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}
                        style={[
                          styles.practiceTitle,
                          wrongCount > 0 && styles.mistakesTitle,
                          compact && styles.practiceTitleCompact,
                        ]}
                      >
                        {wrongCount > 0 ? 'Repetă greșelile' : 'Antrenament fulger'}
                      </Text>
                      {wrongCount > 0 ? (
                        <View collapsable={false} style={styles.practiceBadgeMistakes}>
                          <Text maxFontSizeMultiplier={1.05} style={styles.practiceBadgeMistakesText}>
                            {wrongCount}
                          </Text>
                        </View>
                      ) : (
                        <View collapsable={false} style={styles.practiceBadgeStreak}>
                          <Text maxFontSizeMultiplier={1.05} style={styles.practiceBadgeStreakText}>
                            {streakDays > 0 ? `${streakDays}z` : '5 min'}
                          </Text>
                        </View>
                      )}
                    </View>
                    {!compact ? (
                      <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={styles.practiceNote}>
                        {wrongCount > 0
                          ? 'Reia rapid exercițiile greșite la practică'
                          : studyTrackLabel
                            ? `5 exerciții rapide · ${studyTrackLabel}`
                            : '5 exerciții rapide pentru ritm zilnic'}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.practiceArrow,
                      wrongCount > 0 && styles.practiceArrowMistakes,
                      compact && styles.practiceArrowCompact,
                    ]}
                  >
                    <MiniGlyph
                      name="next"
                      size={compact ? 15 : 17}
                      color={wrongCount > 0 ? colors.peachDeep : colors.violetDeep}
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
                  contentStyle={[styles.notebookShelf, compact && styles.notebookShelfCompact]}
                >
                  <View style={styles.notebookSpine} />
                  <View style={[styles.notebookIcon, compact && styles.notebookIconCompact]}>
                    <AppIcon name="notebook" size={compact ? 32 : 38} />
                  </View>
                  <View style={styles.notebookCopy}>
                    <View style={styles.notebookHeaderRow}>
                      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[styles.notebookTitle, compact && styles.notebookTitleCompact]}>
                        Caietul meu
                      </Text>
                      {savedCountLabel ? (
                        <View collapsable={false} style={styles.countBadge}>
                          <Text maxFontSizeMultiplier={1.1} style={styles.countBadgeText}>{savedCountLabel}</Text>
                        </View>
                      ) : null}
                    </View>
                    {!compact ? (
                      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={styles.notebookNote}>
                        {latestLessonTitle ? latestLessonTitle : 'Lecțiile tale salvate, disponibile și offline'}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.notebookArrow, compact && styles.notebookArrowCompact]}>
                    <MiniGlyph name="next" size={compact ? 17 : 19} color={colors.violetDeep} />
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

      {/* Full-bleed curved Royal-Violet / Coral-Berry sky canopy pinned behind Home content */}
      <View
        pointerEvents="none"
        style={[
          styles.skyDome,
          { height: skyDomeHeight },
        ]}
      >
        <LinearGradient
          colors={['#904EFF', '#6824EE', '#4712BD']}
          start={{ x: 0.08, y: 0 }}
          end={{ x: 0.92, y: 1 }}
          style={styles.fill}
        />
        <Animated.View style={[styles.fill, checkGradientStyle]}>
          <LinearGradient
            colors={['#FF7B5C', '#E43A77', '#A21957']}
            start={{ x: 0.08, y: 0 }}
            end={{ x: 0.92, y: 1 }}
            style={styles.fill}
          />
        </Animated.View>
        <View style={styles.skyGlowRight} />
        <View style={styles.skyGlowLime} />
        <Text accessible={false} style={styles.skyGlyphPi}>π</Text>
        <Text accessible={false} style={styles.skyGlyphRoot}>√</Text>
        <Text accessible={false} style={styles.skyGlyphSum}>∑</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  safe: { flex: 1, overflow: 'hidden', backgroundColor: colors.canvas },
  homeScene: { flex: 1, overflow: 'hidden', zIndex: 2 },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  page: { flex: 1, minHeight: 0, maxWidth: 560, alignSelf: 'center', gap: 10, paddingTop: 4, paddingBottom: 8 },
  pageCompact: { gap: 6, paddingTop: 2 },

  // Full-bleed curved sky dome canopy (smooth gradient arch with zero side-less border seam)
  skyDome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  skyGlowRight: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -40,
    right: -52,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  skyGlowLime: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    bottom: -75,
    left: -38,
    backgroundColor: 'rgba(216, 255, 62, 0.14)',
  },
  skyGlyphPi: {
    position: 'absolute',
    left: 16,
    bottom: 24,
    fontFamily: fonts.display,
    fontSize: 40,
    color: 'rgba(255, 255, 255, 0.08)',
    transform: [{ rotate: '-12deg' }],
  },
  skyGlyphRoot: {
    position: 'absolute',
    right: 112,
    top: 66,
    fontFamily: fonts.display,
    fontSize: 28,
    color: 'rgba(216, 255, 62, 0.14)',
    transform: [{ rotate: '10deg' }],
  },
  skyGlyphSum: {
    position: 'absolute',
    left: '44%',
    bottom: 18,
    fontFamily: fonts.display,
    fontSize: 26,
    color: 'rgba(255, 255, 255, 0.08)',
    transform: [{ rotate: '8deg' }],
  },

  // Brand top bar floating over curved sky dome
  header: { height: 58, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCompact: { height: 44 },
  brandRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandRowNarrow: { gap: 6 },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.2,
    borderColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoCompact: { width: 35, height: 35, borderRadius: 17.5 },
  logoImage: { width: 34, height: 34 },
  logoImageCompact: { width: 28, height: 28 },
  brandWordWrap: { flex: 1, minWidth: 0, justifyContent: 'center' },
  brand: { fontFamily: fonts.display, color: colors.paper, fontSize: 22, lineHeight: 26, letterSpacing: -0.3 },
  brandAccent: { color: colors.lime },
  brandAccentCheck: { color: '#FFE169' },
  brandCompact: { fontSize: 18, lineHeight: 22 },

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
  energyTrack: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 2,
    height: 2.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(124, 60, 255, 0.12)',
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
  settingsWrap: { marginLeft: 8 },

  // Hero owl + borderless luminous message row inside the sky dome
  tutorRow: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tutorRowCompact: { gap: 4 },
  tutorMascotStage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
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

  // Sculpted pure-white 3D optical studio card
  cameraStageEnter: { flex: 1, minHeight: 0, width: '100%', zIndex: 3 },
  cameraStageShadow: { flex: 1, minHeight: 0, width: '100%', borderRadius: 32, elevation: 5, shadowColor: '#4B1FB8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.13, shadowRadius: 16 },
  cameraStageShadowCheck: { shadowColor: '#B5265D' },
  cameraStage: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderBottomWidth: 5,
    borderColor: '#E5DAFA',
    borderBottomColor: '#D2C0F8',
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
    padding: 15,
    position: 'relative',
  },
  cameraStageCheck: {
    borderColor: '#FBD2DF',
    borderBottomColor: '#EEADC2',
  },
  cameraStageCompact: { padding: 11 },
  studioTintCorner: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    top: -90,
    right: -70,
    backgroundColor: 'rgba(124, 60, 255, 0.055)',
  },
  studioTintCornerCheck: {
    backgroundColor: 'rgba(255, 141, 107, 0.08)',
  },
  studioTintBottom: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    bottom: -70,
    left: -55,
    backgroundColor: 'rgba(216, 255, 62, 0.1)',
  },
  studioTintBottomCheck: {
    backgroundColor: 'rgba(255, 212, 71, 0.1)',
  },
  stageWatermark: {
    position: 'absolute',
    right: 14,
    bottom: 64,
    fontFamily: fonts.display,
    fontSize: 74,
    lineHeight: 78,
    color: 'rgba(124, 60, 255, 0.055)',
    transform: [{ rotate: '12deg' }],
  },
  stageWatermarkCheck: {
    color: 'rgba(229, 61, 120, 0.06)',
  },
  stageTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 2,
  },
  stageTopRowCompact: { marginBottom: 2 },
  stageStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 4.5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#E1D3FE',
    backgroundColor: '#F4EEFF',
  },
  stageStatusPillCheck: {
    borderColor: '#FBC7D7',
    backgroundColor: '#FFF0F4',
  },
  stageStatusPillPending: {
    borderColor: '#CBEB70',
    backgroundColor: '#F2FFD0',
  },
  stageStatusLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.85,
    color: colors.violetDeep,
    includeFontPadding: false,
  },
  stageStatusLabelCheck: {
    color: '#A51E5B',
  },
  stageStatusLabelPending: {
    color: colors.limeDeep,
  },
  stageSpark: {
    fontFamily: fonts.display,
    fontSize: 13,
    lineHeight: 15,
  },
  stageTrackChip: {
    minHeight: 26,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#DCD0F8',
    backgroundColor: '#F6F2FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  stageTrackChipPressed: { opacity: 0.78 },
  stageTrackText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.35,
    color: colors.violetDeep,
    includeFontPadding: false,
  },

  // Horizontal optical viewfinder pod + crisp editorial lockup
  stageContent: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 15,
    paddingHorizontal: 2,
    zIndex: 2,
  },
  stageContentCompact: {
    gap: 12,
    paddingHorizontal: 1,
  },
  lensPodWrap: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  lensPodWrapNarrow: { width: 92, height: 92 },
  lensPodWrapCompact: { width: 70, height: 70 },
  focusFramePressed: { transform: [{ scale: 0.93 }] },
  focusLensHalo: {
    position: 'absolute',
    top: -6,
    right: -6,
    bottom: -6,
    left: -6,
    borderRadius: 34,
    borderWidth: 2.2,
  },
  focusLensHaloCompact: {
    top: -4,
    right: -4,
    bottom: -4,
    left: -4,
    borderRadius: 24,
  },
  lensPod: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderBottomColor: '#360F94',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  lensPodCheck: {
    borderBottomColor: '#7C1342',
  },
  lensPodCompact: {
    borderRadius: 21,
    borderBottomWidth: 3,
  },
  corner: {
    position: 'absolute',
    width: 15,
    height: 15,
    zIndex: 3,
  },
  cornerTL: { top: 9, left: 9, borderTopWidth: 2.8, borderLeftWidth: 2.8, borderTopLeftRadius: 6 },
  cornerTR: { top: 9, right: 9, borderTopWidth: 2.8, borderRightWidth: 2.8, borderTopRightRadius: 6 },
  cornerBL: { bottom: 9, left: 9, borderBottomWidth: 2.8, borderLeftWidth: 2.8, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 9, right: 9, borderBottomWidth: 2.8, borderRightWidth: 2.8, borderBottomRightRadius: 6 },
  focusMedallion: {
    width: 68,
    height: 68,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 253, 248, 0.96)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusMedallionCompact: { width: 48, height: 48, borderRadius: 15 },
  scanBeamWrap: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 12,
    justifyContent: 'center',
    zIndex: 4,
  },
  scanBeamHalo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 6,
  },
  scanBeam: { width: '100%', height: 3, borderRadius: 3 },
  stageCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  stageTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 22.5,
    lineHeight: 25.5,
    letterSpacing: -0.35,
    textAlign: 'left',
  },
  stageTitleNarrow: { fontSize: 19.5, lineHeight: 22.5 },
  stageTitleCompact: { fontSize: 17.5, lineHeight: 20.5 },
  stageNote: {
    marginTop: 4,
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 12.5,
    lineHeight: 16.5,
    textAlign: 'left',
  },
  stageNoteCompact: { marginTop: 2, fontSize: 11.5, lineHeight: 15 },
  featurePillsRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  featurePill: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: radii.pill,
    backgroundColor: '#F4EEFF',
    borderWidth: 1,
    borderColor: '#E5D8FE',
  },
  featurePillCheck: {
    backgroundColor: '#FFF2ED',
    borderColor: '#FFD3C4',
  },
  featurePillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    lineHeight: 13,
    color: colors.violetDeep,
    includeFontPadding: false,
  },
  featurePillTextCheck: {
    color: colors.peachDeep,
  },

  stageCtaWrap: { zIndex: 3 },
  captureCta: {
    height: 55,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderColor: '#E8FF85',
    borderBottomWidth: 4,
    borderBottomColor: '#92BE00',
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    gap: 11,
    overflow: 'hidden',
  },
  captureCtaCompact: { height: 45, paddingHorizontal: 8, gap: 8 },
  captureCtaCheck: {
    backgroundColor: '#FFD066',
    borderColor: '#FFE59E',
    borderBottomColor: '#CC9214',
  },
  ctaSweep: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    width: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.56)',
  },
  captureIconBadge: {
    width: 37,
    height: 37,
    borderRadius: 18.5,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureIconBadgeCompact: { width: 31, height: 31, borderRadius: 15.5 },
  captureCtaText: { flex: 1, fontFamily: fonts.display, color: colors.ink, fontSize: 19, lineHeight: 22 },
  captureCtaTextCompact: { fontSize: 16.5, lineHeight: 20 },
  captureArrow: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureArrowCompact: { width: 29, height: 29, borderRadius: 14.5 },

  // 2-tier lower deck: paired solve/check input cards + separate full-width practice banner
  lowerStack: { flexShrink: 0, gap: 9, zIndex: 3 },
  lowerStackCompact: { gap: 6 },
  inputPairRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  inputPairRowCompact: { gap: 8 },
  inputPairWrap: { flex: 1, minWidth: 0 },

  secondaryTile: {
    height: 60,
    borderRadius: 21,
    borderWidth: 1.4,
    borderBottomWidth: 4,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
  },
  secondaryTileCompact: { height: 46, borderRadius: 16, borderBottomWidth: 3, paddingHorizontal: 8, gap: 7 },
  galleryTile: {
    backgroundColor: '#EBFBFF',
    borderColor: '#98E6F5',
    borderBottomColor: '#5BC9DE',
  },
  mathTile: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F8DA7A',
    borderBottomColor: '#E5B72F',
  },
  tileIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tileIconBadgeCompact: { width: 34, height: 34, borderRadius: 11 },
  galleryIconBadge: { backgroundColor: '#D4F5FD' },
  mathIconBadge: { backgroundColor: '#FFF0B8' },
  tileCopy: { flex: 1, minWidth: 0 },
  tileTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 17, lineHeight: 20 },
  tileTitleCompact: { fontSize: 14.5, lineHeight: 17.5 },
  tileNote: { marginTop: 1, fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 11.5, lineHeight: 14 },

  // Dedicated full-width practice / mistake-review action banner
  practiceBanner: {
    minHeight: 58,
    borderRadius: 21,
    borderWidth: 1.4,
    borderBottomWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 11,
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  practiceBannerCompact: { minHeight: 46, borderRadius: 16, borderBottomWidth: 3, paddingVertical: 6, paddingLeft: 10, paddingRight: 9, gap: 8 },
  practiceBannerQuiz: {
    backgroundColor: '#F4EEFF',
    borderColor: '#D6BEFF',
    borderBottomColor: '#B18CFF',
  },
  practiceBannerMistakes: {
    backgroundColor: '#FFF2EC',
    borderColor: '#FFC0AB',
    borderBottomColor: '#EE9579',
  },
  practiceSpine: {
    position: 'absolute',
    left: 0,
    top: 11,
    bottom: 11,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors.violet,
  },
  practiceSpineMistakes: {
    backgroundColor: colors.peachDeep,
  },
  practiceIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  practiceIconBadgeCompact: { width: 32, height: 32, borderRadius: 11 },
  quizIconBadge: { backgroundColor: '#E5D6FF' },
  mistakesIconBadge: { backgroundColor: '#FFDCD0' },
  practiceCopy: { flex: 1, minWidth: 0 },
  practiceHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  practiceTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 16.5, lineHeight: 19.5, flexShrink: 1 },
  practiceTitleCompact: { fontSize: 14.5, lineHeight: 17.5 },
  mistakesTitle: { color: colors.peachDeep },
  practiceNote: { marginTop: 1, fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 11.5, lineHeight: 14.5 },
  practiceBadgeMistakes: {
    minWidth: 20,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceBadgeMistakesText: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 10,
    lineHeight: 12,
    includeFontPadding: false,
  },
  practiceBadgeStreak: {
    height: 18,
    paddingHorizontal: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceBadgeStreakText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 10,
    lineHeight: 12,
    includeFontPadding: false,
  },
  practiceArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E8DCFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  practiceArrowMistakes: {
    backgroundColor: '#FFE0D4',
  },
  practiceArrowCompact: { width: 25, height: 25, borderRadius: 12.5 },

  notebookGroup: { gap: 7 },
  notebookShelf: {
    minHeight: 62,
    borderRadius: 22,
    borderWidth: 1.2,
    borderBottomWidth: 3.5,
    borderColor: '#E4D8FA',
    borderBottomColor: '#D1BFF5',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 13,
    gap: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  notebookShelfCompact: { minHeight: 50, borderRadius: 17, paddingVertical: 7, paddingHorizontal: 10, gap: 9 },
  notebookSpine: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors.violet,
  },
  notebookIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#F2EAFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notebookIconCompact: { width: 36, height: 36, borderRadius: 12 },
  notebookCopy: { flex: 1, minWidth: 0 },
  notebookHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  notebookTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 17.5, lineHeight: 21, flexShrink: 1 },
  notebookTitleCompact: { fontSize: 15.5, lineHeight: 19 },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.limeSoft,
  },
  countBadgeText: {
    fontFamily: fonts.bodyBold,
    color: colors.limeDeep,
    fontSize: 10.5,
    lineHeight: 13,
    includeFontPadding: false,
  },
  notebookNote: { marginTop: 1, fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 12, lineHeight: 15.5 },
  notebookArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2EAFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notebookArrowCompact: { width: 26, height: 26, borderRadius: 13 },

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
