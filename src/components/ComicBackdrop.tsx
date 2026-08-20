import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, fonts } from '../theme';

export function ComicBackdrop({ dark = false }: { dark?: boolean }) {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 5200, useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 5200, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [drift]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.blobA, dark && styles.blobADark, { transform: [
        { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -9] }) },
        { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 7] }) },
        { rotate: '-18deg' },
      ] }]} />
      <Animated.View style={[styles.blobB, dark && styles.blobBDark, { transform: [
        { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }) },
        { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
      ] }]} />
      <Animated.View style={[styles.dotCloud, dark && styles.dotCloudDark, { transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) }] }]}>
        {Array.from({ length: 12 }).map((_, index) => <View key={index} style={styles.dot} />)}
      </Animated.View>
      <Animated.Text style={[styles.symbol, styles.symbolA, dark && styles.symbolDark, { transform: [
        { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
        { rotate: drift.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '-6deg'] }) },
      ] }]}>×</Animated.Text>
      <Animated.Text style={[styles.symbol, styles.symbolB, dark && styles.symbolDark, { transform: [
        { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }) },
        { rotate: drift.interpolate({ inputRange: [0, 1], outputRange: ['8deg', '14deg'] }) },
      ] }]}>√</Animated.Text>
      <View style={[styles.spark, styles.sparkA, dark && styles.sparkDark]} />
      <View style={[styles.spark, styles.sparkB, dark && styles.sparkDark]} />
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
  sparkDark: { backgroundColor: colors.lime },
});
