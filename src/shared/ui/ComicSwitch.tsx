import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { borders, colors, springs } from '../theme';

type Props = {
  value: boolean;
};

const TRACK_WIDTH = 54;
const TRACK_HEIGHT = 32;
const KNOB_SIZE = 22;
const TRAVEL = TRACK_WIDTH - borders.thin * 2 - 6 - KNOB_SIZE;

/** Bouncy comic toggle switch with Reanimated spring travel & color morph. */
export function ComicSwitch({ value }: Props) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    const next = value ? 1 : 0;
    if (reducedMotion) {
      progress.set(next);
    } else {
      progress.set(withSpring(next, springs.bouncy));
    }
  }, [progress, reducedMotion, value]);

  const trackAnimated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [colors.line, colors.lime]),
  }));

  const knobAnimated = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      transform: [
        { translateX: p * TRAVEL },
        { scale: 1 + Math.sin(p * Math.PI) * 0.1 },
      ],
    };
  });

  const dotAnimated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [colors.line, colors.violet]),
  }));

  return (
    <View style={styles.outer}>
      <View pointerEvents="none" style={styles.shadow} />
      <Animated.View style={[styles.track, trackAnimated]}>
        <View pointerEvents="none" style={styles.shine} />
        <Animated.View style={[styles.knob, knobAnimated]}>
          <Animated.View style={[styles.knobDot, dotAnimated]} />
        </Animated.View>
      </Animated.View>
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
    paddingHorizontal: 3,
    justifyContent: 'center',
    overflow: 'hidden',
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
  },
});
