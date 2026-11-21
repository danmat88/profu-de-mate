import { useLayoutEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { springs } from '../theme';

type Props = {
  /** Slide direction for the newly mounted tab (-1 = from left, 1 = from right, 0 = instant). */
  direction: -1 | 0 | 1;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Mount-atomic tab content stage. Pair with `key={activeTab}` so React replaces
 * the previous tab in a single commit and only the newly selected tab animates in,
 * eliminating previous-tab flash or jump glitches.
 */
export function TabPanel({ direction, style, children }: Props) {
  const reducedMotion = useReducedMotion();
  const shouldAnimate = !reducedMotion && direction !== 0;
  const opacity = useSharedValue(shouldAnimate ? 0 : 1);
  const shiftX = useSharedValue(shouldAnimate ? direction * 18 : 0);

  useLayoutEffect(() => {
    if (!shouldAnimate) return;
    opacity.set(withTiming(1, { duration: 155, easing: Easing.out(Easing.quad) }));
    shiftX.set(withSpring(0, springs.snappy));
  }, [opacity, shiftX, shouldAnimate]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateX: shiftX.get() }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
