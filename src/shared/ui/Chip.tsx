import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, typography } from '../theme';
import { Text } from './Typography';

export type ChipTone = 'lime' | 'peach' | 'gold' | 'violet' | 'violetSoft' | 'cyanSoft' | 'paper' | 'roseSoft';

const palettes: Record<ChipTone, { bg: string; fg: string; border: string }> = {
  lime: { bg: colors.lime, fg: colors.ink, border: 'rgba(86, 120, 0, 0.16)' },
  peach: { bg: colors.peach, fg: colors.ink, border: 'rgba(179, 59, 34, 0.16)' },
  gold: { bg: colors.gold, fg: colors.ink, border: 'rgba(145, 108, 0, 0.16)' },
  violet: { bg: colors.violet, fg: colors.paper, border: 'rgba(255, 255, 255, 0.22)' },
  violetSoft: { bg: colors.violetSoft, fg: colors.violetDeep, border: '#DDD0F9' },
  cyanSoft: { bg: colors.cyanSoft, fg: colors.cyanDeep, border: '#B2EAF0' },
  paper: { bg: colors.paper, fg: colors.ink, border: colors.borderHairline },
  roseSoft: { bg: colors.roseSoft, fg: colors.berryDeep, border: '#FBC4CE' },
};

type Props = {
  label: string;
  tone?: ChipTone;
  leading?: ReactNode;
  tilt?: number;
  outlined?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Clean studio pill badge matching LaunchSplash pills (always >= 11sp). */
export function Chip({
  label,
  tone = 'lime',
  leading,
  outlined = true,
  style,
}: Props) {
  const palette = palettes[tone];
  return (
    <View
      collapsable={false}
      style={[
        styles.chip,
        { backgroundColor: palette.bg },
        outlined && { borderWidth: 1, borderColor: palette.border },
        style,
      ]}
    >
      {leading}
      <Text
        maxFontSizeMultiplier={1.3}
        textBreakStrategy="simple"
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
    paddingHorizontal: 11,
    paddingVertical: 4.5,
    borderRadius: radii.pill,
  },
  label: {
    ...typography.kicker,
    lineHeight: 15,
    paddingHorizontal: 1,
    includeFontPadding: false,
  },
});
