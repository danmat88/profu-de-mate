import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/Typography';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { ComicButton } from '../components/ComicButton';
import { AppIcon } from '../components/AppIcon';
import { MiniGlyph } from '../components/MiniGlyph';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useCommercial } from '../context/CommercialContext';
import { commercialGateFromError } from '../services/commercial';
import { analyzeMathImage, friendlyAnalysisError } from '../services/mathAnalysis';
import { recordDiagnosticError } from '../services/diagnostics';
import { clearPendingAnalysis, savePendingAnalysis } from '../services/pendingAnalysis';
import { colors, fonts } from '../theme';
import type { CommercialAccess, MathAnalysis, RootStackParamList } from '../types';
import { contentToAccessibleText } from '../utils/mathContent';

type Props = NativeStackScreenProps<RootStackParamList, 'Processing'>;
type ScreenState =
  | { kind: 'analyzing' }
  | { kind: 'rejected'; result: MathAnalysis }
  | { kind: 'commercial'; message: string; reason: string; access: CommercialAccess | null }
  | { kind: 'error'; message: string };

export function ProcessingScreen({ navigation, route }: Props) {
  const { height, gutter, isNarrow, isVeryShort, isShort, isCompact } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { access: commercialAccess, refresh: refreshCommercialAccess } = useCommercial();
  const [active, setActive] = useState(0);
  const [requestKey, setRequestKey] = useState(0);
  const [takingLong, setTakingLong] = useState(false);
  const [screenState, setScreenState] = useState<ScreenState>({ kind: 'analyzing' });
  const orbit = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const resumeAfterPaywall = useRef(false);
  const isCheck = route.params.mode === 'check';
  const jobs = isCheck
    ? ['Citesc rezolvarea', 'Verific fiecare pas', 'Pregătesc explicațiile']
    : ['Citesc enunțul', 'Aleg metoda', 'Scriu explicația'];
  const stageHeight = Math.max(isVeryShort ? 210 : 260, Math.min(350, height * (isVeryShort ? 0.33 : 0.4)));
  const orbitSize = isVeryShort ? 188 : isCompact ? 222 : 264;
  const haloSize = isVeryShort ? 148 : isCompact ? 173 : 204;
  const bottomSpace = Math.max(insets.bottom, 12);
  const returnToPhotoOrHome = () => {
    clearPendingAnalysis();
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };
  const retakePhoto = () => {
    clearPendingAnalysis();
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Home' },
        { name: 'Capture', params: { mode: route.params.mode } },
      ],
    });
  };
  const leaveAnalysis = () => {
    clearPendingAnalysis();
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

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

  useEffect(() => navigation.addListener('beforeRemove', () => {
    clearPendingAnalysis();
  }), [navigation]);

  useFocusEffect(useCallback(() => {
    if (resumeAfterPaywall.current && commercialAccess?.canAnalyze) {
      resumeAfterPaywall.current = false;
      setRequestKey((value) => value + 1);
    }
    return () => undefined;
  }, [commercialAccess?.canAnalyze]));

  useEffect(() => {
    let mounted = true;
    savePendingAnalysis(route.params.mode, route.params.image, route.params.requestId);
    setScreenState({ kind: 'analyzing' });
    setTakingLong(false);
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
    const slowStage = setTimeout(() => {
      if (mounted) setTakingLong(true);
    }, 20_000);

    analyzeMathImage(route.params.mode, route.params.image, route.params.requestId)
      .then(({ lessonId, result }) => {
        if (!mounted) return;
        progress.stopAnimation();
        const finish = () => {
          if (!mounted) return;
          clearPendingAnalysis();
          void refreshCommercialAccess();
          if (result.status === 'ready' && lessonId) {
            navigation.replace('Lesson', { lesson: result, lessonId, source: 'flow', sourceImage: route.params.image });
          } else if (result.status !== 'ready') {
            setScreenState({ kind: 'rejected', result });
          } else {
            setScreenState({ kind: 'error', message: 'Nu am putut salva lecția. Încearcă din nou.' });
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
        recordDiagnosticError('analysis_request', error);
        clearPendingAnalysis();
        progress.stopAnimation();
        const commercial = commercialGateFromError(error);
        setScreenState(commercial
          ? { kind: 'commercial', message: commercial.message, reason: commercial.reason, access: commercial.access }
          : { kind: 'error', message: friendlyAnalysisError(error) });
      });

    return () => {
      mounted = false;
      clearTimeout(secondStage);
      clearTimeout(thirdStage);
      clearTimeout(slowStage);
      progress.stopAnimation();
    };
  }, [navigation, progress, reducedMotion, refreshCommercialAccess, requestKey, route.params.image, route.params.mode, route.params.requestId]);

  if (screenState.kind !== 'analyzing') {
    const rejected = screenState.kind === 'rejected';
    const commercialBlocked = screenState.kind === 'commercial';
    const title = rejected
      ? screenState.result.status === 'not_math' ? 'În fotografie nu apare matematică.' : 'Fotografia nu este suficient de clară.'
      : commercialBlocked ? 'Ai ajuns la capătul problemelor disponibile.' : 'Ceva nu a mers.';
    const message = rejected ? contentToAccessibleText(screenState.result.summary) : screenState.message;

    return (
      <SafeAreaView style={[styles.safe, { paddingHorizontal: gutter }]} edges={['top']}>
        <StatusBar style="light" />
        <ComicBackdrop dark />
        <View style={styles.top}>
          <Text style={styles.brand}>Profu’ de mate</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={navigation.canGoBack() ? 'Înapoi la fotografie' : 'Înapoi acasă'} onPress={returnToPhotoOrHome} style={styles.closeButton}>
            <MiniGlyph name="close" size={20} color={colors.paper} />
          </Pressable>
        </View>
        <ScrollView
          style={styles.messageScroll}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.messageArea, isVeryShort && styles.messageAreaShort]}
        >
          <View style={styles.messageMascotWrap}>
            <View style={styles.messageHalo} />
            <Image accessible={false} source={require('../../assets/profu-mascot-v2.png')} resizeMode="contain" style={styles.messageMascot} />
            <View style={styles.messageGlyph}>{rejected ? <AppIcon name="camera" size={40} /> : <MiniGlyph name="spark" size={26} />}</View>
          </View>
          <View style={styles.messageCardWrap}>
            <View style={styles.messageCardShadow} />
            <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.messageCard}>
              <Text style={styles.messageEyebrow}>{rejected ? 'HAI SĂ MAI ÎNCERCĂM' : commercialBlocked ? 'ACCESUL TĂU' : 'A APĂRUT O PROBLEMĂ'}</Text>
              <Text style={[styles.messageTitle, isNarrow && styles.messageTitleNarrow]}>{title}</Text>
              <Text style={styles.messageText}>{message}</Text>
            </View>
          </View>
        </ScrollView>
        <View style={[styles.messageActions, { paddingBottom: bottomSpace }]}>
          {commercialBlocked ? <ComicButton compact title="Vezi opțiunile" subtitle="Probleme gratuite sau Premium." icon="trophy" tone="lime" onPress={() => {
            resumeAfterPaywall.current = true;
            navigation.navigate('Paywall', { source: 'quota', ...(screenState.access ? { access: screenState.access } : {}) });
          }} /> : null}
          {!rejected && !commercialBlocked ? <ComicButton compact title="Încearcă din nou" icon="scan" tone="lime" onPress={() => setRequestKey((value) => value + 1)} /> : null}
          {!commercialBlocked ? <ComicButton compact title="Fotografiază din nou" icon="camera" tone={rejected ? 'lime' : 'violet'} onPress={retakePhoto} /> : null}
          <Pressable accessibilityRole="button" onPress={returnToPhotoOrHome} style={styles.backLink}>
            <Text style={styles.backLinkText}>{navigation.canGoBack() ? 'Înapoi la fotografia aleasă' : 'Înapoi acasă'}</Text>
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
        <Pressable accessibilityRole="button" accessibilityLabel="Oprește analiza și revino acasă" onPress={leaveAnalysis} style={styles.stopButton}>
          <MiniGlyph name="close" size={15} color={colors.paper} />
          <Text style={styles.stopText}>OPREȘTE</Text>
        </Pressable>
      </View>
      <View style={[styles.stage, { height: stageHeight }]}>
        <Animated.View style={[styles.orbit, { width: orbitSize, height: orbitSize, borderRadius: orbitSize / 2, transform: [{ rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
          <View style={styles.orbitDotA} /><View style={styles.orbitDotB} /><View style={styles.orbitDotC} />
        </Animated.View>
        <View style={[styles.halo, { width: haloSize, height: haloSize, borderRadius: haloSize / 2 }]} />
        <Animated.View style={{ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [5, -7] }) }] }}>
          <Image accessible={false} source={require('../../assets/profu-mascot-v2.png')} resizeMode="contain" style={[styles.mascot, isCompact && styles.mascotCompact, isVeryShort && styles.mascotShort]} />
        </Animated.View>
        <View style={[styles.thought, isCompact && styles.thoughtCompact]}><Text style={styles.thoughtText}>{isCheck ? 'Mă uit cu atenție la fiecare pas.' : 'Citesc cu atenție enunțul.'}</Text></View>
      </View>
      <Text style={[styles.title, isNarrow && styles.titleNarrow]}>{isCheck ? 'Verific fiecare pas.' : 'Pregătesc rezolvarea.'}</Text>
      <Text accessibilityLiveRegion="polite" style={styles.subtitle}>
        {takingLong ? 'Încă lucrez. Problemele mai lungi pot avea nevoie de puțin timp.' : 'Poate dura puțin, în funcție de problemă și de conexiune.'}
      </Text>
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
  closeButton: { width: 48, height: 48, borderRadius: 15, borderWidth: 2, borderColor: '#6557A1', backgroundColor: '#2C2457', alignItems: 'center', justifyContent: 'center' },
  stopButton: { minWidth: 88, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: '#6557A1', backgroundColor: '#2C2457', borderRadius: 15, paddingHorizontal: 10 },
  stopText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 12, letterSpacing: 0.8 },
  stage: { alignItems: 'center', justifyContent: 'center' },
  orbit: { position: 'absolute', borderWidth: 3, borderColor: '#6557A1', borderStyle: 'dashed' },
  halo: { position: 'absolute', backgroundColor: '#302368' },
  orbitDotA: { position: 'absolute', width: 21, height: 21, borderRadius: 8, backgroundColor: colors.lime, borderWidth: 2, borderColor: colors.ink, top: 11, left: 28 },
  orbitDotB: { position: 'absolute', width: 17, height: 17, borderRadius: 9, backgroundColor: colors.peach, borderWidth: 2, borderColor: colors.ink, bottom: 28, right: 8 },
  orbitDotC: { position: 'absolute', width: 13, height: 13, backgroundColor: colors.cyan, borderWidth: 2, borderColor: colors.ink, top: 109, right: -7, transform: [{ rotate: '14deg' }] },
  mascot: { width: 205, height: 216 },
  mascotCompact: { width: 176, height: 186 },
  mascotShort: { width: 148, height: 156 },
  thought: { position: 'absolute', right: 0, top: 35, maxWidth: 135, backgroundColor: colors.lime, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 17, paddingHorizontal: 10, paddingVertical: 8, transform: [{ rotate: '4deg' }] },
  thoughtCompact: { top: 23, right: -2, maxWidth: 121 },
  thoughtText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 13, lineHeight: 17, textAlign: 'center' },
  title: { fontFamily: fonts.display, color: colors.paper, fontSize: 31, lineHeight: 34, textAlign: 'center' },
  titleNarrow: { fontSize: 27, lineHeight: 30 },
  subtitle: { minHeight: 36, paddingHorizontal: 8, fontFamily: fonts.body, color: '#B9B0D2', fontSize: 13, lineHeight: 17, textAlign: 'center', marginTop: 3 },
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
  messageScroll: { flex: 1 },
  messageArea: { flexGrow: 1, justifyContent: 'center', paddingBottom: 10 },
  messageAreaShort: { paddingTop: 8 },
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
  backLink: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  backLinkText: { fontFamily: fonts.bodyBold, color: '#B9B0D2', fontSize: 12 },
});
