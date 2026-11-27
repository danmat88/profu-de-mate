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
  SILKY_EASE_OUT,
  sineDegreeRange,
  sineWaveRange,
  WAVE_INPUT_17,
} from '../../shared/motion/nativeMotion';
import { bundledImageSource } from '../../shared/services/bundledImages';
import * as Haptics from '../../shared/services/haptics';
import { colors, fonts, radii } from '../../shared/theme';
import { CachedInsetRelief, CachedOutsetShadow } from '../../shared/ui/CachedRelief';
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
const OWL_FLOAT_Y = sineWaveRange(-2.0, -4.4);
const OWL_TILT_DEG = sineDegreeRange(1.8, 0.65);

// Measured artwork bounding-box fill ratio: profu_mark_v2.png (95.4% H / 82.0% W)
// vs splash_mark_v2.png (69.1% H / 59.0% W safe-zone padded for Android 12+ icon masks).
const SPLASH_TO_BADGE_ART_RATIO = 1.385;

const RIBBON_START = 0.14;
const RIBBON_GLIDE_CAP = 0.88;
const RIBBON_GLIDE_MS = 1_850;

const SPLASH_SHADOWS = {
  glassOutset: '0 6px 12px -2px rgba(20, 4, 66, 0.28), 0 2px 5px rgba(20, 4, 66, 0.18)',
  glassInset: 'inset 0 2px 4px rgba(255, 255, 255, 0.46), inset 0 -3px 6px rgba(20, 4, 68, 0.30)',
  emblemOutset: '0 10px 20px -4px rgba(18, 4, 62, 0.34), 0 3px 8px rgba(18, 4, 62, 0.20)',
  emblemInset: 'inset 0 3px 6px rgba(255, 255, 255, 0.44), inset 0 -5px 10px rgba(20, 4, 70, 0.32)',
  formulaOutset: '0 5px 10px -2px rgba(18, 4, 62, 0.26), 0 2px 4px rgba(18, 4, 62, 0.16)',
  formulaInset: 'inset 0 1.5px 3px rgba(255, 255, 255, 0.42), inset 0 -2.5px 5px rgba(18, 4, 64, 0.28)',
  ribbonRecess: 'inset 0 2px 4px rgba(14, 3, 48, 0.44), inset 0 -1.5px 3px rgba(255, 255, 255, 0.24)',
} as const;

