import { LinearGradient } from 'expo-linear-gradient';
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
export function AnalysisActivity({
  preparing = false,
  check = false,
  active = true,
}: {
  preparing?: boolean;
  check?: boolean;
  active?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const sweep = useSharedValue(0);
  const pulse = useSharedValue(1);
  const readyFill = useSharedValue(preparing ? 1 : 0);
  const accent = check ? colors.peach : colors.lime;
  const label = preparing ? 'Pregătesc lecția' : 'Analiză în curs';

  useEffect(() => {
    if (preparing) {
      cancelAnimation(sweep);
      cancelAnimation(pulse);
      pulse.set(1);
      readyFill.set(
        reducedMotion
          ? 1
          : withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
      );
      return () => {
        cancelAnimation(readyFill);
      };
    }

    readyFill.set(0);
    if (reducedMotion || !active) {
      cancelAnimation(sweep);
      cancelAnimation(pulse);
      sweep.set(reducedMotion ? 0.5 : 0);
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
  }, [active, preparing, pulse, readyFill, reducedMotion, sweep]);

  const sweepStyle = useAnimatedStyle(() => {
    const barWidth = trackWidth * 0.38;
    return {
      opacity: Math.max(0, 1 - readyFill.get() * 2),
      transform: [{ translateX: -barWidth + sweep.get() * (trackWidth + barWidth) }],
    };
  }, [trackWidth]);

  const readyFillStyle = useAnimatedStyle(() => {
    const p = readyFill.get();
    return {
      opacity: p <= 0.01 ? 0 : 1,
      width: Math.max(0, trackWidth * p),
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
            <MiniGlyph name={preparing ? 'check' : 'spark'} size={16} color={colors.ink} />
          </Animated.View>
          <View style={styles.headingCopy}>
            <View style={styles.labelRow}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.84}
                style={styles.label}
              >
                {label}
              </Text>
              <View
                style={[
                  styles.livePill,
                  check && !preparing && styles.livePillCheck,
                  preparing && { borderColor: colors.ink, backgroundColor: accent },
                ]}
              >
                <View style={[styles.liveDot, { backgroundColor: preparing ? colors.ink : accent }]} />
                <Text style={[styles.livePillText, preparing && styles.livePillTextReady]}>
                  {preparing ? 'GATA' : 'LUCREZ'}
                </Text>
              </View>
            </View>
            <Text numberOfLines={2} style={styles.note}>
              {preparing
                ? 'Rezultatul este gata. Îl așez acum frumos în pagină.'
                : 'Poți reveni acasă. Analiza poate fi reluată de acolo.'}
            </Text>
          </View>
        </View>
        <View
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          style={styles.track}
        >
          <Animated.View style={[styles.sweep, sweepStyle]}>
            <LinearGradient
              colors={check
                ? ['rgba(255,184,107,0.18)', colors.peach, '#FFE0B8', colors.peach, 'rgba(255,184,107,0.18)']
                : ['rgba(201,255,59,0.16)', colors.lime, '#E9FF9E', colors.lime, 'rgba(201,255,59,0.16)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.sweepGradient}
            />
            <View style={styles.sweepShine} />
          </Animated.View>
          <Animated.View style={[styles.readyFill, { backgroundColor: accent }, readyFillStyle]}>
            <View style={styles.sweepShine} />
          </Animated.View>
        </View>
        <View style={styles.pillsRow}>
          {(check ? ['Enunț', 'Pașii tăi', 'Feedback clar'] : ['Enunț', 'Metodă', 'Pași clari']).map((item) => (
            <View
              key={item}
              style={[
                styles.phasePill,
                preparing && (check ? styles.phasePillReadyCheck : styles.phasePillReady),
              ]}
            >
              <View style={[styles.phaseDot, { backgroundColor: preparing ? colors.ink : accent }]} />
              <Text numberOfLines={1} style={[styles.phaseText, preparing && styles.phaseTextReady]}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { width: '100%', position: 'relative', paddingBottom: shadows.sm + 2 },
  shadow: {
    position: 'absolute',
    top: shadows.sm + 2,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.xl,
    backgroundColor: '#070414',
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: '#6956B8',
    backgroundColor: '#221A4B',
    paddingHorizontal: 15,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  cardCheck: {
    borderColor: '#9C5482',
    backgroundColor: '#2A1A48',
  },
  shine: {
    position: 'absolute',
    top: 3,
    left: 14,
    right: 14,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.shineSoft,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  glyph: {
    width: 38,
    height: 38,
    borderRadius: 13,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingCopy: { flex: 1, minWidth: 0 },
  labelRow: {
    height: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.displaySemi,
    fontSize: 16.5,
    lineHeight: 20,
    color: colors.paper,
  },
  livePill: {
    minWidth: 68,
    height: 21,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(201,255,59,0.45)',
    backgroundColor: 'rgba(20,14,48,0.85)',
  },
  livePillCheck: { borderColor: 'rgba(255,184,107,0.52)' },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  livePillText: { fontFamily: fonts.bodyBold, fontSize: 9.5, letterSpacing: 0.7, color: '#EAE5F7' },
  livePillTextReady: { color: colors.ink },
  note: {
    marginTop: 3,
    height: 34,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16.5,
    color: '#CFC8EB',
  },
  track: {
    height: 11,
    marginTop: 11,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: '#120D2B',
    backgroundColor: '#140F32',
    overflow: 'hidden',
    position: 'relative',
  },
  sweep: {
    width: '38%',
    height: '100%',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  sweepGradient: {
    width: '100%',
    height: '100%',
  },
  sweepShine: {
    position: 'absolute',
    top: 1,
    left: 6,
    right: 6,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  readyFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
    marginTop: 11,
  },
  phasePill: {
    flex: 1,
    height: 28,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(15,11,38,0.52)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
  },
  phasePillReady: {
    borderColor: colors.ink,
    backgroundColor: colors.lime,
  },
  phasePillReadyCheck: {
    borderColor: colors.ink,
    backgroundColor: colors.peach,
  },
  phaseDot: { width: 5.5, height: 5.5, borderRadius: 3 },
  phaseText: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: '#D7D0F0' },
  phaseTextReady: { color: colors.ink },
});
