import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { SILKY_EASE_OUT } from '../motion/nativeMotion';

type Props = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  distance?: number;
  scaleFrom?: number;
  tiltFrom?: number;
  bouncy?: boolean;
  ready?: boolean;
  /** Start at 0.01 opacity behind opaque overlays so Android HWUI pre-rasterizes textures before reveal. */
  preRasterize?: boolean;
  /** Promote to a temporary GPU hardware layer while entering so transforms move pre-baked textures. */
  hardwareLayer?: boolean;
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
  duration,
  distance = 16,
  scaleFrom = 0.94,
  tiltFrom = 0,
  bouncy = true,
  ready = true,
  preRasterize = false,
  hardwareLayer = false,
  style,
}: Props) {
  const reducedMotion = useReducedMotion();
  const played = useRef(reducedMotion);
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const resolvedDuration = duration ?? (bouncy ? 380 : 300);

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
      anim = Animated.timing(progress, {
        toValue: 1,
        duration: resolvedDuration,
        delay,
        easing: SILKY_EASE_OUT,
        useNativeDriver: true,
      });
      anim.start();
    });
    const watchdog = setTimeout(() => {
      progress.stopAnimation();
      progress.setValue(1);
    }, delay + resolvedDuration + 220);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(watchdog);
      anim?.stop();
      progress.stopAnimation();
    };
  }, [delay, progress, ready, reducedMotion, resolvedDuration]);

  const animatedStyle = useMemo(() => {
    const opacity = progress.interpolate({
      inputRange: [0, 0.58, 1],
      outputRange: [preRasterize ? 0.01 : 0, 1, 1],
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
  }, [distance, preRasterize, progress, scaleFrom, tiltFrom]);

  return (
    <Animated.View
      renderToHardwareTextureAndroid={hardwareLayer}
      style={[animatedStyle, style]}
    >
      {children}
    </Animated.View>
  );
}
