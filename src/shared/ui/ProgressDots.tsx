import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { borders, colors, radii, springs } from '../theme';

type DotProps = {
  active: boolean;
  completed: boolean;
  reducedMotion: boolean;
};

function Dot({ active, completed, reducedMotion }: DotProps) {
  const state = useSharedValue(active ? 2 : completed ? 1 : 0);

  useEffect(() => {
    const next = active ? 2 : completed ? 1 : 0;
    state.value = reducedMotion ? next : withSpring(next, springs.bouncy);
  }, [active, completed, reducedMotion, state]);

  const animated = useAnimatedStyle(() => {
    const activeFactor = Math.max(0, state.value - 1);
    return {
      flex: 1 + activeFactor * 0.85,
      backgroundColor: interpolateColor(
        state.value,
        [0, 1, 2],
        [colors.line, colors.mint, colors.violet],
      ),
      transform: [{ scaleY: 1 + activeFactor * 0.16 }],
    };
  });

  return <Animated.View style={[styles.dot, animated]} />;
}

type Props = {
  total: number;
  current: number;
  style?: StyleProp<ViewStyle>;
};

export function ProgressDots({ total, current, style }: Props) {
  const reducedMotion = useReducedMotion();
  if (total <= 0) return null;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: Math.min(total, current + 1) }}
      style={[styles.row, style]}
    >
      {Array.from({ length: total }).map((_, index) => (
        <Dot
          key={index}
          active={index === current}
          completed={index < current}
          reducedMotion={reducedMotion}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    height: 10,
    borderRadius: radii.pill,
    borderWidth: borders.thin,
    borderColor: colors.ink,
  },
});
