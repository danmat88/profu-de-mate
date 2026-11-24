import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { SILKY_EASE_OUT } from '../motion/nativeMotion';

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
 * transforms (zero Reanimated worklets) with memoized Fabric interpolations
 * and the app unified critically-damped ease curve.
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
    const frame = requestAnimationFrame(() => {
      anim = bouncy
        ? Animated.timing(progress, {
          toValue: 1,
          duration: 380,
          delay,
          easing: SILKY_EASE_OUT,
          useNativeDriver: true,
        })
        : Animated.timing(progress, {
          toValue: 1,
          duration: 300,
          delay,
          easing: SILKY_EASE_OUT,
          useNativeDriver: true,
        });
      anim.start();
    });
    const watchdog = setTimeout(() => {
      progress.stopAnimation();
      progress.setValue(1);
    }, delay + 580);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(watchdog);
      anim?.stop();
      progress.stopAnimation();
    };
  }, [bouncy, delay, progress, ready, reducedMotion]);

  const animatedStyle = useMemo(() => {
    const opacity = progress.interpolate({
      inputRange: [0, 0.65, 1],
      outputRange: [0, 1, 1],
      extrapolate: 'clamp',
    });
    const translateY = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [distance, 0],
      extrapolate: 'clamp',
    });
    const scale = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [scaleFrom, 1],
      extrapolate: 'clamp',
    });
    const transform = tiltFrom !== 0
      ? [
        { translateY },
        { scale },
        {
          rotate: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [`${tiltFrom}deg`, '0deg'],
            extrapolate: 'clamp',
          }),
        },
      ]
      : [{ translateY }, { scale }];
    return { opacity, transform };
  }, [distance, progress, scaleFrom, tiltFrom]);

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
