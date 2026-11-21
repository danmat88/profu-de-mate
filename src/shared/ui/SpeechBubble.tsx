import { useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { borders, colors, fonts, radii, shadows, springs } from '../theme';
import { Text } from './Typography';

export type SpeechBubbleTone = 'paper' | 'limeSoft' | 'peachSoft' | 'roseSoft' | 'violetSoft';

const fills: Record<SpeechBubbleTone, string> = {
  paper: colors.paper,
  limeSoft: colors.limeSoft,
  peachSoft: colors.peachSoft,
  roseSoft: colors.roseSoft,
  violetSoft: colors.violetSoft,
};

type Props = {
  title: string;
  body?: string;
  tone?: SpeechBubbleTone;
  tail?: 'left' | 'none';
  compact?: boolean;
  /** Change this key to trigger a subtle comic pop when the copy updates. */
  messageKey?: string;
  style?: StyleProp<ViewStyle>;
};

export function SpeechBubble({
  title,
  body,
  tone = 'paper',
  tail = 'left',
  compact = false,
  messageKey,
  style,
}: Props) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const previousKey = useRef(messageKey);
  const fill = fills[tone];

  useEffect(() => {
    if (!messageKey || previousKey.current === messageKey) return;
    previousKey.current = messageKey;
    if (reducedMotion) return;
    scale.value = 0.95;
    scale.value = withSpring(1, springs.pop);
  }, [messageKey, reducedMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.outer, tail === 'left' && styles.outerWithLeftTail, animatedStyle, style]}>
      <View style={styles.shadowWrap}>
        <View pointerEvents="none" style={styles.shadow} />
        <View style={[styles.bubble, compact && styles.bubbleCompact, { backgroundColor: fill }]}>
          <View pointerEvents="none" style={styles.shine} />
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

      {tail === 'left' ? (
        <View pointerEvents="none" style={[styles.leftTail, compact && styles.leftTailCompact]}>
          <Svg width={15} height={18} viewBox="0 0 15 18">
            <Path d="M14.5 3 L2.2 9.5 L14.5 15 Z" fill={fill} />
            <Path
              d="M11.5 3 L2.2 9.5 L11.5 15"
              fill="none"
              stroke={colors.ink}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </Svg>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, minWidth: 0, position: 'relative' },
  outerWithLeftTail: { paddingLeft: 10 },
  shadowWrap: { position: 'relative', paddingBottom: shadows.sm },
  shadow: {
    position: 'absolute',
    top: shadows.sm,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.lg,
    backgroundColor: colors.ink,
  },
  bubble: {
    borderRadius: radii.lg,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  bubbleCompact: {
    borderRadius: radii.md,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  shine: {
    position: 'absolute',
    top: 3,
    left: 12,
    right: 12,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.shine,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 18,
    lineHeight: 22,
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
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 12.5,
    lineHeight: 17,
  },
  bodyCompact: {
    marginTop: 1,
    fontSize: 11.5,
    lineHeight: 15,
  },
  bodyError: {
    color: colors.ink,
  },
  leftTail: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -11,
  },
  leftTailCompact: {
    marginTop: -10,
  },
});
