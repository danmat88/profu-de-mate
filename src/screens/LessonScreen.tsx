import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { ComicButton } from '../components/ComicButton';
import { MiniGlyph } from '../components/MiniGlyph';
import { ScreenHeader } from '../components/ScreenHeader';
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
  const [step, setStep] = useState(0);
  const [alternate, setAlternate] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const reveal = useRef(new Animated.Value(0)).current;
  const alternateReveal = useRef(new Animated.Value(0)).current;
  const savedReveal = useRef(new Animated.Value(0)).current;
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCheck = route.params.mode === 'check';
  const steps = useMemo(() => isCheck ? checkSteps : solveSteps, [isCheck]);
  const current = steps[step];

  useEffect(() => {
    setAlternate(false);
    alternateReveal.setValue(0);
    reveal.setValue(0);
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
      <ScreenHeader title={isCheck ? 'Feedback pe rezolvare' : 'Lecția ta'} eyebrow={`PASUL ${step + 1} DIN ${steps.length}`} onBack={() => navigation.popToTop()} rightIcon="bookmark" rightActive={saved} onRight={toggleSaved} />
      {showSavedToast ? <Animated.View pointerEvents="none" style={[styles.savedToast, { opacity: savedReveal, transform: [{ translateY: savedReveal.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }, { scale: savedReveal.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}><MiniGlyph name="check" size={16} /><Text style={styles.savedText}>Salvat în caiet</Text></Animated.View> : null}
      <View style={styles.progress}>
        {steps.map((_, index) => <View key={index} style={styles.progressPart}>{index <= step ? <Animated.View style={[styles.progressPartActive, index === step && { opacity: reveal, transform: [{ scaleX: reveal }] }]} /> : null}</View>)}
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.problemRow}>
          <View style={styles.problemIcon}><Text style={styles.problemIconText}>x</Text></View>
          <View><Text style={styles.problemLabel}>PROBLEMA TA</Text><Text style={styles.problem}>2x² − 5x − 3 = 0</Text></View>
        </View>

        <Animated.View style={[styles.panelWrap, { opacity: reveal, transform: [{ translateX: reveal.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }, { rotate: '-0.5deg' }] }]}>
          <View style={styles.panelShadow} />
          <View style={styles.panel}>
            <View style={[styles.kicker, { backgroundColor: current.tone }]}><Text style={styles.kickerText}>{current.kicker}</Text></View>
            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.body}>{current.body}</Text>
            {current.compare ? (
              <View style={styles.compare}>
                <View style={styles.compareLine}><View style={styles.wrongGlyph}><MiniGlyph name="wrong" size={17} color={colors.paper} /></View><Text style={styles.wrong}>{current.compare.wrong}</Text></View>
                <View style={styles.compareLine}><View style={styles.rightGlyph}><MiniGlyph name="check" size={16} /></View><Text style={styles.right}>{current.compare.right}</Text></View>
              </View>
            ) : null}
            <View style={[styles.mathBox, { borderBottomColor: current.tone }]}><Text style={styles.math}>{current.math}</Text></View>
            <View style={styles.noteRow}>
              <Image source={require('../../assets/profu-mascot-v2.png')} resizeMode="contain" style={styles.miniMascot} />
              <View style={styles.noteBubble}><Text style={styles.note}>{current.note}</Text></View>
            </View>
          </View>
        </Animated.View>

        <Pressable accessibilityRole="button" accessibilityState={{ expanded: alternate }} onPress={explainDifferently} style={styles.explain}>
          <AppIcon name="explain" size={56} />
          <View style={{ flex: 1 }}><Text style={styles.explainTitle}>{alternate ? 'Așa e mai clar?' : 'Explică-mi altfel'}</Text><Text style={styles.explainText}>{alternate ? 'Poți reveni oricând la explicația inițială.' : 'Cu un exemplu mai simplu sau mai vizual.'}</Text></View>
          <MiniGlyph name={alternate ? 'close' : 'next'} size={22} color={colors.inkSoft} />
        </Pressable>
        {alternate ? (
          <Animated.View style={[styles.alternateCard, { opacity: alternateReveal, transform: [{ translateY: alternateReveal.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }, { scale: alternateReveal.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
            <View style={styles.alternateIcon}><AppIcon name="hint" size={44} /></View>
            <Text style={styles.alternateText}>{current.alternative}</Text>
          </Animated.View>
        ) : null}

        <ComicButton title={step === steps.length - 1 ? 'Vezi recapitularea' : 'Am înțeles, următorul'} icon={step === steps.length - 1 ? 'trophy' : 'verify'} tone="lime" onPress={next} />
        {step > 0 ? <Pressable onPress={() => setStep((value) => value - 1)} style={styles.previous}><MiniGlyph name="back" size={18} color={colors.inkSoft} /><Text style={styles.previousText}>Pasul anterior</Text></Pressable> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginBottom: 9 },
  savedToast: { position: 'absolute', zIndex: 20, right: 18, top: 59, minHeight: 34, borderRadius: 12, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9 },
  savedText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 10 },
  progressPart: { flex: 1, height: 6, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' },
  progressPartActive: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 4, backgroundColor: colors.violet },
  content: { paddingHorizontal: 19, paddingBottom: 35 },
  problemRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 3 },
  problemIcon: { width: 41, height: 41, borderRadius: 14, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] },
  problemIconText: { fontFamily: fonts.display, color: colors.violetDeep, fontSize: 23 },
  problemLabel: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.2 },
  problem: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 18 },
  panelWrap: { marginTop: 10, marginBottom: 20, position: 'relative' },
  panelShadow: { position: 'absolute', left: 8, right: -8, top: 9, bottom: -9, borderRadius: 28, backgroundColor: colors.ink },
  panel: { minHeight: 340, borderRadius: 28, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper, padding: 19, overflow: 'hidden' },
  kicker: { alignSelf: 'flex-start', borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 10, paddingVertical: 5, transform: [{ rotate: '-3deg' }] },
  kickerText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9, letterSpacing: 1.2 },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 29, lineHeight: 32, marginTop: 14 },
  body: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 14, lineHeight: 20, marginTop: 5 },
  compare: { backgroundColor: colors.canvas, borderRadius: 15, padding: 10, marginTop: 13, gap: 7 },
  compareLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  wrongGlyph: { width: 22, height: 22, borderRadius: 8, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '4deg' }] },
  rightGlyph: { width: 22, height: 22, borderRadius: 8, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  wrong: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 14, textDecorationLine: 'line-through' },
  right: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 14 },
  mathBox: { marginTop: 15, backgroundColor: colors.ink, borderRadius: 17, borderBottomWidth: 7, paddingHorizontal: 13, paddingVertical: 14 },
  math: { fontFamily: fonts.displaySemi, color: colors.paper, fontSize: 18, lineHeight: 23, textAlign: 'center' },
  noteRow: { minHeight: 85, marginTop: 13, flexDirection: 'row', alignItems: 'center' },
  miniMascot: { width: 76, height: 78, marginLeft: -6, zIndex: 2 },
  noteBubble: { flex: 1, minHeight: 58, borderRadius: 16, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.limeSoft, paddingHorizontal: 11, paddingVertical: 8, marginLeft: -4 },
  note: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11.5, lineHeight: 15 },
  explain: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 2, borderBottomWidth: 2, borderColor: colors.line, marginBottom: 17, paddingHorizontal: 2 },
  explainTitle: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 13 },
  explainText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 11, marginTop: 1 },
  alternateCard: { minHeight: 88, marginTop: -7, marginBottom: 17, borderRadius: 20, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.cyan, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 10, shadowColor: colors.ink, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 5, height: 6 }, elevation: 5 },
  alternateIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  alternateText: { flex: 1, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11.5, lineHeight: 16 },
  previous: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10 },
  previousText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 12 },
});
