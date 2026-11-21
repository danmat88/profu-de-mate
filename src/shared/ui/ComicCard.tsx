import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { borders, colors, radii, shadows } from '../theme';

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
  paper: colors.paper,
  paperTint: colors.paperTint,
  violet: colors.violet,
  violetSoft: colors.violetSoft,
  lime: colors.lime,
  limeSoft: colors.limeSoft,
  peachSoft: colors.peachSoft,
  cyanSoft: colors.cyanSoft,
  goldSoft: colors.goldSoft,
  ink: colors.ink,
};

const defaultShadows: Record<ComicCardTone, string> = {
  paper: colors.ink,
  paperTint: colors.ink,
  violet: colors.violetShadow,
  violetSoft: colors.ink,
  lime: colors.ink,
  limeSoft: colors.ink,
  peachSoft: colors.ink,
  cyanSoft: colors.ink,
  goldSoft: colors.ink,
  ink: '#09061B',
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

/** Unified comic card with thick ink outline, extruded base, and optional cel-highlight. */
export function ComicCard({
  children,
  tone = 'paper',
  depth = shadows.md,
  radius = radii.lg,
  borderWidth = borders.regular,
  shadowColor,
  shine = false,
  style,
  contentStyle,
}: Props) {
  const baseColor = shadowColor ?? defaultShadows[tone];
  return (
    <View style={[styles.wrap, depth > 0 && { paddingBottom: depth }, style]}>
      {depth > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.shadow,
            { top: depth, borderRadius: radius, backgroundColor: baseColor },
          ]}
        />
      ) : null}
      <View
        style={[
          styles.face,
          {
            borderRadius: radius,
            borderWidth,
            backgroundColor: fills[tone],
          },
          contentStyle,
        ]}
      >
        {shine ? <View pointerEvents="none" style={[styles.shine, { borderRadius: Math.max(4, radius - 6) }]} /> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', minWidth: 0 },
  shadow: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  face: {
    borderColor: colors.ink,
    overflow: 'hidden',
    position: 'relative',
  },
  shine: {
    position: 'absolute',
    top: 3,
    left: 10,
    right: 10,
    height: 6,
    backgroundColor: colors.shine,
  },
});
