import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { borders, colors, radii } from '../theme';

export type ComicCardTone =
  | 'paper'
  | 'paperTint'
  | 'violet'
  | 'violetSoft'
  | 'lime'
  | 'limeSoft'
  | 'peachSoft'
  | 'cyanSoft'
  | 'goldSoft'
  | 'ink';

const fills: Record<ComicCardTone, string> = {
  paper: 'rgba(255, 255, 255, 0.94)',
  paperTint: colors.paperTint,
  violet: colors.violet,
  violetSoft: '#F3ECFF',
  lime: colors.lime,
  limeSoft: '#F4FFD8',
  peachSoft: '#FFF3EE',
  cyanSoft: '#EEFBFD',
  goldSoft: '#FFF9E3',
  ink: colors.surfaceDarkCard,
};

const borderTones: Record<ComicCardTone, string> = {
  paper: 'rgba(124, 60, 255, 0.09)',
  paperTint: 'rgba(124, 60, 255, 0.12)',
  violet: 'rgba(255, 255, 255, 0.22)',
  violetSoft: 'rgba(124, 60, 255, 0.14)',
  lime: 'rgba(86, 120, 0, 0.16)',
  limeSoft: 'rgba(86, 120, 0, 0.15)',
  peachSoft: 'rgba(179, 59, 34, 0.14)',
  cyanSoft: 'rgba(18, 125, 140, 0.14)',
  goldSoft: 'rgba(145, 108, 0, 0.15)',
  ink: colors.borderDark,
};

type Props = {
  children: ReactNode;
  tone?: ComicCardTone;
  depth?: number;
  radius?: number;
  borderWidth?: number;
  shadowColor?: string;
  shine?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Airy frosted studio card matching LaunchSplash surfaces with whisper-thin
 * borders, crisp specular top glint, and zero Android elevation overdraw.
 */
export function ComicCard({
  children,
  tone = 'paper',
  radius = radii.lg,
  borderWidth = borders.thin,
  shine = false,
  style,
  contentStyle,
}: Props) {
  const effectiveBorder = Math.min(borderWidth, 1.25);

  return (
    <View style={[styles.wrap, style]}>
      <View
        style={[
          styles.face,
          {
            borderRadius: radius,
            borderWidth: effectiveBorder,
            borderColor: borderTones[tone],
            backgroundColor: fills[tone],
          },
          contentStyle,
        ]}
      >
        {shine ? <View pointerEvents="none" style={[styles.shine, { borderRadius: Math.max(4, radius - 4) }]} /> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', minWidth: 0 },
  face: {
    overflow: 'hidden',
    position: 'relative',
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.76)',
  },
});
