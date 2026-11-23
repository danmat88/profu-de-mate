import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';
import { bundledImageSource } from '../../shared/services/bundledImages';
import { colors, fonts, radii } from '../../shared/theme';
import { ComicBackdrop } from '../../shared/ui/ComicBackdrop';
import { Text } from '../../shared/ui/Typography';

type Props = {
  ready: boolean;
  visualsReady: boolean;
  startupReady?: boolean;
  reducedMotion: boolean;
  onIntroSettled?: () => void;
  onRevealStart?: () => void;
  onFinish: () => void;
};

// Critically-damped ease-out curve matching SplashProgressHeader 1 - (1 - t)^3 exactly.
const SILKY_EASE_OUT = Easing.out(Easing.cubic);

// 17-point exact sinusoidal tables so single-timing Animated.loop calls execute
// natively via Android _startNativeLoop(-1) with zero JS callbacks and seamless wrap.
const WAVE_INPUT = [
  0, 0.0625, 0.125, 0.1875, 0.25, 0.3125, 0.375, 0.4375,
  0.5, 0.5625, 0.625, 0.6875, 0.75, 0.8125, 0.875, 0.9375, 1,
];
// Owl floats smoothly between -6dp (peak) and +2dp (rest).
const OWL_FLOAT_Y = WAVE_INPUT.map((t) => -2 - Math.sin(2 * Math.PI * t) * 4.5);
// Ground shadow responds in exact inverse phase: narrower/softer when owl rises, wider when owl lowers.
const SHADOW_SCALE_X = WAVE_INPUT.map((t) => 0.96 + Math.sin(2 * Math.PI * t) * 0.11);
const SHADOW_OPACITY = WAVE_INPUT.map((t) => 0.14 + Math.sin(2 * Math.PI * t) * 0.045);
// Luminous spotlight halo breathes gently behind the floating character.
const AURA_SCALE = WAVE_INPUT.map((t) => 0.96 + 0.08 * (0.5 - 0.5 * Math.cos(2 * Math.PI * t)));
const AURA_OPACITY = WAVE_INPUT.map((t) => 0.78 + 0.22 * (0.5 - 0.5 * Math.cos(2 * Math.PI * t)));

