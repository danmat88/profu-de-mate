import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme';

type Piece = {
  x: number;
  y: number;
  color: string;
  rotateDeg: number;
  shape: 'pill' | 'square' | 'circle';
  delay: number;
};

const BURST_DURATION_MS = 1_200;

const pieces: readonly Piece[] = [
  { x: -148, y: -96, color: colors.lime, rotateDeg: -210, shape: 'pill', delay: 0 },
  { x: -118, y: -158, color: colors.peach, rotateDeg: 175, shape: 'square', delay: 30 },
  { x: -64, y: -182, color: colors.cyan, rotateDeg: -150, shape: 'circle', delay: 15 },
  { x: -8, y: -190, color: colors.gold, rotateDeg: 220, shape: 'pill', delay: 40 },
  { x: 52, y: -178, color: colors.lime, rotateDeg: -185, shape: 'square', delay: 10 },
  { x: 108, y: -148, color: colors.peach, rotateDeg: 195, shape: 'pill', delay: 35 },
  { x: 148, y: -88, color: colors.cyan, rotateDeg: -170, shape: 'circle', delay: 20 },
  { x: 156, y: 2, color: colors.gold, rotateDeg: 210, shape: 'square', delay: 45 },
  { x: 126, y: 88, color: colors.lime, rotateDeg: -165, shape: 'pill', delay: 15 },
  { x: 68, y: 142, color: colors.peach, rotateDeg: 180, shape: 'circle', delay: 30 },
  { x: -16, y: 150, color: colors.violetBright, rotateDeg: -195, shape: 'square', delay: 25 },
  { x: -84, y: 138, color: colors.cyan, rotateDeg: 215, shape: 'pill', delay: 10 },
  { x: -136, y: 82, color: colors.gold, rotateDeg: -155, shape: 'circle', delay: 40 },
  { x: -156, y: -4, color: colors.violetBright, rotateDeg: 190, shape: 'square', delay: 20 },
];

function ConfettiPiece({
  burst,
  piece,
  index,
}: {
  burst: Animated.Value;
  piece: Piece;
  index: number;
}) {
  const start = piece.delay / BURST_DURATION_MS;
  const span = 1 - start;
  const peakScale = 1 + (index % 3) * 0.1;
  const at = (u: number) => start + u * span;
  const arcY = (u: number) => u * piece.y + u * u * 44;

  const opacity = start > 0
    ? burst.interpolate({
      inputRange: [0, start, at(0.08), at(0.74), 1],
      outputRange: [0, 0, 1, 1, 0],
      extrapolate: 'clamp',
    })
    : burst.interpolate({
      inputRange: [0, 0.08, 0.74, 1],
      outputRange: [0, 1, 1, 0],
      extrapolate: 'clamp',
    });

  const translateX = start > 0
    ? burst.interpolate({
      inputRange: [0, start, 1],
      outputRange: [0, 0, piece.x],
      extrapolate: 'clamp',
    })
    : burst.interpolate({
      inputRange: [0, 1],
      outputRange: [0, piece.x],
      extrapolate: 'clamp',
    });

  const translateY = start > 0
    ? burst.interpolate({
      inputRange: [0, start, at(0.35), at(0.7), 1],
      outputRange: [0, 0, arcY(0.35), arcY(0.7), arcY(1)],
      extrapolate: 'clamp',
    })
    : burst.interpolate({
      inputRange: [0, 0.35, 0.7, 1],
      outputRange: [0, arcY(0.35), arcY(0.7), arcY(1)],
      extrapolate: 'clamp',
    });

  const rotate = start > 0
    ? burst.interpolate({
      inputRange: [0, start, 1],
      outputRange: ['0deg', '0deg', `${piece.rotateDeg}deg`],
      extrapolate: 'clamp',
    })
    : burst.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', `${piece.rotateDeg}deg`],
      extrapolate: 'clamp',
    });

  const scale = start > 0
    ? burst.interpolate({
      inputRange: [0, start, at(0.14), 1],
      outputRange: [0.25, 0.25, peakScale, 0.78],
      extrapolate: 'clamp',
    })
    : burst.interpolate({
      inputRange: [0, 0.14, 1],
      outputRange: [0.25, peakScale, 0.78],
      extrapolate: 'clamp',
    });

  return (
    <Animated.View
      style={[
        styles.piece,
        piece.shape === 'pill' && styles.pill,
        piece.shape === 'circle' && styles.circle,
        {
          backgroundColor: piece.color,
          opacity,
          transform: [{ translateX }, { translateY }, { rotate }, { scale }],
        },
      ]}
    />
  );
}

/**
 * Celebratory comic confetti burst driven by a single shared native-driver
 * Animated.Value across all 14 pieces (zero Reanimated worklets).
 */
export function ConfettiBurst() {
  const reducedMotion = useReducedMotion();
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) return undefined;
    burst.setValue(0);
    const anim = Animated.sequence([
      Animated.delay(95),
      Animated.timing(burst, {
        toValue: 1,
        duration: BURST_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => {
      anim.stop();
      burst.stopAnimation();
    };
  }, [burst, reducedMotion]);

  if (reducedMotion) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.stage]}>
      {pieces.map((piece, index) => (
        <ConfettiPiece key={`${piece.x}-${piece.y}`} burst={burst} piece={piece} index={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { zIndex: 5 },
  piece: {
    position: 'absolute',
    left: '50%',
    top: '48%',
    width: 13,
    height: 13,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  pill: { width: 9, height: 22, borderRadius: 7 },
  circle: { borderRadius: 8 },
});
