import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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

export function PlayfulLoader({ label, note, inverse = false, compact = false, micro = false, style }: Props) {
  const reducedMotion = useReducedMotion();
  const motion = useRef(dotColors.map(() => new Animated.Value(reducedMotion ? 1 : 0))).current;

  useEffect(() => {
    if (reducedMotion) {
      motion.forEach((value) => value.setValue(1));
      return;
    }

    const animation = Animated.loop(Animated.sequence([
      Animated.stagger(90, motion.map((value) => Animated.spring(value, {
        toValue: 1,
        speed: 22,
        bounciness: 10,
        useNativeDriver: true,
      }))),
      Animated.delay(170),
      Animated.stagger(70, motion.map((value) => Animated.timing(value, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }))),
      Animated.delay(90),
    ]));
    animation.start();
    return () => animation.stop();
  }, [motion, reducedMotion]);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Se încarcă'}
      style={[styles.root, (compact || micro) && styles.rootCompact, style]}
    >
      <View style={[styles.dots, compact && styles.dotsCompact, micro && styles.dotsMicro]}>
        {motion.map((value, index) => (
          <Animated.View
            key={dotColors[index]}
            style={[
              styles.dotShadow,
              compact && styles.dotShadowCompact,
              micro && styles.dotShadowMicro,
              {
                opacity: reducedMotion ? 1 : value.interpolate({ inputRange: [0, 1], outputRange: [0.46, 1] }),
                transform: [
                  { translateY: reducedMotion ? 0 : value.interpolate({ inputRange: [0, 1], outputRange: [3, -4] }) },
                  { rotate: index === 0 ? '-7deg' : index === 1 ? '4deg' : '-2deg' },
                  { scale: reducedMotion ? 1 : value.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
                ],
              },
            ]}
          >
            <View style={[styles.dot, compact && styles.dotCompact, micro && styles.dotMicro, { backgroundColor: dotColors[index] }]} />
          </Animated.View>
        ))}
      </View>
      {label ? <Text style={[styles.label, inverse && styles.labelInverse, (compact || micro) && styles.labelCompact]}>{label}</Text> : null}
      {note && !compact && !micro ? <Text style={[styles.note, inverse && styles.noteInverse]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  rootCompact: { flexDirection: 'row', gap: 9 },
  dots: { height: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  dotsCompact: { height: 25, gap: 4 },
  dotsMicro: { height: 15, gap: 2 },
  dotShadow: { width: 23, height: 25, borderRadius: 8, backgroundColor: colors.ink, paddingBottom: 3 },
  dotShadowCompact: { width: 15, height: 17, borderRadius: 5, paddingBottom: 2 },
  dotShadowMicro: { width: 8, height: 10, borderRadius: 3, paddingBottom: 1 },
  dot: { flex: 1, borderWidth: 2, borderColor: colors.ink, borderRadius: 7 },
  dotCompact: { borderWidth: 1.5, borderRadius: 5 },
  dotMicro: { borderWidth: 1, borderRadius: 3 },
  label: { marginTop: 7, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12.5, lineHeight: 16, textAlign: 'center' },
  labelCompact: { marginTop: 0, fontSize: 11.5, lineHeight: 15 },
  labelInverse: { color: colors.paper },
  note: { maxWidth: 280, marginTop: 3, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 11.5, lineHeight: 16, textAlign: 'center' },
  noteInverse: { color: '#BDB4D5' },
});
