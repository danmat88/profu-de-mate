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
  tilt: number;
  delay: number;
};

const floatingStickers: readonly StickerSpec[] = [
  { symbol: '+', bg: colors.lime, fg: colors.ink, top: -12, left: -26, tilt: -14, delay: 90 },
  { symbol: '×', bg: colors.peach, fg: colors.ink, top: 8, right: -28, tilt: 13, delay: 145 },
  { symbol: '√', bg: colors.cyanSoft, fg: colors.ink, bottom: 16, left: -30, tilt: 10, delay: 200 },
  { symbol: 'π', bg: colors.gold, fg: colors.ink, bottom: -6, right: -22, tilt: -11, delay: 255 },
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
      spec.delay + 180,
      withRepeat(
        withSequence(
          withTiming(-5, { duration: 1350, easing: Easing.inOut(Easing.sin) }),
          withTiming(3, { duration: 1350, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    ));
    return () => cancelAnimation(drift);
  }, [drift, entered, pop, reducedMotion, spec.delay]);

  const animated = useAnimatedStyle(() => {
    const p = pop.get();
    return {
      opacity: p <= 0.01 ? 0 : Math.min(1, p * 1.4),
      transform: [
        { translateY: (1 - p) * 18 + drift.get() },
        { scale: 0.4 + p * 0.6 },
        { rotate: `${spec.tilt + (1 - p) * 18}deg` },
      ],
    };
  }, [spec.tilt]);

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
        <Text maxFontSizeMultiplier={1.2} style={[styles.stickerText, { color: spec.fg }]}>
          {spec.symbol}
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * Branded comic launch splash sharing Home's warm cream canvas and backdrop so
 * startup elements stagger in, display honest loading progress, and hand off
 * seamlessly into Home's comic cascade.
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
  const chipEnter = useSharedValue(reducedMotion ? 1 : 0);
  const copyEnter = useSharedValue(reducedMotion ? 1 : 0);
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
  const visualScale = Math.max(0.84, Math.min(1.08, width / 390, height / 760));

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

  // Hide native splash once the branded scene & owl artwork are painted, then run staggered comic entrance.
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
        chipEnter.set(1);
        copyEnter.set(1);
        progressEnter.set(1);
        setIntroComplete(true);
        return;
      }

      heroEnter.set(withSpring(1, springs.pop));
      chipEnter.set(withDelay(95, withSpring(1, springs.bouncy)));
      copyEnter.set(withDelay(160, withSpring(1, springs.bouncy)));
      progressEnter.set(withDelay(230, withSpring(1, springs.snappy)));

      heroFloat.set(withDelay(
        340,
        withRepeat(
          withSequence(
            withTiming(-5, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
            withTiming(3, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      ));

      shimmer.set(withRepeat(
        withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.quad) }),
        -1,
        false,
      ));

      introTimer = setTimeout(() => {
        if (active) setIntroComplete(true);
      }, 540);
    });
    const introFallback = setTimeout(() => {
      if (active) setIntroComplete(true);
    }, 900);

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      if (introTimer) clearTimeout(introTimer);
      clearTimeout(introFallback);
      cancelAnimation(heroFloat);
      cancelAnimation(shimmer);
    };
  }, [
    chipEnter,
    copyEnter,
    heroEnter,
    heroFloat,
    imageReady,
    progressEnter,
    reducedMotion,
    sceneReady,
    shimmer,
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
      duration: ready ? 200 : 380,
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

  // Coordinated baton-pass exit into Home once intro + startup + navigation are all ready.
  useEffect(() => {
    if (!ready || !introComplete || !nativeSplashHidden) return undefined;
    setDisplayPercent(100);
    if (reducedMotion) {
      finishOnce();
      return undefined;
    }
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    const beatTimer = setTimeout(() => {
      notifyRevealOnce();
      cancelAnimation(heroFloat);
      cancelAnimation(shimmer);
      exitProgress.set(withTiming(1, { duration: 240, easing: Easing.in(Easing.cubic) }));
      backdropOpacity.set(withDelay(70, withTiming(0, { duration: 210, easing: Easing.out(Easing.quad) })));
      exitTimer = setTimeout(finishOnce, 290);
    }, 150);

    return () => {
      clearTimeout(beatTimer);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, [backdropOpacity, exitProgress, finishOnce, heroFloat, introComplete, nativeSplashHidden, notifyRevealOnce, ready, reducedMotion, shimmer]);

  // Bounded hard deadline guarantees the splash can never stall launch.
  useEffect(() => {
    if (!sceneReady || !imageReady || !visualsReady || !nativeSplashHidden || !ready) return undefined;
    const hardDeadline = setTimeout(finishOnce, 2_500);
    return () => clearTimeout(hardDeadline);
  }, [finishOnce, imageReady, nativeSplashHidden, ready, sceneReady, visualsReady]);

  const rootAnimated = useAnimatedStyle(() => ({
    opacity: backdropOpacity.get(),
  }));

  const heroAnimated = useAnimatedStyle(() => {
    const enter = heroEnter.get();
    const exit = exitProgress.get();
    const opacity = enter <= 0.01 ? 0 : Math.min(1, enter * 1.4) * (1 - exit);
    return {
      opacity,
      transform: [
        { translateY: (1 - enter) * 26 + heroFloat.get() - exit * 38 },
        { scale: visualScale * (0.72 + enter * 0.28) * (1 - exit * 0.1) },
        { rotate: `${(1 - enter) * -8 - exit * 4}deg` },
      ],
    };
  }, [visualScale]);

  const chipAnimated = useAnimatedStyle(() => {
    const enter = chipEnter.get();
    const exit = exitProgress.get();
    return {
      opacity: (enter <= 0.01 ? 0 : Math.min(1, enter * 1.4)) * (1 - exit),
      transform: [
        { translateY: (1 - enter) * 16 - exit * 26 },
        { scale: (0.8 + enter * 0.2) * (1 - exit * 0.06) },
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
        { scale: (0.9 + enter * 0.1) * (1 - exit * 0.05) },
      ],
    };
  });

  const progressCardAnimated = useAnimatedStyle(() => {
    const enter = progressEnter.get();
    const exit = exitProgress.get();
    return {
      opacity: (enter <= 0.01 ? 0 : Math.min(1, enter * 1.4)) * (1 - exit),
      transform: [
        { translateY: (1 - enter) * 24 + exit * 26 },
        { scale: (0.92 + enter * 0.08) * (1 - exit * 0.04) },
      ],
    };
  });

  const fillWidthStyle = useAnimatedStyle(() => {
    const innerWidth = Math.max(0, barWidth - borders.regular * 2);
    return {
      width: Math.max(16, innerWidth * progressFill.get()),
    };
  }, [barWidth]);

  const shimmerStyle = useAnimatedStyle(() => {
    const innerWidth = Math.max(0, barWidth - borders.regular * 2);
    return {
      transform: [
        { translateX: -48 + shimmer.get() * (innerWidth + 96) },
        { skewX: '-20deg' },
      ],
    };
  }, [barWidth]);

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
                <View style={styles.medallionInner}>
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

            <Animated.View style={[styles.chipRow, chipAnimated]}>
              <Chip label="EXPLICAȚII PAS CU PAS" tone="lime" tilt={-2} />
            </Animated.View>

            <Animated.View style={[styles.copy, copyAnimated]}>
              <Text
                maxFontSizeMultiplier={1.3}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                style={styles.brand}
              >
                Profu’ <Text style={styles.brandAccent}>de mate</Text>
              </Text>
              <Text maxFontSizeMultiplier={1.3} style={styles.promise}>
                Matematica, pas cu pas.
              </Text>
            </Animated.View>
          </View>

          <Animated.View style={[styles.progressDock, progressCardAnimated]}>
            <View style={styles.progressHeader}>
              <View style={styles.stageLabelRow}>
                <View style={[styles.stageDot, ready && styles.stageDotReady]} />
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
    paddingHorizontal: 26,
    paddingTop: '22%',
    paddingBottom: '12%',
  },
  centerCluster: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },

  // Hero owl medallion
  heroWrap: {
    width: 196,
    height: 196,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  medallionShadow: {
    position: 'absolute',
    top: 9,
    width: 184,
    height: 184,
    borderRadius: 56,
    backgroundColor: colors.violetShadow,
    transform: [{ rotate: '-3deg' }],
  },
  medallionOuter: {
    width: 184,
    height: 184,
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
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  medallionInner: {
    width: 156,
    height: 156,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '3deg' }],
  },
  heroImage: { width: 150, height: 150 },

  // Floating math stickers
  stickerWrap: {
    position: 'absolute',
    zIndex: 6,
    paddingBottom: 3,
  },
  stickerShadow: {
    position: 'absolute',
    top: 3,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 13,
    backgroundColor: colors.ink,
  },
  stickerFace: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerText: {
    fontFamily: fonts.display,
    fontSize: 21,
    lineHeight: 24,
    includeFontPadding: false,
  },

  chipRow: { marginTop: 24 },
  copy: { marginTop: 12, alignItems: 'center', width: '100%' },
  brand: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 38,
    lineHeight: 44,
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

  // Chunky comic progress dock
  progressDock: {
    width: '100%',
    maxWidth: 320,
    gap: 9,
  },
  progressHeader: {
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
    minWidth: 46,
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
    includeFontPadding: false,
  },
  barShadow: {
    borderRadius: radii.md,
    backgroundColor: colors.ink,
    paddingBottom: shadows.sm + 1,
  },
  barTrack: {
    height: 22,
    borderRadius: radii.md - 1,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
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
    height: 5,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
  },
  barShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 38,
    backgroundColor: 'rgba(216, 255, 62, 0.42)',
  },
});
