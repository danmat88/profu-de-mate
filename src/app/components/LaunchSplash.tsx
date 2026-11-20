import { bundledImageSource } from '../../shared/services/bundledImages';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { colors, fonts } from '../../shared/theme';
import { Text } from '../../shared/ui/Typography';

type Props = {
  ready: boolean;
  visualsReady: boolean;
  reducedMotion: boolean;
  onFinish: () => void;
};

/** A short branded handoff between the native launch surface and the painted app. */
export function LaunchSplash({ ready, visualsReady, reducedMotion, onFinish }: Props) {
  const { width, height } = useWindowDimensions();
  const [sceneReady, setSceneReady] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  const [introComplete, setIntroComplete] = useState(reducedMotion);
  const reveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const copyReveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const finishRef = useRef(onFinish);
  const finished = useRef(false);
  const handleSceneLayout = useCallback(() => setSceneReady(true), []);
  const visualScale = Math.max(0.82, Math.min(1.12, width / 390, height / 760));

  finishRef.current = onFinish;

  const finishOnce = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    finishRef.current();
  }, []);

  useEffect(() => {
    if (!sceneReady || !imageReady || !visualsReady) return undefined;
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    const frame = requestAnimationFrame(() => {
      void SplashScreen.hideAsync().catch(() => undefined).then(() => {
        if (active) setNativeSplashHidden(true);
      });
      if (!active) return;
      if (reducedMotion) {
        reveal.setValue(1);
        copyReveal.setValue(1);
        setIntroComplete(true);
        return;
      }
      animation = Animated.parallel([
        Animated.timing(reveal, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(copyReveal, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]);
      animation.start(({ finished: completed }) => {
        if (active && completed) setIntroComplete(true);
      });
    });
    const introFallback = setTimeout(() => {
      if (active) setIntroComplete(true);
    }, 850);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      clearTimeout(introFallback);
      animation?.stop();
    };
  }, [copyReveal, imageReady, reducedMotion, reveal, sceneReady, visualsReady]);

  useEffect(() => {
    if (!ready || !introComplete || !nativeSplashHidden) return undefined;
    if (reducedMotion) {
      finishOnce();
      return undefined;
    }
    const exit = Animated.timing(opacity, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    exit.start(({ finished: completed }) => {
      if (completed) finishOnce();
    });
    return () => exit.stop();
  }, [finishOnce, introComplete, nativeSplashHidden, opacity, ready, reducedMotion]);

  useEffect(() => {
    if (!sceneReady || !imageReady || !visualsReady || !nativeSplashHidden || !ready) return undefined;
    const hardDeadline = setTimeout(finishOnce, 2_500);
    return () => clearTimeout(hardDeadline);
  }, [finishOnce, imageReady, nativeSplashHidden, ready, sceneReady, visualsReady]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={handleSceneLayout}
      pointerEvents="auto"
      style={[styles.root, { opacity }]}
    >
      <StatusBar style="light" />
      <View pointerEvents="none" style={styles.decorations}>
        <View style={styles.orbTop} />
        <View style={styles.orbBottom} />
        <View style={[styles.spark, styles.sparkTop]} />
        <View style={[styles.spark, styles.sparkBottom]} />
      </View>

      {/* Mount custom-font text only after Font.loadAsync has resolved. Native
          text mounted earlier may retain the fallback typeface/layout. */}
      {visualsReady ? (
        <>
          <Animated.View style={[styles.hero, {
            opacity: reveal,
            transform: [
              { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [-46, -54] }) },
              { scale: visualScale },
              { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
              { rotate: reveal.interpolate({ inputRange: [0, 1], outputRange: ['-1deg', '0deg'] }) },
            ],
          }]}>
            <View style={styles.heroHaloOuter} />
            <View style={styles.heroHaloInner} />
            <Image
              accessible={false}
              source={bundledImageSource(require('../../../assets/brand/splash_mark_v2.png'))}
              resizeMode="contain"
              fadeDuration={0}
              onLoad={() => setImageReady(true)}
              style={styles.heroImage}
            />
          </Animated.View>
          <Animated.View style={[styles.copy, {
            opacity: copyReveal,
            transform: [{ translateY: copyReveal.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
          }]}>
            <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.brand}>Profu’ de mate</Text>
            <Text maxFontSizeMultiplier={1.3} style={styles.promise}>Matematica, pas cu pas.</Text>
          </Animated.View>

          <Animated.View style={[styles.launchNote, { opacity: copyReveal }]}>
            <View style={styles.launchDot} />
            <Text maxFontSizeMultiplier={1.3} style={styles.launchText}>Se pregătește aplicația</Text>
          </Animated.View>

        </>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, overflow: 'hidden', backgroundColor: colors.ink },
  decorations: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  orbTop: { position: 'absolute', width: 280, height: 280, borderRadius: 140, top: -155, right: -95, backgroundColor: '#3E1D84', borderWidth: 2, borderColor: '#6B39D9' },
  orbBottom: { position: 'absolute', width: 230, height: 230, borderRadius: 115, bottom: -142, left: -92, backgroundColor: '#2A185C', borderWidth: 2, borderColor: '#5530AE' },
  spark: { position: 'absolute', backgroundColor: colors.lime, borderRadius: 2, transform: [{ rotate: '45deg' }] },
  sparkTop: { left: '19%', top: '14%', width: 12, height: 12 },
  sparkBottom: { right: '20%', bottom: '12%', width: 9, height: 9 },
  hero: { position: 'absolute', left: '50%', top: '50%', width: 220, height: 220, marginLeft: -110, marginTop: -110, alignItems: 'center', justifyContent: 'center' },
  heroHaloOuter: { position: 'absolute', width: 228, height: 228, borderRadius: 114, borderWidth: 3, borderColor: '#7A42F5', backgroundColor: '#241452' },
  heroHaloInner: { position: 'absolute', width: 202, height: 202, borderRadius: 76, borderWidth: 5, borderColor: colors.lime, backgroundColor: colors.canvas, transform: [{ rotate: '-5deg' }] },
  heroImage: { width: 220, height: 220 },
  copy: { position: 'absolute', top: '50%', left: 24, right: 24, marginTop: 106, alignItems: 'center' },
  brand: { fontFamily: fonts.display, color: colors.paper, fontSize: 38, lineHeight: 48, letterSpacing: -0.5, textAlign: 'center', includeFontPadding: false },
  promise: { marginTop: 9, fontFamily: fonts.body, color: '#DCD4F2', fontSize: 15, lineHeight: 22, textAlign: 'center', includeFontPadding: false },
  launchNote: { position: 'absolute', left: 24, right: 24, bottom: '8%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  launchDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lime },
  launchText: { fontFamily: fonts.bodyMedium, color: '#BDB2D8', fontSize: 12, lineHeight: 18, includeFontPadding: false },
});
