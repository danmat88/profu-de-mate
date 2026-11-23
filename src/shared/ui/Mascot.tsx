import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { bundledImageSource } from '../services/bundledImages';
import * as Haptics from '../services/haptics';

export const mascotAssets = {
  default: require('../../../assets/profu_mascot_v2.png'),
  wave: require('../../../assets/mascot/owl_wave.png'),
  thinking: require('../../../assets/mascot/owl_thinking.png'),
  cheer: require('../../../assets/mascot/owl_cheer.png'),
  oops: require('../../../assets/mascot/owl_oops.png'),
  point: require('../../../assets/mascot/owl_point.png'),
} as const;

export type MascotPose = keyof typeof mascotAssets;

type Props = {
  pose?: MascotPose;
  size?: number;
  /** Pauses idle float immediately when transitioning, offscreen, or in background. */
  active?: boolean;
  /** Allows tapping Profu for a playful spring hop and wiggle. */
  interactive?: boolean;
  /** Increment to trigger a playful hop and wiggle from an external control. */
  nudgeSignal?: number;
  /** Optional extra callback when tapped (requires interactive). */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Branded Profu mascot powered by pure native-driver Animated transforms (zero
 * Reanimated worklet mount cost). Stops every animation immediately when
 * `active` turns false during a screen transition.
 */
export function Mascot({
  pose = 'wave',
  size = 104,
  active = true,
  interactive = false,
  nudgeSignal,
  onPress,
  style,
}: Props) {
  const reducedMotion = useReducedMotion();
  const floatY = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const hopY = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const previousPose = useRef<MascotPose>(pose);
  const previousNudge = useRef<number | undefined>(nudgeSignal);
  const previousActive = useRef<boolean>(active);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const floatLoop = useRef<Animated.CompositeAnimation | null>(null);
  const tiltLoop = useRef<Animated.CompositeAnimation | null>(null);

  const stopAllMotion = useCallback(() => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    floatLoop.current?.stop();
    tiltLoop.current?.stop();
    floatLoop.current = null;
    tiltLoop.current = null;
    floatY.stopAnimation();
    tilt.stopAnimation();
    hopY.stopAnimation();
    wiggle.stopAnimation();
    pop.stopAnimation();
  }, [floatY, hopY, pop, tilt, wiggle]);

  const playHopWiggle = useCallback(() => {
    if (reducedMotion || !active) return;
    hopY.stopAnimation();
    wiggle.stopAnimation();
    pop.stopAnimation();
    Animated.parallel([
      Animated.sequence([
        Animated.timing(hopY, {
          toValue: -11,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(hopY, {
          toValue: 0,
          tension: 260,
          friction: 14,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(wiggle, { toValue: -8, duration: 75, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 8, duration: 105, useNativeDriver: true }),
        Animated.spring(wiggle, {
          toValue: 0,
          tension: 260,
          friction: 14,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(pop, { toValue: 1.08, duration: 95, useNativeDriver: true }),
        Animated.spring(pop, {
          toValue: 1,
          tension: 260,
          friction: 14,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [active, hopY, pop, reducedMotion, wiggle]);

  useEffect(() => {
    if (nudgeSignal === undefined || previousNudge.current === nudgeSignal) return;
    previousNudge.current = nudgeSignal;
    playHopWiggle();
  }, [nudgeSignal, playHopWiggle]);

  useEffect(() => {
    const justActivated = active && !previousActive.current;
    previousActive.current = active;
    stopAllMotion();
    if (reducedMotion || !active) {
      floatY.setValue(0);
      tilt.setValue(0);
      hopY.setValue(0);
      wiggle.setValue(0);
      pop.setValue(1);
      return undefined;
    }

    // Joyful welcome hop and wave when a screen settles and wakes up its mascot.
    if (justActivated) {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(hopY, {
            toValue: -7,
            duration: 115,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.spring(hopY, {
            toValue: 0,
            tension: 250,
            friction: 14,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(wiggle, { toValue: -4.5, duration: 80, useNativeDriver: true }),
          Animated.timing(wiggle, { toValue: 3.5, duration: 95, useNativeDriver: true }),
          Animated.spring(wiggle, {
            toValue: 0,
            tension: 250,
            friction: 14,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pop, {
            toValue: 1.06,
            duration: 100,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.spring(pop, {
            toValue: 1,
            tension: 280,
            friction: 20,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }

    const startIdle = () => {
      floatLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(floatY, {
            toValue: -4.5,
            duration: 1550,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(floatY, {
            toValue: 2.5,
            duration: 1550,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      tiltLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(tilt, {
            toValue: -2.2,
            duration: 2100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(tilt, {
            toValue: 2.4,
            duration: 2100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      floatLoop.current.start();
      tiltLoop.current.start();
    };

    if (justActivated) {
      idleTimer.current = setTimeout(() => {
        idleTimer.current = null;
        startIdle();
      }, 210);
    } else {
      startIdle();
    }

    return () => {
      stopAllMotion();
    };
  }, [active, floatY, hopY, pop, reducedMotion, stopAllMotion, tilt, wiggle]);

  useEffect(() => {
    if (previousPose.current === pose) return;
    previousPose.current = pose;
    if (reducedMotion || !active) return;
    pop.stopAnimation();
    Animated.sequence([
      Animated.timing(pop, {
        toValue: 1.06,
        duration: 85,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(pop, {
        toValue: 1,
        tension: 260,
        friction: 14,
        useNativeDriver: true,
      }),
    ]).start();
  }, [active, pop, pose, reducedMotion]);

  const combinedTranslateY = Animated.add(floatY, hopY);
  const combinedRotate = Animated.add(tilt, wiggle).interpolate({
    inputRange: [-20, 20],
    outputRange: ['-20deg', '20deg'],
  });

  const handleTap = () => {
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
    playHopWiggle();
  };

  const visual = (
    <Animated.View
      style={[
        styles.stage,
        { width: size, height: size },
        {
          transform: [
            { translateY: combinedTranslateY },
            { rotate: combinedRotate },
            { scale: pop },
          ],
        },
        style,
      ]}
    >
      <Image
        accessible={false}
        accessibilityIgnoresInvertColors
        fadeDuration={0}
        source={bundledImageSource(mascotAssets[pose])}
        resizeMode="contain"
        style={styles.image}
      />
    </Animated.View>
  );

  if (!interactive) return visual;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Profu’ te salută"
      onPress={handleTap}
      hitSlop={6}
    >
      {visual}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
});
