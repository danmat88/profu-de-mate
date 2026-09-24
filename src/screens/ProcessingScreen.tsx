import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/Typography';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { ComicButton } from '../components/ComicButton';
import { AppIcon } from '../components/AppIcon';
import { MiniGlyph } from '../components/MiniGlyph';
import { FeedbackSheet } from '../components/FeedbackSheet';
import { AnalysisActivity } from '../components/AnalysisActivity';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useCommercial } from '../context/CommercialContext';
import { commercialGateFromError } from '../services/commercial';
import { analyzeOrResumeMathImage, friendlyAnalysisError } from '../services/mathAnalysis';
import { recordDiagnosticError } from '../services/diagnostics';
import { clearPendingAnalysis, savePendingAnalysis } from '../services/pendingAnalysis';
import { assertSessionActive, captureSession, type ActiveSession } from '../services/sessionGuard';
import { beginLessonPresentation, waitForLessonPresentation } from '../services/lessonPresentation';
import { deleteTemporaryCapturedImages } from '../services/temporaryImages';
import { colors, fonts } from '../theme';
import type { CapturedImage, CommercialAccess, MathAnalysis, RootStackParamList } from '../types';
import { contentToAccessibleText } from '../utils/mathContent';

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
  const headerEntrance = useRef(new Animated.Value(1)).current;
  const stageEntrance = useRef(new Animated.Value(1)).current;
  const copyEntrance = useRef(new Animated.Value(1)).current;
  const messageHeaderEntrance = useRef(new Animated.Value(0)).current;
  const messageVisualEntrance = useRef(new Animated.Value(0)).current;
  const messageCardEntrance = useRef(new Animated.Value(0)).current;
  const messageActionsEntrance = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const scanVisibility = useRef(new Animated.Value(1)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const resumeAfterPaywall = useRef(false);
  const isCheck = route.params.mode === 'check';
  const stageHeight = Math.max(isVeryShort ? 184 : 240, Math.min(330, height * (isVeryShort ? 0.32 : 0.39)));
  const analysisFrameHeight = Math.max(isVeryShort ? 166 : 198, Math.min(236, stageHeight - 54));
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
      bob.setValue(0.5);
      return undefined;
    }
    orbit.setValue(0);
    const orbiting = Animated.loop(Animated.sequence([
      Animated.timing(orbit, { toValue: 1, duration: 1_650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(orbit, { toValue: 0, duration: 1_650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    const floating = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    orbiting.start();
    floating.start();
    return () => { orbiting.stop(); floating.stop(); };
  }, [bob, orbit, reducedMotion, sceneReady, screenState.kind]);

  useEffect(() => {
    if (screenState.kind === 'analyzing') {
      messageHeaderEntrance.setValue(0);
      messageVisualEntrance.setValue(0);
      messageCardEntrance.setValue(0);
      messageActionsEntrance.setValue(0);
      return undefined;
    }
    if (reducedMotion) {
      messageHeaderEntrance.setValue(1);
      messageVisualEntrance.setValue(1);
      messageCardEntrance.setValue(1);
      messageActionsEntrance.setValue(1);
      return undefined;
    }
    const easing = Easing.out(Easing.cubic);
    const entrance = Animated.parallel([
      Animated.timing(messageHeaderEntrance, { toValue: 1, duration: 180, easing, useNativeDriver: true }),
      Animated.timing(messageVisualEntrance, { toValue: 1, duration: 180, easing, useNativeDriver: true }),
      Animated.timing(messageCardEntrance, { toValue: 1, duration: 180, easing, useNativeDriver: true }),
      Animated.timing(messageActionsEntrance, { toValue: 1, duration: 180, easing, useNativeDriver: true }),
    ]);
    entrance.start();
    return () => entrance.stop();
  }, [messageActionsEntrance, messageCardEntrance, messageHeaderEntrance, messageVisualEntrance, reducedMotion, screenState.kind]);

  useFocusEffect(useCallback(() => {
    if (resumeAfterPaywall.current && commercialAccess?.canAnalyze) {
      resumeAfterPaywall.current = false;
      setRequestKey((value) => value + 1);
    }
    return () => undefined;
  }, [commercialAccess?.canAnalyze]));

  useEffect(() => {
    if (!sceneReady) return undefined;
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
  }, [navigation, orbit, reducedMotion, requestKey, route.params.image, route.params.mode, route.params.origin, route.params.requestId, route.params.userId, scanVisibility, sceneReady]);

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
        <Animated.View style={[styles.top, {
          opacity: messageHeaderEntrance,
          transform: [{ translateY: messageHeaderEntrance.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
        }]}>
          <Text style={styles.brand}>Profu’ de mate</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={canReturnToPhoto ? 'Înapoi la fotografie' : 'Înapoi acasă'} onPress={returnToPhotoOrHome} style={styles.closeButton}>
            <MiniGlyph name="close" size={20} color={colors.paper} />
          </Pressable>
        </Animated.View>
        <ScrollView
          style={styles.messageScroll}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.messageArea, isVeryShort && styles.messageAreaShort]}
        >
          <Animated.View style={[styles.messageMascotWrap, {
            opacity: messageVisualEntrance,
            transform: [
              { translateY: messageVisualEntrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
              { scale: messageVisualEntrance.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
            ],
          }]}>
            <View style={styles.messageHalo} />
            <Image accessible={false} source={require('../../assets/profu-mascot-v2.png')} resizeMode="contain" style={styles.messageMascot} />
            <View style={styles.messageGlyph}>{rejected ? <AppIcon name="camera" size={40} /> : <MiniGlyph name="spark" size={26} />}</View>
          </Animated.View>
          <Animated.View style={[styles.messageCardWrap, {
            opacity: messageCardEntrance,
            transform: [{ translateY: messageCardEntrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
          }]}>
            <View style={styles.messageCardShadow} />
            <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.messageCard}>
              <Text style={styles.messageEyebrow}>{rejected ? 'HAI SĂ MAI ÎNCERCĂM' : commercialBlocked ? 'ACCESUL TĂU' : 'A APĂRUT O PROBLEMĂ'}</Text>
              <Text style={[styles.messageTitle, isNarrow && styles.messageTitleNarrow]}>{title}</Text>
              <Text style={styles.messageText}>{message}</Text>
            </View>
          </Animated.View>
        </ScrollView>
        <Animated.View style={[styles.messageActions, {
          paddingBottom: bottomSpace,
          opacity: messageActionsEntrance,
          transform: [{ translateY: messageActionsEntrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        }]}>
          {commercialBlocked ? <ComicButton compact title="Vezi opțiunile" subtitle="Probleme gratuite sau Premium." icon="trophy" tone="lime" onPress={() => {
            resumeAfterPaywall.current = true;
            navigation.navigate('Paywall', { source: 'quota', ...(screenState.access ? { access: screenState.access } : {}) });
          }} /> : null}
          {!rejected && !commercialBlocked ? <ComicButton compact title="Încearcă din nou" icon="scan" tone="lime" onPress={() => setRequestKey((value) => value + 1)} /> : null}
          {rejected ? <Pressable accessibilityRole="button" onPress={() => setFeedbackVisible(true)} style={styles.backLink}>
            <Text style={styles.backLinkText}>Raportează răspunsul</Text>
          </Pressable> : null}
          {!commercialBlocked ? <ComicButton compact title="Fotografiază din nou" icon="camera" tone={rejected ? 'lime' : 'violet'} onPress={retakePhoto} /> : null}
          <Pressable accessibilityRole="button" onPress={returnToPhotoOrHome} style={styles.backLink}>
            <Text style={styles.backLinkText}>{canReturnToPhoto ? 'Înapoi la fotografia aleasă' : 'Înapoi acasă'}</Text>
          </Pressable>
        </Animated.View>
        <FeedbackSheet visible={feedbackVisible} requestId={route.params.requestId} onClose={() => setFeedbackVisible(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { paddingHorizontal: gutter }]} edges={['top']}>
      <StatusBar style="light" />
      <ComicBackdrop dark />
      <View style={styles.sceneContent}>
        <Animated.View style={[styles.top, {
          opacity: headerEntrance,
          transform: [{ translateY: headerEntrance.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
        }]}>
          <Text style={styles.brand}>Profu’ lucrează</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Continuă analiza în fundal și revino acasă" onPress={continueInBackground} style={styles.stopButton}>
            <MiniGlyph name="back" size={15} color={colors.paper} />
            <Text style={styles.stopText}>ACASĂ</Text>
          </Pressable>
        </Animated.View>
        <ScrollView style={styles.analysisScroll} contentContainerStyle={styles.analysisContent} bounces={false} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.stage, { height: stageHeight, opacity: stageEntrance, transform: [
          { translateY: stageEntrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
          { scale: stageEntrance.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
        ] }]}>
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
          <Animated.View pointerEvents="none" style={[styles.guide, { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [3, -5] }) }] }]}>
            <View style={[styles.guideBubble, isCheck && styles.guideBubbleCheck]}>
              <Text style={styles.guideText}>{isCheck ? 'Verific atent.' : 'Citesc atent.'}</Text>
            </View>
            <Image accessible={false} source={require('../../assets/profu-mascot-v2.png')} resizeMode="contain" style={styles.guideMascot} />
          </Animated.View>
        </Animated.View>
        <View style={[styles.statusArea, isVeryShort && styles.statusAreaShort, { paddingBottom: bottomSpace }]}>
          <Animated.View style={{
            opacity: copyEntrance,
            transform: [{ translateY: copyEntrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
          }}>
            <Text style={[styles.title, isNarrow && styles.titleNarrow]}>{isCheck ? 'Verific fiecare pas.' : 'Pregătesc rezolvarea.'}</Text>
            <Text accessibilityLiveRegion="polite" style={styles.subtitle}>
              {takingLong ? 'Încă lucrez. Problemele mai lungi pot avea nevoie de puțin timp.' : 'Poate dura puțin, în funcție de problemă și de conexiune.'}
            </Text>
          </Animated.View>
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
  brand: { fontFamily: fonts.displaySemi, color: colors.paper, fontSize: 18 },
  closeButton: { width: 48, height: 48, borderRadius: 15, borderWidth: 2, borderColor: '#6557A1', backgroundColor: '#2C2457', alignItems: 'center', justifyContent: 'center' },
  stopButton: { minWidth: 88, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: '#6557A1', backgroundColor: '#2C2457', borderRadius: 15, paddingHorizontal: 10 },
  stopText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 12, letterSpacing: 0.8 },
  stage: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  analysisFrame: { width: '100%', maxWidth: 440, borderRadius: 25, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: '#05040C', overflow: 'hidden', shadowColor: '#070512', shadowOpacity: 0.7, shadowRadius: 0, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
  analysisFrameCheck: { borderColor: 'rgba(255,178,139,0.52)' },
  analysisPhoto: { position: 'absolute', borderRadius: 18 },
  analysisVeil: { position: 'absolute', borderRadius: 18, backgroundColor: 'rgba(12,9,28,0.12)' },
  analysisScan: { position: 'absolute', top: 0, height: 2 },
  analysisScanCore: { width: '100%', height: 2, borderRadius: 2, backgroundColor: colors.lime },
  analysisScanCoreCheck: { backgroundColor: colors.peach },
  corner: { position: 'absolute', width: 32, height: 32, borderColor: colors.lime },
  cornerCheck: { borderColor: colors.peach },
  cornerTL: { left: 13, top: 13, borderLeftWidth: 5, borderTopWidth: 5, borderTopLeftRadius: 9 },
  cornerTR: { right: 13, top: 13, borderRightWidth: 5, borderTopWidth: 5, borderTopRightRadius: 9 },
  cornerBL: { left: 13, bottom: 13, borderLeftWidth: 5, borderBottomWidth: 5, borderBottomLeftRadius: 9 },
  cornerBR: { right: 13, bottom: 13, borderRightWidth: 5, borderBottomWidth: 5, borderBottomRightRadius: 9 },
  guide: { position: 'absolute', zIndex: 5, right: -2, bottom: 2, width: 104, height: 106, alignItems: 'flex-end', justifyContent: 'flex-end' },
  guideMascot: { width: 80, height: 84 },
  guideBubble: { position: 'absolute', right: 48, top: 0, minWidth: 92, borderRadius: 15, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.lime, paddingHorizontal: 9, paddingVertical: 6, transform: [{ rotate: '-2deg' }] },
  guideBubbleCheck: { backgroundColor: colors.peach },
  guideText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 10.5, lineHeight: 13, textAlign: 'center' },
  statusArea: { flex: 1, minHeight: 0, justifyContent: 'space-evenly' },
  statusAreaShort: { justifyContent: 'space-between', paddingTop: 4 },
  title: { fontFamily: fonts.display, color: colors.paper, fontSize: 31, lineHeight: 34, textAlign: 'center' },
  titleNarrow: { fontSize: 27, lineHeight: 30 },
  subtitle: { minHeight: 36, paddingHorizontal: 8, fontFamily: fonts.body, color: '#B9B0D2', fontSize: 13, lineHeight: 17, textAlign: 'center', marginTop: 3 },
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
