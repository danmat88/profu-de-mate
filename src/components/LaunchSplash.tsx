import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { colors, fonts } from '../theme';
import { Text } from './Typography';

type Props = {
  reducedMotion: boolean;
  onFinish: () => void;
};

export function LaunchSplash({ reducedMotion, onFinish }: Props) {
  const { width, height } = useWindowDimensions();
  const revealed = reducedMotion ? 1 : 0;
  const orbsReveal = useRef(new Animated.Value(revealed)).current;
  const symbolsReveal = useRef(new Animated.Value(revealed)).current;
  const heroReveal = useRef(new Animated.Value(revealed)).current;
  const kickerReveal = useRef(new Animated.Value(revealed)).current;
  const brandReveal = useRef(new Animated.Value(revealed)).current;
  const promiseReveal = useRef(new Animated.Value(revealed)).current;
  const progressReveal = useRef(new Animated.Value(revealed)).current;
  const sceneExit = useRef(new Animated.Value(0)).current;
  const homeReveal = useRef(new Animated.Value(0)).current;
  const wipeSize = Math.sqrt((width * width) + (height * height)) * 2.2;
  const visualScale = Math.max(0.84, Math.min(1.18, width / 390, height / 760));
  const heroLift = -60 * visualScale;
  const copyOffset = 114 * visualScale;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let finished = false;
    let animation: Animated.CompositeAnimation | null = null;
    const finishOnce = () => {
      if (cancelled || finished) return;
      finished = true;
      onFinish();
    };

    // Never leave an interrupted native animation blocking the application.
    watchdog = setTimeout(finishOnce, reducedMotion ? 1_500 : 5_000);

    const frame = requestAnimationFrame(() => {
      // The React layer is already painted in the same color as the native layer.
      // Hiding the native splash here therefore cannot expose a blank frame.
      void SplashScreen.hideAsync();

      if (reducedMotion) {
        orbsReveal.setValue(1);
        symbolsReveal.setValue(1);
        heroReveal.setValue(1);
        kickerReveal.setValue(1);
        brandReveal.setValue(1);
        promiseReveal.setValue(1);
        progressReveal.setValue(1);
        timer = setTimeout(finishOnce, 520);
        return;
      }

      animation = Animated.sequence([
        Animated.timing(orbsReveal, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(symbolsReveal, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.back(1.7)),
            useNativeDriver: true,
          }),
          Animated.spring(heroReveal, {
            toValue: 1,
            speed: 13,
            bounciness: 10,
            useNativeDriver: true,
          }),
        ]),
        Animated.stagger(85, [
          Animated.timing(kickerReveal, {
            toValue: 1,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(brandReveal, {
            toValue: 1,
            speed: 18,
            bounciness: 8,
            useNativeDriver: true,
          }),
          Animated.timing(promiseReveal, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(progressReveal, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(300),
        Animated.parallel([
          Animated.timing(sceneExit, {
            toValue: 1,
            duration: 270,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(70),
            Animated.spring(homeReveal, {
              toValue: 1,
              speed: 14,
              bounciness: 0,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]);

      animation.start(({ finished }) => {
        if (finished) finishOnce();
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
      if (watchdog) clearTimeout(watchdog);
      animation?.stop();
    };
  }, [
    brandReveal,
    heroReveal,
    homeReveal,
    kickerReveal,
    onFinish,
    orbsReveal,
    progressReveal,
    promiseReveal,
    reducedMotion,
    sceneExit,
    symbolsReveal,
  ]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="auto"
      style={styles.root}
    >
      <StatusBar style="light" />

      <Animated.View
        renderToHardwareTextureAndroid
        style={[
          styles.scene,
          {
            opacity: sceneExit.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1, 0.94, 0] }),
            transform: [
              { translateY: sceneExit.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) },
              { scale: sceneExit.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) },
            ],
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.decorations,
            {
              opacity: orbsReveal,
              transform: [{ scale: orbsReveal.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }],
            },
          ]}
        >
          <View style={styles.orbTop} />
          <View style={styles.orbBottom} />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.decorations,
            {
              opacity: symbolsReveal,
              transform: [{ scale: symbolsReveal.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }],
            },
          ]}
        >
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
              opacity: heroReveal,
              transform: [
                { translateY: heroReveal.interpolate({ inputRange: [0, 1], outputRange: [28, heroLift] }) },
                { scale: visualScale },
                { scale: heroReveal.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.54, 1.1, 1.045] }) },
                { rotate: heroReveal.interpolate({ inputRange: [0, 0.72, 1], outputRange: ['-9deg', '2deg', '0deg'] }) },
              ],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.heroHaloOuter,
              { transform: [{ scale: heroReveal.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] },
            ]}
          />
          <Animated.View
            style={[
              styles.heroHaloInner,
              {
                transform: [
                  { rotate: '-5deg' },
                  { scale: heroReveal.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }) },
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

        <View style={[styles.copy, { marginTop: copyOffset }]}>
          <Animated.View
            style={[
              styles.kickerRow,
              {
                opacity: kickerReveal,
                transform: [{ translateY: kickerReveal.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
              },
            ]}
          >
            <View style={styles.kickerLine} />
            <Text style={styles.kicker}>GATA DE MATEMATICĂ?</Text>
            <View style={styles.kickerLine} />
          </Animated.View>
          <Animated.Text
            style={[
              styles.brand,
              {
                opacity: brandReveal,
                transform: [
                  { translateY: brandReveal.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
                  { scale: brandReveal.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
                ],
              },
            ]}
          >
            Profu’ de mate
          </Animated.Text>
          <Animated.Text
            style={[
              styles.promise,
              {
                opacity: promiseReveal,
                transform: [{ translateY: promiseReveal.interpolate({ inputRange: [0, 1], outputRange: [9, 0] }) }],
              },
            ]}
          >
            Fotografiezi. Înțelegi. Reușești.
          </Animated.Text>
        </View>

        <Animated.View
          style={[
            styles.progressWrap,
            {
              opacity: progressReveal,
              transform: [{ translateY: progressReveal.interpolate({ inputRange: [0, 1], outputRange: [9, 0] }) }],
            },
          ]}
        >
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { transform: [{ scaleX: progressReveal }] }]} />
          </View>
          <Text style={styles.loadingText}>PREGĂTIM CRETA</Text>
        </Animated.View>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.homeWipe,
          {
            width: wipeSize,
            height: wipeSize,
            borderRadius: wipeSize / 2,
            left: (width - wipeSize) / 2,
            top: (height * 0.86) - (wipeSize / 2),
            transform: [{ scale: homeReveal }],
          },
        ]}
      />
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
    backgroundColor: colors.ink,
  },
  scene: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
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
  homeWipe: { position: 'absolute', backgroundColor: colors.canvas },
});
