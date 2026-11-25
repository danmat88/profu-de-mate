import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import * as Haptics from '../services/haptics';
import { colors, fonts, radii } from '../theme';
import { Text } from './Typography';

export type ActionToastState = {
  id: number;
  message: string;
  tone?: 'gold' | 'lime' | 'neutral';
  actionLabel?: string;
  onAction?: () => void;
};

type Props = {
  toast: ActionToastState | null;
  bottomOffset?: number;
};

/**
 * Lightweight, non-blocking floating toast for favorite/save confirmations and
 * optional Undo actions. Pure native-driver Animated, unmounts completely when idle.
 */
export const ActionToast = memo(function ActionToast({ toast, bottomOffset = 20 }: Props) {
  const reducedMotion = useReducedMotion();
  const [rendered, setRendered] = useState<ActionToastState | null>(toast);
  const progress = useRef(new Animated.Value(toast ? 1 : 0)).current;

  useEffect(() => {
    progress.stopAnimation();
    if (toast) {
      setRendered(toast);
      if (reducedMotion) {
        progress.setValue(1);
        return undefined;
      }
      progress.setValue(0);
      const anim = Animated.spring(progress, {
        toValue: 1,
        tension: 220,
        friction: 18,
        useNativeDriver: true,
      });
      anim.start();
      return () => anim.stop();
    }

    if (!rendered) return undefined;
    if (reducedMotion) {
      setRendered(null);
      progress.setValue(0);
      return undefined;
    }
    const anim = Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) setRendered(null);
    });
    return () => anim.stop();
  }, [progress, reducedMotion, rendered, toast]);

  const animStyle = useMemo(
    () => ({
      opacity: progress,
      transform: [
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [18, 0],
          }),
        },
        {
          scale: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.94, 1],
          }),
        },
      ],
    }),
    [progress],
  );

  if (!rendered) return null;
  const tone = rendered.tone ?? 'gold';
  const badgeBg = tone === 'lime' ? colors.lime : tone === 'gold' ? colors.gold : 'rgba(255,255,255,0.18)';
  const badgeGlyph = tone === 'lime' ? '✓' : tone === 'gold' ? '★' : '•';
  const badgeFg = tone === 'neutral' ? colors.paper : colors.ink;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.overlay, { bottom: bottomOffset }]}
    >
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[styles.pill, animStyle]}
      >
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.badgeText, { color: badgeFg }]}>{badgeGlyph}</Text>
        </View>
        <Text numberOfLines={2} style={styles.message}>
          {rendered.message}
        </Text>
        {rendered.actionLabel && rendered.onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={rendered.actionLabel}
            hitSlop={8}
            onPress={() => {
              Haptics.selection();
              rendered.onAction?.();
            }}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          >
            <Text style={styles.actionText}>{rendered.actionLabel}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 60,
  },
  pill: {
    maxWidth: 420,
    minHeight: 46,
    borderRadius: radii.pill,
    borderWidth: 1.3,
    borderBottomWidth: 3.5,
    borderColor: '#482898',
    borderBottomColor: '#120829',
    backgroundColor: '#231347',
    paddingLeft: 10,
    paddingRight: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeText: {
    fontFamily: fonts.display,
    fontSize: 13,
    lineHeight: 16,
    includeFontPadding: false,
  },
  message: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    lineHeight: 17,
    color: colors.paper,
  },
  actionBtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    flexShrink: 0,
  },
  actionText: {
    fontFamily: fonts.display,
    fontSize: 12,
    lineHeight: 15,
    color: colors.ink,
    includeFontPadding: false,
  },
  pressed: { opacity: 0.78 },
});
