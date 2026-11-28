import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { colors, fonts, radii } from '../theme';
import { AppIcon, type AppIconName } from './AppIcon';
import { CachedInsetRelief, CachedOutsetShadow, CachedSurface, LIQUID_SHADOWS } from './CachedRelief';
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
  lime: ['#F2FF82', '#D8FF3E', '#B4EC0C'],
  violet: ['#9556FF', '#6F2CFF', '#4D14CC'],
  ink: ['#332868', '#1F164A', '#130D32'],
  paper: ['#FFFFFF', '#FCF9FF', '#F3ECFF'],
  peach: ['#FFB292', '#FF8762', '#EA613D'],
  gold: ['#FFEC8E', '#FFD245', '#F3AE12'],
  cyan: ['#7BF0FA', '#3ED2E4', '#18B2C6'],
};

const borderTones: Record<Tone, string> = {
  lime: '#F4FFA6',
  violet: 'rgba(255, 255, 255, 0.34)',
  ink: 'rgba(180, 156, 255, 0.28)',
  paper: '#FFFFFF',
  peach: '#FFD6C4',
  gold: '#FFF4B8',
  cyan: '#BDF8FE',
};

const reliefTones: Record<Tone, { outset: string; inset: string }> = {
  lime: { outset: LIQUID_SHADOWS.limeOutset, inset: LIQUID_SHADOWS.limeInset },
  violet: { outset: LIQUID_SHADOWS.violetOutset, inset: LIQUID_SHADOWS.violetInset },
  ink: { outset: LIQUID_SHADOWS.darkOutset, inset: LIQUID_SHADOWS.darkInset },
  paper: { outset: LIQUID_SHADOWS.cardOutsetSoft, inset: LIQUID_SHADOWS.cardInset },
  peach: { outset: LIQUID_SHADOWS.peachOutset, inset: LIQUID_SHADOWS.peachInset },
  gold: { outset: LIQUID_SHADOWS.goldOutset, inset: LIQUID_SHADOWS.goldInset },
  cyan: { outset: LIQUID_SHADOWS.cyanOutset, inset: LIQUID_SHADOWS.cyanInset },
};

const ARROW_SHADOW_DARK = '0 2px 4px rgba(23, 19, 55, 0.24), inset 0 1.5px 2px rgba(255, 255, 255, 0.22), inset 0 -2px 3px rgba(6, 4, 22, 0.4)';
const ARROW_SHADOW_LIME = '0 2px 4px rgba(68, 98, 0, 0.22), inset 0 1.5px 2px rgba(255, 255, 232, 0.85), inset 0 -2px 3px rgba(80, 116, 0, 0.32)';
const ICON_WELL_SHADOW = '0 2px 4px rgba(42, 16, 116, 0.16), inset 0 1.5px 2px rgba(255, 255, 255, 0.96), inset 0 -2px 3px rgba(96, 56, 200, 0.14)';

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
  const relief = reliefTones[tone];

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
      backdrop={(
        <CachedOutsetShadow
          borderRadius={radius}
          shadow={relief.outset}
          padTop={12}
          padX={18}
          padBottom={22}
        />
      )}
      style={[styles.wrap, style]}
      contentStyle={[
        styles.face,
        condensed && styles.faceCompact,
        {
          borderColor: borderTones[tone],
          borderRadius: radius,
        },
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={gradients[tone]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={styles.fill}
      />
      <CachedInsetRelief borderRadius={radius} shadow={relief.inset} zIndex={1} />
      {icon ? (
        <View style={[styles.icon, condensed && styles.iconCompact]}>
          <CachedSurface
            borderRadius={condensed ? 17 : 19}
            backgroundColor={light ? 'rgba(255, 255, 255, 0.94)' : '#FFFFFF'}
            shadow={ICON_WELL_SHADOW}
            padTop={6}
            padX={8}
            padBottom={10}
          />
          <View style={styles.frontLayer}>
            <AppIcon name={icon} size={condensed ? 22 : 26} />
          </View>
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
        <View style={styles.arrowBadge}>
          <CachedSurface
            borderRadius={17}
            backgroundColor={light ? colors.lime : colors.ink}
            shadow={light ? ARROW_SHADOW_LIME : ARROW_SHADOW_DARK}
            padTop={6}
            padX={8}
            padBottom={10}
          />
          <View style={styles.frontLayer}>
            <MiniGlyph
              name={trailingIcon}
              size={condensed ? 15 : 17}
              color={light ? colors.ink : colors.paper}
            />
          </View>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 0, alignSelf: 'stretch', position: 'relative' },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  frontLayer: { zIndex: 2, alignItems: 'center', justifyContent: 'center' },
  face: {
    width: '100%',
    minWidth: 0,
    minHeight: 58,
    borderWidth: 1.25,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  faceCompact: {
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 9,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
    flexShrink: 0,
  },
  iconCompact: { width: 34, height: 34, borderRadius: 17 },
  copy: { flex: 1, minWidth: 0, zIndex: 2 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 17.5, lineHeight: 21 },
  titleCompact: { fontSize: 16.5, lineHeight: 20 },
  subtitle: { color: colors.inkSoft, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 15.5, marginTop: 1.5 },
  light: { color: colors.paper },
  lightSoft: { color: '#EBE4FF' },
  arrowBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
    flexShrink: 0,
  },
});
