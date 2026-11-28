import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
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
  homeCurtainHandoff?: boolean;
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

type FlightTrailSpec = {
  symbol: string;
  color: string;
  size: number;
  lag: number;
  offsetX: number;
  offsetY: number;
  spinFrom: string;
  spinTo: string;
};

type DockSparkSpec = {
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
  { symbol: '✦', dx: -96, dy: -70, rotate: '-26deg', color: colors.lime, size: 19 },
  { symbol: '+', dx: 98, dy: -60, rotate: '24deg', color: colors.cyan, size: 21 },
  { symbol: 'π', dx: -90, dy: 28, rotate: '-16deg', color: colors.paper, size: 18 },
  { symbol: '★', dx: 92, dy: 30, rotate: '26deg', color: colors.gold, size: 18 },
  { symbol: '√', dx: 4, dy: -106, rotate: '12deg', color: colors.limeBright, size: 18 },
];

// 5-star luminous comet slipstream drifting behind Profu's graceful 740ms swoop arc.
const FLIGHT_TRAIL_SPECS: readonly FlightTrailSpec[] = [
  { symbol: '✦', color: colors.lime, size: 20, lag: 0.06, offsetX: 8, offsetY: 10, spinFrom: '-32deg', spinTo: '52deg' },
  { symbol: '✦', color: colors.cyan, size: 16, lag: 0.15, offsetX: -11, offsetY: 16, spinFrom: '24deg', spinTo: '-48deg' },
  { symbol: '★', color: colors.gold, size: 14, lag: 0.24, offsetX: 13, offsetY: 22, spinFrom: '-22deg', spinTo: '56deg' },
  { symbol: '✦', color: colors.paper, size: 12, lag: 0.33, offsetX: -8, offsetY: 28, spinFrom: '18deg', spinTo: '-40deg' },
  { symbol: '+', color: colors.limeBright, size: 12, lag: 0.42, offsetX: 6, offsetY: 32, spinFrom: '-14deg', spinTo: '38deg' },
];

// Celebratory micro-sparks radiating from the top-left circular badge on touchdown.
const DOCK_IMPACT_SPARKS: readonly DockSparkSpec[] = [
  { symbol: '✦', dx: 30, dy: -22, rotate: '28deg', color: colors.lime, size: 14 },
  { symbol: '✦', dx: 34, dy: 16, rotate: '-24deg', color: colors.cyan, size: 12 },
  { symbol: '★', dx: -16, dy: 30, rotate: '34deg', color: colors.gold, size: 12 },
  { symbol: '+', dx: -26, dy: -18, rotate: '-22deg', color: colors.paper, size: 11 },
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
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const spotId = `spSpot_${uid}`;
  const floorId = `spFlr_${uid}`;
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
        <RadialGradient id={spotId} cx="50%" cy={spotCy} rx="56%" ry="34%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
          <Stop offset="34%" stopColor={tint} stopOpacity="0.18" />
          <Stop offset="68%" stopColor="#9B58FF" stopOpacity="0.065" />
          <Stop offset="100%" stopColor="#5218D2" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={floorId} cx="50%" cy={floorCy} rx="22%" ry="2.3%">
          <Stop offset="0%" stopColor="#1B064F" stopOpacity="0.34" />
          <Stop offset="65%" stopColor="#1B064F" stopOpacity="0.1" />
          <Stop offset="100%" stopColor="#1B064F" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${spotId})`} />
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${floorId})`} />
    </Svg>
  );
});

/**
 * Soft luminous radial glow aura traveling behind Profu during swoop flight.
 */
