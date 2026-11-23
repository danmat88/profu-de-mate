import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Props = {
  /** Slide direction for the newly mounted tab (-1 = from left, 1 = from right, 0 = instant). */
  direction: -1 | 0 | 1;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

function AnimatedTabPanel({ direction, style, children }: { direction: -1 | 1; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const shiftX = useRef(new Animated.Value(direction * 20)).current;
  const scale = useRef(new Animated.Value(0.988)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 165,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(shiftX, {
        toValue: 0,
        tension: 260,
        friction: 22,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 260,
        friction: 22,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => {
      anim.stop();
    };
  }, [opacity, scale, shiftX]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
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
