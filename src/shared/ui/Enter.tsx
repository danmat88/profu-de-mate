import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { motion, springs } from '../theme';

type Props = {
  children: ReactNode;
  delay?: number;
  distance?: number;
  ready?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Staggered comic panel entrance. Starts visible when reduced motion is on
 * or immediately lifts in with spring physics once `ready` becomes true.
 */
export function Enter({
  children,
  delay = 0,
  distance = 14,
  ready = true,
  style,
}: Props) {
  const reducedMotion = useReducedMotion();
  const played = useRef(false);
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1;
      played.current = true;
      return;
    }
    if (!ready || played.current) return;
    played.current = true;
    if (delay > 0) {
      progress.value = withDelay(delay, withSpring(1, springs.snappy));
    } else {
      progress.value = withSpring(1, springs.snappy);
    }
  }, [delay, progress, ready, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: Math.min(1, p * 1.25),
      transform: [{ translateY: (1 - p) * distance }],
    };
  }, [distance]);

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

/** Quick spring pulse helper hook-free export for inline pops. */
export function popTiming(toValue: number) {
  return withTiming(toValue, { duration: motion.fast });
}
