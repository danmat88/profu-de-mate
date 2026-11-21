import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { borders, colors, fonts, radii, shadows } from '../../../shared/theme';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { Text } from '../../../shared/ui/Typography';

/** The provider exposes no intermediate progress. Only a received result changes this state. */
export function AnalysisActivity({ preparing = false, check = false }: { preparing?: boolean; check?: boolean }) {
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const sweep = useSharedValue(0);
  const pulse = useSharedValue(1);
  const accent = check ? colors.peach : colors.lime;
  const label = preparing ? 'Pregătesc lecția' : 'Analiză în curs';

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(sweep);
      cancelAnimation(pulse);
      sweep.set(0.5);
      pulse.set(1);
      return;
    }

    sweep.set(0);
    sweep.set(withRepeat(
      withTiming(1, { duration: 1_550, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    ));

    pulse.set(withRepeat(
      withSequence(
        withTiming(1.12, { duration: 680, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.94, { duration: 680, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    ));

    return () => {
      cancelAnimation(sweep);
      cancelAnimation(pulse);
    };
  }, [pulse, reducedMotion, sweep]);

  const sweepStyle = useAnimatedStyle(() => {
    const barWidth = trackWidth * 0.34;
    return {
      transform: [{ translateX: -barWidth + sweep.get() * (trackWidth + barWidth) }],
    };
  }, [trackWidth]);

  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: '-6deg' }, { scale: pulse.get() }],
  }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
      style={styles.outer}
    >
      <View pointerEvents="none" style={styles.shadow} />
      <View style={[styles.card, check && styles.cardCheck]}>
        <View pointerEvents="none" style={styles.shine} />
        <View style={styles.heading}>
          <Animated.View style={[styles.glyph, { backgroundColor: accent }, glyphStyle]}>
            <MiniGlyph name="spark" size={16} color={colors.ink} />
          </Animated.View>
          <View style={styles.headingCopy}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.note}>
              {preparing ? 'Rezultatul este gata. Îl așez în pagină.' : 'Poți reveni acasă. Analiza poate fi reluată de acolo.'}
            </Text>
          </View>
        </View>
        <View
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          style={styles.track}
        >
          {preparing ? (
            <View style={[styles.readyFill, { backgroundColor: accent }]} />
          ) : (
            <Animated.View style={[styles.sweep, { backgroundColor: accent }, sweepStyle]}>
              <View style={styles.sweepShine} />
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { width: '100%', position: 'relative', paddingBottom: shadows.sm + 1 },
  shadow: {
    position: 'absolute',
    top: shadows.sm + 1,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.lg,
    backgroundColor: '#09061B',
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: borders.thin,
    borderColor: '#56479C',
    backgroundColor: '#241C4F',
    paddingHorizontal: 14,
    paddingVertical: 13,
    overflow: 'hidden',
  },
  cardCheck: {
    borderColor: '#8B4B75',
    backgroundColor: '#2B1B4A',
  },
  shine: {
    position: 'absolute',
    top: 3,
    left: 12,
    right: 12,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.shineSoft,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  glyph: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingCopy: { flex: 1, minWidth: 0 },
  label: { fontFamily: fonts.displaySemi, fontSize: 16, lineHeight: 20, color: colors.paper },
  note: { marginTop: 2, fontFamily: fonts.body, fontSize: 12, lineHeight: 16.5, color: '#CEC7E8' },
  track: {
    height: 9,
    marginTop: 12,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: '#120D2B',
    backgroundColor: '#161136',
    overflow: 'hidden',
  },
  sweep: {
    width: '34%',
    height: '100%',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  sweepShine: {
    position: 'absolute',
    top: 1,
    left: 4,
    right: 4,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: colors.shine,
  },
  readyFill: {
    width: '100%',
    height: '100%',
    borderRadius: radii.pill,
  },
});
