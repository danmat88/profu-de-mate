import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';
import * as Haptics from '../services/haptics';
import { colors, radii, springs } from '../theme';

export type PressHaptic = 'none' | 'selection' | 'light' | 'medium';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Extruded 3D comic base height in dp. Pass 0 for flat scale-only press. */
  depth?: number;
  /** Border radius of the extruded comic shadow base. */
  radius?: number;
  /** Fill color of the extruded comic shadow base. */
  shadowColor?: string;
  /** Scale factor when pressed in flat mode (depth === 0). */
  pressedScale?: number;
  haptic?: PressHaptic;
  /** Dim control opacity when disabled (default true). Set false for crisp transient locks. */
  dimWhenDisabled?: boolean;
  /** Optional micro-delay (ms) after tap so the rebound spring completes visibly before navigation. */
  deferPressMs?: number;
};

function triggerHaptic(kind: PressHaptic) {
  if (kind === 'selection') Haptics.selection();
  else if (kind === 'light') Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
  else if (kind === 'medium') Haptics.impact(Haptics.ImpactFeedbackStyle.Medium);
}

/**
 * Tactile cartoon press container powered by Reanimated springs.
 * When `depth > 0`, renders a solid extruded 3D comic base and physically
 * squashes the face down into the base on press, rebounding with spring bounce.
 */
export function PressableScale({
  children,
  style,
  contentStyle,
  depth = 0,
  radius = radii.lg,
  shadowColor = colors.ink,
  pressedScale = 0.96,
  haptic = 'none',
  dimWhenDisabled = true,
  deferPressMs = 0,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const reducedMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const deferTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reducedMotion) pressed.set(0);
  }, [pressed, reducedMotion]);

  useEffect(() => () => {
    if (deferTimer.current) clearTimeout(deferTimer.current);
  }, []);

  const animatedFace = useAnimatedStyle(() => {
    const p = pressed.get();
    if (depth > 0) {
      return {
        transform: [
          { translateY: p * Math.max(2, depth - 1) },
          { scale: 1 - p * 0.018 },
        ],
      };
    }
    return {
      transform: [{ scale: 1 - p * (1 - pressedScale) }],
    };
  }, [depth, pressedScale]);

  const handlePressIn: PressableProps['onPressIn'] = (event) => {
    if (!disabled && !reducedMotion) {
      pressed.set(withSpring(1, springs.press));
    }
    onPressIn?.(event);
  };

  const handlePressOut: PressableProps['onPressOut'] = (event) => {
    if (!reducedMotion) {
      pressed.set(withSpring(0, springs.bouncy));
    }
    onPressOut?.(event);
  };

  const handlePress: PressableProps['onPress'] = (event) => {
    if (disabled || deferTimer.current) return;
    triggerHaptic(haptic);
    if (!onPress) return;
    if (deferPressMs > 0 && !reducedMotion) {
      deferTimer.current = setTimeout(() => {
        deferTimer.current = null;
        onPress(event);
      }, deferPressMs);
      return;
    }
    onPress(event);
  };

  return (
    <View
      style={[
        styles.wrap,
        depth > 0 && { paddingBottom: depth },
        disabled && dimWhenDisabled && styles.disabled,
        style,
      ]}
    >
      {depth > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.base,
            { top: depth, borderRadius: radius, backgroundColor: shadowColor },
          ]}
        />
      ) : null}
      <Animated.View style={[styles.faceWrap, animatedFace]}>
        <Pressable
          {...rest}
          disabled={disabled}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePress}
          style={({ pressed: isPressed }) => [
            contentStyle,
            reducedMotion && isPressed && styles.reducedPressed,
          ]}
        >
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', minWidth: 0 },
  base: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  faceWrap: { minWidth: 0 },
  disabled: { opacity: 0.5 },
  reducedPressed: { opacity: 0.88 },
});
