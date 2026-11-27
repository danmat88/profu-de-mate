import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme';
import { CachedInsetRelief } from './CachedRelief';
import { PressableScale } from './PressableScale';

type Props = {
  label: string;
  onPress?: () => void;
  children: ReactNode;
  backdrop?: ReactNode;
  size?: number;
  dark?: boolean;
  active?: boolean;
  disabled?: boolean;
  dimWhenDisabled?: boolean;
  deferPressMs?: number;
  style?: StyleProp<ViewStyle>;
};

const LIGHT_INSET = 'inset 0 2px 3px rgba(255, 255, 255, 1), inset 0 -3px 5px rgba(102, 58, 214, 0.16)';
const DARK_INSET = 'inset 0 1.5px 3px rgba(255, 255, 255, 0.34), inset 0 -2px 4px rgba(14, 4, 48, 0.28)';
const ACTIVE_INSET = 'inset 0 2px 3px rgba(255, 255, 240, 0.8), inset 0 -3px 5px rgba(82, 118, 0, 0.28)';

/** Featherlight frosted studio icon button with GPU-cached 3D relief and zero elevation overdraw. */
export function IconButton({
  label,
  onPress,
  children,
  backdrop,
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
      backdrop={backdrop}
      style={style}
      contentStyle={[
        styles.face,
        { width: size, height: size, borderRadius: radius },
        dark && styles.faceDark,
        active && styles.faceActive,
      ]}
    >
      <CachedInsetRelief
        borderRadius={radius}
        shadow={active ? ACTIVE_INSET : dark ? DARK_INSET : LIGHT_INSET}
        zIndex={0}
      />
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  face: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  faceDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  faceActive: {
    backgroundColor: colors.lime,
    borderColor: 'rgba(86, 120, 0, 0.22)',
  },
});
