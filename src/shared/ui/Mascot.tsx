import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import {
  createNativeLoop,
  SILKY_EASE_OUT,
  sineDegreeRange,
  sineWaveRange,
  WAVE_INPUT_17,
} from '../motion/nativeMotion';
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

const FLOAT_OUTPUT = sineWaveRange(3.6, -1.0);
const TILT_OUTPUT = sineDegreeRange(2.1, 0.7);

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
 * Branded Profu mascot powered by a single pure-native RenderThread loop
 * (_startNativeLoop(-1), zero JS callbacks, zero Reanimated worklets) sharing
 * the exact gentle float-and-sway feel of LaunchSplash across every screen.
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
  const idlePhase = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const hopY = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const previousPose = useRef<MascotPose>(pose);
  const previousNudge = useRef<number | undefined>(nudgeSignal);
  const previousActive = useRef<boolean>(active);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleLoop = useRef<Animated.CompositeAnimation | null>(null);

  const stopAllMotion = useCallback(() => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    idleLoop.current?.stop();
    idleLoop.current = null;
    idlePhase.stopAnimation();
    hopY.stopAnimation();
    wiggle.stopAnimation();
    pop.stopAnimation();
  }, [hopY, idlePhase, pop, wiggle]);

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
          easing: SILKY_EASE_OUT,
          useNativeDriver: true,
        }),
        Animated.spring(hopY, {
          toValue: 0,
          tension: 270,
          friction: 15,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(wiggle, { toValue: -7.5, duration: 75, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 7.5, duration: 105, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.spring(wiggle, {
          toValue: 0,
          tension: 270,
          friction: 15,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(pop, { toValue: 1.075, duration: 95, easing: SILKY_EASE_OUT, useNativeDriver: true }),
        Animated.spring(pop, {
          toValue: 1,
          tension: 270,
          friction: 15,
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
      idlePhase.setValue(0);
      hopY.setValue(0);
      wiggle.setValue(0);
      pop.setValue(1);
      return undefined;
    }

    if (justActivated) {
      pop.setValue(0.965);
      Animated.spring(pop, {
        toValue: 1,
        tension: 210,
        friction: 18,
        useNativeDriver: true,
      }).start();
    }

    const startIdle = () => {
      idleLoop.current = createNativeLoop(idlePhase, 3_600);
      idleLoop.current.start();
    };

    if (justActivated) {
      idleTimer.current = setTimeout(() => {
        idleTimer.current = null;
        startIdle();
      }, 180);
    } else {
      startIdle();
    }

    return () => {
      stopAllMotion();
    };
  }, [active, hopY, idlePhase, pop, reducedMotion, stopAllMotion, wiggle]);

  useEffect(() => {
    if (previousPose.current === pose) return;
    previousPose.current = pose;
    if (reducedMotion || !active) return;
    pop.stopAnimation();
    Animated.sequence([
      Animated.timing(pop, {
        toValue: 1.06,
        duration: 85,
        easing: SILKY_EASE_OUT,
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

  const idleMotionStyle = useMemo(() => ({
    transform: [
      {
        translateY: idlePhase.interpolate({
          inputRange: WAVE_INPUT_17,
          outputRange: FLOAT_OUTPUT,
        }),
      },
      {
        rotate: idlePhase.interpolate({
          inputRange: WAVE_INPUT_17,
          outputRange: TILT_OUTPUT,
        }),
      },
    ],
  }), [idlePhase]);

  const actionMotionStyle = useMemo(() => ({
    transform: [
      { translateY: hopY },
      {
        rotate: wiggle.interpolate({
          inputRange: [-20, 20],
          outputRange: ['-20deg', '20deg'],
        }),
      },
      { scale: pop },
    ],
  }), [hopY, pop, wiggle]);

  const handleTap = () => {
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
    playHopWiggle();
  };

  const visual = (
    <View style={[styles.wrap, { width: size, height: size }, !interactive && style]}>
      <Animated.View style={[styles.layer, actionMotionStyle]}>
        <Animated.View style={[styles.layer, idleMotionStyle]}>
          <Image
            accessible={false}
            source={bundledImageSource(mascotAssets[pose])}
            resizeMode="contain"
            fadeDuration={0}
            style={{ width: size, height: size }}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );

  if (!interactive) return visual;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Salută-l pe Profu’"
      onPress={handleTap}
      hitSlop={8}
      style={style}
    >
      {visual}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  layer: { alignItems: 'center', justifyContent: 'center' },
});
