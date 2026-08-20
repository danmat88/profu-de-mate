import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';

type Glyph = 'back' | 'next' | 'close' | 'check' | 'wrong' | 'spark' | 'dot';

const glyphs: Record<Glyph, string> = {
  back: '←',
  next: '→',
  close: '×',
  check: '✓',
  wrong: '×',
  spark: '✦',
  dot: '•',
};

export function MiniGlyph({ name, size = 24, color = colors.ink, style }: { name: Glyph; size?: number; color?: string; style?: ViewStyle }) {
  return <View style={[styles.wrap, style]}><Text style={[styles.glyph, { fontSize: size, lineHeight: size + 3, color }]}>{glyphs[name]}</Text></View>;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  glyph: { fontFamily: fonts.display, textAlign: 'center' },
});
