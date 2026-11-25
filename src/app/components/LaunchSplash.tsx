import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';
import {
  cosinePulseRange,
  createNativeLoop,
  SILKY_EASE_IN_OUT,
  SILKY_EASE_OUT,
  sineDegreeRange,
  sineWaveRange,
  WAVE_INPUT_17,
} from '../../shared/motion/nativeMotion';
import { bundledImageSource } from '../../shared/services/bundledImages';
import * as Haptics from '../../shared/services/haptics';
import { colors, fonts, radii } from '../../shared/theme';
import { ComicBackdrop } from '../../shared/ui/ComicBackdrop';
import { Text } from '../../shared/ui/Typography';
import { resolveSplashMood } from '../utils/splashMood';

type Props = {
  ready: boolean;
  visualsReady: boolean;
  startupReady?: boolean;
  reducedMotion: boolean;
  onIntroSettled?: () => void;
  onRevealStart?: () => void;
  onFinish: () => void;
};

type VictorySparkSpec = {
  symbol: string;
  dx: number;
  dy: number;
  rotate: string;
  color: string;
  size: number;
};

// 17-point sinusoidal tables from the unified nativeMotion engine so single-timing
// Animated.loop calls execute natively via Android _startNativeLoop(-1).
const WAVE_INPUT = WAVE_INPUT_17;
// Owl floats calmly between -7dp (peak) and +2.5dp (rest) with a charming gentle sway.
const OWL_FLOAT_Y = sineWaveRange(-2.2, -4.8);
const OWL_TILT_DEG = sineDegreeRange(2.2, 0.65);
// Ground shadow responds in exact inverse phase: narrower/softer when owl rises, wider when owl lowers.
const SHADOW_SCALE_X = sineWaveRange(0.96, 0.13);
const SHADOW_OPACITY = sineWaveRange(0.14, 0.045);
// Luminous spotlight halo and twinkling glints breathe calmly behind the character.
const AURA_SCALE = cosinePulseRange(0.95, 1.04);
const AURA_OPACITY = cosinePulseRange(0.78, 1.0);
const SPARKLE_SCALE = cosinePulseRange(0.8, 1.14);
const SPARKLE_OPACITY = cosinePulseRange(0.45, 1.0);

// Unhurried, breathable native progress glide duration.
const PROGRESS_GLIDE_MS = 2_400;
const PROGRESS_START = 0.06;
const PROGRESS_GLIDE_CAP = 0.92;

const VICTORY_SPARKS: readonly VictorySparkSpec[] = [
  { symbol: '✦', dx: -102, dy: -78, rotate: '-28deg', color: colors.violet, size: 20 },
  { symbol: '+', dx: 104, dy: -70, rotate: '24deg', color: colors.cyan, size: 22 },
  { symbol: '✦', dx: -114, dy: 22, rotate: '-18deg', color: colors.gold, size: 19 },
  { symbol: '×', dx: 110, dy: 28, rotate: '30deg', color: colors.peach, size: 21 },
  { symbol: '★', dx: 6, dy: -118, rotate: '16deg', color: colors.limeDeep, size: 18 },
  { symbol: 'π', dx: -44, dy: -114, rotate: '-14deg', color: colors.violetBright, size: 18 },
];

const CAPABILITY_ITEMS = [
  { label: 'Poză', dot: colors.violet },
  { label: 'Formulă', dot: colors.cyan },
  { label: 'Pași clari', dot: colors.peach },
] as const;

const AMBIENT_MATH_WHISPERS = [
  { symbol: 'π', top: '12%' as const, left: 26, rotate: '-14deg', size: 23, color: 'rgba(124, 60, 255, 0.13)' },
  { symbol: '√', top: '15%' as const, right: 28, rotate: '12deg', size: 23, color: 'rgba(67, 214, 230, 0.24)' },
  { symbol: '∑', bottom: '28%' as const, left: 22, rotate: '-10deg', size: 24, color: 'rgba(255, 141, 107, 0.19)' },
  { symbol: '∞', bottom: '26%' as const, right: 24, rotate: '11deg', size: 25, color: 'rgba(124, 60, 255, 0.13)' },
] as const;

/**
 * Isolated progress header leaf whose smooth cubic-out counter mirrors the
 * native progress bar without ever re-rendering the floating mascot or backdrop.
 */
const SplashProgressHeader = memo(function SplashProgressHeader({
  ready,
  startupReady,
  introStarted,
  reducedMotion,
  stageLabel,
}: {
  ready: boolean;
  startupReady: boolean;
  introStarted: boolean;
  reducedMotion: boolean;
  stageLabel: string;
}) {
  const [displayPercent, setDisplayPercent] = useState(reducedMotion ? 100 : Math.round(PROGRESS_START * 100));
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (ready || reducedMotion) {
      setDisplayPercent(100);
      return undefined;
    }
    if (!introStarted) return undefined;
    if (startedAtRef.current === null) startedAtRef.current = Date.now();

    const interval = setInterval(() => {
      const elapsed = Math.max(0, Date.now() - (startedAtRef.current ?? Date.now()));
      const t = Math.min(1, elapsed / PROGRESS_GLIDE_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      const target = Math.round((PROGRESS_START + (PROGRESS_GLIDE_CAP - PROGRESS_START) * eased) * 100);
      setDisplayPercent((current) => (target > current ? target : current));
    }, 45);

    return () => clearInterval(interval);
  }, [introStarted, ready, reducedMotion]);

  return (
    <View style={styles.progressHeader}>
      <View style={styles.stageLabelRow}>
        <View
          style={[
            styles.stageDot,
            startupReady && styles.stageDotMid,
            ready && styles.stageDotReady,
          ]}
        />
        <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={styles.stageLabel}>
          {stageLabel}
        </Text>
      </View>
      <View collapsable={false} style={[styles.percentBadge, ready && styles.percentBadgeReady]}>
        <Text maxFontSizeMultiplier={1.2} style={[styles.percentText, ready && styles.percentTextReady]}>
          {ready ? 100 : displayPercent}%
        </Text>
      </View>
    </View>
  );
});

