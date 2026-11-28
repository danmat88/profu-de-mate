import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { bundledImageSource } from '../services/bundledImages';
import { colors } from '../theme';

export const controlAssets = {
  back: require('../../../assets/controls/back.png'),
  check: require('../../../assets/controls/check.png'),
  close: require('../../../assets/controls/close.png'),
  collapse: require('../../../assets/controls/collapse.png'),
  dot: require('../../../assets/controls/dot.png'),
  expand: require('../../../assets/controls/expand.png'),
  flag: require('../../../assets/controls/flag.png'),
  next: require('../../../assets/controls/next.png'),
  retry: require('../../../assets/controls/retry.png'),
  spark: require('../../../assets/controls/spark.png'),
  wrong: require('../../../assets/controls/wrong.png'),
} as const;

export type MiniGlyphName = keyof typeof controlAssets;

export function MiniGlyph({
  name,
  size = 24,
  color = colors.ink,
  style,
}: {
  name: MiniGlyphName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const glyphSize = Math.round(size * 1.15);
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.wrap, style]}>
      <Image
        accessible={false}
        accessibilityIgnoresInvertColors
        fadeDuration={0}
        source={bundledImageSource(controlAssets[name])}
        resizeMode="contain"
        style={{ width: glyphSize, height: glyphSize, tintColor: color }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
