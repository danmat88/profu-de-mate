import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme';

type Props = {
  value: boolean;
};

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 30;
const KNOB_SIZE = 24;
const TRAVEL = TRACK_WIDTH - 6 - KNOB_SIZE;

/**
 * Refined modern studio toggle switch driven by native-driver spring motion.
 */
export function ComicSwitch({ value }: Props) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;
  const previousValue = useRef(value);

  useEffect(() => {
    if (previousValue.current === value) return undefined;
    previousValue.current = value;
    const next = value ? 1 : 0;
    progress.stopAnimation();
    if (reducedMotion) {
      progress.setValue(next);
      return undefined;
    }
    Animated.spring(progress, {
      toValue: next,
      tension: 260,
      friction: 18,
      useNativeDriver: true,
    }).start();
    return () => {
      progress.stopAnimation();
    };
  }, [progress, reducedMotion, value]);

  const knobAnimatedStyle = useMemo(() => ({
    transform: [
      {
        translateX: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, TRAVEL],
        }),
      },
      {
        scale: progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 1.08, 1],
        }),
      },
    ],
  }), [progress]);

  return (
    <View style={[styles.track, value && styles.trackActive]}>
      <Animated.View style={[styles.knob, knobAnimatedStyle]}>
        <View style={[styles.knobDot, value && styles.knobDotActive]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: 1,
    borderColor: '#DDD2F3',
    backgroundColor: '#EAE3F8',
    paddingHorizontal: 3,
    justifyContent: 'center',
  },
  trackActive: {
    borderColor: 'rgba(124, 60, 255, 0.25)',
    backgroundColor: colors.violet,
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#261758',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
  },
  knobDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D6CCE9',
  },
  knobDotActive: {
    backgroundColor: colors.limeDeep,
  },
});
