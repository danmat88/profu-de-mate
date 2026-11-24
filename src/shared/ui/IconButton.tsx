import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme';
import { PressableScale } from './PressableScale';

type Props = {
  label: string;
  onPress?: () => void;
  children: ReactNode;
  size?: number;
  dark?: boolean;
  active?: boolean;
  disabled?: boolean;
  dimWhenDisabled?: boolean;
  deferPressMs?: number;
  style?: StyleProp<ViewStyle>;
};

/** Featherlight frosted studio icon button with zero elevation overdraw. */
export function IconButton({
  label,
  onPress,
  children,
  size = 44,
  dark = false,
  active = false,
  disabled = false,
  dimWhenDisabled = true,
  deferPressMs = 0,
  style,
}: Props) {
  const isDisabled = disabled || !onPress;
  const radius = Math.round(size / 2);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, selected: active }}
      disabled={isDisabled}
      dimWhenDisabled={dimWhenDisabled}
      deferPressMs={deferPressMs}
      hitSlop={6}
      pressedScale={0.92}
      radius={radius}
      haptic="selection"
      onPress={onPress}
      style={style}
      contentStyle={[
        styles.face,
        { width: size, height: size, borderRadius: radius },
        dark && styles.faceDark,
        active && styles.faceActive,
      ]}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  face: {
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.11)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  faceDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.11)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  faceActive: {
    backgroundColor: colors.lime,
    borderColor: 'rgba(86, 120, 0, 0.22)',
  },
});
