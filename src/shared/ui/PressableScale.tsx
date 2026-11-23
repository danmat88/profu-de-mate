import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import * as Haptics from '../services/haptics';
import { colors, radii } from '../theme';

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
 * Tactile cartoon press container powered by pure native-driver Animated
 * springs (zero Reanimated worklet mount cost). When depth > 0, renders a solid
 * extruded 3D comic base and squashes the face down with bouncy rebound.
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
  const pressed = useRef(new Animated.Value(0)).current;
  const deferTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reducedMotion || disabled) {
      pressed.stopAnimation();
      pressed.setValue(0);
    }
  }, [disabled, pressed, reducedMotion]);

  useEffect(() => () => {
    if (deferTimer.current) clearTimeout(deferTimer.current);
    pressed.stopAnimation();
  }, [pressed]);

  const animatedFaceStyle = depth > 0
    ? {
      transform: [
        {
          translateY: pressed.interpolate({
            inputRange: [0, 1],
            outputRange: [0, Math.max(2, depth - 1)],
          }),
        },
        {
          scale: pressed.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.978],
          }),
        },
      ],
    }
    : {
      transform: [
        {
          scale: pressed.interpolate({
            inputRange: [0, 1],
            outputRange: [1, pressedScale],
          }),
        },
      ],
    };

  const handlePressIn: PressableProps['onPressIn'] = (event) => {
    if (!disabled && !reducedMotion) {
      pressed.stopAnimation();
      Animated.spring(pressed, {
        toValue: 1,
        tension: 500,
        friction: 28,
        useNativeDriver: true,
      }).start();
    }
    onPressIn?.(event);
  };

  const handlePressOut: PressableProps['onPressOut'] = (event) => {
    if (!reducedMotion) {
      pressed.stopAnimation();
      Animated.spring(pressed, {
        toValue: 0,
        tension: 300,
        friction: 15,
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
      <Animated.View style={[styles.faceWrap, animatedFaceStyle]}>
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
