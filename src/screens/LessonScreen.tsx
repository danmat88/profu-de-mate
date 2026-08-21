import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { ComicButton } from '../components/ComicButton';
import { MiniGlyph } from '../components/MiniGlyph';
import { ScreenHeader } from '../components/ScreenHeader';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Lesson'>;
type LessonStep = { kicker: string; title: string; body: string; math: string; note: string; alternative: string; tone: string; compare?: { wrong: string; right: string } };

const solveSteps: LessonStep[] = [
  { kicker: 'PUNEM ETICHETE', title: 'Cine este cine?', body: 'Comparăm ecuația cu forma ax² + bx + c = 0. Așa vedem imediat valorile de care avem nevoie.', math: 'a = 2    b = −5    c = −3', note: 'Semnul face parte din număr: c este −3, nu 3.', alternative: 'Imaginează-ți că a, b și c sunt trei etichete. Le lipești, în ordine, pe numerele din fața lui x², x și termenul liber.', tone: colors.cyan },
  { kicker: 'MĂSURĂM TERENUL', title: 'Calculăm discriminantul', body: 'Discriminantul ne spune câte soluții reale vom găsi. Înlocuim atent fiecare coeficient.', math: 'Δ = (−5)² − 4 · 2 · (−3) = 49', note: 'Minus cu minus devine plus. De aici apare 25 + 24.', alternative: 'Gândește-te la Δ ca la un semafor: pozitiv înseamnă două drumuri, zero un singur drum, negativ niciun drum real.', tone: colors.peach },
  { kicker: 'ULTIMA MUTARE', title: 'Aplicăm formula', body: 'Fiindcă Δ este pozitiv, avem două soluții. Punem √49 = 7 în formula ecuației.', math: 'x₁ = 3    și    x₂ = −1/2', note: 'Le putem verifica înlocuindu-le în ecuația inițială.', alternative: 'Semnul ± deschide două uși: prin una aduni 7, prin cealaltă scazi 7. De aceea apar două soluții.', tone: colors.lime },
];

const checkSteps: LessonStep[] = [
  { kicker: 'CE AI FĂCUT BINE', title: 'Metoda este potrivită', body: 'Ai recunoscut corect coeficienții și ai ales discriminantul. Startul rezolvării este bun.', math: 'a = 2    b = −5    c = −3', note: 'Păstrăm tot ce ai făcut până aici.', alternative: 'Ai ales traseul corect. Nu refacem rezolvarea; păstrăm pașii buni și căutăm doar locul unde s-a schimbat rezultatul.', tone: colors.mint },
  { kicker: 'AICI S-A STRECURAT', title: 'Un semn schimbă tot', body: 'Produsul 4 · 2 · (−3) este negativ. Când îl scădem, obținem o adunare.', math: '25 − (−24) = 25 + 24 = 49', note: 'Nu e o problemă de metodă, ci doar de semn.', alternative: 'Dacă scoți o datorie de 24, de fapt câștigi 24. Asta face expresia 25 − (−24): devine 25 + 24.', tone: colors.peach, compare: { wrong: 'Δ = 25 − 24 = 1', right: 'Δ = 25 + 24 = 49' } },
  { kicker: 'CONTINUĂM CORECT', title: 'Rezultatul se repară', body: 'Cu Δ = 49, radicalul este 7. Acum formula produce cele două soluții corecte.', math: 'x₁ = 3    și    x₂ = −1/2', note: 'Ai fost la un singur semn distanță de răspuns.', alternative: 'Corectăm o singură piesă, Δ, apoi restul mecanismului tău funcționează: √49 este 7 și formula dă două răspunsuri.', tone: colors.lime },
];

