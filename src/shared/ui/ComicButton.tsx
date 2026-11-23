import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { borders, colors, fonts, radii, shadows } from '../theme';
import { AppIcon, type AppIconName } from './AppIcon';
import { MiniGlyph } from './MiniGlyph';
import { PressableScale } from './PressableScale';
import { Text } from './Typography';

type Tone = 'lime' | 'violet' | 'ink' | 'paper' | 'peach' | 'gold' | 'cyan';

type Props = {
  title: string;
  subtitle?: string;
  icon?: AppIconName;
  trailingIcon?: 'next' | 'check' | 'close' | false;
  tone?: Tone;
  compact?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const fills: Record<Tone, string> = {
  lime: colors.lime,
  violet: colors.violet,
  ink: colors.ink,
  paper: colors.paper,
  peach: colors.peach,
  gold: colors.gold,
  cyan: colors.cyan,
};

const shadowTones: Record<Tone, string> = {
  lime: colors.ink,
  violet: colors.violetShadow,
  ink: '#09061B',
  paper: colors.ink,
  peach: colors.peachShadow,
  gold: colors.ink,
  cyan: colors.ink,
};

export function ComicButton({
  title,
  subtitle,
  icon,
  trailingIcon = 'next',
  tone = 'lime',
  compact = false,
  disabled = false,
  accessibilityHint,
  onPress,
  style,
}: Props) {
  const frame = useSafeAreaFrame();
  const { isNarrow, isLargeText } = useResponsiveLayout(frame);
  const light = tone === 'violet' || tone === 'ink';
  const condensed = (compact || isNarrow) && !isLargeText;
  const radius = condensed ? 18 : radii.lg;
  const depth = condensed ? shadows.md : shadows.lg - 1;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      depth={depth}
      radius={radius}
      shadowColor={shadowTones[tone]}
      haptic="medium"
      onPress={onPress}
      style={[styles.wrap, style]}
      contentStyle={[
        styles.face,
        condensed && styles.faceCompact,
        { backgroundColor: fills[tone], borderRadius: radius },
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.shine,
          light && styles.shineOnDark,
          { borderRadius: Math.max(4, radius - 6) },
        ]}
      />
      {icon ? (
        <View style={[styles.icon, condensed && styles.iconCompact]}>
          <AppIcon name={icon} size={condensed ? 44 : 54} />
        </View>
      ) : null}
      <View style={styles.copy}>
        <Text style={[styles.title, condensed && styles.titleCompact, light && styles.light]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={compact ? 1 : 2} style={[styles.subtitle, light && styles.lightSoft]}>{subtitle}</Text>
        ) : null}
      </View>
      {trailingIcon ? (
        <View style={[styles.arrowBadge, light && styles.arrowBadgeOnDark]}>
          <MiniGlyph
            name={trailingIcon}
            size={condensed ? 20 : 24}
            color={light ? colors.paper : colors.ink}
          />
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 0, alignSelf: 'stretch', marginBottom: 4 },
  face: {
    width: '100%',
    minWidth: 0,
    minHeight: 72,
    borderWidth: borders.thick,
    borderColor: colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  faceCompact: {
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  shine: {
    position: 'absolute',
    top: 3,
    left: 12,
    right: 12,
    height: 6,
    backgroundColor: colors.shine,
  },
  shineOnDark: {
    backgroundColor: colors.shineSoft,
  },
  icon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  iconCompact: { width: 42, height: 42 },
  copy: { flex: 1, minWidth: 0, zIndex: 1 },
  title: { color: colors.ink, fontFamily: fonts.displaySemi, fontSize: 19, lineHeight: 22 },
  titleCompact: { fontSize: 17, lineHeight: 20 },
  subtitle: { color: colors.inkSoft, fontFamily: fonts.bodyMedium, fontSize: 12.5, lineHeight: 16, marginTop: 1 },
  light: { color: colors.paper },
  lightSoft: { color: '#E9E2FF' },
  arrowBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(23, 19, 55, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  arrowBadgeOnDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
});
