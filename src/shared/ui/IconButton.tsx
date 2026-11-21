import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { borders, colors, radii, shadows } from '../theme';
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
  style?: StyleProp<ViewStyle>;
};

/** Tactile 3D squircle icon button for headers and toolbars. */
export function IconButton({
  label,
  onPress,
  children,
  size = 46,
  dark = false,
  active = false,
  disabled = false,
  dimWhenDisabled = true,
  style,
}: Props) {
  const isDisabled = disabled || !onPress;
  const radius = Math.min(radii.md, Math.round(size * 0.34));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, selected: active }}
      disabled={isDisabled}
      dimWhenDisabled={dimWhenDisabled}
      hitSlop={6}
      depth={shadows.sm}
      radius={radius}
      shadowColor={dark ? '#0B0721' : colors.ink}
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
      <View pointerEvents="none" style={[styles.shine, { borderRadius: Math.max(4, radius - 4) }]} />
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  face: {
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  faceDark: {
    backgroundColor: '#292052',
    borderColor: colors.paper,
  },
  faceActive: {
    backgroundColor: colors.lime,
  },
  shine: {
    position: 'absolute',
    top: 2,
    left: 6,
    right: 6,
    height: 4,
    backgroundColor: colors.shine,
  },
});
