import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
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
import { Text } from '../../shared/ui/Typography';
import { resolveSplashMood, type SplashTimeOfDay } from '../utils/splashMood';

type Props = {
  ready: boolean;
  visualsReady: boolean;
  onboardingPending?: boolean;
  startupReady?: boolean;
  reducedMotion: boolean;
  onIntroSettled?: () => void;
  onRevealStart?: () => void;
  onFinish: () => void;
};

type CelebrationSparkSpec = {
  symbol: string;
  dx: number;
  dy: number;
  rotate: string;
  color: string;
  size: number;
};

// Pure RenderThread sinusoidal float tables for the hero owl.
const WAVE_INPUT = WAVE_INPUT_17;
const OWL_FLOAT_Y = sineWaveRange(-2.0, -4.2);
const OWL_TILT_DEG = sineDegreeRange(1.9, 0.65);

const RIBBON_START = 0.12;
const RIBBON_GLIDE_CAP = 0.88;
const RIBBON_GLIDE_MS = 1_900;

const CELEBRATION_SPARKS: readonly CelebrationSparkSpec[] = [
  { symbol: '✦', dx: -92, dy: -66, rotate: '-26deg', color: colors.lime, size: 19 },
  { symbol: '+', dx: 94, dy: -58, rotate: '24deg', color: colors.cyan, size: 21 },
  { symbol: 'π', dx: -86, dy: 28, rotate: '-16deg', color: colors.paper, size: 18 },
  { symbol: '★', dx: 88, dy: 30, rotate: '26deg', color: colors.gold, size: 18 },
  { symbol: '√', dx: 4, dy: -102, rotate: '12deg', color: colors.limeBright, size: 18 },
];

const MOOD_ACCENT: Record<SplashTimeOfDay, { topLeft: string; bottomRight: string }> = {
  morning: { topLeft: '#FFD447', bottomRight: '#D8FF3E' },
  day: { topLeft: '#43D6E6', bottomRight: '#D8FF3E' },
  evening: { topLeft: '#FF8D6B', bottomRight: '#43D6E6' },
};

/**
 * Static mathematical coordinate grid + subtle drafting crosshairs rendered once
 * onto GPU texture so it can materialize with zero per-frame JS work.
 */
