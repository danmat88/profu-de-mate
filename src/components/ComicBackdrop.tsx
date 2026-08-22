import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

export function ComicBackdrop({ dark = false }: { dark?: boolean }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.blobA, dark && styles.blobADark]} />
      <View style={[styles.blobB, dark && styles.blobBDark]} />
      <View style={[styles.dotCloud, dark && styles.dotCloudDark]}>
        {Array.from({ length: 12 }).map((_, index) => <View key={index} style={styles.dot} />)}
      </View>
      <Text style={[styles.symbol, styles.symbolA, dark && styles.symbolDark]}>×</Text>
      <Text style={[styles.symbol, styles.symbolB, dark && styles.symbolDark]}>√</Text>
      {!dark ? (
        <>
          <View style={[styles.spark, styles.sparkA]} />
          <View style={[styles.spark, styles.sparkB]} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  blobA: { position: 'absolute', width: 210, height: 120, borderRadius: 100, backgroundColor: colors.violetSoft, top: -55, right: -72, transform: [{ rotate: '-18deg' }] },
  blobADark: { backgroundColor: '#342271' },
  blobB: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 24, borderColor: colors.limeSoft, bottom: -86, left: -71 },
  blobBDark: { borderColor: '#4C2DA1', opacity: 0.72 },
  dotCloud: { position: 'absolute', top: 148, right: 12, width: 52, flexDirection: 'row', flexWrap: 'wrap', gap: 6, opacity: 0.24 },
  dotCloudDark: { opacity: 0.35 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.violet },
  symbol: { position: 'absolute', fontFamily: fonts.display, color: colors.violet, opacity: 0.12 },
  symbolA: { left: 16, top: 177, fontSize: 38, transform: [{ rotate: '-12deg' }] },
  symbolB: { right: 25, bottom: 120, fontSize: 42, transform: [{ rotate: '8deg' }] },
  symbolDark: { color: colors.lime, opacity: 0.17 },
  spark: { position: 'absolute', width: 12, height: 34, borderRadius: 8, backgroundColor: colors.peach },
  sparkA: { top: 105, left: 30, transform: [{ rotate: '43deg' }] },
  sparkB: { top: 121, left: 45, transform: [{ rotate: '-42deg' }] },
});
