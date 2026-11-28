import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { beginAppTransition } from '../../../shared/context/TransitionMotionContext';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { createNativeLoop } from '../../../shared/motion/nativeMotion';
import { recordDiagnosticError } from '../../../shared/services/diagnostics';
import { assertSessionActive, captureSession } from '../../../shared/services/sessionGuard';
import { borders, colors, fonts } from '../../../shared/theme';
import type { CommercialAccess, MathAnalysis, RootStackParamList } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import {
  CachedInsetRelief,
  CachedOutsetShadow,
  LIQUID_SHADOWS,
} from '../../../shared/ui/CachedRelief';
import { Chip } from '../../../shared/ui/Chip';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { ComicCard } from '../../../shared/ui/ComicCard';
import { Enter } from '../../../shared/ui/Enter';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { Text } from '../../../shared/ui/Typography';
import { QuotaResetTimer } from '../../access/components/QuotaResetTimer';
import { useCommercial } from '../../access/context/CommercialContext';
import { commercialGateFromError, isTemporaryCommercialLimit } from '../../access/services/commercial';
import { FeedbackSheet } from '../../feedback/components/FeedbackSheet';
import { beginLessonPresentation, waitForLessonPresentation } from '../../lessons/services/lessonPresentation';
import { MathExpression } from '../../math/components/MathEditor';
import { readMathDraft } from '../../math/services/mathDraft';
import { contentToAccessibleText } from '../../math/utils/mathContent';
import { serializeMathDocument } from '../../math/utils/mathEditor';
import { recordDailyStudyActivity } from '../../practice/services/practiceStorage';
import { AnalysisActivity } from '../components/AnalysisActivity';
import { analyzeOrResumeWrittenMath } from '../services/mathAnalysis';
import { clearPendingAnalysis, savePendingWrittenMath } from '../services/pendingAnalysis';
import { friendlyWrittenMathError } from '../utils/writtenMathErrors';

type Props = NativeStackScreenProps<RootStackParamList, 'MathProcessing'>;
type State = { kind: 'working' } | { kind: 'error'; message: string; canEdit?: boolean }
  | { kind: 'commercial'; message: string; access: CommercialAccess | null }
  | { kind: 'rejected'; result: MathAnalysis };

