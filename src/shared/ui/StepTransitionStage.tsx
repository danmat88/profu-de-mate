import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';

type Props = {
  /** Slide direction for the newly mounted step (`1` = forward from right, `-1` = back from left). */
  direction?: -1 | 0 | 1;
  /** Set false on initial screen paint so Frame 0 appears instantly with zero motion. */
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Atomic GPU-transform stage wrapper for step-by-step screens (Tests, Exam
 * Simulations, Formula Sheets, Exam Guides).
 *
 * Always pair with a unique `key={stepId}`: React unmounts the outgoing step
 * and mounts the incoming step in one atomic Fabric commit, so the previous
 * step can never flash, dim, or animate as if it were the next step. Animates
 * strictly `translateX` on the native driver (never `opacity: 0`) to prevent
 * Android Fabric offscreen-alpha text culling.
 */
export function StepTransitionStage({
  direction = 0,
  animate = false,
  style,
  children,
}: Props) {
  const reducedMotion = useReducedMotion();
  const shouldSlide = animate && !reducedMotion && direction !== 0;
  const shiftX = useRef(new Animated.Value(shouldSlide ? direction * 20 : 0)).current;

  useLayoutEffect(() => {
    if (!shouldSlide) {
      shiftX.setValue(0);
      return undefined;
    }
    const anim = Animated.spring(shiftX, {
      toValue: 0,
      tension: 340,
      friction: 28,
      useNativeDriver: true,
    });
    anim.start();
    return () => {
      anim.stop();
    };
  }, [shiftX, shouldSlide]);

  const animatedStyle = useMemo(
    () => ({
      transform: [{ translateX: shiftX }],
    }),
    [shiftX],
  );

  return (
    <Animated.View collapsable={false} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
