import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../shared/hooks/useResponsiveLayout';
import {
  cosinePulseRange,
  createNativeLoop,
  WAVE_INPUT_17,
} from '../../shared/motion/nativeMotion';
import * as Haptics from '../../shared/services/haptics';
import { colors, fonts, radii } from '../../shared/theme';
import { AppIcon, type AppIconName } from '../../shared/ui/AppIcon';
import { Text } from '../../shared/ui/Typography';

export type StudioTabId = 'solve' | 'study' | 'notebook';

const PILL_HEIGHT = 64;
const CAMERA_ORB_SIZE = 64;

export const STUDIO_DOCK_HEIGHT = PILL_HEIGHT + 16;

const COS_PULSE = cosinePulseRange(0, 1);

type TabSpec = {
  id: StudioTabId;
  label: string;
  icon: AppIconName;
  activeLabelColor: string;
};

const TABS: readonly TabSpec[] = [
  {
    id: 'solve',
    label: 'Rezolvă',
    icon: 'scan',
    activeLabelColor: colors.violetDeep,
  },
  {
    id: 'study',
    label: 'Învață',
    icon: 'class',
    activeLabelColor: colors.violetDeep,
  },
  {
    id: 'notebook',
    label: 'Caiet',
    icon: 'notebook',
    activeLabelColor: colors.ink,
  },
] as const;

type Props = {
  activeTab: StudioTabId;
  notebookBadgeCount?: number;
  studyDot?: boolean;
  onSelect: (tab: StudioTabId) => void;
  onQuickCapture?: () => void;
};

type MorphTabProps = {
  tab: TabSpec;
  active: boolean;
  badgeCount: number;
  showDot: boolean;
  isVeryNarrow: boolean;
  reducedMotion: boolean;
  onPress: () => void;
};

