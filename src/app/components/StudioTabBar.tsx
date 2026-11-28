import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useId, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
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
import { CachedInsetRelief, CachedOutsetShadow, CachedSurface } from '../../shared/ui/CachedRelief';
import { Text } from '../../shared/ui/Typography';

export type StudioTabId = 'solve' | 'study' | 'notebook';

const PILL_HEIGHT = 64;
const CAMERA_ORB_SIZE = 64;

const DOCK_OUTSET_SHADOW = '0 6px 12px -3px rgba(24, 8, 82, 0.34), 0 2px 5px rgba(12, 4, 48, 0.20)';
const DOCK_INSET_SHADOW = 'inset 0 2.5px 5px rgba(214, 188, 255, 0.34), inset 0 -5px 10px rgba(4, 1, 18, 0.65)';
const ACTIVE_PILL_INSET_SHADOW = 'inset 0 3px 5px rgba(255, 255, 255, 1), inset 0 -4px 7px rgba(120, 68, 228, 0.22)';
const INACTIVE_ORB_SHADOW = '0 3px 6px rgba(6, 2, 26, 0.32), inset 0 2px 3px rgba(255, 255, 255, 1), inset 0 -3px 5px rgba(114, 68, 220, 0.22)';
const CAMERA_ORB_OUTSET_SHADOW = '0 6px 12px -2px rgba(96, 140, 0, 0.34), 0 2px 5px rgba(56, 86, 0, 0.20)';
const CAMERA_ORB_INSET_SHADOW = 'inset 0 4px 8px rgba(255, 255, 236, 0.86), inset 0 -6px 11px rgba(84, 124, 0, 0.40)';
const SPARK_BADGE_SHADOW = '0 2px 4px rgba(36, 8, 108, 0.30), inset 0 1.5px 2px rgba(255, 255, 255, 0.4), inset 0 -2px 3px rgba(20, 4, 72, 0.36)';

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
        {/* Sculpted white porcelain 3D active pill inside the Obsidian-Royal capsule */}
        {active ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.activeWhitePill, activePillStyle]}
          >
            <LinearGradient
              colors={['#FFFFFF', '#FAF7FF', '#F2ECFF']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <CachedInsetRelief borderRadius={26} shadow={ACTIVE_PILL_INSET_SHADOW} />
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
            {!active ? (
              <CachedSurface
                borderRadius={21}
                backgroundColor="#FBF9FF"
                shadow={INACTIVE_ORB_SHADOW}
                padTop={9}
                padX={11}
                padBottom={15}
              />
            ) : null}
            <View style={styles.iconFront}>
              <AppIcon name={tab.icon} size={active ? (isVeryNarrow ? 28 : 31) : (isVeryNarrow ? 26 : 29)} />
            </View>
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
  const dockUid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const dockCyanId = `dkCyn_${dockUid}`;
  const dockLimeId = `dkLim_${dockUid}`;

  const isHomeActive = activeTab === 'solve';
  const dockWidth = Math.round(Math.min(contentWidth, 430));
  const bottomPad = Math.max(insets.bottom, 10) + 4;

  const dockPlayed = useRef(reducedMotion || ready);
  const orbInitialWakeDone = useRef(false);
  const dockEnter = useRef(new Animated.Value(reducedMotion || ready ? 1 : 0)).current;
  const orbPress = useRef(new Animated.Value(0)).current;
  const orbPulse = useRef(new Animated.Value(0)).current;
  const orbHaloReveal = useRef(new Animated.Value(0)).current;

  // Glide the Split-Island dock smoothly up from below without a hardware texture boundary that clips elevation shadows.
  useEffect(() => {
    if (reducedMotion) {
      dockEnter.stopAnimation();
      dockEnter.setValue(1);
      dockPlayed.current = true;
      return undefined;
    }
    if (!ready) {
      if (!dockPlayed.current) dockEnter.setValue(0);
      return undefined;
    }
    if (dockPlayed.current) {
      dockEnter.setValue(1);
      return undefined;
    }
    dockPlayed.current = true;

    let anim: Animated.CompositeAnimation | undefined;
    const frameId = requestAnimationFrame(() => {
      anim = Animated.timing(dockEnter, {
        toValue: 1,
        duration: 520,
        delay: 440,
        easing: SILKY_EASE_OUT,
        useNativeDriver: true,
      });
      anim.start();
    });
    const watchdog = setTimeout(() => {
      dockEnter.stopAnimation();
      dockEnter.setValue(1);
    }, 1_300);

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
        isHomeActive && styles.dockShelfHome,
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
        style={[styles.splitRow, { width: dockWidth }, dockEnterStyle]}
      >
        {/* Left Island: Sculpted Obsidian-Royal 3D Floating Capsule with porcelain active pill */}
        <View style={styles.pillIslandShadow}>
          <CachedOutsetShadow
            borderRadius={32}
            shadow={DOCK_OUTSET_SHADOW}
            padTop={16}
            padX={20}
            padBottom={28}
          />
          <View
            collapsable={false}
            accessibilityRole="tablist"
            style={styles.pillIsland}
          >
            <LinearGradient
              colors={['#3A198E', '#240D61', '#15063D']}
              start={{ x: 0.04, y: 0 }}
              end={{ x: 0.96, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Svg
              pointerEvents="none"
              width="100%"
              height="100%"
              viewBox="0 0 280 64"
              preserveAspectRatio="none"
              style={StyleSheet.absoluteFill}
            >
              <Defs>
                <RadialGradient id={dockCyanId} cx="18%" cy="10%" rx="48%" ry="85%">
                  <Stop offset="0%" stopColor="#8F54FF" stopOpacity="0.4" />
                  <Stop offset="62%" stopColor="#43D6E6" stopOpacity="0.1" />
                  <Stop offset="100%" stopColor="#43D6E6" stopOpacity="0" />
                </RadialGradient>
                <RadialGradient id={dockLimeId} cx="94%" cy="55%" rx="34%" ry="80%">
                  <Stop offset="0%" stopColor="#D8FF3E" stopOpacity="0.22" />
                  <Stop offset="60%" stopColor="#D8FF3E" stopOpacity="0.05" />
                  <Stop offset="100%" stopColor="#D8FF3E" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Rect x={0} y={0} width={280} height={64} fill={`url(#${dockCyanId})`} />
              <Rect x={0} y={0} width={280} height={64} fill={`url(#${dockLimeId})`} />
            </Svg>
            <CachedInsetRelief borderRadius={31} shadow={DOCK_INSET_SHADOW} zIndex={1} />

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
            <Animated.View pointerEvents="none" style={[styles.cameraOrbShadow, orbMotionStyle]}>
              <CachedOutsetShadow
                borderRadius={CAMERA_ORB_SIZE / 2}
                shadow={CAMERA_ORB_OUTSET_SHADOW}
                padTop={16}
                padX={20}
                padBottom={28}
              />
              <View style={styles.cameraOrb}>
                <LinearGradient
                  colors={['#F2FF82', '#D8FF3E', '#B2E408']}
                  start={{ x: 0.14, y: 0 }}
                  end={{ x: 0.86, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <CachedInsetRelief borderRadius={CAMERA_ORB_SIZE / 2} shadow={CAMERA_ORB_INSET_SHADOW} />
                <View style={styles.iconFront}>
                  <AppIcon name="camera" size={39} />
                </View>
              </View>
            </Animated.View>
          </Pressable>
          <View pointerEvents="none" style={styles.cameraSparkBadge}>
            <CachedSurface
              borderRadius={10}
              backgroundColor={colors.violet}
              borderWidth={2}
              borderColor="#FFFFFF"
              shadow={SPARK_BADGE_SHADOW}
              padTop={7}
              padX={8}
              padBottom={11}
            />
            <Text accessible={false} style={styles.cameraSparkGlyph}>✦</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  dockShelf: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.canvas,
    paddingTop: 10,
    alignItems: 'center',
    zIndex: 20,
  },
  dockShelfHome: {
    backgroundColor: 'transparent',
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
  pillIslandShadow: {
    flex: 1,
    minWidth: 0,
    height: PILL_HEIGHT,
    position: 'relative',
  },
  pillIsland: {
    flex: 1,
    borderRadius: 32,
    padding: 5.5,
    borderWidth: 1,
    borderColor: 'rgba(196, 166, 255, 0.26)',
    backgroundColor: '#1E0B52',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 5,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  tabButton: {
    minWidth: 0,
    alignItems: 'stretch',
    justifyContent: 'center',
    zIndex: 2,
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
    overflow: 'hidden',
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
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  iconFront: {
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
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
  cameraOrbShadow: {
    width: CAMERA_ORB_SIZE,
    height: CAMERA_ORB_SIZE,
    position: 'relative',
  },
  cameraOrb: {
    width: CAMERA_ORB_SIZE,
    height: CAMERA_ORB_SIZE,
    borderRadius: CAMERA_ORB_SIZE / 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  cameraSparkBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
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
    zIndex: 2,
  },
});
