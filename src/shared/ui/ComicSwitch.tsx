import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme';
import { CachedInsetRelief, CachedSurface } from './CachedRelief';

type Props = {
  value: boolean;
};

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 30;
const KNOB_SIZE = 24;
const TRAVEL = TRACK_WIDTH - 6 - KNOB_SIZE;

const TRACK_RECESS_OFF = 'inset 0 2px 5px rgba(66, 22, 178, 0.18), inset 0 -1.5px 3px rgba(255, 255, 255, 0.9)';
const TRACK_RECESS_ON = 'inset 0 2px 5px rgba(22, 4, 72, 0.34), inset 0 -1.5px 3px rgba(255, 255, 255, 0.28)';
const KNOB_SURFACE = '0 2px 5px rgba(26, 12, 76, 0.26), inset 0 2px 3px rgba(255, 255, 255, 1), inset 0 -2px 3px rgba(102, 58, 214, 0.16)';

/**
 * Sculpted 3D Liquid-Glass studio toggle switch driven by native-driver spring motion.
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
      {value ? (
        <LinearGradient
          pointerEvents="none"
          colors={['#8F50FF', '#6722EE', '#4B12BF']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <CachedInsetRelief
        borderRadius={TRACK_HEIGHT / 2}
        shadow={value ? TRACK_RECESS_ON : TRACK_RECESS_OFF}
        zIndex={0}
      />
      <Animated.View style={[styles.knob, knobAnimatedStyle]}>
        <CachedSurface
          borderRadius={KNOB_SIZE / 2}
          backgroundColor={colors.paper}
          shadow={KNOB_SURFACE}
          padTop={4}
          padX={6}
          padBottom={8}
        />
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
    borderColor: '#E4DAFA',
    backgroundColor: '#EAE3F8',
    paddingHorizontal: 3,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  trackActive: {
    borderColor: 'rgba(255, 255, 255, 0.34)',
    backgroundColor: colors.violet,
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
  },
  knobDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D6CCE9',
    zIndex: 2,
  },
  knobDotActive: {
    backgroundColor: colors.limeDeep,
  },
});
