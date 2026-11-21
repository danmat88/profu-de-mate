import { useLayoutEffect, useState } from 'react';
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
  type SharedValue,
} from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { borders, colors, fonts, radii, shadows, springs } from '../theme';
import { AppIcon, type AppIconName } from './AppIcon';
import { Text } from './Typography';

const AnimatedText = Animated.createAnimatedComponent(Text);

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

type SegmentItemProps<T extends string> = {
  option: SegmentedOption<T>;
  index: 0 | 1;
  active: boolean;
  disabled: boolean;
  compact: boolean;
  hasPill: boolean;
  progress: SharedValue<number>;
  onSelect: () => void;
};

function SegmentItem<T extends string>({
  option,
  index,
  active,
  disabled,
  compact,
  hasPill,
  progress,
  onSelect,
}: SegmentItemProps<T>) {
  const labelAnimated = useAnimatedStyle(() => {
    const distance = Math.min(1, Math.abs(progress.get() - index));
    return {
      color: interpolateColor(distance, [0, 1], [option.activeText, colors.ink]),
    };
  }, [index, option.activeText]);

  const badgeAnimated = useAnimatedStyle(() => {
    const distance = Math.min(1, Math.abs(progress.get() - index));
    return {
      backgroundColor: interpolateColor(distance, [0, 1], [colors.paper, colors.canvasDeep]),
    };
  }, [index]);

  const dotAnimated = useAnimatedStyle(() => {
    const closeness = Math.max(0, 1 - Math.abs(progress.get() - index) * 1.4);
    return {
      opacity: closeness,
      transform: [{ scale: 0.65 + closeness * 0.35 }],
    };
  }, [index]);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onSelect}
      style={[
        styles.tab,
        !hasPill && active && {
          backgroundColor: option.activeFill,
          borderRadius: compact ? 12 : 15,
          borderWidth: borders.thin,
          borderColor: colors.ink,
        },
      ]}
    >
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.iconBadge, compact && styles.iconBadgeCompact, badgeAnimated]}>
          <AppIcon name={option.icon} size={compact ? 24 : 30} />
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[styles.cornerDot, { backgroundColor: option.dotFill }, dotAnimated]}
        >
          <Text maxFontSizeMultiplier={1.1} style={[styles.dotText, { color: option.dotText }]}>
            ✓
          </Text>
        </Animated.View>
      </View>
      <AnimatedText
        maxFontSizeMultiplier={1.25}
        numberOfLines={1}
        style={[
          styles.label,
          compact && styles.labelCompact,
          labelAnimated,
        ]}
      >
        {option.label}
      </AnimatedText>
    </Pressable>
  );
}

/**
 * Snappy comic two-segment control with a Reanimated spring-sliding pill,
 * smooth color-morphing labels, and zero horizontal layout jump on toggle.
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
  const activeIndex: 0 | 1 = value === options[1].value ? 1 : 0;
  const progress = useSharedValue<number>(activeIndex);

  useLayoutEffect(() => {
    if (reducedMotion) {
      progress.set(activeIndex);
    } else {
      progress.set(withSpring(activeIndex, springs.snappy));
    }
  }, [activeIndex, progress, reducedMotion]);

  const innerWidth = trackWidth - borders.regular * 2 - TRACK_PADDING * 2;
  const pillWidth = innerWidth > 0 ? innerWidth / 2 : 0;
  const firstColor = options[0].activeFill;
  const secondColor = options[1].activeFill;

  const pillStyle = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, progress.get()));
    return {
      transform: [{ translateX: p * pillWidth }],
      backgroundColor: interpolateColor(p, [0, 1], [firstColor, secondColor]),
    };
  }, [firstColor, pillWidth, secondColor]);

  const shadowStyle = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, progress.get()));
    return {
      backgroundColor: interpolateColor(p, [0, 1], [colors.violetShadow, colors.peachShadow]),
    };
  });

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
      <Animated.View pointerEvents="none" style={[styles.shadow, shadowStyle]} />
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

        {options.map((option, idx) => {
          const index = idx as 0 | 1;
          return (
            <SegmentItem
              key={option.value}
              option={option}
              index={index}
              active={index === activeIndex}
              disabled={disabled}
              compact={compact}
              hasPill={pillWidth > 0}
              progress={progress}
              onSelect={() => {
                if (option.value === value) return;
                progress.set(reducedMotion ? index : withSpring(index, springs.snappy));
                onChange(option.value);
              }}
            />
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
    backgroundColor: colors.violetShadow,
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
    gap: 8,
    paddingHorizontal: 8,
    zIndex: 1,
  },
  iconWrap: {
    position: 'relative',
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
  cornerDot: {
    position: 'absolute',
    top: -4,
    right: -5,
    width: 15,
    height: 15,
    borderRadius: 6,
    borderWidth: 1.25,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    lineHeight: 11,
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
  disabled: {
    opacity: 0.5,
  },
});
