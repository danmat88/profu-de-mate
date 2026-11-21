import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
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
  const lift = useSharedValue(reducedMotion ? 0 : 0);

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(lift);
      lift.value = 0;
      return;
    }

    const hop = micro ? 3 : compact ? 5 : 7;
    lift.value = withDelay(
      index * 110,
      withRepeat(
        withSequence(
          withTiming(-hop, { duration: 240, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) }),
          withDelay(240, withTiming(0, { duration: 10 })),
        ),
        -1,
        false,
      ),
    );

    return () => cancelAnimation(lift);
  }, [compact, index, lift, micro, reducedMotion]);

  const animated = useAnimatedStyle(() => {
    const scaleBoost = Math.abs(lift.value) / 28;
    return {
      transform: [
        { translateY: lift.value },
        { scaleX: 1 - scaleBoost * 0.4 },
        { scaleY: 1 + scaleBoost * 0.6 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.dotShadow,
        compact && styles.dotShadowCompact,
        micro && styles.dotShadowMicro,
        animated,
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
