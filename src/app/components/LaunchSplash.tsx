import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';
import { bundledImageSource } from '../../shared/services/bundledImages';
import { borders, colors, fonts, radii, shadows, typography } from '../../shared/theme';
import { Chip } from '../../shared/ui/Chip';
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

type StickerSpec = {
  symbol: string;
  bg: string;
  fg: string;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  tilt: string;
};

type DoodleSpec = {
  label: string;
  top?: `${number}%`;
  bottom?: `${number}%`;
  left?: number;
  right?: number;
  rotate: string;
  color: string;
  size: number;
};

const STARBURST_RAYS = [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5] as const;

const MATH_STICKERS: readonly StickerSpec[] = [
  { symbol: '+', bg: colors.lime, fg: colors.ink, top: -8, left: -24, tilt: '-14deg' },
  { symbol: '×', bg: colors.peach, fg: colors.ink, top: 28, right: -28, tilt: '12deg' },
  { symbol: '√', bg: colors.cyan, fg: colors.ink, bottom: 20, left: -26, tilt: '11deg' },
  { symbol: 'π', bg: colors.gold, fg: colors.ink, bottom: -10, right: -20, tilt: '-11deg' },
];

const STUDIO_DOODLES: readonly DoodleSpec[] = [
  { label: 'a²+b²', top: '12%', left: 16, rotate: '-12deg', color: 'rgba(124, 60, 255, 0.14)', size: 17 },
  { label: 'x = ?', top: '15%', right: 18, rotate: '11deg', color: 'rgba(255, 141, 107, 0.22)', size: 18 },
  { label: 'Δ', top: '46%', left: 14, rotate: '-16deg', color: 'rgba(67, 214, 230, 0.24)', size: 24 },
  { label: '∑', top: '44%', right: 14, rotate: '14deg', color: 'rgba(124, 60, 255, 0.14)', size: 25 },
  { label: '∞', bottom: '28%', left: 20, rotate: '-8deg', color: 'rgba(255, 212, 71, 0.3)', size: 24 },
  { label: '÷', bottom: '30%', right: 20, rotate: '15deg', color: 'rgba(255, 87, 109, 0.18)', size: 24 },
];

const STUDIO_PILLARS = [
  { label: 'Poză', dot: colors.violet },
  { label: 'Formulă', dot: colors.cyan },
  { label: 'Caiet', dot: colors.peach },
] as const;

const BAR_STRIPE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Isolated progress header leaf so gentle percentage easing updates only this
 * tiny counter and never re-renders the emblem, comic stickers, or background art.
 */
const SplashProgressHeader = memo(function SplashProgressHeader({
  ready,
  startupReady,
  visualsReady,
  introStarted,
  reducedMotion,
  stageLabel,
}: {
  ready: boolean;
  startupReady: boolean;
  visualsReady: boolean;
  introStarted: boolean;
  reducedMotion: boolean;
  stageLabel: string;
}) {
  const [displayPercent, setDisplayPercent] = useState(reducedMotion ? 100 : 12);

  useEffect(() => {
    if (ready || reducedMotion) {
      setDisplayPercent(100);
      return undefined;
    }
    if (!introStarted) return undefined;

    const targetCap = startupReady ? 95 : visualsReady ? 88 : 48;
    const interval = setInterval(() => {
      setDisplayPercent((current) => {
        if (current >= targetCap) return current;
        const step = Math.max(1, Math.ceil((targetCap - current) * 0.16));
        return Math.min(targetCap, current + step);
      });
    }, 75);

    return () => clearInterval(interval);
  }, [introStarted, ready, reducedMotion, startupReady, visualsReady]);

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
      <View collapsable={false} style={[styles.percentPill, ready && styles.percentPillReady]}>
        <Text maxFontSizeMultiplier={1.2} style={styles.percentText}>
          {ready ? 100 : displayPercent}%
        </Text>
      </View>
    </View>
  );
});

