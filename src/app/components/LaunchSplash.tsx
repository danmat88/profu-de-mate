import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useResponsiveLayout } from '../../shared/hooks/useResponsiveLayout';
import { computeHeroGeometry } from '../../shared/layout/heroGeometry';
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
import { ROYAL_HERO_GRADIENT, RoyalHeroCanopyBackdrop } from '../../shared/ui/RoyalHeroCanopyBackdrop';
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

const MOOD_SPOTLIGHT: Record<SplashTimeOfDay, string> = {
  morning: '#FFE46B',
  day: '#D8FF3E',
  evening: '#FF9E7D',
};

/**
 * Optical center spotlight + soft floor shadow behind the floating hero owl
 * rendered via true SVG RadialGradients (zero hard circular edges).
 */
const SplashCenterSpotlightSvg = memo(function SplashCenterSpotlightSvg({
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
  const safeHeight = Math.max(1, height);
  const tint = MOOD_SPOTLIGHT[period];
  const spotCy = `${Math.round((owlCenterY / safeHeight) * 100)}%`;
  const floorCy = `${Math.round(((owlCenterY + 96) / safeHeight) * 100)}%`;

  return (
    <Svg
      pointerEvents="none"
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        <RadialGradient id="splashCenterSpot" cx="50%" cy={spotCy} rx="52%" ry="32%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.28" />
          <Stop offset="34%" stopColor={tint} stopOpacity="0.16" />
          <Stop offset="68%" stopColor="#9B58FF" stopOpacity="0.06" />
          <Stop offset="100%" stopColor="#5218D2" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="splashCenterFloor" cx="50%" cy={floorCy} rx="21%" ry="2.2%">
          <Stop offset="0%" stopColor="#1B064F" stopOpacity="0.34" />
          <Stop offset="65%" stopColor="#1B064F" stopOpacity="0.1" />
          <Stop offset="100%" stopColor="#1B064F" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#splashCenterSpot)" />
      <Rect x={0} y={0} width={width} height={height} fill="url(#splashCenterFloor)" />
    </Svg>
  );
});

/**
 * Flagship "Royal-Violet Studio Curtain" launch splash with pixel-exact shared
 * hero geometry:
 * - Frame 0 matches Android's native splash color (#5218D2) with zero flash.
 * - Illuminates the exact same RoyalHeroCanopyBackdrop (4-stop Royal-Violet
 *   gradient + fine architectural math grid + optical SVG RadialGradient lights)
 *   used by WelcomeOnboardingScreen and HomeSurface.
 * - On exit, the Royal-Violet curtain retracts smoothly upward to the exact
 *   destination canopy height and corner arch, while Profu's owl logo flies
 *   up-and-left, blooms its crisp white-and-lime circular medallion, and docks
 *   pixel-for-pixel into the top-left header brand badge — 100% pure native
 *   driver (zero Reanimated).
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
  const frame = useSafeAreaFrame();
  const insets = useSafeAreaInsets();
  const { fontScale } = useResponsiveLayout(frame);
  const hero = computeHeroGeometry({
    width: frame.width,
    height: frame.height,
    topInset: insets.top,
    fontScale,
  });

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

  // Deterministic geometry matching the exact destination canopy & top-left logo badge.
  const ribbonWidth = Math.round(Math.max(132, Math.min(hero.width * 0.44, 180)));
  const curtainHeight = Math.round(hero.height + hero.canopyRadius + 6);
  const targetCanopyHeight = onboardingPending ? hero.onboardingCanopyHeight : hero.homeCanopyHeight;
  const curtainRetractY = -Math.max(100, curtainHeight - targetCanopyHeight);

  // Pixel-exact docking vector from centered Splash owl -> top-left circular brand logo badge.
  const logoDockDx = hero.logoCenterX - hero.splashOwlCenterX;
  const logoDockDy = hero.logoCenterY - hero.splashOwlCenterY;
  const logoDockScale = hero.logoImageSize / hero.splashOwlSize;
  const dockingMedallionSize = Math.round(hero.splashOwlSize * (hero.logoBadgeSize / hero.logoImageSize));
  const dockingMedallionBorder = Math.round((hero.compact ? 2 : 2.5) / logoDockScale);
  const dockingMedallionBottomBorder = Math.round((hero.compact ? 2.5 : 3.5) / logoDockScale);

  // Smart rhythm: cinema-rich on first launch (onboarding), crisp athletic sting on daily returns.
  const introSettleMs = onboardingPending ? 900 : 580;
  const celebrateBeatMs = onboardingPending ? 280 : 210;

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

  // Hide native splash seamlessly over matching #5218D2 base, then illuminate the studio stage immediately.
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

    const frameId = requestAnimationFrame(() => {
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

      // Immediate layered studio illumination over exact #5218D2 native surface (zero empty-purple pause).
      startTiming(gradientReveal, 1, 380, 0);
      startTiming(gridReveal, 1, 440, 25);
      startTiming(lightReveal, 1, 460, 40);
      startTiming(owlEnter, 1, 500, 50);
      startTiming(copyEnter, 1, 420, 175);
      startTiming(underlineReveal, 1, 380, 280);
      startTiming(ribbonEnter, 1, 340, 340);

      ambientTimer = setTimeout(() => {
        if (!active) return;
        const loop = createNativeLoop(floatPhase, 3_400);
        loops.push(loop);
        ambientLoopsRef.current.push(loop);
        loop.start();
      }, 540);

      introTimer = setTimeout(() => {
        if (active) notifyIntroSettledOnce();
      }, introSettleMs);
    });

    const introFallback = setTimeout(() => {
      if (active) notifyIntroSettledOnce();
    }, 1_450);

    return () => {
      active = false;
      cancelAnimationFrame(frameId);
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

  // Celebratory spark hop + Curtain-Pull Morph + Pixel-Exact Logo Docking into the Header Badge.
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
      duration: 520,
      easing: SILKY_EASE_OUT,
      useNativeDriver: true,
    }));
    startAnim(Animated.timing(owlCelebrate, {
      toValue: 1,
      duration: 300,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }));

    const beatTimer = setTimeout(() => {
      // Stop living float so the logo starts docking smoothly from exact neutral center.
      ambientLoopsRef.current.forEach((loop) => loop.stop());
      ambientLoopsRef.current = [];
      floatPhase.stopAnimation();
      floatPhase.setValue(0);

      startAnim(Animated.timing(chromeExit, {
        toValue: 1,
        duration: 230,
        easing: SILKY_EASE_IN_OUT,
        useNativeDriver: true,
      }));
      startAnim(Animated.timing(curtainExit, {
        toValue: 1,
        duration: 540,
        delay: 25,
        easing: SILKY_EASE_IN_OUT,
        useNativeDriver: true,
      }));
      startAnim(Animated.timing(owlExit, {
        toValue: 1,
        duration: 520,
        delay: 30,
        easing: SILKY_EASE_IN_OUT,
        useNativeDriver: true,
      }));

      // Trigger destination screen's card & mascot cascade right as the curtain lifts away from the workspace.
      revealTimer = setTimeout(notifyRevealOnce, 120);
      // Hand touches cleanly to the destination screen once curtain + logo finish docking.
      passThroughTimer = setTimeout(() => setPassThrough(true), 570);
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
          outputRange: [1.04, 1],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [gridReveal]);

  const lightRevealStyle = useMemo(() => ({
    opacity: Animated.multiply(
      lightReveal,
      chromeExit.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    ),
    transform: [
      {
        scale: lightReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [0.88, 1],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [chromeExit, lightReveal]);

  // Curtain pulls smoothly upward to exact targetCanopyHeight, then dissolves invisibly into the identical canopy below.
  const curtainMorphStyle = useMemo(() => ({
    opacity: curtainExit.interpolate({
      inputRange: [0, 0.82, 1],
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

  // Pixel-exact curved docking trajectory into the top-left circular brand logo badge.
  const owlDockFlightStyle = useMemo(() => ({
    opacity: owlExit.interpolate({
      inputRange: [0, 0.86, 1],
      outputRange: [1, 1, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: owlExit.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, logoDockDx * 0.44, logoDockDx],
          extrapolate: 'clamp',
        }),
      },
      {
        translateY: owlExit.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, logoDockDy * 0.62, logoDockDy],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: owlExit.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, (1 + logoDockScale) * 0.42, logoDockScale],
          extrapolate: 'clamp',
        }),
      },
      {
        rotate: owlExit.interpolate({
          inputRange: [0, 0.45, 0.85, 1],
          outputRange: ['0deg', '-7deg', '2deg', '0deg'],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [logoDockDx, logoDockDy, logoDockScale, owlExit]);

  // Crisp white + Electric-Lime circular medallion blooms around the owl head right as it docks into the Header badge.
  const dockingMedallionStyle = useMemo(() => ({
    opacity: owlExit.interpolate({
      inputRange: [0, 0.42, 0.78, 1],
      outputRange: [0, 0, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        scale: owlExit.interpolate({
          inputRange: [0, 0.42, 0.82, 1],
          outputRange: [0.82, 0.82, 1, 1],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [owlExit]);

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

  const owlLeft = Math.round(hero.splashOwlCenterX - hero.splashOwlSize / 2);
  const owlTop = Math.round(hero.splashOwlCenterY - hero.splashOwlSize / 2);
  const copyTop = Math.round(hero.splashOwlCenterY + hero.splashOwlSize / 2 + (hero.compact ? 10 : 14));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={handleSceneLayout}
      pointerEvents={passThrough ? 'none' : 'auto'}
      style={styles.root}
    >
      <StatusBar style="light" />

      {/* Full-bleed curved Royal-Violet Curtain sharing exact radius, height target, gradient, grid & lights with destination canopies */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.curtainWrap,
          {
            height: curtainHeight,
            borderBottomLeftRadius: hero.canopyRadius,
            borderBottomRightRadius: hero.canopyRadius,
          },
          curtainMorphStyle,
        ]}
      >
        {/* Solid #5218D2 base matches Android native splash pixel-for-pixel on Frame 0 */}
        <View
          style={[
            styles.curtainSurface,
            {
              borderBottomLeftRadius: hero.canopyRadius,
              borderBottomRightRadius: hero.canopyRadius,
            },
          ]}
        >
          {/* Layer 1: Exact shared 4-stop Royal-Violet gradient gently illuminates over solid #5218D2 */}
          <Animated.View style={[StyleSheet.absoluteFill, gradientRevealStyle]}>
            <LinearGradient
              colors={ROYAL_HERO_GRADIENT}
              start={{ x: 0.08, y: 0 }}
              end={{ x: 0.92, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Layer 2: Unified RoyalHeroCanopyBackdrop (identical grid, crosshairs, optical corner lights & bottom rim) */}
          {visualsReady ? (
            <Animated.View style={[StyleSheet.absoluteFill, gridRevealStyle]}>
              <RoyalHeroCanopyBackdrop
                width={hero.width}
                height={curtainHeight}
                showGradient={false}
              />
            </Animated.View>
          ) : null}

          {/* Layer 3: Center studio spotlight behind Profu (dissolves cleanly as Profu takes flight) */}
          {visualsReady ? (
            <Animated.View style={[StyleSheet.absoluteFill, lightRevealStyle]}>
              <SplashCenterSpotlightSvg
                width={hero.width}
                height={curtainHeight}
                owlCenterY={hero.splashOwlCenterY}
                period={mood.period}
              />
            </Animated.View>
          ) : null}
        </View>
      </Animated.View>

      {/* Celebratory math sparks centered behind the hero owl */}
      <View
        pointerEvents="none"
        style={[styles.sparksOrigin, { left: hero.splashOwlCenterX, top: hero.splashOwlCenterY }]}
      >
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
      </View>

      {/* Pixel-exact docking hero owl logo: flies up-left and morphs into the circular white-and-lime header badge */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.owlDockWrap,
          {
            left: owlLeft,
            top: owlTop,
            width: hero.splashOwlSize,
            height: hero.splashOwlSize,
          },
          owlDockFlightStyle,
        ]}
      >
        <Animated.View
          style={[
            styles.dockingMedallion,
            {
              width: dockingMedallionSize,
              height: dockingMedallionSize,
              borderRadius: dockingMedallionSize / 2,
              borderWidth: dockingMedallionBorder,
              borderBottomWidth: dockingMedallionBottomBorder,
            },
            dockingMedallionStyle,
          ]}
        />
        <Animated.View style={owlEnterStyle}>
          <Animated.View style={owlCelebrateStyle}>
            <Animated.View style={owlFloatStyle}>
              <Image
                accessible={false}
                source={bundledImageSource(require('../../../assets/brand/splash_mark_v2.png'))}
                resizeMode="contain"
                fadeDuration={0}
                onLoad={() => setImageReady(true)}
                style={{ width: hero.splashOwlSize, height: hero.splashOwlSize }}
              />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {/* Brand wordmark strictly mounted after UI fonts resolve */}
      {visualsReady ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.identityPos, { top: copyTop }, chromeExitStyle]}
        >
          <Animated.View style={[styles.identityBlock, copyEnterStyle]}>
            <View style={styles.wordmarkWrap}>
              <Animated.View pointerEvents="none" style={[styles.markerSlash, underlineStyle]} />
              <Text
                maxFontSizeMultiplier={1.28}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                style={[styles.brand, hero.compact && styles.brandCompact]}
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

      {/* Razor-thin 4px minimalist liquid shimmer ribbon — zero fake % or installer noise */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ribbonPos,
          { bottom: Math.max(insets.bottom, 22) + 22 },
          chromeExitStyle,
        ]}
      >
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
    overflow: 'hidden',
  },
  curtainSurface: {
    flex: 1,
    backgroundColor: colors.splashRoyal,
    overflow: 'hidden',
  },
  sparksOrigin: {
    position: 'absolute',
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
  owlDockWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockingMedallion: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderColor: colors.lime,
  },
  identityPos: {
    position: 'absolute',
    left: 28,
    right: 28,
    alignItems: 'center',
  },
  identityBlock: {
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
  ribbonPos: {
    position: 'absolute',
    left: 0,
    right: 0,
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
