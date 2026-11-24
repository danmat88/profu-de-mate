import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import * as Haptics from '../services/haptics';

export type PressHaptic = 'none' | 'selection' | 'light' | 'medium';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Legacy visual depth hint (maps to gentle tactile press scale). */
  depth?: number;
  /** Legacy border radius hint kept for caller compatibility. */
  radius?: number;
  /** Legacy shadow color hint kept for caller compatibility. */
  shadowColor?: string;
  /** Scale factor when pressed. */
  pressedScale?: number;
  haptic?: PressHaptic;
  /** Dim control opacity when disabled (default true). Set false for crisp transient locks. */
  dimWhenDisabled?: boolean;
  /** Optional micro-delay (ms) after tap before invoking onPress. */
  deferPressMs?: number;
};

function triggerHaptic(kind: PressHaptic) {
  if (kind === 'selection') Haptics.selection();
  else if (kind === 'light') Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
  else if (kind === 'medium') Haptics.impact(Haptics.ImpactFeedbackStyle.Medium);
}

/**
 * Featherlight, zero-jank press container powered by a single native-driver
 * Animated scale node (no extra shadow wrapper views, no layout shifts, zero
 * Reanimated worklet overhead).
 */
export function PressableScale({
  children,
  style,
  contentStyle,
  depth = 0,
  pressedScale,
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
  const pressed = useRef(new Animated.Value(0)).current;
  const isPressedRef = useRef(false);
  const deferTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetScale = pressedScale ?? (depth > 0 ? 0.972 : 0.96);

  useEffect(() => {
    if (reducedMotion || disabled) {
      isPressedRef.current = false;
      pressed.stopAnimation();
      pressed.setValue(0);
    }
  }, [disabled, pressed, reducedMotion]);

  useEffect(() => () => {
    if (deferTimer.current) clearTimeout(deferTimer.current);
    pressed.stopAnimation();
  }, [pressed]);

  const animatedStyle = useMemo(() => ({
    transform: [
      {
        scale: pressed.interpolate({
          inputRange: [0, 1],
          outputRange: [1, targetScale],
        }),
      },
    ],
  }), [pressed, targetScale]);

  const handlePressIn: PressableProps['onPressIn'] = (event) => {
    if (!disabled && !reducedMotion) {
      isPressedRef.current = true;
      pressed.stopAnimation();
      Animated.timing(pressed, {
        toValue: 1,
        duration: 85,
        useNativeDriver: true,
      }).start();
    }
    onPressIn?.(event);
  };

  const handlePressOut: PressableProps['onPressOut'] = (event) => {
    if (isPressedRef.current && !reducedMotion) {
      isPressedRef.current = false;
      pressed.stopAnimation();
      Animated.spring(pressed, {
        toValue: 0,
        tension: 310,
        friction: 22,
        useNativeDriver: true,
      }).start();
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
    <Animated.View
      style={[
        styles.wrap,
        disabled && dimWhenDisabled && styles.disabled,
        animatedStyle,
        style,
      ]}
    >
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
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 0 },
  disabled: { opacity: 0.48 },
  reducedPressed: { opacity: 0.88 },
});
