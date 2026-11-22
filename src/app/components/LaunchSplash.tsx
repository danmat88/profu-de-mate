import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { bundledImageSource } from '../../shared/services/bundledImages';
import { borders, colors, fonts, radii, shadows, springs } from '../../shared/theme';
import { Chip } from '../../shared/ui/Chip';
import { ComicBackdrop } from '../../shared/ui/ComicBackdrop';
import { Text } from '../../shared/ui/Typography';

type Props = {
  ready: boolean;
  visualsReady: boolean;
  startupReady?: boolean;
  reducedMotion: boolean;
  onRevealStart?: () => void;
  onFinish: () => void;
};

type StickerSpec = {
  symbol: string;
  bg: string;
  fg: string;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  burstX: number;
  burstY: number;
  tilt: number;
  delay: number;
  floatDuration: number;
};

const SUNBURST_ANGLES = [0, 30, 60, 90, 120, 150] as const;

const floatingStickers: readonly StickerSpec[] = [
  { symbol: '+', bg: colors.lime, fg: colors.ink, top: -6, left: -18, burstX: 36, burstY: 28, tilt: -14, delay: 175, floatDuration: 1400 },
  { symbol: '×', bg: colors.peach, fg: colors.ink, top: 10, right: -22, burstX: -36, burstY: 22, tilt: 13, delay: 220, floatDuration: 1580 },
  { symbol: '√', bg: colors.cyanSoft, fg: colors.ink, bottom: 18, left: -24, burstX: 38, burstY: -22, tilt: 10, delay: 265, floatDuration: 1680 },
  { symbol: 'π', bg: colors.gold, fg: colors.ink, bottom: -4, right: -16, burstX: -34, burstY: -28, tilt: -11, delay: 310, floatDuration: 1480 },
];

