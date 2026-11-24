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

  const beamRange = compact ? 22 : 34;
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
      outputRange: [0, 0, 0.38, 0.38, 0, 0],
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
          { scale: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) },
          { rotate: tapSpark.interpolate({ inputRange: [0, 1], outputRange: ['-16deg', '18deg'] }) },
        ],
      },
      sparkRightStyle: {
        opacity: arcOpacity,
        transform: [
          { translateX: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0, 22] }) },
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
          { scale: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.1] }) },
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

  const auraTone: SpotlightAuraTone = galleryError
    ? 'rose'
    : hasPendingAnalysis || activeCheer
      ? 'lime'
      : quotaExhausted || !isSolve
        ? 'peach'
        : 'violet';

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

  const mascotSize = compact ? 74 : isVeryNarrow ? 90 : 104;
  const spotlightSize = compact ? 72 : isVeryNarrow ? 88 : 100;
  const cornerColor = isSolve || hasPendingAnalysis ? colors.lime : colors.gold;
  const energyPercent = energyRatio !== null
    ? `${Math.round((energyRatio > 0 ? Math.max(0.08, energyRatio) : 0) * 100)}%` as `${number}%`
    : null;
  const savedCountLabel = savedLessonsCount > 0
    ? `${savedLessonsCount} ${savedLessonsCount === 1 ? 'lecție' : 'lecții'}`
    : null;

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <ComicBackdrop />
      <View style={styles.homeScene}>
        <View style={[styles.page, { width: contentWidth }, compact && styles.pageCompact, embedded && { paddingBottom: bottomClearance }]}>
          <Enter ready={motionReady} delay={20} distance={12} scaleFrom={0.97} style={[styles.header, compact && styles.headerCompact]}>
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
                <View pointerEvents="none" style={styles.brandHighlight} />
                <Text
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.68}
                  style={[styles.brand, (compact || isVeryNarrow) && styles.brandCompact]}
                >
                  Profu’ <Text style={styles.brandAccent}>de mate</Text>
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

          <Enter ready={motionReady} delay={75} distance={14} scaleFrom={0.95} style={[styles.tutorRow, compact && styles.tutorRowCompact]}>
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
            <SpeechBubble
              title={greetingTitle}
              body={greetingBody}
              tone={bubbleTone}
              tail="none"
              compact={compact}
              messageKey={`${greetingTitle}:${greetingBody}`}
              onPress={triggerTutorFromHeader}
            />
          </Enter>

          <Enter ready={motionReady} delay={130} distance={14} scaleFrom={0.96}>
            <SegmentedToggle
              options={modeOptions}
              value={mode}
              onChange={onMode}
              disabled={pending || galleryBusy}
              dimWhenDisabled={!galleryBusy}
              compact={compact}
            />
          </Enter>

          <Enter ready={motionReady} delay={185} distance={16} scaleFrom={0.95} style={styles.cameraStageEnter}>
            <Animated.View
              style={[
                styles.cameraStageShadow,
                !isSolve && !hasPendingAnalysis && styles.cameraStageShadowCheck,
                stageAnimated,
              ]}
            >
              <View style={[styles.cameraStage, compact && styles.cameraStageCompact]}>
                <LinearGradient
                  colors={['#8D50FF', '#6222E6', '#4212B0']}
                  start={{ x: 0.08, y: 0 }}
                  end={{ x: 0.92, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, checkGradientStyle]}>
                  <LinearGradient
                    colors={['#9936E4', '#CC2E72', '#89184D']}
                    start={{ x: 0.08, y: 0 }}
                    end={{ x: 0.92, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>

                <View pointerEvents="none" style={styles.stageGlowTop} />
                <View pointerEvents="none" style={styles.stageGlowBottom} />
                <View pointerEvents="none" style={styles.stageTopShine} />
                <Text accessible={false} style={styles.stageWatermark}>{isSolve ? 'π' : '✓'}</Text>

                <View style={[styles.stageTopRow, compact && styles.stageTopRowCompact]}>
                  <View collapsable={false} style={styles.stageStatusPill}>
                    <Animated.View style={sparkStyle}>
                      <Text accessible={false} style={[styles.stageSpark, { color: cornerColor }]}>✦</Text>
                    </Animated.View>
                    <Text maxFontSizeMultiplier={1.15} style={styles.stageStatusLabel}>
                      {hasPendingAnalysis
                        ? 'ANALIZĂ ÎN CURS'
                        : isSolve
                          ? 'PAS CU PAS · MOD FOTO'
                          : 'VERIFICARE · FIECARE PAS'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.stageContent, compact && styles.stageContentCompact]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={hasPendingAnalysis ? 'Revino la analiza în curs' : 'Deschide camera din cadru'}
                    disabled={galleryBusy}
                    onPress={onCapture}
                    style={({ pressed }) => [
                      styles.focusFrame,
                      compact && styles.focusFrameCompact,
                      pressed && styles.focusFramePressed,
                    ]}
                  >
                    <View pointerEvents="none" style={styles.focusGlass} />
                    <View pointerEvents="none" style={[styles.focusCorner, styles.focusCornerTL, { borderColor: cornerColor }]} />
                    <View pointerEvents="none" style={[styles.focusCorner, styles.focusCornerTR, { borderColor: cornerColor }]} />
                    <View pointerEvents="none" style={[styles.focusCorner, styles.focusCornerBL, { borderColor: cornerColor }]} />
                    <View pointerEvents="none" style={[styles.focusCorner, styles.focusCornerBR, { borderColor: cornerColor }]} />
                    <Animated.View pointerEvents="none" style={[styles.focusMedallion, compact && styles.focusMedallionCompact, medallionAnimated]}>
                      <AppIcon
                        name={hasPendingAnalysis || isSolve ? 'scan' : 'verify'}
                        size={compact ? 42 : isVeryNarrow ? 52 : 58}
                      />
                    </Animated.View>
                    <Animated.View pointerEvents="none" style={[styles.scanBeamWrap, beamStyle]}>
                      <View
                        style={[
                          styles.scanBeamHalo,
                          { backgroundColor: isSolve || hasPendingAnalysis ? 'rgba(216,255,62,0.28)' : 'rgba(255,212,71,0.32)' },
                        ]}
                      />
                      <View style={[styles.scanBeam, { backgroundColor: cornerColor }]} />
                    </Animated.View>
                  </Pressable>

                  <View style={styles.stageCopy}>
                    <Text
                      maxFontSizeMultiplier={1.3}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.84}
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
                      !isSolve && !hasPendingAnalysis && styles.captureCtaCheck,
                    ]}
                  >
                    <Animated.View pointerEvents="none" style={[styles.ctaSweep, ctaSheenStyle]} />
                    <View style={[styles.captureIconBadge, compact && styles.captureIconBadgeCompact]}>
                      <AppIcon name={hasPendingAnalysis ? 'scan' : 'camera'} size={compact ? 25 : 30} />
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
                      <MiniGlyph name="next" size={compact ? 17 : 19} color={colors.paper} />
                    </Animated.View>
                  </PressableScale>
                </View>
              </View>
            </Animated.View>
          </Enter>

          <View style={styles.lowerStack}>
            {!hasPendingAnalysis ? (
              <Enter ready={motionReady} delay={240} distance={14} scaleFrom={0.96} style={[styles.secondaryRow, compact && styles.secondaryRowCompact]}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Alege o fotografie din galerie"
                  accessibilityState={{ disabled: galleryBusy, busy: galleryBusy }}
                  disabled={galleryBusy}
                  dimWhenDisabled={false}
                  pressedScale={0.965}
                  haptic="light"
                  onPress={onGallery}
                  style={styles.secondaryTileWrap}
                  contentStyle={[
                    styles.secondaryTile,
                    styles.galleryTile,
                    isVeryNarrow && styles.secondaryTileNarrow,
                    compact && styles.secondaryTileCompact,
                  ]}
                >
                  <View style={[styles.tileIconBadge, styles.galleryIconBadge, (compact || isVeryNarrow) && styles.tileIconBadgeCompact]}>
                    {galleryBusy ? <PlayfulLoader micro /> : <AppIcon name="gallery" size={compact || isVeryNarrow ? 25 : 32} />}
                  </View>
                  <View style={styles.tileCopy}>
                    <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.tileTitle, compact && styles.tileTitleCompact]}>
                      Galerie
                    </Text>
                    {!compact ? (
                      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.tileNote}>
                        {isSolve ? 'Din telefon' : 'Poză cu pașii'}
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
                  pressedScale={0.965}
                  haptic="light"
                  onPress={onMath}
                  style={styles.secondaryTileWrap}
                  contentStyle={[
                    styles.secondaryTile,
                    styles.mathTile,
                    isVeryNarrow && styles.secondaryTileNarrow,
                    compact && styles.secondaryTileCompact,
                  ]}
                >
                  <View style={[styles.tileIconBadge, styles.mathIconBadge, (compact || isVeryNarrow) && styles.tileIconBadgeCompact]}>
                    <AppIcon name="practice" size={compact || isVeryNarrow ? 25 : 32} />
                  </View>
                  <View style={styles.tileCopy}>
                    <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.tileTitle, compact && styles.tileTitleCompact]}>
                      Scrie
                    </Text>
                    {!compact ? (
                      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.tileNote}>
                        {isSolve ? 'Fără poză' : 'Scrie soluția'}
                      </Text>
                    ) : null}
                  </View>
                </PressableScale>
              </Enter>
            ) : null}

            {embedded ? (
              onStudy && !compact && !hasPendingAnalysis ? (
                <Enter ready={motionReady} delay={295} distance={10} scaleFrom={0.97}>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel="Deschide secțiunea Învață cu formule și ghid de examen"
                    pressedScale={0.975}
                    haptic="selection"
                    onPress={onStudy}
                    contentStyle={styles.studyQuickRibbon}
                  >
                    <MiniGlyph name="spark" size={14} color={colors.violet} />
                    <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={styles.studyQuickText}>
                      Formule, fișe și ghid EN / BAC
                    </Text>
                    <View style={styles.studyQuickArrow}>
                      <MiniGlyph name="next" size={14} color={colors.violetDeep} />
                    </View>
                  </PressableScale>
                </Enter>
              ) : null
            ) : (
              <Enter ready={motionReady} delay={295} distance={12} scaleFrom={0.97} style={styles.notebookGroup}>
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
            )}
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  safe: { flex: 1, overflow: 'hidden', backgroundColor: colors.canvas },
  homeScene: { flex: 1, overflow: 'hidden' },
  page: { flex: 1, minHeight: 0, maxWidth: 560, alignSelf: 'center', gap: 11, paddingTop: 4, paddingBottom: 8 },
  pageCompact: { gap: 7, paddingTop: 2 },

  // Airy floating top bar
  header: { height: 58, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCompact: { height: 44 },
  brandRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandRowNarrow: { gap: 6 },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 60, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoCompact: { width: 34, height: 34, borderRadius: 17 },
  logoImage: { width: 34, height: 34 },
  logoImageCompact: { width: 28, height: 28 },
  brandWordWrap: { flex: 1, minWidth: 0, justifyContent: 'center', position: 'relative' },
  brandHighlight: {
    position: 'absolute',
    left: 2,
    bottom: 2,
    width: 78,
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(216, 255, 62, 0.65)',
  },
  brand: { fontFamily: fonts.display, color: colors.ink, fontSize: 21, lineHeight: 25, letterSpacing: -0.3 },
  brandAccent: { color: colors.violet },
  brandCompact: { fontSize: 17, lineHeight: 21 },

  allowanceWrap: { marginLeft: 8 },
  allowanceWrapNarrow: { marginLeft: 6 },
  allowancePill: {
    minWidth: 102,
    maxWidth: 134,
    height: 42,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  allowancePillCompact: { minWidth: 90, height: 36, paddingHorizontal: 9 },
  allowancePillPremium: { backgroundColor: '#F4FFE0', borderColor: 'rgba(86, 120, 0, 0.2)' },
  allowancePillExhausted: { backgroundColor: '#FFF2EC', borderColor: 'rgba(255, 141, 107, 0.35)' },
  energyTrack: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 2.5,
    height: 2.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(124, 60, 255, 0.1)',
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

  // Companion spotlight row
  tutorRow: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tutorRowCompact: { gap: 6 },
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
  tapSparkLime: { fontFamily: fonts.display, fontSize: 16, color: colors.violet },
  tapSparkGold: { fontFamily: fonts.display, fontSize: 14, color: colors.peach },
  tapSparkCyan: { fontFamily: fonts.display, fontSize: 13, color: colors.cyanDeep },

  // Iconic luminous hero capture stage
  cameraStageEnter: { flex: 1, minHeight: 0, width: '100%' },
  cameraStageShadow: { flex: 1, minHeight: 0, width: '100%', borderRadius: 30, elevation: 6, shadowColor: '#4B1FB8', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 18 },
  cameraStageShadowCheck: { shadowColor: '#8E1E4E' },
  cameraStage: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 30,
    backgroundColor: colors.violet,
    justifyContent: 'space-between',
    padding: 16,
    position: 'relative',
  },
  cameraStageCompact: { padding: 12 },
  stageGlowTop: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -120,
    right: -70,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  stageGlowBottom: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    bottom: -90,
    left: -55,
    backgroundColor: 'rgba(23, 19, 55, 0.22)',
  },
  stageTopShine: {
    position: 'absolute',
    top: 0,
    left: 26,
    right: 26,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
  },
  stageWatermark: {
    position: 'absolute',
    right: 16,
    bottom: 66,
    fontFamily: fonts.display,
    fontSize: 80,
    lineHeight: 84,
    color: 'rgba(255, 255, 255, 0.075)',
    transform: [{ rotate: '12deg' }],
  },
  stageTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 2,
  },
  stageTopRowCompact: { marginBottom: 2 },
  stageStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(18, 12, 46, 0.26)',
  },
  stageStatusLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.85,
    color: colors.paper,
    includeFontPadding: false,
  },
  stageSpark: {
    fontFamily: fonts.display,
    fontSize: 13,
    lineHeight: 15,
  },
  stageContent: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 2,
    zIndex: 2,
  },
  stageContentCompact: { gap: 11, paddingHorizontal: 1 },
  focusFrame: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  focusFrameCompact: { width: 72, height: 72 },
  focusFramePressed: { transform: [{ scale: 0.94 }] },
  focusGlass: {
    position: 'absolute',
    top: 7,
    right: 7,
    bottom: 7,
    left: 7,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  focusMedallion: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusMedallionCompact: { width: 50, height: 50, borderRadius: 14 },
  focusCorner: { position: 'absolute', width: 22, height: 22 },
  focusCornerTL: { left: 0, top: 0, borderLeftWidth: 3.5, borderTopWidth: 3.5, borderTopLeftRadius: 10 },
  focusCornerTR: { right: 0, top: 0, borderRightWidth: 3.5, borderTopWidth: 3.5, borderTopRightRadius: 10 },
  focusCornerBL: { left: 0, bottom: 0, borderLeftWidth: 3.5, borderBottomWidth: 3.5, borderBottomLeftRadius: 10 },
  focusCornerBR: { right: 0, bottom: 0, borderRightWidth: 3.5, borderBottomWidth: 3.5, borderBottomRightRadius: 10 },
  scanBeamWrap: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 12,
    justifyContent: 'center',
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
  stageCopy: { flex: 1, minWidth: 0 },
  stageTitle: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 23,
    lineHeight: 26,
  },
  stageTitleNarrow: { fontSize: 20, lineHeight: 23 },
  stageTitleCompact: { fontSize: 18, lineHeight: 21 },
  stageNote: {
    marginTop: 5,
    fontFamily: fonts.bodyMedium,
    color: 'rgba(244, 238, 255, 0.9)',
    fontSize: 13,
    lineHeight: 17.5,
  },
  stageNoteCompact: { marginTop: 2, fontSize: 11.5, lineHeight: 15 },

  stageCtaWrap: { zIndex: 3 },
  captureCta: {
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 11,
    overflow: 'hidden',
  },
  captureCtaCompact: { height: 46, paddingHorizontal: 8, gap: 8 },
  captureCtaCheck: { backgroundColor: '#FFC26E' },
  ctaSweep: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    width: 46,
    backgroundColor: 'rgba(255, 255, 255, 0.56)',
  },
  captureIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureIconBadgeCompact: { width: 32, height: 32, borderRadius: 16 },
  captureCtaText: { flex: 1, fontFamily: fonts.display, color: colors.ink, fontSize: 19, lineHeight: 22 },
  captureCtaTextCompact: { fontSize: 16.5, lineHeight: 20 },
  captureArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureArrowCompact: { width: 30, height: 30, borderRadius: 15 },

  // Refined studio dock
  lowerStack: { flexShrink: 0, gap: 10 },
  secondaryRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  secondaryRowCompact: { gap: 8 },
  secondaryTileWrap: { flex: 1, minWidth: 0 },
  secondaryTile: {
    height: 62,
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    gap: 10,
    overflow: 'hidden',
  },
  secondaryTileNarrow: { paddingHorizontal: 9, gap: 8 },
  secondaryTileCompact: { height: 50, borderRadius: 18, paddingHorizontal: 8, gap: 7 },
  galleryTile: { backgroundColor: 'rgba(241, 253, 255, 0.94)', borderColor: 'rgba(67, 214, 230, 0.28)' },
  mathTile: { backgroundColor: 'rgba(255, 252, 238, 0.94)', borderColor: 'rgba(255, 212, 71, 0.36)' },
  tileIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryIconBadge: { backgroundColor: '#DCF7FB' },
  mathIconBadge: { backgroundColor: '#FFF0BD' },
  tileIconBadgeCompact: { width: 34, height: 34, borderRadius: 11 },
  tileCopy: { flex: 1, minWidth: 0 },
  tileTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 17, lineHeight: 20 },
  tileTitleCompact: { fontSize: 15, lineHeight: 18 },
  tileNote: { marginTop: 1, fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 11.5, lineHeight: 14 },

  notebookGroup: { gap: 7 },
  notebookShelf: {
    minHeight: 68,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.11)',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 13,
    gap: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  notebookShelfCompact: { minHeight: 52, borderRadius: 18, paddingRight: 10, gap: 9 },
  notebookSpine: {
    width: 5,
    alignSelf: 'stretch',
    backgroundColor: colors.violet,
  },
  notebookIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#F3FFD2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notebookIconCompact: { width: 36, height: 36, borderRadius: 12 },
  notebookCopy: { flex: 1, minWidth: 0, paddingVertical: 8 },
  notebookHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  notebookTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 17.5, lineHeight: 21 },
  notebookTitleCompact: { fontSize: 15.5, lineHeight: 19 },
  countBadge: {
    minHeight: 19,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 10, lineHeight: 12, includeFontPadding: false },
  notebookNote: { marginTop: 1.5, fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 12, lineHeight: 15.5 },
  notebookArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notebookArrowCompact: { width: 28, height: 28, borderRadius: 14 },

  guidePill: {
    minHeight: 32,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(124, 60, 255, 0.065)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: 6,
    gap: 8,
  },
  guideText: { flex: 1, fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 11.5, lineHeight: 15 },
  guideDismiss: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studyQuickRibbon: {
    minHeight: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 8,
    gap: 8,
  },
  studyQuickText: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 12.5,
    lineHeight: 16,
  },
  studyQuickArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