/**
 * Rich comic-studio launch splash sharing the exact warm cream canvas of
 * Android native splash and Home. Powered entirely by pure native-driver
 * Animated transforms (zero Reanimated worklets on cold boot) so the continuous
 * progress bar and liquid sheen run directly on Android RenderThread without
 * ever blocking or stuttering while startup and navigation mount underneath.
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
  const [barWidth, setBarWidth] = useState(0);

  // Pure native-driver Animated values (100% Android RenderThread, 0 Reanimated worklets).
  const heroEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const heroFloat = useRef(new Animated.Value(0)).current;
  const pulseRing = useRef(new Animated.Value(0)).current;
  const stickersEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const crestSheen = useRef(new Animated.Value(0)).current;
  const copyEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const underlineReveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const dockEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const progressFill = useRef(new Animated.Value(reducedMotion ? 1 : 0.12)).current;
  const barSheen = useRef(new Animated.Value(0)).current;
  const exitProgress = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(1)).current;

  const introSettledRef = useRef(onIntroSettled);
  const revealStartRef = useRef(onRevealStart);
  const finishRef = useRef(onFinish);
  const introNotified = useRef(false);
  const revealed = useRef(false);
  const finished = useRef(false);
  const handleSceneLayout = useCallback(() => setSceneReady(true), []);
  const visualScale = Math.max(0.82, Math.min(1.04, width / 390, height / 780));
  const compact = height < 720;
  const fallbackBarWidth = Math.max(180, Math.min(width - 96, 286));
  const trackInnerWidth = Math.max(1, (barWidth > 0 ? barWidth : fallbackBarWidth) - borders.regular * 2);

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

  // Hide native splash once the branded scene and owl artwork are painted, then play sequential beats.
  useEffect(() => {
    if (!sceneReady || !imageReady || !visualsReady) return undefined;
    let active = true;
    let introTimer: ReturnType<typeof setTimeout> | undefined;
    let floatLoop: Animated.CompositeAnimation | undefined;
    const animations: Animated.CompositeAnimation[] = [];

    const run = (anim: Animated.CompositeAnimation) => {
      animations.push(anim);
      anim.start();
    };

    const frame = requestAnimationFrame(() => {
      void SplashScreen.hideAsync().catch(() => undefined).then(() => {
        if (active) setNativeSplashHidden(true);
      });
      if (!active) return;
      setIntroStarted(true);
      if (reducedMotion) {
        heroEnter.setValue(1);
        stickersEnter.setValue(1);
        copyEnter.setValue(1);
        underlineReveal.setValue(1);
        dockEnter.setValue(1);
        notifyIntroSettledOnce();
        return;
      }

      // Beat 1 (0ms): Comic starburst + 3D Owl Crest pop cleanly onto stage with crisp shockwave.
      run(Animated.spring(heroEnter, {
        toValue: 1,
        tension: 210,
        friction: 16,
        useNativeDriver: true,
      }));
      pulseRing.setValue(0);
      run(Animated.sequence([
        Animated.delay(55),
        Animated.timing(pulseRing, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]));

      // Beat 2 (170ms): Math stickers, sparkles, and owl speech pop-bubble burst out together.
      run(Animated.sequence([
        Animated.delay(170),
        Animated.spring(stickersEnter, {
          toValue: 1,
          tension: 200,
          friction: 14,
          useNativeDriver: true,
        }),
      ]));

      // Beat 3 (260ms): Chip, bold wordmark, feature pills, and lime highlighter swipe glide up.
      run(Animated.sequence([
        Animated.delay(260),
        Animated.spring(copyEnter, {
          toValue: 1,
          tension: 260,
          friction: 20,
          useNativeDriver: true,
        }),
      ]));
      run(Animated.sequence([
        Animated.delay(375),
        Animated.timing(underlineReveal, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]));

      // Beat 4 (370ms): Signature mini-notebook progress dock rises into place cleanly.
      run(Animated.sequence([
        Animated.delay(370),
        Animated.spring(dockEnter, {
          toValue: 1,
          tension: 260,
          friction: 20,
          useNativeDriver: true,
        }),
      ]));

      // Subtle living motion runs purely on Android native RenderThread after entrance settles.
      run(Animated.sequence([
        Animated.delay(560),
        Animated.timing(crestSheen, {
          toValue: 1,
          duration: 680,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]));
      floatLoop = Animated.sequence([
        Animated.delay(580),
        Animated.loop(
          Animated.sequence([
            Animated.timing(heroFloat, {
              toValue: -5,
              duration: 1350,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(heroFloat, {
              toValue: 2.5,
              duration: 1350,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ),
      ]);
      floatLoop.start();

      // Signal AppRoot to mount Home ONLY after every splash entrance animation is settled.
      introTimer = setTimeout(() => {
        if (active) notifyIntroSettledOnce();
      }, 600);
    });
    const introFallback = setTimeout(() => {
      if (active) notifyIntroSettledOnce();
    }, 1_000);

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      if (introTimer) clearTimeout(introTimer);
      clearTimeout(introFallback);
      animations.forEach((anim) => anim.stop());
      floatLoop?.stop();
      heroFloat.stopAnimation();
      crestSheen.stopAnimation();
    };
  }, [
    copyEnter,
    crestSheen,
    dockEnter,
    heroEnter,
    heroFloat,
    imageReady,
    notifyIntroSettledOnce,
    pulseRing,
    reducedMotion,
    sceneReady,
    stickersEnter,
    underlineReveal,
    visualsReady,
  ]);

  // Continuous liquid-smooth native-driver progress glide that never halts or stalls mid-load.
  useEffect(() => {
    if (reducedMotion) {
      progressFill.setValue(ready ? 1 : startupReady ? 0.94 : visualsReady ? 0.65 : 0.25);
      return undefined;
    }
    if (!introStarted && !ready) return undefined;

    const target = ready ? 1 : startupReady ? 0.95 : visualsReady ? 0.88 : 0.48;
    const duration = ready ? 210 : startupReady ? 520 : visualsReady ? 1_750 : 700;
    const anim = Animated.timing(progressFill, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [introStarted, progressFill, ready, reducedMotion, startupReady, visualsReady]);

  // Living native-driver gloss sheen glides continuously across the progress bar while loading.
  useEffect(() => {
    if (reducedMotion || !introStarted || ready) {
      barSheen.stopAnimation();
      barSheen.setValue(0);
      return undefined;
    }
    barSheen.setValue(0);
    const sheenLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(barSheen, {
          toValue: 1,
          duration: 1_050,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(barSheen, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(240),
      ]),
    );
    sheenLoop.start();
    return () => {
      sheenLoop.stop();
      barSheen.stopAnimation();
    };
  }, [barSheen, introStarted, ready, reducedMotion]);

  // Sequential baton-pass exit into Home once intro, startup, and navigation are all ready.
  useEffect(() => {
    if (!ready || !introComplete || !nativeSplashHidden) return undefined;
    if (reducedMotion) {
      finishOnce();
      return undefined;
    }
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    const exitAnims: Animated.CompositeAnimation[] = [];

    const startExitAnim = (anim: Animated.CompositeAnimation) => {
      exitAnims.push(anim);
      anim.start();
    };

    // Celebratory victory hop + lime shockwave right as the dock reaches 100%.
    heroFloat.stopAnimation();
    startExitAnim(Animated.sequence([
      Animated.timing(heroFloat, {
        toValue: -11,
        duration: 95,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(heroFloat, {
        toValue: 0,
        tension: 260,
        friction: 18,
        useNativeDriver: true,
      }),
    ]));
    pulseRing.setValue(0);
    startExitAnim(Animated.timing(pulseRing, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }));

    const beatTimer = setTimeout(() => {
      // Splash foreground glides cleanly out FIRST, then canvas fades and hands baton to Home.
      startExitAnim(Animated.timing(exitProgress, {
        toValue: 1,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }));
      startExitAnim(Animated.sequence([
        Animated.delay(95),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 205,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]));
      revealTimer = setTimeout(notifyRevealOnce, 130);
      exitTimer = setTimeout(finishOnce, 310);
    }, 175);

    return () => {
      clearTimeout(beatTimer);
      if (revealTimer) clearTimeout(revealTimer);
      if (exitTimer) clearTimeout(exitTimer);
      exitAnims.forEach((anim) => anim.stop());
    };
  }, [
    backdropOpacity,
    exitProgress,
    finishOnce,
    heroFloat,
    introComplete,
    nativeSplashHidden,
    notifyRevealOnce,
    pulseRing,
    ready,
    reducedMotion,
  ]);

  // Bounded hard deadline guarantees the splash can never stall launch.
  useEffect(() => {
    if (!sceneReady || !imageReady || !visualsReady || !nativeSplashHidden || !ready) return undefined;
    const hardDeadline = setTimeout(finishOnce, 2_500);
    return () => clearTimeout(hardDeadline);
  }, [finishOnce, imageReady, nativeSplashHidden, ready, sceneReady, visualsReady]);

  const rootAnimated = {
    opacity: backdropOpacity,
  };

  const pulseRingAnimated = {
    opacity: pulseRing.interpolate({
      inputRange: [0, 0.04, 0.96, 1],
      outputRange: [0, 0.64, 0.04, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        scale: pulseRing.interpolate({
          inputRange: [0, 1],
          outputRange: [visualScale * 0.76, visualScale * 1.42],
        }),
      },
    ],
  };

  const heroEnterStyle = {
    opacity: heroEnter.interpolate({
      inputRange: [0, 0.68, 1],
      outputRange: [0, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: heroEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
      { translateY: heroFloat },
      {
        scale: heroEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [visualScale * 0.72, visualScale],
        }),
      },
      {
        rotate: heroEnter.interpolate({
          inputRange: [0, 1],
          outputRange: ['-8deg', '0deg'],
        }),
      },
    ],
  };

  const heroExitStyle = {
    opacity: exitProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: exitProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -44],
        }),
      },
      {
        scale: exitProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.9],
        }),
      },
      {
        rotate: exitProgress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '-4deg'],
        }),
      },
    ],
  };

  const stickersAnimated = {
    opacity: stickersEnter.interpolate({
      inputRange: [0, 0.68, 1],
      outputRange: [0, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        scale: stickersEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [0.66, 1],
        }),
      },
      {
        rotate: stickersEnter.interpolate({
          inputRange: [0, 1],
          outputRange: ['12deg', '0deg'],
        }),
      },
    ],
  };

  const crestSheenAnimated = {
    opacity: crestSheen.interpolate({
      inputRange: [0, 0.06, 0.94, 1],
      outputRange: [0, 0.45, 0.45, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: crestSheen.interpolate({
          inputRange: [0, 1],
          outputRange: [-120, 200],
        }),
      },
      { skewX: '-22deg' },
    ],
  };

  const copyEnterStyle = {
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
        }),
      },
      {
        scale: copyEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1],
        }),
      },
    ],
  };

  const copyExitStyle = {
    opacity: exitProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: exitProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -20],
        }),
      },
      {
        scale: exitProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.96],
        }),
      },
    ],
  };

  const underlineAnimated = {
    opacity: underlineReveal,
    transform: [
      {
        scaleX: underlineReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [0.02, 1],
          extrapolate: 'clamp',
        }),
      },
    ],
  };

  const dockEnterStyle = {
    opacity: dockEnter.interpolate({
      inputRange: [0, 0.68, 1],
      outputRange: [0, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: dockEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
      {
        scale: dockEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [0.94, 1],
        }),
      },
    ],
  };

  const dockExitStyle = {
    opacity: exitProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: exitProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 30],
        }),
      },
      {
        scale: exitProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.96],
        }),
      },
    ],
  };

  // Pure GPU native-driver translateX progress fill (zero layout recalculation and crisp rounded tip).
  const fillTransformStyle = {
    transform: [
      {
        translateX: progressFill.interpolate({
          inputRange: [0, 1],
          outputRange: [-trackInnerWidth, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  };

  const barSheenStyle = {
    opacity: barSheen.interpolate({
      inputRange: [0, 0.14, 0.86, 1],
      outputRange: [0, 0.54, 0.54, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: barSheen.interpolate({
          inputRange: [0, 1],
          outputRange: [-56, trackInnerWidth + 56],
        }),
      },
      { skewX: '-22deg' },
    ],
  };

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

          {/* Peripheral comic math doodles giving the whole canvas studio life */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={styles.notebookMarginLine} />
            {STUDIO_DOODLES.map((item) => (
              <Text
                key={item.label}
                accessible={false}
                style={[
                  styles.studioDoodle,
                  {
                    top: item.top,
                    bottom: item.bottom,
                    left: item.left,
                    right: item.right,
                    color: item.color,
                    fontSize: item.size,
                    lineHeight: item.size + 4,
                    transform: [{ rotate: item.rotate }],
                  },
                ]}
              >
                {item.label}
              </Text>
            ))}
          </View>

          <View style={[styles.stage, compact && styles.stageCompact]}>
            {/* Top comic studio banner framing the viewport */}
            <Animated.View style={[styles.topBannerWrap, copyExitStyle]}>
              <Animated.View style={copyEnterStyle}>
                <View collapsable={false} style={styles.topBanner}>
                  <View style={[styles.bannerDot, { backgroundColor: colors.violet }]} />
                  <Text maxFontSizeMultiplier={1.2} style={styles.topBannerText}>
                    STUDIOUL TĂU DE MATE
                  </Text>
                  <View style={[styles.bannerDot, { backgroundColor: colors.peach }]} />
                </View>
              </Animated.View>
            </Animated.View>

            <View style={styles.centerCluster}>
              <View style={[styles.emblemStage, compact && styles.emblemStageCompact]}>
                {/* Rich static comic pop-art starburst + crisp ring frame (0 frame cost!) */}
                <View pointerEvents="none" style={styles.starburstStage}>
                  {STARBURST_RAYS.map((angle, index) => (
                    <View
                      key={angle}
                      style={[
                        styles.starburstRay,
                        index % 2 === 1 && styles.starburstRayGold,
                        { transform: [{ rotate: `${angle}deg` }] },
                      ]}
                    />
                  ))}
                  <View style={styles.outerRing}>
                    <View style={[styles.orbitBead, styles.orbitBeadTop]} />
                    <View style={[styles.orbitBead, styles.orbitBeadBottom]} />
                    <View style={[styles.orbitBeadSmall, styles.orbitBeadLeft]} />
                    <View style={[styles.orbitBeadSmall, styles.orbitBeadRight]} />
                  </View>
                  <View style={styles.auraCore} />
                </View>

                {/* Crisp shockwave ring on crest landing and 100% victory */}
                <Animated.View pointerEvents="none" style={[styles.pulseRing, ready && styles.pulseRingReady, pulseRingAnimated]} />

                <Animated.View style={heroExitStyle}>
                  <Animated.View style={[styles.heroWrap, heroEnterStyle]}>
                    {/* Unified GPU layer: 4 3D math stickers + stars + owl speech pop-bubble */}
                    <Animated.View pointerEvents="none" style={[styles.stickersLayer, stickersAnimated]}>
                      {/* Playful comic speech bubble greeting right beside the owl */}
                      <View collapsable={false} style={[styles.speechBubble, ready && styles.speechBubbleReady]}>
                        <View pointerEvents="none" style={styles.speechShine} />
                        <Text maxFontSizeMultiplier={1.15} style={styles.speechText}>
                          {ready ? 'Gata!' : 'Salut!'}
                        </Text>
                        <View style={[styles.speechTail, ready && styles.speechTailReady]} />
                      </View>

                      {MATH_STICKERS.map((spec) => (
                        <View
                          key={spec.symbol}
                          collapsable={false}
                          style={[
                            styles.stickerWrap,
                            {
                              top: spec.top,
                              bottom: spec.bottom,
                              left: spec.left,
                              right: spec.right,
                              transform: [{ rotate: spec.tilt }],
                            },
                          ]}
                        >
                          <View style={styles.stickerShadow} />
                          <View style={[styles.stickerFace, { backgroundColor: spec.bg }]}>
                            <View pointerEvents="none" style={styles.stickerShine} />
                            <Text maxFontSizeMultiplier={1.2} style={[styles.stickerText, { color: spec.fg }]}>
                              {spec.symbol}
                            </Text>
                          </View>
                        </View>
                      ))}
                      <Text accessible={false} style={[styles.cornerStar, styles.cornerStarTopLeft]}>✦</Text>
                      <Text accessible={false} style={[styles.cornerStar, styles.cornerStarBottomLeft]}>★</Text>
                      <Text accessible={false} style={[styles.cornerStar, styles.cornerStarMidRight]}>✦</Text>
                    </Animated.View>

                    {/* 3D Royal Violet & Electric Lime Owl Medallion */}
                    <View style={styles.medallionShadow} />
                    <View style={styles.medallionOuter}>
                      <View pointerEvents="none" style={styles.medallionGlowTop} />
                      <View pointerEvents="none" style={styles.medallionShine} />
                      <Animated.View pointerEvents="none" style={[styles.crestSheen, crestSheenAnimated]} />
                      <View style={styles.medallionInner}>
                        <View pointerEvents="none" style={styles.innerCornerDotTL} />
                        <View pointerEvents="none" style={styles.innerCornerDotTR} />
                        <View pointerEvents="none" style={styles.innerCornerDotBL} />
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
                </Animated.View>
              </View>

              <Animated.View style={[styles.identityBlock, copyExitStyle]}>
                <Animated.View style={[styles.identityInner, copyEnterStyle]}>
                  <Chip label="EXPLICAȚII PAS CU PAS" tone="lime" tilt={-2.5} />
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

                  {!compact ? (
                    <View style={styles.pillarsRow}>
                      {STUDIO_PILLARS.map((pillar) => (
                        <View key={pillar.label} collapsable={false} style={styles.pillarPill}>
                          <View style={[styles.pillarDot, { backgroundColor: pillar.dot }]} />
                          <Text maxFontSizeMultiplier={1.15} style={styles.pillarText}>
                            {pillar.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Animated.View>
              </Animated.View>
            </View>

            {/* Signature 3D Comic Notebook Progress Dock with bookmark ribbon */}
            <Animated.View style={[styles.progressCardOuter, dockExitStyle]}>
              <Animated.View style={dockEnterStyle}>
                <View pointerEvents="none" style={styles.progressCardShadow} />
                <View style={styles.progressCard}>
                  <View style={[styles.progressSpine, startupReady && styles.progressSpineMid, ready && styles.progressSpineReady]}>
                    <View pointerEvents="none" style={styles.spineGloss} />
                    <View style={styles.spineHole} />
                    <View style={styles.spineHole} />
                    <View style={styles.spineHole} />
                  </View>

                  <View style={styles.progressBody}>
                    <View pointerEvents="none" style={styles.cardShine} />
                    <View pointerEvents="none" style={styles.dockBookmark}>
                      <View style={styles.dockBookmarkNotch} />
                    </View>

                    <SplashProgressHeader
                      ready={ready}
                      startupReady={startupReady}
                      visualsReady={visualsReady}
                      introStarted={introStarted}
                      reducedMotion={reducedMotion}
                      stageLabel={stageLabel}
                    />

                    <View style={styles.barShadow}>
                      <View
                        onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
                        style={styles.barTrack}
                      >
                        <Animated.View style={[styles.barFill, ready && styles.barFillReady, fillTransformStyle]}>
                          <View pointerEvents="none" style={styles.barStripes}>
                            {BAR_STRIPE_INDICES.map((index) => (
                              <View key={index} style={styles.barStripe} />
                            ))}
                          </View>
                          <Animated.View pointerEvents="none" style={[styles.barSheen, barSheenStyle]} />
                          <View pointerEvents="none" style={styles.barFillShine} />
                        </Animated.View>
                      </View>
                    </View>

                    <View style={styles.milestonesRow}>
                      {milestones.map((item) => (
                        <View key={item.key} collapsable={false} style={[styles.milestonePill, item.done && styles.milestonePillDone]}>
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
  notebookMarginLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 28,
    width: 1.5,
    backgroundColor: 'rgba(255, 141, 107, 0.14)',
  },
  studioDoodle: {
    position: 'absolute',
    fontFamily: fonts.display,
    includeFontPadding: false,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: '11%',
    paddingBottom: '9%',
  },
  stageCompact: {
    paddingTop: '8%',
    paddingBottom: '7%',
  },

  // Top studio pill framing the header space
  topBannerWrap: {
    alignItems: 'center',
  },
  topBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1.75,
    borderBottomWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    transform: [{ rotate: '-1deg' }],
  },
  bannerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.25,
    borderColor: colors.ink,
  },
  topBannerText: {
    ...typography.kicker,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.1,
    paddingHorizontal: 1,
    color: colors.violetDeep,
    includeFontPadding: false,
  },

  centerCluster: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },

  // Hero owl comic starburst stage
  emblemStage: {
    width: 284,
    height: 256,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  emblemStageCompact: {
    height: 224,
  },
  starburstStage: {
    position: 'absolute',
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starburstRay: {
    position: 'absolute',
    width: 22,
    height: 272,
    borderRadius: 11,
    backgroundColor: 'rgba(124, 60, 255, 0.08)',
  },
  starburstRayGold: {
    backgroundColor: 'rgba(255, 212, 71, 0.16)',
  },
  outerRing: {
    position: 'absolute',
    width: 236,
    height: 236,
    borderRadius: 118,
    borderWidth: 2,
    borderColor: 'rgba(124, 60, 255, 0.22)',
    backgroundColor: 'rgba(236, 226, 255, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitBead: {
    position: 'absolute',
    width: 12,
    height: 12,
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
  orbitBeadTop: { top: -6, backgroundColor: colors.lime },
  orbitBeadBottom: { bottom: -6, backgroundColor: colors.cyan },
  orbitBeadLeft: { left: -5, backgroundColor: colors.peach },
  orbitBeadRight: { right: -5, backgroundColor: colors.gold },
  auraCore: {
    width: 196,
    height: 196,
    borderRadius: 98,
    backgroundColor: 'rgba(240, 255, 186, 0.48)',
  },
  pulseRing: {
    position: 'absolute',
    width: 198,
    height: 198,
    borderRadius: 64,
    borderWidth: 3.5,
    borderColor: colors.violetBright,
  },
  pulseRingReady: {
    borderColor: colors.lime,
  },
  heroWrap: {
    width: 206,
    height: 206,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  stickersLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 6,
  },

  // Cute comic speech pop-bubble greeting on top-right of the owl crest
  speechBubble: {
    position: 'absolute',
    top: -18,
    right: -18,
    minHeight: 32,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 13,
    borderWidth: borders.regular,
    borderBottomWidth: 4,
    borderColor: colors.ink,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '7deg' }],
    zIndex: 8,
  },
  speechBubbleReady: {
    backgroundColor: colors.lime,
  },
  speechShine: {
    position: 'absolute',
    top: 2,
    left: 7,
    right: 7,
    height: 3.5,
    borderRadius: 3,
    backgroundColor: colors.shine,
  },
  speechText: {
    fontFamily: fonts.display,
    fontSize: 13.5,
    lineHeight: 16,
    color: colors.ink,
    paddingHorizontal: 1,
    includeFontPadding: false,
  },
  speechTail: {
    position: 'absolute',
    bottom: -6,
    left: 11,
    width: 10,
    height: 10,
    backgroundColor: colors.gold,
    borderRightWidth: borders.thin,
    borderBottomWidth: borders.thin,
    borderColor: colors.ink,
    transform: [{ rotate: '45deg' }],
  },
  speechTailReady: {
    backgroundColor: colors.lime,
  },

  cornerStar: {
    position: 'absolute',
    fontFamily: fonts.display,
    includeFontPadding: false,
  },
  cornerStarTopLeft: {
    top: -22,
    left: 34,
    fontSize: 18,
    lineHeight: 22,
    color: colors.violet,
  },
  cornerStarBottomLeft: {
    bottom: -18,
    left: 28,
    fontSize: 17,
    lineHeight: 21,
    color: colors.peach,
  },
  cornerStarMidRight: {
    bottom: 34,
    right: -30,
    fontSize: 18,
    lineHeight: 22,
    color: colors.gold,
  },

  medallionShadow: {
    position: 'absolute',
    top: 12,
    width: 188,
    height: 188,
    borderRadius: 56,
    backgroundColor: colors.violetShadow,
    transform: [{ rotate: '-3deg' }],
  },
  medallionOuter: {
    width: 188,
    height: 188,
    borderRadius: 56,
    borderWidth: 3.5,
    borderColor: colors.ink,
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
    overflow: 'hidden',
  },
  medallionGlowTop: {
    position: 'absolute',
    top: -36,
    left: -18,
    right: -18,
    height: 112,
    borderRadius: 64,
    backgroundColor: 'rgba(154, 102, 255, 0.58)',
  },
  medallionShine: {
    position: 'absolute',
    top: 6,
    left: 24,
    right: 24,
    height: 11,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
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
    backgroundColor: '#F4FFCB',
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
    backgroundColor: 'rgba(124, 60, 255, 0.24)',
  },
  innerCornerDotTR: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 141, 107, 0.28)',
  },
  innerCornerDotBL: {
    position: 'absolute',
    bottom: 11,
    left: 12,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(67, 214, 230, 0.3)',
  },
  innerCornerDotBR: {
    position: 'absolute',
    bottom: 11,
    right: 12,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(124, 60, 255, 0.24)',
  },
  heroImage: { width: 152, height: 152 },

  stickerWrap: {
    position: 'absolute',
    paddingBottom: 3.5,
  },
  stickerShadow: {
    position: 'absolute',
    top: 3.5,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    backgroundColor: colors.ink,
  },
  stickerFace: {
    width: 44,
    height: 44,
    borderRadius: 14,
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
    height: 4.5,
    borderRadius: 3,
    backgroundColor: colors.shine,
  },
  stickerText: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 25,
    includeFontPadding: false,
  },

  identityBlock: { marginTop: 12, alignItems: 'center', width: '100%' },
  identityInner: { alignItems: 'center', width: '100%' },
  wordmarkWrap: {
    marginTop: 10,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  markerHighlight: {
    position: 'absolute',
    right: 2,
    bottom: 3,
    width: '55%',
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.lime,
    transformOrigin: 'left',
  },
  brand: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 42,
    lineHeight: 48,
    letterSpacing: -0.5,
    textAlign: 'center',
    includeFontPadding: false,
  },
  brandAccent: { color: colors.violet },
  promise: {
    marginTop: 4,
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 15.5,
    lineHeight: 21,
    textAlign: 'center',
    includeFontPadding: false,
  },
  pillarsRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pillarPill: {
    minHeight: 27,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
  },
  pillarDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.25,
    borderColor: colors.ink,
  },
  pillarText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    lineHeight: 15,
    color: colors.ink,
    includeFontPadding: false,
  },

  // Signature 3D mini comic notebook progress dock
  progressCardOuter: {
    width: '100%',
    maxWidth: 344,
    position: 'relative',
    paddingBottom: shadows.md,
  },
  progressCardShadow: {
    position: 'absolute',
    top: shadows.md,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 23,
    backgroundColor: colors.ink,
  },
  progressCard: {
    borderRadius: 22,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressSpine: {
    width: 16,
    borderRightWidth: borders.thin,
    borderRightColor: colors.ink,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 14,
    position: 'relative',
  },
  progressSpineMid: {
    backgroundColor: colors.cyan,
  },
  progressSpineReady: {
    backgroundColor: colors.lime,
  },
  spineGloss: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 2,
    width: 2.5,
    borderRadius: 2,
    backgroundColor: colors.shine,
  },
  spineHole: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.4,
    borderColor: colors.ink,
    backgroundColor: colors.canvas,
  },
  progressBody: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 11,
    gap: 9,
    position: 'relative',
  },
  cardShine: {
    position: 'absolute',
    top: 3,
    left: 14,
    right: 14,
    height: 4.5,
    borderRadius: 4,
    backgroundColor: colors.shine,
  },
  dockBookmark: {
    position: 'absolute',
    top: -1,
    right: 16,
    width: 13,
    height: 14,
    backgroundColor: colors.peach,
    borderLeftWidth: 1.4,
    borderRightWidth: 1.4,
    borderBottomWidth: 1.4,
    borderColor: colors.ink,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  dockBookmarkNotch: {
    width: 5,
    height: 3.5,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    backgroundColor: colors.paper,
    marginBottom: -1,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingRight: 18,
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
    minHeight: 24,
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
    height: 22,
    borderRadius: radii.md - 2,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.canvasWarm,
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
  },
  barFill: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: colors.violet,
    overflow: 'hidden',
  },
  barFillReady: {
    backgroundColor: colors.lime,
  },
  barStripes: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    left: -10,
    right: -10,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  barStripe: {
    width: 12,
    height: '140%',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    transform: [{ skewX: '-22deg' }],
  },
  barSheen: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    width: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
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
  milestonesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingTop: 1,
  },
  milestonePill: {
    flex: 1,
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4.5,
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    borderRadius: 9,
    borderWidth: 1.25,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
  },
  milestonePillDone: {
    borderColor: colors.ink,
    backgroundColor: colors.limeSoft,
  },
  milestoneDot: {
    width: 14,
    height: 14,
    borderRadius: 5,
    borderWidth: 1.4,
    borderColor: colors.line,
    backgroundColor: colors.paper,
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
    fontSize: 10.5,
    lineHeight: 14,
    color: colors.inkMuted,
    includeFontPadding: false,
  },
  milestoneLabelDone: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
  },
});
