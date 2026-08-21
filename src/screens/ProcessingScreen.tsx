import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { MiniGlyph } from '../components/MiniGlyph';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Processing'>;

export function ProcessingScreen({ navigation, route }: Props) {
  const { height, gutter, isNarrow, isShort, isCompact } = useResponsiveLayout();
  const [active, setActive] = useState(0);
  const orbit = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const isCheck = route.params.mode === 'check';
  const jobs = isCheck ? ['Citesc fiecare rând', 'Compar logica', 'Pregătesc feedbackul'] : ['Citesc enunțul', 'Aleg metoda', 'Construiesc explicația'];
  const stageHeight = Math.max(320, Math.min(390, height * 0.46));
  const orbitSize = isCompact ? 232 : 273;
  const haloSize = isCompact ? 181 : 211;

  useEffect(() => {
    const orbiting = Animated.loop(Animated.timing(orbit, { toValue: 1, duration: 2400, useNativeDriver: true }));
    const floating = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    orbiting.start();
    floating.start();
    const progressing = Animated.timing(progress, { toValue: 1, duration: 2700, useNativeDriver: false });
    progressing.start();
    const first = setTimeout(() => setActive(1), 850);
    const second = setTimeout(() => setActive(2), 1700);
    const finish = setTimeout(() => navigation.replace('Lesson', { mode: route.params.mode }), 2800);
    return () => { orbiting.stop(); floating.stop(); progressing.stop(); clearTimeout(first); clearTimeout(second); clearTimeout(finish); };
  }, [bob, navigation, orbit, progress, route.params.mode]);

  return (
    <SafeAreaView style={[styles.safe, { paddingHorizontal: gutter }]} edges={['top']}>
      <StatusBar style="light" />
      <ComicBackdrop dark />
      <View style={styles.top}><Text style={styles.brand}>Profu’ lucrează</Text><View style={styles.live}><Animated.View style={[styles.liveDot, { opacity: bob.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }), transform: [{ scale: bob.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.1] }) }] }]} /><Text style={styles.liveText}>ÎN DIRECT</Text></View></View>
      <View style={[styles.stage, { height: stageHeight }]}>
        <Animated.View style={[styles.orbit, { width: orbitSize, height: orbitSize, borderRadius: orbitSize / 2, transform: [{ rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
          <View style={styles.orbitDotA} /><View style={styles.orbitDotB} /><View style={styles.orbitDotC} />
        </Animated.View>
        <View style={[styles.halo, { width: haloSize, height: haloSize, borderRadius: haloSize / 2 }]} />
        <Animated.View style={{ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [5, -7] }) }] }}>
          <Image source={require('../../assets/profu-mascot-v2.png')} resizeMode="contain" style={[styles.mascot, isCompact && styles.mascotCompact]} />
        </Animated.View>
        <View style={[styles.thought, isCompact && styles.thoughtCompact]}><Text style={styles.thoughtText}>{isCheck ? 'Hmm… aici e un semn șugubăț.' : 'Aha! Știu de unde începem.'}</Text></View>
      </View>
      <Text style={[styles.title, isNarrow && styles.titleNarrow]}>{isCheck ? 'Verific fără să judec.' : 'Pun ideile în ordine.'}</Text>
      <Text style={styles.subtitle}>Mai durează doar cât să spunem „radical”.</Text>
      <View style={[styles.jobs, isShort && styles.jobsCompact]}>
        {jobs.map((job, index) => {
          const done = index < active;
          const current = index === active;
          return (
            <View key={job} style={styles.job}>
              <View style={[styles.jobIcon, done && styles.jobDone, current && styles.jobCurrent]}>
                <MiniGlyph name={done ? 'check' : current ? 'spark' : 'dot'} size={done ? 17 : current ? 15 : 16} color={done || current ? colors.ink : '#9187AF'} />
              </View>
              <Text style={[styles.jobText, (done || current) && styles.jobTextActive]}>{job}</Text>
              {current ? <Text style={styles.now}>ACUM</Text> : null}
            </View>
          );
        })}
      </View>
      <View style={styles.progressTrack}><Animated.View style={[styles.progressFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['3%', '100%'] }) }]} /></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  top: { height: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: fonts.displaySemi, color: colors.paper, fontSize: 18 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2C2457', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lime },
  liveText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 8, letterSpacing: 1 },
  stage: { height: 350, alignItems: 'center', justifyContent: 'center' },
  orbit: { position: 'absolute', width: 273, height: 273, borderWidth: 3, borderColor: '#6557A1', borderStyle: 'dashed', borderRadius: 137 },
  halo: { position: 'absolute', width: 211, height: 211, borderRadius: 106, backgroundColor: '#302368' },
  orbitDotA: { position: 'absolute', width: 21, height: 21, borderRadius: 8, backgroundColor: colors.lime, borderWidth: 2, borderColor: colors.ink, top: 11, left: 28 },
  orbitDotB: { position: 'absolute', width: 17, height: 17, borderRadius: 9, backgroundColor: colors.peach, borderWidth: 2, borderColor: colors.ink, bottom: 28, right: 8 },
  orbitDotC: { position: 'absolute', width: 13, height: 13, backgroundColor: colors.cyan, borderWidth: 2, borderColor: colors.ink, top: 109, right: -7, transform: [{ rotate: '14deg' }] },
  mascot: { width: 214, height: 225 },
  mascotCompact: { width: 184, height: 194 },
  thought: { position: 'absolute', right: 0, top: 41, maxWidth: 135, backgroundColor: colors.lime, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 17, paddingHorizontal: 10, paddingVertical: 8, transform: [{ rotate: '4deg' }] },
  thoughtCompact: { top: 27, right: -2, maxWidth: 121 },
  thoughtText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11, lineHeight: 14, textAlign: 'center' },
  title: { fontFamily: fonts.display, color: colors.paper, fontSize: 31, lineHeight: 34, textAlign: 'center' },
  titleNarrow: { fontSize: 27, lineHeight: 30 },
  subtitle: { fontFamily: fonts.body, color: '#B9B0D2', fontSize: 13, textAlign: 'center', marginTop: 3 },
  jobs: { marginTop: 25, marginHorizontal: 10 },
  jobsCompact: { marginTop: 17 },
  job: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: '#39305F' },
  jobIcon: { width: 28, height: 28, borderRadius: 10, borderWidth: 2, borderColor: '#655C81', alignItems: 'center', justifyContent: 'center' },
  jobDone: { backgroundColor: colors.mint, borderColor: colors.ink },
  jobCurrent: { backgroundColor: colors.lime, borderColor: colors.ink, transform: [{ rotate: '-4deg' }] },
  jobText: { flex: 1, fontFamily: fonts.body, color: '#8D84A8', fontSize: 13 },
  jobTextActive: { color: colors.paper, fontFamily: fonts.bodyBold },
  now: { fontFamily: fonts.bodyBold, color: colors.lime, fontSize: 8, letterSpacing: 1 },
  progressTrack: { height: 7, marginHorizontal: 10, marginTop: 15, borderRadius: 5, backgroundColor: '#38305C', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: colors.lime },
});
