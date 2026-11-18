import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnalysisActivity } from '../components/AnalysisActivity';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { FeedbackSheet } from '../../feedback/components/FeedbackSheet';
import { MathExpression } from '../../math/components/MathEditor';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { Text } from '../../../shared/ui/Typography';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { commercialGateFromError } from '../../access/services/commercial';
import { analyzeOrResumeWrittenMath } from '../services/mathAnalysis';
import { readMathDraft } from '../../math/services/mathDraft';
import { clearPendingAnalysis } from '../services/pendingAnalysis';
import { assertSessionActive, captureSession } from '../../../shared/services/sessionGuard';
import { beginLessonPresentation, waitForLessonPresentation } from '../../lessons/services/lessonPresentation';
import { recordDiagnosticError } from '../../../shared/services/diagnostics';
import { colors, fonts } from '../../../shared/theme';
import type { CommercialAccess, MathAnalysis, RootStackParamList } from '../../../shared/types';
import { contentToAccessibleText } from '../../math/utils/mathContent';
import { serializeMathDocument } from '../../math/utils/mathEditor';
import { friendlyWrittenMathError } from '../utils/writtenMathErrors';

type Props = NativeStackScreenProps<RootStackParamList, 'MathProcessing'>;
type State = { kind: 'working' } | { kind: 'error'; message: string; canEdit?: boolean }
  | { kind: 'commercial'; message: string; access: CommercialAccess | null }
  | { kind: 'rejected'; result: MathAnalysis };