const PROGRESS_GLIDE_MS = 1_850;
const PROGRESS_START = 0.06;
const PROGRESS_GLIDE_CAP = 0.92;

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
 * Flagship character-spotlight launch splash sharing the exact warm cream
 * canvas of Android native splash and Home. Lets the illustrated owl float
 * freely above a real inverse-phase ground shadow inside a soft rotating
 * studio orbit, paired with a sleek borderless liquid progress bar powered
 * 100% by Android RenderThread native-driver animations (zero Reanimated).
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
  const [sceneReady, setSceneReady] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  const [introStarted, setIntroStarted] = useState(reducedMotion);
  const [introComplete, setIntroComplete] = useState(reducedMotion);

  // Pure native-driver Animated values (100% Android RenderThread, 0 Reanimated worklets).
  const auraEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const owlEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const copyEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const underlineReveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const progressEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const floatPhase = useRef(new Animated.Value(0)).current;
  const auraBreathPhase = useRef(new Animated.Value(0)).current;
  const orbitPhase = useRef(new Animated.Value(0)).current;
  const progressFill = useRef(new Animated.Value(reducedMotion ? 1 : PROGRESS_START)).current;
  const barSheenPhase = useRef(new Animated.Value(0)).current;
  const stageExit = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(1)).current;

  const introSettledRef = useRef(onIntroSettled);
  const revealStartRef = useRef(onRevealStart);
  const finishRef = useRef(onFinish);
  const introNotified = useRef(false);
  const revealed = useRef(false);
  const finished = useRef(false);
  const progressGlideStarted = useRef(false);
  const progressCompleted = useRef(false);

  const handleSceneLayout = useCallback(() => setSceneReady(true), []);
  const compact = height < 720;
  const owlSize = compact ? 186 : Math.min(228, Math.round(width * 0.56));
  const orbitSize = owlSize + 54;
  // Deterministic geometry from frame width avoids mid-flight onLayout interpolation resets.
  const trackOuterWidth = Math.round(Math.max(216, Math.min(width - 76, 286)));
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

  // Hide native splash once the warm canvas and owl artwork are painted, then play silky beats.
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
      value.setValue(0);
      const loop = Animated.loop(
        Animated.timing(value, {
          toValue: 1,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loops.push(loop);
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
        copyEnter.setValue(1);
        underlineReveal.setValue(1);
        progressEnter.setValue(1);
        notifyIntroSettledOnce();
        return;
      }

      // Silky 3-beat critically-damped entrance (zero wobble, zero overshoot).
      startTiming(auraEnter, 1, 500, 0);
      startTiming(owlEnter, 1, 440, 0);
      startTiming(copyEnter, 1, 400, 95);
      startTiming(underlineReveal, 1, 320, 220, SILKY_EASE_OUT);
      startTiming(progressEnter, 1, 350, 175);

      // Gentle pure-native RenderThread living loops begin seamlessly as entrance settles.
      ambientTimer = setTimeout(() => {
        if (!active) return;
        startNativeLoop(floatPhase, 3_000);
        startNativeLoop(auraBreathPhase, 3_600);
        startNativeLoop(orbitPhase, 34_000);
      }, 420);

      // Mount Home behind the splash only after the entrance animation is settled.
      introTimer = setTimeout(() => {
        if (active) notifyIntroSettledOnce();
      }, 540);
    });
    const introFallback = setTimeout(() => {
      if (active) notifyIntroSettledOnce();
    }, 950);

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      if (introTimer) clearTimeout(introTimer);
      if (ambientTimer) clearTimeout(ambientTimer);
      clearTimeout(introFallback);
      oneShotAnims.forEach((anim) => anim.stop());
      loops.forEach((loop) => loop.stop());
      floatPhase.stopAnimation();
      auraBreathPhase.stopAnimation();
      orbitPhase.stopAnimation();
    };
  }, [
    auraBreathPhase,
    auraEnter,
    copyEnter,
    floatPhase,
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

  // Single smooth completion glide to 100% once startup and navigation are ready.
  useEffect(() => {
    if (!ready || progressCompleted.current) return undefined;
    progressCompleted.current = true;
    if (reducedMotion) {
      progressFill.setValue(1);
      return undefined;
    }
    const anim = Animated.timing(progressFill, {
      toValue: 1,
      duration: 230,
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
    barSheenPhase.setValue(0);
    const sheenLoop = Animated.loop(
      Animated.timing(barSheenPhase, {
        toValue: 1,
        duration: 1_300,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    sheenLoop.start();
    return () => {
      sheenLoop.stop();
      barSheenPhase.stopAnimation();
    };
  }, [barSheenPhase, introStarted, ready, reducedMotion]);

  // Graceful unified baton-pass exit into Home once intro, startup, and navigation are ready.
  useEffect(() => {
    if (!ready || !introComplete || !nativeSplashHidden) return undefined;
    if (reducedMotion) {
      finishOnce();
      return undefined;
    }
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    let exitAnim: Animated.CompositeAnimation | undefined;
    let backdropAnim: Animated.CompositeAnimation | undefined;

    const beatTimer = setTimeout(() => {
      exitAnim = Animated.timing(stageExit, {
        toValue: 1,
        duration: 235,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      });
      backdropAnim = Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 205,
        delay: 95,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
      exitAnim.start();
      backdropAnim.start();
      revealTimer = setTimeout(notifyRevealOnce, 120);
      exitTimer = setTimeout(finishOnce, 310);
    }, 210);

    return () => {
      clearTimeout(beatTimer);
      if (revealTimer) clearTimeout(revealTimer);
      if (exitTimer) clearTimeout(exitTimer);
      exitAnim?.stop();
      backdropAnim?.stop();
    };
  }, [
    backdropOpacity,
    finishOnce,
    introComplete,
    nativeSplashHidden,
    notifyRevealOnce,
    ready,
    reducedMotion,
    stageExit,
  ]);

  // Bounded hard deadline guarantees the splash can never stall launch.
  useEffect(() => {
    if (!sceneReady || !imageReady || !visualsReady || !nativeSplashHidden || !ready) return undefined;
    const hardDeadline = setTimeout(finishOnce, 2_500);
    return () => clearTimeout(hardDeadline);
  }, [finishOnce, imageReady, nativeSplashHidden, ready, sceneReady, visualsReady]);

  // Strictly memoized interpolations keep Android Fabric native node graphs intact across renders.
  const rootAnimated = useMemo(() => ({ opacity: backdropOpacity }), [backdropOpacity]);

  const stageExitStyle = useMemo(() => ({
    opacity: stageExit.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: stageExit.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -22],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: stageExit.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.96],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [stageExit]);

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
          outputRange: [0.78, 1],
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

  const orbitRotateStyle = useMemo(() => ({
    transform: [
      {
        rotate: orbitPhase.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  }), [orbitPhase]);

  const owlEnterStyle = useMemo(() => ({
    opacity: owlEnter.interpolate({
      inputRange: [0, 0.62, 1],
      outputRange: [0, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: owlEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [22, 0],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: owlEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [0.84, 1],
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
    ],
  }), [floatPhase]);

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
          outputRange: [16, 0],
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
          outputRange: [12, 0],
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
      outputRange: [0, 0.58, 0.58, 0, 0],
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

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={handleSceneLayout}
      pointerEvents="auto"
      style={[styles.root, rootAnimated]}
    >
      <StatusBar style="dark" />

      {/* Mount custom-font text and backdrop symbols only after Font.loadAsync
          has resolved so Android never caches a temporary fallback typeface. */}
      {visualsReady ? (
        <>
          <ComicBackdrop />

          <Animated.View style={[styles.stage, compact && styles.stageCompact, stageExitStyle]}>
            <View style={styles.topSpacer} />

            {/* Flagship free-floating character spotlight */}
            <View style={styles.centerCluster}>
              <View style={[styles.heroStage, { width: orbitSize + 12, height: orbitSize + 4 }]}>
                {/* Soft radial studio spotlight & delicate orbiting planet dots */}
                <Animated.View pointerEvents="none" style={[styles.auraWrap, auraEnterStyle]}>
                  <Animated.View
                    style={[
                      styles.auraOuter,
                      { width: orbitSize, height: orbitSize, borderRadius: orbitSize / 2 },
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

                  <Animated.View
                    style={[
                      styles.orbitRing,
                      { width: orbitSize - 8, height: orbitSize - 8, borderRadius: (orbitSize - 8) / 2 },
                      orbitRotateStyle,
                    ]}
                  >
                    <View style={[styles.orbitBead, styles.orbitBeadLime]} />
                    <View style={[styles.orbitBead, styles.orbitBeadCyan]} />
                    <View style={[styles.orbitBeadSmall, styles.orbitBeadPeach]} />
                  </Animated.View>
                </Animated.View>

                {/* Free-floating illustrated owl (no boxy frame!) */}
                <Animated.View style={[styles.owlAnchor, owlEnterStyle]}>
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
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.groundShadow,
                      { width: Math.round(owlSize * 0.54) },
                      groundShadowStyle,
                    ]}
                  />
                </Animated.View>
              </View>

              {/* Confident, iconic editorial wordmark */}
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
            </View>

            {/* Sleek floating liquid progress strip (zero clunky border boxes!) */}
            <Animated.View style={[styles.progressBlock, { width: trackOuterWidth }, progressEnterStyle]}>
              <SplashProgressHeader
                ready={ready}
                startupReady={startupReady}
                introStarted={introStarted}
                reducedMotion={reducedMotion}
                stageLabel={stageLabel}
              />

              <View style={[styles.barTrack, { width: trackOuterWidth }]}>
                <Animated.View style={[styles.barFill, ready && styles.barFillReady, fillTransformStyle]}>
                  <View pointerEvents="none" style={styles.barFillHighlight} />
                  <Animated.View pointerEvents="none" style={[styles.barSheen, barSheenStyle]} />
                  <View pointerEvents="none" style={styles.barLeadingGlow} />
                </Animated.View>
              </View>
            </Animated.View>
          </Animated.View>
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
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: '11%',
    paddingBottom: '12%',
  },
  stageCompact: {
    paddingTop: '8%',
    paddingBottom: '9%',
  },
  topSpacer: {
    height: 16,
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
    backgroundColor: 'rgba(124, 60, 255, 0.085)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  auraMid: {
    backgroundColor: 'rgba(216, 255, 62, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  auraCore: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  orbitRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(124, 60, 255, 0.22)',
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

  // Confident wordmark lockup
  identityBlock: {
    marginTop: 14,
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
    marginTop: 6,
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.1,
    textAlign: 'center',
    includeFontPadding: false,
  },

  // Sleek modern floating liquid progress bar
  progressBlock: {
    gap: 10,
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
  barTrack: {
    height: 12,
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
    backgroundColor: 'rgba(255, 255, 255, 0.56)',
  },
  barLeadingGlow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 14,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
  },
});
