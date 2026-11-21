import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { recordDiagnosticError } from '../../../shared/services/diagnostics';
import { assertSessionActive, captureSession, type ActiveSession } from '../../../shared/services/sessionGuard';
import { borders, colors, fonts, shadows } from '../../../shared/theme';
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
import { useCommercial } from '../../access/context/CommercialContext';
import { commercialGateFromError } from '../../access/services/commercial';
import { deleteTemporaryCapturedImages } from '../../capture/services/temporaryImages';
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
  const { height, gutter, contentWidth, isNarrow, isVeryShort } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { access: commercialAccess } = useCommercial();
  const [preparingLesson, setPreparingLesson] = useState(false);
  const [requestKey, setRequestKey] = useState(0);
  const [takingLong, setTakingLong] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [screenState, setScreenState] = useState<ScreenState>({ kind: 'analyzing' });
  const [sceneReady, setSceneReady] = useState(reducedMotion);
  const orbit = useRef(new Animated.Value(0)).current;
  const scanVisibility = useRef(new Animated.Value(1)).current;
  const resumeAfterPaywall = useRef(false);
  const isCheck = route.params.mode === 'check';
  const stageHeight = Math.max(isVeryShort ? 190 : 244, Math.min(330, height * (isVeryShort ? 0.33 : 0.39)));
  const analysisFrameHeight = Math.max(isVeryShort ? 168 : 204, Math.min(242, stageHeight - 44));
  const analysisFrameWidth = Math.min(440, Math.max(220, contentWidth - 8));
  const analysisImageRect = containedImageRect(analysisFrameWidth, analysisFrameHeight, route.params.image);
  const analysisImageStyle = {
    left: analysisImageRect.x,
    top: analysisImageRect.y,
    width: analysisImageRect.width,
    height: analysisImageRect.height,
  };
  const scanStart = analysisImageRect.y + 8;
  const scanEnd = analysisImageRect.y + Math.max(8, analysisImageRect.height - 8);
  const scanOpacity = Animated.multiply(
    scanVisibility,
    orbit.interpolate({ inputRange: [0, 0.06, 0.9, 1], outputRange: [0, 0.92, 0.92, 0] }),
  );
  const bottomSpace = Math.max(insets.bottom, 12);
  const canReturnToPhoto = route.params.origin === 'review' && navigation.canGoBack();
  const returnToPhotoOrHome = () => {
    clearPendingAnalysis();
    if (canReturnToPhoto) navigation.goBack();
    else {
      deleteTemporaryCapturedImages([route.params.image.uri]);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    }
  };
  const retakePhoto = () => {
    clearPendingAnalysis();
    deleteTemporaryCapturedImages([route.params.image.uri]);
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Home' },
        { name: 'Capture', params: { mode: route.params.mode } },
      ],
    });
  };
  const continueInBackground = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  useEffect(() => {
    if (reducedMotion) {
      setSceneReady(true);
      return undefined;
    }
    setSceneReady(false);
    let settled = false;
    const markReady = () => {
      if (settled) return;
      settled = true;
      setSceneReady(true);
    };
    const unsubscribe = navigation.addListener('transitionEnd', (event) => {
      if (!event.data.closing) markReady();
    });
    const fallback = setTimeout(markReady, 550);
    return () => {
      settled = true;
      clearTimeout(fallback);
      unsubscribe();
    };
  }, [navigation, reducedMotion]);

  useEffect(() => {
    if (!sceneReady || screenState.kind !== 'analyzing') return undefined;
    if (reducedMotion) {
      orbit.setValue(0.48);
      return undefined;
    }
    orbit.setValue(0);
    const orbiting = Animated.loop(Animated.sequence([
      Animated.timing(orbit, { toValue: 1, duration: 1_650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(orbit, { toValue: 0, duration: 1_650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    orbiting.start();
    return () => { orbiting.stop(); };
  }, [orbit, reducedMotion, sceneReady, screenState.kind]);

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
            duration: reducedMotion ? 0 : 150,
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
            await lessonPresentation;
            if (!isActive()) return;
            clearPendingAnalysis(route.params.requestId);
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
      <SafeAreaView style={[styles.safe, { paddingHorizontal: gutter }]} edges={['top']}>
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
        </ScrollView>

        <Enter delay={130} distance={12} style={[styles.messageActions, { paddingBottom: bottomSpace }]}>
          {commercialBlocked ? (
            <ComicButton
              compact
              title="Vezi opțiunile"
              subtitle="Probleme gratuite sau Premium."
              icon="trophy"
              tone="lime"
              onPress={() => {
                resumeAfterPaywall.current = true;
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { paddingHorizontal: gutter }]} edges={['top']}>
      <StatusBar style="light" />
      <ComicBackdrop dark />
      <View style={styles.sceneContent}>
        <View style={styles.top}>
          <Text style={styles.brand}>Profu’ lucrează</Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Continuă analiza în fundal și revino acasă"
            depth={shadows.sm}
            radius={15}
            shadowColor="#09061B"
            haptic="selection"
            onPress={continueInBackground}
            contentStyle={styles.stopButton}
          >
            <MiniGlyph name="back" size={16} color={colors.paper} />
            <Text style={styles.stopText}>ACASĂ</Text>
          </PressableScale>
        </View>

        <ScrollView style={styles.analysisScroll} contentContainerStyle={styles.analysisContent} bounces={false} showsVerticalScrollIndicator={false}>
          <View style={[styles.stage, { height: stageHeight }]}>
            <View pointerEvents="none" style={[styles.analysisFrame, isCheck && styles.analysisFrameCheck, { width: analysisFrameWidth, height: analysisFrameHeight }]}>
              <Image accessible={false} source={{ uri: route.params.image.uri }} resizeMode="contain" style={[styles.analysisPhoto, analysisImageStyle]} />
              <View style={[styles.analysisVeil, analysisImageStyle]} />
              <Animated.View style={[styles.analysisScan, {
                left: analysisImageRect.x + 12,
                width: Math.max(24, analysisImageRect.width - 24),
                opacity: scanOpacity,
                transform: [{ translateY: orbit.interpolate({ inputRange: [0, 1], outputRange: [scanStart, scanEnd] }) }],
              }]}>
                <View style={[styles.analysisScanCore, isCheck && styles.analysisScanCoreCheck]} />
              </Animated.View>
              <View style={[styles.corner, styles.cornerTL, { left: analysisImageRect.x, top: analysisImageRect.y }, isCheck && styles.cornerCheck]} />
              <View style={[styles.corner, styles.cornerTR, { right: analysisFrameWidth - analysisImageRect.x - analysisImageRect.width, top: analysisImageRect.y }, isCheck && styles.cornerCheck]} />
              <View style={[styles.corner, styles.cornerBL, { left: analysisImageRect.x, bottom: analysisFrameHeight - analysisImageRect.y - analysisImageRect.height }, isCheck && styles.cornerCheck]} />
              <View style={[styles.corner, styles.cornerBR, { right: analysisFrameWidth - analysisImageRect.x - analysisImageRect.width, bottom: analysisFrameHeight - analysisImageRect.y - analysisImageRect.height }, isCheck && styles.cornerCheck]} />
            </View>

            <View pointerEvents="none" style={styles.guide}>
              <View style={[styles.guideBubble, isCheck && styles.guideBubbleCheck]}>
                <Text style={styles.guideText}>
                  {preparingLesson ? 'Gata! O așez…' : isCheck ? 'Verific atent…' : 'Citesc atent…'}
                </Text>
              </View>
              <Mascot pose={preparingLesson ? 'cheer' : 'thinking'} size={isVeryShort ? 82 : 96} active={sceneReady} />
            </View>
          </View>

          <View style={[styles.statusArea, isVeryShort && styles.statusAreaShort, { paddingBottom: bottomSpace }]}>
            <View>
              <Text style={[styles.title, isNarrow && styles.titleNarrow]}>
                {preparingLesson ? 'Lecția ta e gata!' : isCheck ? 'Verific fiecare pas.' : 'Pregătesc rezolvarea.'}
              </Text>
              <Text accessibilityLiveRegion="polite" style={styles.subtitle}>
                {takingLong
                  ? 'Încă lucrez. Problemele mai lungi pot avea nevoie de puțin timp.'
                  : 'Poate dura puțin, în funcție de problemă și de conexiune.'}
              </Text>
            </View>
            <AnalysisActivity preparing={preparingLesson} check={isCheck} />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink, overflow: 'hidden' },
  sceneContent: { flex: 1 },
  analysisScroll: { flex: 1 },
  analysisContent: { flexGrow: 1 },
  top: { height: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: fonts.displaySemi, color: colors.paper, fontSize: 19 },
  stopButton: {
    minWidth: 92,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: borders.thin,
    borderColor: '#6D5EB0',
    backgroundColor: '#2B2259',
    borderRadius: 15,
    paddingHorizontal: 12,
  },
  stopText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 12, letterSpacing: 0.8 },
  stage: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, position: 'relative' },
  analysisFrame: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: '#070514',
    overflow: 'hidden',
    shadowColor: '#070512',
    shadowOpacity: 0.7,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
  analysisFrameCheck: { borderColor: 'rgba(255,168,140,0.56)' },
  analysisPhoto: { position: 'absolute', borderRadius: 18 },
  analysisVeil: { position: 'absolute', borderRadius: 18, backgroundColor: 'rgba(12,9,28,0.12)' },
  analysisScan: { position: 'absolute', top: 0, height: 3 },
  analysisScanCore: { width: '100%', height: 3, borderRadius: 2, backgroundColor: colors.lime },
  analysisScanCoreCheck: { backgroundColor: colors.peach },
  corner: { position: 'absolute', width: 32, height: 32, borderColor: colors.lime },
  cornerCheck: { borderColor: colors.peach },
  cornerTL: { left: 13, top: 13, borderLeftWidth: 5, borderTopWidth: 5, borderTopLeftRadius: 9 },
  cornerTR: { right: 13, top: 13, borderRightWidth: 5, borderTopWidth: 5, borderTopRightRadius: 9 },
  cornerBL: { left: 13, bottom: 13, borderLeftWidth: 5, borderBottomWidth: 5, borderBottomLeftRadius: 9 },
  cornerBR: { right: 13, bottom: 13, borderRightWidth: 5, borderBottomWidth: 5, borderBottomRightRadius: 9 },
  guide: { position: 'absolute', zIndex: 5, right: -4, bottom: 0, alignItems: 'flex-end', justifyContent: 'flex-end' },
  guideBubble: {
    marginRight: 44,
    marginBottom: -14,
    zIndex: 2,
    borderRadius: 14,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    paddingHorizontal: 11,
    paddingVertical: 5,
    transform: [{ rotate: '-3deg' }],
  },
  guideBubbleCheck: { backgroundColor: colors.peach },
  guideText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11.5, lineHeight: 14, textAlign: 'center' },
  statusArea: { flex: 1, minHeight: 0, justifyContent: 'space-evenly', gap: 12 },
  statusAreaShort: { justifyContent: 'space-between', paddingTop: 6 },
  title: { fontFamily: fonts.display, color: colors.paper, fontSize: 29, lineHeight: 33, textAlign: 'center' },
  titleNarrow: { fontSize: 25, lineHeight: 29 },
  subtitle: { paddingHorizontal: 8, fontFamily: fonts.body, color: '#CCC4E6', fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginTop: 5 },
  messageScroll: { flex: 1 },
  messageArea: { flexGrow: 1, justifyContent: 'center', paddingBottom: 12, gap: 6 },
  messageAreaShort: { paddingTop: 6 },
  messageMascotWrap: { height: 184, alignItems: 'center', justifyContent: 'center' },
  messageHalo: {
    position: 'absolute',
    width: 158,
    height: 158,
    borderRadius: 79,
    backgroundColor: '#2E2266',
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: '#7566BD',
  },
  messageGlyph: {
    position: 'absolute',
    right: '21%',
    bottom: 10,
    width: 46,
    height: 46,
    borderRadius: 15,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '6deg' }],
  },
  messageGlyphGold: { backgroundColor: colors.gold },
  messageCard: { minHeight: 168, padding: 20 },
  messageTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 25, lineHeight: 29, marginTop: 10 },
  messageTitleNarrow: { fontSize: 22, lineHeight: 26 },
  messageText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 14, lineHeight: 21, marginTop: 8 },
  messageActions: { gap: 8, paddingTop: 6 },
  backLink: { minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  backLinkText: { fontFamily: fonts.bodyBold, color: '#CEC7E8', fontSize: 13 },
});