/**
 * Unhurried, flagship character-spotlight launch splash sharing the exact warm
 * cream canvas of Android native splash and Home. Choreographs a calm layered
 * entrance (spotlight -> Pixar squash-and-stretch owl -> wordmark -> highlighter
 * -> greeting & formula spark -> liquid progress bar), a joyful 100% dual-ripple
 * particle celebration with subtle haptic pulse, and a graceful staggered
 * spatial baton-pass into Home — 100% on Android RenderThread (zero Reanimated).
 */
export function LaunchSplash({
  ready,
  visualsReady,
  startupReady = false,
  reducedMotion,
  onIntroSettled,
  onRevealStart,
  onFinish,
}: Props) {
  const { width, height } = useSafeAreaFrame();
  const [mood] = useState(() => {
    const now = new Date();
    return resolveSplashMood(now.getHours(), now.getSeconds() + now.getMinutes() * 7 + now.getDate() * 13);
  });
  const [sceneReady, setSceneReady] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  const [introStarted, setIntroStarted] = useState(reducedMotion);
  const [introComplete, setIntroComplete] = useState(reducedMotion);
  const [passThrough, setPassThrough] = useState(false);

  // Pure native-driver Animated values (100% Android RenderThread, 0 Reanimated worklets).
  const auraEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const owlEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const greetingEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const copyEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const underlineReveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const formulaEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const progressEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const floatPhase = useRef(new Animated.Value(0)).current;
  const auraBreathPhase = useRef(new Animated.Value(0)).current;
  const orbitPhase = useRef(new Animated.Value(0)).current;
  const victoryBurst = useRef(new Animated.Value(0)).current;
  const owlCelebrate = useRef(new Animated.Value(0)).current;
  const progressFill = useRef(new Animated.Value(reducedMotion ? 1 : PROGRESS_START)).current;
  const barSheenPhase = useRef(new Animated.Value(0)).current;
  const progressExit = useRef(new Animated.Value(0)).current;
  const chromeExit = useRef(new Animated.Value(0)).current;
  const owlExit = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(1)).current;

  const introSettledRef = useRef(onIntroSettled);
  const revealStartRef = useRef(onRevealStart);
  const finishRef = useRef(onFinish);
  const introNotified = useRef(false);
  const revealed = useRef(false);
  const finished = useRef(false);
  const progressGlideStarted = useRef(false);
  const progressCompleted = useRef(false);
  const victoryHapticFired = useRef(false);
  const ambientLoopsRef = useRef<Animated.CompositeAnimation[]>([]);

  const handleSceneLayout = useCallback(() => setSceneReady(true), []);
  const compact = height < 720;
  const owlSize = compact ? 186 : Math.min(234, Math.round(width * 0.57));
  const orbitSize = owlSize + 60;
  const innerOrbitSize = owlSize + 20;
  // Deterministic geometry from frame width avoids mid-flight onLayout interpolation resets.
  const trackOuterWidth = Math.round(Math.max(222, Math.min(width - 70, 296)));
  const trackInnerWidth = Math.max(1, trackOuterWidth - 3);

  introSettledRef.current = onIntroSettled;
  revealStartRef.current = onRevealStart;
  finishRef.current = onFinish;

  const notifyIntroSettledOnce = useCallback(() => {
    setIntroComplete(true);
    if (introNotified.current) return;
    introNotified.current = true;
    introSettledRef.current?.();
  }, []);

  const notifyRevealOnce = useCallback(() => {
    if (revealed.current) return;
    revealed.current = true;
    revealStartRef.current?.();
  }, []);

  const finishOnce = useCallback(() => {
    notifyIntroSettledOnce();
    notifyRevealOnce();
    if (finished.current) return;
    finished.current = true;
    finishRef.current();
  }, [notifyIntroSettledOnce, notifyRevealOnce]);

  const stageLabel = ready
    ? 'Gata! Începem!'
    : startupReady
      ? 'Așez tabla de lucru…'
      : visualsReady
        ? 'Verific contul și caietul…'
        : 'Pregătesc culorile și formulele…';

  // Hide native splash once the warm canvas and owl artwork are painted, then play unhurried entrance.
  useEffect(() => {
    if (!sceneReady || !imageReady || !visualsReady) return undefined;
    let active = true;
    let introTimer: ReturnType<typeof setTimeout> | undefined;
    let ambientTimer: ReturnType<typeof setTimeout> | undefined;
    const oneShotAnims: Animated.CompositeAnimation[] = [];
    const loops: Animated.CompositeAnimation[] = [];

    const startTiming = (
      value: Animated.Value,
      toValue: number,
      duration: number,
      delay = 0,
      easing: (v: number) => number = SILKY_EASE_OUT,
    ) => {
      const anim = Animated.timing(value, {
        toValue,
        duration,
        delay,
        easing,
        useNativeDriver: true,
      });
      oneShotAnims.push(anim);
      anim.start();
    };

    const startNativeLoop = (value: Animated.Value, duration: number) => {
      const loop = createNativeLoop(value, duration);
      loops.push(loop);
      ambientLoopsRef.current.push(loop);
      loop.start();
    };

    const frame = requestAnimationFrame(() => {
      void SplashScreen.hideAsync().catch(() => undefined).then(() => {
        if (active) setNativeSplashHidden(true);
      });
      if (!active) return;
      setIntroStarted(true);
      if (reducedMotion) {
        auraEnter.setValue(1);
        owlEnter.setValue(1);
        greetingEnter.setValue(1);
        copyEnter.setValue(1);
        underlineReveal.setValue(1);
        formulaEnter.setValue(1);
        progressEnter.setValue(1);
        notifyIntroSettledOnce();
        return;
      }

      // Unhurried, deliberate 6-layer cinema choreography so every element shines.
      startTiming(auraEnter, 1, 780, 0);
      startTiming(owlEnter, 1, 720, 120);
      startTiming(copyEnter, 1, 620, 340);
      startTiming(underlineReveal, 1, 520, 520, SILKY_EASE_OUT);
      startTiming(greetingEnter, 1, 500, 600);
      startTiming(formulaEnter, 1, 520, 660);
      startTiming(progressEnter, 1, 520, 760);

      // Gentle pure-native RenderThread living loops engage smoothly as the owl settles.
      ambientTimer = setTimeout(() => {
        if (!active) return;
        startNativeLoop(floatPhase, 3_400);
        startNativeLoop(auraBreathPhase, 3_900);
        startNativeLoop(orbitPhase, 38_000);
      }, 720);

      // Mount Home behind the splash only after the unhurried entrance is completely settled.
      introTimer = setTimeout(() => {
        if (active) notifyIntroSettledOnce();
      }, 1_180);
    });
    const introFallback = setTimeout(() => {
      if (active) notifyIntroSettledOnce();
    }, 1_650);

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      if (introTimer) clearTimeout(introTimer);
      if (ambientTimer) clearTimeout(ambientTimer);
      clearTimeout(introFallback);
      oneShotAnims.forEach((anim) => anim.stop());
      loops.forEach((loop) => loop.stop());
      ambientLoopsRef.current = [];
      floatPhase.stopAnimation();
      auraBreathPhase.stopAnimation();
      orbitPhase.stopAnimation();
    };
  }, [
    auraBreathPhase,
    auraEnter,
    copyEnter,
    floatPhase,
    formulaEnter,
    greetingEnter,
    imageReady,
    notifyIntroSettledOnce,
    orbitPhase,
    owlEnter,
    progressEnter,
    reducedMotion,
    sceneReady,
    underlineReveal,
    visualsReady,
  ]);

  // One uninterrupted native progress glide from 6% -> 92% (never stops/restarts mid-load).
  useEffect(() => {
    if (reducedMotion) {
      progressFill.setValue(ready ? 1 : 0.85);
      return undefined;
    }
    if (!introStarted || progressGlideStarted.current || progressCompleted.current) return undefined;
    progressGlideStarted.current = true;
    Animated.timing(progressFill, {
      toValue: PROGRESS_GLIDE_CAP,
      duration: PROGRESS_GLIDE_MS,
      easing: SILKY_EASE_OUT,
      useNativeDriver: true,
    }).start();
    return undefined;
  }, [introStarted, progressFill, ready, reducedMotion]);

  // Smooth unhurried completion glide to 100% once startup and navigation are ready.
  useEffect(() => {
    if (!ready || progressCompleted.current) return undefined;
    progressCompleted.current = true;
    if (reducedMotion) {
      progressFill.setValue(1);
      return undefined;
    }
    const anim = Animated.timing(progressFill, {
      toValue: 1,
      duration: 360,
      easing: SILKY_EASE_OUT,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progressFill, ready, reducedMotion]);

  // Continuous single-timing native shimmer wave gliding smoothly across the liquid bar.
  useEffect(() => {
    if (reducedMotion || !introStarted || ready) {
      barSheenPhase.stopAnimation();
      barSheenPhase.setValue(0);
      return undefined;
    }
    const sheenLoop = createNativeLoop(barSheenPhase, 1_450);
    sheenLoop.start();
    return () => {
      sheenLoop.stop();
      barSheenPhase.stopAnimation();
    };
  }, [barSheenPhase, introStarted, ready, reducedMotion]);

  // Unhurried 100% celebration + calm staggered spatial handoff into Home.
  useEffect(() => {
    if (!ready || !introComplete || !nativeSplashHidden) return undefined;
    if (reducedMotion) {
      finishOnce();
      return undefined;
    }
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    let passThroughTimer: ReturnType<typeof setTimeout> | undefined;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    const exitAnims: Animated.CompositeAnimation[] = [];

    const startAnim = (anim: Animated.CompositeAnimation) => {
      exitAnims.push(anim);
      anim.start();
    };

    if (!victoryHapticFired.current) {
      victoryHapticFired.current = true;
      Haptics.selection();
    }

    victoryBurst.setValue(0);
    owlCelebrate.setValue(0);
    startAnim(Animated.timing(victoryBurst, {
      toValue: 1,
      duration: 680,
      easing: SILKY_EASE_OUT,
      useNativeDriver: true,
    }));
    startAnim(Animated.timing(owlCelebrate, {
      toValue: 1,
      duration: 420,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }));

    const beatTimer = setTimeout(() => {
      // Quietly release splash idle loops right before the curtain opens so RenderThread stays 100% focused on the handoff.
      ambientLoopsRef.current.forEach((loop) => loop.stop());
      ambientLoopsRef.current = [];
      floatPhase.stopAnimation();
      auraBreathPhase.stopAnimation();
      orbitPhase.stopAnimation();

      // Unhurried cinema exit matching LaunchSplash intro: progress glides down -> copy dissolves -> owl arcs up-right -> canvas melts.
      startAnim(Animated.timing(progressExit, {
        toValue: 1,
        duration: 340,
        easing: SILKY_EASE_IN_OUT,
        useNativeDriver: true,
      }));
      startAnim(Animated.timing(chromeExit, {
        toValue: 1,
        duration: 360,
        delay: 70,
        easing: SILKY_EASE_IN_OUT,
        useNativeDriver: true,
      }));
      startAnim(Animated.timing(owlExit, {
        toValue: 1,
        duration: 500,
        delay: 110,
        easing: SILKY_EASE_IN_OUT,
        useNativeDriver: true,
      }));
      startAnim(Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 420,
        delay: 260,
        easing: SILKY_EASE_IN_OUT,
        useNativeDriver: true,
      }));
      // Launch Home unhurried pre-baked GPU choreography right as the cream veil turns translucent.
      revealTimer = setTimeout(notifyRevealOnce, 300);
      // Pass touches cleanly to Home the instant the splash veil reaches opacity 0.
      passThroughTimer = setTimeout(() => setPassThrough(true), 680);
      // Unmount LaunchSplash strictly AFTER Home entrance finishes landing so zero view-teardown hitch interrupts motion.
      exitTimer = setTimeout(finishOnce, 1_320);
    }, 480);

    return () => {
      clearTimeout(beatTimer);
      if (revealTimer) clearTimeout(revealTimer);
      if (passThroughTimer) clearTimeout(passThroughTimer);
      if (exitTimer) clearTimeout(exitTimer);
      exitAnims.forEach((anim) => anim.stop());
    };
  }, [
    auraBreathPhase,
    backdropOpacity,
    chromeExit,
    finishOnce,
    floatPhase,
    introComplete,
    nativeSplashHidden,
    notifyRevealOnce,
    orbitPhase,
    owlCelebrate,
    owlExit,
    progressExit,
    ready,
    reducedMotion,
    victoryBurst,
  ]);

  // Bounded hard deadline guarantees the splash can never stall launch.
  useEffect(() => {
    if (!sceneReady || !imageReady || !visualsReady || !nativeSplashHidden || !ready) return undefined;
    const hardDeadline = setTimeout(finishOnce, 2_500);
    return () => clearTimeout(hardDeadline);
  }, [finishOnce, imageReady, nativeSplashHidden, ready, sceneReady, visualsReady]);

  // Strictly memoized interpolations keep Android Fabric native node graphs intact across renders.
  const rootAnimated = useMemo(() => ({ opacity: backdropOpacity }), [backdropOpacity]);

  const progressExitStyle = useMemo(() => ({
    opacity: progressExit.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: progressExit.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 18],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [progressExit]);

  const chromeExitStyle = useMemo(() => ({
    opacity: chromeExit.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: chromeExit.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -10],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [chromeExit]);

  const owlSpatialExitStyle = useMemo(() => ({
    opacity: owlExit.interpolate({
      inputRange: [0, 0.72, 1],
      outputRange: [1, 0.62, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: owlExit.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 76],
          extrapolate: 'clamp',
        }),
      },
      {
        translateY: owlExit.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -116],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: owlExit.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.46],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [owlExit]);

  const auraEnterStyle = useMemo(() => ({
    opacity: auraEnter.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        scale: auraEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [0.74, 1],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [auraEnter]);

  const auraBreathStyle = useMemo(() => ({
    opacity: auraBreathPhase.interpolate({
      inputRange: WAVE_INPUT,
      outputRange: AURA_OPACITY,
    }),
    transform: [
      {
        scale: auraBreathPhase.interpolate({
          inputRange: WAVE_INPUT,
          outputRange: AURA_SCALE,
        }),
      },
    ],
  }), [auraBreathPhase]);

  const sparkleBreathStyle = useMemo(() => ({
    opacity: auraBreathPhase.interpolate({
      inputRange: WAVE_INPUT,
      outputRange: SPARKLE_OPACITY,
    }),
    transform: [
      {
        scale: auraBreathPhase.interpolate({
          inputRange: WAVE_INPUT,
          outputRange: SPARKLE_SCALE,
        }),
      },
    ],
  }), [auraBreathPhase]);

  const outerOrbitStyle = useMemo(() => ({
    transform: [
      {
        rotate: orbitPhase.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  }), [orbitPhase]);

  const innerOrbitStyle = useMemo(() => ({
    transform: [
      {
        rotate: orbitPhase.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '-360deg'],
        }),
      },
    ],
  }), [orbitPhase]);

  const primaryVictoryRippleStyle = useMemo(() => ({
    opacity: victoryBurst.interpolate({
      inputRange: [0, 0.14, 0.84, 1],
      outputRange: [0, 0.78, 0.14, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        scale: victoryBurst.interpolate({
          inputRange: [0, 1],
          outputRange: [0.74, 1.44],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [victoryBurst]);

  const secondaryVictoryRippleStyle = useMemo(() => ({
    opacity: victoryBurst.interpolate({
      inputRange: [0, 0.14, 0.28, 0.9, 1],
      outputRange: [0, 0, 0.45, 0.08, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        scale: victoryBurst.interpolate({
          inputRange: [0, 0.14, 1],
          outputRange: [0.72, 0.72, 1.3],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [victoryBurst]);

  const victorySparkStyles = useMemo(() => VICTORY_SPARKS.map((spark) => ({
    opacity: victoryBurst.interpolate({
      inputRange: [0, 0.14, 0.68, 1],
      outputRange: [0, 1, 0.88, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: victoryBurst.interpolate({
          inputRange: [0, 1],
          outputRange: [0, spark.dx],
          extrapolate: 'clamp',
        }),
      },
      {
        translateY: victoryBurst.interpolate({
          inputRange: [0, 1],
          outputRange: [0, spark.dy],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: victoryBurst.interpolate({
          inputRange: [0, 0.28, 1],
          outputRange: [0.32, 1.18, 0.72],
          extrapolate: 'clamp',
        }),
      },
      {
        rotate: victoryBurst.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', spark.rotate],
          extrapolate: 'clamp',
        }),
      },
    ],
  })), [victoryBurst]);

  // Volume-preserving Pixar squash-and-stretch entrance for the floating owl.
  const owlEnterStyle = useMemo(() => ({
    opacity: owlEnter.interpolate({
      inputRange: [0, 0.42, 1],
      outputRange: [0, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: owlEnter.interpolate({
          inputRange: [0, 0.56, 0.8, 1],
          outputRange: [34, -5, 1.5, 0],
          extrapolate: 'clamp',
        }),
      },
      {
        scaleX: owlEnter.interpolate({
          inputRange: [0, 0.52, 0.74, 0.88, 1],
          outputRange: [0.78, 0.955, 1.045, 0.99, 1],
          extrapolate: 'clamp',
        }),
      },
      {
        scaleY: owlEnter.interpolate({
          inputRange: [0, 0.52, 0.74, 0.88, 1],
          outputRange: [0.84, 1.045, 0.96, 1.01, 1],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [owlEnter]);

  const owlFloatStyle = useMemo(() => ({
    transform: [
      {
        translateY: floatPhase.interpolate({
          inputRange: WAVE_INPUT,
          outputRange: OWL_FLOAT_Y,
        }),
      },
      {
        rotate: floatPhase.interpolate({
          inputRange: WAVE_INPUT,
          outputRange: OWL_TILT_DEG,
        }),
      },
    ],
  }), [floatPhase]);

  const owlCelebrateStyle = useMemo(() => ({
    transform: [
      {
        translateY: owlCelebrate.interpolate({
          inputRange: [0, 0.46, 1],
          outputRange: [0, -7, 0],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: owlCelebrate.interpolate({
          inputRange: [0, 0.46, 1],
          outputRange: [1, 1.075, 1],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [owlCelebrate]);

  const greetingPillStyle = useMemo(() => ({
    opacity: greetingEnter.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [0, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: greetingEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: greetingEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [0.86, 1],
          extrapolate: 'clamp',
        }),
      },
      { rotate: '4deg' },
    ],
  }), [greetingEnter]);

  const groundShadowStyle = useMemo(() => ({
    opacity: floatPhase.interpolate({
      inputRange: WAVE_INPUT,
      outputRange: SHADOW_OPACITY,
    }),
    transform: [
      {
        scaleX: floatPhase.interpolate({
          inputRange: WAVE_INPUT,
          outputRange: SHADOW_SCALE_X,
        }),
      },
    ],
  }), [floatPhase]);

  const copyEnterStyle = useMemo(() => ({
    opacity: copyEnter.interpolate({
      inputRange: [0, 0.68, 1],
      outputRange: [0, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: copyEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [copyEnter]);

  const underlineAnimated = useMemo(() => ({
    opacity: underlineReveal,
    transform: [
      {
        scaleX: underlineReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [0.02, 1],
          extrapolate: 'clamp',
        }),
      },
      { rotate: '-1.2deg' },
    ],
  }), [underlineReveal]);

  const formulaEnterStyle = useMemo(() => ({
    opacity: formulaEnter.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [0, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: formulaEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: formulaEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [0.94, 1],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [formulaEnter]);

  const progressEnterStyle = useMemo(() => ({
    opacity: progressEnter.interpolate({
      inputRange: [0, 0.68, 1],
      outputRange: [0, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: progressEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [progressEnter]);

  const fillTransformStyle = useMemo(() => ({
    transform: [
      {
        translateX: progressFill.interpolate({
          inputRange: [0, 1],
          outputRange: [-trackInnerWidth, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [progressFill, trackInnerWidth]);

  const barSheenStyle = useMemo(() => ({
    opacity: barSheenPhase.interpolate({
      inputRange: [0, 0.14, 0.56, 0.72, 1],
      outputRange: [0, 0.62, 0.62, 0, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: barSheenPhase.interpolate({
          inputRange: [0, 0.72, 1],
          outputRange: [-54, trackInnerWidth + 54, trackInnerWidth + 54],
        }),
      },
      { skewX: '-22deg' },
    ],
  }), [barSheenPhase, trackInnerWidth]);

  const milestones = [
    { key: 'visuals', label: 'Resurse', done: visualsReady },
    { key: 'account', label: 'Cont', done: startupReady },
    { key: 'board', label: 'Tablă', done: ready },
  ] as const;

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={handleSceneLayout}
      pointerEvents={passThrough ? 'none' : 'auto'}
      style={[styles.root, rootAnimated]}
    >
      <StatusBar style="dark" />

      {/* Mount custom-font text and backdrop symbols only after Font.loadAsync
          has resolved so Android never caches a temporary fallback typeface. */}
      {visualsReady ? (
        <>
          <ComicBackdrop />

          {/* Whisper-light peripheral math symbols giving subtle studio atmosphere */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, chromeExitStyle]}>
            {AMBIENT_MATH_WHISPERS.map((item) => (
              <Text
                key={item.symbol}
                accessible={false}
                style={[
                  styles.ambientSymbol,
                  {
                    top: 'top' in item ? item.top : undefined,
                    bottom: 'bottom' in item ? item.bottom : undefined,
                    left: 'left' in item ? item.left : undefined,
                    right: 'right' in item ? item.right : undefined,
                    color: item.color,
                    fontSize: item.size,
                    lineHeight: item.size + 4,
                    transform: [{ rotate: item.rotate }],
                  },
                ]}
              >
                {item.symbol}
              </Text>
            ))}
          </Animated.View>

          <View style={[styles.stage, compact && styles.stageCompact]}>
            <View style={styles.topSpacer} />

            {/* Flagship free-floating character spotlight */}
            <View style={styles.centerCluster}>
              <View style={[styles.heroStage, { width: orbitSize + 18, height: orbitSize + 8 }]}>
                {/* Time-aware radial studio spotlight, dual counter-rotating orbits & victory burst */}
                <Animated.View pointerEvents="none" style={[styles.auraWrap, chromeExitStyle]}>
                  <Animated.View style={[styles.auraWrap, auraEnterStyle]}>
                    <Animated.View
                      style={[
                        styles.auraOuter,
                        {
                          width: orbitSize,
                          height: orbitSize,
                          borderRadius: orbitSize / 2,
                          backgroundColor: mood.auraOuter,
                        },
                        auraBreathStyle,
                      ]}
                    >
                      <View
                        style={[
                          styles.auraMid,
                          {
                            width: Math.round(orbitSize * 0.78),
                            height: Math.round(orbitSize * 0.78),
                            borderRadius: Math.round(orbitSize * 0.39),
                            backgroundColor: mood.auraMid,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.auraCore,
                            {
                              width: Math.round(orbitSize * 0.58),
                              height: Math.round(orbitSize * 0.58),
                              borderRadius: Math.round(orbitSize * 0.29),
                            },
                          ]}
                        />
                      </View>
                    </Animated.View>

                    {/* Outer clockwise orbit with vibrant comic beads */}
                    <Animated.View
                      style={[
                        styles.orbitRing,
                        {
                          width: orbitSize - 6,
                          height: orbitSize - 6,
                          borderRadius: (orbitSize - 6) / 2,
                          borderColor: mood.orbitColor,
                        },
                        outerOrbitStyle,
                      ]}
                    >
                      <View style={[styles.orbitBead, styles.orbitBeadLime]} />
                      <View style={[styles.orbitBead, styles.orbitBeadCyan]} />
                      <View style={[styles.orbitBeadSmall, styles.orbitBeadPeach]} />
                    </Animated.View>

                    {/* Delicate inner counter-rotating orbit with twinkling studio glints */}
                    <Animated.View
                      style={[
                        styles.innerOrbitRing,
                        { width: innerOrbitSize, height: innerOrbitSize, borderRadius: innerOrbitSize / 2 },
                        innerOrbitStyle,
                      ]}
                    >
                      <Animated.View style={[styles.orbitSparkleAnchor, styles.orbitSparkleTop, sparkleBreathStyle]}>
                        <Text accessible={false} style={[styles.orbitSparkle, styles.orbitSparkleGold]}>✦</Text>
                      </Animated.View>
                      <Animated.View style={[styles.orbitSparkleAnchor, styles.orbitSparkleBottom, sparkleBreathStyle]}>
                        <Text accessible={false} style={[styles.orbitSparkle, styles.orbitSparkleViolet]}>✦</Text>
                      </Animated.View>
                    </Animated.View>

                    {/* Dual celebratory ripples + 6 math sparks bursting at 100% */}
                    <Animated.View
                      style={[
                        styles.victoryRipplePrimary,
                        { width: innerOrbitSize, height: innerOrbitSize, borderRadius: innerOrbitSize / 2 },
                        primaryVictoryRippleStyle,
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.victoryRippleSecondary,
                        { width: innerOrbitSize, height: innerOrbitSize, borderRadius: innerOrbitSize / 2 },
                        secondaryVictoryRippleStyle,
                      ]}
                    />
                    {VICTORY_SPARKS.map((spark, index) => (
                      <Animated.View
                        key={`${spark.symbol}-${index}`}
                        style={[styles.victorySparkAnchor, victorySparkStyles[index]]}
                      >
                        <Text
                          accessible={false}
                          style={[
                            styles.victorySparkText,
                            { color: spark.color, fontSize: spark.size, lineHeight: spark.size + 3 },
                          ]}
                        >
                          {spark.symbol}
                        </Text>
                      </Animated.View>
                    ))}
                  </Animated.View>
                </Animated.View>

                {/* Airy time-of-day thought-greeting pill tucked cleanly near the top-right */}
                <Animated.View pointerEvents="none" style={[styles.greetingAnchor, chromeExitStyle]}>
                  <Animated.View style={greetingPillStyle}>
                    <View
                      collapsable={false}
                      style={[styles.greetingPill, ready && styles.greetingPillReady]}
                    >
                      <View style={[styles.greetingDot, ready && styles.greetingDotReady]} />
                      <Text maxFontSizeMultiplier={1.15} style={styles.greetingText}>
                        {ready ? 'Gata!' : mood.greeting}
                      </Text>
                    </View>
                    <View style={styles.greetingTrail}>
                      <View style={[styles.greetingTrailDotLarge, ready && styles.greetingTrailDotReady]} />
                      <View style={[styles.greetingTrailDotSmall, ready && styles.greetingTrailDotReady]} />
                    </View>
                  </Animated.View>
                </Animated.View>

                {/* Free-floating illustrated owl gliding spatially toward Home on exit */}
                <Animated.View style={[styles.owlAnchor, owlSpatialExitStyle]}>
                  <Animated.View style={owlEnterStyle}>
                    <Animated.View style={owlCelebrateStyle}>
                      <Animated.View style={owlFloatStyle}>
                        <Image
                          accessible={false}
                          source={bundledImageSource(require('../../../assets/brand/splash_mark_v2.png'))}
                          resizeMode="contain"
                          fadeDuration={0}
                          onLoad={() => setImageReady(true)}
                          style={{ width: owlSize, height: owlSize }}
                        />
                      </Animated.View>
                    </Animated.View>
                  </Animated.View>
                  <Animated.View pointerEvents="none" style={chromeExitStyle}>
                    <Animated.View
                      style={[
                        styles.groundShadow,
                        { width: Math.round(owlSize * 0.54) },
                        groundShadowStyle,
                      ]}
                    />
                  </Animated.View>
                </Animated.View>
              </View>

              {/* Confident wordmark + unhurried rotating formula gem + feather-light capabilities */}
              <Animated.View style={[styles.identityExitWrap, chromeExitStyle]}>
                <Animated.View style={[styles.identityBlock, copyEnterStyle]}>
                  <View style={styles.wordmarkWrap}>
                    <Animated.View pointerEvents="none" style={[styles.markerHighlight, underlineAnimated]} />
                    <Text
                      maxFontSizeMultiplier={1.3}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.82}
                      style={[styles.brand, compact && styles.brandCompact]}
                    >
                      Profu’ <Text style={styles.brandAccent}>de mate</Text>
                    </Text>
                  </View>
                  <Text maxFontSizeMultiplier={1.3} style={styles.promise}>
                    Matematica, pas cu pas.
                  </Text>
                </Animated.View>

                {!compact ? (
                  <Animated.View style={[styles.secondaryIdentity, formulaEnterStyle]}>
                    <View collapsable={false} style={styles.formulaSparkPill}>
                      <View style={styles.formulaSparkGem}>
                        <Text accessible={false} style={styles.formulaSparkStar}>✦</Text>
                      </View>
                      <Text maxFontSizeMultiplier={1.15} style={styles.formulaSparkText}>
                        {mood.formula}
                      </Text>
                    </View>

                    <View style={styles.capabilityRow}>
                      {CAPABILITY_ITEMS.map((item) => (
                        <View key={item.label} style={styles.capabilityItem}>
                          <View style={[styles.capabilityDot, { backgroundColor: item.dot }]} />
                          <Text maxFontSizeMultiplier={1.15} style={styles.capabilityText}>
                            {item.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Animated.View>
                ) : null}
              </Animated.View>
            </View>

            {/* Sleek floating liquid progress strip + whisper-light milestone dots */}
            <Animated.View style={progressExitStyle}>
              <Animated.View style={[styles.progressBlock, { width: trackOuterWidth }, progressEnterStyle]}>
                <SplashProgressHeader
                  ready={ready}
                  startupReady={startupReady}
                  introStarted={introStarted}
                  reducedMotion={reducedMotion}
                  stageLabel={stageLabel}
                />

                <View style={[styles.barGlowFrame, { width: trackOuterWidth + 6 }]}>
                  <View style={[styles.barTrack, { width: trackOuterWidth }]}>
                    <Animated.View style={[styles.barFill, ready && styles.barFillReady, fillTransformStyle]}>
                      <View pointerEvents="none" style={styles.barFillHighlight} />
                      <Animated.View pointerEvents="none" style={[styles.barSheen, barSheenStyle]} />
                      <View pointerEvents="none" style={styles.barLeadingGlow} />
                    </Animated.View>
                  </View>
                </View>

                <View style={styles.milestonesRow}>
                  {milestones.map((item) => (
                    <View key={item.key} style={styles.milestoneItem}>
                      <View style={[styles.milestoneDot, item.done && styles.milestoneDotDone]} />
                      <Text
                        maxFontSizeMultiplier={1.15}
                        style={[styles.milestoneLabel, item.done && styles.milestoneLabelDone]}
                      >
                        {item.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            </Animated.View>
          </View>
        </>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    overflow: 'hidden',
    backgroundColor: colors.canvas,
  },
  ambientSymbol: {
    position: 'absolute',
    fontFamily: fonts.display,
    includeFontPadding: false,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: '10%',
    paddingBottom: '10%',
  },
  stageCompact: {
    paddingTop: '7%',
    paddingBottom: '8%',
  },
  topSpacer: {
    height: 10,
  },
  centerCluster: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },

  // Free-floating mascot spotlight stage
  heroStage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  auraWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auraOuter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  auraMid: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  auraCore: {
    backgroundColor: 'rgba(255, 255, 255, 0.74)',
  },
  orbitRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  innerOrbitRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.1)',
  },
  orbitBead: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.75,
    borderColor: colors.ink,
  },
  orbitBeadSmall: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  orbitBeadLime: {
    top: -6,
    left: '50%',
    marginLeft: -5.5,
    backgroundColor: colors.lime,
  },
  orbitBeadCyan: {
    bottom: 24,
    right: 12,
    backgroundColor: colors.cyan,
  },
  orbitBeadPeach: {
    bottom: 34,
    left: 10,
    backgroundColor: colors.peach,
  },
  orbitSparkleAnchor: {
    position: 'absolute',
  },
  orbitSparkle: {
    fontFamily: fonts.display,
    fontSize: 15,
    lineHeight: 18,
    includeFontPadding: false,
  },
  orbitSparkleTop: {
    top: 12,
    left: 18,
  },
  orbitSparkleBottom: {
    bottom: 14,
    right: 18,
  },
  orbitSparkleGold: {
    color: colors.gold,
  },
  orbitSparkleViolet: {
    color: colors.violet,
  },
  victoryRipplePrimary: {
    position: 'absolute',
    borderWidth: 3.5,
    borderColor: colors.lime,
  },
  victoryRippleSecondary: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.violetBright,
  },
  victorySparkAnchor: {
    position: 'absolute',
  },
  victorySparkText: {
    fontFamily: fonts.display,
    includeFontPadding: false,
  },

  // Airy thought-greeting pill tucked cleanly near the top-right
  greetingAnchor: {
    position: 'absolute',
    top: 4,
    right: -2,
    zIndex: 8,
  },
  greetingPill: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: '#E2D6FA',
    backgroundColor: colors.paper,
    elevation: 2,
  },
  greetingPillReady: {
    borderColor: colors.ink,
    backgroundColor: colors.lime,
  },
  greetingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.violet,
  },
  greetingDotReady: {
    backgroundColor: colors.ink,
  },
  greetingText: {
    fontFamily: fonts.display,
    fontSize: 12.5,
    lineHeight: 15,
    color: colors.ink,
    includeFontPadding: false,
  },
  greetingTrail: {
    marginTop: 3,
    marginLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  greetingTrailDotLarge: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.2,
    borderColor: '#D6C6F7',
    backgroundColor: colors.paper,
  },
  greetingTrailDotSmall: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D6C6F7',
    marginTop: 4,
  },
  greetingTrailDotReady: {
    borderColor: colors.ink,
    backgroundColor: colors.lime,
  },

  owlAnchor: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  groundShadow: {
    height: 14,
    marginTop: -6,
    borderRadius: 999,
    backgroundColor: colors.violetDeep,
  },

  // Confident wordmark + formula gem lockup
  identityExitWrap: {
    width: '100%',
    alignItems: 'center',
  },
  identityBlock: {
    marginTop: 10,
    alignItems: 'center',
    width: '100%',
  },
  wordmarkWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  markerHighlight: {
    position: 'absolute',
    right: 4,
    bottom: 5,
    width: '55%',
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.lime,
    transformOrigin: 'left',
  },
  brand: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 45,
    lineHeight: 52,
    letterSpacing: -0.6,
    textAlign: 'center',
    includeFontPadding: false,
  },
  brandCompact: {
    fontSize: 39,
    lineHeight: 45,
  },
  brandAccent: {
    color: colors.violet,
  },
  promise: {
    marginTop: 5,
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.1,
    textAlign: 'center',
    includeFontPadding: false,
  },
  secondaryIdentity: {
    alignItems: 'center',
  },
  formulaSparkPill: {
    marginTop: 13,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 5,
    paddingRight: 13,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1.25,
    borderColor: '#E5DAFA',
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
  },
  formulaSparkGem: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formulaSparkStar: {
    fontFamily: fonts.display,
    fontSize: 10.5,
    lineHeight: 13,
    color: colors.violet,
    includeFontPadding: false,
  },
  formulaSparkText: {
    fontFamily: fonts.display,
    fontSize: 13,
    lineHeight: 16,
    color: colors.violetDeep,
    letterSpacing: 0.2,
    includeFontPadding: false,
  },
  capabilityRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  capabilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  capabilityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  capabilityText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    lineHeight: 15,
    color: colors.inkMuted,
    includeFontPadding: false,
  },

  // Sleek modern floating liquid progress bar
  progressBlock: {
    gap: 9,
    alignItems: 'center',
  },
  progressHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 2,
  },
  stageLabelRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.violet,
  },
  stageDotMid: {
    backgroundColor: colors.cyan,
  },
  stageDotReady: {
    backgroundColor: colors.mint,
  },
  stageLabel: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
  },
  percentBadge: {
    minWidth: 42,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentBadgeReady: {
    backgroundColor: colors.lime,
  },
  percentText: {
    fontFamily: fonts.display,
    color: colors.violetDeep,
    fontSize: 12,
    lineHeight: 15,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  percentTextReady: {
    color: colors.ink,
  },
  barGlowFrame: {
    padding: 3,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(124, 60, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTrack: {
    height: 13,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: '#DFD2FA',
    backgroundColor: '#EFE6FF',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  barFill: {
    width: '100%',
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.violet,
    overflow: 'hidden',
  },
  barFillReady: {
    backgroundColor: colors.mint,
  },
  barFillHighlight: {
    position: 'absolute',
    top: 1.5,
    left: 6,
    right: 6,
    height: 3.5,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.44)',
  },
  barSheen: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    width: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  barLeadingGlow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 14,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.52)',
  },
  milestonesRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 1,
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  milestoneDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D9CBEF',
  },
  milestoneDotDone: {
    backgroundColor: colors.mint,
  },
  milestoneLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.inkMuted,
    includeFontPadding: false,
  },
  milestoneLabelDone: {
    fontFamily: fonts.bodyBold,
    color: colors.inkSoft,
  },
});
