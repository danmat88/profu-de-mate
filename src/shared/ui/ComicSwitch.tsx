import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { borders, colors } from '../theme';

type Props = {
  value: boolean;
};

const TRACK_WIDTH = 54;
const TRACK_HEIGHT = 32;
const KNOB_SIZE = 22;
const TRAVEL = TRACK_WIDTH - borders.thin * 2 - 6 - KNOB_SIZE;

/**
 * Bouncy comic toggle switch driven by native-driver spring motion and React
 * colors so Settings mounts with zero Reanimated worklet overhead.
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
      friction: 16,
      useNativeDriver: true,
    }).start();
    return () => {
      progress.stopAnimation();
    };
  }, [progress, reducedMotion, value]);

  const knobTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRAVEL],
  });
  const knobScale = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.1, 1],
  });

  return (
    <View style={styles.outer}>
      <View pointerEvents="none" style={styles.shadow} />
      <View style={[styles.track, value && styles.trackActive]}>
        <View pointerEvents="none" style={styles.shine} />
        <Animated.View
          style={[
            styles.knob,
            {
              transform: [
                { translateX: knobTranslateX },
                { scale: knobScale },
              ],
            },
          ]}
        >
          <View style={[styles.knobDot, value && styles.knobDotActive]} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT + 2,
    paddingBottom: 2,
    position: 'relative',
  },
  shadow: {
    position: 'absolute',
    top: 2,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.ink,
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.line,
    paddingHorizontal: 3,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackActive: {
    backgroundColor: colors.lime,
  },
  shine: {
    position: 'absolute',
    top: 2,
    left: 8,
    right: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.shine,
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.line,
  },
  knobDotActive: {
    backgroundColor: colors.violet,
  },
});
