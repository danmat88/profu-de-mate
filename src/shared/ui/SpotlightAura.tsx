import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { createNativeLoop } from '../motion/nativeMotion';
import { colors } from '../theme';

export type SpotlightAuraTone = 'violet' | 'lime' | 'peach' | 'rose' | 'cyan' | 'dark' | 'onViolet';

const PALETTES: Record<
  SpotlightAuraTone,
  { outer: string; mid: string; core: string; ring: string; beadA: string; beadB: string }
> = {
  violet: {
    outer: 'rgba(124, 60, 255, 0.085)',
    mid: 'rgba(124, 60, 255, 0.13)',
    core: 'rgba(255, 255, 255, 0.88)',
    ring: 'rgba(124, 60, 255, 0.24)',
    beadA: colors.lime,
    beadB: colors.cyan,
  },
  lime: {
    outer: 'rgba(216, 255, 62, 0.22)',
    mid: 'rgba(124, 60, 255, 0.09)',
    core: 'rgba(255, 255, 255, 0.9)',
    ring: 'rgba(86, 120, 0, 0.24)',
    beadA: colors.lime,
    beadB: colors.violet,
  },
  peach: {
    outer: 'rgba(255, 141, 107, 0.14)',
    mid: 'rgba(255, 212, 71, 0.16)',
    core: 'rgba(255, 255, 255, 0.88)',
    ring: 'rgba(255, 141, 107, 0.3)',
    beadA: colors.gold,
    beadB: colors.peach,
  },
  rose: {
    outer: 'rgba(255, 87, 109, 0.12)',
    mid: 'rgba(255, 87, 109, 0.16)',
    core: 'rgba(255, 255, 255, 0.88)',
    ring: 'rgba(255, 87, 109, 0.28)',
    beadA: colors.rose,
    beadB: colors.peach,
  },
  cyan: {
    outer: 'rgba(67, 214, 230, 0.14)',
    mid: 'rgba(124, 60, 255, 0.09)',
    core: 'rgba(255, 255, 255, 0.9)',
    ring: 'rgba(18, 125, 140, 0.24)',
    beadA: colors.cyan,
    beadB: colors.lime,
  },
  dark: {
    outer: 'rgba(124, 60, 255, 0.2)',
    mid: 'rgba(67, 214, 230, 0.12)',
    core: 'rgba(255, 255, 255, 0.08)',
    ring: 'rgba(216, 255, 62, 0.28)',
    beadA: colors.lime,
    beadB: colors.cyan,
  },
  onViolet: {
    outer: 'rgba(255, 255, 255, 0.11)',
    mid: 'rgba(255, 255, 255, 0.16)',
    core: 'rgba(255, 255, 255, 0.22)',
    ring: 'rgba(216, 255, 62, 0.34)',
    beadA: colors.lime,
    beadB: colors.cyan,
  },
};

type Props = {
  size: number;
  tone?: SpotlightAuraTone;
  orbit?: boolean;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Concentric radial studio spotlight and delicate native-driver orbit ring
 * shared directly from LaunchSplash so every mascot spotlight feels born from
 * the exact same studio world at 60fps with zero elevation overdraw.
 */
export const SpotlightAura = memo(function SpotlightAura({
  size,
  tone = 'violet',
  orbit = true,
  active = true,
  style,
}: Props) {
  const reducedMotion = useReducedMotion();
  const spin = useRef(new Animated.Value(0)).current;
  const palette = PALETTES[tone];
  const midSize = Math.round(size * 0.78);
  const coreSize = Math.round(size * 0.56);
  const ringSize = Math.max(24, size - 6);
  const beadSize = size >= 110 ? 7 : 5.5;

  useEffect(() => {
    if (!orbit || !active || reducedMotion) {
      spin.stopAnimation();
      return undefined;
    }
    const loop = createNativeLoop(spin, 26_000);
    loop.start();
    return () => {
      loop.stop();
      spin.stopAnimation();
    };
  }, [active, orbit, reducedMotion, spin]);

  const orbitStyle = useMemo(() => ({
    transform: [
      {
        rotate: spin.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  }), [spin]);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.center,
        { width: size, height: size },
        style,
      ]}
    >
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: palette.outer,
          },
        ]}
      >
        <View
          style={[
            styles.circle,
            {
              width: midSize,
              height: midSize,
              borderRadius: midSize / 2,
              backgroundColor: palette.mid,
            },
          ]}
        >
          <View
            style={{
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
              backgroundColor: palette.core,
            }}
          />
        </View>
      </View>

      {orbit ? (
        <Animated.View
          style={[
            styles.ring,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderColor: palette.ring,
            },
            orbitStyle,
          ]}
        >
          <View
            style={[
              styles.beadTop,
              {
                width: beadSize,
                height: beadSize,
                borderRadius: beadSize / 2,
                top: -beadSize / 2,
                backgroundColor: palette.beadA,
              },
            ]}
          />
          <View
            style={[
              styles.beadRight,
              {
                width: beadSize * 0.85,
                height: beadSize * 0.85,
                borderRadius: beadSize / 2,
                right: -beadSize * 0.42,
                backgroundColor: palette.beadB,
              },
            ]}
          />
        </Animated.View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.25,
    borderStyle: 'dashed',
  },
  beadTop: {
    position: 'absolute',
    left: '50%',
    marginLeft: -3,
  },
  beadRight: {
    position: 'absolute',
    top: '56%',
  },
});
