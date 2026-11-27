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

const TRACK_PADDING = 4.5;
const TRACK_BORDER = 1.5;
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
        <View
          style={[
            styles.iconWell,
            compact && styles.iconWellCompact,
            active ? styles.iconWellActive : styles.iconWellInactive,
          ]}
        >
          <AppIcon name={option.icon} size={compact ? 19 : 23} />
        </View>
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
 * Sculpted flagship dual-mode studio switcher driven by pure native-driver
 * spring motion with rich multi-stop gradient indicator, icon wells, and
 * micro-subtitles — zero elevation overdraw and zero Reanimated overhead.
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
        <View pointerEvents="none" style={styles.trackTopRim} />

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
    height: 50,
    position: 'relative',
    flexShrink: 0,
  },
  outerRich: {
    height: 58,
  },
  outerCompact: {
    height: 43,
  },
  track: {
    flex: 1,
    padding: TRACK_PADDING,
    borderRadius: 25,
    borderWidth: TRACK_BORDER,
    borderBottomWidth: 4,
    borderColor: '#FFFFFF',
    borderBottomColor: '#D4C1F8',
    backgroundColor: '#F6F1FF',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#4315B8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  trackRich: {
    borderRadius: 24,
  },
  trackTopRim: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 0,
  },
  pill: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    zIndex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(18, 5, 58, 0.28)',
    overflow: 'hidden',
  },
  pillRich: {
    borderRadius: 19,
  },
  pillGloss: {
    position: 'absolute',
    top: 1.5,
    left: 16,
    right: 16,
    height: 2,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.36)',
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
  iconWell: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconWellCompact: {
    width: 26,
    height: 26,
    borderRadius: 9,
  },
  iconWellActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.96)',
  },
  iconWellInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DDFC',
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
    fontSize: 16,
    lineHeight: 19,
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
  labelCompact: {
    fontSize: 14,
    lineHeight: 17,
  },
  activeDot: {
    width: 6,
    height: 6,
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
    color: 'rgba(255, 255, 255, 0.84)',
  },
  subtitleInactive: {
    color: colors.inkSoft,
  },
  disabled: {
    opacity: 0.48,
  },
});
