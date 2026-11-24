import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { colors, fonts, radii } from '../theme';
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
  paper: 'rgba(255, 255, 255, 0.96)',
  peach: colors.peach,
  gold: colors.gold,
  cyan: colors.cyan,
};

const borderTones: Record<Tone, string> = {
  lime: 'rgba(86, 120, 0, 0.16)',
  violet: 'rgba(255, 255, 255, 0.22)',
  ink: colors.borderDark,
  paper: 'rgba(124, 60, 255, 0.12)',
  peach: 'rgba(179, 59, 34, 0.14)',
  gold: 'rgba(145, 108, 0, 0.16)',
  cyan: 'rgba(18, 125, 140, 0.16)',
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

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      pressedScale={0.972}
      radius={radius}
      haptic="medium"
      onPress={onPress}
      style={[styles.wrap, style]}
      contentStyle={[
        styles.face,
        condensed && styles.faceCompact,
        { backgroundColor: fills[tone], borderColor: borderTones[tone], borderRadius: radius },
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
          <AppIcon name={icon} size={condensed ? 38 : 46} />
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
            size={condensed ? 18 : 20}
            color={light ? colors.paper : colors.ink}
          />
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 0, alignSelf: 'stretch' },
  face: {
    width: '100%',
    minWidth: 0,
    minHeight: 62,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  faceCompact: {
    minHeight: 52,
    paddingHorizontal: 13,
    paddingVertical: 7,
    gap: 9,
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
  },
  shineOnDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  iconCompact: { width: 36, height: 36 },
  copy: { flex: 1, minWidth: 0, zIndex: 1 },
  title: { color: colors.ink, fontFamily: fonts.displaySemi, fontSize: 18, lineHeight: 22 },
  titleCompact: { fontSize: 16.5, lineHeight: 20 },
  subtitle: { color: colors.inkSoft, fontFamily: fonts.bodyMedium, fontSize: 12.5, lineHeight: 16, marginTop: 1.5 },
  light: { color: colors.paper },
  lightSoft: { color: '#EBE4FF' },
  arrowBadge: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(23, 19, 55, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  arrowBadgeOnDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
});
