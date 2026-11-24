import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { createNativeLoop, SILKY_EASE_OUT } from '../motion/nativeMotion';
import { colors, radii } from '../theme';

export type LiquidProgressTone = 'studio' | 'warm' | 'lime' | 'dark';

const GRADIENT_STOPS: Record<LiquidProgressTone, readonly [string, string, string, string]> = {
  studio: ['#7C3CFF', '#5C9DFF', '#43D6E6', '#D8FF3E'],
  warm: ['#FF7B54', '#FF9F68', '#FFD447', '#FFE885'],
  lime: ['#4ED686', '#9BE83B', '#D8FF3E', '#E9FF82'],
  dark: ['#9158FF', '#5C9DFF', '#43D6E6', '#D8FF3E'],
};

type Props = {
  /** Normalized progress value in [0, 1]. */
  progress: number;
  height?: number;
  tone?: LiquidProgressTone;
  shimmer?: boolean;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Signature LaunchSplash liquid multi-stop gradient progress bar driven
 * exclusively by native-driver translateX transforms (zero per-frame width
 * relayouts, zero JS loop callbacks).
 */
export const LiquidProgressBar = memo(function LiquidProgressBar({
  progress,
  height = 8,
  tone = 'studio',
  shimmer = true,
  active = true,
  style,
}: Props) {
  const reducedMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, progress));
  const [trackWidth, setTrackWidth] = useState(0);
  const effectiveWidth = trackWidth > 0 ? trackWidth : 240;
  const fillAnim = useRef(new Animated.Value(clamped)).current;
  const sheenAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fillAnim.stopAnimation();
    if (reducedMotion || !active) {
      fillAnim.setValue(clamped);
      return undefined;
    }
    const anim = Animated.timing(fillAnim, {
      toValue: clamped,
      duration: 360,
      easing: SILKY_EASE_OUT,
      useNativeDriver: true,
    });
    anim.start();
    return () => {
      anim.stop();
      fillAnim.stopAnimation();
    };
  }, [active, clamped, fillAnim, reducedMotion]);

  useEffect(() => {
    if (!shimmer || !active || reducedMotion || clamped <= 0.04) {
      sheenAnim.stopAnimation();
      sheenAnim.setValue(0);
      return undefined;
    }
    const loop = createNativeLoop(sheenAnim, 2_800);
    loop.start();
    return () => {
      loop.stop();
      sheenAnim.stopAnimation();
    };
  }, [active, clamped, reducedMotion, sheenAnim, shimmer]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && Math.abs(next - trackWidth) >= 2) {
      setTrackWidth(next);
    }
  };

  const fillStyle = useMemo(() => ({
    transform: [
      {
        translateX: fillAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-effectiveWidth, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [effectiveWidth, fillAnim]);

  const sheenStyle = useMemo(() => ({
    opacity: sheenAnim.interpolate({
      inputRange: [0, 0.14, 0.56, 0.72, 1],
      outputRange: [0, 0.58, 0.58, 0, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: sheenAnim.interpolate({
          inputRange: [0, 0.72, 1],
          outputRange: [-46, effectiveWidth + 46, effectiveWidth + 46],
        }),
      },
      { skewX: '-22deg' },
    ],
  }), [effectiveWidth, sheenAnim]);

  const isDark = tone === 'dark';

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.track,
        { height, borderRadius: radii.pill },
        isDark && styles.trackDark,
        style,
      ]}
    >
      <Animated.View style={[styles.fillWrap, fillStyle]}>
        <LinearGradient
          colors={GRADIENT_STOPS[tone]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.fillGradient}
        />
        <View style={styles.topGloss} />
        {clamped > 0.04 ? <View style={styles.tipGlint} /> : null}
      </Animated.View>

      {shimmer && clamped > 0.04 ? (
        <Animated.View pointerEvents="none" style={[styles.sheen, sheenStyle]} />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: 'rgba(124, 60, 255, 0.11)',
    overflow: 'hidden',
    position: 'relative',
  },
  trackDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  fillWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  fillGradient: {
    width: '100%',
    height: '100%',
  },
  topGloss: {
    position: 'absolute',
    top: 1,
    left: 6,
    right: 6,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  tipGlint: {
    position: 'absolute',
    right: 1.5,
    top: 1.5,
    bottom: 1.5,
    width: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.paper,
    opacity: 0.85,
  },
  sheen: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    width: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.52)',
  },
});
