import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, fonts } from '../theme';
import { Text } from './Typography';

/**
 * Ambient cartoon notebook backdrop. All accents sit strictly in peripheral
 * corner margins so foreground typography and cards stay crisp and unobstructed.
 */
export const ComicBackdrop = memo(function ComicBackdrop({ dark = false }: { dark?: boolean }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.blobTopRight, dark && styles.blobTopRightDark]} />
      <View style={[styles.blobBottomLeft, dark && styles.blobBottomLeftDark]} />
      <View style={[styles.blobMidLeft, dark && styles.blobMidLeftDark]} />

      <View style={[styles.dotClusterTop, dark && styles.dotClusterDark]}>
        {Array.from({ length: 9 }).map((_, index) => (
          <View key={index} style={[styles.dot, dark && styles.dotDark]} />
        ))}
      </View>

      <Text style={[styles.symbol, styles.symbolTopLeft, dark && styles.symbolDark]}>+</Text>
      <Text style={[styles.symbol, styles.symbolMidRight, dark && styles.symbolDark]}>×</Text>
      <Text style={[styles.symbol, styles.symbolBottomRight, dark && styles.symbolDark]}>√</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  blobTopRight: {
    position: 'absolute',
    width: 230,
    height: 150,
    borderRadius: 115,
    backgroundColor: colors.violetSoft,
    top: -64,
    right: -76,
    opacity: 0.78,
    transform: [{ rotate: '-18deg' }],
  },
  blobTopRightDark: { backgroundColor: '#342271', opacity: 0.85 },
  blobBottomLeft: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 22,
    borderColor: colors.limeSoft,
    bottom: -94,
    left: -82,
    opacity: 0.85,
  },
  blobBottomLeftDark: { borderColor: '#4C2DA1', opacity: 0.65 },
  blobMidLeft: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.peachSoft,
    top: '36%',
    left: -68,
    opacity: 0.52,
  },
  blobMidLeftDark: { backgroundColor: '#3B1E66', opacity: 0.45 },
  dotClusterTop: {
    position: 'absolute',
    top: 86,
    right: -4,
    width: 38,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    opacity: 0.2,
  },
  dotClusterDark: { opacity: 0.3 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.violet },
  dotDark: { backgroundColor: colors.lime },
  symbol: { position: 'absolute', fontFamily: fonts.display, color: colors.violet, opacity: 0.09 },
  symbolTopLeft: { left: 6, top: 82, fontSize: 32, transform: [{ rotate: '-14deg' }] },
  symbolMidRight: { right: 6, top: '48%', fontSize: 34, transform: [{ rotate: '14deg' }] },
  symbolBottomRight: { right: 14, bottom: 26, fontSize: 36, transform: [{ rotate: '-10deg' }] },
  symbolDark: { color: colors.lime, opacity: 0.14 },
});
