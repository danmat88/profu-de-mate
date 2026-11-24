import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, fonts } from '../theme';
import { Text } from './Typography';

/**
 * Whisper-light radial studio atmosphere matching LaunchSplash across every
 * light and dark screen with zero elevation cost.
 */
export const ComicBackdrop = memo(function ComicBackdrop({ dark = false }: { dark?: boolean }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.washTopRight, dark && styles.washTopRightDark]} />
      <View style={[styles.washBottomLeft, dark && styles.washBottomLeftDark]} />
      <View style={[styles.washMidLeft, dark && styles.washMidLeftDark]} />
      <View style={[styles.washBottomRight, dark && styles.washBottomRightDark]} />

      <Text style={[styles.symbol, styles.symbolTopLeft, dark && styles.symbolDark]}>+</Text>
      <Text style={[styles.symbol, styles.symbolMidRight, dark && styles.symbolDark]}>×</Text>
      <Text style={[styles.symbol, styles.symbolBottomRight, dark && styles.symbolDark]}>√</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  washTopRight: {
    position: 'absolute',
    width: 300,
    height: 260,
    borderRadius: 150,
    backgroundColor: 'rgba(124, 60, 255, 0.06)',
    top: -110,
    right: -100,
  },
  washTopRightDark: { backgroundColor: 'rgba(124, 60, 255, 0.24)' },
  washBottomLeft: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(216, 255, 62, 0.17)',
    bottom: -135,
    left: -110,
  },
  washBottomLeftDark: { backgroundColor: 'rgba(67, 214, 230, 0.09)' },
  washMidLeft: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255, 141, 107, 0.075)',
    top: '32%',
    left: -94,
  },
  washMidLeftDark: { backgroundColor: 'rgba(255, 141, 107, 0.08)' },
  washBottomRight: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(67, 214, 230, 0.075)',
    bottom: '16%',
    right: -95,
  },
  washBottomRightDark: { backgroundColor: 'rgba(145, 88, 255, 0.14)' },
  symbol: { position: 'absolute', fontFamily: fonts.display, color: colors.violet, opacity: 0.05 },
  symbolTopLeft: { left: 12, top: 92, fontSize: 28, transform: [{ rotate: '-14deg' }] },
  symbolMidRight: { right: 12, top: '48%', fontSize: 30, transform: [{ rotate: '14deg' }] },
  symbolBottomRight: { right: 18, bottom: 28, fontSize: 32, transform: [{ rotate: '-10deg' }] },
  symbolDark: { color: colors.lime, opacity: 0.08 },
});
