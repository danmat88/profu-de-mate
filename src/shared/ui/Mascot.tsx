import { useEffect, useRef } from 'react';
import { Image, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { bundledImageSource } from '../services/bundledImages';
import * as Haptics from '../services/haptics';
import { springs } from '../theme';

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
  /** Pauses idle float when offscreen or in the background. */
  active?: boolean;
  /** Allows tapping Profu’ for a playful spring hop + wiggle. */
  interactive?: boolean;
  /** Optional extra callback when tapped (requires `interactive`). */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Mascot({
  pose = 'wave',
  size = 104,
  active = true,
  interactive = false,
  onPress,
  style,
}: Props) {
  const reducedMotion = useReducedMotion();
  const floatY = useSharedValue(0);
  const tilt = useSharedValue(0);
  const pop = useSharedValue(1);
  const hopY = useSharedValue(0);
  const wiggle = useSharedValue(0);
  const previousPose = useRef<MascotPose>(pose);

  useEffect(() => {
    if (reducedMotion || !active) {
      cancelAnimation(floatY);
      cancelAnimation(tilt);
      floatY.set(0);
      tilt.set(0);
      return;
    }

    floatY.set(withRepeat(
      withSequence(
        withTiming(-4.5, { duration: 1550, easing: Easing.inOut(Easing.sin) }),
        withTiming(2.5, { duration: 1550, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    ));
    tilt.set(withRepeat(
      withSequence(
        withTiming(-2.2, { duration: 2100, easing: Easing.inOut(Easing.sin) }),
        withTiming(2.4, { duration: 2100, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    ));

    return () => {
      cancelAnimation(floatY);
      cancelAnimation(tilt);
    };
  }, [active, floatY, reducedMotion, tilt]);

  useEffect(() => {
    if (previousPose.current === pose) return;
    previousPose.current = pose;
    if (reducedMotion) return;
    pop.set(0.88);
    pop.set(withSpring(1, springs.pop));
  }, [pop, pose, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.get() + hopY.get() },
      { rotate: `${tilt.get() + wiggle.get()}deg` },
      { scale: pop.get() },
    ],
  }));

  const handleTap = () => {
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
    if (reducedMotion) return;
    hopY.set(withSequence(
      withTiming(-11, { duration: 110, easing: Easing.out(Easing.quad) }),
      withSpring(0, springs.bouncy),
    ));
    wiggle.set(withSequence(
      withTiming(-8, { duration: 75 }),
      withTiming(8, { duration: 105 }),
      withSpring(0, springs.bouncy),
    ));
    pop.set(withSequence(
      withTiming(1.08, { duration: 95 }),
      withSpring(1, springs.bouncy),
    ));
  };

  const visual = (
    <Animated.View style={[styles.stage, { width: size, height: size }, animatedStyle, style]}>
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
