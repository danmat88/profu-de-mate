import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { beginAppTransition } from '../../../shared/context/TransitionMotionContext';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import {
  cosinePingPongRange,
  createNativeLoop,
  SILKY_EASE_OUT,
  WAVE_INPUT_17,
} from '../../../shared/motion/nativeMotion';
import { recordDiagnosticError } from '../../../shared/services/diagnostics';
import { assertSessionActive, captureSession, type ActiveSession } from '../../../shared/services/sessionGuard';
import { borders, colors, fonts } from '../../../shared/theme';
import type { CapturedImage, CommercialAccess, MathAnalysis, RootStackParamList } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { Chip } from '../../../shared/ui/Chip';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { ComicCard } from '../../../shared/ui/ComicCard';
import { Enter } from '../../../shared/ui/Enter';
import { IconButton } from '../../../shared/ui/IconButton';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { Text } from '../../../shared/ui/Typography';
import { QuotaResetTimer } from '../../access/components/QuotaResetTimer';
import { useCommercial } from '../../access/context/CommercialContext';
import { commercialGateFromError } from '../../access/services/commercial';
import { deleteTemporaryCapturedImages } from '../../capture/services/temporaryImages';
import { recordDailyStudyActivity } from '../../practice/services/practiceStorage';
import { FeedbackSheet } from '../../feedback/components/FeedbackSheet';
import { beginLessonPresentation, waitForLessonPresentation } from '../../lessons/services/lessonPresentation';
import { contentToAccessibleText } from '../../math/utils/mathContent';
import { AnalysisActivity } from '../components/AnalysisActivity';
import { analyzeOrResumeMathImage, friendlyAnalysisError } from '../services/mathAnalysis';
import { clearPendingAnalysis, savePendingAnalysis } from '../services/pendingAnalysis';

type Props = NativeStackScreenProps<RootStackParamList, 'Processing'>;
type ScreenState =
  | { kind: 'analyzing' }
  | { kind: 'rejected'; result: MathAnalysis }
  | { kind: 'commercial'; message: string; reason: string; access: CommercialAccess | null }
  | { kind: 'error'; message: string };

type Rect = { x: number; y: number; width: number; height: number };

function containedImageRect(frameWidth: number, frameHeight: number, image: CapturedImage): Rect {
  const inset = 10;
  const availableWidth = Math.max(1, frameWidth - inset * 2);
  const availableHeight = Math.max(1, frameHeight - inset * 2);
  if (image.width <= 0 || image.height <= 0) {
    return { x: inset, y: inset, width: availableWidth, height: availableHeight };
  }
  const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    x: inset + (availableWidth - width) / 2,
    y: inset + (availableHeight - height) / 2,
    width,
    height,
  };
}

