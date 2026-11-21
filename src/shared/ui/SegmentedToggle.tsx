import { useEffect, useState } from 'react';
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
import { borders, colors, fonts, radii, shadows, springs } from '../theme';
import { AppIcon, type AppIconName } from './AppIcon';
import { Text } from './Typography';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon: AppIconName;
  activeFill: string;
  activeText: string;
  dotFill: string;
  dotText: string;
};

type Props<T extends string> = {
  options: readonly [SegmentedOption<T>, SegmentedOption<T>];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

const TRACK_PADDING = 4;

/**
 * Bouncy comic two-segment control with a Reanimated spring-sliding pill
 * that smoothly morphs its accent color between the two options.
 */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  compact = false,
  style,
}: Props<T>) {
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = value === options[1].value ? 1 : 0;
  const progress = useSharedValue(activeIndex);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = activeIndex;
    } else {
      progress.value = withSpring(activeIndex, springs.bouncy);
    }
  }, [activeIndex, progress, reducedMotion]);

  const innerWidth = trackWidth - borders.regular * 2 - TRACK_PADDING * 2;
  const pillWidth = innerWidth > 0 ? innerWidth / 2 : 0;
  const firstColor = options[0].activeFill;
  const secondColor = options[1].activeFill;

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * pillWidth }],
    backgroundColor: interpolateColor(progress.value, [0, 1], [firstColor, secondColor]),
  }), [firstColor, pillWidth, secondColor]);

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
      <View
        pointerEvents="none"
        style={[
          styles.shadow,
          activeIndex === 0 ? styles.shadowFirst : styles.shadowSecond,
        ]}
      />
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
          return (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active, disabled }}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={[
                styles.tab,
                pillWidth === 0 && active && {
                  backgroundColor: option.activeFill,
                  borderRadius: compact ? 13 : 15,
                  borderWidth: borders.thin,
                  borderColor: colors.ink,
                },
              ]}
            >
              <View style={[styles.iconBadge, compact && styles.iconBadgeCompact, active && styles.iconBadgeActive]}>
                <AppIcon name={option.icon} size={compact ? 24 : 30} />
              </View>
              <Text
                maxFontSizeMultiplier={1.3}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                style={[
                  styles.label,
                  compact && styles.labelCompact,
                  active && { color: option.activeText },
                ]}
              >
                {option.label}
              </Text>
              {active ? (
                <View style={[styles.dot, { backgroundColor: option.dotFill }]}>
                  <Text maxFontSizeMultiplier={1.3} style={[styles.dotText, { color: option.dotText }]}>
                    ✓
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
    height: 60,
    position: 'relative',
    paddingBottom: shadows.sm + 1,
    flexShrink: 0,
  },
  outerCompact: {
    height: 50,
  },
  shadow: {
    position: 'absolute',
    top: shadows.sm + 1,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.lg,
    backgroundColor: colors.ink,
  },
  shadowFirst: {
    backgroundColor: colors.violetShadow,
  },
  shadowSecond: {
    backgroundColor: colors.peachShadow,
  },
  track: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: TRACK_PADDING,
    borderRadius: radii.lg,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    position: 'relative',
    overflow: 'hidden',
  },
  trackCompact: {
    borderRadius: radii.md + 2,
  },
  pill: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    borderRadius: 16,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    overflow: 'hidden',
  },
  pillCompact: {
    borderRadius: 12,
  },
  pillShine: {
    position: 'absolute',
    top: 2,
    left: 10,
    right: 10,
    height: 5,
    borderRadius: 4,
    backgroundColor: colors.shine,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 8,
    zIndex: 1,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.canvasDeep,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  iconBadgeCompact: {
    width: 28,
    height: 28,
    borderRadius: 9,
  },
  iconBadgeActive: {
    backgroundColor: colors.paper,
  },
  label: {
    flexShrink: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 21,
  },
  labelCompact: {
    fontSize: 15,
    lineHeight: 19,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 13,
  },
  disabled: {
    opacity: 0.5,
  },
});
