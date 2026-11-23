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
import * as Haptics from '../services/haptics';
import { borders, colors, fonts, shadows } from '../theme';
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
const PRESS_RETENTION = { top: 24, bottom: 24, left: 24, right: 24 };

type TabItemProps<T extends string> = {
  option: ComicTabOption<T>;
  active: boolean;
  disabled: boolean;
  compact: boolean;
  hasPill: boolean;
  onSelect: () => void;
};

function ComicTabItem<T extends string>({
  option,
  active,
  disabled,
  compact,
  hasPill,
  onSelect,
}: TabItemProps<T>) {
  const activeFill = option.activeFill ?? colors.violet;
  const activeText = option.activeText ?? colors.paper;
  const badgeFill = option.badgeFill ?? colors.lime;
  const badgeText = option.badgeText ?? colors.ink;

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
          backgroundColor: activeFill,
          borderRadius: compact ? 10 : 12,
          borderWidth: 1.5,
          borderColor: colors.ink,
        },
      ]}
    >
      <View pointerEvents="none" style={styles.tabContent}>
        <Text
          maxFontSizeMultiplier={1.2}
          numberOfLines={1}
          style={[
            styles.label,
            compact && styles.labelCompact,
            { color: active ? activeText : colors.inkSoft },
          ]}
        >
          {option.label}
        </Text>
        {option.badge !== undefined ? (
          <View
            collapsable={false}
            style={[
              styles.badge,
              compact && styles.badgeCompact,
              {
                backgroundColor: active ? badgeFill : colors.violetSoft,
                borderColor: active ? colors.ink : colors.violetSoft,
              },
            ]}
          >
            <Text
              maxFontSizeMultiplier={1.15}
              style={[
                styles.badgeText,
                compact && styles.badgeTextCompact,
                { color: active ? badgeText : colors.violetDeep },
              ]}
            >
              {option.badge}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Snappy comic tab bar driven by native-driver spring motion and React state
 * colors so initial screen mounts incur zero Reanimated worklet overhead and
 * tabs stay immune to Android Fabric view detachment.
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
  const activeOption = options[activeIndex];
  const count = Math.max(1, options.length);
  const innerWidth = trackWidth - borders.regular * 2 - TRACK_PADDING * 2;
  const pillWidth = innerWidth > 0 ? innerWidth / count : 0;

  const slideX = useRef(new Animated.Value(0)).current;
  const measuredWidthRef = useRef(0);
  const lastIndexRef = useRef(activeIndex);

  useEffect(() => {
    if (pillWidth <= 0) return undefined;
    const target = activeIndex * pillWidth;
    const widthChanged = Math.abs(measuredWidthRef.current - pillWidth) > 0.5;
    const indexChanged = lastIndexRef.current !== activeIndex;
    measuredWidthRef.current = pillWidth;
    lastIndexRef.current = activeIndex;

    slideX.stopAnimation();
    if (reducedMotion || (widthChanged && !indexChanged)) {
      slideX.setValue(target);
      return undefined;
    }
    Animated.spring(slideX, {
      toValue: target,
      tension: 250,
      friction: 20,
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
        disabled && styles.disabled,
        style,
      ]}
    >
      <View pointerEvents="none" style={styles.shadow} />
      <View collapsable={false} onLayout={handleLayout} style={[styles.track, compact && styles.trackCompact]}>
        {pillWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pill,
              compact && styles.pillCompact,
              {
                width: pillWidth,
                backgroundColor: activeOption?.activeFill ?? colors.violet,
                transform: [{ translateX: slideX }],
              },
            ]}
          >
            <View pointerEvents="none" style={styles.pillShine} />
          </Animated.View>
        ) : null}

        <View collapsable={false} style={styles.tabsRow}>
          {options.map((option, index) => (
            <ComicTabItem
              key={option.value}
              option={option}
              active={index === activeIndex}
              disabled={disabled}
              compact={compact}
              hasPill={pillWidth > 0}
              onSelect={() => {
                if (disabled || option.value === value) return;
                Haptics.selection();
                onChange(option.value);
              }}
            />
          ))}
        </View>
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
    zIndex: 1,
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
  tabsRow: {
    flex: 1,
    zIndex: 2,
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
    gap: 5,
    paddingHorizontal: 6,
  },
  label: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.inkSoft,
    fontSize: 12.5,
    lineHeight: 16,
    includeFontPadding: false,
  },
  labelCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  badge: {
    flexShrink: 0,
    minWidth: 22,
    minHeight: 20,
    borderRadius: 7,
    borderWidth: 1.25,
    borderColor: colors.violetSoft,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeCompact: {
    minWidth: 20,
    minHeight: 19,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  badgeTextCompact: {
    fontSize: 10.5,
    lineHeight: 14,
  },
  disabled: {
    opacity: 0.5,
  },
});
