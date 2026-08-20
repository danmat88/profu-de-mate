import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

const pieces = [
  { x: -142, y: -92, color: colors.lime, rotate: '-190deg', shape: 'pill' },
  { x: -116, y: -145, color: colors.peach, rotate: '150deg', shape: 'square' },
  { x: -61, y: -166, color: colors.cyan, rotate: '-120deg', shape: 'circle' },
  { x: 18, y: -171, color: colors.lime, rotate: '210deg', shape: 'pill' },
  { x: 91, y: -145, color: colors.peach, rotate: '-160deg', shape: 'square' },
  { x: 141, y: -85, color: colors.cyan, rotate: '190deg', shape: 'pill' },
  { x: 151, y: 4, color: colors.lime, rotate: '-210deg', shape: 'circle' },
  { x: 121, y: 86, color: colors.peach, rotate: '170deg', shape: 'pill' },
  { x: 64, y: 135, color: colors.cyan, rotate: '-160deg', shape: 'square' },
  { x: -71, y: 137, color: colors.lime, rotate: '210deg', shape: 'pill' },
  { x: -128, y: 84, color: colors.peach, rotate: '-140deg', shape: 'circle' },
  { x: -153, y: 3, color: colors.cyan, rotate: '180deg', shape: 'square' },
] as const;

export function ConfettiBurst() {
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(120),
      Animated.timing(burst, { toValue: 1, duration: 1050, useNativeDriver: true }),
    ]).start();
  }, [burst]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.stage]}>
      {pieces.map((piece, index) => (
        <Animated.View
          key={`${piece.x}-${piece.y}`}
          style={[
            styles.piece,
            piece.shape === 'pill' && styles.pill,
            piece.shape === 'circle' && styles.circle,
            { backgroundColor: piece.color, opacity: burst.interpolate({ inputRange: [0, 0.1, 0.78, 1], outputRange: [0, 1, 1, 0] }), transform: [
              { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, piece.x] }) },
              { translateY: burst.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0, piece.y, piece.y + 22] }) },
              { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', piece.rotate] }) },
              { scale: burst.interpolate({ inputRange: [0, 0.14, 1], outputRange: [0.25, 1 + (index % 3) * 0.08, 0.82] }) },
            ] },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { zIndex: 5 },
  piece: { position: 'absolute', left: '50%', top: '50%', width: 13, height: 13, borderWidth: 2, borderColor: colors.ink },
  pill: { width: 9, height: 23, borderRadius: 7 },
  circle: { borderRadius: 8 },
});
