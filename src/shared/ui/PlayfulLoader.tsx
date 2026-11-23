import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors, fonts } from '../theme';
import { Text } from './Typography';

type Props = {
  label?: string;
  note?: string;
  inverse?: boolean;
  compact?: boolean;
  micro?: boolean;
  style?: StyleProp<ViewStyle>;
};

const dotColors = [colors.lime, colors.peach, colors.cyan] as const;

function BounceDot({
  color,
  index,
  compact,
  micro,
  reducedMotion,
}: {
  color: string;
  index: number;
  compact: boolean;
  micro: boolean;
  reducedMotion: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.stopAnimation();
    if (reducedMotion) {
      progress.setValue(0);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 260,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(250),
      ]),
    );

    const startTimer = index > 0
      ? setTimeout(() => { loop.start(); }, index * 110)
      : null;
    if (index === 0) loop.start();

    return () => {
      if (startTimer) clearTimeout(startTimer);
      loop.stop();
      progress.setValue(0);
    };
  }, [index, progress, reducedMotion]);

  const hop = micro ? 3 : compact ? 5 : 7;
  const maxBoost = hop / 28;
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -hop],
  });
  const scaleX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1 - maxBoost * 0.4],
  });
  const scaleY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1 + maxBoost * 0.6],
  });

  return (
    <Animated.View
      style={[
        styles.dotShadow,
        compact && styles.dotShadowCompact,
        micro && styles.dotShadowMicro,
        {
          transform: [
            { translateY },
            { scaleX },
            { scaleY },
          ],
        },
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

/** Branded comic three-dot loader running on native-driver Animated with zero Reanimated overhead. */
export function PlayfulLoader({
  label,
  note,
  inverse = false,
  compact = false,
  micro = false,
  style,
}: Props) {
  const reducedMotion = useReducedMotion();

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
            color={color}
            index={index}
            compact={compact}
            micro={micro}
            reducedMotion={reducedMotion}
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
  root: { alignItems: 'center', justifyContent: 'center' },
  rootCompact: { flexDirection: 'row', gap: 9 },
  dots: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dotsCompact: { height: 26, gap: 5 },
  dotsMicro: { height: 18, gap: 3 },
  dotShadow: { width: 22, height: 25, borderRadius: 8, backgroundColor: colors.ink, paddingBottom: 3 },
  dotShadowCompact: { width: 15, height: 17, borderRadius: 5, paddingBottom: 2 },
  dotShadowMicro: { width: 8, height: 10, borderRadius: 3, paddingBottom: 1 },
  dot: { flex: 1, borderWidth: 2, borderColor: colors.ink, borderRadius: 7 },
  dotCompact: { borderWidth: 1.5, borderRadius: 5 },
  dotMicro: { borderWidth: 1, borderRadius: 3 },
  label: { marginTop: 7, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 13, lineHeight: 17, textAlign: 'center' },
  labelCompact: { marginTop: 0, fontSize: 12, lineHeight: 16 },
  labelInverse: { color: colors.paper },
  note: { maxWidth: 280, marginTop: 3, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  noteInverse: { color: '#D3CBEB' },
});