const SplashMathGridSvg = memo(function SplashMathGridSvg({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const { gridPath, crosshairPath } = useMemo(() => {
    const step = 36;
    const cols = Math.ceil(width / step);
    const rows = Math.ceil(height / step);
    const offsetX = Math.round((width - cols * step) / 2);
    const offsetY = Math.round((height - rows * step) / 2);
    const lines: string[] = [];
    for (let c = 0; c <= cols; c += 1) {
      const x = offsetX + c * step;
      lines.push(`M${x} 0V${height}`);
    }
    for (let r = 0; r <= rows; r += 1) {
      const y = offsetY + r * step;
      lines.push(`M0 ${y}H${width}`);
    }

    const marks: string[] = [];
    const points = [
      [Math.round(width * 0.16), Math.round(height * 0.2)],
      [Math.round(width * 0.84), Math.round(height * 0.24)],
      [Math.round(width * 0.14), Math.round(height * 0.72)],
      [Math.round(width * 0.86), Math.round(height * 0.68)],
    ];
    for (const [px, py] of points) {
      marks.push(`M${px - 5} ${py}H${px + 5}M${px} ${py - 5}V${py + 5}`);
    }
    return { gridPath: lines.join(''), crosshairPath: marks.join('') };
  }, [height, width]);

  return (
    <Svg
      pointerEvents="none"
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
    >
      <Path d={gridPath} stroke="#FFFFFF" strokeWidth={0.75} strokeOpacity={0.055} fill="none" />
      <Path d={crosshairPath} stroke="#D8FF3E" strokeWidth={1.15} strokeOpacity={0.3} fill="none" />
    </Svg>
  );
});

/**
 * True multi-stop optical SVG RadialGradients (zero hard circular edges):
 * central studio spotlight behind Profu + time-of-day corner rim lighting +
 * soft floor shadow beneath the floating owl.
 */
const SplashStudioLightsSvg = memo(function SplashStudioLightsSvg({
  width,
  height,
  owlCenterY,
  period,
}: {
  width: number;
  height: number;
  owlCenterY: number;
  period: SplashTimeOfDay;
}) {
  const accent = MOOD_ACCENT[period];

  return (
    <Svg
      pointerEvents="none"
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        {/* Optical spotlight behind Profu — smooth Gaussian falloff, zero visible circle edge */}
        <RadialGradient
          id="splashOwlGlow"
          cx="50%"
          cy={`${Math.round((owlCenterY / Math.max(1, height)) * 100)}%`}
          rx="54%"
          ry="34%"
        >
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.28" />
          <Stop offset="34%" stopColor="#D8FF3E" stopOpacity="0.15" />
          <Stop offset="68%" stopColor="#9B58FF" stopOpacity="0.06" />
          <Stop offset="100%" stopColor="#5218D2" stopOpacity="0" />
        </RadialGradient>

        {/* Time-of-day atmospheric studio key light (top-left) */}
        <RadialGradient id="splashCornerTop" cx="8%" cy="6%" rx="58%" ry="38%">
          <Stop offset="0%" stopColor={accent.topLeft} stopOpacity="0.24" />
          <Stop offset="55%" stopColor={accent.topLeft} stopOpacity="0.065" />
          <Stop offset="100%" stopColor={accent.topLeft} stopOpacity="0" />
        </RadialGradient>

        {/* Warm Electric-Lime rim light (bottom-right) */}
        <RadialGradient id="splashCornerBottom" cx="92%" cy="88%" rx="56%" ry="36%">
          <Stop offset="0%" stopColor={accent.bottomRight} stopOpacity="0.17" />
          <Stop offset="52%" stopColor={accent.bottomRight} stopOpacity="0.05" />
          <Stop offset="100%" stopColor={accent.bottomRight} stopOpacity="0" />
        </RadialGradient>

        {/* Soft floor light reflection beneath floating owl */}
        <RadialGradient
          id="splashOwlFloor"
          cx="50%"
          cy={`${Math.round(((owlCenterY + 96) / Math.max(1, height)) * 100)}%`}
          rx="22%"
          ry="2.2%"
        >
          <Stop offset="0%" stopColor="#1B064F" stopOpacity="0.34" />
          <Stop offset="65%" stopColor="#1B064F" stopOpacity="0.1" />
          <Stop offset="100%" stopColor="#1B064F" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect x={0} y={0} width={width} height={height} fill="url(#splashCornerTop)" />
      <Rect x={0} y={0} width={width} height={height} fill="url(#splashCornerBottom)" />
      <Rect x={0} y={0} width={width} height={height} fill="url(#splashOwlGlow)" />
      <Rect x={0} y={0} width={width} height={height} fill="url(#splashOwlFloor)" />
    </Svg>
  );
});

/**
 * Flagship "Royal-Violet Studio Curtain" launch splash:
 * - Frame 0 matches Android's native splash color (#5218D2) pixel-for-pixel so
 *   native -> React handoff is 100% invisible (zero flash, zero color jump).
 * - Inside that exact Royal-Violet room, the 4-stop studio gradient, architectural
 *   math coordinate grid, and true optical SVG radial lights smoothly bloom ON,
 *   followed by Profu's Pixar squash-and-stretch entrance, Electric-Lime marker
 *   wordmark, and a minimalist 4px liquid shimmer ribbon.
 * - On exit, the full-screen Royal-Violet Curtain smoothly retracts upward into
 *   the curved top canopy of Onboarding or Home while Profu glides onto his
 *   top-right canopy perch — 100% pure native driver (zero Reanimated).
 */
export function LaunchSplash({
  ready,
  visualsReady,
  onboardingPending = false,
  reducedMotion,
  onIntroSettled,
  onRevealStart,
  onFinish,
}: Props) {
  const { width, height } = useSafeAreaFrame();
  const insets = useSafeAreaInsets();
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
  const gradientReveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const gridReveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const lightReveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const owlEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const copyEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const underlineReveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const ribbonEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const floatPhase = useRef(new Animated.Value(0)).current;
  const ribbonFill = useRef(new Animated.Value(reducedMotion ? 1 : RIBBON_START)).current;
  const ribbonSheen = useRef(new Animated.Value(0)).current;
  const victoryBurst = useRef(new Animated.Value(0)).current;
  const owlCelebrate = useRef(new Animated.Value(0)).current;
  const chromeExit = useRef(new Animated.Value(0)).current;
  const curtainExit = useRef(new Animated.Value(0)).current;
  const owlExit = useRef(new Animated.Value(0)).current;

  const introSettledRef = useRef(onIntroSettled);
  const revealStartRef = useRef(onRevealStart);
  const finishRef = useRef(onFinish);
  const introNotified = useRef(false);
  const revealed = useRef(false);
  const finished = useRef(false);
  const ribbonGlideStarted = useRef(false);
  const ribbonCompleted = useRef(false);
  const victoryHapticFired = useRef(false);
  const ambientLoopsRef = useRef<Animated.CompositeAnimation[]>([]);

  const handleSceneLayout = useCallback(() => setSceneReady(true), []);

  // Deterministic viewport geometry matching both WelcomeOnboardingScreen & HomeSurface canopies.
  const compact = height < 720;
  const isVeryNarrow = width < 350;
  const owlSize = compact ? 184 : Math.min(228, Math.round(width * 0.56));
  const ribbonWidth = Math.round(Math.max(132, Math.min(width * 0.44, 180)));
  const curtainHeight = Math.round(height + 38);
  const owlCenterY = Math.round(height * 0.4);

  const targetCanopyHeight = onboardingPending
    ? Math.round(insets.top + (compact ? 142 : 168))
    : Math.round(insets.top + (height - insets.top < 690 ? 83 + 68 : 110 + (isVeryNarrow ? 94 : 106)));
  const curtainRetractY = -Math.max(120, curtainHeight - targetCanopyHeight);

  // Target perch coordinates for the flying owl to land directly on the destination canopy's right mascot slot.
  const owlExitTargetX = Math.round(Math.min(118, width * 0.29));
  const owlExitTargetY = -Math.round(Math.max(145, owlCenterY - (insets.top + (onboardingPending ? 96 : 114))));

  // Smart rhythm: cinema-rich on first launch (onboarding), blazing-fast sting on daily returns.
  const introSettleMs = onboardingPending ? 920 : 600;
  const celebrateBeatMs = onboardingPending ? 290 : 210;

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

  // Hide native splash seamlessly over matching #5218D2 base, then illuminate the studio stage layer by layer.
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

    const frame = requestAnimationFrame(() => {
      void SplashScreen.hideAsync().catch(() => undefined).then(() => {
        if (active) setNativeSplashHidden(true);
      });
      if (!active) return;
      setIntroStarted(true);

      if (reducedMotion) {
        gradientReveal.setValue(1);
        gridReveal.setValue(1);
        lightReveal.setValue(1);
        owlEnter.setValue(1);
        copyEnter.setValue(1);
        underlineReveal.setValue(1);
        ribbonEnter.setValue(1);
        notifyIntroSettledOnce();
        return;
      }

      // Seamless "studio lights turning on" choreography over the exact #5218D2 native surface:
      // fires immediately with zero dead pause so empty solid purple never lingers.
      startTiming(gradientReveal, 1, 380, 0);
      startTiming(gridReveal, 1, 440, 25);
      startTiming(lightReveal, 1, 460, 40);
      startTiming(owlEnter, 1, 500, 50);
      startTiming(copyEnter, 1, 420, 175);
      startTiming(underlineReveal, 1, 380, 280);
      startTiming(ribbonEnter, 1, 340, 340);

      // Gentle RenderThread living float engages smoothly after the owl settles.
      ambientTimer = setTimeout(() => {
        if (!active) return;
        const loop = createNativeLoop(floatPhase, 3_400);
        loops.push(loop);
        ambientLoopsRef.current.push(loop);
        loop.start();
      }, 540);

      // Mount destination screen behind the opaque Royal-Violet curtain once the studio reveal settles.
      introTimer = setTimeout(() => {
        if (active) notifyIntroSettledOnce();
      }, introSettleMs);
    });

    const introFallback = setTimeout(() => {
      if (active) notifyIntroSettledOnce();
    }, 1_450);

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
    };
  }, [
    copyEnter,
    floatPhase,
    gradientReveal,
    gridReveal,
    imageReady,
    introSettleMs,
    lightReveal,
    notifyIntroSettledOnce,
    owlEnter,
    reducedMotion,
    ribbonEnter,
    sceneReady,
    underlineReveal,
    visualsReady,
  ]);

  // Smooth uninterrupted glide of the minimalist 4px shimmer ribbon while startup resolves.
  useEffect(() => {
    if (reducedMotion) {
      ribbonFill.setValue(ready ? 1 : 0.85);
      return undefined;
    }
    if (!introStarted || ribbonGlideStarted.current || ribbonCompleted.current) return undefined;
    ribbonGlideStarted.current = true;
    Animated.timing(ribbonFill, {
      toValue: RIBBON_GLIDE_CAP,
      duration: RIBBON_GLIDE_MS,
      easing: SILKY_EASE_OUT,
      useNativeDriver: true,
    }).start();
    return undefined;
  }, [introStarted, ready, reducedMotion, ribbonFill]);

  useEffect(() => {
    if (!ready || ribbonCompleted.current) return undefined;
    ribbonCompleted.current = true;
    if (reducedMotion) {
      ribbonFill.setValue(1);
      return undefined;
    }
    const anim = Animated.timing(ribbonFill, {
      toValue: 1,
      duration: 240,
      easing: SILKY_EASE_OUT,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [ready, reducedMotion, ribbonFill]);

  useEffect(() => {
    if (reducedMotion || !introStarted || ready) {
      ribbonSheen.stopAnimation();
      ribbonSheen.setValue(0);
      return undefined;
    }
    const sheenLoop = createNativeLoop(ribbonSheen, 1_300);
    sheenLoop.start();
    return () => {
      sheenLoop.stop();
      ribbonSheen.stopAnimation();
    };
  }, [introStarted, ready, reducedMotion, ribbonSheen]);

  // Celebratory spark hop + signature Curtain-Pull Morph right into the destination's Royal-Violet canopy.
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
      duration: 540,
      easing: SILKY_EASE_OUT,
      useNativeDriver: true,
    }));
    startAnim(Animated.timing(owlCelebrate, {
      toValue: 1,
      duration: 320,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }));

    const beatTimer = setTimeout(() => {
      // Release idle float right before the curtain morph so RenderThread stays locked at 60fps.
      ambientLoopsRef.current.forEach((loop) => loop.stop());
      ambientLoopsRef.current = [];
      floatPhase.stopAnimation();

      // Wordmark & ribbon dissolve cleanly -> Royal-Violet curtain retracts UP into canopy -> owl glides onto perch.
      startAnim(Animated.timing(chromeExit, {
        toValue: 1,
        duration: 240,
        easing: SILKY_EASE_IN_OUT,
        useNativeDriver: true,
      }));
      startAnim(Animated.timing(curtainExit, {
        toValue: 1,
        duration: 540,
        delay: 30,
        easing: SILKY_EASE_IN_OUT,
        useNativeDriver: true,
      }));
      startAnim(Animated.timing(owlExit, {
        toValue: 1,
        duration: 480,
        delay: 35,
        easing: SILKY_EASE_IN_OUT,
        useNativeDriver: true,
      }));

      // Trigger destination screen's card & mascot cascade right as the curtain lifts away from the cards.
      revealTimer = setTimeout(notifyRevealOnce, 120);
      // Hand touches cleanly to the destination screen once the curtain dissolves flush into its canopy.
      passThroughTimer = setTimeout(() => setPassThrough(true), 560);
      // Unmount LaunchSplash strictly after destination animations settle so zero view-teardown hitch occurs.
      exitTimer = setTimeout(finishOnce, 1_120);
    }, celebrateBeatMs);

    return () => {
      clearTimeout(beatTimer);
      if (revealTimer) clearTimeout(revealTimer);
      if (passThroughTimer) clearTimeout(passThroughTimer);
      if (exitTimer) clearTimeout(exitTimer);
      exitAnims.forEach((anim) => anim.stop());
    };
  }, [
    celebrateBeatMs,
    chromeExit,
    curtainExit,
    finishOnce,
    floatPhase,
    introComplete,
    nativeSplashHidden,
    notifyRevealOnce,
    owlCelebrate,
    owlExit,
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

  // Strictly memoized Fabric-safe native interpolations.
  const gradientRevealStyle = useMemo(() => ({
    opacity: gradientReveal,
  }), [gradientReveal]);

  const gridRevealStyle = useMemo(() => ({
    opacity: gridReveal,
    transform: [
      {
        scale: gridReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [1.045, 1],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [gridReveal]);

  const lightRevealStyle = useMemo(() => ({
    opacity: lightReveal,
    transform: [
      {
        scale: lightReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [0.88, 1],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [lightReveal]);

  // Curtain pulls smoothly upward to exact targetCanopyHeight, then cross-dissolves flush into destination canopy.
  const curtainMorphStyle = useMemo(() => ({
    opacity: curtainExit.interpolate({
      inputRange: [0, 0.78, 1],
      outputRange: [1, 1, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: curtainExit.interpolate({
          inputRange: [0, 1],
          outputRange: [0, curtainRetractY],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [curtainExit, curtainRetractY]);

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
          outputRange: [0, -18],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [chromeExit]);

  const owlSpatialExitStyle = useMemo(() => ({
    opacity: owlExit.interpolate({
      inputRange: [0, 0.72, 1],
      outputRange: [1, 0.74, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: owlExit.interpolate({
          inputRange: [0, 1],
          outputRange: [0, owlExitTargetX],
          extrapolate: 'clamp',
        }),
      },
      {
        translateY: owlExit.interpolate({
          inputRange: [0, 1],
          outputRange: [0, owlExitTargetY],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: owlExit.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.43],
          extrapolate: 'clamp',
        }),
      },
      {
        rotate: owlExit.interpolate({
          inputRange: [0, 0.45, 1],
          outputRange: ['0deg', '-8deg', '4deg'],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [owlExit, owlExitTargetX, owlExitTargetY]);

  // Volume-preserving Pixar squash-and-stretch entrance for the hero owl.
  const owlEnterStyle = useMemo(() => ({
    opacity: owlEnter.interpolate({
      inputRange: [0, 0.36, 1],
      outputRange: [0, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: owlEnter.interpolate({
          inputRange: [0, 0.54, 0.78, 1],
          outputRange: [36, -6, 1.5, 0],
          extrapolate: 'clamp',
        }),
      },
      {
        scaleX: owlEnter.interpolate({
          inputRange: [0, 0.5, 0.72, 0.88, 1],
          outputRange: [0.76, 0.945, 1.055, 0.988, 1],
          extrapolate: 'clamp',
        }),
      },
      {
        scaleY: owlEnter.interpolate({
          inputRange: [0, 0.5, 0.72, 0.88, 1],
          outputRange: [0.84, 1.055, 0.95, 1.012, 1],
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
          inputRange: [0, 0.45, 1],
          outputRange: [0, -9, 0],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: owlCelebrate.interpolate({
          inputRange: [0, 0.45, 1],
          outputRange: [1, 1.075, 1],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [owlCelebrate]);

  const sparkStyles = useMemo(() => CELEBRATION_SPARKS.map((spark) => ({
    opacity: victoryBurst.interpolate({
      inputRange: [0, 0.14, 0.66, 1],
      outputRange: [0, 1, 0.86, 0],
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
          outputRange: [0.3, 1.16, 0.7],
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

  const copyEnterStyle = useMemo(() => ({
    opacity: copyEnter.interpolate({
      inputRange: [0, 0.65, 1],
      outputRange: [0, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: copyEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [copyEnter]);

  const underlineStyle = useMemo(() => ({
    opacity: underlineReveal,
    transform: [
      {
        scaleX: underlineReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [0.02, 1],
          extrapolate: 'clamp',
        }),
      },
      { rotate: '-1.4deg' },
    ],
  }), [underlineReveal]);

  const ribbonEnterStyle = useMemo(() => ({
    opacity: ribbonEnter.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [0, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: ribbonEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [ribbonEnter]);

  const ribbonFillStyle = useMemo(() => ({
    transform: [
      {
        translateX: ribbonFill.interpolate({
          inputRange: [0, 1],
          outputRange: [-ribbonWidth, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [ribbonFill, ribbonWidth]);

  const ribbonSheenStyle = useMemo(() => ({
    opacity: ribbonSheen.interpolate({
      inputRange: [0, 0.16, 0.56, 0.72, 1],
      outputRange: [0, 0.85, 0.85, 0, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: ribbonSheen.interpolate({
          inputRange: [0, 0.72, 1],
          outputRange: [-44, ribbonWidth + 44, ribbonWidth + 44],
        }),
      },
      { skewX: '-22deg' },
    ],
  }), [ribbonSheen, ribbonWidth]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={handleSceneLayout}
      pointerEvents={passThrough ? 'none' : 'auto'}
      style={styles.root}
    >
      <StatusBar style="light" />

      {/* Full-bleed curved Royal-Violet Curtain anchored on exact native #5218D2 for zero-flash handoff */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.curtainWrap,
          { height: curtainHeight },
          curtainMorphStyle,
        ]}
      >
        {/* Solid #5218D2 base matches Android native splash pixel-for-pixel on Frame 0 */}
        <View style={styles.curtainSurface}>
          {/* Layer 1: 4-stop Royal-Violet gradient gently illuminates over the solid native base */}
          <Animated.View style={[StyleSheet.absoluteFill, gradientRevealStyle]}>
            <LinearGradient
              colors={['#9B58FF', '#732CF4', '#5218D2', '#3B0EA4']}
              start={{ x: 0.08, y: 0 }}
              end={{ x: 0.92, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Layer 2: Fine architectural math grid settles gently into depth */}
          {visualsReady ? (
            <Animated.View style={[StyleSheet.absoluteFill, gridRevealStyle]}>
              <SplashMathGridSvg width={width} height={curtainHeight} />
            </Animated.View>
          ) : null}

          {/* Layer 3: Optical SVG RadialGradient studio lights bloom softly behind Profu */}
          {visualsReady ? (
            <Animated.View style={[StyleSheet.absoluteFill, lightRevealStyle]}>
              <SplashStudioLightsSvg
                width={width}
                height={curtainHeight}
                owlCenterY={owlCenterY}
                period={mood.period}
              />
            </Animated.View>
          ) : null}

          <Animated.View style={[styles.curtainBottomRim, gradientRevealStyle]} />
        </View>
      </Animated.View>

      {/* Foreground hero stage: owl stays unclipped above the retracting curtain during flight */}
      <View pointerEvents="none" style={[styles.stage, { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 22) + 18 }]}>
        <View style={styles.topSpacer} />

        <View style={styles.heroCluster}>
          <View style={[styles.owlStage, { width: owlSize + 24, height: owlSize + 12 }]}>
            {CELEBRATION_SPARKS.map((spark, index) => (
              <Animated.View
                key={`${spark.symbol}-${index}`}
                style={[styles.sparkAnchor, sparkStyles[index]]}
              >
                {visualsReady ? (
                  <Text
                    accessible={false}
                    style={[
                      styles.sparkText,
                      { color: spark.color, fontSize: spark.size, lineHeight: spark.size + 3 },
                    ]}
                  >
                    {spark.symbol}
                  </Text>
                ) : null}
              </Animated.View>
            ))}

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
            </Animated.View>
          </View>

          {/* Mount custom-font text strictly after Font.loadAsync resolves so Android never caches a fallback typeface */}
          {visualsReady ? (
            <Animated.View style={[styles.identityExitWrap, chromeExitStyle]}>
              <Animated.View style={[styles.identityBlock, copyEnterStyle]}>
                <View style={styles.wordmarkWrap}>
                  <Animated.View pointerEvents="none" style={[styles.markerSlash, underlineStyle]} />
                  <Text
                    maxFontSizeMultiplier={1.28}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                    style={[styles.brand, compact && styles.brandCompact]}
                  >
                    Profu’ <Text style={styles.brandAccent}>de mate</Text>
                  </Text>
                </View>
                <Text maxFontSizeMultiplier={1.25} style={styles.promise}>
                  Matematica, pas cu pas.
                </Text>
              </Animated.View>
            </Animated.View>
          ) : null}
        </View>

        {/* Razor-thin 4px minimalist liquid shimmer ribbon — zero fake % or installer noise */}
        <Animated.View style={[styles.ribbonExitWrap, chromeExitStyle]}>
          <Animated.View style={[styles.ribbonTrack, { width: ribbonWidth }, ribbonEnterStyle]}>
            <Animated.View style={[styles.ribbonFill, ribbonFillStyle]}>
              <LinearGradient
                colors={['#F2FF82', '#D8FF3E', '#57E49E']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
              <Animated.View style={[styles.ribbonSheen, ribbonSheenStyle]} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
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
  },
  curtainWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    overflow: 'hidden',
  },
  curtainSurface: {
    flex: 1,
    backgroundColor: colors.splashRoyal,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    overflow: 'hidden',
  },
  curtainBottomRim: {
    position: 'absolute',
    left: 32,
    right: 32,
    bottom: 2,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  topSpacer: {
    height: 16,
  },
  heroCluster: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: -12,
  },
  owlStage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  owlAnchor: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkAnchor: {
    position: 'absolute',
  },
  sparkText: {
    fontFamily: fonts.display,
    includeFontPadding: false,
  },
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
  markerSlash: {
    position: 'absolute',
    right: 4,
    bottom: 3,
    width: '54%',
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(216, 255, 62, 0.28)',
    transformOrigin: 'left',
  },
  brand: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -0.5,
    textAlign: 'center',
    includeFontPadding: false,
    textShadowColor: 'rgba(22, 5, 74, 0.34)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  brandCompact: {
    fontSize: 38,
    lineHeight: 44,
  },
  brandAccent: {
    color: colors.lime,
  },
  promise: {
    marginTop: 6,
    fontFamily: fonts.bodyMedium,
    color: 'rgba(244, 238, 255, 0.9)',
    fontSize: 15.5,
    lineHeight: 21,
    letterSpacing: 0.15,
    textAlign: 'center',
    includeFontPadding: false,
  },
  ribbonExitWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 16,
  },
  ribbonTrack: {
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    overflow: 'hidden',
  },
  ribbonFill: {
    width: '100%',
    height: '100%',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  ribbonSheen: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    width: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
});
