import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import * as Haptics from '../services/haptics';
import { colors, fonts } from '../theme';
import { AppIcon } from './AppIcon';
import { CachedInsetRelief, CachedOutsetShadow, LIQUID_SHADOWS } from './CachedRelief';
import { Text } from './Typography';

const CARD_ORB_INSET = 'inset 0 2px 3px rgba(255, 255, 255, 1), inset 0 -2.5px 4px rgba(102, 58, 214, 0.14)';
const GOLD_ORB_INSET = 'inset 0 2px 3px rgba(255, 254, 240, 1), inset 0 -3px 5px rgba(212, 144, 0, 0.24)';

type Props = {
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: 'card' | 'canopy';
  icon?: 'star' | 'bookmark';
  stopPropagation?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const SPARKLE_SPECS = [
  { angle: -90, dist: 24, color: '#FFD43B', size: 6.5 },
  { angle: -30, dist: 23, color: '#D8FF3E', size: 5.5 },
  { angle: 30, dist: 24, color: '#FF9E57', size: 6 },
  { angle: 90, dist: 22, color: '#FFD43B', size: 5.5 },
  { angle: 150, dist: 24, color: '#6CE5FF', size: 5.5 },
  { angle: 210, dist: 23, color: '#D8FF3E', size: 6.5 },
] as const;

/**
 * Celebratory favorite button powered 100% by pure native-driver Animated.
 * Plays a spring pop + radial golden sparkle burst ONLY when transitioning
 * from unfavorited -> favorited (never on list mount/scroll), and unmounts
 * burst particles as soon as the 460ms animation completes.
 */
export const FavoriteStarButton = memo(function FavoriteStarButton({
  active,
  onPress,
  accessibilityLabel,
  variant = 'card',
  icon = 'star',
  stopPropagation = false,
  disabled = false,
  style,
}: Props) {
  const reducedMotion = useReducedMotion();
  const prevActiveRef = useRef(active);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const tiltAnim = useRef(new Animated.Value(0)).current;
  const burstAnim = useRef(new Animated.Value(0)).current;
  const [bursting, setBursting] = useState(false);

  useEffect(() => {
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = active;
    if (wasActive === active || reducedMotion) return undefined;

    scaleAnim.stopAnimation();
    tiltAnim.stopAnimation();
    burstAnim.stopAnimation();

    if (active) {
      setBursting(true);
      scaleAnim.setValue(0.74);
      tiltAnim.setValue(-1);
      burstAnim.setValue(0);

      const anim = Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.24,
            duration: 145,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 260,
            friction: 13,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(tiltAnim, {
            toValue: 0.55,
            duration: 160,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.spring(tiltAnim, {
            toValue: 0,
            tension: 220,
            friction: 14,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(burstAnim, {
          toValue: 1,
          duration: 460,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);

      anim.start(({ finished }) => {
        if (finished) setBursting(false);
      });
      return () => anim.stop();
    }

    // Calm tactile dip when removing from favorites
    setBursting(false);
    const anim = Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.86,
        duration: 85,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 260,
        friction: 16,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [active, burstAnim, reducedMotion, scaleAnim, tiltAnim]);

  const iconTransformStyle = useMemo(
    () => ({
      transform: [
        { scale: scaleAnim },
        {
          rotate: tiltAnim.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: ['-14deg', '0deg', '14deg'],
          }),
        },
      ],
    }),
    [scaleAnim, tiltAnim],
  );

  const ringStyle = useMemo(
    () => ({
      opacity: burstAnim.interpolate({
        inputRange: [0, 0.25, 1],
        outputRange: [0, 0.85, 0],
      }),
      transform: [
        {
          scale: burstAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.55, 1.85],
          }),
        },
      ],
    }),
    [burstAnim],
  );

  const isCanopy = variant === 'canopy';
  const boxSize = isCanopy ? 42 : 34;

  return (
    <View style={[styles.anchor, { width: boxSize, height: boxSize }, style]}>
      {bursting ? (
        <View pointerEvents="none" style={styles.burstLayer}>
          <Animated.View
            style={[
              styles.burstRing,
              { width: boxSize, height: boxSize, borderRadius: boxSize / 2 },
              ringStyle,
            ]}
          />
          {SPARKLE_SPECS.map((spark, index) => {
            const rad = (spark.angle * Math.PI) / 180;
            const dx = Math.cos(rad) * (isCanopy ? spark.dist + 5 : spark.dist);
            const dy = Math.sin(rad) * (isCanopy ? spark.dist + 5 : spark.dist);
            return (
              <Animated.View
                key={index}
                style={[
                  styles.sparkleDot,
                  {
                    width: spark.size,
                    height: spark.size,
                    borderRadius: spark.size / 2,
                    backgroundColor: spark.color,
                    opacity: burstAnim.interpolate({
                      inputRange: [0, 0.18, 0.72, 1],
                      outputRange: [0, 1, 0.85, 0],
                    }),
                    transform: [
                      {
                        translateX: burstAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, dx],
                        }),
                      },
                      {
                        translateY: burstAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, dy],
                        }),
                      },
                      {
                        scale: burstAnim.interpolate({
                          inputRange: [0, 0.35, 1],
                          outputRange: [0.3, 1.15, 0.2],
                        }),
                      },
                    ],
                  },
                ]}
              />
            );
          })}
        </View>
      ) : null}

      <CachedOutsetShadow
        borderRadius={boxSize / 2}
        shadow={isCanopy ? LIQUID_SHADOWS.canopyGlassOutset : active ? LIQUID_SHADOWS.goldSoftOutset : LIQUID_SHADOWS.cardOutsetSoft}
        padTop={10}
        padX={12}
        padBottom={16}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected: active, disabled }}
        disabled={disabled}
        hitSlop={10}
        onPress={(event) => {
          if (stopPropagation) event.stopPropagation();
          Keyboard.dismiss();
          if (!active) {
            Haptics.notification(Haptics.NotificationFeedbackType.Success);
          } else {
            Haptics.selection();
          }
          onPress();
        }}
        style={({ pressed }) => [
          isCanopy ? styles.canopyButton : styles.cardButton,
          active && (isCanopy ? styles.canopyButtonActive : styles.cardButtonActive),
          pressed && styles.pressed,
        ]}
      >
        <CachedInsetRelief
          borderRadius={boxSize / 2}
          shadow={active ? GOLD_ORB_INSET : CARD_ORB_INSET}
          zIndex={0}
        />
        <Animated.View style={[styles.iconInner, iconTransformStyle]}>
          {icon === 'bookmark' ? (
            <AppIcon name="bookmark" size={isCanopy ? 22 : 18} />
          ) : (
            <Text
              style={[
                isCanopy ? styles.canopyStarGlyph : styles.cardStarGlyph,
                active && styles.starGlyphActive,
              ]}
            >
              {active ? '★' : '☆'}
            </Text>
          )}
        </Animated.View>
        {icon === 'bookmark' && active ? (
          <View pointerEvents="none" style={styles.bookmarkStarDot}>
            <Text style={styles.bookmarkStarText}>★</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  anchor: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  burstLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  burstRing: {
    position: 'absolute',
    borderWidth: 2.2,
    borderColor: '#FFD43B',
  },
  sparkleDot: {
    position: 'absolute',
  },
  cardButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  cardButtonActive: {
    backgroundColor: '#FFF4C8',
    borderColor: '#FFE48E',
  },
  canopyButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.2,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  canopyButtonActive: {
    backgroundColor: '#FFF4C8',
    borderColor: '#FFE58A',
  },
  iconInner: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  cardStarGlyph: {
    fontFamily: fonts.display,
    fontSize: 17,
    lineHeight: 20,
    color: colors.inkMuted,
    includeFontPadding: false,
  },
  canopyStarGlyph: {
    fontFamily: fonts.display,
    fontSize: 21,
    lineHeight: 24,
    color: colors.violetDeep,
    includeFontPadding: false,
  },
  starGlyphActive: {
    color: '#D48A00',
  },
  bookmarkStarDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.gold,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkStarText: {
    fontFamily: fonts.display,
    fontSize: 9,
    lineHeight: 11,
    color: colors.ink,
    includeFontPadding: false,
  },
  pressed: { opacity: 0.78 },
});
