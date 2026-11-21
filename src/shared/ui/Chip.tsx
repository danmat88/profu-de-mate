import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { borders, colors, radii, typography } from '../theme';
import { Text } from './Typography';

export type ChipTone = 'lime' | 'peach' | 'gold' | 'violet' | 'violetSoft' | 'cyanSoft' | 'paper' | 'roseSoft';

const palettes: Record<ChipTone, { bg: string; fg: string }> = {
  lime: { bg: colors.lime, fg: colors.ink },
  peach: { bg: colors.peach, fg: colors.ink },
  gold: { bg: colors.gold, fg: colors.ink },
  violet: { bg: colors.violet, fg: colors.paper },
  violetSoft: { bg: colors.violetSoft, fg: colors.violetDeep },
  cyanSoft: { bg: colors.cyanSoft, fg: colors.cyanDeep },
  paper: { bg: colors.paper, fg: colors.ink },
  roseSoft: { bg: colors.roseSoft, fg: colors.berryDeep },
};

type Props = {
  label: string;
  tone?: ChipTone;
  leading?: ReactNode;
  tilt?: number;
  outlined?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Readable comic sticker / pill badge (always >= 11sp). */
export function Chip({
  label,
  tone = 'lime',
  leading,
  tilt = 0,
  outlined = true,
  style,
}: Props) {
  const palette = palettes[tone];
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: palette.bg },
        outlined && styles.outlined,
        tilt !== 0 && { transform: [{ rotate: `${tilt}deg` }] },
        style,
      ]}
    >
      {leading}
      <Text
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}
        style={[styles.label, { color: palette.fg }]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  outlined: {
    borderWidth: borders.thin,
    borderColor: colors.ink,
  },
  label: {
    ...typography.kicker,
    includeFontPadding: false,
  },
});
