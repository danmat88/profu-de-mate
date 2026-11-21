import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { borders, colors, fonts, radii, shadows } from '../theme';
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
  /** Dim opacity when disabled (default true). Pass false for crisp transient locks. */
  dimWhenDisabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

const TRACK_PADDING = 4;
const PRESS_RETENTION = { top: 28, bottom: 28, left: 28, right: 28 };

type SegmentItemProps<T extends string> = {
  option: SegmentedOption<T>;
  active: boolean;
  disabled: boolean;
  compact: boolean;
  hasPill: boolean;
  reducedMotion: boolean;
  onSelect: () => void;
};

function SegmentItem<T extends string>({
  option,
  active,
  disabled,
  compact,
  hasPill,
  reducedMotion,
  onSelect,
}: SegmentItemProps<T>) {
  const dotAnim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    dotAnim.stopAnimation();
    if (reducedMotion) {
      dotAnim.setValue(active ? 1 : 0);
      return;
    }
    Animated.spring(dotAnim, {
      toValue: active ? 1 : 0,
      tension: 320,
      friction: 22,
      useNativeDriver: true,
    }).start();
    return () => {
      dotAnim.stopAnimation();
    };
  }, [active, dotAnim, reducedMotion]);

  const dotScale = dotAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.65, 1],
  });

  return (
    <Pressable
      collapsable={false}
      accessibilityRole="tab"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      pressRetentionOffset={PRESS_RETENTION}
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
      <View pointerEvents="none" style={styles.tabContent}>
        <View style={styles.iconWrap}>
          <View
            style={[
              styles.iconBadge,
              compact && styles.iconBadgeCompact,
              { backgroundColor: active ? colors.paper : colors.canvasDeep },
            ]}
          >
            <AppIcon name={option.icon} size={compact ? 24 : 30} />
          </View>
          <Animated.View
            style={[
              styles.cornerDot,
              {
                backgroundColor: option.dotFill,
                opacity: dotAnim,
                transform: [{ scale: dotScale }],
              },
            ]}
          >
            <Text maxFontSizeMultiplier={1.1} style={[styles.dotText, { color: option.dotText }]}>
              ✓
            </Text>
          </Animated.View>
        </View>
        <Text
          maxFontSizeMultiplier={1.25}
          numberOfLines={1}
          style={[
            styles.label,
            compact && styles.labelCompact,
            { color: active ? option.activeText : colors.ink },
          ]}
        >
          {option.label}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Snappy comic two-segment control driven by React state and native-driver
 * spring motion so screen detaches on Android Fabric can never freeze tabs
 * or desync active colors.
 */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  dimWhenDisabled = true,
  compact = false,
  style,
}: Props<T>) {
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex: 0 | 1 = value === options[1].value ? 1 : 0;
  const activeOption = options[activeIndex];
  const innerWidth = trackWidth - borders.regular * 2 - TRACK_PADDING * 2;
  const pillWidth = innerWidth > 0 ? innerWidth / 2 : 0;

  const slideX = useRef(new Animated.Value(0)).current;
  const measuredWidthRef = useRef(0);
  const lastAnimatedIndexRef = useRef<0 | 1>(activeIndex);

  useEffect(() => {
    if (pillWidth <= 0) return;
    const target = activeIndex * pillWidth;
    const widthChanged = Math.abs(measuredWidthRef.current - pillWidth) > 0.5;
    const indexChanged = lastAnimatedIndexRef.current !== activeIndex;
    measuredWidthRef.current = pillWidth;
    lastAnimatedIndexRef.current = activeIndex;

    slideX.stopAnimation();
    if (reducedMotion || (widthChanged && !indexChanged)) {
      slideX.setValue(target);
      return;
    }
    Animated.spring(slideX, {
      toValue: target,
      tension: 260,
      friction: 24,
      useNativeDriver: true,
    }).start();

    return () => {
      slideX.stopAnimation();
    };
  }, [activeIndex, pillWidth, reducedMotion, slideX]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0 && Math.abs(nextWidth - trackWidth) > 0.5) {
      setTrackWidth(nextWidth);
    }
  };

  return (
    <View
      collapsable={false}
      accessibilityRole="tablist"
      style={[
        styles.outer,
        compact && styles.outerCompact,
        disabled && dimWhenDisabled && styles.disabled,
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.shadow,
          { backgroundColor: activeIndex === 0 ? colors.violetShadow : colors.peachShadow },
        ]}
      />
      <View
        collapsable={false}
        onLayout={handleLayout}
        style={[styles.track, compact && styles.trackCompact]}
      >
        {pillWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pill,
              compact && styles.pillCompact,
              {
                width: pillWidth,
                backgroundColor: activeOption.activeFill,
                transform: [{ translateX: slideX }],
              },
            ]}
          >
            <View pointerEvents="none" style={styles.pillShine} />
          </Animated.View>
        ) : null}

        <View collapsable={false} style={styles.tabsRow}>
          {options.map((option, idx) => {
            const index = idx as 0 | 1;
            return (
              <SegmentItem
                key={option.value}
                option={option}
                active={index === activeIndex}
                disabled={disabled}
                compact={compact}
                hasPill={pillWidth > 0}
                reducedMotion={reducedMotion}
                onSelect={() => {
                  if (disabled || option.value === value) return;
                  onChange(option.value);
                }}
              />
            );
          })}
        </View>
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
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
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
