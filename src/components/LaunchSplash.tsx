import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

type Props = {
  reducedMotion: boolean;
  onFinish: () => void;
};

export function LaunchSplash({ reducedMotion, onFinish }: Props) {
  const heroReveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const copyReveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const progressReveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const exitReveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;

    const frame = requestAnimationFrame(() => {
      void SplashScreen.hideAsync();

      if (reducedMotion) {
        timer = setTimeout(() => {
          if (!cancelled) onFinish();
        }, 320);
        return;
      }

      animation = Animated.sequence([
        Animated.parallel([
          Animated.spring(heroReveal, {
            toValue: 1,
            useNativeDriver: true,
            speed: 10,
            bounciness: 7,
          }),
          Animated.timing(copyReveal, {
            toValue: 1,
            delay: 160,
            duration: 360,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(progressReveal, {
            toValue: 1,
            delay: 360,
            duration: 440,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(430),
        Animated.timing(exitReveal, {
          toValue: 1,
          duration: 280,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
      animation.start(({ finished }) => {
        if (finished && !cancelled) onFinish();
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
      animation?.stop();
    };
  }, [copyReveal, exitReveal, heroReveal, onFinish, progressReveal, reducedMotion]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      renderToHardwareTextureAndroid
      style={[
        styles.root,
        {
          opacity: exitReveal.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.96, 0] }),
          transform: [
            { translateY: exitReveal.interpolate({ inputRange: [0, 1], outputRange: [0, -24] }) },
            { scale: exitReveal.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] }) },
          ],
        },
      ]}
    >
      <StatusBar style="light" />

      <Animated.View pointerEvents="none" style={[styles.decorations, { opacity: copyReveal }]}>
        <View style={styles.orbTop} />
        <View style={styles.orbBottom} />
        <Text style={[styles.mathMark, styles.mathMarkLeft]}>x²</Text>
        <Text style={[styles.mathMark, styles.mathMarkRight]}>π</Text>
        <Text style={[styles.mathMark, styles.mathMarkBottom]}>√</Text>
        <Text style={[styles.spark, styles.sparkTop]}>✦</Text>
        <Text style={[styles.spark, styles.sparkBottom]}>✦</Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.hero,
          {
            transform: [
              { translateY: heroReveal.interpolate({ inputRange: [0, 1], outputRange: [0, -60] }) },
              { scale: heroReveal.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1, 1.08, 1.045] }) },
            ],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.heroHaloOuter,
            {
              opacity: heroReveal,
              transform: [{ scale: heroReveal.interpolate({ inputRange: [0, 1], outputRange: [0.68, 1] }) }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.heroHaloInner,
            {
              opacity: heroReveal,
              transform: [
                { rotate: '-5deg' },
                { scale: heroReveal.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
              ],
            },
          ]}
        />
        <Image
          accessible={false}
          source={require('../../assets/brand/splash-mark-v2.png')}
          resizeMode="contain"
          style={styles.heroImage}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.copy,
          {
            opacity: copyReveal,
            transform: [{ translateY: copyReveal.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
          },
        ]}
      >
        <View style={styles.kickerRow}>
          <View style={styles.kickerLine} />
          <Text style={styles.kicker}>GATA DE MATEMATICĂ?</Text>
          <View style={styles.kickerLine} />
        </View>
        <Text style={styles.brand}>Profu’ de mate</Text>
        <Text style={styles.promise}>Fotografiezi. Înțelegi. Reușești.</Text>
      </Animated.View>

      <Animated.View style={[styles.progressWrap, { opacity: progressReveal }]}>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              { transform: [{ scaleX: progressReveal }] },
            ]}
          />
        </View>
        <Text style={styles.loadingText}>PREGĂTIM CRETA</Text>
      </Animated.View>
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
    backgroundColor: colors.ink,
  },
  decorations: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  orbTop: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -155,
    right: -95,
    backgroundColor: '#3E1D84',
    borderWidth: 2,
    borderColor: '#6B39D9',
  },
  orbBottom: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    bottom: -142,
    left: -92,
    backgroundColor: '#2A185C',
    borderWidth: 2,
    borderColor: '#5530AE',
  },
  mathMark: {
    position: 'absolute',
    fontFamily: fonts.display,
    color: 'rgba(233, 222, 255, 0.34)',
  },
  mathMarkLeft: { left: '10%', top: '24%', fontSize: 28, transform: [{ rotate: '-9deg' }] },
  mathMarkRight: { right: '12%', top: '29%', fontSize: 34, transform: [{ rotate: '8deg' }] },
  mathMarkBottom: { right: '15%', bottom: '18%', fontSize: 31, transform: [{ rotate: '-7deg' }] },
  spark: { position: 'absolute', fontFamily: fonts.display, color: colors.lime },
  sparkTop: { left: '19%', top: '14%', fontSize: 22, transform: [{ rotate: '-8deg' }] },
  sparkBottom: { right: '20%', bottom: '12%', fontSize: 16, transform: [{ rotate: '9deg' }] },
  hero: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 220,
    height: 220,
    marginLeft: -110,
    marginTop: -110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHaloOuter: {
    position: 'absolute',
    width: 228,
    height: 228,
    borderRadius: 114,
    borderWidth: 3,
    borderColor: '#7A42F5',
    backgroundColor: '#241452',
  },
  heroHaloInner: {
    position: 'absolute',
    width: 202,
    height: 202,
    borderRadius: 76,
    borderWidth: 5,
    borderColor: colors.lime,
    backgroundColor: colors.canvas,
  },
  heroImage: { width: 220, height: 220 },
  copy: {
    position: 'absolute',
    top: '50%',
    left: 24,
    right: 24,
    marginTop: 114,
    alignItems: 'center',
  },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  kickerLine: { width: 28, height: 2, borderRadius: 1, backgroundColor: colors.lime },
  kicker: { fontFamily: fonts.bodyBold, color: colors.lime, fontSize: 9, letterSpacing: 1.55 },
  brand: {
    marginTop: 5,
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 38,
    lineHeight: 45,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  promise: {
    marginTop: 1,
    fontFamily: fonts.bodyMedium,
    color: '#DCD4F2',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  progressWrap: {
    position: 'absolute',
    left: '50%',
    bottom: '9%',
    width: 132,
    marginLeft: -66,
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 7,
    overflow: 'hidden',
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#6C55A0',
    backgroundColor: '#2A2051',
  },
  progressFill: { width: '100%', height: '100%', borderRadius: 4, backgroundColor: colors.lime },
  loadingText: { marginTop: 7, fontFamily: fonts.bodyBold, color: '#AFA3CE', fontSize: 7.5, letterSpacing: 1.35 },
});
