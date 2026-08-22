import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { ComicButton } from '../components/ComicButton';
import { AppIcon } from '../components/AppIcon';
import { MiniGlyph } from '../components/MiniGlyph';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { analyzeMathImage, friendlyAnalysisError } from '../services/mathAnalysis';
import { colors, fonts } from '../theme';
import type { MathAnalysis, RootStackParamList } from '../types';
import { contentToAccessibleText } from '../utils/mathContent';

type Props = NativeStackScreenProps<RootStackParamList, 'Processing'>;
type ScreenState =
  | { kind: 'analyzing' }
  | { kind: 'rejected'; result: MathAnalysis }
  | { kind: 'error'; message: string };

export function ProcessingScreen({ navigation, route }: Props) {
  const { height, gutter, isNarrow, isShort, isCompact } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const [requestKey, setRequestKey] = useState(0);
  const [screenState, setScreenState] = useState<ScreenState>({ kind: 'analyzing' });
  const orbit = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const isCheck = route.params.mode === 'check';
  const jobs = isCheck
    ? ['Citesc fiecare rând', 'Compar pașii', 'Pregătesc feedbackul']
    : ['Citesc enunțul', 'Aleg metoda', 'Construiesc explicația'];
  const stageHeight = Math.max(280, Math.min(360, height * 0.42));
  const orbitSize = isCompact ? 222 : 264;
  const haloSize = isCompact ? 173 : 204;
  const bottomSpace = Math.max(insets.bottom, 12);

  useEffect(() => {
    if (reducedMotion) {
      orbit.setValue(0.12);
      bob.setValue(0.5);
      return;
    }
    const orbiting = Animated.loop(Animated.timing(orbit, { toValue: 1, duration: 2400, useNativeDriver: true }));
    const floating = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    orbiting.start();
    floating.start();
    return () => { orbiting.stop(); floating.stop(); };
  }, [bob, orbit, reducedMotion]);

  useEffect(() => {
    let mounted = true;
    setScreenState({ kind: 'analyzing' });
    setActive(0);
    progress.stopAnimation();
    progress.setValue(0);
    if (reducedMotion) progress.setValue(0.18);
    else Animated.timing(progress, { toValue: 0.9, duration: 22_000, useNativeDriver: false }).start();

    const secondStage = setTimeout(() => {
      if (!mounted) return;
      setActive(1);
      if (reducedMotion) progress.setValue(0.5);
    }, 1_400);
    const thirdStage = setTimeout(() => {
      if (!mounted) return;
      setActive(2);
      if (reducedMotion) progress.setValue(0.76);
    }, 3_800);

    analyzeMathImage(route.params.mode, route.params.image, route.params.requestId)
      .then(({ lessonId, result }) => {
        if (!mounted) return;
        progress.stopAnimation();
        const finish = () => {
          if (!mounted) return;
          if (result.status === 'ready' && lessonId) {
            navigation.replace('Lesson', { lesson: result, lessonId, source: 'flow', sourceImage: route.params.image });
          } else if (result.status !== 'ready') {
            setScreenState({ kind: 'rejected', result });
          } else {
            setScreenState({ kind: 'error', message: 'Lecția nu a putut fi salvată. Încearcă din nou.' });
          }
        };
        if (reducedMotion) {
          progress.setValue(1);
          finish();
        } else {
          Animated.timing(progress, { toValue: 1, duration: 240, useNativeDriver: false }).start(finish);
        }
      })
      .catch((error) => {
        if (!mounted) return;
        progress.stopAnimation();
        setScreenState({ kind: 'error', message: friendlyAnalysisError(error) });
      });

    return () => {
      mounted = false;
      clearTimeout(secondStage);
      clearTimeout(thirdStage);
      progress.stopAnimation();
    };
  }, [navigation, progress, reducedMotion, requestKey, route.params.image, route.params.mode, route.params.requestId]);

  if (screenState.kind !== 'analyzing') {
    const rejected = screenState.kind === 'rejected';
    const title = rejected
      ? screenState.result.status === 'not_math' ? 'Aici nu văd încă matematică.' : 'Am nevoie de o poză mai clară.'
      : 'S-a împiedicat creta.';
    const message = rejected ? contentToAccessibleText(screenState.result.summary) : screenState.message;

    return (
      <SafeAreaView style={[styles.safe, { paddingHorizontal: gutter }]} edges={['top']}>
        <StatusBar style="light" />
        <ComicBackdrop dark />
        <View style={styles.top}>
          <Text style={styles.brand}>Profu’ de mate</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Înapoi" onPress={() => navigation.goBack()} style={styles.closeButton}>
            <MiniGlyph name="close" size={20} color={colors.paper} />
          </Pressable>
        </View>
        <View style={styles.messageArea}>
          <View style={styles.messageMascotWrap}>
            <View style={styles.messageHalo} />
            <Image accessible={false} source={require('../../assets/profu-mascot-v2.png')} resizeMode="contain" style={styles.messageMascot} />
            <View style={styles.messageGlyph}>{rejected ? <AppIcon name="camera" size={40} /> : <MiniGlyph name="spark" size={26} />}</View>
          </View>
          <View style={styles.messageCardWrap}>
            <View style={styles.messageCardShadow} />
            <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.messageCard}>
              <Text style={styles.messageEyebrow}>{rejected ? 'MAI ÎNCERCĂM O DATĂ' : 'NU E VINA TA'}</Text>
              <Text style={[styles.messageTitle, isNarrow && styles.messageTitleNarrow]}>{title}</Text>
              <Text style={styles.messageText}>{message}</Text>
            </View>
          </View>
        </View>
        <View style={[styles.messageActions, { paddingBottom: bottomSpace }]}>
          {!rejected ? <ComicButton compact title="Încearcă din nou" icon="scan" tone="lime" onPress={() => setRequestKey((value) => value + 1)} /> : null}
          <ComicButton compact title="Fotografiază din nou" icon="camera" tone={rejected ? 'lime' : 'violet'} onPress={() => navigation.replace('Capture', { mode: route.params.mode })} />
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Înapoi la fotografia editată</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { paddingHorizontal: gutter }]} edges={['top']}>
      <StatusBar style="light" />
      <ComicBackdrop dark />
      <View style={styles.top}>
        <Text style={styles.brand}>Profu’ lucrează</Text>
        <View style={styles.live}>
          <Animated.View style={[styles.liveDot, { opacity: bob.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }), transform: [{ scale: bob.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.1] }) }] }]} />
          <Text style={styles.liveText}>ÎN DIRECT</Text>
        </View>
      </View>
      <View style={[styles.stage, { height: stageHeight }]}>
        <Animated.View style={[styles.orbit, { width: orbitSize, height: orbitSize, borderRadius: orbitSize / 2, transform: [{ rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
          <View style={styles.orbitDotA} /><View style={styles.orbitDotB} /><View style={styles.orbitDotC} />
        </Animated.View>
        <View style={[styles.halo, { width: haloSize, height: haloSize, borderRadius: haloSize / 2 }]} />
        <Animated.View style={{ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [5, -7] }) }] }}>
          <Image accessible={false} source={require('../../assets/profu-mascot-v2.png')} resizeMode="contain" style={[styles.mascot, isCompact && styles.mascotCompact]} />
        </Animated.View>
        <View style={[styles.thought, isCompact && styles.thoughtCompact]}><Text style={styles.thoughtText}>{isCheck ? 'Hmm… verific fiecare pas.' : 'Aha! Citesc problema cu atenție.'}</Text></View>
      </View>
      <Text style={[styles.title, isNarrow && styles.titleNarrow]}>{isCheck ? 'Verific fără să judec.' : 'Pun ideile în ordine.'}</Text>
      <Text style={styles.subtitle}>Durata depinde de problemă și de conexiune.</Text>
      <View
        accessible
        accessibilityLabel={`Analiză în curs. ${jobs[active]}. Pasul ${active + 1} din ${jobs.length}.`}
        accessibilityLiveRegion="polite"
        style={[styles.jobs, isShort && styles.jobsCompact]}
      >
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
  closeButton: { width: 38, height: 38, borderRadius: 13, borderWidth: 2, borderColor: '#6557A1', backgroundColor: '#2C2457', alignItems: 'center', justifyContent: 'center' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2C2457', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lime },
  liveText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 8, letterSpacing: 1 },
  stage: { alignItems: 'center', justifyContent: 'center' },
  orbit: { position: 'absolute', borderWidth: 3, borderColor: '#6557A1', borderStyle: 'dashed' },
  halo: { position: 'absolute', backgroundColor: '#302368' },
  orbitDotA: { position: 'absolute', width: 21, height: 21, borderRadius: 8, backgroundColor: colors.lime, borderWidth: 2, borderColor: colors.ink, top: 11, left: 28 },
  orbitDotB: { position: 'absolute', width: 17, height: 17, borderRadius: 9, backgroundColor: colors.peach, borderWidth: 2, borderColor: colors.ink, bottom: 28, right: 8 },
  orbitDotC: { position: 'absolute', width: 13, height: 13, backgroundColor: colors.cyan, borderWidth: 2, borderColor: colors.ink, top: 109, right: -7, transform: [{ rotate: '14deg' }] },
  mascot: { width: 205, height: 216 },
  mascotCompact: { width: 176, height: 186 },
  thought: { position: 'absolute', right: 0, top: 35, maxWidth: 135, backgroundColor: colors.lime, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 17, paddingHorizontal: 10, paddingVertical: 8, transform: [{ rotate: '4deg' }] },
  thoughtCompact: { top: 23, right: -2, maxWidth: 121 },
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
  messageArea: { flex: 1, justifyContent: 'center', paddingBottom: 10 },
  messageMascotWrap: { height: 205, alignItems: 'center', justifyContent: 'center' },
  messageHalo: { position: 'absolute', width: 172, height: 172, borderRadius: 86, backgroundColor: '#302368', borderWidth: 3, borderStyle: 'dashed', borderColor: '#6557A1' },
  messageMascot: { width: 180, height: 190 },
  messageGlyph: { position: 'absolute', right: '20%', bottom: 13, width: 48, height: 48, borderRadius: 16, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '6deg' }] },
  messageCardWrap: { position: 'relative' },
  messageCardShadow: { position: 'absolute', left: 7, right: -7, top: 8, bottom: -8, borderRadius: 25, backgroundColor: '#09071A' },
  messageCard: { minHeight: 190, borderWidth: 3, borderColor: colors.ink, borderRadius: 25, backgroundColor: colors.paper, padding: 20, justifyContent: 'center' },
  messageEyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.2 },
  messageTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 28, lineHeight: 31, marginTop: 5 },
  messageTitleNarrow: { fontSize: 25, lineHeight: 28 },
  messageText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 14, lineHeight: 20, marginTop: 8 },
  messageActions: { gap: 9 },
  backLink: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  backLinkText: { fontFamily: fonts.bodyBold, color: '#B9B0D2', fontSize: 11 },
});
