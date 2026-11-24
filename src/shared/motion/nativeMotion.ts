import { Animated, Easing } from 'react-native';

/**
 * Unified critically-damped curves giving every screen, sheet, and control in
 * the app the exact same calm, snappy, zero-wobble motion signature.
 */
export const SILKY_EASE_OUT = Easing.out(Easing.cubic);
export const SILKY_EASE_IN = Easing.in(Easing.cubic);
export const SILKY_EASE_IN_OUT = Easing.inOut(Easing.cubic);

/**
 * 17-point normalized phase samples [0..1] used with a single linear
 * Animated.timing inside Animated.loop so Android NativeAnimatedModule runs
 * _startNativeLoop(-1) directly on RenderThread with zero JS callbacks.
 */
export const WAVE_INPUT_17: number[] = [
  0, 0.0625, 0.125, 0.1875, 0.25, 0.3125, 0.375, 0.4375,
  0.5, 0.5625, 0.625, 0.6875, 0.75, 0.8125, 0.875, 0.9375, 1,
];

/** Smooth periodic sine wave: center + sin(2*PI*t + phaseRad) * amplitude. */
export function sineWaveRange(amplitude: number, center = 0, phaseRad = 0): number[] {
  return WAVE_INPUT_17.map((t) => center + Math.sin(2 * Math.PI * t + phaseRad) * amplitude);
}

/** Smooth periodic ping-pong wave from min -> max -> min with zero endpoint velocity. */
export function cosinePingPongRange(min: number, max: number): number[] {
  const mid = (min + max) / 2;
  const half = (max - min) / 2;
  return WAVE_INPUT_17.map((t) => mid - Math.cos(2 * Math.PI * t) * half);
}

/** Smooth periodic breathing pulse from min -> max -> min. */
export function cosinePulseRange(min: number, max: number): number[] {
  return WAVE_INPUT_17.map((t) => min + (max - min) * (0.5 - 0.5 * Math.cos(2 * Math.PI * t)));
}

/** Smooth periodic rotation range in degrees for gentle sway animations. */
export function sineDegreeRange(amplitudeDeg: number, phaseRad = 0): string[] {
  return WAVE_INPUT_17.map((t) => `${(Math.sin(2 * Math.PI * t + phaseRad) * amplitudeDeg).toFixed(2)}deg`);
}

/**
 * Starts a guaranteed pure-native infinite loop (Android _startNativeLoop(-1))
 * by wrapping a single linear Animated.timing directly inside Animated.loop.
 */
export function createNativeLoop(
  phase: Animated.Value,
  duration: number,
  initialPhase = 0,
): Animated.CompositeAnimation {
  phase.setValue(initialPhase);
  return Animated.loop(
    Animated.timing(phase, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    }),
  );
}