const OwlFlightAuraSvg = memo(function OwlFlightAuraSvg({ size }: { size: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const auraId = `owlAura_${uid}`;
  return (
    <Svg pointerEvents="none" width={size} height={size}>
      <Defs>
        <RadialGradient id={auraId} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.64" />
          <Stop offset="42%" stopColor="#D8FF3E" stopOpacity="0.34" />
          <Stop offset="76%" stopColor="#43D6E6" stopOpacity="0.12" />
          <Stop offset="100%" stopColor="#732CF4" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={size} height={size} fill={`url(#${auraId})`} />
    </Svg>
  );
});

/**
 * Sample the heroic owl swoop curve at normalized progress p in [0, 1].
 * Keeps the 5-star comet slipstream locked precisely onto the owl's flight trajectory.
 */
function sampleSwoopOffset(p: number, dx: number, dy: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(1, p));
  const lerpSeg = (stops: readonly number[], vals: readonly number[]): number => {
    for (let i = 0; i < stops.length - 1; i += 1) {
      if (clamped <= stops[i + 1]) {
        const span = Math.max(0.0001, stops[i + 1] - stops[i]);
        const frac = (clamped - stops[i]) / span;
        return vals[i] + (vals[i + 1] - vals[i]) * frac;
      }
    }
    return vals[vals.length - 1];
  };
  const stops = [0, 0.25, 0.5, 0.75, 1];
  return {
    x: lerpSeg(stops, [0, dx * 0.14, dx * 0.45, dx * 0.8, dx]),
    y: lerpSeg(stops, [0, dy * 0.28, dy * 0.62, dy * 0.88, dy]),
  };
}

/**
 * Flagship 3D Royal-Violet launch splash with unhurried, seamless cinema handoff:
 * - Frame 0 matches Android's native splash color (#5218D2) with zero flash.
 * - On Home launches (homeCurtainHandoff), hands its static full-screen purple
 *   backdrop invisibly onto HomeSurface's own zIndex:1 skyDome BEFORE the curtain
 *   starts lifting, so there is strictly ONE unsplit curtain on screen while Home's
 *   header pills, greeting, and waving Mascot animate live on top of it (zero
 *   double curtain, zero horizontal seam, zero empty dome).
 * - On Onboarding / Pending launches, retracts its own single curved curtain
 *   gracefully over 760ms.
 * - Profu performs a Pixar squash-and-launch takeoff, glides across the sky over
 *   a luxurious 740ms banked swoop with luminous radial aura & 5-star comet trail,
 *   blooms its crisp white + Electric-Lime circular medallion, docks with double
 *   shockwave rings + elastic micro-bounce, and hands off invisibly.
 */
