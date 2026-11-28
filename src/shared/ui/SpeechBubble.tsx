import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { SILKY_EASE_OUT } from '../motion/nativeMotion';
import { colors, fonts, radii } from '../theme';
import { CachedInsetRelief, CachedOutsetShadow, LIQUID_SHADOWS } from './CachedRelief';
import { Text } from './Typography';

export type SpeechBubbleTone = 'paper' | 'limeSoft' | 'peachSoft' | 'roseSoft' | 'violetSoft';

const palettes: Record<SpeechBubbleTone, {
  gradient: readonly [string, string];
  border: string;
  outset: string;
  inset: string;
  accent: string;
}> = {
  paper: { gradient: ['#FFFFFF', '#FBF8FF'], border: '#FFFFFF', outset: LIQUID_SHADOWS.cardOutsetSoft, inset: LIQUID_SHADOWS.cardInsetSoft, accent: colors.violet },
  limeSoft: { gradient: ['#FAFFE8', '#ECFFB9'], border: '#FFFFFF', outset: LIQUID_SHADOWS.mintSoftOutset, inset: LIQUID_SHADOWS.mintSoftInset, accent: colors.limeDeep },
  peachSoft: { gradient: ['#FFF9F6', '#FFEBE3'], border: '#FFFFFF', outset: LIQUID_SHADOWS.peachSoftOutset, inset: LIQUID_SHADOWS.peachSoftInset, accent: colors.peach },
  roseSoft: { gradient: ['#FFF6F8', '#FFE3EA'], border: '#FFFFFF', outset: LIQUID_SHADOWS.roseSoftOutset, inset: LIQUID_SHADOWS.roseSoftInset, accent: colors.rose },
  violetSoft: { gradient: ['#FAF7FF', '#EDE3FF'], border: '#FFFFFF', outset: LIQUID_SHADOWS.cardOutsetSoft, inset: LIQUID_SHADOWS.cardInset, accent: colors.violet },
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
  const { gradient, border, outset, inset, accent } = palettes[tone];
  const isSky = variant === 'sky';
  const isSkyError = isSky && tone === 'roseSoft';
  const cardMode = !isSky || isSkyError;
  const cardRadius = compact ? radii.md : 20;

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

  const shellStyle = !cardMode
    ? [styles.skyShell, compact && styles.skyShellCompact]
    : [
        styles.card,
        compact && styles.cardCompact,
        { borderColor: border },
      ];

  const cardSurface = cardMode ? (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.fill}
      />
      <CachedInsetRelief borderRadius={Math.max(4, cardRadius - 1)} shadow={inset} zIndex={1} />
    </>
  ) : null;

  return (
    <Animated.View style={[styles.outer, animatedStyle, style]}>
      {cardMode ? (
        <CachedOutsetShadow
          borderRadius={cardRadius}
          shadow={outset}
          padTop={10}
          padX={14}
          padBottom={18}
        />
      ) : null}
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
          {cardSurface}
          {cardInner}
        </Pressable>
      ) : (
        <View style={shellStyle}>
          {cardSurface}
          {cardInner}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, minWidth: 0, position: 'relative' },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  card: {
    borderRadius: 20,
    borderWidth: 1.25,
    paddingHorizontal: 13,
    paddingVertical: 10,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
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
    zIndex: 2,
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
