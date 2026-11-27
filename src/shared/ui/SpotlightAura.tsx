import { memo, useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme';

export type SpotlightAuraTone = 'violet' | 'lime' | 'peach' | 'rose' | 'cyan' | 'dark' | 'onViolet';

const PALETTES: Record<
  SpotlightAuraTone,
  { core: string; coreOpacity: string; mid: string; midOpacity: string }
> = {
  violet: { core: '#FFFFFF', coreOpacity: '0.78', mid: colors.violet, midOpacity: '0.16' },
  lime: { core: '#FFFFFF', coreOpacity: '0.82', mid: colors.lime, midOpacity: '0.28' },
  peach: { core: '#FFFFFF', coreOpacity: '0.8', mid: colors.peach, midOpacity: '0.22' },
  rose: { core: '#FFFFFF', coreOpacity: '0.8', mid: colors.rose, midOpacity: '0.2' },
  cyan: { core: '#FFFFFF', coreOpacity: '0.82', mid: colors.cyan, midOpacity: '0.22' },
  dark: { core: colors.violetBright, coreOpacity: '0.28', mid: colors.cyan, midOpacity: '0.14' },
  onViolet: { core: '#FFFFFF', coreOpacity: '0.32', mid: colors.lime, midOpacity: '0.18' },
};

type Props = {
  size: number;
  tone?: SpotlightAuraTone;
  orbit?: boolean;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Optical radial studio spotlight rendered via a true multi-stop SVG
 * RadialGradient — silky smooth light falloff with zero flat circular edges,
 * zero bullseye rings, and zero per-frame animation overhead.
 */
export const SpotlightAura = memo(function SpotlightAura({
  size,
  tone = 'violet',
  style,
}: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradId = `sa_${tone}_${uid}`;
  const palette = PALETTES[tone];
  const haloSize = Math.round(size * 1.42);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.center,
        { width: haloSize, height: haloSize },
        style,
      ]}
    >
      <Svg width={haloSize} height={haloSize} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={gradId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={palette.core} stopOpacity={palette.coreOpacity} />
            <Stop offset="42%" stopColor={palette.mid} stopOpacity={palette.midOpacity} />
            <Stop offset="100%" stopColor={palette.mid} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${gradId})`} />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
