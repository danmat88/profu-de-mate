import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Props = {
  /** Slide direction for the newly mounted tab (-1 = from left, 1 = from right, 0 = instant). */
  direction: -1 | 0 | 1;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Pure GPU-transform tab slide (translateX + subtle scale, opacity locked at 1)
 * so Android Fabric never drops child badge text via offscreen alpha layers.
 */
function AnimatedTabPanel({ direction, style, children }: { direction: -1 | 1; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const shiftX = useRef(new Animated.Value(direction * 22)).current;
  const scale = useRef(new Animated.Value(0.985)).current;

  useLayoutEffect(() => {
    const anim = Animated.parallel([
      Animated.spring(shiftX, {
        toValue: 0,
        tension: 250,
        friction: 22,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 250,
        friction: 22,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => {
      anim.stop();
    };
  }, [scale, shiftX]);

  return (
    <Animated.View
      collapsable={false}
      style={[
        style,
        {
          transform: [
            { translateX: shiftX },
            { scale },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Mount-atomic tab content stage powered by native-driver Animated springs so
 * switching tabs stays silky with zero Reanimated worklet overhead, and initial
 * screen mounts (`direction === 0`) render a plain View.
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
