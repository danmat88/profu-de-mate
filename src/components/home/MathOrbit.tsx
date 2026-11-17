import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, Line, RadialGradient, Rect, Stop } from 'react-native-svg';
import { fonts } from '../../theme';
import { Text } from '../Typography';
import { HomeIcon, homePalette as p } from './HomePrimitives';

/** Decorative example, deliberately separate from a student's actual analysis. */
export function MathOrbit({ checking, active, reducedMotion, compact }: { checking: boolean; active: boolean; reducedMotion: boolean; compact: boolean }) {
  const float = useSharedValue(0);
  const orbit = useSharedValue(0);
  useEffect(() => {
    if (active && !reducedMotion) {
      float.set(withRepeat(withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }), -1, true));
      orbit.set(withRepeat(withTiming(1, { duration: 26000, easing: Easing.linear }), -1, false));
    } else {
      cancelAnimation(float);
      cancelAnimation(orbit);
      float.set(0);
      orbit.set(0);
    }
    return () => { cancelAnimation(float); cancelAnimation(orbit); };
  }, [active, reducedMotion, float, orbit]);
  const floatingStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -7 * float.get() }, { rotate: `${-5 + float.get() * 1.5}deg` }] }));
  const orbitStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${orbit.get() * 360}deg` }] }));

  return (
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.stage, compact && styles.stageCompact]}>
      <View style={[styles.art, compact && styles.artCompact]}>
        <Svg width="100%" height="100%" viewBox="0 0 360 240" fill="none">
          <Defs><RadialGradient id="mathGlow" cx="50%" cy="50%" rx="50%" ry="50%"><Stop offset="0" stopColor={p.lime} stopOpacity="0.17" /><Stop offset="0.65" stopColor={p.lime} stopOpacity="0.035" /><Stop offset="1" stopColor={p.lime} stopOpacity="0" /></RadialGradient></Defs>
          <Rect width="360" height="240" fill="url(#mathGlow)" />
          {Array.from({ length: 11 }, (_, x) => Array.from({ length: 7 }, (_, y) => <Circle key={`${x}-${y}`} cx={30 + x * 30} cy={30 + y * 30} r="0.7" fill={p.muted} opacity="0.25" />))}
          <Circle cx="180" cy="120" r="100" stroke={p.lime} strokeOpacity="0.08" />
          <Circle cx="180" cy="120" r="76" stroke={p.lime} strokeOpacity="0.10" strokeDasharray="2 7" />
          <Ellipse cx="180" cy="120" rx="156" ry="64" rotation="-24" origin="180,120" stroke={p.lime} strokeOpacity="0.25" />
          <Ellipse cx="180" cy="120" rx="146" ry="77" rotation="26" origin="180,120" stroke={p.lime} strokeOpacity="0.09" />
          <Line x1="18" y1="120" x2="342" y2="120" stroke={p.lime} strokeOpacity="0.05" />
        </Svg>
        <Animated.View style={[styles.orbit, orbitStyle]}><View style={styles.satellite} /><View style={styles.satelliteSmall} /></Animated.View>
        <View style={styles.coordinateLeft}><Text style={styles.coordinate}>x</Text><View style={styles.coordinateLine} /></View>
        <View style={styles.coordinateRight}><HomeIcon name="plus" color="#768666" size={15} /></View>
        <Animated.View style={[styles.sheet, floatingStyle]}>
          <View style={styles.sheetHeader}><View style={styles.sheetDots}><View style={styles.sheetDot} /><View style={styles.sheetDot} /><View style={styles.sheetDot} /></View><Text style={styles.sheetLabel}>EXEMPLU</Text></View>
          <View style={styles.equationRow}><Text maxFontSizeMultiplier={1} style={styles.equation}>2x + 4 = 12</Text></View>
          <View style={styles.sheetRule} />
          <View style={styles.solutionRow}><View style={styles.solutionLine} /><Text maxFontSizeMultiplier={1} style={styles.solution}>2x = 8</Text><View style={styles.solutionLine} /></View>
          <View style={styles.cornerTop} /><View style={styles.cornerBottom} />
        </Animated.View>
        <Animated.View key={checking ? 'check' : 'solve'} entering={reducedMotion ? undefined : FadeIn.duration(300).reduceMotion(ReduceMotion.System)} style={styles.result}>
          <View style={styles.resultIcon}><HomeIcon name="check" size={15} color={p.dark} /></View>
          <Text maxFontSizeMultiplier={1} style={styles.resultText}>{checking ? 'Corect. Ai înțeles!' : 'x = 4'}</Text>
          {!checking && <Text maxFontSizeMultiplier={1} style={styles.resultNote}>PAS CU PAS</Text>}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { height: 204, alignItems: 'center', justifyContent: 'center' },
  stageCompact: { height: 168 },
  art: { width: 360, height: 240, alignItems: 'center', justifyContent: 'center', transform: [{ scale: 0.92 }] },
  artCompact: { transform: [{ scale: 0.8 }] },
  orbit: { position: 'absolute', width: 256, height: 200, borderRadius: 128, transform: [{ rotate: '-20deg' }] },
  satellite: { position: 'absolute', top: 28, left: 25, width: 7, height: 7, borderRadius: 4, backgroundColor: p.lime, boxShadow: '0 0 14px #D4F77980' },
  satelliteSmall: { position: 'absolute', bottom: 24, right: 16, width: 4, height: 4, borderRadius: 2, backgroundColor: '#8B9B75' },
  coordinateLeft: { position: 'absolute', left: 17, top: 122, gap: 3 },
  coordinate: { fontFamily: p.medium, fontSize: 15, color: '#7E8C73' },
  coordinateLine: { width: 16, height: 1, backgroundColor: '#526246' },
  coordinateRight: { position: 'absolute', right: 27, top: 63 },
  sheet: { position: 'absolute', top: 43, left: 70, width: 220, height: 145, borderRadius: 18, borderWidth: 1, borderColor: '#526246', backgroundColor: '#222B20', padding: 17, boxShadow: '0 16px 40px #00000050, inset 0 1px 0 #D4F77D15' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetDots: { flexDirection: 'row', gap: 4 },
  sheetDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#65725B' },
  sheetLabel: { fontFamily: fonts.bodyMedium, color: '#AFBBA5', fontSize: 8, letterSpacing: 2 },
  equationRow: { alignItems: 'center', paddingTop: 17, paddingBottom: 12 },
  equation: { fontFamily: p.medium, color: p.text, fontSize: 26, letterSpacing: -1 },
  sheetRule: { height: 1, backgroundColor: '#D4F77D15' },
  solutionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 10 },
  solution: { fontFamily: p.medium, fontSize: 16, color: '#A1AF95' },
  solutionLine: { width: 22, height: 1, backgroundColor: '#526246' },
  cornerTop: { position: 'absolute', left: -5, top: -5, width: 18, height: 18, borderTopWidth: 2, borderLeftWidth: 2, borderColor: p.lime, borderTopLeftRadius: 7 },
  cornerBottom: { position: 'absolute', right: -5, bottom: -5, width: 18, height: 18, borderBottomWidth: 2, borderRightWidth: 2, borderColor: p.lime, borderBottomRightRadius: 7 },
  result: { position: 'absolute', bottom: 29, right: 42, minWidth: 165, flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: '#687D4D', backgroundColor: '#303F23', transform: [{ rotate: '4deg' }], boxShadow: '0 8px 24px #00000050' },
  resultIcon: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: p.lime, borderRadius: 12 },
  resultText: { fontFamily: p.display, color: p.lime, fontSize: 17 },
  resultNote: { fontFamily: fonts.bodyMedium, color: '#B4C69D', fontSize: 7, letterSpacing: 1 },
});
