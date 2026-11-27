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
import { CachedInsetRelief, CachedOutsetShadow, CachedSurface } from './CachedRelief';
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

const TRACK_OUTSET_SHADOW = '0 5px 10px -2px rgba(56, 18, 160, 0.14), 0 2px 4px rgba(56, 18, 160, 0.08)';
const TRACK_RECESS_SHADOW = 'inset 0 2.5px 6px rgba(66, 22, 178, 0.13), inset 0 -2px 4px rgba(255, 255, 255, 0.94)';
const PILL_OUTSET_SHADOW = '0 2px 5px -1px rgba(60, 16, 176, 0.28), 0 1px 2px rgba(28, 6, 98, 0.16)';
const PILL_INSET_SHADOW = 'inset 0 3px 5px rgba(255, 255, 255, 0.44), inset 0 -4px 8px rgba(18, 4, 68, 0.34)';
const ICON_WELL_ACTIVE_SHADOW = '0 2px 4px rgba(34, 8, 108, 0.18), inset 0 2px 3px rgba(255, 255, 255, 1), inset 0 -2px 3.5px rgba(108, 66, 212, 0.15)';
const ICON_WELL_INACTIVE_SHADOW = '0 2px 4px rgba(64, 24, 172, 0.11), inset 0 2px 3px rgba(255, 255, 255, 1), inset 0 -2px 3.5px rgba(114, 72, 220, 0.12)';

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
        <View style={[styles.iconWell, compact && styles.iconWellCompact]}>
          <CachedSurface
            borderRadius={compact ? 9 : 12}
            backgroundColor="#FFFFFF"
            shadow={active ? ICON_WELL_ACTIVE_SHADOW : ICON_WELL_INACTIVE_SHADOW}
            padTop={8}
            padX={9}
            padBottom={12}
          />
          <View style={styles.iconFront}>
            <AppIcon name={option.icon} size={compact ? 19 : 23} />
          </View>
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
      <CachedOutsetShadow
        borderRadius={hasSubtitle ? 24 : 25}
        shadow={TRACK_OUTSET_SHADOW}
        padTop={14}
        padX={18}
        padBottom={24}
      />
      <View
        collapsable={false}
        onLayout={handleLayout}
        style={[styles.track, hasSubtitle && styles.trackRich]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={['#EFE7FF', '#F7F3FF', '#FFFFFF']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <CachedInsetRelief
          borderRadius={hasSubtitle ? 23 : 24}
          shadow={TRACK_RECESS_SHADOW}
          zIndex={0}
        />

        {pillWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pillWrap,
              {
                width: pillWidth,
                transform: [{ translateX: slideX }],
              },
            ]}
          >
            <CachedOutsetShadow
              borderRadius={hasSubtitle ? 19 : 20}
              shadow={PILL_OUTSET_SHADOW}
              padTop={8}
              padX={10}
              padBottom={12}
            />
            <View
              style={[
                styles.pill,
                hasSubtitle && styles.pillRich,
                { backgroundColor: activeOption.activeFill },
              ]}
            >
              <LinearGradient
                colors={gradientColors}
                start={{ x: 0.06, y: 0 }}
                end={{ x: 0.94, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <CachedInsetRelief
                borderRadius={hasSubtitle ? 19 : 20}
                shadow={PILL_INSET_SHADOW}
              />
            </View>
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
    borderRadius: 25,
    position: 'relative',
    flexShrink: 0,
  },
  outerRich: {
    height: 58,
    borderRadius: 24,
  },
  outerCompact: {
    height: 43,
  },
  track: {
    flex: 1,
    padding: TRACK_PADDING,
    borderRadius: 25,
    borderWidth: TRACK_BORDER,
    borderColor: '#FFFFFF',
    backgroundColor: '#F6F1FF',
    position: 'relative',
    overflow: 'hidden',
  },
  trackRich: {
    borderRadius: 24,
  },
  pillWrap: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    zIndex: 1,
  },
  pill: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  pillRich: {
    borderRadius: 19,
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
    position: 'relative',
    flexShrink: 0,
  },
  iconWellCompact: {
    width: 26,
    height: 26,
    borderRadius: 9,
  },
  iconFront: {
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
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