const MorphTabButton = memo(function MorphTabButton({
  tab,
  active,
  badgeCount,
  showDot,
  isVeryNarrow,
  reducedMotion,
  onPress,
}: MorphTabProps) {
  const focusAnim = useRef(new Animated.Value(active ? 1 : 0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    focusAnim.stopAnimation();
    if (reducedMotion) {
      focusAnim.setValue(active ? 1 : 0);
      return undefined;
    }
    const anim = Animated.spring(focusAnim, {
      toValue: active ? 1 : 0,
      tension: 300,
      friction: 21,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [active, focusAnim, reducedMotion]);

  const iconMotionStyle = useMemo(
    () => ({
      transform: [
        {
          scale: focusAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.95, 1.07],
          }),
        },
        {
          rotate: focusAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '-4deg'],
          }),
        },
      ],
    }),
    [focusAnim],
  );

  const activePillStyle = useMemo(
    () => ({
      opacity: focusAnim,
      transform: [
        {
          scale: focusAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.86, 1],
          }),
        },
      ],
    }),
    [focusAnim],
  );

  const pressStyle = useMemo(
    () => ({ transform: [{ scale: pressAnim }] }),
    [pressAnim],
  );

  const handlePressIn = () => {
    if (reducedMotion) return;
    pressAnim.stopAnimation();
    Animated.timing(pressAnim, {
      toValue: 0.93,
      duration: 75,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reducedMotion) return;
    pressAnim.stopAnimation();
    Animated.spring(pressAnim, {
      toValue: 1,
      tension: 330,
      friction: 18,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      collapsable={false}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={tab.label}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={[
        styles.tabButton,
        active ? styles.tabButtonActive : styles.tabButtonInactive,
      ]}
    >
      <Animated.View pointerEvents="none" style={[styles.tabFill, pressStyle]}>
        {/* Pure crisp white 3D morphing active pill inside the Royal-Violet capsule */}
        {active ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.activeWhitePill, activePillStyle]}
          />
        ) : null}

        <View style={[styles.tabInner, active && styles.tabInnerActive]}>
          <Animated.View
            style={[
              styles.iconWrap,
              !active && styles.iconWrapInactiveBubble,
              iconMotionStyle,
            ]}
          >
            <AppIcon name={tab.icon} size={isVeryNarrow ? 27 : 30} />
            {badgeCount > 0 ? (
              <View collapsable={false} style={[styles.badgePill, active && styles.badgePillActive]}>
                <Text
                  maxFontSizeMultiplier={1.05}
                  style={[styles.badgeText, active && styles.badgeTextActive]}
                >
                  {badgeCount > 99 ? '99+' : badgeCount}
                </Text>
              </View>
            ) : showDot ? (
              <View collapsable={false} style={styles.studyPulseDot} />
            ) : null}
          </Animated.View>

          {active ? (
            <Text
              maxFontSizeMultiplier={1.12}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              style={[
                styles.activeLabel,
                isVeryNarrow && styles.activeLabelNarrow,
                { color: tab.activeLabelColor },
              ]}
            >
              {tab.label}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
});

/**
 * Bookended Royal-Violet & Electric-Lime Split-Island Morph Dock: pairs a
 * vibrant Royal-Violet 3D floating tab capsule (where the active tab morphs
 * open into pure crisp white so illustrated PNGs shine with maximum contrast)
 * with a detached Electric-Lime 3D Quick-Camera Orb reachable from every tab.
 */
export const StudioTabBar = memo(function StudioTabBar({
  activeTab,
  notebookBadgeCount = 0,
  studyDot = false,
  onSelect,
  onQuickCapture,
}: Props) {
  const frame = useSafeAreaFrame();
  const { contentWidth, gutter, isVeryNarrow } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const isHomeActive = activeTab === 'solve';
  const dockWidth = Math.round(Math.min(contentWidth, 430));
  const bottomPad = Math.max(insets.bottom, 10) + 4;

  const orbPress = useRef(new Animated.Value(0)).current;
  const orbPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      orbPulse.stopAnimation();
      orbPulse.setValue(0);
      return undefined;
    }
    const loop = createNativeLoop(orbPulse, 3_000);
    loop.start();
    return () => {
      loop.stop();
      orbPulse.stopAnimation();
    };
  }, [orbPulse, reducedMotion]);

  const orbMotionStyle = useMemo(
    () => ({
      transform: [
        {
          scale: orbPress.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.9],
          }),
        },
        {
          translateY: orbPress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 3],
          }),
        },
      ],
    }),
    [orbPress],
  );

  const orbHaloStyle = useMemo(
    () => ({
      opacity: orbPulse.interpolate({
        inputRange: WAVE_INPUT_17,
        outputRange: COS_PULSE.map((v) => 0.18 + v * 0.36),
      }),
      transform: [
        {
          scale: orbPulse.interpolate({
            inputRange: WAVE_INPUT_17,
            outputRange: COS_PULSE.map((v) => 0.96 + v * 0.12),
          }),
        },
      ],
    }),
    [orbPulse],
  );

  const handleOrbPressIn = () => {
    if (reducedMotion) return;
    orbPress.stopAnimation();
    Animated.timing(orbPress, {
      toValue: 1,
      duration: 80,
      useNativeDriver: true,
    }).start();
  };

  const handleOrbPressOut = () => {
    if (reducedMotion) return;
    orbPress.stopAnimation();
    Animated.spring(orbPress, {
      toValue: 0,
      tension: 340,
      friction: 17,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View
      style={[
        styles.dockShelf,
        {
          paddingHorizontal: gutter,
          paddingBottom: bottomPad,
        },
      ]}
    >
      {!isHomeActive ? (
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255, 248, 236, 0)', colors.canvas]}
          style={styles.topMist}
        />
      ) : null}

      <View style={[styles.splitRow, { width: dockWidth }]}>
        {/* Left Island: Vibrant Royal-Violet 3D Floating Capsule with pure-white morphing active pill */}
        <View
          collapsable={false}
          accessibilityRole="tablist"
          style={styles.pillIsland}
        >
          <LinearGradient
            colors={['#8443FF', '#6421EA', '#4C14C2']}
            start={{ x: 0.05, y: 0 }}
            end={{ x: 0.95, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.pillIslandShine} />

          {TABS.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <MorphTabButton
                key={tab.id}
                tab={tab}
                active={active}
                badgeCount={tab.id === 'notebook' ? notebookBadgeCount : 0}
                showDot={tab.id === 'study' && studyDot && !active}
                isVeryNarrow={isVeryNarrow}
                reducedMotion={reducedMotion}
                onPress={() => {
                  if (active) return;
                  Haptics.selection();
                  onSelect(tab.id);
                }}
              />
            );
          })}
        </View>

        {/* Right Detached Island: Always-Ready Floating Electric-Lime 3D Quick-Camera Orb */}
        <View style={styles.cameraIslandWrap}>
          <Animated.View pointerEvents="none" style={[styles.cameraPulseRing, orbHaloStyle]} />
          <Pressable
            collapsable={false}
            accessibilityRole="button"
            accessibilityLabel="Deschide camera pentru scanare rapidă"
            onPressIn={handleOrbPressIn}
            onPressOut={handleOrbPressOut}
            onPress={() => {
              Haptics.impact(Haptics.ImpactFeedbackStyle.Medium);
              onQuickCapture?.();
            }}
            style={styles.cameraHitTarget}
          >
            <Animated.View pointerEvents="none" style={[styles.cameraOrb, orbMotionStyle]}>
              <LinearGradient
                colors={['#EEFF7A', '#D7FF33', '#BCEE18']}
                start={{ x: 0.12, y: 0 }}
                end={{ x: 0.88, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.cameraOrbShine} />
              <AppIcon name="camera" size={38} />
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  dockShelf: {
    width: '100%',
    backgroundColor: colors.canvas,
    paddingTop: 10,
    alignItems: 'center',
    position: 'relative',
    zIndex: 20,
  },
  topMist: {
    position: 'absolute',
    top: -10,
    left: 0,
    right: 0,
    height: 10,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  pillIsland: {
    flex: 1,
    minWidth: 0,
    height: PILL_HEIGHT,
    padding: 5.5,
    borderRadius: 32,
    borderWidth: 1.4,
    borderBottomWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    borderBottomColor: '#360E91',
    backgroundColor: colors.violet,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 5,
    overflow: 'hidden',
    position: 'relative',
    elevation: 7,
    shadowColor: '#4112B5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
  },
  pillIslandShine: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.36)',
  },
  tabButton: {
    minWidth: 0,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  tabButtonActive: {
    flex: 2.08,
  },
  tabButtonInactive: {
    flex: 1,
  },
  tabFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeWhitePill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderBottomWidth: 3,
    borderBottomColor: '#DFD2FA',
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    zIndex: 2,
  },
  tabInnerActive: {
    gap: 7,
    paddingHorizontal: 11,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  iconWrapInactiveBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
  },
  activeLabel: {
    fontFamily: fonts.display,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: -0.2,
    flexShrink: 1,
    includeFontPadding: false,
  },
  activeLabelNarrow: {
    fontSize: 13.5,
    lineHeight: 16,
  },
  badgePill: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 17,
    paddingHorizontal: 4.5,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: '#5B1EE0',
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePillActive: {
    borderColor: '#FFFFFF',
    backgroundColor: colors.violet,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 9.5,
    lineHeight: 11,
    includeFontPadding: false,
  },
  badgeTextActive: {
    color: colors.paper,
  },
  studyPulseDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
    borderColor: '#5B1EE0',
    backgroundColor: colors.lime,
  },

  cameraIslandWrap: {
    width: CAMERA_ORB_SIZE,
    height: CAMERA_ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  cameraPulseRing: {
    position: 'absolute',
    width: CAMERA_ORB_SIZE + 8,
    height: CAMERA_ORB_SIZE + 8,
    borderRadius: (CAMERA_ORB_SIZE + 8) / 2,
    borderWidth: 2,
    borderColor: colors.lime,
    backgroundColor: 'rgba(216, 255, 62, 0.18)',
  },
  cameraHitTarget: {
    width: CAMERA_ORB_SIZE,
    height: CAMERA_ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraOrb: {
    width: CAMERA_ORB_SIZE,
    height: CAMERA_ORB_SIZE,
    borderRadius: CAMERA_ORB_SIZE / 2,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    borderBottomWidth: 5,
    borderBottomColor: '#8BB500',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#5B8000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
  },
  cameraOrbShine: {
    position: 'absolute',
    top: 3,
    left: 13,
    right: 13,
    height: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
  },
});
