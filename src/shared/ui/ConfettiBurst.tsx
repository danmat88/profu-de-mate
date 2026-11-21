import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
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

function ConfettiPiece({ piece, index }: { piece: Piece; index: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      110 + piece.delay,
      withTiming(1, { duration: 1150, easing: Easing.out(Easing.cubic) }),
    );
  }, [piece.delay, progress]);

  const animated = useAnimatedStyle(() => {
    const t = progress.value;
    const gravity = t * t * 44;
    return {
      opacity: interpolate(t, [0, 0.08, 0.74, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: t * piece.x },
        { translateY: t * piece.y + gravity },
        { rotate: `${t * piece.rotateDeg}deg` },
        { scale: interpolate(t, [0, 0.14, 1], [0.25, 1 + (index % 3) * 0.1, 0.78]) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        piece.shape === 'pill' && styles.pill,
        piece.shape === 'circle' && styles.circle,
        { backgroundColor: piece.color },
        animated,
      ]}
    />
  );
}

export function ConfettiBurst() {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.stage]}>
      {pieces.map((piece, index) => (
        <ConfettiPiece key={`${piece.x}-${piece.y}`} piece={piece} index={index} />
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
