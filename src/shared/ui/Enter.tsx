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
  scaleFrom?: number;
  tiltFrom?: number;
  bouncy?: boolean;
  ready?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Staggered comic panel entrance. Stays cleanly hidden while `ready` is false
 * (unless reduced motion is enabled) and pops in with Reanimated spring physics
 * when its turn arrives.
 */
export function Enter({
  children,
  delay = 0,
  distance = 16,
  scaleFrom = 0.94,
  tiltFrom = 0,
  bouncy = true,
  ready = true,
  style,
}: Props) {
  const reducedMotion = useReducedMotion();
  const played = useRef(reducedMotion);
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      progress.set(1);
      played.current = true;
      return;
    }
    if (!ready) {
      if (!played.current) progress.set(0);
      return;
    }
    if (played.current) return;
    played.current = true;
    const springConfig = bouncy ? springs.bouncy : springs.snappy;
    if (delay > 0) {
      progress.set(withDelay(delay, withSpring(1, springConfig)));
    } else {
      progress.set(withSpring(1, springConfig));
    }
  }, [bouncy, delay, progress, ready, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const opacity = p <= 0.01 ? 0 : Math.min(1, p * 1.45);
    const scale = scaleFrom + p * (1 - scaleFrom);
    const translateY = (1 - p) * distance;
    if (tiltFrom !== 0) {
      return {
        opacity,
        transform: [
          { translateY },
          { scale },
          { rotate: `${(1 - p) * tiltFrom}deg` },
        ],
      };
    }
    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  }, [distance, scaleFrom, tiltFrom]);

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

/** Quick timing helper export for inline pops. */
export function popTiming(toValue: number) {
  return withTiming(toValue, { duration: motion.fast });
}
