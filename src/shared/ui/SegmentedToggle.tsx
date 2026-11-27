import { LinearGradient } from 'expo-linear-gradient';
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
import { colors, fonts, radii } from '../theme';
import { AppIcon, type AppIconName } from './AppIcon';
import { Text } from './Typography';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  subtitle?: string;
  icon: AppIconName;
  activeFill: string;
  activeGradient?: readonly [string, string, ...string[]];
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
const TRACK_BORDER = 1;
const PRESS_RETENTION = { top: 28, bottom: 28, left: 28, right: 28 };

type SegmentItemProps<T extends string> = {
  option: SegmentedOption<T>;
  active: boolean;
  disabled: boolean;
  compact: boolean;
  hasPill: boolean;
  onSelect: () => void;
};

function SegmentItem<T extends string>({
  option,
  active,
  disabled,
  compact,
  hasPill,
  onSelect,
}: SegmentItemProps<T>) {
  const showSubtitle = Boolean(option.subtitle) && !compact;

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
          borderRadius: radii.pill,
        },
      ]}
    >
      <View pointerEvents="none" style={styles.tabContent}>
        <AppIcon name={option.icon} size={compact ? 21 : 25} />
        <View style={styles.labelColumn}>
          <View style={styles.labelRow}>
            <Text
              maxFontSizeMultiplier={1.2}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              style={[
                styles.label,
                compact && styles.labelCompact,
                { color: active ? option.activeText : colors.ink },
              ]}
            >
              {option.label}
            </Text>
            {active ? (
              <View style={[styles.activeDot, { backgroundColor: option.dotFill }]} />
            ) : null}
          </View>
          {showSubtitle ? (
            <Text
              maxFontSizeMultiplier={1.1}
              numberOfLines={1}
              style={[
                styles.subtitle,
                active ? styles.subtitleActive : styles.subtitleInactive,
              ]}
            >
              {option.subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Ceramic-clean architectural dual-mode switcher driven by pure native-driver
 * spring motion with a multi-stop gradient indicator and crisp micro-subtitles
 * — zero chunky borders, zero nested icon boxes, zero Reanimated overhead.
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
  const innerWidth = trackWidth - TRACK_BORDER * 2 - TRACK_PADDING * 2;
  const pillWidth = innerWidth > 0 ? innerWidth / 2 : 0;
  const hasSubtitle = Boolean(options[0].subtitle || options[1].subtitle) && !compact;

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
      tension: 250,
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

  const gradientColors = activeOption.activeGradient ?? [activeOption.activeFill, activeOption.activeFill];

  return (
    <View
      collapsable={false}
      accessibilityRole="tablist"
      style={[
        styles.outer,
        hasSubtitle && styles.outerRich,
        compact && styles.outerCompact,
        disabled && dimWhenDisabled && styles.disabled,
        style,
      ]}
    >
      <View
        collapsable={false}
        onLayout={handleLayout}
        style={[styles.track, hasSubtitle && styles.trackRich]}
      >
        {pillWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pill,
              hasSubtitle && styles.pillRich,
              {
                width: pillWidth,
                backgroundColor: activeOption.activeFill,
                transform: [{ translateX: slideX }],
              },
            ]}
          >
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0.06, y: 0 }}
              end={{ x: 0.94, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.pillGloss} />
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
    height: 48,
    position: 'relative',
    flexShrink: 0,
  },
  outerRich: {
    height: 54,
  },
  outerCompact: {
    height: 42,
  },
  track: {
    flex: 1,
    padding: TRACK_PADDING,
    borderRadius: 22,
    borderWidth: TRACK_BORDER,
    borderColor: '#E9E0FA',
    backgroundColor: '#FFFFFF',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#3B11A8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  trackRich: {
    borderRadius: 21,
  },
  pill: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    zIndex: 1,
    borderRadius: 17,
    overflow: 'hidden',
  },
  pillRich: {
    borderRadius: 17,
  },
  pillGloss: {
    position: 'absolute',
    top: 1,
    left: 18,
    right: 18,
    height: 1.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
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
    gap: 8,
    paddingHorizontal: 10,
  },
  labelColumn: {
    flexShrink: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  label: {
    flexShrink: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 15.5,
    lineHeight: 18.5,
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
  labelCompact: {
    fontSize: 14,
    lineHeight: 17,
  },
  activeDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
    flexShrink: 0,
  },
  subtitle: {
    marginTop: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 10.5,
    lineHeight: 13,
    includeFontPadding: false,
  },
  subtitleActive: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  subtitleInactive: {
    color: colors.inkSoft,
  },
  disabled: {
    opacity: 0.48,
  },
});
