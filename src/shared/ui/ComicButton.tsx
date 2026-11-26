import { LinearGradient } from 'expo-linear-gradient';
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
  trailingIcon?: 'next' | 'check' | 'close' | 'retry' | false;
  tone?: Tone;
  compact?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const gradients: Record<Tone, readonly [string, string, string]> = {
  lime: ['#EDFF7A', '#D8FF3E', '#BCEF12'],
  violet: ['#8F52FF', '#6F2CFF', '#5318D8'],
  ink: ['#2D235C', '#1D1542', '#130D30'],
  paper: ['#FFFFFF', '#FFFFFF', '#FAF7FF'],
  peach: ['#FFAD8C', '#FF8D6B', '#F26F4E'],
  gold: ['#FFE680', '#FFD24D', '#F5B51C'],
  cyan: ['#76ECF7', '#43D6E6', '#21BACB'],
};

const borderTones: Record<Tone, { edge: string; bottom: string }> = {
  lime: { edge: '#E8FF78', bottom: '#7EA508' },
  violet: { edge: '#AA7AFF', bottom: '#3A0FA6' },
  ink: { edge: '#3F3478', bottom: '#0B071E' },
  paper: { edge: '#E5DCFF', bottom: '#CEC0F8' },
  peach: { edge: '#FFC2AB', bottom: '#C44D2D' },
  gold: { edge: '#FFF0A8', bottom: '#BA8006' },
  cyan: { edge: '#A4F4FC', bottom: '#118B9A' },
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
  const radius = radii.pill;
  const borders = borderTones[tone];

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
        {
          borderColor: borders.edge,
          borderBottomColor: borders.bottom,
          borderRadius: radius,
        },
      ]}
    >
      <LinearGradient
        colors={gradients[tone]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={styles.fill}
      />
      <View
        pointerEvents="none"
        style={[
          styles.shine,
          light && styles.shineOnDark,
        ]}
      />
      {icon ? (
        <View style={[styles.icon, condensed && styles.iconCompact, light && styles.iconOnDark]}>
          <AppIcon name={icon} size={condensed ? 24 : 28} />
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
            size={condensed ? 16 : 18}
            color={light ? colors.ink : colors.paper}
          />
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 0, alignSelf: 'stretch' },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  face: {
    width: '100%',
    minWidth: 0,
    minHeight: 60,
    borderWidth: 1.5,
    borderBottomWidth: 4.5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  faceCompact: {
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 9,
  },
  shine: {
    position: 'absolute',
    top: 2,
    left: 22,
    right: 22,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  shineOnDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    flexShrink: 0,
  },
  iconCompact: { width: 34, height: 34, borderRadius: 17 },
  iconOnDark: { backgroundColor: 'rgba(255, 255, 255, 0.18)' },
  copy: { flex: 1, minWidth: 0, zIndex: 1 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 17.5, lineHeight: 21 },
  titleCompact: { fontSize: 16.5, lineHeight: 20 },
  subtitle: { color: colors.inkSoft, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 15.5, marginTop: 1.5 },
  light: { color: colors.paper },
  lightSoft: { color: '#EBE4FF' },
  arrowBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    flexShrink: 0,
  },
  arrowBadgeOnDark: {
    backgroundColor: colors.lime,
  },
});