export function LessonScreen({ navigation, route }: Props) {
  const { gutter, isNarrow, isCompact } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [alternate, setAlternate] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const reveal = useRef(new Animated.Value(0)).current;
  const alternateReveal = useRef(new Animated.Value(0)).current;
  const savedReveal = useRef(new Animated.Value(0)).current;
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const isCheck = route.params.mode === 'check';
  const isFromNotebook = route.params.source === 'notebook';
  const steps = useMemo(() => isCheck ? checkSteps : solveSteps, [isCheck]);
  const current = steps[step];
  const nextTitle = step === steps.length - 1
    ? 'Vezi rezultatul'
    : step > 0
      ? 'Următorul pas'
      : 'Am înțeles, următorul';
  const bottomSpace = Math.max(insets.bottom, 10);

  useEffect(() => {
    setAlternate(false);
    alternateReveal.setValue(0);
    reveal.setValue(0);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    Animated.spring(reveal, { toValue: 1, useNativeDriver: true, speed: 9, bounciness: 6 }).start();
  }, [alternateReveal, reveal, step]);

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  const next = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < steps.length - 1) setStep((value) => value + 1);
    else navigation.replace('Summary', { mode: route.params.mode });
  };

  const explainDifferently = () => {
    Haptics.selectionAsync();
    if (alternate) {
      Animated.timing(alternateReveal, { toValue: 0, duration: 130, useNativeDriver: true }).start(() => setAlternate(false));
      return;
    }
    setAlternate(true);
    Animated.spring(alternateReveal, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
  };

  const toggleSaved = () => {
    const nextSaved = !saved;
    setSaved(nextSaved);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    if (!nextSaved) {
      setShowSavedToast(false);
      return;
    }
    setShowSavedToast(true);
    savedReveal.setValue(0);
    Animated.spring(savedReveal, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 9 }).start();
    savedTimer.current = setTimeout(() => setShowSavedToast(false), 1700);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <ScreenHeader title={isCheck ? 'Feedback pe rezolvare' : 'Lecția ta'} eyebrow={`PASUL ${step + 1} DIN ${steps.length}`} onBack={() => isFromNotebook ? navigation.goBack() : navigation.popToTop()} rightIcon="bookmark" rightLabel={saved ? 'Elimină din caiet' : 'Salvează în caiet'} rightActive={saved} onRight={toggleSaved} />
      {showSavedToast ? <Animated.View pointerEvents="none" style={[styles.savedToast, { opacity: savedReveal, transform: [{ translateY: savedReveal.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }, { scale: savedReveal.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}><MiniGlyph name="check" size={16} /><Text style={styles.savedText}>Salvat în caiet</Text></Animated.View> : null}
      <View style={[styles.progress, { paddingHorizontal: gutter }]}>
        {steps.map((_, index) => <View key={index} style={styles.progressPart}>{index <= step ? <Animated.View style={[styles.progressPartActive, index === step && { opacity: reveal, transform: [{ scaleX: reveal }] }]} /> : null}</View>)}
      </View>
      <ScrollView ref={scrollRef} style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
        <View style={styles.problemRow}>
          <View style={styles.problemIcon}><Text style={styles.problemIconText}>x</Text></View>
          <View style={styles.problemCopy}><Text style={styles.problemLabel}>PROBLEMA TA</Text><Text style={styles.problem}>2x² − 5x − 3 = 0</Text></View>
        </View>

        <Animated.View style={[styles.panelWrap, { opacity: reveal, transform: [{ translateX: reveal.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }, { rotate: '-0.5deg' }] }]}>
          <View style={styles.panelShadow} />
          <View style={[styles.panel, isCompact && styles.panelCompact]}>
            <View style={[styles.kicker, { backgroundColor: current.tone }]}><Text style={styles.kickerText}>{current.kicker}</Text></View>
            <Text style={[styles.title, isNarrow && styles.titleNarrow]}>{current.title}</Text>
            <Text style={styles.body}>{current.body}</Text>
            {current.compare ? (
              <View style={[styles.compare, { borderBottomColor: current.tone }]}>
                <View style={styles.compareLine}><View style={styles.wrongGlyph}><MiniGlyph name="wrong" size={17} color={colors.paper} /></View><Text style={styles.wrong}>{current.compare.wrong}</Text></View>
                <View style={styles.compareLine}><View style={styles.rightGlyph}><MiniGlyph name="check" size={16} /></View><Text style={styles.right}>{current.compare.right}</Text></View>
              </View>
            ) : <View style={[styles.mathBox, { borderBottomColor: current.tone }]}><Text style={[styles.math, isNarrow && styles.mathNarrow]}>{current.math}</Text></View>}
            <View style={styles.noteRow}>
              <Image source={require('../../assets/profu-mascot-v2.png')} resizeMode="contain" style={[styles.miniMascot, isNarrow && styles.miniMascotNarrow]} />
              <View style={styles.noteBubble}><Text style={styles.note}>{current.note}</Text></View>
            </View>
          </View>
        </Animated.View>

        <Pressable accessibilityRole="button" accessibilityState={{ expanded: alternate }} onPress={explainDifferently} style={styles.explain}>
          <AppIcon name="explain" size={56} />
          <View style={styles.explainCopy}><Text style={styles.explainTitle}>Explică-mi altfel</Text><Text style={styles.explainText}>Cu un exemplu mai simplu sau mai vizual.</Text></View>
          <MiniGlyph name="next" size={22} color={colors.inkSoft} />
        </Pressable>
      </ScrollView>
      <View style={[styles.actionDock, { paddingHorizontal: gutter, paddingBottom: bottomSpace }]}>
        {step > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Pasul anterior" onPress={() => setStep((value) => value - 1)} style={styles.previousAction}>
            <MiniGlyph name="back" size={22} color={colors.ink} />
          </Pressable>
        ) : null}
        <ComicButton compact title={nextTitle} icon={step === steps.length - 1 ? 'trophy' : 'verify'} tone="lime" onPress={next} style={styles.nextAction} />
      </View>
      {alternate ? (
        <View style={styles.alternateLayer}>
          <Pressable accessibilityRole="button" accessibilityLabel="Închide explicația" onPress={explainDifferently} style={styles.scrim} />
          <Animated.View style={[styles.alternateSheet, { paddingBottom: bottomSpace + 14, opacity: alternateReveal, transform: [{ translateY: alternateReveal.interpolate({ inputRange: [0, 1], outputRange: [42, 0] }) }] }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeading}>
              <View style={styles.alternateIcon}><AppIcon name="hint" size={42} /></View>
              <View style={styles.sheetCopy}><Text style={styles.sheetEyebrow}>ALTFEL, MAI VIZUAL</Text><Text style={styles.sheetTitle}>Hai s-o vedem mai simplu</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Închide explicația" onPress={explainDifferently} style={styles.sheetClose}><MiniGlyph name="close" size={19} /></Pressable>
            </View>
            <Text style={styles.alternateText}>{current.alternative}</Text>
            <ComicButton compact title="Acum e mai clar" trailingIcon="check" tone="lime" onPress={explainDifferently} />
          </Animated.View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flex: 1 },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginBottom: 9 },
  savedToast: { position: 'absolute', zIndex: 20, right: 18, top: 59, minHeight: 34, borderRadius: 12, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9 },
  savedText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 10 },
  progressPart: { flex: 1, height: 6, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' },
  progressPartActive: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 4, backgroundColor: colors.violet },
  content: { flexGrow: 1, paddingHorizontal: 19, paddingBottom: 0 },
  problemRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 3 },
  problemIcon: { width: 41, height: 41, borderRadius: 14, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] },
  problemIconText: { fontFamily: fonts.display, color: colors.violetDeep, fontSize: 23 },
  problemCopy: { flex: 1 },
  problemLabel: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.2 },
  problem: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 18 },
  panelWrap: { marginTop: 10, marginBottom: 20, position: 'relative' },
  panelShadow: { position: 'absolute', left: 8, right: -8, top: 9, bottom: -9, borderRadius: 28, backgroundColor: colors.ink },
  panel: { borderRadius: 28, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper, padding: 19, overflow: 'hidden' },
  panelCompact: { borderRadius: 24, padding: 16 },
  kicker: { alignSelf: 'flex-start', borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 10, paddingVertical: 5, transform: [{ rotate: '-3deg' }] },
  kickerText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9, letterSpacing: 1.2 },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 29, lineHeight: 32, marginTop: 14 },
  titleNarrow: { fontSize: 25, lineHeight: 28 },
  body: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 14, lineHeight: 20, marginTop: 5 },
  compare: { backgroundColor: colors.canvas, borderRadius: 15, borderBottomWidth: 7, padding: 10, marginTop: 15, gap: 7 },
  compareLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  wrongGlyph: { width: 22, height: 22, borderRadius: 8, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '4deg' }] },
  rightGlyph: { width: 22, height: 22, borderRadius: 8, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  wrong: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 14, textDecorationLine: 'line-through' },
  right: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 14 },
  mathBox: { marginTop: 15, backgroundColor: colors.ink, borderRadius: 17, borderBottomWidth: 7, paddingHorizontal: 13, paddingVertical: 14 },
  math: { fontFamily: fonts.displaySemi, color: colors.paper, fontSize: 18, lineHeight: 23, textAlign: 'center' },
  mathNarrow: { fontSize: 16, lineHeight: 21 },
  noteRow: { minHeight: 85, marginTop: 13, flexDirection: 'row', alignItems: 'center' },
  miniMascot: { width: 76, height: 78, marginLeft: -6, zIndex: 2 },
  miniMascotNarrow: { width: 64, height: 68 },
  noteBubble: { flex: 1, minHeight: 58, borderRadius: 16, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.limeSoft, paddingHorizontal: 11, paddingVertical: 8, marginLeft: -4 },
  note: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11.5, lineHeight: 15 },
  explain: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: colors.line, borderRadius: 18, backgroundColor: '#F4EEFF', marginVertical: 'auto', paddingHorizontal: 10 },
  explainCopy: { flex: 1 },
  explainTitle: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 13 },
  explainText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 11, marginTop: 1 },
  actionDock: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: colors.canvas, borderTopWidth: 1.5, borderTopColor: colors.line, paddingTop: 10 },
  previousAction: { width: 57, height: 57, borderRadius: 18, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  nextAction: { flex: 1, minWidth: 0 },
  alternateLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 30, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(23,19,55,0.42)' },
  alternateSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 3, borderBottomWidth: 0, borderColor: colors.ink, backgroundColor: colors.paper, paddingHorizontal: 19, paddingTop: 9 },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 12 },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  alternateIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.cyan, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  sheetCopy: { flex: 1 },
  sheetEyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.2 },
  sheetTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 20, lineHeight: 23 },
  sheetClose: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center' },
  alternateText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 19, marginTop: 15, marginBottom: 17 },
});
