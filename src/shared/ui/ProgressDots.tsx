import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import * as Haptics from '../services/haptics';
import { colors, fonts } from '../theme';
import { Text } from './Typography';

type DotProps = {
  index: number;
  total: number;
  active: boolean;
  completed: boolean;
  reducedMotion: boolean;
  pulseSignal: number;
  onSelect?: (index: number) => void;
};

function StepPill({ index, total, active, completed, reducedMotion, pulseSignal, onSelect }: DotProps) {
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
      pop.setValue(0.3);
      Animated.spring(pop, {
        toValue: 1,
        tension: 260,
        friction: 14,
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
    outputRange: [0.94, 1.04],
  });
  const scaleX = pop.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1],
  });

  const dense = total > 5;
  const stepNumber = index + 1;
  const label = active
    ? (dense ? `#${stepNumber}` : `Pasul ${stepNumber}`)
    : completed
      ? '✓'
      : String(stepNumber);

  const fill = active ? colors.violet : completed ? colors.mint : colors.paper;
  const activeFlex = dense ? 1.85 : 2.35;

  return (
    <Animated.View
      collapsable={false}
      style={[
        styles.pill,
        {
          flex: active ? activeFlex : 1,
          backgroundColor: fill,
          borderColor: active || completed ? colors.ink : '#C7BBE3',
          borderBottomWidth: active ? 3 : completed ? 2.5 : 2,
          transform: [{ scaleX }, { scaleY }],
        },
      ]}
    >
      {(active || completed) ? <View pointerEvents="none" style={styles.pillShine} /> : null}
      <Text
        maxFontSizeMultiplier={1.1}
        numberOfLines={1}
        style={[
          styles.label,
          active ? styles.labelActive : completed ? styles.labelDone : styles.labelUpcoming,
        ]}
      >
        {label}
      </Text>
      {onSelect ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Mergi la pasul ${stepNumber}`}
          accessibilityState={{ selected: active }}
          hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
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
 * Interactive numbered comic step journey powered by native-driver GPU springs
 * (zero Reanimated worklets and zero per-frame Yoga flex recalculations).
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
        <StepPill
          key={index}
          index={index}
          total={total}
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
  pill: {
    minHeight: 24,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  pillShine: {
    position: 'absolute',
    top: 1.5,
    left: 6,
    right: 6,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    textAlignVertical: 'center',
    paddingHorizontal: 1,
  },
  labelActive: {
    color: colors.paper,
    letterSpacing: 0.2,
  },
  labelDone: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 11.5,
  },
  labelUpcoming: {
    color: colors.inkSoft,
  },
});
