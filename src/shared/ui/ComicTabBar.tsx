import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';
import * as Haptics from '../services/haptics';
import { borders, colors, fonts, shadows, springs } from '../theme';
import { Text } from './Typography';

export type ComicTabOption<T extends string> = {
  value: T;
  label: string;
  badge?: string | number;
  activeFill?: string;
  activeText?: string;
  badgeFill?: string;
  badgeText?: string;
};

type Props<T extends string> = {
  options: readonly ComicTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

const TRACK_PADDING = 3;

/**
 * Bouncy Reanimated comic tab bar supporting 2 or more segments with a
 * spring-sliding glossy pill and optional count badges.
 */
export function ComicTabBar<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  compact = false,
  style,
}: Props<T>) {
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = Math.max(0, options.findIndex((item) => item.value === value));
  const progress = useSharedValue(activeIndex);

  useEffect(() => {
    if (reducedMotion) {
      progress.set(activeIndex);
    } else {
      progress.set(withSpring(activeIndex, springs.bouncy));
    }
  }, [activeIndex, progress, reducedMotion]);

  const count = Math.max(1, options.length);
  const innerWidth = trackWidth - borders.regular * 2 - TRACK_PADDING * 2;
  const pillWidth = innerWidth > 0 ? innerWidth / count : 0;

  const colorsKey = options.map((option) => option.activeFill ?? colors.violet).join('|');
  const { inputRange, outputRange } = useMemo(() => {
    const fills = colorsKey.split('|');
    return {
      inputRange: fills.map((_, index) => index),
      outputRange: fills,
    };
  }, [colorsKey]);

  const pillStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const bg = count > 1
      ? interpolateColor(p, inputRange, outputRange)
      : outputRange[0];
    return {
      transform: [{ translateX: p * pillWidth }],
      backgroundColor: bg,
    };
  }, [count, inputRange, outputRange, pillWidth]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0 && Math.abs(nextWidth - trackWidth) > 0.5) {
      setTrackWidth(nextWidth);
    }
  };

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.outer,
        compact && styles.outerCompact,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View pointerEvents="none" style={styles.shadow} />
      <View onLayout={handleLayout} style={[styles.track, compact && styles.trackCompact]}>
        {pillWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pill,
              compact && styles.pillCompact,
              { width: pillWidth },
              pillStyle,
            ]}
          >
            <View style={styles.pillShine} />
          </Animated.View>
        ) : null}

        {options.map((option, index) => {
          const active = index === activeIndex;
          const activeFill = option.activeFill ?? colors.violet;
          const activeText = option.activeText ?? colors.paper;
          const badgeFill = option.badgeFill ?? colors.lime;
          const badgeText = option.badgeText ?? colors.ink;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active, disabled }}
              disabled={disabled}
              onPress={() => {
                if (option.value === value) return;
                Haptics.selection();
                onChange(option.value);
              }}
              style={[
                styles.tab,
                pillWidth === 0 && active && {
                  backgroundColor: activeFill,
                  borderRadius: compact ? 11 : 12,
                  borderWidth: 1.5,
                  borderColor: colors.ink,
                },
              ]}
            >
              <Text
                maxFontSizeMultiplier={1.25}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                style={[
                  styles.label,
                  compact && styles.labelCompact,
                  active && { color: activeText },
                ]}
              >
                {option.label}
              </Text>
              {option.badge !== undefined ? (
                <View
                  style={[
                    styles.badge,
                    compact && styles.badgeCompact,
                    active && { backgroundColor: badgeFill, borderColor: colors.ink },
                  ]}
                >
                  <Text
                    maxFontSizeMultiplier={1.2}
                    style={[
                      styles.badgeText,
                      compact && styles.badgeTextCompact,
                      active && { color: badgeText },
                    ]}
                  >
                    {option.badge}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    height: 50,
    position: 'relative',
    paddingBottom: shadows.sm,
    flexShrink: 0,
  },
  outerCompact: {
    height: 44,
  },
  shadow: {
    position: 'absolute',
    top: shadows.sm,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 17,
    backgroundColor: colors.ink,
  },
  track: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: TRACK_PADDING,
    borderRadius: 17,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    position: 'relative',
    overflow: 'hidden',
  },
  trackCompact: {
    borderRadius: 15,
  },
  pill: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.ink,
    overflow: 'hidden',
  },
  pillCompact: {
    borderRadius: 10,
  },
  pillShine: {
    position: 'absolute',
    top: 2,
    left: 8,
    right: 8,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.shine,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
    zIndex: 1,
  },
  label: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.inkSoft,
    fontSize: 12.5,
    lineHeight: 16,
  },
  labelCompact: {
    fontSize: 12,
    lineHeight: 15,
  },
  badge: {
    minWidth: 22,
    height: 20,
    borderRadius: 7,
    borderWidth: 1.25,
    borderColor: 'transparent',
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeCompact: {
    minWidth: 20,
    height: 18,
    borderRadius: 6,
    paddingHorizontal: 4,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 11,
    lineHeight: 13,
  },
  badgeTextCompact: {
    fontSize: 10.5,
  },
  disabled: {
    opacity: 0.5,
  },
});
