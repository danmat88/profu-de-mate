import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { colors, fonts } from '../../../shared/theme';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { Text } from '../../../shared/ui/Typography';

/** The provider exposes no intermediate progress. Only a received result changes this state. */
export function AnalysisActivity({ preparing = false, check = false }: { preparing?: boolean; check?: boolean }) {
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const sweep = useRef(new Animated.Value(0)).current;
  const accent = check ? colors.peach : colors.lime;
  const label = preparing ? 'Pregătesc lecția' : 'Analiză în curs';

  useEffect(() => {
    sweep.setValue(reducedMotion ? 0.5 : 0);
    if (reducedMotion) return;
    const animation = Animated.loop(Animated.timing(sweep, {
      toValue: 1, duration: 1_650, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
    }));
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, sweep]);

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }} accessibilityLiveRegion="polite" style={styles.root}>
      <View style={styles.heading}>
        <View style={[styles.glyph, { backgroundColor: accent }]}><MiniGlyph name="spark" size={16} color={colors.ink} /></View>
        <Text style={styles.label}>{label}</Text>
      </View>
      <View onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)} style={styles.track}>
        <Animated.View style={[styles.sweep, {
          backgroundColor: accent,
          transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-trackWidth * 0.3, trackWidth] }) }],
        }]} />
      </View>
      <Text style={styles.note}>{preparing ? 'Rezultatul este gata. Îl așez în pagină.' : 'Poți reveni acasă. Analiza poate fi reluată de acolo.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', paddingVertical: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  glyph: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] },
  label: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20, color: colors.paper },
  track: { height: 5, marginTop: 14, borderRadius: 4, backgroundColor: '#3D345F', overflow: 'hidden' },
  sweep: { width: '30%', height: '100%', borderRadius: 4 },
  note: { marginTop: 10, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: '#B9B0D2' },
});
