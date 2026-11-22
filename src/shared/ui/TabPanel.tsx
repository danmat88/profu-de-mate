import { useLayoutEffect, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
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

function AnimatedTabPanel({ direction, style, children }: { direction: -1 | 1; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const opacity = useSharedValue(0);
  const shiftX = useSharedValue(direction * 22);
  const scale = useSharedValue(0.985);

  useLayoutEffect(() => {
    opacity.set(withTiming(1, { duration: 165, easing: Easing.out(Easing.quad) }));
    shiftX.set(withSpring(0, springs.snappy));
    scale.set(withSpring(1, springs.snappy));
  }, [opacity, scale, shiftX]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [
      { translateX: shiftX.get() },
      { scale: scale.get() },
    ],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/**
 * Mount-atomic tab content stage. Pair with `key={activeTab}` so React replaces
 * the previous tab in a single commit and only the newly selected tab animates in,
 * eliminating previous-tab flash or jump glitches while incurring zero Reanimated
 * worklets on initial screen mount (`direction === 0`).
 */
export function TabPanel({ direction, style, children }: Props) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion || direction === 0) {
    return <View style={style}>{children}</View>;
  }
  return (
    <AnimatedTabPanel direction={direction} style={style}>
      {children}
    </AnimatedTabPanel>
  );
}
