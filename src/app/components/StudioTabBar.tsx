import { memo, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../shared/hooks/useResponsiveLayout';
import * as Haptics from '../../shared/services/haptics';
import { colors, fonts, radii } from '../../shared/theme';
import { AppIcon, type AppIconName } from '../../shared/ui/AppIcon';
import { Text } from '../../shared/ui/Typography';

export type StudioTabId = 'solve' | 'study' | 'notebook';

export const STUDIO_DOCK_HEIGHT = 60;

type TabSpec = {
  id: StudioTabId;
  label: string;
  icon: AppIconName;
};

const TABS: readonly TabSpec[] = [
  { id: 'solve', label: 'Rezolvă', icon: 'scan' },
  { id: 'study', label: 'Învață', icon: 'explain' },
  { id: 'notebook', label: 'Caiet', icon: 'notebook' },
] as const;

const TRACK_PADDING = 5;
const TRACK_BORDER = 1;

type Props = {
  activeTab: StudioTabId;
  notebookBadgeCount?: number;
  onSelect: (tab: StudioTabId) => void;
};

/**
 * Floating frosted pill dock for the 3-tab Profu studio shell. Uses pure
 * native-driver spring transforms with zero Reanimated overhead.
 */
export const StudioTabBar = memo(function StudioTabBar({
  activeTab,
  notebookBadgeCount = 0,
  onSelect,
}: Props) {
  const frame = useSafeAreaFrame();
  const { contentWidth, isVeryNarrow } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);

  const activeIndex = Math.max(0, TABS.findIndex((tab) => tab.id === activeTab));
  const innerWidth = trackWidth - TRACK_BORDER * 2 - TRACK_PADDING * 2;
  const pillWidth = innerWidth > 0 ? innerWidth / TABS.length : 0;

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
      tension: 255,
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

  const dockWidth = Math.min(contentWidth, 412);
  const bottomOffset = Math.max(insets.bottom, 10) + 6;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.overlay, { bottom: bottomOffset }]}
    >
      <View
        collapsable={false}
        accessibilityRole="tablist"
        onLayout={handleLayout}
        style={[styles.dock, { width: dockWidth }]}
      >
        {pillWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activePill,
              {
                width: pillWidth,
                transform: [{ translateX: slideX }],
              },
            ]}
          />
        ) : null}

        <View collapsable={false} style={styles.tabsRow}>
          {TABS.map((tab) => {
            const active = tab.id === activeTab;
            const showBadge = tab.id === 'notebook' && notebookBadgeCount > 0;
            return (
              <Pressable
                key={tab.id}
                collapsable={false}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tab.label}
                onPress={() => {
                  if (active) return;
                  Haptics.selection();
                  onSelect(tab.id);
                }}
                style={[
                  styles.tabButton,
                  pillWidth <= 0 && active && styles.tabButtonFallbackActive,
                ]}
              >
                <View pointerEvents="none" style={styles.tabInner}>
                  <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                    <AppIcon name={tab.icon} size={isVeryNarrow ? 20 : 22} />
                    {showBadge ? (
                      <View
                        collapsable={false}
                        style={[styles.badgeDot, active && styles.badgeDotActive]}
                      >
                        <Text
                          maxFontSizeMultiplier={1.05}
                          style={[styles.badgeText, active && styles.badgeTextActive]}
                        >
                          {notebookBadgeCount > 99 ? '99+' : notebookBadgeCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    maxFontSizeMultiplier={1.15}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    style={[
                      styles.label,
                      isVeryNarrow && styles.labelNarrow,
                      active && styles.labelActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  dock: {
    height: STUDIO_DOCK_HEIGHT,
    padding: TRACK_PADDING,
    borderRadius: radii.pill,
    borderWidth: TRACK_BORDER,
    borderColor: 'rgba(124, 60, 255, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    position: 'relative',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#32107C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
  },
  activePill: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    borderRadius: radii.pill,
    backgroundColor: colors.violet,
    zIndex: 1,
  },
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    zIndex: 2,
  },
  tabButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  tabButtonFallbackActive: {
    backgroundColor: colors.violet,
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  label: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.inkSoft,
    fontSize: 12.5,
    lineHeight: 16,
    includeFontPadding: false,
  },
  labelNarrow: {
    fontSize: 11.5,
  },
  labelActive: {
    color: colors.paper,
  },
  badgeDot: {
    position: 'absolute',
    top: -4,
    right: -7,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.violet,
    borderWidth: 1.5,
    borderColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDotActive: {
    backgroundColor: colors.lime,
    borderColor: colors.violet,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 9,
    lineHeight: 11,
    includeFontPadding: false,
  },
  badgeTextActive: {
    color: colors.ink,
  },
});