export function MathProcessingScreen({ route, navigation }: Props) {
  const { gutter, isVeryShort, isNarrow } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState<State>({ kind: 'working' });
  const [attempt, setAttempt] = useState(0);
  const [slow, setSlow] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [preparingLesson, setPreparingLesson] = useState(false);
  const float = useRef(new Animated.Value(0)).current;
  const returningFromPaywall = useRef(false);
  const { mode, math, requestId, userId, origin } = route.params;
  const [preview] = useState(() => {
    try {
      const draft = readMathDraft(mode, captureSession(userId));
      // A resumed request may outlive an edited draft. Show only the exact submitted problem.
      return draft && serializeMathDocument(draft.problem) === math.problemLatex ? draft.problem : null;
    } catch { return null; }
  });
  const goHome = () => navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  useFocusEffect(useCallback(() => {
    if (returningFromPaywall.current) { returningFromPaywall.current = false; setAttempt((value) => value + 1); }
  }, []));

  useEffect(() => {
    float.setValue(0);
    if (reducedMotion || state.kind !== 'working') return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1_650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1_650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [float, reducedMotion, state.kind]);

  useEffect(() => {
    let mounted = true;
    let session: ReturnType<typeof captureSession>;
    try { session = captureSession(userId); } catch { setState({ kind: 'error', message: 'Contul s-a schimbat. Revino acasă și reia problema.' }); return; }
    const active = () => { if (!mounted) return false; try { assertSessionActive(session); return true; } catch { return false; } };
    setState({ kind: 'working' });
    setSlow(false);
    setPreparingLesson(false);
    const timer = setTimeout(() => { if (active()) setSlow(true); }, 20_000);
    void analyzeOrResumeWrittenMath(mode, math, requestId, origin === 'home' || attempt > 0, () => !active(), userId)
      .then(async ({ result, lessonId }) => {
        if (!active()) return;
        if (result.status === 'ready' && lessonId) {
          setPreparingLesson(true);
          const params: RootStackParamList['Lesson'] = { lesson: result, lessonId, source: 'flow' };
          beginLessonPresentation(lessonId);
          navigation.preload('Lesson', params);
          await waitForLessonPresentation(lessonId);
          if (!active()) return;
          clearPendingAnalysis(requestId);
          navigation.replace('Lesson', params);
        } else if (result.status !== 'ready') {
          clearPendingAnalysis(requestId);
          setState({ kind: 'rejected', result });
        } else setState({ kind: 'error', message: 'Rezultatul nu a putut fi deschis. Încearcă din nou.' });
      })
      .catch((error) => {
        if (!active()) return;
        recordDiagnosticError('analysis_request', error);
        const gate = commercialGateFromError(error);
        setState(gate ? { kind: 'commercial', message: gate.message, access: gate.access }
          : { kind: 'error', message: friendlyWrittenMathError(error), canEdit: String(error?.code).endsWith('/invalid-argument') });
      });
    return () => { mounted = false; clearTimeout(timer); };
  }, [attempt, math, mode, navigation, origin, requestId, userId]);

  const edit = () => {
    clearPendingAnalysis(requestId);
    if (origin === 'editor' && navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'MathInput', params: { mode } }] });
  };
  const working = state.kind === 'working';
  const title = working ? mode === 'check' ? 'Verific rezolvarea ta.' : 'Pregătesc explicația.'
    : state.kind === 'rejected' ? 'Mai avem ceva de clarificat.' : state.kind === 'commercial' ? 'Accesul tău' : 'Nu am terminat analiza.';
  const message = working
    ? slow ? 'Încă lucrez. Unele probleme au nevoie de mai mult timp.' : 'Problema ta, explicată pas cu pas. Poate dura puțin.'
    : state.kind === 'rejected' ? contentToAccessibleText(state.result.summary) : state.message;
  return (
    <SafeAreaView style={[styles.safe, { paddingHorizontal: gutter }]} edges={['top']}>
      <StatusBar style="light" />
      <ComicBackdrop dark />
      <View style={styles.header}>
        <Text style={styles.brand}>Profu’ de mate</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={working ? 'Continuă analiza în fundal și revino acasă' : 'Înapoi acasă'} onPress={goHome} style={({ pressed }) => [styles.home, pressed && styles.pressed]}>
          <MiniGlyph name="back" size={15} color={colors.paper} /><Text style={styles.homeText}>ACASĂ</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, isVeryShort && styles.contentCompact]} bounces={false} showsVerticalScrollIndicator={false}>
        <View style={[styles.stage, isVeryShort && styles.stageCompact, !working && styles.messageStage]}>
          <View style={[styles.halo, !working && styles.messageHalo]} />
          {working ? <View style={[styles.paper, isVeryShort && styles.paperCompact]}>
            <Text style={styles.paperLabel}>{mode === 'check' ? 'VERIFICĂM ÎMPREUNĂ' : 'PROBLEMA TA'}</Text>
            <View style={styles.formula}>
              {preview ? <MathExpression document={preview} accessibilityLabel="Problema trimisă spre analiză" /> : <AppIcon name="verify" size={68} />}
            </View>
            <View style={styles.paperRule} />
          </View> : null}
          <Animated.View pointerEvents="none" style={[styles.mascotWrap, !working && styles.messageMascotWrap, {
            transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
          }]}>
            <Image accessible={false} source={require('../../../../assets/profu-mascot-v2.png')} resizeMode="contain" style={[styles.mascot, isVeryShort && styles.mascotCompact]} />
            {working ? <View style={[styles.bubble, mode === 'check' && styles.bubbleCheck]}><Text style={styles.bubbleText}>Hai să vedem!</Text></View> : null}
          </Animated.View>
        </View>
        <View accessibilityRole={working ? undefined : 'alert'} style={!working && styles.messageCard}>
          {!working ? <Text style={styles.eyebrow}>{state.kind === 'rejected' ? 'HAI SĂ MAI ÎNCERCĂM' : state.kind === 'commercial' ? 'CONTINUĂ ÎN RITMUL TĂU' : 'MAI ÎNCERCĂM O DATĂ'}</Text> : null}
          <Text style={[styles.title, isNarrow && styles.titleNarrow, !working && styles.messageTitle]}>{title}</Text>
          <Text accessibilityLiveRegion="polite" style={[styles.copy, !working && styles.messageCopy]}>{message}</Text>
        </View>
      </ScrollView>
      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {working ? <AnalysisActivity preparing={preparingLesson} check={mode === 'check'} /> : null}
        {state.kind === 'error' ? <ComicButton compact title={state.canEdit ? 'Editează problema' : 'Încearcă din nou'} icon="verify" onPress={state.canEdit ? edit : () => setAttempt((value) => value + 1)} /> : null}
        {state.kind === 'commercial' ? <ComicButton compact title="Vezi opțiunile" icon="trophy" onPress={() => {
          returningFromPaywall.current = true;
          navigation.navigate('Paywall', { source: 'quota', ...(state.access ? { access: state.access } : {}) });
        }} /> : null}
        {state.kind === 'rejected' ? <><ComicButton compact title="Editează problema" icon="verify" onPress={edit} /><Pressable accessibilityRole="button" onPress={() => setFeedback(true)} style={styles.report}><Text style={styles.reportText}>Raportează răspunsul</Text></Pressable></> : null}
      </View>
      <FeedbackSheet visible={feedback} requestId={requestId} onClose={() => setFeedback(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink, overflow: 'hidden' },
  header: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { flex: 1, fontFamily: fonts.displaySemi, color: colors.paper, fontSize: 18 },
  home: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: '#6557A1', backgroundColor: '#2C2457', borderRadius: 15 },
  homeText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 12, letterSpacing: 0.8 },
  pressed: { opacity: 0.76 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingVertical: 20, justifyContent: 'center', gap: 28 },
  contentCompact: { paddingVertical: 10, gap: 16 },
  stage: { height: 250, justifyContent: 'center', alignItems: 'center' },
  stageCompact: { height: 188 },
  halo: { position: 'absolute', width: 228, height: 228, borderRadius: 114, backgroundColor: '#362275', right: 2, top: 5 },
  paper: { width: '88%', alignSelf: 'flex-start', minHeight: 170, padding: 18, paddingRight: 75, borderRadius: 23, borderWidth: 3, borderColor: '#080615', backgroundColor: colors.canvas, transform: [{ rotate: '-4deg' }], shadowColor: '#080615', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 1, shadowRadius: 0, elevation: 5 },
  paperCompact: { minHeight: 145, paddingVertical: 12 },
  paperLabel: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 10, letterSpacing: 1 },
  formula: { minHeight: 85, maxHeight: 110, justifyContent: 'center', overflow: 'hidden' },
  paperRule: { height: 2, backgroundColor: colors.violetSoft },
  mascotWrap: { position: 'absolute', bottom: -3, right: -3, alignItems: 'center' },
  mascot: { width: 154, height: 180 },
  mascotCompact: { width: 126, height: 148 },
  bubble: { position: 'absolute', right: 6, top: -15, minHeight: 34, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 13, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.lime, transform: [{ rotate: '4deg' }] },
  bubbleCheck: { backgroundColor: colors.peach },
  bubbleText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 37, color: colors.paper, textAlign: 'center' },
  titleNarrow: { fontSize: 28, lineHeight: 32 },
  copy: { marginTop: 10, paddingHorizontal: 5, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: '#C5BCD9', textAlign: 'center' },
  actions: { paddingTop: 8, gap: 5 },
  report: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  reportText: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#C5BCD9' },
  messageStage: { height: 156 },
  messageHalo: { width: 150, height: 150, borderRadius: 75, right: undefined, top: 0 },
  messageMascotWrap: { position: 'relative', right: 0, bottom: 0 },
  messageCard: { padding: 20, borderWidth: 3, borderColor: '#080615', borderRadius: 24, backgroundColor: colors.canvas },
  eyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 10, letterSpacing: 1, marginBottom: 8 },
  messageTitle: { color: colors.ink, textAlign: 'left' },
  messageCopy: { color: colors.inkSoft, textAlign: 'left', paddingHorizontal: 0 },
});
