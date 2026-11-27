import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { SILKY_EASE_OUT } from '../motion/nativeMotion';
import { colors, fonts, radii } from '../theme';
import { Text } from './Typography';

export type SpeechBubbleTone = 'paper' | 'limeSoft' | 'peachSoft' | 'roseSoft' | 'violetSoft';

const palettes: Record<SpeechBubbleTone, { bg: string; border: string; lip: string; accent: string }> = {
  paper: { bg: '#FFFFFF', border: '#E7DDFB', lip: '#DDD0F7', accent: colors.violet },
  limeSoft: { bg: '#F6FFE2', border: '#D3EE8C', lip: '#BBE05C', accent: colors.limeDeep },
  peachSoft: { bg: '#FFF5F0', border: '#FAD0C0', lip: '#F2B49D', accent: colors.peach },
  roseSoft: { bg: '#FFF0F3', border: '#FBC2CC', lip: '#F49AA9', accent: colors.rose },
  violetSoft: { bg: '#F4EEFF', border: '#DAC8FC', lip: '#C5ACFA', accent: colors.violet },
};

type Props = {
  title: string;
  body?: string;
  tone?: SpeechBubbleTone;
  tail?: 'left' | 'none';
  variant?: 'card' | 'sky';
  compact?: boolean;
  /** Change this key to trigger a subtle editorial settle when the copy updates. */
  messageKey?: string;
  /** Optional tap handler to cycle or dismiss messages directly from the card. */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Companion copy component. In default card mode renders a tactile 3D studio
 * dialog card; in sky mode renders borderless high-contrast white editorial
 * typography over Home curved color canopy, surfacing a crisp alert pill only
 * on errors.
 */
export function SpeechBubble({
  title,
  body,
  tone = 'paper',
  variant = 'card',
  compact = false,
  messageKey,
  onPress,
  accessibilityLabel,
  style,
}: Props) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const previousKey = useRef(messageKey);
  const { bg: fill, border, lip, accent } = palettes[tone];
  const isSky = variant === 'sky';
  const isSkyError = isSky && tone === 'roseSoft';

  useEffect(() => {
    if (!messageKey || previousKey.current === messageKey) return undefined;
    previousKey.current = messageKey;
    if (reducedMotion) return undefined;
    scale.stopAnimation();
    scale.setValue(0.97);
    const anim = Animated.timing(scale, {
      toValue: 1,
      duration: 210,
      easing: SILKY_EASE_OUT,
      useNativeDriver: true,
    });
    anim.start();
    return () => {
      anim.stop();
      scale.stopAnimation();
    };
  }, [messageKey, reducedMotion, scale]);

  const animatedStyle = useMemo(() => ({ transform: [{ scale }] }), [scale]);

  const skyDotColor = tone === 'peachSoft'
    ? '#FFD447'
    : tone === 'roseSoft'
      ? colors.rose
      : colors.lime;

  const cardInner = isSky && !isSkyError ? (
    <View style={styles.skyCopy}>
      {!compact ? (
        <View style={[styles.skyAccentDash, { backgroundColor: skyDotColor }]} />
      ) : null}
      <View style={styles.skyTitleRow}>
        {compact ? <View style={[styles.skyDot, { backgroundColor: skyDotColor }]} /> : null}
        <Text
          maxFontSizeMultiplier={1.3}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          style={[styles.skyTitle, compact && styles.skyTitleCompact]}
        >
          {title}
        </Text>
      </View>
      {body ? (
        <Text
          maxFontSizeMultiplier={1.3}
          numberOfLines={compact ? 1 : 2}
          style={[styles.skyBody, compact && styles.skyBodyCompact]}
        >
          {body}
        </Text>
      ) : null}
    </View>
  ) : (
    <View style={styles.innerRow}>
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
      <View style={styles.copy}>
        <Text
          maxFontSizeMultiplier={1.3}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
          style={[styles.title, compact && styles.titleCompact, tone === 'roseSoft' && styles.titleError]}
        >
          {title}
        </Text>
        {body ? (
          <Text
            maxFontSizeMultiplier={1.3}
            numberOfLines={compact ? 1 : 2}
            style={[styles.body, compact && styles.bodyCompact, tone === 'roseSoft' && styles.bodyError]}
          >
            {body}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const shellStyle = isSky && !isSkyError
    ? [styles.skyShell, compact && styles.skyShellCompact]
    : [
        styles.card,
        compact && styles.cardCompact,
        { backgroundColor: fill, borderColor: border, borderBottomColor: lip },
      ];

  return (
    <Animated.View style={[styles.outer, animatedStyle, style]}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? (body ? `${title}. ${body}` : title)}
          onPress={onPress}
          style={({ pressed }) => [
            ...shellStyle,
            pressed && styles.cardPressed,
          ]}
        >
          {cardInner}
        </Pressable>
      ) : (
        <View style={shellStyle}>
          {cardInner}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, minWidth: 0 },
  card: {
    borderRadius: 20,
    borderWidth: 1.2,
    borderBottomWidth: 3,
    paddingHorizontal: 13,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  cardCompact: {
    borderRadius: radii.md,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  skyShell: {
    paddingVertical: 2,
    paddingRight: 4,
  },
  skyShellCompact: {
    paddingVertical: 1,
  },
  skyCopy: {
    minWidth: 0,
    alignItems: 'flex-start',
  },
  skyAccentDash: {
    width: 26,
    height: 3.5,
    borderRadius: radii.pill,
    marginBottom: 6,
  },
  skyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    width: '100%',
  },
  skyDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    flexShrink: 0,
  },
  skyTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 24.5,
    lineHeight: 28,
    letterSpacing: -0.4,
    textShadowColor: 'rgba(24, 6, 68, 0.28)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
  },
  skyTitleCompact: {
    fontSize: 17.5,
    lineHeight: 21,
  },
  skyBody: {
    marginTop: 3,
    minHeight: 33,
    fontFamily: fonts.bodyMedium,
    color: 'rgba(248, 243, 255, 0.94)',
    fontSize: 13,
    lineHeight: 16.5,
  },
  skyBodyCompact: {
    marginTop: 1.5,
    paddingLeft: 14,
    minHeight: 16,
    fontSize: 11.5,
    lineHeight: 15,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accentBar: {
    width: 3.5,
    alignSelf: 'stretch',
    minHeight: 28,
    borderRadius: radii.pill,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17.5,
    lineHeight: 21,
  },
  titleCompact: {
    fontSize: 15,
    lineHeight: 19,
  },
  titleError: {
    color: colors.berryDeep,
  },
  body: {
    marginTop: 2,
    minHeight: 32,
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 12.5,
    lineHeight: 16,
  },
  bodyCompact: {
    marginTop: 1,
    minHeight: 15,
    fontSize: 11.5,
    lineHeight: 15,
  },
  bodyError: {
    color: colors.ink,
  },
});