export function ProcessingScreen({ navigation, route }: Props) {
  const frame = useSafeAreaFrame();
  const { height, gutter, contentWidth, isNarrow, isVeryShort } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const focused = useIsFocused();
  const { access: commercialAccess } = useCommercial();
  const [preparingLesson, setPreparingLesson] = useState(false);
  const [requestKey, setRequestKey] = useState(0);
  const [takingLong, setTakingLong] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [screenState, setScreenState] = useState<ScreenState>({ kind: 'analyzing' });
  const [sceneReady, setSceneReady] = useState(reducedMotion);
  const orbit = useRef(new Animated.Value(0)).current;
  const haloSpin = useRef(new Animated.Value(0)).current;
  const scanVisibility = useRef(new Animated.Value(1)).current;
  const resumeAfterPaywall = useRef(false);
  const isCheck = route.params.mode === 'check';
  const stageHeight = Math.max(isVeryShort ? 182 : 218, Math.min(286, height * (isVeryShort ? 0.29 : 0.34)));
  const analysisFrameHeight = Math.max(isVeryShort ? 170 : 206, Math.min(266, stageHeight - 12));
  const analysisFrameWidth = Math.min(440, Math.max(220, contentWidth - 4));
  const analysisImageRect = containedImageRect(analysisFrameWidth, analysisFrameHeight, route.params.image);
  const analysisImageStyle = {
    left: analysisImageRect.x,
    top: analysisImageRect.y,
    width: analysisImageRect.width,
    height: analysisImageRect.height,
  };
  const scanStart = analysisImageRect.y + 8;
  const scanEnd = analysisImageRect.y + Math.max(8, analysisImageRect.height - 8);
  const scanStyle = useMemo(
    () => ({
      opacity: Animated.multiply(
        scanVisibility,
        orbit.interpolate({ inputRange: [0, 0.06, 0.9, 1], outputRange: [0, 0.92, 0.92, 0] }),
      ),
      transform: [
        {
          translateY: orbit.interpolate({
            inputRange: WAVE_INPUT_17,
            outputRange: cosinePingPongRange(scanStart, scanEnd),
          }),
        },
      ],
    }),
    [orbit, scanEnd, scanStart, scanVisibility],
  );
  const tutorHaloSpinStyle = useMemo(
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
  const bottomSpace = Math.max(insets.bottom, 12);
  const canReturnToPhoto = route.params.origin === 'review' && navigation.canGoBack();
  const returnToPhotoOrHome = () => {
    clearPendingAnalysis();
    beginAppTransition();
    if (canReturnToPhoto) navigation.goBack();
    else {
      deleteTemporaryCapturedImages([route.params.image.uri]);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    }
  };
  const retakePhoto = () => {
    clearPendingAnalysis();
    deleteTemporaryCapturedImages([route.params.image.uri]);
    beginAppTransition();
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Home' },
        { name: 'Capture', params: { mode: route.params.mode } },
      ],
    });
  };
  const continueInBackground = () => {
    beginAppTransition();
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const hardwareBackRef = useRef(() => {
    if (screenState.kind === 'analyzing') continueInBackground();
    else returnToPhotoOrHome();
  });
  hardwareBackRef.current = () => {
    if (screenState.kind === 'analyzing') continueInBackground();
    else returnToPhotoOrHome();
  };

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (feedbackVisible) return false;
      hardwareBackRef.current();
      return true;
    });
    return () => subscription.remove();
  }, [feedbackVisible]));

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
        raf2 = requestAnimationFrame(() => {
          setSceneReady(true);
        });
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

  useEffect(() => {
    if (!focused || !sceneReady || screenState.kind !== 'analyzing') {
      orbit.stopAnimation();
      haloSpin.stopAnimation();
      return undefined;
    }
    if (reducedMotion) {
      orbit.setValue(0.25);
      haloSpin.setValue(0);
      return undefined;
    }
    const orbiting = createNativeLoop(orbit, 3_900);
    const haloLoop = createNativeLoop(haloSpin, 26_000);
    orbiting.start();
    haloLoop.start();
    return () => {
      orbiting.stop();
      haloLoop.stop();
      orbit.stopAnimation();
      haloSpin.stopAnimation();
    };
  }, [focused, haloSpin, orbit, reducedMotion, sceneReady, screenState.kind]);

  useFocusEffect(useCallback(() => {
    if (resumeAfterPaywall.current && commercialAccess?.canAnalyze) {
      resumeAfterPaywall.current = false;
      setRequestKey((value) => value + 1);
    }
    return () => undefined;
  }, [commercialAccess?.canAnalyze]));

  useEffect(() => {
    let mounted = true;
    let session: ActiveSession;
    try {
      session = captureSession(route.params.userId);
    } catch {
      clearPendingAnalysis(route.params.requestId);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      return undefined;
    }
    const isActive = () => {
      if (!mounted) return false;
      try { assertSessionActive(session); return true; } catch { return false; }
    };
    savePendingAnalysis(route.params.mode, route.params.image, route.params.requestId, route.params.userId);
    setScreenState({ kind: 'analyzing' });
    setTakingLong(false);
    setPreparingLesson(false);
    scanVisibility.stopAnimation();
    scanVisibility.setValue(1);

    const slowStage = setTimeout(() => {
      if (mounted) setTakingLong(true);
    }, 20_000);

    analyzeOrResumeMathImage(
      route.params.mode,
      route.params.image,
      route.params.requestId,
      route.params.origin === 'home' || requestKey > 0,
      () => !isActive(),
      route.params.userId,
    )
      .then(async ({ lessonId, result }) => {
        if (!isActive()) return;
        let lessonParams: RootStackParamList['Lesson'] | undefined;
        let lessonPresentation: Promise<boolean> | undefined;
        if (result.status === 'ready' && lessonId) {
          setPreparingLesson(true);
          orbit.stopAnimation();
          Animated.timing(scanVisibility, {
            toValue: 0,
            duration: reducedMotion ? 0 : 220,
            easing: SILKY_EASE_OUT,
            useNativeDriver: true,
          }).start();
          lessonParams = {
            lesson: result,
            lessonId,
            source: 'flow',
            sourceImage: route.params.image,
          };
          beginLessonPresentation(lessonId);
          navigation.preload('Lesson', lessonParams);
          lessonPresentation = waitForLessonPresentation(lessonId);
        }
        const finish = async () => {
          if (!isActive()) return;
          if (result.status === 'ready' && lessonId && lessonParams && lessonPresentation) {
            const celebrationBeat = reducedMotion
              ? Promise.resolve()
              : new Promise<void>((resolve) => { setTimeout(resolve, 520); });
            await lessonPresentation;
            await celebrationBeat;
            if (!isActive()) return;
            clearPendingAnalysis(route.params.requestId);
            recordDailyStudyActivity();
            beginAppTransition();
            navigation.replace('Lesson', lessonParams);
          } else if (result.status !== 'ready') {
            clearPendingAnalysis(route.params.requestId);
            setScreenState({ kind: 'rejected', result });
          } else {
            clearPendingAnalysis(route.params.requestId);
            setScreenState({ kind: 'error', message: 'Nu am putut salva lecția. Încearcă din nou.' });
          }
        };
        await finish();
      })
      .catch((error) => {
        if (!isActive()) return;
        recordDiagnosticError('analysis_request', error);
        // Preserve the request id after transport failures so retry first
        // looks up the server result instead of charging for a second request.
        const commercial = commercialGateFromError(error);
        setScreenState(commercial
          ? { kind: 'commercial', message: commercial.message, reason: commercial.reason, access: commercial.access }
          : { kind: 'error', message: friendlyAnalysisError(error) });
      });

    return () => {
      mounted = false;
      clearTimeout(slowStage);
      scanVisibility.stopAnimation();
    };
  }, [navigation, orbit, reducedMotion, requestKey, route.params.image, route.params.mode, route.params.origin, route.params.requestId, route.params.userId, scanVisibility]);

  if (screenState.kind !== 'analyzing') {
    const rejected = screenState.kind === 'rejected';
    const commercialBlocked = screenState.kind === 'commercial';
    const title = rejected
      ? screenState.result.status === 'not_math' ? 'În fotografie nu apare matematică.' : 'Fotografia nu este suficient de clară.'
      : commercialBlocked ? 'Ai ajuns la capătul problemelor disponibile.' : 'Ceva nu a mers.';
    const message = rejected ? contentToAccessibleText(screenState.result.summary) : screenState.message;

    return (
      <View style={[styles.safe, { paddingHorizontal: gutter, paddingTop: insets.top ?? 0 }]}>
        <StatusBar style="light" />
        <ComicBackdrop dark />
        <Enter delay={0} distance={8} style={styles.top}>
          <Text style={styles.brand}>Profu’ de mate</Text>
          <IconButton
            label={canReturnToPhoto ? 'Înapoi la fotografie' : 'Înapoi acasă'}
            onPress={returnToPhotoOrHome}
            dark
            size={44}
          >
            <MiniGlyph name="close" size={20} color={colors.paper} />
          </IconButton>
        </Enter>

        <ScrollView
          style={styles.messageScroll}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.messageArea, isVeryShort && styles.messageAreaShort]}
        >
          <Enter delay={40} distance={14} style={styles.messageMascotWrap}>
            <View style={styles.messageHalo} />
            <Mascot pose={commercialBlocked ? 'point' : 'oops'} size={156} active />
            <View style={[styles.messageGlyph, commercialBlocked && styles.messageGlyphGold]}>
              {rejected ? <AppIcon name="camera" size={34} /> : <MiniGlyph name="spark" size={24} color={colors.ink} />}
            </View>
          </Enter>

          <Enter delay={90} distance={14}>
            <ComicCard
              tone="paper"
              depth={6}
              radius={25}
              borderWidth={borders.thick}
              shadowColor="#09061B"
              shine
              contentStyle={styles.messageCard}
            >
              <View accessibilityRole="alert" accessibilityLiveRegion="assertive">
                <Chip
                  label={rejected ? 'HAI SĂ MAI ÎNCERCĂM' : commercialBlocked ? 'ACCESUL TĂU' : 'A APĂRUT O PROBLEMĂ'}
                  tone={rejected ? 'peach' : commercialBlocked ? 'gold' : 'roseSoft'}
                  outlined
                />
                <Text style={[styles.messageTitle, isNarrow && styles.messageTitleNarrow]}>{title}</Text>
                <Text style={styles.messageText}>{message}</Text>
              </View>
            </ComicCard>
          </Enter>

          {commercialBlocked && (screenState.access?.resetAt ?? commercialAccess?.resetAt) ? (
            <Enter delay={115} distance={14}>
              <QuotaResetTimer
                resetAt={screenState.access?.resetAt ?? commercialAccess?.resetAt}
                remaining={screenState.access?.remaining ?? commercialAccess?.remaining ?? 0}
                limit={screenState.access?.limit ?? commercialAccess?.limit ?? 5}
                premium={Boolean(screenState.access?.premium.active ?? commercialAccess?.premium.active)}
                planName={(screenState.access?.premium.tier ?? commercialAccess?.premium.tier) === 'max' ? 'Max' : 'Pro'}
                variant="hero"
                active={focused}
                style={styles.commercialTimer}
              />
            </Enter>
          ) : null}
        </ScrollView>

        <Enter delay={130} distance={12} style={[styles.messageActions, { paddingBottom: bottomSpace }]}>
          {commercialBlocked ? (
            <ComicButton
              compact
              title="Vezi opțiunile"
              subtitle="Gratuit, Profu’ Pro sau Profu’ Max."
              icon="trophy"
              tone="lime"
              onPress={() => {
                resumeAfterPaywall.current = true;
                beginAppTransition();
                navigation.navigate('Paywall', { source: 'quota', ...(screenState.access ? { access: screenState.access } : {}) });
              }}
            />
          ) : null}
          {!rejected && !commercialBlocked ? (
            <ComicButton
              compact
              title="Încearcă din nou"
              icon="scan"
              tone="lime"
              onPress={() => setRequestKey((value) => value + 1)}
            />
          ) : null}
          {rejected ? (
            <Pressable accessibilityRole="button" onPress={() => setFeedbackVisible(true)} style={styles.backLink}>
              <Text style={styles.backLinkText}>Raportează răspunsul</Text>
            </Pressable>
          ) : null}
          {!commercialBlocked ? (
            <ComicButton
              compact
              title="Fotografiază din nou"
              icon="camera"
              tone={rejected ? 'lime' : 'violet'}
              onPress={retakePhoto}
            />
          ) : null}
          <Pressable accessibilityRole="button" onPress={returnToPhotoOrHome} style={styles.backLink}>
            <Text style={styles.backLinkText}>{canReturnToPhoto ? 'Înapoi la fotografia aleasă' : 'Înapoi acasă'}</Text>
          </Pressable>
        </Enter>
        <FeedbackSheet visible={feedbackVisible} requestId={route.params.requestId} onClose={() => setFeedbackVisible(false)} />
      </View>
    );
  }

  return (
    <View style={[styles.safe, { paddingHorizontal: gutter, paddingTop: insets.top ?? 0 }]}>
      <StatusBar style="light" />
      <ComicBackdrop dark />
      <View style={styles.sceneContent}>
        <View style={styles.top}>
          <View style={styles.brandRow}>
            <View style={[styles.brandDot, isCheck && styles.brandDotCheck]} />
            <Text style={styles.brand}>Profu’ lucrează</Text>
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Continuă analiza în fundal și revino acasă"
            pressedScale={0.95}
            haptic="selection"
            onPress={continueInBackground}
            contentStyle={styles.stopButton}
          >
            <MiniGlyph name="back" size={16} color={colors.paper} />
            <Text style={styles.stopText}>ACASĂ</Text>
          </PressableScale>
        </View>

        <View style={[styles.analysisBody, { paddingBottom: bottomSpace }]}>
          <View style={[styles.stage, { height: stageHeight }]}>
            <View pointerEvents="none" style={[styles.stageAura, isCheck && styles.stageAuraCheck]} />
            <View style={styles.analysisFrameShadow}>
              <View pointerEvents="none" style={[styles.analysisFrame, isCheck && styles.analysisFrameCheck, { width: analysisFrameWidth, height: analysisFrameHeight }]}>
                <Image
                  accessible={false}
                  source={{ uri: route.params.image.uri }}
                  resizeMode="contain"
                  fadeDuration={0}
                  style={[styles.analysisPhoto, analysisImageStyle]}
                />
                <View style={[styles.analysisVeil, analysisImageStyle]} />
                <Animated.View style={[styles.analysisScan, {
                  left: analysisImageRect.x + 12,
                  width: Math.max(24, analysisImageRect.width - 24),
                }, scanStyle]}>
                  <LinearGradient
                    colors={isCheck
                      ? ['rgba(255,184,107,0)', 'rgba(255,184,107,0.34)', 'rgba(255,184,107,0)']
                      : ['rgba(201,255,59,0)', 'rgba(201,255,59,0.32)', 'rgba(201,255,59,0)']}
                    style={styles.analysisScanHalo}
                  />
                  <View style={[styles.analysisScanCore, isCheck && styles.analysisScanCoreCheck]} />
                </Animated.View>
                <View style={[styles.corner, styles.cornerTL, { left: analysisImageRect.x, top: analysisImageRect.y }, isCheck && styles.cornerCheck]} />
                <View style={[styles.corner, styles.cornerTR, { right: analysisFrameWidth - analysisImageRect.x - analysisImageRect.width, top: analysisImageRect.y }, isCheck && styles.cornerCheck]} />
                <View style={[styles.corner, styles.cornerBL, { left: analysisImageRect.x, bottom: analysisFrameHeight - analysisImageRect.y - analysisImageRect.height }, isCheck && styles.cornerCheck]} />
                <View style={[styles.corner, styles.cornerBR, { right: analysisFrameWidth - analysisImageRect.x - analysisImageRect.width, bottom: analysisFrameHeight - analysisImageRect.y - analysisImageRect.height }, isCheck && styles.cornerCheck]} />
              </View>
            </View>
          </View>

          <View style={[styles.tutorBanner, isVeryShort && styles.tutorBannerShort]}>
            <View style={[styles.tutorMascotStage, isVeryShort && styles.tutorMascotStageShort]}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.tutorHalo,
                  isVeryShort && styles.tutorHaloShort,
                  isCheck && styles.tutorHaloCheck,
                  preparingLesson && styles.tutorHaloReady,
                  tutorHaloSpinStyle,
                ]}
              />
              <Mascot pose={preparingLesson ? 'cheer' : 'thinking'} size={isVeryShort ? 74 : 88} active={focused && sceneReady} />
            </View>
            <View style={styles.tutorCopy}>
              <View style={[styles.guideBubble, isCheck && styles.guideBubbleCheck, preparingLesson && styles.guideBubbleReady]}>
                <Text numberOfLines={1} style={styles.guideText}>
                  {preparingLesson ? 'Gata! O așez…' : isCheck ? 'Verific atent…' : 'Citesc atent…'}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.76}
                style={[styles.title, isNarrow && styles.titleNarrow]}
              >
                {preparingLesson ? 'Lecția ta e gata!' : isCheck ? 'Verific fiecare pas.' : 'Pregătesc rezolvarea.'}
              </Text>
              <Text accessibilityLiveRegion="polite" numberOfLines={2} style={styles.subtitle}>
                {preparingLesson
                  ? 'Așez pașii și formulele frumos în pagină.'
                  : takingLong
                    ? 'Încă lucrez. Problemele mai lungi pot avea nevoie de puțin timp.'
                    : 'Poate dura puțin, în funcție de problemă și de conexiune.'}
              </Text>
            </View>
          </View>

          <AnalysisActivity preparing={preparingLesson} check={isCheck} active={focused && sceneReady} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink, overflow: 'hidden' },
  sceneContent: { flex: 1 },
  analysisBody: { flex: 1, justifyContent: 'space-between', paddingTop: 2 },
  top: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.lime },
  brandDotCheck: { backgroundColor: colors.peach },
  brand: { fontFamily: fonts.displaySemi, color: colors.paper, fontSize: 19 },
  stopButton: {
    minWidth: 94,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.3,
    borderBottomWidth: 3.2,
    borderColor: 'rgba(196, 176, 255, 0.34)',
    borderBottomColor: 'rgba(7, 4, 24, 0.78)',
    backgroundColor: 'rgba(38, 28, 84, 0.92)',
    borderRadius: 999,
    paddingHorizontal: 14,
  },
  stopText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 12, letterSpacing: 0.8 },
  stage: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  stageAura: {
    position: 'absolute',
    width: 260,
    height: 180,
    borderRadius: 120,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  stageAuraCheck: {
    backgroundColor: 'rgba(255, 168, 140, 0.16)',
  },
  analysisFrameShadow: {
    borderRadius: 26,
    elevation: 8,
    shadowColor: '#070512',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
  },
  analysisFrame: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 26,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: 'rgba(190, 168, 255, 0.36)',
    borderBottomColor: 'rgba(7, 4, 24, 0.86)',
    backgroundColor: '#0C0820',
    overflow: 'hidden',
  },
  analysisFrameCheck: { borderColor: 'rgba(255,184,107,0.44)' },
  analysisPhoto: { position: 'absolute', borderRadius: 18 },
  analysisVeil: { position: 'absolute', borderRadius: 18, backgroundColor: 'rgba(12,9,28,0.1)' },
  analysisScan: { position: 'absolute', top: -9, height: 21, justifyContent: 'center' },
  analysisScanHalo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 10 },
  analysisScanCore: { width: '100%', height: 3, borderRadius: 2, backgroundColor: colors.lime },
  analysisScanCoreCheck: { backgroundColor: colors.peach },
  corner: { position: 'absolute', width: 32, height: 32, borderColor: colors.lime },
  cornerCheck: { borderColor: colors.peach },
  cornerTL: { left: 13, top: 13, borderLeftWidth: 5, borderTopWidth: 5, borderTopLeftRadius: 9 },
  cornerTR: { right: 13, top: 13, borderRightWidth: 5, borderTopWidth: 5, borderTopRightRadius: 9 },
  cornerBL: { left: 13, bottom: 13, borderLeftWidth: 5, borderBottomWidth: 5, borderBottomLeftRadius: 9 },
  cornerBR: { right: 13, bottom: 13, borderRightWidth: 5, borderBottomWidth: 5, borderBottomRightRadius: 9 },
  tutorBanner: {
    height: 108,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  tutorBannerShort: {
    height: 94,
  },
  tutorMascotStage: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tutorMascotStageShort: {
    width: 78,
    height: 78,
  },
  tutorHalo: {
    position: 'absolute',
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(124, 60, 255, 0.16)',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(167, 139, 250, 0.45)',
  },
  tutorHaloShort: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  tutorHaloCheck: { borderColor: 'rgba(255,184,107,0.55)', backgroundColor: 'rgba(255, 184, 107, 0.12)' },
  tutorHaloReady: { borderColor: colors.lime, backgroundColor: 'rgba(216, 255, 62, 0.14)' },
  tutorCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start', justifyContent: 'center' },
  guideBubble: {
    height: 24,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.lime,
    paddingHorizontal: 11,
    marginBottom: 5,
  },
  guideBubbleCheck: { backgroundColor: colors.peach },
  guideBubbleReady: { backgroundColor: colors.lime },
  guideText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11, lineHeight: 14 },
  title: { fontFamily: fonts.display, color: colors.paper, fontSize: 22, lineHeight: 28, height: 28 },
  titleNarrow: { fontSize: 20, lineHeight: 25, height: 25 },
  subtitle: { fontFamily: fonts.body, color: '#CCC4E6', fontSize: 12.5, lineHeight: 17.5, height: 36, marginTop: 3 },
  messageScroll: { flex: 1 },
  messageArea: { flexGrow: 1, justifyContent: 'center', paddingBottom: 12, gap: 6 },
  messageAreaShort: { paddingTop: 6 },
  messageMascotWrap: { height: 184, alignItems: 'center', justifyContent: 'center' },
  messageHalo: {
    position: 'absolute',
    width: 158,
    height: 158,
    borderRadius: 79,
    backgroundColor: 'rgba(124, 60, 255, 0.18)',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(167, 139, 250, 0.42)',
  },
  messageGlyph: {
    position: 'absolute',
    right: '21%',
    bottom: 10,
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  messageGlyphGold: { backgroundColor: colors.gold },
  messageCard: { minHeight: 168, padding: 20 },
  messageTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 25, lineHeight: 29, marginTop: 10 },
  messageTitleNarrow: { fontSize: 22, lineHeight: 26 },
  messageText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 14, lineHeight: 21, marginTop: 8 },
  commercialTimer: { marginTop: 6 },
  messageActions: { gap: 8, paddingTop: 6 },
  backLink: { minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  backLinkText: { fontFamily: fonts.bodyBold, color: '#CEC7E8', fontSize: 13 },
});
