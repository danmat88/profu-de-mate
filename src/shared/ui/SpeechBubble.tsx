import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { SILKY_EASE_OUT } from '../motion/nativeMotion';
import { colors, fonts, radii } from '../theme';
import { Text } from './Typography';

export type SpeechBubbleTone = 'paper' | 'limeSoft' | 'peachSoft' | 'roseSoft' | 'violetSoft';

const palettes: Record<SpeechBubbleTone, { bg: string; border: string; accent: string }> = {
  paper: { bg: 'rgba(255, 255, 255, 0.9)', border: 'rgba(124, 60, 255, 0.11)', accent: colors.violet },
  limeSoft: { bg: 'rgba(246, 255, 224, 0.94)', border: 'rgba(86, 120, 0, 0.18)', accent: colors.limeDeep },
  peachSoft: { bg: 'rgba(255, 244, 238, 0.94)', border: 'rgba(255, 141, 107, 0.28)', accent: colors.peach },
  roseSoft: { bg: 'rgba(255, 240, 243, 0.95)', border: 'rgba(255, 87, 109, 0.28)', accent: colors.rose },
  violetSoft: { bg: 'rgba(244, 238, 255, 0.94)', border: 'rgba(124, 60, 255, 0.18)', accent: colors.violet },
};

type Props = {
  title: string;
  body?: string;
  tone?: SpeechBubbleTone;
  tail?: 'left' | 'none';
  compact?: boolean;
  /** Change this key to trigger a subtle editorial settle when the copy updates. */
  messageKey?: string;
  /** Optional tap handler to cycle or dismiss messages directly from the card. */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Airy frosted editorial companion card replacing dated comic speech tails
 * with a clean studio accent bar and whisper-smooth native motion.
 */
export function SpeechBubble({
  title,
  body,
  tone = 'paper',
  compact = false,
  messageKey,
  onPress,
  accessibilityLabel,
  style,
}: Props) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const previousKey = useRef(messageKey);
  const { bg: fill, border, accent } = palettes[tone];

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

  const cardInner = (
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

  return (
    <Animated.View style={[styles.outer, animatedStyle, style]}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? (body ? `${title}. ${body}` : title)}
          onPress={onPress}
          style={({ pressed }) => [
            styles.card,
            compact && styles.cardCompact,
            { backgroundColor: fill, borderColor: border },
            pressed && styles.cardPressed,
          ]}
        >
          {cardInner}
        </Pressable>
      ) : (
        <View style={[styles.card, compact && styles.cardCompact, { backgroundColor: fill, borderColor: border }]}>
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
    borderWidth: 1,
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
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
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
