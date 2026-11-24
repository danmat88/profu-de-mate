import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTransitionMotion } from '../context/TransitionMotionContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { createNativeLoop } from '../motion/nativeMotion';
import { colors, fonts } from '../theme';
import { Text } from './Typography';

type Props = {
  label?: string;
  note?: string;
  inverse?: boolean;
  compact?: boolean;
  micro?: boolean;
  /** Pauses bounce loops when false or while a stack transition is running. */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
};

const dotColors = [colors.lime, colors.peach, colors.cyan] as const;

function BounceDot({
  phase,
  color,
  index,
  compact,
  micro,
}: {
  phase: Animated.Value;
  color: string;
  index: number;
  compact: boolean;
  micro: boolean;
}) {
  const hop = micro ? 3 : compact ? 5 : 7;
  const maxBoost = hop / 28;

  const animatedStyle = useMemo(() => {
    const start = index * 0.16;
    const peak = start + 0.22;
    const end = start + 0.48;
    const inputRange = start > 0 ? [0, start, peak, end, 1] : [0, peak, end, 1];
    const yOut = start > 0 ? [0, 0, -hop, 0, 0] : [0, -hop, 0, 0];
    const sxOut = start > 0 ? [1, 1, 1 - maxBoost * 0.4, 1, 1] : [1, 1 - maxBoost * 0.4, 1, 1];
    const syOut = start > 0 ? [1, 1, 1 + maxBoost * 0.6, 1, 1] : [1, 1 + maxBoost * 0.6, 1, 1];
    return {
      transform: [
        { translateY: phase.interpolate({ inputRange, outputRange: yOut, extrapolate: 'clamp' }) },
        { scaleX: phase.interpolate({ inputRange, outputRange: sxOut, extrapolate: 'clamp' }) },
        { scaleY: phase.interpolate({ inputRange, outputRange: syOut, extrapolate: 'clamp' }) },
      ],
    };
  }, [hop, index, maxBoost, phase]);

  return (
    <Animated.View
      style={[
        styles.dotShadow,
        compact && styles.dotShadowCompact,
        micro && styles.dotShadowMicro,
        animatedStyle,
      ]}
    >
      <View
        style={[
          styles.dot,
          compact && styles.dotCompact,
          micro && styles.dotMicro,
          { backgroundColor: color },
        ]}
      />
    </Animated.View>
  );
}

/**
 * Branded comic three-dot loader powered by one shared pure-native RenderThread
 * loop (_startNativeLoop(-1), zero JS callbacks, zero Reanimated overhead).
 */
export function PlayfulLoader({
  label,
  note,
  inverse = false,
  compact = false,
  micro = false,
  active = true,
  style,
}: Props) {
  const reducedMotion = useReducedMotion();
  const { isTransitioning } = useTransitionMotion(active && !reducedMotion);
  const animate = active && !reducedMotion && !isTransitioning;
  const phase = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    phase.stopAnimation();
    if (!animate) {
      phase.setValue(0);
      return undefined;
    }
    const loop = createNativeLoop(phase, 920);
    loop.start();
    return () => {
      loop.stop();
      phase.stopAnimation();
      phase.setValue(0);
    };
  }, [animate, phase]);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Se încarcă'}
      style={[styles.root, (compact || micro) && styles.rootCompact, style]}
    >
      <View style={[styles.dots, compact && styles.dotsCompact, micro && styles.dotsMicro]}>
        {dotColors.map((color, index) => (
          <BounceDot
            key={color}
            phase={phase}
            color={color}
            index={index}
            compact={compact}
            micro={micro}
          />
        ))}
      </View>
      {label ? (
        <Text style={[styles.label, inverse && styles.labelInverse, (compact || micro) && styles.labelCompact]}>
          {label}
        </Text>
      ) : null}
      {note && !compact && !micro ? (
        <Text style={[styles.note, inverse && styles.noteInverse]}>{note}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  rootCompact: { gap: 6 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 26 },
  dotsCompact: { gap: 7, height: 20 },
  dotsMicro: { gap: 4, height: 14 },
  dotShadow: {
    borderRadius: 9,
    backgroundColor: colors.ink,
    paddingBottom: 2,
  },
  dotShadowCompact: {
    borderRadius: 7,
    paddingBottom: 1.5,
  },
  dotShadowMicro: {
    borderRadius: 5,
    paddingBottom: 1,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  dotCompact: { width: 11, height: 11, borderRadius: 6, borderWidth: 1.8 },
  dotMicro: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.4 },
  label: { fontFamily: fonts.display, color: colors.ink, fontSize: 16, textAlign: 'center' },
  labelInverse: { color: colors.paper },
  labelCompact: { fontSize: 13.5 },
  note: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 280,
  },
  noteInverse: { color: '#D3CCE8' },
});