export function LaunchSplash({
  ready,
  visualsReady,
  onboardingPending = false,
  homeCurtainHandoff = false,
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
  const backdropHandoff = useRef(new Animated.Value(0)).current;
  const curtainExit = useRef(new Animated.Value(0)).current;
  const owlExit = useRef(new Animated.Value(0)).current;
  const dockImpact = useRef(new Animated.Value(0)).current;
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
  const flightAuraSize = Math.round(hero.splashOwlSize * 1.38);

  // Unhurried cinema pacing — calm anticipation beat before launch.
  const introSettleMs = onboardingPending ? 820 : 560;
  const celebrateBeatMs = onboardingPending ? 230 : 220;

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

      // Immediate layered studio illumination over exact #5218D2 native surface.
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

  // Unhurried Cinema Launch: Anticipation Squash -> Invisible Static Backdrop Handoff -> 760ms Curtain + 740ms Owl Swoop -> Double Shockwave Dock.
  useEffect(() => {
    if (!ready || !introComplete || !nativeSplashHidden) return undefined;
    if (reducedMotion) {
      finishOnce();
      return undefined;
    }
    let backdropHandoffTimer: ReturnType<typeof setTimeout> | undefined;
    let dockImpactTimer: ReturnType<typeof setTimeout> | undefined;
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

    // Arm Home & StudioTabBar immediately behind the still-static opaque Splash so zero React
    // re-render hitch occurs during flight and HomeSurface's single skyDome takes over smoothly.
    notifyRevealOnce();

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
      duration: 320,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }));

    // On Home launches, dissolve LaunchSplash's static backdrop cleanly (T = 70..180ms)
    // onto HomeSurface's pixel-identical static full-screen curtain BEFORE it starts moving,
    // guaranteeing strictly ONE single zero-seam curtain and live canopy choreography!
    if (homeCurtainHandoff) {
      backdropHandoffTimer = setTimeout(() => {
        startAnim(Animated.timing(backdropHandoff, {
          toValue: 1,
          duration: 110,
          easing: Easing.linear,
          useNativeDriver: true,
        }));
      }, 70);
    }

    const beatTimer = setTimeout(() => {
      // Stop living float so the owl launches cleanly from exact neutral center.
      ambientLoopsRef.current.forEach((loop) => loop.stop());
      ambientLoopsRef.current = [];
      floatPhase.stopAnimation();
      floatPhase.setValue(0);

      // Graceful unhurried Splash chrome melt (360ms — calm and poetic, never abrupt).
      startAnim(Animated.timing(chromeExit, {
        toValue: 1,
        duration: 360,
        easing: SILKY_EASE_OUT,
        useNativeDriver: true,
      }));

      // Fallback curtain retraction (active on Onboarding / Pending routes where HomeSurface is absent).
      startAnim(Animated.timing(curtainExit, {
        toValue: 1,
        duration: 920,
        delay: 0,
        easing: Easing.bezier(0.42, 0, 0.22, 1),
        useNativeDriver: true,
      }));

      // Unhurried, balanced 920ms heroic owl swoop — NO double front-loading, visibly soaring across the sky!
      startAnim(Animated.timing(owlExit, {
        toValue: 1,
        duration: 920,
        delay: 0,
        easing: Easing.bezier(0.42, 0, 0.22, 1),
        useNativeDriver: true,
      }));

      // Fire double concentric shockwave rings (Electric-Lime + Cyan) & 4 micro-sparks right at owl touchdown!
      dockImpactTimer = setTimeout(() => {
        dockImpact.setValue(0);
        startAnim(Animated.timing(dockImpact, {
          toValue: 1,
          duration: 380,
          easing: SILKY_EASE_OUT,
          useNativeDriver: true,
        }));
      }, 855);

      // Dissolve docked owl (and fallback curtain if active) invisibly onto the already-solid badge.
      handoffTimer = setTimeout(() => {
        startAnim(Animated.timing(handoffFade, {
          toValue: 1,
          duration: 150,
          easing: Easing.linear,
          useNativeDriver: true,
        }));
      }, 945);

      // Hand touches cleanly to Home right as docking completes.
      passThroughTimer = setTimeout(() => setPassThrough(true), 920);
      // Unmount strictly after touchdown shockwave rings & micro-sparks finish twinkling out.
      exitTimer = setTimeout(finishOnce, 1_260);
    }, celebrateBeatMs);

    return () => {
      clearTimeout(beatTimer);
      if (backdropHandoffTimer) clearTimeout(backdropHandoffTimer);
      if (dockImpactTimer) clearTimeout(dockImpactTimer);
      if (handoffTimer) clearTimeout(handoffTimer);
      if (passThroughTimer) clearTimeout(passThroughTimer);
      if (exitTimer) clearTimeout(exitTimer);
      exitAnims.forEach((anim) => anim.stop());
    };
  }, [
    backdropHandoff,
    celebrateBeatMs,
    chromeExit,
    curtainExit,
    dockImpact,
    finishOnce,
    floatPhase,
    handoffFade,
    homeCurtainHandoff,
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
        inputRange: [0, 0.75, 1],
        outputRange: [1, 0, 0],
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

  // When homeCurtainHandoff is true, stays static while dissolving invisibly (70..180ms)
  // onto HomeSurface's own single retracting skyDome. Otherwise retracts smoothly over 760ms.
  const curtainMorphStyle = useMemo(() => ({
    opacity: homeCurtainHandoff
      ? backdropHandoff.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      })
      : handoffFade.interpolate({
        inputRange: [0, 0.55, 1],
        outputRange: [1, 0, 0],
        extrapolate: 'clamp',
      }),
    transform: homeCurtainHandoff
      ? []
      : [
        {
          translateY: curtainExit.interpolate({
            inputRange: [0, 1],
            outputRange: [0, curtainRetractY],
            extrapolate: 'clamp',
          }),
        },
      ],
  }), [backdropHandoff, curtainExit, curtainRetractY, handoffFade, homeCurtainHandoff]);

  const destinationCanopyStyle = useMemo(() => ({
    opacity: homeCurtainHandoff
      ? 0
      : curtainExit.interpolate({
        inputRange: [0, 0.18, 0.82, 1],
        outputRange: [0, 0, 1, 1],
        extrapolate: 'clamp',
      }),
  }), [curtainExit, homeCurtainHandoff]);

  const chromeExitStyle = useMemo(() => ({
    opacity: chromeExit.interpolate({
      inputRange: [0, 0.88, 1],
      outputRange: [1, 0, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: chromeExit.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -24],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [chromeExit]);

  // Frosted 3D emblem disc expands calmly like a magic halo portal as Profu takes flight.
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
            outputRange: [1, 1.32],
            extrapolate: 'clamp',
          }),
        ),
      },
    ],
  }), [chromeExit, lightReveal, owlEnter]);

  // Unhurried, balanced 920ms sweeping banked swoop arc + elastic Pixar micro-bounce on touchdown.
  const owlDockFlightStyle = useMemo(() => ({
    opacity: handoffFade.interpolate({
      inputRange: [0, 0.55, 1],
      outputRange: [1, 1, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: owlExit.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: [0, logoDockDx * 0.14, logoDockDx * 0.45, logoDockDx * 0.8, logoDockDx],
          extrapolate: 'clamp',
        }),
      },
      {
        translateY: owlExit.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: [0, logoDockDy * 0.28, logoDockDy * 0.62, logoDockDy * 0.88, logoDockDy],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: owlExit.interpolate({
          inputRange: [0, 0.25, 0.56, 0.87, 0.94, 1],
          outputRange: [
            1,
            1 - (1 - logoDockScale) * 0.16,
            1 - (1 - logoDockScale) * 0.52,
            logoDockScale * 1.12,
            logoDockScale * 0.97,
            logoDockScale,
          ],
          extrapolate: 'clamp',
        }),
      },
      {
        rotate: owlExit.interpolate({
          inputRange: [0, 0.24, 0.54, 0.86, 0.95, 1],
          outputRange: ['0deg', '-16deg', '-10deg', '4deg', '-1deg', '0deg'],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [handoffFade, logoDockDx, logoDockDy, logoDockScale, owlExit]);

  // Luminous radial glow aura traveling behind Profu mid-flight.
  const owlFlightAuraStyle = useMemo(() => ({
    opacity: owlExit.interpolate({
      inputRange: [0, 0.14, 0.54, 0.86, 1],
      outputRange: [0, 0.65, 0.54, 0.16, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        scale: owlExit.interpolate({
          inputRange: [0, 0.36, 0.84, 1],
          outputRange: [0.74, 1.32, 0.88, 0.62],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [owlExit]);

  // 5-star comet slipstream drifting smoothly along Profu's swoop trajectory.
  const flightTrailStyles = useMemo(() => FLIGHT_TRAIL_SPECS.map((spec) => {
    const t0 = Math.min(0.5, spec.lag);
    const t1 = Math.min(0.72, spec.lag + 0.19);
    const t2 = Math.min(0.86, spec.lag + 0.39);
    const t3 = Math.min(0.98, spec.lag + 0.56);
    const p0 = sampleSwoopOffset(0, logoDockDx, logoDockDy);
    const p1 = sampleSwoopOffset(0.28, logoDockDx, logoDockDy);
    const p2 = sampleSwoopOffset(0.62, logoDockDx, logoDockDy);
    const p3 = sampleSwoopOffset(0.92, logoDockDx, logoDockDy);
    return {
      opacity: owlExit.interpolate({
        inputRange: [0, t0, t1, t2, t3, 1],
        outputRange: [0, 0, 0.96, 0.78, 0, 0],
        extrapolate: 'clamp',
      }),
      transform: [
        {
          translateX: owlExit.interpolate({
            inputRange: [0, t0, t1, t2, t3, 1],
            outputRange: [
              spec.offsetX,
              p0.x + spec.offsetX,
              p1.x + spec.offsetX * 0.65,
              p2.x + spec.offsetX * 0.3,
              p3.x,
              logoDockDx,
            ],
            extrapolate: 'clamp',
          }),
        },
        {
          translateY: owlExit.interpolate({
            inputRange: [0, t0, t1, t2, t3, 1],
            outputRange: [
              spec.offsetY,
              p0.y + spec.offsetY,
              p1.y + spec.offsetY * 0.65,
              p2.y + spec.offsetY * 0.3,
              p3.y,
              logoDockDy,
            ],
            extrapolate: 'clamp',
          }),
        },
        {
          scale: owlExit.interpolate({
            inputRange: [0, t0, t1, t2, t3, 1],
            outputRange: [0.3, 0.35, 1.24, 0.86, 0.25, 0.2],
            extrapolate: 'clamp',
          }),
        },
        {
          rotate: owlExit.interpolate({
            inputRange: [t0, t3],
            outputRange: [spec.spinFrom, spec.spinTo],
            extrapolate: 'clamp',
          }),
        },
      ],
    };
  }), [logoDockDx, logoDockDy, owlExit]);

  // Crisp white + Electric-Lime circular medallion blooms around the owl as it approaches the header.
  const dockingMedallionStyle = useMemo(() => ({
    opacity: owlExit.interpolate({
      inputRange: [0, 0.5, 0.84, 1],
      outputRange: [0, 0, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        scale: owlExit.interpolate({
          inputRange: [0, 0.5, 0.85, 0.93, 1],
          outputRange: [0.64, 0.64, 1.05, 0.98, 1],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [owlExit]);

  // Double concentric touchdown shockwave rings (Electric-Lime outer + Cyan inner) & 4 micro-sparks.
  const dockImpactRingStyle = useMemo(() => ({
    opacity: dockImpact.interpolate({
      inputRange: [0, 0.12, 0.56, 1],
      outputRange: [0, 0.92, 0.44, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        scale: dockImpact.interpolate({
          inputRange: [0, 1],
          outputRange: [0.86, 1.82],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [dockImpact]);

  const dockImpactInnerRingStyle = useMemo(() => ({
    opacity: dockImpact.interpolate({
      inputRange: [0, 0.18, 0.62, 1],
      outputRange: [0, 0.76, 0.3, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        scale: dockImpact.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1.46],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [dockImpact]);

  const dockImpactSparkStyles = useMemo(() => DOCK_IMPACT_SPARKS.map((spark) => ({
    opacity: dockImpact.interpolate({
      inputRange: [0, 0.16, 0.68, 1],
      outputRange: [0, 1, 0.8, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: dockImpact.interpolate({
          inputRange: [0, 1],
          outputRange: [0, spark.dx],
          extrapolate: 'clamp',
        }),
      },
      {
        translateY: dockImpact.interpolate({
          inputRange: [0, 1],
          outputRange: [0, spark.dy],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: dockImpact.interpolate({
          inputRange: [0, 0.28, 1],
          outputRange: [0.35, 1.2, 0.45],
          extrapolate: 'clamp',
        }),
      },
      {
        rotate: dockImpact.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', spark.rotate],
          extrapolate: 'clamp',
        }),
      },
    ],
  })), [dockImpact]);

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

  // Expressive Pixar anticipation crouch -> elastic spring launch -> smooth blend into swoop flight.
  const owlCelebrateStyle = useMemo(() => ({
    transform: [
      {
        translateY: owlCelebrate.interpolate({
          inputRange: [0, 0.34, 0.72, 1],
          outputRange: [0, 6.5, -14, 0],
          extrapolate: 'clamp',
        }),
      },
      {
        scaleX: owlCelebrate.interpolate({
          inputRange: [0, 0.34, 0.72, 1],
          outputRange: [1, 1.08, 0.93, 1],
          extrapolate: 'clamp',
        }),
      },
      {
        scaleY: owlCelebrate.interpolate({
          inputRange: [0, 0.34, 0.72, 1],
          outputRange: [1, 0.915, 1.08, 1],
          extrapolate: 'clamp',
        }),
      },
      {
        rotate: owlCelebrate.interpolate({
          inputRange: [0, 0.34, 0.72, 1],
          outputRange: ['0deg', '5deg', '-6deg', '0deg'],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [owlCelebrate]);

  const sparkStyles = useMemo(() => CELEBRATION_SPARKS.map((spark) => ({
    opacity: victoryBurst.interpolate({
      inputRange: [0, 0.14, 0.68, 1],
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
          outputRange: [0.3, 1.18, 0.7],
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

      {/* Full-bleed Royal-Violet backdrop: hands off statically to HomeSurface's own skyDome on Home launch, or retracts smoothly on Onboarding */}
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
        <View
          style={[
            styles.curtainSurface,
            {
              borderBottomLeftRadius: hero.canopyRadius,
              borderBottomRightRadius: hero.canopyRadius,
            },
          ]}
        >
          <Animated.View style={[StyleSheet.absoluteFill, gradientRevealStyle]}>
            <LinearGradient
              colors={ROYAL_HERO_GRADIENT}
              start={{ x: 0.08, y: 0 }}
              end={{ x: 0.92, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {visualsReady ? (
            <Animated.View style={[StyleSheet.absoluteFill, gridRevealStyle]}>
              <RoyalHeroCanopyBackdrop
                width={hero.width}
                height={curtainHeight}
                showGradient={false}
              />
            </Animated.View>
          ) : null}

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

          {visualsReady && !homeCurtainHandoff ? (
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

      {/* Sculpted 3D frosted-glass studio emblem stage behind Profu (expands like a soft halo portal on launch) */}
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

      {/* Celebratory takeoff math sparks + 5-star luminous comet slipstream trail */}
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

        {visualsReady
          ? FLIGHT_TRAIL_SPECS.map((trail, index) => (
            <Animated.View
              key={`trail-${index}`}
              style={[styles.sparkAnchor, flightTrailStyles[index]]}
            >
              <Text
                accessible={false}
                style={[
                  styles.sparkText,
                  { color: trail.color, fontSize: trail.size, lineHeight: trail.size + 3 },
                ]}
              >
                {trail.symbol}
              </Text>
            </Animated.View>
          ))
          : null}
      </View>

      {/* Double shockwave rings (Electric-Lime + Cyan) & 4 micro-sparks anchored at top-left badge */}
      <View
        pointerEvents="none"
        style={[styles.sparksOrigin, { left: hero.logoCenterX, top: hero.logoCenterY }]}
      >
        <Animated.View
          style={[
            styles.dockImpactRing,
            {
              width: hero.logoBadgeSize + 4,
              height: hero.logoBadgeSize + 4,
              borderRadius: (hero.logoBadgeSize + 4) / 2,
            },
            dockImpactRingStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.dockImpactInnerRing,
            {
              width: hero.logoBadgeSize + 2,
              height: hero.logoBadgeSize + 2,
              borderRadius: (hero.logoBadgeSize + 2) / 2,
            },
            dockImpactInnerRingStyle,
          ]}
        />
        {visualsReady
          ? DOCK_IMPACT_SPARKS.map((spark, index) => (
            <Animated.View
              key={`dock-spark-${index}`}
              style={[styles.sparkAnchor, dockImpactSparkStyles[index]]}
            >
              <Text
                accessible={false}
                style={[
                  styles.sparkText,
                  { color: spark.color, fontSize: spark.size, lineHeight: spark.size + 2 },
                ]}
              >
                {spark.symbol}
              </Text>
            </Animated.View>
          ))
          : null}
      </View>

      {/* Pixel-exact docking hero owl: Pixar crouch -> 740ms luminous swoop -> medallion bloom -> micro-bounce */}
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
        {visualsReady ? (
          <Animated.View
            style={[
              styles.owlFlightAura,
              { width: flightAuraSize, height: flightAuraSize },
              owlFlightAuraStyle,
            ]}
          >
            <OwlFlightAuraSvg size={flightAuraSize} />
          </Animated.View>
        ) : null}
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
  dockImpactRing: {
    position: 'absolute',
    borderWidth: 2.4,
    borderColor: colors.lime,
  },
  dockImpactInnerRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: colors.cyan,
  },
  owlDockWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  owlFlightAura: {
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
