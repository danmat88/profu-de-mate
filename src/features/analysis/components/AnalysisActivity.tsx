import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import {
  cosinePulseRange,
  createNativeLoop,
  SILKY_EASE_OUT,
  WAVE_INPUT_17,
} from '../../../shared/motion/nativeMotion';
import { colors, fonts, radii } from '../../../shared/theme';
import {
  CachedInsetRelief,
  CachedOutsetShadow,
  LIQUID_SHADOWS,
} from '../../../shared/ui/CachedRelief';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { Text } from '../../../shared/ui/Typography';

const PULSE_SCALE_OUTPUT = cosinePulseRange(0.95, 1.11);
const SWEEP_SMOOTHSTEP = WAVE_INPUT_17.map((t) => t * t * (3 - 2 * t));

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
  const sweep = useRef(new Animated.Value(0)).current;
  const pulsePhase = useRef(new Animated.Value(0)).current;
  const readyFill = useRef(new Animated.Value(preparing ? 1 : 0)).current;
  const accent = check ? colors.peach : colors.lime;
  const label = preparing ? 'Pregătesc lecția' : 'Analiză în curs';
  const effectiveWidth = trackWidth > 0 ? trackWidth : 280;
  const barWidth = effectiveWidth * 0.38;

  useEffect(() => {
    if (preparing) {
      sweep.stopAnimation();
      pulsePhase.stopAnimation();
      pulsePhase.setValue(0);
      if (reducedMotion) {
        readyFill.setValue(1);
        return undefined;
      }
      const fillAnim = Animated.timing(readyFill, {
        toValue: 1,
        duration: 320,
        easing: SILKY_EASE_OUT,
        useNativeDriver: true,
      });
      fillAnim.start();
      return () => {
        fillAnim.stop();
        readyFill.stopAnimation();
      };
    }

    readyFill.stopAnimation();
    readyFill.setValue(0);
    if (reducedMotion || !active) {
      sweep.stopAnimation();
      pulsePhase.stopAnimation();
      sweep.setValue(reducedMotion ? 0.5 : 0);
      pulsePhase.setValue(0);
      return undefined;
    }

    const sweepLoop = createNativeLoop(sweep, 1_550);
    const pulseLoop = createNativeLoop(pulsePhase, 1_360);
    sweepLoop.start();
    pulseLoop.start();

    return () => {
      sweepLoop.stop();
      pulseLoop.stop();
      sweep.stopAnimation();
      pulsePhase.stopAnimation();
    };
  }, [active, preparing, pulsePhase, readyFill, reducedMotion, sweep]);

  const sweepStyle = useMemo(
    () => ({
      opacity: readyFill.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [1, 0, 0],
        extrapolate: 'clamp',
      }),
      transform: [
        {
          translateX: sweep.interpolate({
            inputRange: WAVE_INPUT_17,
            outputRange: SWEEP_SMOOTHSTEP.map((p) => -barWidth + (effectiveWidth + barWidth) * p),
          }),
        },
      ],
    }),
    [barWidth, effectiveWidth, readyFill, sweep],
  );

  const readyFillStyle = useMemo(
    () => ({
      opacity: readyFill.interpolate({
        inputRange: [0, 0.02, 1],
        outputRange: [0, 1, 1],
        extrapolate: 'clamp',
      }),
      transform: [
        {
          translateX: readyFill.interpolate({
            inputRange: [0, 1],
            outputRange: [-effectiveWidth, 0],
            extrapolate: 'clamp',
          }),
        },
      ],
    }),
    [effectiveWidth, readyFill],
  );

  const glyphStyle = useMemo(
    () => ({
      transform: [
        { rotate: '-6deg' },
        {
          scale: pulsePhase.interpolate({
            inputRange: WAVE_INPUT_17,
            outputRange: PULSE_SCALE_OUTPUT,
          }),
        },
      ],
    }),
    [pulsePhase],
  );

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
      style={styles.outer}
    >
      <CachedOutsetShadow borderRadius={26} shadow={LIQUID_SHADOWS.darkOutset} />
      <View style={[styles.card, check && styles.cardCheck]}>
        <CachedInsetRelief borderRadius={26} shadow={LIQUID_SHADOWS.darkInset} />
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
                ? ['rgba(255,141,107,0.2)', colors.peach, colors.gold, colors.peach, 'rgba(255,141,107,0.2)']
                : ['#7C3CFF', '#5C9DFF', '#43D6E6', colors.lime]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.sweepGradient}
            />
            <View style={styles.sweepShine} />
            <View style={styles.sweepTip} />
          </Animated.View>
          <Animated.View style={[styles.readyFill, readyFillStyle]}>
            <LinearGradient
              colors={check ? [colors.peach, colors.gold] : ['#7C3CFF', '#5C9DFF', '#43D6E6', colors.lime]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.sweepGradient}
            />
            <View style={styles.sweepShine} />
            <View style={styles.sweepTip} />
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
  outer: { width: '100%', position: 'relative' },
  card: {
    borderRadius: 26,
    borderWidth: 1.1,
    borderColor: 'rgba(190, 168, 255, 0.3)',
    backgroundColor: 'rgba(34, 25, 78, 0.94)',
    paddingHorizontal: 16,
    paddingVertical: 15,
    overflow: 'hidden',
    position: 'relative',
  },
  cardCheck: {
    borderColor: 'rgba(255, 184, 107, 0.38)',
    backgroundColor: 'rgba(42, 26, 72, 0.94)',
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  glyph: {
    width: 40,
    height: 40,
    borderRadius: 14,
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
    height: 8,
    marginTop: 12,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
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
  sweepTip: {
    position: 'absolute',
    right: 1,
    top: 1,
    bottom: 1,
    width: 7,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  readyFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '100%',
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
    height: 30,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(18,13,46,0.68)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
  },
  phasePillReady: {
    borderColor: 'rgba(232, 255, 120, 0.72)',
    backgroundColor: colors.lime,
  },
  phasePillReadyCheck: {
    borderColor: 'rgba(255, 212, 194, 0.72)',
    backgroundColor: colors.peach,
  },
  phaseDot: { width: 5.5, height: 5.5, borderRadius: 3 },
  phaseText: { fontFamily: fonts.bodyBold, fontSize: 10.5, color: '#D7D0F0' },
  phaseTextReady: { color: colors.ink },
});
