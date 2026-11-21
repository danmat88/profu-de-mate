import { useEffect } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';
import * as Haptics from '../services/haptics';
import { borders, colors, radii, springs } from '../theme';

type DotProps = {
  index: number;
  active: boolean;
  completed: boolean;
  reducedMotion: boolean;
  onSelect?: (index: number) => void;
};

function Dot({ index, active, completed, reducedMotion, onSelect }: DotProps) {
  const state = useSharedValue(active ? 2 : completed ? 1 : 0);

  useEffect(() => {
    const next = active ? 2 : completed ? 1 : 0;
    state.set(reducedMotion ? next : withSpring(next, springs.bouncy));
  }, [active, completed, reducedMotion, state]);

  const animated = useAnimatedStyle(() => {
    const value = state.get();
    const activeFactor = Math.max(0, value - 1);
    return {
      flex: 1 + activeFactor * 0.9,
      backgroundColor: interpolateColor(
        value,
        [0, 1, 2],
        [colors.line, colors.mint, colors.violet],
      ),
      transform: [{ scaleY: 1 + activeFactor * 0.22 }],
    };
  });

  if (!onSelect) {
    return (
      <Animated.View style={[styles.dot, animated]}>
        {(active || completed) ? <View pointerEvents="none" style={styles.dotShine} /> : null}
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.dot, animated]}>
      {(active || completed) ? <View pointerEvents="none" style={styles.dotShine} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mergi la pasul ${index + 1}`}
        accessibilityState={{ selected: active }}
        hitSlop={{ top: 10, bottom: 10, left: 2, right: 2 }}
        onPress={() => {
          if (active) return;
          Haptics.selection();
          onSelect(index);
        }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

type Props = {
  total: number;
  current: number;
  onSelectStep?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
};

export function ProgressDots({ total, current, onSelectStep, style }: Props) {
  const reducedMotion = useReducedMotion();
  if (total <= 0) return null;

  return (
    <View
      accessible={!onSelectStep}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: Math.min(total, current + 1) }}
      style={[styles.row, style]}
    >
      {Array.from({ length: total }).map((_, index) => (
        <Dot
          key={index}
          index={index}
          active={index === current}
          completed={index < current}
          reducedMotion={reducedMotion}
          onSelect={onSelectStep}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 9,
    borderRadius: radii.pill,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    overflow: 'hidden',
  },
  dotShine: {
    position: 'absolute',
    top: 1,
    left: 4,
    right: 4,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.shine,
  },
});
