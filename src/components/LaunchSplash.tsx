import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { colors, fonts } from '../theme';
import { Text } from './Typography';

type Props = {
  ready: boolean;
  reducedMotion: boolean;
  onFinish: () => void;
};

/** A short branded handoff between the native launch surface and the painted app. */
export function LaunchSplash({ ready, reducedMotion, onFinish }: Props) {
  const { width, height } = useWindowDimensions();
  const [sceneReady, setSceneReady] = useState(false);
  const [imageReady, setImageReady] = useState(false);
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
    const imageFallback = setTimeout(() => setImageReady(true), 1_200);
    return () => clearTimeout(imageFallback);
  }, []);

  useEffect(() => {
    if (!sceneReady || !imageReady) return undefined;
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    const frame = requestAnimationFrame(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
      if (!active) return;
      if (reducedMotion) {
        reveal.setValue(1);
        copyReveal.setValue(1);
        setIntroComplete(true);
        return;
      }
      animation = Animated.parallel([
        Animated.spring(reveal, { toValue: 1, speed: 17, bounciness: 7, useNativeDriver: true }),
        Animated.timing(copyReveal, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
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
  }, [copyReveal, imageReady, reducedMotion, reveal, sceneReady]);

  useEffect(() => {
    if (!ready || !introComplete) return undefined;
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
  }, [finishOnce, introComplete, opacity, ready, reducedMotion]);

  useEffect(() => {
    if (!sceneReady) return undefined;
    const hardDeadline = setTimeout(finishOnce, 2_500);
    return () => clearTimeout(hardDeadline);
  }, [finishOnce, sceneReady]);

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
        <Text style={[styles.mathMark, styles.mathMarkLeft]}>x²</Text>
        <Text style={[styles.mathMark, styles.mathMarkRight]}>π</Text>
        <Text style={[styles.mathMark, styles.mathMarkBottom]}>√</Text>
        <Text style={[styles.spark, styles.sparkTop]}>✦</Text>
        <Text style={[styles.spark, styles.sparkBottom]}>✦</Text>
      </View>

      <Animated.View style={[styles.hero, {
        opacity: reveal,
        transform: [
          { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [24, -54] }) },
          { scale: visualScale },
          { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) },
          { rotate: reveal.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '0deg'] }) },
        ],
      }]}>
        <View style={styles.heroHaloOuter} />
        <View style={styles.heroHaloInner} />
        <Image
          accessible={false}
          source={require('../../assets/brand/splash-mark-v2.png')}
          resizeMode="contain"
          fadeDuration={0}
          onLoadEnd={() => setImageReady(true)}
          style={styles.heroImage}
        />
      </Animated.View>

      <Animated.View style={[styles.copy, {
        opacity: copyReveal,
        transform: [{ translateY: copyReveal.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }]}>
        <View style={styles.kickerRow}>
          <View style={styles.kickerLine} />
          <Text style={styles.kicker}>GATA DE MATEMATICĂ?</Text>
          <View style={styles.kickerLine} />
        </View>
        <Text style={styles.brand}>Profu’ de mate</Text>
        <Text style={styles.promise}>Fotografiezi. Înțelegi. Reușești.</Text>
      </Animated.View>

      <Animated.View style={[styles.launchNote, { opacity: copyReveal }]}>
        <View style={styles.launchDot} />
        <Text style={styles.launchText}>PREGĂTIM TABLA</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, overflow: 'hidden', backgroundColor: colors.ink },
  decorations: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  orbTop: { position: 'absolute', width: 280, height: 280, borderRadius: 140, top: -155, right: -95, backgroundColor: '#3E1D84', borderWidth: 2, borderColor: '#6B39D9' },
  orbBottom: { position: 'absolute', width: 230, height: 230, borderRadius: 115, bottom: -142, left: -92, backgroundColor: '#2A185C', borderWidth: 2, borderColor: '#5530AE' },
  mathMark: { position: 'absolute', fontFamily: fonts.display, color: 'rgba(233, 222, 255, 0.34)' },
  mathMarkLeft: { left: '10%', top: '24%', fontSize: 28, transform: [{ rotate: '-9deg' }] },
  mathMarkRight: { right: '12%', top: '29%', fontSize: 34, transform: [{ rotate: '8deg' }] },
  mathMarkBottom: { right: '15%', bottom: '18%', fontSize: 31, transform: [{ rotate: '-7deg' }] },
  spark: { position: 'absolute', fontFamily: fonts.display, color: colors.lime },
  sparkTop: { left: '19%', top: '14%', fontSize: 22, transform: [{ rotate: '-8deg' }] },
  sparkBottom: { right: '20%', bottom: '12%', fontSize: 16, transform: [{ rotate: '9deg' }] },
  hero: { position: 'absolute', left: '50%', top: '50%', width: 220, height: 220, marginLeft: -110, marginTop: -110, alignItems: 'center', justifyContent: 'center' },
  heroHaloOuter: { position: 'absolute', width: 228, height: 228, borderRadius: 114, borderWidth: 3, borderColor: '#7A42F5', backgroundColor: '#241452' },
  heroHaloInner: { position: 'absolute', width: 202, height: 202, borderRadius: 76, borderWidth: 5, borderColor: colors.lime, backgroundColor: colors.canvas, transform: [{ rotate: '-5deg' }] },
  heroImage: { width: 220, height: 220 },
  copy: { position: 'absolute', top: '50%', left: 24, right: 24, marginTop: 106, alignItems: 'center' },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  kickerLine: { width: 28, height: 2, borderRadius: 1, backgroundColor: colors.lime },
  kicker: { fontFamily: fonts.bodyBold, color: colors.lime, fontSize: 9, letterSpacing: 1.55 },
  brand: { marginTop: 5, fontFamily: fonts.display, color: colors.paper, fontSize: 38, lineHeight: 45, letterSpacing: -0.5, textAlign: 'center' },
  promise: { marginTop: 1, fontFamily: fonts.bodyMedium, color: '#DCD4F2', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  launchNote: { position: 'absolute', left: 24, right: 24, bottom: '8%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  launchDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lime },
  launchText: { fontFamily: fonts.bodyBold, color: '#AFA3CE', fontSize: 7.5, letterSpacing: 1.35 },
});
