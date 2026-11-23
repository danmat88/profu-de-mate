import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useContext, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { bundledImageSource } from '../../../shared/services/bundledImages';
import { borders, colors, fonts, radii, shadows } from '../../../shared/theme';
import type { FlowMode } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { Chip } from '../../../shared/ui/Chip';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { Enter } from '../../../shared/ui/Enter';
import { IconButton } from '../../../shared/ui/IconButton';
import { Mascot, type MascotPose } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { SegmentedToggle, type SegmentedOption } from '../../../shared/ui/SegmentedToggle';
import { SpeechBubble, type SpeechBubbleTone } from '../../../shared/ui/SpeechBubble';
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
  onDismissGuide?: () => void;
  onClearGalleryError?: () => void;
  onMode: (mode: FlowMode) => void;
  onCapture: () => void;
  onGallery: () => void;
  onMath: () => void;
  onNotebook: () => void;
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

const HERO_HALFTONE_DOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

function solveGreeting(hour: number): string {
  if (hour >= 6 && hour < 12) return 'Bună dimineața!';
  if (hour >= 18 && hour < 23) return 'Lucrăm ceva azi?';
  return 'Salut! Ce rezolvăm?';
}

export function HomeSurface({
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
  onDismissGuide,
  onClearGalleryError,
  onMode,
  onCapture,
  onGallery,
  onMath,
  onNotebook,
  onSettings,
  onAllowance,
}: Props) {
  // The provider frame describes our actual root view. Android's window
  // dimensions can change independently while a native picker is dismissed.
  const frame = useSafeAreaFrame();
  const { contentWidth, height, fontScale, isVeryNarrow } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  // Navigation bars are hidden for this immersive screen; temporary bars
  // overlay Home instead of changing its spacing and responsive breakpoint.
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
  const beamProgress = useRef(new Animated.Value(0.5)).current;
  const sparkPulse = useRef(new Animated.Value(0)).current;
  const arrowNudge = useRef(new Animated.Value(0)).current;
  const ctaSheen = useRef(new Animated.Value(0)).current;
  const mascotHaloSpin = useRef(new Animated.Value(0)).current;
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

  // Ambient studio loops run strictly on native RenderThread and stop instantly on blur or transitionStart.
  useEffect(() => {
    if (!motionActive) {
      beamProgress.stopAnimation();
      sparkPulse.stopAnimation();
      arrowNudge.stopAnimation();
      ctaSheen.stopAnimation();
      mascotHaloSpin.stopAnimation();
      beamProgress.setValue(0.5);
      sparkPulse.setValue(0);
      arrowNudge.setValue(0);
      ctaSheen.setValue(0);
      mascotHaloSpin.setValue(0);
      return undefined;
    }

    const loops: Animated.CompositeAnimation[] = [];
    const startLoop = (anim: Animated.CompositeAnimation) => {
      loops.push(anim);
      anim.start();
    };

    mascotHaloSpin.setValue(0);
    startLoop(Animated.sequence([
      Animated.delay(340),
      Animated.loop(
        Animated.timing(mascotHaloSpin, {
          toValue: 1,
          duration: 28_000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    ]));

    if (hasPendingAnalysis) {
      beamProgress.stopAnimation();
      sparkPulse.stopAnimation();
      arrowNudge.stopAnimation();
      ctaSheen.stopAnimation();
      beamProgress.setValue(0.5);
      sparkPulse.setValue(0);
      arrowNudge.setValue(0);
      ctaSheen.setValue(0);
      return () => {
        loops.forEach((loop) => loop.stop());
        mascotHaloSpin.stopAnimation();
      };
    }

    beamProgress.setValue(0);
    startLoop(Animated.sequence([
      Animated.delay(380),
      Animated.loop(
        Animated.sequence([
          Animated.timing(beamProgress, {
            toValue: 1,
            duration: 1850,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(beamProgress, {
            toValue: 0,
            duration: 1850,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    ]));

    sparkPulse.setValue(0);
    startLoop(Animated.sequence([
      Animated.delay(400),
      Animated.loop(
        Animated.sequence([
          Animated.timing(sparkPulse, {
            toValue: 1,
            duration: 1350,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(sparkPulse, {
            toValue: 0,
            duration: 1350,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    ]));

    arrowNudge.setValue(0);
    startLoop(Animated.sequence([
      Animated.delay(440),
      Animated.loop(
        Animated.sequence([
          Animated.timing(arrowNudge, {
            toValue: 3.5,
            duration: 880,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(arrowNudge, {
            toValue: 0,
            duration: 880,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    ]));

    ctaSheen.setValue(0);
    startLoop(Animated.sequence([
      Animated.delay(850),
      Animated.loop(
        Animated.sequence([
          Animated.timing(ctaSheen, {
            toValue: 1,
            duration: 720,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(2_700),
          Animated.timing(ctaSheen, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ),
    ]));

    return () => {
      loops.forEach((loop) => loop.stop());
      beamProgress.stopAnimation();
      sparkPulse.stopAnimation();
      arrowNudge.stopAnimation();
      ctaSheen.stopAnimation();
      mascotHaloSpin.stopAnimation();
    };
  }, [arrowNudge, beamProgress, ctaSheen, hasPendingAnalysis, mascotHaloSpin, motionActive, sparkPulse]);

  // Smooth hero card gradient crossfade & spring settle when toggling Rezolvă <-> Verifică.
  useEffect(() => {
    const targetBlend = isSolve || hasPendingAnalysis ? 0 : 1;
    const anims: Animated.CompositeAnimation[] = [];
    if (reducedMotion || !motionReady || !focused) {
      modeBlend.stopAnimation();
      modeBlend.setValue(targetBlend);
    } else {
      const blendAnim = Animated.timing(modeBlend, {
        toValue: targetBlend,
        duration: 280,
        easing: Easing.out(Easing.cubic),
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
    const stageAnim = Animated.sequence([
      Animated.timing(stagePop, {
        toValue: 0.986,
        duration: 65,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(stagePop, {
        toValue: 1,
        tension: 260,
        friction: 18,
        useNativeDriver: true,
      }),
    ]);
    const medallionAnim = Animated.sequence([
      Animated.timing(medallionPop, {
        toValue: 0.88,
        duration: 70,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(medallionPop, {
        toValue: 1,
        tension: 210,
        friction: 14,
        useNativeDriver: true,
      }),
    ]);
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

  const stageAnimated = {
    transform: [{ scale: stagePop }],
  };

  const checkGradientStyle = {
    opacity: modeBlend,
  };

  const medallionAnimated = {
    transform: [{ scale: medallionPop }],
  };

  const beamRange = compact ? 22 : 34;
  const beamStyle = {
    opacity: hasPendingAnalysis ? 0 : 0.96,
    transform: [
      {
        translateY: beamProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [-beamRange, beamRange],
        }),
      },
    ],
  };

  const sparkStyle = {
    opacity: sparkPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.72, 1],
    }),
    transform: [
      {
        scale: sparkPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1.12],
        }),
      },
      {
        rotate: sparkPulse.interpolate({
          inputRange: [0, 1],
          outputRange: ['-8deg', '8deg'],
        }),
      },
    ],
  };

  const arrowStyle = {
    transform: [{ translateX: arrowNudge }],
  };

  const ctaSheenStyle = {
    opacity: ctaSheen.interpolate({
      inputRange: [0, 0.04, 0.96, 1],
      outputRange: [0, 0.36, 0.36, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: ctaSheen.interpolate({
          inputRange: [0, 1],
          outputRange: [-90, 340],
        }),
      },
      { skewX: '-22deg' },
    ],
  };

  const mascotHaloStyle = {
    transform: [
      {
        rotate: mascotHaloSpin.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  };

  const sparkArcOpacity = tapSpark.interpolate({
    inputRange: [0, 0.22, 0.5, 0.78, 1],
    outputRange: [0, 0.78, 1, 0.78, 0],
    extrapolate: 'clamp',
  });

  const sparkTopStyle = {
    opacity: sparkArcOpacity,
    transform: [
      {
        translateX: tapSpark.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -14],
        }),
      },
      {
        translateY: tapSpark.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -22],
        }),
      },
      {
        scale: tapSpark.interpolate({
          inputRange: [0, 1],
          outputRange: [0.5, 1.2],
        }),
      },
      {
        rotate: tapSpark.interpolate({
          inputRange: [0, 1],
          outputRange: ['-16deg', '18deg'],
        }),
      },
    ],
  };

  const sparkRightStyle = {
    opacity: sparkArcOpacity,
    transform: [
      {
        translateX: tapSpark.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 22],
        }),
      },
      {
        translateY: tapSpark.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -16],
        }),
      },
      {
        scale: tapSpark.interpolate({
          inputRange: [0, 1],
          outputRange: [0.45, 1.2],
        }),
      },
      {
        rotate: tapSpark.interpolate({
          inputRange: [0, 1],
          outputRange: ['18deg', '-18deg'],
        }),
      },
    ],
  };

  const sparkLeftStyle = {
    opacity: sparkArcOpacity,
    transform: [
      {
        translateX: tapSpark.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -22],
        }),
      },
      {
        translateY: tapSpark.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 6],
        }),
      },
      {
        scale: tapSpark.interpolate({
          inputRange: [0, 1],
          outputRange: [0.45, 1.1],
        }),
      },
      {
        rotate: tapSpark.interpolate({
          inputRange: [0, 1],
          outputRange: ['-10deg', '18deg'],
        }),
      },
    ],
  };

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

  const mascotSize = compact ? 74 : isVeryNarrow ? 90 : 102;
  const mascotHaloSize = compact ? 66 : isVeryNarrow ? 78 : 88;
  const cornerColor = isSolve || hasPendingAnalysis ? colors.lime : colors.gold;
  const energyPercent = energyRatio !== null
    ? `${Math.round((energyRatio > 0 ? Math.max(0.08, energyRatio) : 0) * 100)}%` as `${number}%`
    : null;
  const savedCountLabel = savedLessonsCount > 0
    ? `${savedLessonsCount} ${savedLessonsCount === 1 ? 'lecție' : 'lecții'}`
    : null;

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <View style={styles.homeScene}>
        <View style={[styles.page, { width: contentWidth }, compact && styles.pageCompact]}>
          <Enter ready={motionReady} delay={25} distance={14} scaleFrom={0.96} style={[styles.header, compact && styles.headerCompact]}>
            <View style={[styles.brandRow, isVeryNarrow && styles.brandRowNarrow]}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Profu’ de mate"
                depth={3}
                radius={compact || isVeryNarrow ? 11 : 14}
                shadowColor={colors.ink}
                haptic="selection"
                onPress={triggerTutorFromHeader}
                contentStyle={[styles.logo, (compact || isVeryNarrow) && styles.logoCompact]}
              >
                <View pointerEvents="none" style={styles.logoShine} />
                <Image
                  accessible={false}
                  source={bundledImageSource(require('../../../../assets/brand/profu_mark_v2.png'))}
                  resizeMode="contain"
                  style={[styles.logoImage, (compact || isVeryNarrow) && styles.logoImageCompact]}
                />
              </PressableScale>
              <Text
                maxFontSizeMultiplier={1.3}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.68}
                style={[styles.brand, (compact || isVeryNarrow) && styles.brandCompact]}
              >
                Profu’ de mate
              </Text>
            </View>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={allowance.accessibilityLabel}
              depth={shadows.sm}
              radius={14}
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
              <View pointerEvents="none" style={styles.pillShine} />
              {quotaExhausted ? (
                <ComicClockIcon size={15} color={colors.ink} accent={colors.peach} />
              ) : (
                <MiniGlyph name="spark" size={14} color={colors.ink} />
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
              size={compact ? 38 : 44}
              style={styles.settingsWrap}
            >
              <AppIcon name="settings" size={compact ? 28 : 32} />
            </IconButton>
          </Enter>

          <Enter ready={motionReady} delay={85} distance={18} scaleFrom={0.92} tiltFrom={-2} style={[styles.tutorRow, compact && styles.tutorRowCompact]}>
            <View style={[styles.tutorMascotStage, { width: mascotSize + 4, height: mascotSize + 2 }]}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.tutorHalo,
                  {
                    width: mascotHaloSize,
                    height: mascotHaloSize,
                    borderRadius: mascotHaloSize / 2,
                  },
                  (quotaExhausted || !isSolve) && !hasPendingAnalysis && !galleryError && styles.tutorHaloWarm,
                  (hasPendingAnalysis || activeCheer) && styles.tutorHaloLime,
                  galleryError && styles.tutorHaloError,
                  mascotHaloStyle,
                ]}
              />
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
              tail="left"
              compact={compact}
              messageKey={`${greetingTitle}:${greetingBody}`}
              onPress={triggerTutorFromHeader}
            />
          </Enter>

          <Enter ready={motionReady} delay={145} distance={16} scaleFrom={0.95}>
            <SegmentedToggle
              options={modeOptions}
              value={mode}
              onChange={onMode}
              disabled={pending || galleryBusy}
              dimWhenDisabled={!galleryBusy}
              compact={compact}
            />
          </Enter>

          <Enter ready={motionReady} delay={205} distance={20} scaleFrom={0.93} style={styles.cameraStageEnter}>
            <Animated.View
              style={[
                styles.cameraStageShadow,
                !isSolve && !hasPendingAnalysis && styles.cameraStageShadowCheck,
                stageAnimated,
              ]}
            >
              <View style={[styles.cameraStage, compact && styles.cameraStageCompact]}>
                {/* Base Solve gradient + smoothly crossfaded Check gradient overlay */}
                <LinearGradient
                  colors={['#9258FF', '#6D2CEB', '#4B19C0']}
                  start={{ x: 0.06, y: 0 }}
                  end={{ x: 0.94, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, checkGradientStyle]}>
                  <LinearGradient
                    colors={['#953AE8', '#C63474', '#941E56']}
                    start={{ x: 0.06, y: 0 }}
                    end={{ x: 0.94, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>

                <View pointerEvents="none" style={styles.stageGlowTop} />
                <View pointerEvents="none" style={styles.stageGlowBottom} />
                <View pointerEvents="none" style={styles.stageTopShine} />
                <View pointerEvents="none" style={styles.stageHalftone}>
                  {HERO_HALFTONE_DOTS.map((dot) => (
                    <View key={dot} style={styles.stageHalftoneDot} />
                  ))}
                </View>
                <Text accessible={false} style={styles.stageWatermark}>{isSolve ? 'π' : '✓'}</Text>

                <View style={[styles.stageTopRow, compact && styles.stageTopRowCompact]}>
                  <Chip
                    label={hasPendingAnalysis ? 'ANALIZĂ ÎN CURS' : isSolve ? 'PAS CU PAS' : 'FIECARE PAS'}
                    tone={hasPendingAnalysis || !isSolve ? 'gold' : 'lime'}
                    tilt={-2}
                  />
                  <View collapsable={false} style={styles.stageLivePill}>
                    <Animated.View style={sparkStyle}>
                      <Text accessible={false} style={[styles.stageSpark, { color: cornerColor }]}>✦</Text>
                    </Animated.View>
                    <Text maxFontSizeMultiplier={1.15} style={styles.stageLiveLabel}>
                      {hasPendingAnalysis ? 'ÎN CURS' : isSolve ? 'MOD FOTO' : 'VERIFICARE'}
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
                        size={compact ? 42 : isVeryNarrow ? 54 : 60}
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

                <View style={[styles.stageCtaWrap, compact && styles.stageCtaWrapCompact]}>
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
                    depth={compact ? 4 : shadows.md}
                    radius={18}
                    shadowColor={colors.ink}
                    haptic="medium"
                    onPress={onCapture}
                    contentStyle={[
                      styles.captureCta,
                      compact && styles.captureCtaCompact,
                      !isSolve && !hasPendingAnalysis && styles.captureCtaCheck,
                    ]}
                  >
                    <View pointerEvents="none" style={styles.ctaShine} />
                    <Animated.View pointerEvents="none" style={[styles.ctaSweep, ctaSheenStyle]} />
                    <View style={[styles.captureIconBadge, compact && styles.captureIconBadgeCompact]}>
                      <AppIcon name={hasPendingAnalysis ? 'scan' : 'camera'} size={compact ? 26 : 32} />
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
                      <MiniGlyph name="next" size={compact ? 18 : 21} color={colors.paper} />
                    </Animated.View>
                  </PressableScale>
                </View>
              </View>
            </Animated.View>
          </Enter>

          <View style={styles.lowerStack}>
            {!hasPendingAnalysis ? (
              <Enter ready={motionReady} delay={270} distance={16} scaleFrom={0.95} style={[styles.secondaryRow, compact && styles.secondaryRowCompact]}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Alege o fotografie din galerie"
                  accessibilityState={{ disabled: galleryBusy, busy: galleryBusy }}
                  disabled={galleryBusy}
                  dimWhenDisabled={false}
                  depth={compact ? 4 : shadows.md}
                  radius={20}
                  shadowColor={colors.ink}
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
                  <View pointerEvents="none" style={styles.tileShine} />
                  <View style={[styles.tileIconBadge, (compact || isVeryNarrow) && styles.tileIconBadgeCompact]}>
                    {galleryBusy ? <PlayfulLoader micro /> : <AppIcon name="gallery" size={compact || isVeryNarrow ? 26 : 34} />}
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
                  {!compact && !isVeryNarrow ? (
                    <View pointerEvents="none" style={[styles.tileChevron, styles.galleryChevron]}>
                      <MiniGlyph name="next" size={13} color={colors.ink} />
                    </View>
                  ) : null}
                </PressableScale>

                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Scrie o problemă sau o rezolvare"
                  accessibilityState={{ disabled: galleryBusy }}
                  disabled={galleryBusy}
                  dimWhenDisabled={false}
                  depth={compact ? 4 : shadows.md}
                  radius={20}
                  shadowColor={colors.ink}
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
                  <View pointerEvents="none" style={styles.tileShine} />
                  <View style={[styles.tileIconBadge, styles.mathIconBadge, (compact || isVeryNarrow) && styles.tileIconBadgeCompact]}>
                    <AppIcon name="practice" size={compact || isVeryNarrow ? 26 : 34} />
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
                  {!compact && !isVeryNarrow ? (
                    <View pointerEvents="none" style={[styles.tileChevron, styles.mathChevron]}>
                      <MiniGlyph name="next" size={13} color={colors.ink} />
                    </View>
                  ) : null}
                </PressableScale>
              </Enter>
            ) : null}

            <Enter ready={motionReady} delay={330} distance={15} scaleFrom={0.96} style={styles.notebookGroup}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={savedCountLabel ? `Deschide caietul cu ${savedCountLabel} salvate` : 'Deschide caietul cu lecții salvate'}
                depth={compact ? 4 : shadows.md}
                radius={20}
                shadowColor={colors.ink}
                haptic="selection"
                onPress={onNotebook}
                style={styles.notebookWrap}
                contentStyle={[styles.notebookShelf, compact && styles.notebookShelfCompact]}
              >
                <View pointerEvents="none" style={styles.notebookShine} />
                <View pointerEvents="none" style={styles.notebookBookmark}>
                  <View style={styles.notebookBookmarkNotch} />
                </View>
                <View pointerEvents="none" style={styles.notebookLines}>
                  <View style={styles.notebookLine} />
                  <View style={styles.notebookLine} />
                </View>
                <View style={styles.notebookSpine}>
                  <View style={styles.spineRing} />
                  <View style={styles.spineRing} />
                  {!compact ? <View style={styles.spineRing} /> : null}
                </View>
                <View style={[styles.notebookIcon, compact && styles.notebookIconCompact]}>
                  <AppIcon name="notebook" size={compact ? 34 : 42} />
                </View>
                <View style={styles.notebookCopy}>
                  <View style={styles.notebookHeaderRow}>
                    <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={styles.notebookKicker}>
                      CAIETUL MEU
                    </Text>
                    {savedCountLabel && !compact ? (
                      <View collapsable={false} style={styles.countBadge}>
                        <Text maxFontSizeMultiplier={1.1} style={styles.countBadgeText}>{savedCountLabel}</Text>
                      </View>
                    ) : null}
                    {latestLessonTitle && !compact && !isVeryNarrow ? (
                      <View collapsable={false} style={styles.latestBadge}>
                        <Text maxFontSizeMultiplier={1.1} style={styles.latestBadgeText}>ULTIMA</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[styles.notebookTitle, compact && styles.notebookTitleCompact]}>
                    {latestLessonTitle ? 'Revezi ce ai lucrat' : 'Lecții salvate'}
                  </Text>
                  {!compact ? (
                    <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={styles.notebookNote}>
                      {latestLessonTitle ? latestLessonTitle : 'Explicațiile tale, disponibile și offline'}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.notebookArrow, compact && styles.notebookArrowCompact]}>
                  <MiniGlyph name="next" size={compact ? 18 : 20} color={colors.paper} />
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
                      <MiniGlyph name="close" size={16} color={colors.violetDeep} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </Enter>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, overflow: 'hidden', backgroundColor: colors.canvas },
  homeScene: { flex: 1, overflow: 'hidden' },
  page: { flex: 1, minHeight: 0, maxWidth: 560, alignSelf: 'center', gap: 10, paddingTop: 4, paddingBottom: 8 },
  pageCompact: { gap: 7, paddingTop: 2 },

  // Header
  header: { height: 58, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCompact: { height: 44 },
  brandRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandRowNarrow: { gap: 7 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.lime,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    transform: [{ rotate: '-3deg' }],
  },
  logoCompact: { width: 36, height: 36, borderRadius: 11 },
  logoShine: {
    position: 'absolute',
    top: 2,
    left: 6,
    right: 6,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.shine,
  },
  logoImage: { width: 40, height: 40 },
  logoImageCompact: { width: 32, height: 32 },
  brand: { flex: 1, fontFamily: fonts.display, color: colors.ink, fontSize: 21, lineHeight: 25 },
  brandCompact: { fontSize: 17, lineHeight: 21 },

  allowanceWrap: { marginLeft: 8 },
  allowanceWrapNarrow: { marginLeft: 6 },
  allowancePill: {
    minWidth: 104,
    maxWidth: 132,
    height: 42,
    borderRadius: 14,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.limeSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingBottom: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  allowancePillCompact: { minWidth: 92, height: 36, paddingHorizontal: 7 },
  allowancePillPremium: { backgroundColor: colors.lime },
  allowancePillExhausted: { backgroundColor: colors.peachSoft },
  pillShine: {
    position: 'absolute',
    top: 2,
    left: 8,
    right: 8,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.shine,
  },
  energyTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3.5,
    backgroundColor: 'rgba(23, 19, 55, 0.12)',
  },
  energyFill: {
    height: '100%',
    backgroundColor: colors.violet,
    borderTopRightRadius: 2,
  },
  energyFillPremium: {
    backgroundColor: colors.ink,
  },
  energyFillEmpty: {
    backgroundColor: colors.peach,
  },
  allowanceCopy: { flexShrink: 1, minWidth: 0, alignItems: 'flex-start' },
  allowanceText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11.5, lineHeight: 13.5, includeFontPadding: false },
  allowanceNote: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 9.5, letterSpacing: 0.45, lineHeight: 11.5, includeFontPadding: false },
  settingsWrap: { marginLeft: 8 },

  // Tutor row (Owl on dashed halo stage + Speech Bubble)
  tutorRow: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 2 },
  tutorRowCompact: { gap: 2 },
  tutorMascotStage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  tutorHalo: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(124, 60, 255, 0.36)',
    backgroundColor: 'rgba(236, 226, 255, 0.56)',
  },
  tutorHaloWarm: {
    borderColor: 'rgba(255, 141, 107, 0.55)',
    backgroundColor: 'rgba(255, 228, 218, 0.62)',
  },
  tutorHaloLime: {
    borderColor: 'rgba(86, 120, 0, 0.4)',
    backgroundColor: 'rgba(240, 255, 186, 0.72)',
  },
  tutorHaloError: {
    borderColor: 'rgba(255, 87, 109, 0.55)',
    backgroundColor: 'rgba(255, 224, 229, 0.68)',
  },
  tapSpark: {
    position: 'absolute',
    zIndex: 8,
  },
  tapSparkTop: { top: 8, left: '42%' },
  tapSparkRight: { top: 18, right: 6 },
  tapSparkLeft: { bottom: 26, left: 6 },
  tapSparkLime: { fontFamily: fonts.display, fontSize: 16, color: colors.violet, textShadowColor: colors.lime, textShadowRadius: 0 },
  tapSparkGold: { fontFamily: fonts.display, fontSize: 14, color: colors.peach },
  tapSparkCyan: { fontFamily: fonts.display, fontSize: 13, color: colors.cyanDeep },

  // Hero camera stage
  cameraStageEnter: { flex: 1, minHeight: 0, width: '100%' },
  cameraStageShadow: { flex: 1, minHeight: 0, width: '100%', borderRadius: radii.xl, backgroundColor: colors.violetShadow, paddingBottom: shadows.lg },
  cameraStageShadowCheck: {
    backgroundColor: colors.berryDeep,
  },
  cameraStage: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    borderWidth: borders.thick,
    borderColor: colors.ink,
    borderRadius: radii.xl - 1,
    backgroundColor: colors.violet,
    justifyContent: 'space-between',
    padding: 13,
    position: 'relative',
  },
  cameraStageCompact: {
    padding: 10,
  },
  stageGlowTop: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -110,
    right: -60,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  stageGlowBottom: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    bottom: -70,
    left: -50,
    backgroundColor: 'rgba(23, 19, 55, 0.22)',
  },
  stageTopShine: {
    position: 'absolute',
    top: 4,
    left: 20,
    right: 20,
    height: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  stageHalftone: {
    position: 'absolute',
    top: 52,
    right: 14,
    width: 28,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    opacity: 0.22,
  },
  stageHalftoneDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: colors.paper,
  },
  stageWatermark: {
    position: 'absolute',
    right: 12,
    bottom: 58,
    fontFamily: fonts.display,
    fontSize: 78,
    lineHeight: 82,
    color: 'rgba(255, 255, 255, 0.08)',
    transform: [{ rotate: '12deg' }],
  },
  stageTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  stageTopRowCompact: {
    marginBottom: 2,
  },
  stageLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 11,
    borderWidth: 1.25,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    backgroundColor: 'rgba(18, 12, 46, 0.36)',
  },
  stageLiveLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.75,
    color: colors.paper,
    includeFontPadding: false,
  },
  stageSpark: {
    fontFamily: fonts.display,
    fontSize: 13.5,
    lineHeight: 15,
  },
  stageContent: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingHorizontal: 4,
    zIndex: 2,
  },
  stageContentCompact: {
    gap: 10,
    paddingHorizontal: 2,
  },
  focusFrame: {
    width: 98,
    height: 98,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  focusFrameCompact: {
    width: 72,
    height: 72,
  },
  focusFramePressed: {
    transform: [{ scale: 0.94 }],
  },
  focusGlass: {
    position: 'absolute',
    top: 8,
    right: 8,
    bottom: 8,
    left: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  focusMedallion: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusMedallionCompact: {
    width: 50,
    height: 50,
    borderRadius: 14,
  },
  focusCorner: { position: 'absolute', width: 24, height: 24 },
  focusCornerTL: { left: 0, top: 0, borderLeftWidth: 4.5, borderTopWidth: 4.5, borderTopLeftRadius: 9 },
  focusCornerTR: { right: 0, top: 0, borderRightWidth: 4.5, borderTopWidth: 4.5, borderTopRightRadius: 9 },
  focusCornerBL: { left: 0, bottom: 0, borderLeftWidth: 4.5, borderBottomWidth: 4.5, borderBottomLeftRadius: 9 },
  focusCornerBR: { right: 0, bottom: 0, borderRightWidth: 4.5, borderBottomWidth: 4.5, borderBottomRightRadius: 9 },
  scanBeamWrap: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 14,
    justifyContent: 'center',
  },
  scanBeamHalo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 7,
  },
  scanBeam: {
    width: '100%',
    height: 3.5,
    borderRadius: 3,
  },
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
    color: '#F2ECFF',
    fontSize: 13,
    lineHeight: 17.5,
  },
  stageNoteCompact: { marginTop: 2, fontSize: 11.5, lineHeight: 15 },

  stageCtaWrap: { zIndex: 3 },
  stageCtaWrapCompact: {},
  captureCta: {
    height: 58,
    borderRadius: 18,
    borderWidth: borders.thick,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
    overflow: 'hidden',
  },
  captureCtaCompact: {
    height: 48,
    borderRadius: 15,
    paddingHorizontal: 8,
    gap: 8,
  },
  captureCtaCheck: {
    backgroundColor: '#FFB86B',
  },
  ctaShine: {
    position: 'absolute',
    top: 3,
    left: 12,
    right: 12,
    height: 6,
    borderRadius: 5,
    backgroundColor: colors.shine,
  },
  ctaSweep: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    width: 46,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  captureIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureIconBadgeCompact: { width: 32, height: 32, borderRadius: 10 },
  captureCtaText: { flex: 1, fontFamily: fonts.display, color: colors.ink, fontSize: 20, lineHeight: 23 },
  captureCtaTextCompact: { fontSize: 17, lineHeight: 20 },
  captureArrow: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureArrowCompact: { width: 30, height: 30, borderRadius: 10 },

  // Secondary actions + Notebook shelf
  lowerStack: { flexShrink: 0, gap: 9 },
  secondaryRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  secondaryRowCompact: { gap: 8 },
  secondaryTileWrap: { flex: 1, minWidth: 0 },
  secondaryTile: {
    height: 68,
    borderRadius: 20,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    gap: 9,
    overflow: 'hidden',
  },
  secondaryTileNarrow: { paddingHorizontal: 9, gap: 8 },
  secondaryTileCompact: { height: 52, borderRadius: 16, paddingHorizontal: 8, gap: 7 },
  galleryTile: { backgroundColor: colors.cyanSoft },
  mathTile: { backgroundColor: colors.goldSoft },
  tileShine: {
    position: 'absolute',
    top: 3,
    left: 12,
    right: 12,
    height: 5,
    borderRadius: 4,
    backgroundColor: colors.shine,
  },
  tileIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  mathIconBadge: {
    transform: [{ rotate: '3deg' }],
  },
  tileIconBadgeCompact: { width: 34, height: 34, borderRadius: 11 },
  tileCopy: { flex: 1, minWidth: 0 },
  tileTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 17.5, lineHeight: 20 },
  tileTitleCompact: { fontSize: 15, lineHeight: 18 },
  tileNote: { marginTop: 1, fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 11.5, lineHeight: 14 },
  tileChevron: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  galleryChevron: { backgroundColor: colors.cyan },
  mathChevron: { backgroundColor: colors.gold },

  notebookGroup: { gap: 7 },
  notebookWrap: {},
  notebookShelf: {
    minHeight: 74,
    borderRadius: 20,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 11,
    gap: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  notebookShelfCompact: { minHeight: 54, borderRadius: 16, paddingRight: 9, gap: 9 },
  notebookShine: {
    position: 'absolute',
    top: 3,
    left: 22,
    right: 14,
    height: 5,
    borderRadius: 4,
    backgroundColor: colors.shine,
  },
  notebookBookmark: {
    position: 'absolute',
    top: -1,
    right: 54,
    width: 14,
    height: 16,
    backgroundColor: colors.peach,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.ink,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  notebookBookmarkNotch: {
    width: 6,
    height: 4,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: colors.paper,
    marginBottom: -1,
  },
  notebookLines: {
    position: 'absolute',
    left: 22,
    right: 14,
    top: 22,
    bottom: 16,
    justifyContent: 'space-evenly',
    opacity: 0.4,
  },
  notebookLine: {
    height: 1,
    backgroundColor: '#EAE1FA',
  },
  notebookSpine: {
    width: 16,
    alignSelf: 'stretch',
    backgroundColor: colors.cyan,
    borderRightWidth: borders.thin,
    borderRightColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 10,
  },
  spineRing: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
  },
  notebookIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  notebookIconCompact: { width: 38, height: 38, borderRadius: 12 },
  notebookCopy: { flex: 1, minWidth: 0, paddingVertical: 8 },
  notebookHeaderRow: { minHeight: 20, flexDirection: 'row', alignItems: 'center', gap: 5 },
  notebookKicker: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 10, letterSpacing: 0.85 },
  countBadge: {
    minHeight: 19,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 1.25,
    borderColor: colors.ink,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 9, lineHeight: 12, paddingHorizontal: 1, includeFontPadding: false },
  latestBadge: {
    minHeight: 19,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 1.25,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-2deg' }],
  },
  latestBadgeText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9, lineHeight: 12, letterSpacing: 0.4, paddingHorizontal: 1, includeFontPadding: false },
  notebookTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 17, lineHeight: 20, marginTop: 1 },
  notebookTitleCompact: { fontSize: 15, lineHeight: 18 },
  notebookNote: { marginTop: 1, fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 11.5, lineHeight: 15 },
  notebookArrow: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notebookArrowCompact: { width: 30, height: 30, borderRadius: 10 },

  guidePill: {
    minHeight: 34,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.paperTint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 13,
    paddingRight: 8,
    gap: 8,
  },
  guideText: { flex: 1, fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 11.5, lineHeight: 15 },
  guideDismiss: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
