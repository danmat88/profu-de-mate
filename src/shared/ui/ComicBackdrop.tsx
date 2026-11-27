import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors, fonts } from '../theme';
import { Text } from './Typography';

/**
 * Whisper-light optical studio atmosphere powered by true multi-stop SVG
 * RadialGradients (zero hard circular edges, zero elevation cost) plus
 * soft pearl depth wash and subtle math watermarks across light and dark screens.
 */
export const ComicBackdrop = memo(function ComicBackdrop({ dark = false }: { dark?: boolean }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {!dark ? (
        <LinearGradient
          colors={['#FFFBF4', '#FFF8EC', '#FDF4E6']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <Svg
        pointerEvents="none"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient id={dark ? 'cbTopDark' : 'cbTopLight'} cx="92%" cy="6%" rx="58%" ry="38%">
            <Stop offset="0%" stopColor={colors.violet} stopOpacity={dark ? '0.26' : '0.09'} />
            <Stop offset="55%" stopColor={colors.violet} stopOpacity={dark ? '0.09' : '0.028'} />
            <Stop offset="100%" stopColor={colors.violet} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={dark ? 'cbBottomDark' : 'cbBottomLight'} cx="8%" cy="94%" rx="62%" ry="42%">
            <Stop offset="0%" stopColor={dark ? colors.cyan : colors.lime} stopOpacity={dark ? '0.12' : '0.22'} />
            <Stop offset="52%" stopColor={dark ? colors.cyan : colors.lime} stopOpacity={dark ? '0.04' : '0.065'} />
            <Stop offset="100%" stopColor={dark ? colors.cyan : colors.lime} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={dark ? 'cbMidDark' : 'cbMidLight'} cx="94%" cy="68%" rx="48%" ry="34%">
            <Stop offset="0%" stopColor={dark ? colors.violetBright : colors.cyan} stopOpacity={dark ? '0.16' : '0.1'} />
            <Stop offset="100%" stopColor={dark ? colors.violetBright : colors.cyan} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={dark ? 'cbLeftDark' : 'cbLeftLight'} cx="6%" cy="46%" rx="42%" ry="28%">
            <Stop offset="0%" stopColor={dark ? colors.lime : '#B58EFF'} stopOpacity={dark ? '0.08' : '0.075'} />
            <Stop offset="100%" stopColor={dark ? colors.lime : '#B58EFF'} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${dark ? 'cbTopDark' : 'cbTopLight'})`} />
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${dark ? 'cbBottomDark' : 'cbBottomLight'})`} />
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${dark ? 'cbMidDark' : 'cbMidLight'})`} />
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${dark ? 'cbLeftDark' : 'cbLeftLight'})`} />
      </Svg>

      <Text style={[styles.symbol, styles.symbolTopLeft, dark && styles.symbolDark]}>+</Text>
      <Text style={[styles.symbol, styles.symbolMidRight, dark && styles.symbolDark]}>×</Text>
      <Text style={[styles.symbol, styles.symbolBottomRight, dark && styles.symbolDark]}>√</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  symbol: { position: 'absolute', fontFamily: fonts.display, color: colors.violet, opacity: 0.042 },
  symbolTopLeft: { left: 12, top: 92, fontSize: 28, transform: [{ rotate: '-14deg' }] },
  symbolMidRight: { right: 12, top: '48%', fontSize: 30, transform: [{ rotate: '14deg' }] },
  symbolBottomRight: { right: 18, bottom: 28, fontSize: 32, transform: [{ rotate: '-10deg' }] },
  symbolDark: { color: colors.lime, opacity: 0.08 },
});