const CELEBRATION_SPARKS: readonly CelebrationSparkSpec[] = [
  { symbol: '✦', dx: -94, dy: -68, rotate: '-26deg', color: colors.lime, size: 19 },
  { symbol: '+', dx: 96, dy: -58, rotate: '24deg', color: colors.cyan, size: 21 },
  { symbol: 'π', dx: -88, dy: 28, rotate: '-16deg', color: colors.paper, size: 18 },
  { symbol: '★', dx: 90, dy: 30, rotate: '26deg', color: colors.gold, size: 18 },
  { symbol: '√', dx: 4, dy: -104, rotate: '12deg', color: colors.limeBright, size: 18 },
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
  const floorCy = `${Math.round(((owlCenterY + 102) / safeHeight) * 100)}%`;

  return (
    <Svg
      pointerEvents="none"
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        <RadialGradient id="splashCenterSpot" cx="50%" cy={spotCy} rx="56%" ry="34%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
          <Stop offset="34%" stopColor={tint} stopOpacity="0.18" />
          <Stop offset="68%" stopColor="#9B58FF" stopOpacity="0.065" />
          <Stop offset="100%" stopColor="#5218D2" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="splashCenterFloor" cx="50%" cy={floorCy} rx="22%" ry="2.3%">
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
 * Flagship 3D "Royal-Violet Studio Curtain" launch splash with pixel-exact
 * shared hero geometry and zero double-image handoff:
 * - Frame 0 matches Android's native splash color (#5218D2) with zero flash.
 * - Matches Home's sculpted 3D Liquid-Glass aesthetic via GPU-cached CachedRelief
 *   greeting pill, frosted 3D emblem disc behind Profu, formula chip, and
 *   sculpted liquid progress capsule.
 * - On exit, the Royal-Violet curtain stays 100% opaque throughout its entire
 *   upward retraction while its bottom targetCanopyHeight cross-blends into a
 *   bit-for-bit twin of HomeSurface's skyDome; simultaneously, Profu's owl flies
 *   on a graceful parabolic arc, compensates for splash safe-zone padding
 *   (1.385x), blooms the exact circular white-and-lime badge, and docks flush
 *   before a 140ms invisible handoff dissolves LaunchSplash cleanly.
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
  const formulaEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const ribbonEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const floatPhase = useRef(new Animated.Value(0)).current;
  const ribbonFill = useRef(new Animated.Value(reducedMotion ? 1 : RIBBON_START)).current;
  const ribbonSheen = useRef(new Animated.Value(0)).current;
  const victoryBurst = useRef(new Animated.Value(0)).current;
  const owlCelebrate = useRef(new Animated.Value(0)).current;
  const chromeExit = useRef(new Animated.Value(0)).current;
  const curtainExit = useRef(new Animated.Value(0)).current;
  const owlExit = useRef(new Animated.Value(0)).current;
  const handoffFade = useRef(new Animated.Value(0)).current;

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
  const ribbonWidth = Math.round(Math.max(146, Math.min(hero.width * 0.48, 196)));
  const curtainHeight = Math.round(hero.height + hero.canopyRadius + 6);
  const targetCanopyHeight = onboardingPending ? hero.onboardingCanopyHeight : hero.homeCanopyHeight;
  const curtainRetractY = -Math.max(100, curtainHeight - targetCanopyHeight);

  // Exact pixel-centered placement of the Splash owl and sub-pixel-exact docking vector.
  const owlLeft = Math.round(hero.splashOwlCenterX - hero.splashOwlSize / 2);
  const owlTop = Math.round(hero.splashOwlCenterY - hero.splashOwlSize / 2);
  const actualOwlCenterX = owlLeft + hero.splashOwlSize / 2;
  const actualOwlCenterY = owlTop + hero.splashOwlSize / 2;

  const logoDockDx = hero.logoCenterX - actualOwlCenterX;
  const logoDockDy = hero.logoCenterY - actualOwlCenterY;
  const logoDockScale = (hero.logoImageSize * SPLASH_TO_BADGE_ART_RATIO) / hero.splashOwlSize;
  const dockingMedallionSize = Math.round(hero.logoBadgeSize / logoDockScale);
  const dockingMedallionBorder = Math.max(1, Math.round((hero.compact ? 2 : 2.5) / logoDockScale));

  // Frosted 3D glass emblem disc behind the floating Splash owl.
  const emblemDiscSize = Math.round(hero.splashOwlSize * 0.86);
  const emblemRingSize = Math.round(hero.splashOwlSize * 1.02);

  // Smart rhythm: cinema-rich on first launch (onboarding), crisp athletic sting on daily returns.
  const introSettleMs = onboardingPending ? 860 : 560;
  const celebrateBeatMs = onboardingPending ? 250 : 180;

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
        formulaEnter.setValue(1);
        ribbonEnter.setValue(1);
        notifyIntroSettledOnce();
        return;
      }

      // Immediate layered studio illumination over exact #5218D2 native surface (zero empty-purple pause).
      startTiming(gradientReveal, 1, 360, 0);
      startTiming(gridReveal, 1, 420, 20);
      startTiming(lightReveal, 1, 440, 35);
      startTiming(owlEnter, 1, 480, 45);
      startTiming(copyEnter, 1, 400, 160);
      startTiming(formulaEnter, 1, 380, 240);
      startTiming(ribbonEnter, 1, 340, 300);

      ambientTimer = setTimeout(() => {
        if (!active) return;
        const loop = createNativeLoop(floatPhase, 3_400);
        loops.push(loop);
        ambientLoopsRef.current.push(loop);
        loop.start();
      }, 520);

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
    formulaEnter,
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
    visualsReady,
  ]);

  // Smooth uninterrupted glide of the sculpted liquid shimmer capsule while startup resolves.
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
      duration: 220,
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

  // Celebratory hop + Seamless Opaque Curtain-Pull + Pixel-Exact Parabolic Owl Docking + Invisible Handoff.
  useEffect(() => {
    if (!ready || !introComplete || !nativeSplashHidden) return undefined;
    if (reducedMotion) {
      finishOnce();
      return undefined;
    }
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    let handoffTimer: ReturnType<typeof setTimeout> | undefined;
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
      duration: 480,
      easing: SILKY_EASE_OUT,
      useNativeDriver: true,
    }));
    startAnim(Animated.timing(owlCelebrate, {
      toValue: 1,
      duration: 260,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }));

    const beatTimer = setTimeout(() => {
      // Stop living float so the owl starts docking smoothly from exact neutral center.
      ambientLoopsRef.current.forEach((loop) => loop.stop());
      ambientLoopsRef.current = [];
      floatPhase.stopAnimation();
      floatPhase.setValue(0);

      const curtainLiftEase = Easing.bezier(0.32, 0, 0.16, 1);

      startAnim(Animated.timing(chromeExit, {
        toValue: 1,
        duration: 230,
        easing: SILKY_EASE_OUT,
        useNativeDriver: true,
      }));
      startAnim(Animated.timing(curtainExit, {
        toValue: 1,
        duration: 480,
        delay: 0,
        easing: curtainLiftEase,
        useNativeDriver: true,
      }));
      startAnim(Animated.timing(owlExit, {
        toValue: 1,
        duration: 480,
        delay: 0,
        easing: curtainLiftEase,
        useNativeDriver: true,
      }));

      // Trigger Home card cascade right as the rising opaque curtain clears the lower workspace.
      revealTimer = setTimeout(notifyRevealOnce, 100);

      // Staged invisible handoff strictly AFTER curtain & owl dock pixel-for-pixel:
      // 0..0.70 fades curtainWrap (1->0) while owlDockWrap stays 100% opaque (zero purple bleed);
      // 0.70..1.0 dissolves owlDockWrap directly onto the already-solid Home logo badge.
      handoffTimer = setTimeout(() => {
        startAnim(Animated.timing(handoffFade, {
          toValue: 1,
          duration: 165,
          easing: Easing.linear,
          useNativeDriver: true,
        }));
      }, 485);

      // Hand touches cleanly to the destination screen right as docking completes.
      passThroughTimer = setTimeout(() => setPassThrough(true), 500);
      // Unmount LaunchSplash strictly after handoff fade & destination cascade settle.
      exitTimer = setTimeout(finishOnce, 760);
    }, celebrateBeatMs);

    return () => {
      clearTimeout(beatTimer);
      if (revealTimer) clearTimeout(revealTimer);
      if (handoffTimer) clearTimeout(handoffTimer);
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
    handoffFade,
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
          outputRange: [1.03, 1],
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

  // Curtain stays 100% OPAQUE during its entire upward retraction so Home's skyDome
  // never shows through as a double arch. Immediate initial arch lift clears the bottom
  // overhang right as splash chrome dissolves (zero empty-purple pause), then fades first
  // during handoffFade (0 -> 0.7) while owlDockWrap remains 100% opaque above it.
  const curtainMorphStyle = useMemo(() => {
    const immediateArchLift = -Math.min(Math.abs(curtainRetractY) * 0.28, hero.canopyRadius + 52);
    return {
      opacity: handoffFade.interpolate({
        inputRange: [0, 0.7, 1],
        outputRange: [1, 0, 0],
        extrapolate: 'clamp',
      }),
      transform: [
        {
          translateY: curtainExit.interpolate({
            inputRange: [0, 0.14, 0.56, 1],
            outputRange: [0, immediateArchLift, curtainRetractY * 0.68, curtainRetractY],
            extrapolate: 'clamp',
          }),
        },
      ],
    };
  }, [curtainExit, curtainRetractY, handoffFade, hero.canopyRadius]);

  // Bottom targetCanopyHeight slice inside the retracting curtain cross-blends smoothly into
  // a bit-for-bit twin of HomeSurface's skyDome so touchdown has zero color or grid jump.
  const destinationCanopyStyle = useMemo(() => ({
    opacity: curtainExit.interpolate({
      inputRange: [0, 0.14, 0.82, 1],
      outputRange: [0, 0, 1, 1],
      extrapolate: 'clamp',
    }),
  }), [curtainExit]);

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
          outputRange: [0, -16],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [chromeExit]);

  const emblemStageStyle = useMemo(() => ({
    opacity: Animated.multiply(
      lightReveal,
      chromeExit.interpolate({
        inputRange: [0, 0.85, 1],
        outputRange: [1, 0, 0],
        extrapolate: 'clamp',
      }),
    ),
    transform: [
      {
        scale: Animated.multiply(
          owlEnter.interpolate({
            inputRange: [0, 1],
            outputRange: [0.82, 1],
            extrapolate: 'clamp',
          }),
          chromeExit.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.14],
            extrapolate: 'clamp',
          }),
        ),
      },
    ],
  }), [chromeExit, lightReveal, owlEnter]);

  // Smooth 5-point parabolic docking arc into the exact top-left circular header badge.
  // Stays 100% opaque through touchdown AND through curtainWrap's fade (handoffFade 0->0.7)
  // so zero purple can bleed through the white + Electric-Lime medallion, then dissolves
  // invisibly onto the identical already-visible Home logo badge (0.7->1.0).
  const owlDockFlightStyle = useMemo(() => ({
    opacity: handoffFade.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [1, 1, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: owlExit.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: [0, logoDockDx * 0.16, logoDockDx * 0.44, logoDockDx * 0.78, logoDockDx],
          extrapolate: 'clamp',
        }),
      },
      {
        translateY: owlExit.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: [0, logoDockDy * 0.34, logoDockDy * 0.66, logoDockDy * 0.9, logoDockDy],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: owlExit.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: [
            1,
            1 - (1 - logoDockScale) * 0.2,
            1 - (1 - logoDockScale) * 0.52,
            1 - (1 - logoDockScale) * 0.82,
            logoDockScale,
          ],
          extrapolate: 'clamp',
        }),
      },
      {
        rotate: owlExit.interpolate({
          inputRange: [0, 0.28, 0.62, 0.88, 1],
          outputRange: ['0deg', '-9deg', '-4deg', '1.8deg', '0deg'],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [handoffFade, logoDockDx, logoDockDy, logoDockScale, owlExit]);

  // Crisp white + Electric-Lime circular medallion blooms around the owl right as it docks.
  const dockingMedallionStyle = useMemo(() => ({
    opacity: owlExit.interpolate({
      inputRange: [0, 0.42, 0.82, 1],
      outputRange: [0, 0, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        scale: owlExit.interpolate({
          inputRange: [0, 0.42, 0.84, 1],
          outputRange: [0.76, 0.76, 1, 1],
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
          outputRange: [34, -6, 1.5, 0],
          extrapolate: 'clamp',
        }),
      },
      {
        scaleX: owlEnter.interpolate({
          inputRange: [0, 0.5, 0.72, 0.88, 1],
          outputRange: [0.78, 0.945, 1.05, 0.988, 1],
          extrapolate: 'clamp',
        }),
      },
      {
        scaleY: owlEnter.interpolate({
          inputRange: [0, 0.5, 0.72, 0.88, 1],
          outputRange: [0.85, 1.05, 0.955, 1.012, 1],
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
          outputRange: [0, -8, 0],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: owlCelebrate.interpolate({
          inputRange: [0, 0.45, 1],
          outputRange: [1, 1.065, 1],
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

  const formulaEnterStyle = useMemo(() => ({
    opacity: formulaEnter.interpolate({
      inputRange: [0, 0.65, 1],
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

  const copyTop = Math.round(actualOwlCenterY + hero.splashOwlSize / 2 + (hero.compact ? 14 : 20));
  const moodPillTop = Math.round(insets.top + (hero.compact ? 14 : 22));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={handleSceneLayout}
      pointerEvents={passThrough ? 'none' : 'auto'}
      style={styles.root}
    >
      <StatusBar style="light" />

      {/* Full-bleed curved Royal-Violet Curtain — stays 100% opaque while pulling up so zero double-curtain occurs */}
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
          {/* Layer 1: Full-screen Royal-Violet studio gradient */}
          <Animated.View style={[StyleSheet.absoluteFill, gradientRevealStyle]}>
            <LinearGradient
              colors={ROYAL_HERO_GRADIENT}
              start={{ x: 0.08, y: 0 }}
              end={{ x: 0.92, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Layer 2: Unified RoyalHeroCanopyBackdrop */}
          {visualsReady ? (
            <Animated.View style={[StyleSheet.absoluteFill, gridRevealStyle]}>
              <RoyalHeroCanopyBackdrop
                width={hero.width}
                height={curtainHeight}
                showGradient={false}
              />
            </Animated.View>
          ) : null}

          {/* Layer 3: Center studio spotlight behind Profu (dissolves cleanly before takeoff) */}
          {visualsReady ? (
            <Animated.View style={[StyleSheet.absoluteFill, lightRevealStyle]}>
              <SplashCenterSpotlightSvg
                width={hero.width}
                height={curtainHeight}
                owlCenterY={actualOwlCenterY}
                period={mood.period}
              />
            </Animated.View>
          ) : null}

          {/* Layer 4: Pixel-exact twin of HomeSurface's skyDome aligned to bottom of curtain — eliminates gradient/grid shift on handoff */}
          {visualsReady ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.destinationCanopy,
                { height: targetCanopyHeight },
                destinationCanopyStyle,
              ]}
            >
              <LinearGradient
                colors={ROYAL_HERO_GRADIENT}
                start={{ x: 0.08, y: 0 }}
                end={{ x: 0.92, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <RoyalHeroCanopyBackdrop
                width={hero.width}
                height={targetCanopyHeight}
                showGradient={false}
              />
            </Animated.View>
          ) : null}
        </View>
      </Animated.View>

      {/* Top frosted Liquid-Glass time-of-day greeting pill echoing Home's header chrome */}
      {visualsReady ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.moodPillPos, { top: moodPillTop }, chromeExitStyle]}
        >
          <Animated.View style={[styles.moodPillShadow, copyEnterStyle]}>
            <CachedOutsetShadow
              borderRadius={radii.pill}
              shadow={SPLASH_SHADOWS.glassOutset}
              padTop={14}
              padX={18}
              padBottom={24}
            />
            <View style={styles.moodPill}>
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.30)', 'rgba(255, 255, 255, 0.11)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <CachedInsetRelief borderRadius={radii.pill} shadow={SPLASH_SHADOWS.glassInset} zIndex={1} />
              <View style={styles.moodDotHalo}>
                <View style={styles.moodDot} />
              </View>
              <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.moodText}>
                {mood.greeting}
              </Text>
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}

      {/* Sculpted 3D frosted-glass studio emblem stage behind Profu (dissolves cleanly before owl flight) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.emblemStageCenter,
          { left: actualOwlCenterX, top: actualOwlCenterY },
          emblemStageStyle,
        ]}
      >
        <View
          style={[
            styles.emblemOuterRing,
            {
              width: emblemRingSize,
              height: emblemRingSize,
              borderRadius: emblemRingSize / 2,
            },
          ]}
        />
        <View
          style={[
            styles.emblemDiscWrap,
            {
              width: emblemDiscSize,
              height: emblemDiscSize,
              borderRadius: emblemDiscSize / 2,
            },
          ]}
        >
          <CachedOutsetShadow
            borderRadius={emblemDiscSize / 2}
            shadow={SPLASH_SHADOWS.emblemOutset}
            padTop={20}
            padX={24}
            padBottom={34}
          />
          <View
            style={[
              styles.emblemDisc,
              {
                borderRadius: emblemDiscSize / 2,
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.24)', 'rgba(220, 198, 255, 0.12)', 'rgba(130, 82, 255, 0.14)']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <CachedInsetRelief borderRadius={emblemDiscSize / 2} shadow={SPLASH_SHADOWS.emblemInset} zIndex={1} />
          </View>
        </View>
      </Animated.View>

      {/* Celebratory math sparks centered behind the hero owl */}
      <View
        pointerEvents="none"
        style={[styles.sparksOrigin, { left: actualOwlCenterX, top: actualOwlCenterY }]}
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

      {/* Pixel-exact docking hero owl: flies on parabolic arc and lands flush on top-left circular Home badge */}
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

      {/* Brand wordmark + sculpted 3D formula chip strictly mounted after UI fonts resolve */}
      {visualsReady ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.identityPos, { top: copyTop }, chromeExitStyle]}
        >
          <Animated.View style={[styles.identityBlock, copyEnterStyle]}>
            <Text
              maxFontSizeMultiplier={1.28}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              style={[styles.brand, hero.compact && styles.brandCompact]}
            >
              Profu’ <Text style={styles.brandAccent}>de mate</Text>
            </Text>
            <Text maxFontSizeMultiplier={1.25} style={styles.promise}>
              Matematica, pas cu pas.
            </Text>
          </Animated.View>

          {!hero.compact ? (
            <Animated.View style={[styles.formulaPillShadow, formulaEnterStyle]}>
              <CachedOutsetShadow
                borderRadius={radii.pill}
                shadow={SPLASH_SHADOWS.formulaOutset}
                padTop={12}
                padX={16}
                padBottom={20}
              />
              <View style={styles.formulaPill}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.24)', 'rgba(255, 255, 255, 0.09)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <CachedInsetRelief borderRadius={radii.pill} shadow={SPLASH_SHADOWS.formulaInset} zIndex={1} />
                <Text accessible={false} style={styles.formulaSpark}>✦</Text>
                <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.formulaText}>
                  {mood.formula}
                </Text>
              </View>
            </Animated.View>
          ) : null}
        </Animated.View>
      ) : null}

      {/* Sculpted 3D recessed Liquid-Glass shimmer progress capsule */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ribbonPos,
          { bottom: Math.max(insets.bottom, 22) + 22 },
          chromeExitStyle,
        ]}
      >
        <Animated.View style={[styles.ribbonTrack, { width: ribbonWidth }, ribbonEnterStyle]}>
          <CachedInsetRelief borderRadius={radii.pill} shadow={SPLASH_SHADOWS.ribbonRecess} zIndex={2} />
          <Animated.View style={[styles.ribbonFill, ribbonFillStyle]}>
            <LinearGradient
              colors={['#F4FF8C', '#D8FF3E', '#43E6DE']}
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
  destinationCanopy: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  moodPillPos: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  moodPillShadow: {
    position: 'relative',
  },
  moodPill: {
    height: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 10,
    paddingRight: 14,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  moodDotHalo: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(216, 255, 62, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  moodDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.lime,
  },
  moodText: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 12.5,
    lineHeight: 15,
    letterSpacing: 0.1,
    includeFontPadding: false,
    zIndex: 2,
  },
  emblemStageCenter: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemOuterRing: {
    position: 'absolute',
    borderWidth: 1.4,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  emblemDiscWrap: {
    position: 'relative',
  },
  emblemDisc: {
    flex: 1,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
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
    gap: 14,
  },
  identityBlock: {
    alignItems: 'center',
    width: '100%',
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
    marginTop: 5,
    fontFamily: fonts.bodyMedium,
    color: 'rgba(244, 238, 255, 0.92)',
    fontSize: 15.5,
    lineHeight: 21,
    letterSpacing: 0.15,
    textAlign: 'center',
    includeFontPadding: false,
  },
  formulaPillShadow: {
    position: 'relative',
  },
  formulaPill: {
    height: 32,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  formulaSpark: {
    fontFamily: fonts.display,
    color: colors.lime,
    fontSize: 11,
    lineHeight: 13,
    includeFontPadding: false,
    zIndex: 2,
  },
  formulaText: {
    fontFamily: fonts.bodyBold,
    color: 'rgba(255, 255, 255, 0.94)',
    fontSize: 12.5,
    lineHeight: 15,
    letterSpacing: 0.25,
    includeFontPadding: false,
    zIndex: 2,
  },
  ribbonPos: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    height: 20,
  },
  ribbonTrack: {
    height: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'rgba(20, 5, 68, 0.34)',
    overflow: 'hidden',
    position: 'relative',
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
    width: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
});
