import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../shared/hooks/useResponsiveLayout';
import {
  cosinePulseRange,
  createNativeLoop,
  SILKY_EASE_OUT,
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
  ready?: boolean;
  active?: boolean;
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
        {/* Pure crisp white 3D porcelain active pill inside the Royal-Violet capsule */}
        {active ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.activeWhitePill, activePillStyle]}
          >
            <View style={styles.activeAccentBar} />
          </Animated.View>
        ) : null}

        <View style={[styles.tabInner, active && styles.tabInnerActive]}>
          <Animated.View
            style={[
              styles.iconWrap,
              !active && styles.iconWrapInactiveBubble,
              iconMotionStyle,
            ]}
          >
            <AppIcon name={tab.icon} size={active ? (isVeryNarrow ? 28 : 31) : (isVeryNarrow ? 26 : 29)} />
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
  ready = true,
  active = true,
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

  const dockPlayed = useRef(reducedMotion || ready);
  const orbInitialWakeDone = useRef(false);
  const [dockSettled, setDockSettled] = useState(reducedMotion || ready);
  const dockEnter = useRef(new Animated.Value(reducedMotion || ready ? 1 : 0)).current;
  const orbPress = useRef(new Animated.Value(0)).current;
  const orbPulse = useRef(new Animated.Value(0)).current;
  const orbHaloReveal = useRef(new Animated.Value(0)).current;

  // Glide the Split-Island dock smoothly up from below on a pre-baked GPU texture.
  useEffect(() => {
    if (reducedMotion) {
      dockEnter.stopAnimation();
      dockEnter.setValue(1);
      dockPlayed.current = true;
      setDockSettled(true);
      return undefined;
    }
    if (!ready) {
      if (!dockPlayed.current) dockEnter.setValue(0);
      return undefined;
    }
    if (dockPlayed.current) {
      dockEnter.setValue(1);
      setDockSettled(true);
      return undefined;
    }
    dockPlayed.current = true;

    let anim: Animated.CompositeAnimation | undefined;
    const frameId = requestAnimationFrame(() => {
      anim = Animated.timing(dockEnter, {
        toValue: 1,
        duration: 540,
        delay: 360,
        easing: SILKY_EASE_OUT,
        useNativeDriver: true,
      });
      anim.start(({ finished }) => {
        if (finished) setDockSettled(true);
      });
    });
    const watchdog = setTimeout(() => {
      dockEnter.stopAnimation();
      dockEnter.setValue(1);
      setDockSettled(true);
    }, 1_060);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(watchdog);
      anim?.stop();
      dockEnter.stopAnimation();
    };
  }, [dockEnter, ready, reducedMotion]);

  // Wake the camera orb ambient halo strictly AFTER cold-start entrance settles.
  useEffect(() => {
    if (reducedMotion || !ready || !active) {
      orbPulse.stopAnimation();
      orbHaloReveal.stopAnimation();
      orbPulse.setValue(0);
      orbHaloReveal.setValue(0);
      return undefined;
    }

    let loop: Animated.CompositeAnimation | undefined;
    let fade: Animated.CompositeAnimation | undefined;
    const wakeDelay = orbInitialWakeDone.current ? 240 : 1_360;
    const timer = setTimeout(() => {
      orbInitialWakeDone.current = true;
      loop = createNativeLoop(orbPulse, 3_000);
      loop.start();
      fade = Animated.timing(orbHaloReveal, {
        toValue: 1,
        duration: 380,
        easing: SILKY_EASE_OUT,
        useNativeDriver: true,
      });
      fade.start();
    }, wakeDelay);

    return () => {
      clearTimeout(timer);
      loop?.stop();
      fade?.stop();
      orbPulse.stopAnimation();
      orbHaloReveal.stopAnimation();
    };
  }, [active, orbHaloReveal, orbPulse, ready, reducedMotion]);

  const dockEnterStyle = useMemo(
    () => ({
      opacity: dockEnter.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.01, 1, 1],
        extrapolate: 'clamp',
      }),
      transform: [
        {
          translateY: dockEnter.interpolate({
            inputRange: [0, 1],
            outputRange: [52, 0],
            extrapolate: 'clamp',
          }),
        },
        {
          scale: dockEnter.interpolate({
            inputRange: [0, 1],
            outputRange: [0.94, 1],
            extrapolate: 'clamp',
          }),
        },
      ],
    }),
    [dockEnter],
  );

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
      opacity: Animated.multiply(
        orbHaloReveal,
        orbPulse.interpolate({
          inputRange: WAVE_INPUT_17,
          outputRange: COS_PULSE.map((v) => 0.18 + v * 0.36),
        }),
      ),
      transform: [
        {
          scale: orbPulse.interpolate({
            inputRange: WAVE_INPUT_17,
            outputRange: COS_PULSE.map((v) => 0.96 + v * 0.12),
          }),
        },
      ],
    }),
    [orbHaloReveal, orbPulse],
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

      <Animated.View
        renderToHardwareTextureAndroid={!dockSettled && !reducedMotion}
        style={[styles.splitRow, { width: dockWidth }, dockEnterStyle]}
      >
        {/* Left Island: Jewel-grade Royal-Violet 3D Floating Capsule with porcelain active pill */}
        <View
          collapsable={false}
          accessibilityRole="tablist"
          style={styles.pillIsland}
        >
          <LinearGradient
            colors={['#8E4BFF', '#6722EE', '#4611BA']}
            start={{ x: 0.05, y: 0 }}
            end={{ x: 0.95, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.pillAmbientGlow} />
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
                colors={['#F4FF8C', '#D8FF3E', '#B5E808']}
                start={{ x: 0.12, y: 0 }}
                end={{ x: 0.88, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.cameraOrbShine} />
              <AppIcon name="camera" size={39} />
            </Animated.View>
          </Pressable>
          <View pointerEvents="none" style={styles.cameraSparkBadge}>
            <Text accessible={false} style={styles.cameraSparkGlyph}>✦</Text>
          </View>
        </View>
      </Animated.View>
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
    shadowColor: '#4112B5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
  },
  pillAmbientGlow: {
    position: 'absolute',
    width: 140,
    height: 90,
    borderRadius: 60,
    top: -42,
    right: -12,
    backgroundColor: 'rgba(216, 255, 62, 0.14)',
  },
  pillIslandShine: {
    position: 'absolute',
    top: 1,
    left: 26,
    right: 26,
    height: 1.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.44)',
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
    borderColor: '#FFFFFF',
    borderBottomWidth: 3.5,
    borderBottomColor: '#D6C4FA',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 3,
  },
  activeAccentBar: {
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.lime,
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
    paddingBottom: 2,
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
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.8,
    borderColor: 'rgba(255, 255, 255, 0.34)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  activeLabel: {
    fontFamily: fonts.display,
    fontSize: 15.5,
    lineHeight: 18.5,
    letterSpacing: -0.25,
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
    borderBottomColor: '#84AD00',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#5B8000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.26,
    shadowRadius: 8,
  },
  cameraOrbShine: {
    position: 'absolute',
    top: 3,
    left: 13,
    right: 13,
    height: 11,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  cameraSparkBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.violet,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  cameraSparkGlyph: {
    fontFamily: fonts.display,
    color: colors.lime,
    fontSize: 10,
    lineHeight: 12,
    includeFontPadding: false,
  },
});
