import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';

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
 * Staggered comic panel entrance powered by pure native-driver Animated
 * springs (zero Reanimated worklet mount cost). Stays cleanly hidden while
 * ready is false (unless reduced motion is enabled) and pops in smoothly when
 * its turn arrives. Includes a bounded watchdog so a paused/resumed Android
 * Choreographer can never leave content stuck invisible.
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
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.stopAnimation();
      progress.setValue(1);
      played.current = true;
      return undefined;
    }
    if (!ready) {
      if (!played.current) progress.setValue(0);
      return undefined;
    }
    if (played.current) {
      progress.setValue(1);
      return undefined;
    }
    played.current = true;

    let anim: Animated.CompositeAnimation | undefined;
    const springAnim = Animated.spring(progress, {
      toValue: 1,
      tension: bouncy ? 210 : 280,
      friction: bouncy ? 15 : 21,
      useNativeDriver: true,
    });
    const frame = requestAnimationFrame(() => {
      anim = delay > 0 ? Animated.sequence([Animated.delay(delay), springAnim]) : springAnim;
      anim.start();
    });
    const watchdog = setTimeout(() => {
      progress.stopAnimation();
      progress.setValue(1);
    }, delay + 550);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(watchdog);
      anim?.stop();
      progress.stopAnimation();
    };
  }, [bouncy, delay, progress, ready, reducedMotion]);

  const opacity = progress.interpolate({
    inputRange: [0, 0.68, 1],
    outputRange: [0, 1, 1],
    extrapolate: 'clamp',
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [distance, 0],
  });
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [scaleFrom, 1],
  });
  const transform = tiltFrom !== 0
    ? [
      { translateY },
      { scale },
      {
        rotate: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [`${tiltFrom}deg`, '0deg'],
        }),
      },
    ]
    : [{ translateY }, { scale }];

  return <Animated.View style={[{ opacity, transform }, style]}>{children}</Animated.View>;
}
