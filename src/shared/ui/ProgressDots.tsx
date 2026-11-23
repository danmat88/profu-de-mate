import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import * as Haptics from '../services/haptics';
import { borders, colors, radii } from '../theme';

type DotProps = {
  index: number;
  active: boolean;
  completed: boolean;
  reducedMotion: boolean;
  pulseSignal: number;
  onSelect?: (index: number) => void;
};

function Dot({ index, active, completed, reducedMotion, pulseSignal, onSelect }: DotProps) {
  const pop = useRef(new Animated.Value(active ? 1 : 0)).current;
  const previousActive = useRef(active);
  const previousPulse = useRef(pulseSignal);

  useEffect(() => {
    const becameActive = active && !previousActive.current;
    const pulsedWhileActive = active && pulseSignal !== previousPulse.current;
    previousActive.current = active;
    previousPulse.current = pulseSignal;

    pop.stopAnimation();
    if (reducedMotion) {
      pop.setValue(active ? 1 : 0);
      return undefined;
    }

    if (becameActive || pulsedWhileActive) {
      pop.setValue(0.35);
      Animated.spring(pop, {
        toValue: 1,
        tension: 260,
        friction: 15,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(pop, {
        toValue: active ? 1 : 0,
        tension: 240,
        friction: 22,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      pop.stopAnimation();
    };
  }, [active, pop, pulseSignal, reducedMotion]);

  const scaleY = pop.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.24],
  });

  const fill = active ? colors.violet : completed ? colors.mint : colors.line;

  return (
    <Animated.View
      style={[
        styles.dot,
        active ? styles.dotActive : styles.dotRest,
        { backgroundColor: fill, transform: [{ scaleY }] },
      ]}
    >
      {(active || completed) ? <View pointerEvents="none" style={styles.dotShine} /> : null}
      {onSelect ? (
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
      ) : null}
    </Animated.View>
  );
}

type Props = {
  total: number;
  current: number;
  /** Increment to give the active step pill a joyful arrival spring pop. */
  pulseSignal?: number;
  onSelectStep?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Zero-worklet comic step indicator powered by native-driver GPU springs so
 * initial Lesson mounts never trigger per-frame Yoga flex recalculations.
 */
export function ProgressDots({ total, current, pulseSignal = 0, onSelectStep, style }: Props) {
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
          pulseSignal={pulseSignal}
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
  dotRest: {
    flex: 1,
  },
  dotActive: {
    flex: 1.9,
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