export function MathProcessingScreen({ route, navigation }: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, isVeryShort, isNarrow } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const focused = useIsFocused();
  const { access: commercialAccess } = useCommercial();
  const [state, setState] = useState<State>({ kind: 'working' });
  const [attempt, setAttempt] = useState(0);
  const [slow, setSlow] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [preparingLesson, setPreparingLesson] = useState(false);
  const [sceneReady, setSceneReady] = useState(reducedMotion);
  const haloSpin = useRef(new Animated.Value(0)).current;
  const returningFromPaywall = useRef(false);
  const { mode, math, requestId, userId, origin } = route.params;
  const [preview] = useState(() => {
    try {
      const draft = readMathDraft(mode, captureSession(userId));
      // A resumed request may outlive an edited draft. Show only the exact submitted problem.
      return draft && serializeMathDocument(draft.problem) === math.problemLatex ? draft.problem : null;
    } catch { return null; }
  });
  const goHome = () => {
    if (state.kind !== 'working') clearPendingAnalysis(requestId);
    beginAppTransition();
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  useEffect(() => {
    if (!focused || !sceneReady || reducedMotion || state.kind !== 'working') {
      haloSpin.stopAnimation();
      return undefined;
    }
    const loop = createNativeLoop(haloSpin, 26_000);
    loop.start();
    return () => {
      loop.stop();
      haloSpin.stopAnimation();
    };
  }, [focused, haloSpin, reducedMotion, sceneReady, state.kind]);

  const haloSpinStyle = useMemo(
    () => ({
      transform: [
        {
          rotate: haloSpin.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
          }),
        },
      ],
    }),
    [haloSpin],
  );

  useEffect(() => {
    if (reducedMotion) {
      setSceneReady(true);
      return undefined;
    }
    setSceneReady(false);
    let settled = false;
    let raf1 = 0;
    let raf2 = 0;
    const markReady = () => {
      if (settled) return;
      settled = true;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setSceneReady(true));
      });
    };
    const unsubscribe = navigation.addListener('transitionEnd', (event) => {
      if (!event.data.closing) markReady();
    });
    const fallback = setTimeout(markReady, 550);
    return () => {
      settled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(fallback);
      unsubscribe();
    };
  }, [navigation, reducedMotion]);

  const hardwareBackRef = useRef(() => {
    if (state.kind === 'working') {
      goHome();
      return;
    }
    clearPendingAnalysis(requestId);
    beginAppTransition();
    if (origin === 'editor' && navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  });
  hardwareBackRef.current = () => {
    if (state.kind === 'working') {
      goHome();
      return;
    }
    clearPendingAnalysis(requestId);
    beginAppTransition();
    if (origin === 'editor' && navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  useFocusEffect(useCallback(() => {
    if (returningFromPaywall.current) {
      returningFromPaywall.current = false;
      if (commercialAccess?.canAnalyze) {
        setAttempt((value) => value + 1);
      }
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (feedback) return false;
      hardwareBackRef.current();
      return true;
    });
    return () => subscription.remove();
  }, [commercialAccess?.canAnalyze, feedback]));

  useEffect(() => {
    let mounted = true;
    let session: ReturnType<typeof captureSession>;
    try { session = captureSession(userId); } catch { setState({ kind: 'error', message: 'Contul s-a schimbat. Revino acasă și reia problema.' }); return; }
    savePendingWrittenMath(mode, math, requestId, userId);
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
          const celebrationBeat = new Promise<void>((resolve) => { setTimeout(resolve, 520); });
          await waitForLessonPresentation(lessonId);
          await celebrationBeat;
          if (!active()) return;
          clearPendingAnalysis(requestId);
          recordDailyStudyActivity();
          beginAppTransition();
          navigation.replace('Lesson', params);
        } else if (result.status !== 'ready') {
          clearPendingAnalysis(requestId);
          setState({ kind: 'rejected', result });
        } else {
          clearPendingAnalysis(requestId);
          setState({ kind: 'error', message: 'Rezultatul nu a putut fi deschis. Încearcă din nou.' });
        }
      })
      .catch((error) => {
        if (!active()) return;
        recordDiagnosticError('analysis_request', error);
        const gate = commercialGateFromError(error);
        if (gate && !isTemporaryCommercialLimit(gate.reason)) {
          clearPendingAnalysis(requestId);
          setState({ kind: 'commercial', message: gate.message, access: gate.access });
        } else if (gate) {
          setState({ kind: 'error', message: gate.message });
        } else {
          setState({ kind: 'error', message: friendlyWrittenMathError(error), canEdit: String(error?.code).endsWith('/invalid-argument') });
        }
      });
    return () => { mounted = false; clearTimeout(timer); };
  }, [attempt, math, mode, navigation, origin, requestId, userId]);

  const edit = () => {
    clearPendingAnalysis(requestId);
    beginAppTransition();
    if (origin === 'editor' && navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'MathInput', params: { mode } }] });
  };

  const working = state.kind === 'working';
  const isCheck = mode === 'check';
  const title = working
    ? preparingLesson
      ? 'Lecția ta e gata!'
      : isCheck ? 'Verific rezolvarea ta.' : 'Pregătesc explicația.'
    : state.kind === 'rejected'
      ? 'Mai avem ceva de clarificat.'
      : state.kind === 'commercial' ? 'Ai ajuns la limita de azi.' : 'Nu am terminat analiza.';
  const message = working
    ? preparingLesson
      ? 'Așez pașii și formulele frumos în pagină.'
      : slow
        ? 'Încă lucrez. Unele probleme au nevoie de mai mult timp.'
        : isCheck
          ? 'Verificăm fiecare pas al rezolvării tale. Poate dura puțin.'
          : 'Problema ta, explicată pas cu pas. Poate dura puțin.'
    : state.kind === 'rejected' ? contentToAccessibleText(state.result.summary) : state.message;

  const mascotPose = working
    ? preparingLesson ? 'cheer' : 'thinking'
    : state.kind === 'commercial' ? 'point' : 'oops';

  return (
    <View style={[styles.safe, { paddingHorizontal: gutter, paddingTop: insets.top ?? 0 }]}>
      <StatusBar style="light" />
      <ComicBackdrop dark />
      <View style={styles.header}>
        <View style={styles.brandRow}>
          {working ? <View style={[styles.brandDot, isCheck && styles.brandDotCheck]} /> : null}
          <Text style={styles.brand}>{working ? 'Profu’ lucrează' : 'Profu’ de mate'}</Text>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={working ? 'Continuă analiza în fundal și revino acasă' : 'Înapoi acasă'}
          pressedScale={0.95}
          haptic="selection"
          onPress={goHome}
          backdrop={
            <CachedOutsetShadow
              borderRadius={999}
              shadow={LIQUID_SHADOWS.darkOutset}
              padTop={3}
              padX={5}
              padBottom={9}
            />
          }
          contentStyle={styles.home}
        >
          <CachedInsetRelief borderRadius={999} shadow={LIQUID_SHADOWS.darkInset} />
          <MiniGlyph name="back" size={16} color={colors.paper} />
          <Text style={styles.homeText}>ACASĂ</Text>
        </PressableScale>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isVeryShort && styles.contentCompact]}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.stage, isVeryShort && styles.stageCompact, !working && styles.messageStage]}>
          <View style={[styles.halo, !working && styles.messageHalo]} />
          {working ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.haloOrbit, isCheck && styles.haloOrbitCheck, preparingLesson && styles.haloOrbitReady, haloSpinStyle]}
            />
          ) : null}
          {working ? (
            <View style={styles.paperWrap}>
              <CachedOutsetShadow borderRadius={26} shadow={LIQUID_SHADOWS.darkOutset} />
              <View style={[styles.paper, isVeryShort && styles.paperCompact]}>
                <CachedInsetRelief borderRadius={26} shadow={LIQUID_SHADOWS.cardInset} />
                <View style={styles.paperTopBand}>
                  <View style={styles.paperDot} />
                  <View style={styles.paperDot} />
                  <Text style={styles.paperLabel}>{isCheck ? 'VERIFICĂM ÎMPREUNĂ' : 'PROBLEMA TA'}</Text>
                </View>
                <View style={styles.formula}>
                  {preview ? <MathExpression document={preview} accessibilityLabel="Problema trimisă spre analiză" /> : <AppIcon name="practice" size={62} />}
                </View>
                <View style={styles.paperRule} />
              </View>
            </View>
          ) : null}

          <View pointerEvents="none" style={[styles.mascotWrap, !working && styles.messageMascotWrap]}>
            {working ? (
              <View style={[styles.bubble, isCheck && styles.bubbleCheck, preparingLesson && styles.bubbleReady]}>
                <Text numberOfLines={1} style={styles.bubbleText}>{preparingLesson ? 'Gata! O așez…' : 'Hai să vedem!'}</Text>
              </View>
            ) : null}
            <Mascot pose={mascotPose} size={working ? (isVeryShort ? 124 : 146) : 148} active={focused && (working ? sceneReady : true)} />
          </View>
        </View>

        {working ? (
          <View style={styles.workingCopy}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.74}
              style={[styles.title, styles.workingTitle, isNarrow && styles.titleNarrow, isNarrow && styles.workingTitleNarrow]}
            >
              {title}
            </Text>
            <Text accessibilityLiveRegion="polite" numberOfLines={2} style={[styles.copy, styles.workingSubtitle]}>{message}</Text>
          </View>
        ) : (
          <>
            <Enter delay={60} distance={14}>
              <ComicCard
                tone="paper"
                depth={6}
                radius={24}
                borderWidth={borders.thick}
                shadowColor="#09061B"
                shine
                contentStyle={styles.messageCard}
              >
                <View accessibilityRole="alert">
                  <Chip
                    label={state.kind === 'rejected' ? 'HAI SĂ MAI ÎNCERCĂM' : state.kind === 'commercial' ? 'CONTINUĂ ÎN RITMUL TĂU' : 'MAI ÎNCERCĂM O DATĂ'}
                    tone={state.kind === 'commercial' ? 'gold' : state.kind === 'rejected' ? 'peach' : 'roseSoft'}
                  />
                  <Text style={[styles.title, isNarrow && styles.titleNarrow, styles.messageTitle]}>{title}</Text>
                  <Text accessibilityLiveRegion="polite" style={[styles.copy, styles.messageCopy]}>{message}</Text>
                </View>
              </ComicCard>
            </Enter>
            {state.kind === 'commercial' && (state.access?.resetAt ?? commercialAccess?.resetAt) ? (
              <Enter delay={110} distance={14}>
                <QuotaResetTimer
                  resetAt={state.access?.resetAt ?? commercialAccess?.resetAt}
                  remaining={state.access?.remaining ?? commercialAccess?.remaining ?? 0}
                  limit={state.access?.limit ?? commercialAccess?.limit ?? 5}
                  premium={Boolean(state.access?.premium.active ?? commercialAccess?.premium.active)}
                  planName={
                    (state.access?.premium.active ?? commercialAccess?.premium.active)
                      ? ((state.access?.premium.tier ?? commercialAccess?.premium.tier) === 'max' ? 'Max' : 'Pro')
                      : null
                  }
                  variant="hero"
                  active={focused}
                />
              </Enter>
            ) : null}
          </>
        )}
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {working ? <AnalysisActivity preparing={preparingLesson} check={isCheck} active={focused && sceneReady} /> : null}
        {state.kind === 'error' ? (
          <>
            <ComicButton
              compact
              title={state.canEdit ? 'Editează problema' : 'Încearcă din nou'}
              icon={state.canEdit ? 'practice' : undefined}
              trailingIcon={state.canEdit ? undefined : 'retry'}
              tone="lime"
              onPress={state.canEdit ? edit : () => setAttempt((value) => value + 1)}
            />
            {!state.canEdit && origin === 'editor' ? (
              <Pressable accessibilityRole="button" onPress={edit} style={styles.report}>
                <Text style={styles.reportText}>Înapoi la editor</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
        {state.kind === 'commercial' ? (
          <ComicButton
            compact
            title="Vezi opțiunile"
            icon="trophy"
            tone="lime"
            onPress={() => {
              returningFromPaywall.current = true;
              beginAppTransition();
              navigation.navigate('Paywall', { source: 'quota', ...(state.access ? { access: state.access } : {}) });
            }}
          />
        ) : null}
        {state.kind === 'rejected' ? (
          <>
            <ComicButton compact title="Editează problema" icon="practice" tone="lime" onPress={edit} />
            <Pressable accessibilityRole="button" onPress={() => setFeedback(true)} style={styles.report}>
              <Text style={styles.reportText}>Raportează răspunsul</Text>
            </Pressable>
          </>
        ) : null}
      </View>
      <FeedbackSheet visible={feedback} requestId={requestId} onClose={() => setFeedback(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink, overflow: 'hidden' },
  header: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brandRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.lime },
  brandDotCheck: { backgroundColor: colors.peach },
  brand: { fontFamily: fonts.displaySemi, color: colors.paper, fontSize: 19 },
  home: {
    height: 42,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.1,
    borderColor: 'rgba(196, 176, 255, 0.34)',
    backgroundColor: 'rgba(38, 28, 84, 0.92)',
    borderRadius: 999,
    overflow: 'hidden',
    position: 'relative',
  },
  homeText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 12, letterSpacing: 0.8 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingVertical: 18, justifyContent: 'center', gap: 24 },
  contentCompact: { paddingVertical: 10, gap: 14 },
  stage: { height: 244, justifyContent: 'center', alignItems: 'center' },
  stageCompact: { height: 186 },
  halo: { position: 'absolute', width: 224, height: 224, borderRadius: 112, backgroundColor: 'rgba(124, 60, 255, 0.22)', right: 0, top: 6 },
  haloOrbit: {
    position: 'absolute',
    width: 244,
    height: 244,
    borderRadius: 122,
    right: -10,
    top: -4,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(167, 139, 250, 0.42)',
  },
  haloOrbitCheck: { borderColor: 'rgba(255, 184, 107, 0.5)' },
  haloOrbitReady: { borderColor: colors.lime },
  paperWrap: {
    width: '86%',
    alignSelf: 'flex-start',
    position: 'relative',
  },
  paper: {
    width: '100%',
    minHeight: 172,
    padding: 17,
    paddingRight: 72,
    borderRadius: 26,
    borderWidth: 1.1,
    borderColor: 'rgba(255, 255, 255, 0.94)',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    position: 'relative',
  },
  paperCompact: { minHeight: 146, paddingVertical: 12 },
  paperTopBand: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  paperDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.violetSoft },
  paperLabel: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 11, letterSpacing: 0.8 },
  formula: { minHeight: 82, maxHeight: 108, justifyContent: 'center', overflow: 'hidden' },
  paperRule: { height: 1.5, backgroundColor: colors.borderHairline },
  mascotWrap: { position: 'absolute', bottom: -6, right: -8, alignItems: 'center' },
  bubble: {
    marginBottom: -10,
    marginRight: 6,
    zIndex: 2,
    minWidth: 108,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: colors.lime,
  },
  bubbleCheck: { backgroundColor: colors.peach },
  bubbleReady: { backgroundColor: colors.lime },
  bubbleText: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.ink },
  workingCopy: { alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 35, color: colors.paper, textAlign: 'center' },
  workingTitle: { height: 35 },
  titleNarrow: { fontSize: 26, lineHeight: 30 },
  workingTitleNarrow: { height: 30 },
  copy: { marginTop: 8, paddingHorizontal: 5, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: '#CEC7E8', textAlign: 'center' },
  workingSubtitle: { height: 42 },
  actions: { paddingTop: 8, gap: 6 },
  report: { minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  reportText: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#CEC7E8' },
  messageStage: { height: 170 },
  messageHalo: {
    width: 152,
    height: 152,
    borderRadius: 76,
    right: undefined,
    top: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(167, 139, 250, 0.42)',
    backgroundColor: 'rgba(124, 60, 255, 0.18)',
  },
  messageMascotWrap: { position: 'relative', right: 0, bottom: 0 },
  messageCard: { padding: 20 },
  messageTitle: { color: colors.ink, textAlign: 'left', marginTop: 10, fontSize: 25, lineHeight: 29 },
  messageCopy: { color: colors.inkSoft, textAlign: 'left', paddingHorizontal: 0 },
});