function FloatingSticker({
  spec,
  entered,
  reducedMotion,
}: {
  spec: StickerSpec;
  entered: boolean;
  reducedMotion: boolean;
}) {
  const pop = useSharedValue(reducedMotion ? 1 : 0);
  const drift = useSharedValue(0);

  useEffect(() => {
    if (!entered) return;
    if (reducedMotion) {
      pop.set(1);
      drift.set(0);
      return;
    }
    pop.set(withDelay(spec.delay, withSpring(1, springs.pop)));
    drift.set(withDelay(
      spec.delay + 240,
      withRepeat(
        withSequence(
          withTiming(-5.5, { duration: spec.floatDuration, easing: Easing.inOut(Easing.sin) }),
          withTiming(3.5, { duration: spec.floatDuration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    ));
    return () => {
      cancelAnimation(pop);
      cancelAnimation(drift);
    };
  }, [drift, entered, pop, reducedMotion, spec.delay, spec.floatDuration]);

  const animated = useAnimatedStyle(() => {
    const p = pop.get();
    return {
      opacity: p <= 0.01 ? 0 : Math.min(1, p * 1.45),
      transform: [
        { translateX: (1 - p) * spec.burstX },
        { translateY: (1 - p) * spec.burstY + drift.get() },
        { scale: 0.35 + p * 0.65 },
        { rotate: `${spec.tilt + (1 - p) * 24}deg` },
      ],
    };
  }, [spec.burstX, spec.burstY, spec.tilt]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.stickerWrap,
        { top: spec.top, bottom: spec.bottom, left: spec.left, right: spec.right },
        animated,
      ]}
    >
      <View style={styles.stickerShadow} />
      <View style={[styles.stickerFace, { backgroundColor: spec.bg }]}>
        <View pointerEvents="none" style={styles.stickerShine} />
        <Text maxFontSizeMultiplier={1.2} style={[styles.stickerText, { color: spec.fg }]}>
          {spec.symbol}
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * Branded comic studio launch splash sharing the exact warm cream canvas of
 * Android native splash and Home. Stages its entrance sequentially (owl burst,
 * radial math stickers, wordmark with marker underline, and comic notebook
 * milestone dock), then hands off cleanly to Home once startup is ready.
 */
export function LaunchSplash({
  ready,
  visualsReady,
  startupReady = false,
  reducedMotion,
  onRevealStart,
  onFinish,
}: Props) {
  const { width, height } = useWindowDimensions();
  const [sceneReady, setSceneReady] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  const [introStarted, setIntroStarted] = useState(reducedMotion);
  const [introComplete, setIntroComplete] = useState(reducedMotion);
  const [displayPercent, setDisplayPercent] = useState(reducedMotion ? 100 : 18);
  const [barWidth, setBarWidth] = useState(0);

  const heroEnter = useSharedValue(reducedMotion ? 1 : 0);
  const heroFloat = useSharedValue(0);
  const heroTilt = useSharedValue(0);
  const readyHop = useSharedValue(0);
  const shockwave = useSharedValue(0);
  const raysEnter = useSharedValue(reducedMotion ? 1 : 0);
  const raysSpin = useSharedValue(0);
  const orbitSpin = useSharedValue(0);
  const crestSheen = useSharedValue(0);
  const chipEnter = useSharedValue(reducedMotion ? 1 : 0);
  const copyEnter = useSharedValue(reducedMotion ? 1 : 0);
  const underlineReveal = useSharedValue(reducedMotion ? 1 : 0);
  const progressEnter = useSharedValue(reducedMotion ? 1 : 0);
  const progressFill = useSharedValue(reducedMotion ? 1 : 0.18);
  const shimmer = useSharedValue(0);
  const exitProgress = useSharedValue(0);
  const backdropOpacity = useSharedValue(1);

  const revealStartRef = useRef(onRevealStart);
  const finishRef = useRef(onFinish);
  const revealed = useRef(false);
  const finished = useRef(false);
  const handleSceneLayout = useCallback(() => setSceneReady(true), []);
  const visualScale = Math.max(0.84, Math.min(1.06, width / 390, height / 760));

  revealStartRef.current = onRevealStart;
  finishRef.current = onFinish;

  const notifyRevealOnce = useCallback(() => {
    if (revealed.current) return;
    revealed.current = true;
    revealStartRef.current?.();
  }, []);

  const finishOnce = useCallback(() => {
    notifyRevealOnce();
    if (finished.current) return;
    finished.current = true;
    finishRef.current();
  }, [notifyRevealOnce]);

  // Real milestone progress target (never claims 100% until app + navigation are ready).
  const targetProgress = ready
    ? 1
    : startupReady
      ? 0.86
      : visualsReady
        ? 0.56
        : 0.24;

  const stageLabel = ready
    ? 'Gata! Începem!'
    : startupReady
      ? 'Așez tabla de lucru…'
      : visualsReady
        ? 'Verific contul și caietul…'
        : 'Pregătesc culorile și formulele…';

  // Hide native splash once the branded scene and owl artwork are painted, then run sequential entrance.
  useEffect(() => {
    if (!sceneReady || !imageReady || !visualsReady) return undefined;
    let active = true;
    let introTimer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      void SplashScreen.hideAsync().catch(() => undefined).then(() => {
        if (active) setNativeSplashHidden(true);
      });
      if (!active) return;
      setIntroStarted(true);
      if (reducedMotion) {
        heroEnter.set(1);
        raysEnter.set(1);
        chipEnter.set(1);
        copyEnter.set(1);
        underlineReveal.set(1);
        progressEnter.set(1);
        setIntroComplete(true);
        return;
      }

      // Beat 1: Hero owl medallion springs onto stage with comic shockwave and warm sunburst.
      raysEnter.set(withTiming(1, { duration: 340, easing: Easing.out(Easing.cubic) }));
      heroEnter.set(withSpring(1, springs.pop));
      shockwave.set(0);
      shockwave.set(withDelay(70, withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) })));

      // Beat 2: Brand chip & wordmark follow smoothly after the owl settles.
      chipEnter.set(withDelay(240, withSpring(1, springs.bouncy)));
      copyEnter.set(withDelay(315, withSpring(1, springs.snappy)));
      underlineReveal.set(withDelay(455, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) })));

      // Beat 3: Notebook progress dock arrives last so every element has its own turn.
      progressEnter.set(withDelay(390, withSpring(1, springs.snappy)));

      // Ambient studio loops start softly after the entrance beats settle.
      raysSpin.set(withRepeat(
        withTiming(360, { duration: 32_000, easing: Easing.linear }),
        -1,
        false,
      ));
      orbitSpin.set(withRepeat(
        withTiming(-360, { duration: 22_000, easing: Easing.linear }),
        -1,
        false,
      ));
      heroFloat.set(withDelay(
        460,
        withRepeat(
          withSequence(
            withTiming(-5.5, { duration: 1350, easing: Easing.inOut(Easing.sin) }),
            withTiming(3, { duration: 1350, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      ));
      heroTilt.set(withDelay(
        520,
        withRepeat(
          withSequence(
            withTiming(-2.2, { duration: 1850, easing: Easing.inOut(Easing.sin) }),
            withTiming(2.4, { duration: 1850, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      ));
      crestSheen.set(withDelay(
        540,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 760, easing: Easing.inOut(Easing.quad) }),
            withDelay(2200, withTiming(0, { duration: 0 })),
          ),
          -1,
          false,
        ),
      ));
      shimmer.set(withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        -1,
        false,
      ));

      introTimer = setTimeout(() => {
        if (active) setIntroComplete(true);
      }, 680);
    });
    const introFallback = setTimeout(() => {
      if (active) setIntroComplete(true);
    }, 1_050);

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      if (introTimer) clearTimeout(introTimer);
      clearTimeout(introFallback);
      cancelAnimation(raysSpin);
      cancelAnimation(orbitSpin);
      cancelAnimation(heroFloat);
      cancelAnimation(heroTilt);
      cancelAnimation(crestSheen);
      cancelAnimation(shimmer);
    };
  }, [
    chipEnter,
    copyEnter,
    crestSheen,
    heroEnter,
    heroFloat,
    heroTilt,
    imageReady,
    orbitSpin,
    progressEnter,
    raysEnter,
    raysSpin,
    reducedMotion,
    sceneReady,
    shimmer,
    shockwave,
    underlineReveal,
    visualsReady,
  ]);

  // Smoothly track real startup milestones in the comic progress bar.
  useEffect(() => {
    const pct = Math.round(targetProgress * 100);
    setDisplayPercent((current) => Math.max(current, pct));
    if (reducedMotion) {
      progressFill.set(targetProgress);
      return;
    }
    progressFill.set(withTiming(targetProgress, {
      duration: ready ? 220 : 380,
      easing: Easing.out(Easing.cubic),
    }));
  }, [progressFill, ready, reducedMotion, targetProgress]);

  // Gentle honest creep while waiting on network so the bar never feels stuck.
  useEffect(() => {
    if (ready || !introStarted || reducedMotion) return undefined;
    const cap = startupReady ? 94 : 80;
    const interval = setInterval(() => {
      setDisplayPercent((current) => {
        if (current >= cap) return current;
        const next = Math.min(cap, current + 3);
        progressFill.set(withTiming(next / 100, { duration: 260, easing: Easing.out(Easing.quad) }));
        return next;
      });
    }, 320);
    return () => clearInterval(interval);
  }, [introStarted, progressFill, ready, reducedMotion, startupReady]);

  // Sequential baton-pass exit into Home once intro, startup, and navigation are all ready.
  useEffect(() => {
    if (!ready || !introComplete || !nativeSplashHidden) return undefined;
    setDisplayPercent(100);
    if (reducedMotion) {
      finishOnce();
      return undefined;
    }
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;

    // Brief celebration hop on the owl right as the bar hits 100%.
    readyHop.set(withSequence(
      withTiming(-9, { duration: 100, easing: Easing.out(Easing.quad) }),
      withSpring(0, springs.snappy),
    ));

    const beatTimer = setTimeout(() => {
      cancelAnimation(heroFloat);
      cancelAnimation(heroTilt);
      cancelAnimation(raysSpin);
      cancelAnimation(orbitSpin);
      cancelAnimation(crestSheen);
      cancelAnimation(shimmer);

      // Splash foreground glides cleanly out FIRST, then canvas fades and hands baton to Home.
      exitProgress.set(withTiming(1, { duration: 240, easing: Easing.in(Easing.cubic) }));
      backdropOpacity.set(withDelay(110, withTiming(0, { duration: 210, easing: Easing.out(Easing.quad) })));
      revealTimer = setTimeout(notifyRevealOnce, 145);
      exitTimer = setTimeout(finishOnce, 330);
    }, 200);

    return () => {
      clearTimeout(beatTimer);
      if (revealTimer) clearTimeout(revealTimer);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, [
    backdropOpacity,
    crestSheen,
    exitProgress,
    finishOnce,
    heroFloat,
    heroTilt,
    introComplete,
    nativeSplashHidden,
    notifyRevealOnce,
    orbitSpin,
    raysSpin,
    ready,
    readyHop,
    reducedMotion,
    shimmer,
  ]);

  // Bounded hard deadline guarantees the splash can never stall launch.
  useEffect(() => {
    if (!sceneReady || !imageReady || !visualsReady || !nativeSplashHidden || !ready) return undefined;
    const hardDeadline = setTimeout(finishOnce, 2_500);
    return () => clearTimeout(hardDeadline);
  }, [finishOnce, imageReady, nativeSplashHidden, ready, sceneReady, visualsReady]);

  const rootAnimated = useAnimatedStyle(() => ({
    opacity: backdropOpacity.get(),
  }));

  const raysAnimated = useAnimatedStyle(() => {
    const enter = raysEnter.get();
    const exit = exitProgress.get();
    return {
      opacity: enter * 0.9 * (1 - exit),
      transform: [
        { scale: visualScale * (0.76 + enter * 0.24) * (1 + exit * 0.14) },
        { rotate: `${raysSpin.get()}deg` },
      ],
    };
  }, [visualScale]);

  const orbitAnimated = useAnimatedStyle(() => {
    const enter = raysEnter.get();
    const exit = exitProgress.get();
    return {
      opacity: enter * (1 - exit),
      transform: [
        { scale: visualScale * (0.82 + enter * 0.18) },
        { rotate: `${orbitSpin.get()}deg` },
      ],
    };
  }, [visualScale]);

  const shockwaveAnimated = useAnimatedStyle(() => {
    const p = shockwave.get();
    const opacity = p <= 0.01 || p >= 0.99 ? 0 : (1 - p) * 0.55;
    return {
      opacity,
      transform: [{ scale: visualScale * (0.72 + p * 0.68) }],
    };
  }, [visualScale]);

  const heroAnimated = useAnimatedStyle(() => {
    const enter = heroEnter.get();
    const exit = exitProgress.get();
    const opacity = enter <= 0.01 ? 0 : Math.min(1, enter * 1.45) * (1 - exit);
    return {
      opacity,
      transform: [
        { translateY: (1 - enter) * 28 + heroFloat.get() + readyHop.get() - exit * 42 },
        { scale: visualScale * (0.64 + enter * 0.36) * (1 - exit * 0.1) },
        { rotate: `${(1 - enter) * -10 + heroTilt.get() - exit * 4}deg` },
      ],
    };
  }, [visualScale]);

  const crestSheenAnimated = useAnimatedStyle(() => {
    const p = crestSheen.get();
    return {
      opacity: p > 0.02 && p < 0.98 ? 0.42 : 0,
      transform: [
        { translateX: -120 + p * 310 },
        { skewX: '-22deg' },
      ],
    };
  });

  const chipAnimated = useAnimatedStyle(() => {
    const enter = chipEnter.get();
    const exit = exitProgress.get();
    return {
      opacity: (enter <= 0.01 ? 0 : Math.min(1, enter * 1.4)) * (1 - exit),
      transform: [
        { translateY: (1 - enter) * 18 - exit * 26 },
        { scale: (0.82 + enter * 0.18) * (1 - exit * 0.06) },
      ],
    };
  });

  const copyAnimated = useAnimatedStyle(() => {
    const enter = copyEnter.get();
    const exit = exitProgress.get();
    return {
      opacity: (enter <= 0.01 ? 0 : Math.min(1, enter * 1.4)) * (1 - exit),
      transform: [
        { translateY: (1 - enter) * 20 - exit * 20 },
        { scale: (0.92 + enter * 0.08) * (1 - exit * 0.05) },
      ],
    };
  });

  const underlineAnimated = useAnimatedStyle(() => ({
    opacity: underlineReveal.get(),
    transform: [{ scaleX: Math.max(0.02, underlineReveal.get()) }],
  }));

  const progressCardAnimated = useAnimatedStyle(() => {
    const enter = progressEnter.get();
    const exit = exitProgress.get();
    return {
      opacity: (enter <= 0.01 ? 0 : Math.min(1, enter * 1.4)) * (1 - exit),
      transform: [
        { translateY: (1 - enter) * 28 + exit * 32 },
        { scale: (0.93 + enter * 0.07) * (1 - exit * 0.04) },
      ],
    };
  });

  const fillWidthStyle = useAnimatedStyle(() => {
    const innerWidth = Math.max(0, barWidth - borders.regular * 2);
    return {
      width: Math.max(18, innerWidth * progressFill.get()),
    };
  }, [barWidth]);

  const shimmerStyle = useAnimatedStyle(() => {
    const innerWidth = Math.max(0, barWidth - borders.regular * 2);
    return {
      transform: [
        { translateX: -52 + shimmer.get() * (innerWidth + 104) },
        { skewX: '-20deg' },
      ],
    };
  }, [barWidth]);

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
      pointerEvents="auto"
      style={[styles.root, rootAnimated]}
    >
      <StatusBar style="dark" />

      {/* Mount custom-font text and backdrop symbols only after Font.loadAsync
          has resolved so Android never caches a temporary fallback typeface. */}
      {visualsReady ? (
        <>
          <ComicBackdrop />
          <View style={styles.stage}>
            <View style={styles.centerCluster}>
              <View style={styles.emblemStage}>
                {/* Subtle rotating comic sunburst rays behind the emblem */}
                <Animated.View pointerEvents="none" style={[styles.sunburstWrap, raysAnimated]}>
                  {SUNBURST_ANGLES.map((angle) => (
                    <View
                      key={angle}
                      style={[styles.sunburstRay, { transform: [{ rotate: `${angle}deg` }] }]}
                    />
                  ))}
                  <View style={styles.sunburstCore} />
                </Animated.View>

                {/* Counter-rotating dashed orbital ring with twin glowing sparks */}
                <Animated.View pointerEvents="none" style={[styles.orbitRing, orbitAnimated]}>
                  <View style={[styles.orbitNode, styles.orbitNodeLime]} />
                  <View style={[styles.orbitNode, styles.orbitNodeCyan]} />
                </Animated.View>

                {/* Radial shockwave pulse on hero landing */}
                <Animated.View pointerEvents="none" style={[styles.shockwave, shockwaveAnimated]} />

                <Animated.View style={[styles.heroWrap, heroAnimated]}>
                  {floatingStickers.map((spec) => (
                    <FloatingSticker
                      key={spec.symbol}
                      spec={spec}
                      entered={introStarted}
                      reducedMotion={reducedMotion}
                    />
                  ))}
                  <View style={styles.medallionShadow} />
                  <View style={styles.medallionOuter}>
                    <View pointerEvents="none" style={styles.medallionShine} />
                    <Animated.View pointerEvents="none" style={[styles.crestSheen, crestSheenAnimated]} />
                    <View style={styles.medallionInner}>
                      <View pointerEvents="none" style={styles.innerCornerDotTL} />
                      <View pointerEvents="none" style={styles.innerCornerDotBR} />
                      <Image
                        accessible={false}
                        source={bundledImageSource(require('../../../assets/brand/splash_mark_v2.png'))}
                        resizeMode="contain"
                        fadeDuration={0}
                        onLoad={() => setImageReady(true)}
                        style={styles.heroImage}
                      />
                    </View>
                  </View>
                </Animated.View>
              </View>

              <Animated.View style={[styles.chipRow, chipAnimated]}>
                <Chip label="EXPLICAȚII PAS CU PAS" tone="lime" tilt={-2.5} />
              </Animated.View>

              <Animated.View style={[styles.copy, copyAnimated]}>
                <View style={styles.wordmarkWrap}>
                  <Animated.View pointerEvents="none" style={[styles.markerHighlight, underlineAnimated]} />
                  <Text
                    maxFontSizeMultiplier={1.3}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                    style={styles.brand}
                  >
                    Profu’ <Text style={styles.brandAccent}>de mate</Text>
                  </Text>
                </View>
                <Text maxFontSizeMultiplier={1.3} style={styles.promise}>
                  Matematica, pas cu pas.
                </Text>
              </Animated.View>
            </View>

            <Animated.View style={[styles.progressCardOuter, progressCardAnimated]}>
              <View pointerEvents="none" style={styles.progressCardShadow} />
              <View style={styles.progressCard}>
                <View pointerEvents="none" style={styles.cardShine} />
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
                  <View style={[styles.percentPill, ready && styles.percentPillReady]}>
                    <Text maxFontSizeMultiplier={1.2} style={styles.percentText}>
                      {displayPercent}%
                    </Text>
                  </View>
                </View>

                <View style={styles.barShadow}>
                  <View
                    onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
                    style={styles.barTrack}
                  >
                    <Animated.View style={[styles.barFill, ready && styles.barFillReady, fillWidthStyle]}>
                      <View pointerEvents="none" style={styles.barFillShine} />
                      {!ready ? <Animated.View pointerEvents="none" style={[styles.barShimmer, shimmerStyle]} /> : null}
                    </Animated.View>
                  </View>
                </View>

                <View style={styles.milestonesRow}>
                  {milestones.map((item) => (
                    <View key={item.key} style={styles.milestoneItem}>
                      <View style={[styles.milestoneDot, item.done && styles.milestoneDotDone]}>
                        {item.done ? (
                          <Text maxFontSizeMultiplier={1.05} style={styles.milestoneCheck}>✓</Text>
                        ) : null}
                      </View>
                      <Text
                        maxFontSizeMultiplier={1.15}
                        style={[styles.milestoneLabel, item.done && styles.milestoneLabelDone]}
                      >
                        {item.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
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
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: '16%',
    paddingBottom: '10%',
  },
  centerCluster: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },

  // Hero owl medallion stage with sunburst and orbital ring
  emblemStage: {
    width: 268,
    height: 244,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sunburstWrap: {
    position: 'absolute',
    width: 268,
    height: 268,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunburstRay: {
    position: 'absolute',
    width: 28,
    height: 260,
    borderRadius: 14,
    backgroundColor: 'rgba(124, 60, 255, 0.085)',
  },
  sunburstCore: {
    width: 196,
    height: 196,
    borderRadius: 98,
    backgroundColor: 'rgba(236, 226, 255, 0.55)',
  },
  orbitRing: {
    position: 'absolute',
    width: 234,
    height: 234,
    borderRadius: 117,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(124, 60, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitNode: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.75,
    borderColor: colors.ink,
  },
  orbitNodeLime: {
    top: -6,
    backgroundColor: colors.lime,
  },
  orbitNodeCyan: {
    bottom: -6,
    backgroundColor: colors.cyan,
  },
  shockwave: {
    position: 'absolute',
    width: 194,
    height: 194,
    borderRadius: 64,
    borderWidth: 3.5,
    borderColor: colors.violetBright,
  },
  heroWrap: {
    width: 204,
    height: 204,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  medallionShadow: {
    position: 'absolute',
    top: 11,
    width: 186,
    height: 186,
    borderRadius: 56,
    backgroundColor: colors.violetShadow,
    transform: [{ rotate: '-3deg' }],
  },
  medallionOuter: {
    width: 186,
    height: 186,
    borderRadius: 56,
    borderWidth: 3.5,
    borderColor: colors.ink,
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
    overflow: 'hidden',
  },
  medallionShine: {
    position: 'absolute',
    top: 6,
    left: 24,
    right: 24,
    height: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  crestSheen: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  medallionInner: {
    width: 158,
    height: 158,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: colors.ink,
    backgroundColor: '#F3FFCC',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '3deg' }],
    position: 'relative',
  },
  innerCornerDotTL: {
    position: 'absolute',
    top: 11,
    left: 12,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(124, 60, 255, 0.2)',
  },
  innerCornerDotBR: {
    position: 'absolute',
    bottom: 11,
    right: 12,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(124, 60, 255, 0.2)',
  },
  heroImage: { width: 152, height: 152 },

  // Floating math stickers
  stickerWrap: {
    position: 'absolute',
    zIndex: 6,
    paddingBottom: 3.5,
  },
  stickerShadow: {
    position: 'absolute',
    top: 3.5,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 13,
    backgroundColor: colors.ink,
  },
  stickerFace: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stickerShine: {
    position: 'absolute',
    top: 2,
    left: 6,
    right: 6,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.shine,
  },
  stickerText: {
    fontFamily: fonts.display,
    fontSize: 21,
    lineHeight: 24,
    includeFontPadding: false,
  },

  chipRow: { marginTop: 14 },
  copy: { marginTop: 12, alignItems: 'center', width: '100%' },
  wordmarkWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  markerHighlight: {
    position: 'absolute',
    right: 2,
    bottom: 3,
    width: '54%',
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.lime,
    transformOrigin: 'left',
  },
  brand: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.5,
    textAlign: 'center',
    includeFontPadding: false,
  },
  brandAccent: { color: colors.violet },
  promise: {
    marginTop: 5,
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 15.5,
    lineHeight: 21,
    textAlign: 'center',
    includeFontPadding: false,
  },

  // Comic notebook progress card
  progressCardOuter: {
    width: '100%',
    maxWidth: 332,
    position: 'relative',
    paddingBottom: shadows.md,
  },
  progressCardShadow: {
    position: 'absolute',
    top: shadows.md,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 22,
    backgroundColor: colors.ink,
  },
  progressCard: {
    borderRadius: 21,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 11,
    gap: 9,
    overflow: 'hidden',
  },
  cardShine: {
    position: 'absolute',
    top: 3,
    left: 16,
    right: 16,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.shine,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  stageLabelRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  stageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.peach,
  },
  stageDotMid: {
    backgroundColor: colors.cyan,
  },
  stageDotReady: {
    backgroundColor: colors.lime,
  },
  stageLabel: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
  },
  percentPill: {
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentPillReady: {
    backgroundColor: colors.lime,
  },
  percentText: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 12.5,
    lineHeight: 15,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  barShadow: {
    borderRadius: radii.md,
    backgroundColor: colors.ink,
    paddingBottom: shadows.sm,
  },
  barTrack: {
    height: 20,
    borderRadius: radii.md - 2,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.canvasWarm,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  barFill: {
    height: '100%',
    borderRadius: 10,
    borderRightWidth: borders.thin,
    borderRightColor: colors.ink,
    backgroundColor: colors.violet,
    overflow: 'hidden',
    position: 'relative',
  },
  barFillReady: {
    borderRightWidth: 0,
    backgroundColor: colors.lime,
  },
  barFillShine: {
    position: 'absolute',
    top: 2,
    left: 6,
    right: 6,
    height: 4.5,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.44)',
  },
  barShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 42,
    backgroundColor: 'rgba(216, 255, 62, 0.45)',
  },
  milestonesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 1,
    paddingHorizontal: 2,
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  milestoneDot: {
    width: 15,
    height: 15,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneDotDone: {
    borderColor: colors.ink,
    backgroundColor: colors.lime,
  },
  milestoneCheck: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    lineHeight: 11,
    color: colors.ink,
    includeFontPadding: false,
  },
  milestoneLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.inkMuted,
  },
  milestoneLabelDone: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
  },
});
