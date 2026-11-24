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
import { colors, fonts, radii } from '../theme';
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

const TRACK_PADDING = 3.5;
const TRACK_BORDER = 1;
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
          borderRadius: radii.pill,
        },
      ]}
    >
      <View pointerEvents="none" style={styles.tabContent}>
        <Text
          maxFontSizeMultiplier={1.15}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
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
                backgroundColor: active ? badgeFill : 'rgba(124, 60, 255, 0.08)',
              },
            ]}
          >
            <Text
              maxFontSizeMultiplier={1.1}
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
 * Airy frosted studio tab bar driven by native-driver spring motion with
 * zero Reanimated overhead and zero elevation overdraw.
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
  const innerWidth = trackWidth - TRACK_BORDER * 2 - TRACK_PADDING * 2;
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
      friction: 22,
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
      <View collapsable={false} onLayout={handleLayout} style={styles.track}>
        {pillWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pill,
              {
                width: pillWidth,
                backgroundColor: activeOption?.activeFill ?? colors.violet,
                transform: [{ translateX: slideX }],
              },
            ]}
          />
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
    height: 46,
    position: 'relative',
    flexShrink: 0,
  },
  outerCompact: {
    height: 42,
  },
  track: {
    flex: 1,
    padding: TRACK_PADDING,
    borderRadius: radii.pill,
    borderWidth: TRACK_BORDER,
    borderColor: 'rgba(124, 60, 255, 0.11)',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    position: 'relative',
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    zIndex: 1,
    borderRadius: radii.pill,
    overflow: 'hidden',
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
    gap: 4,
    paddingHorizontal: 4,
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
    minHeight: 19,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeCompact: {
    minWidth: 20,
    minHeight: 18,
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
    opacity: 0.48,
  },
});
