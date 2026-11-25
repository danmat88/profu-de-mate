import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from '../../../shared/services/haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { beginAppTransition } from '../../../shared/context/TransitionMotionContext';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { IconButton } from '../../../shared/ui/IconButton';
import { Mascot } from '../../../shared/ui/Mascot';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { Text } from '../../../shared/ui/Typography';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import {
  cosinePulseRange,
  createNativeLoop,
  SILKY_EASE_IN,
  SILKY_EASE_OUT,
  sineWaveRange,
  WAVE_INPUT_17,
} from '../../../shared/motion/nativeMotion';
import { recordDiagnosticError } from '../../../shared/services/diagnostics';
import { colors, fonts } from '../../../shared/theme';
import type { CaptureSource, RootStackParamList } from '../../../shared/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Capture'>;

const SHUTTER_AURA_OPACITY = cosinePulseRange(0.28, 0.58);
const SHUTTER_AURA_SCALE = cosinePulseRange(0.98, 1.14);
const SHUTTER_BUTTON_SCALE = cosinePulseRange(1, 1.03);

function CloseGlyph() {
  return (
    <Svg accessible={false} width={24} height={24} viewBox="0 0 24 24">
      <Path d="M6 6l12 12M18 6L6 18" stroke={colors.paper} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

export function CaptureScreen({ navigation, route }: Props) {
  const frame = useSafeAreaFrame();
  const responsiveLayout = useResponsiveLayout(frame);
  const liveInsets = useSafeAreaInsets();
  const [cameraViewport, setCameraViewport] = useState(() => ({
    layout: responsiveLayout,
    insets: liveInsets,
  }));
  const stableLayout = cameraViewport.layout;
  const stableInsets = cameraViewport.insets;
  const { gutter, isNarrow, isVeryShort, isShort, isCompact } = stableLayout;
  const reducedMotion = useReducedMotion();
  const [permission, requestPermission] = useCameraPermissions();
  const [transitionSettled, setTransitionSettled] = useState(reducedMotion);
  const [flash, setFlash] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [finderHeight, setFinderHeight] = useState(isShort ? 250 : 280);
  const [isFocused, setIsFocused] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [previewSettled, setPreviewSettled] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const [working, setWorking] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const scan = useRef(new Animated.Value(0)).current;
  const shutterPulse = useRef(new Animated.Value(0)).current;
  const helpPop = useRef(new Animated.Value(0)).current;
  const cameraPreviewEntrance = useRef(new Animated.Value(0)).current;
  const scanOpacity = useRef(new Animated.Value(0)).current;
  const cameraRef = useRef<CameraView | null>(null);
  const capturing = useRef(false);
  const galleryPickerLocked = useRef(false);
  const previewPaused = useRef(false);
  const isCheck = route.params.mode === 'check';
  const scanTravel = Math.max(52, (finderHeight - 56) / 2);
  const topSpace = Math.max(stableInsets.top, 0);
  const bottomSpace = Math.max(stableInsets.bottom, 10);

  useEffect(() => {
    const widthChanged = Math.abs(responsiveLayout.width - stableLayout.width) >= 1;
    const materialHeightChange = Math.abs(responsiveLayout.height - stableLayout.height) >= 96;
    const fontScaleChanged = Math.abs(responsiveLayout.fontScale - stableLayout.fontScale) >= 0.01;
    if (!widthChanged && !materialHeightChange && !fontScaleChanged) return;
    setCameraViewport({ layout: responsiveLayout, insets: liveInsets });
  }, [liveInsets, responsiveLayout, stableLayout.fontScale, stableLayout.height, stableLayout.width]);

  useFocusEffect(useCallback(() => {
    capturing.current = false;
    galleryPickerLocked.current = false;
    previewPaused.current = false;
    setWorking(false);
    setCaptureError(null);
    setCameraFailed(false);
    setPreviewSettled(false);
    setIsFocused(true);
    cameraPreviewEntrance.setValue(0);
    scanOpacity.setValue(0);
    scan.setValue(0);
    return () => {
      setIsFocused(false);
      setCameraReady(false);
      setPreviewSettled(false);
      cameraPreviewEntrance.stopAnimation();
      scanOpacity.stopAnimation();
      scan.stopAnimation();
      shutterPulse.stopAnimation();
      cameraPreviewEntrance.setValue(0);
      scanOpacity.setValue(0);
    };
  }, [cameraPreviewEntrance, scan, scanOpacity, shutterPulse]));

  useEffect(() => {
    let active = true;
    let raf1 = 0;
    let raf2 = 0;
    const settleAfterFrame = () => {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          if (active) setTransitionSettled(true);
        });
      });
    };
    const unsubscribe = navigation.addListener('transitionEnd', (event) => {
      if (!event.data.closing) settleAfterFrame();
    });
    return () => {
      active = false;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      unsubscribe();
    };
  }, [navigation]);

  useEffect(() => {
    if (transitionSettled || !isFocused) return undefined;
    const fallback = setTimeout(() => setTransitionSettled(true), 460);
    return () => clearTimeout(fallback);
  }, [isFocused, transitionSettled]);

  useEffect(() => {
    if (reducedMotion || !isFocused || !previewSettled) {
      shutterPulse.stopAnimation();
      shutterPulse.setValue(0);
      return;
    }
    const breathing = createNativeLoop(shutterPulse, 2_600);
    breathing.start();
    return () => {
      breathing.stop();
      shutterPulse.stopAnimation();
    };
  }, [isFocused, previewSettled, reducedMotion, shutterPulse]);

  useEffect(() => {
    if (!isFocused || !previewSettled) {
      scan.stopAnimation();
      scan.setValue(0);
      scanOpacity.setValue(0);
      return;
    }
    if (reducedMotion) {
      scan.setValue(0);
      scanOpacity.setValue(0.92);
      return;
    }
    const fadeIn = Animated.timing(scanOpacity, {
      toValue: 0.96,
      duration: 280,
      easing: SILKY_EASE_OUT,
      useNativeDriver: true,
    });
    const scanning = createNativeLoop(scan, 4_600);
    fadeIn.start();
    scanning.start();
    return () => {
      fadeIn.stop();
      scanning.stop();
      scan.stopAnimation();
    };
  }, [isFocused, previewSettled, reducedMotion, scan, scanOpacity]);

  const revealCamera = useCallback(() => {
    setCameraReady(true);
    setCameraFailed(false);
    setCaptureError(null);
    if (reducedMotion) {
      cameraPreviewEntrance.setValue(1);
      setPreviewSettled(true);
      return;
    }
    Animated.timing(cameraPreviewEntrance, {
      toValue: 1,
      duration: 320,
      easing: SILKY_EASE_OUT,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setPreviewSettled(true);
    });
  }, [cameraPreviewEntrance, reducedMotion]);

  const resumePreviewAfterFailure = useCallback(() => {
    if (!previewPaused.current) return;
    previewPaused.current = false;
    void cameraRef.current?.resumePreview().catch(() => undefined);
  }, []);

  const acceptImage = useCallback((raw: { uri: string; width: number; height: number }, source: CaptureSource) => {
    if (capturing.current) return;
    capturing.current = true;
    setWorking(true);
    setCaptureError(null);
    const image = { ...raw, source };
    Haptics.notification(Haptics.NotificationFeedbackType.Success);
    beginAppTransition();
    navigation.navigate('Review', { mode: route.params.mode, image });
  }, [navigation, route.params.mode]);

  const takePhoto = async () => {
    if (capturing.current || working) return;
    if (!permission?.granted) {
      await requestPermission();
      return;
    }
    if (cameraFailed) {
      cameraRef.current = null;
      setCameraReady(false);
      setCameraFailed(false);
      setCaptureError(null);
      setCameraSessionKey((value) => value + 1);
      return;
    }
    if (!cameraReady || !cameraRef.current) {
      setCaptureError('Camera încă pornește. Așteaptă o clipă și încearcă din nou.');
      return;
    }

    try {
      capturing.current = true;
      setWorking(true);
      setCaptureError(null);
      Haptics.impact(Haptics.ImpactFeedbackStyle.Medium);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: false, shutterSound: true });
      try {
        await cameraRef.current.pausePreview();
        previewPaused.current = true;
      } catch {
        previewPaused.current = false;
      }
      capturing.current = false;
      acceptImage(photo, 'camera');
    } catch {
      capturing.current = false;
      setWorking(false);
      resumePreviewAfterFailure();
      setCaptureError('Nu am putut face fotografia. Ține telefonul nemișcat și încearcă din nou.');
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    }
  };

  const pickFromGallery = useCallback(async () => {
    if (capturing.current || galleryPickerLocked.current || working) return;
    galleryPickerLocked.current = true;
    setWorking(true);
    setCaptureError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 1,
        exif: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri || asset.width <= 0 || asset.height <= 0) {
        setCaptureError('Fotografia aleasă nu poate fi citită. Alege altă imagine.');
        return;
      }
      acceptImage(asset, 'gallery');
    } catch {
      setCaptureError('Galeria nu a putut fi deschisă. Încearcă din nou.');
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    } finally {
      galleryPickerLocked.current = false;
      if (!capturing.current) setWorking(false);
    }
  }, [acceptImage, working]);

  const closeHelp = useCallback(() => {
    if (reducedMotion) { setShowHelp(false); return; }
    Animated.timing(helpPop, { toValue: 0, duration: 160, easing: SILKY_EASE_IN, useNativeDriver: true }).start(() => setShowHelp(false));
  }, [helpPop, reducedMotion]);

  useEffect(() => {
    if (!isFocused || !showHelp) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { closeHelp(); return true; });
    return () => subscription.remove();
  }, [closeHelp, isFocused, showHelp]);

  const toggleHelp = () => {
    Haptics.selection();
    if (showHelp) { closeHelp(); return; }
    setShowHelp(true);
    if (reducedMotion) {
      helpPop.setValue(1);
      return;
    }
    helpPop.setValue(0);
    Animated.timing(helpPop, { toValue: 1, duration: 240, easing: SILKY_EASE_OUT, useNativeDriver: true }).start();
  };

  const scanBeamStyle = useMemo(
    () => ({
      opacity: scanOpacity,
      transform: [
        {
          translateY: scan.interpolate({
            inputRange: WAVE_INPUT_17,
            outputRange: sineWaveRange(0, -scanTravel),
          }),
        },
      ],
    }),
    [scan, scanOpacity, scanTravel],
  );

  const shutterAuraStyle = useMemo(
    () => ({
      opacity: shutterPulse.interpolate({
        inputRange: WAVE_INPUT_17,
        outputRange: SHUTTER_AURA_OPACITY,
      }),
      transform: [
        {
          scale: shutterPulse.interpolate({
            inputRange: WAVE_INPUT_17,
            outputRange: SHUTTER_AURA_SCALE,
          }),
        },
      ],
    }),
    [shutterPulse],
  );

  const shutterScaleStyle = useMemo(
    () => ({
      transform: [
        {
          scale: shutterPulse.interpolate({
            inputRange: WAVE_INPUT_17,
            outputRange: SHUTTER_BUTTON_SCALE,
          }),
        },
      ],
    }),
    [shutterPulse],
  );

  const helpBubbleStyle = useMemo(
    () => ({
      opacity: helpPop,
      transform: [
        {
          translateY: helpPop.interpolate({
            inputRange: [0, 1],
            outputRange: [14, 0],
          }),
        },
      ],
    }),
    [helpPop],
  );

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      {permission?.granted && isFocused && transitionSettled ? (
        <Animated.View style={[styles.cameraLayer, { opacity: cameraPreviewEntrance }]}>
          <CameraView
            key={cameraSessionKey}
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            flash={flash ? 'on' : 'off'}
            mode="picture"
            animateShutter={false}
            onCameraReady={revealCamera}
            onMountError={(event) => {
              setCameraReady(false);
              setCameraFailed(true);
              setCaptureError('Camera nu a putut porni. Apasă declanșatorul ca să încerci din nou.');
              recordDiagnosticError('camera_mount', event);
            }}
          />
        </Animated.View>
      ) : null}

      <Animated.View pointerEvents="none" style={[styles.cameraAtmosphere, { opacity: cameraPreviewEntrance }]}>
        <View style={styles.cameraTint} />
        <LinearGradient colors={['rgba(12,9,31,0.9)', 'rgba(12,9,31,0.34)', 'rgba(12,9,31,0)']} style={[styles.topGradient, { height: topSpace + 140 }]} />
        <LinearGradient colors={['rgba(12,9,31,0)', 'rgba(12,9,31,0.68)', 'rgba(12,9,31,0.96)', '#120D2A']} style={[styles.bottomGradient, { height: bottomSpace + (isCompact ? 240 : 262) }]} />
      </Animated.View>

      <View style={[styles.topBar, { top: topSpace + 4, paddingHorizontal: gutter }]}>
        <IconButton
          label="Închide camera"
          disabled={working}
          dimWhenDisabled={false}
          onPress={() => {
            beginAppTransition();
            navigation.goBack();
          }}
          dark
          size={46}
        >
          <CloseGlyph />
        </IconButton>
        <View style={[styles.modeChipWrap, isNarrow && styles.modeChipNarrow]}>
          <View pointerEvents="none" style={styles.modeChipShadow} />
          <View style={[styles.modeChip, isCheck && styles.modeChipCheck]}>
            <View pointerEvents="none" style={styles.darkShine} />
            <View style={[styles.modeDot, isCheck && styles.modeDotCheck]} />
            <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.modeChipText}>{isCheck ? 'VERIFICĂ REZOLVAREA' : 'REZOLVĂ PROBLEMA'}</Text>
          </View>
        </View>
        <IconButton
          label={flash ? 'Oprește blițul' : 'Pornește blițul'}
          disabled={working}
          dimWhenDisabled={false}
          active={flash}
          dark={!flash}
          onPress={() => { Haptics.selection(); setFlash((value) => !value); }}
          size={46}
        >
          <AppIcon name="flash" size={30} />
        </IconButton>
      </View>

      {permission?.granted ? (
        <View
          pointerEvents="box-none"
          style={[styles.finderArea, {
            top: topSpace + (isVeryShort ? 74 : 88),
            bottom: bottomSpace + (isCompact ? 164 : 182),
            paddingHorizontal: gutter + 6,
          }]}
        >
          <View onLayout={(event) => setFinderHeight(event.nativeEvent.layout.height)} style={[styles.finder, isCheck && styles.finderCheck]}>
            <Animated.View
              pointerEvents="none"
              style={[styles.scanBeamWrap, scanBeamStyle]}
            >
              <LinearGradient
                colors={isCheck
                  ? ['rgba(255,184,107,0)', 'rgba(255,184,107,0.34)', 'rgba(255,184,107,0)']
                  : ['rgba(201,255,59,0)', 'rgba(201,255,59,0.32)', 'rgba(201,255,59,0)']}
                style={styles.scanAura}
              />
              <View style={[styles.scanLine, isCheck && styles.scanLineCheck]} />
            </Animated.View>

            <View style={[styles.corner, styles.cornerTL, isCheck && styles.cornerCheck]} />
            <View style={[styles.corner, styles.cornerTR, isCheck && styles.cornerCheck]} />
            <View style={[styles.corner, styles.cornerBL, isCheck && styles.cornerCheck]} />
            <View style={[styles.corner, styles.cornerBR, isCheck && styles.cornerCheck]} />
          </View>
        </View>
      ) : (
        <View style={[styles.permissionPanel, { paddingTop: topSpace + 80, paddingBottom: bottomSpace + 24, paddingHorizontal: gutter + 18 }]}>
          {permission === null ? (
            <PlayfulLoader inverse label="Deschid camera" />
          ) : (
            <>
              <View style={styles.permissionMascot}>
                <View style={styles.permissionHalo} />
                <Mascot pose="point" size={126} active />
              </View>
              <Text style={styles.permissionTitle}>Activează camera</Text>
              <Text style={styles.permissionText}>Avem nevoie de ea numai când fotografiezi un exercițiu.</Text>
              <View style={styles.permissionButtonWrap}>
                <ComicButton
                  compact
                  title={permission.canAskAgain ? 'Permite accesul' : 'Deschide setările'}
                  trailingIcon="next"
                  tone="lime"
                  onPress={() => {
                    if (permission.canAskAgain) void requestPermission();
                    else void Linking.openSettings();
                  }}
                />
              </View>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Alege o fotografie din galerie"
                disabled={working}
                dimWhenDisabled={false}
                haptic="selection"
                onPress={() => void pickFromGallery()}
                style={styles.permissionGalleryWrap}
                contentStyle={styles.permissionGallery}
              >
                <AppIcon name="gallery" size={30} />
                <Text style={styles.permissionGalleryText}>Alege din galerie</Text>
              </PressableScale>
            </>
          )}
        </View>
      )}

      {permission?.granted ? (
        <View style={[styles.bottomChrome, { bottom: bottomSpace + 12, paddingHorizontal: gutter + 14 }]}>
          <View style={styles.captureGuide}>
            <View style={[styles.captureGuideDot, isCheck && styles.captureGuideDotCheck]} />
            <Text numberOfLines={1} maxFontSizeMultiplier={1.15} style={styles.captureHint}>{isCheck ? 'Prinde enunțul și toți pașii' : 'Prinde tot exercițiul în cadru'}</Text>
          </View>
          <View style={styles.controls}>
            <View style={styles.sideControl}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Alege din galerie"
                disabled={working}
                dimWhenDisabled={false}
                pressedScale={0.94}
                haptic="selection"
                onPress={() => void pickFromGallery()}
                contentStyle={styles.sideIcon}
              >
                <View pointerEvents="none" style={styles.darkShine} />
                <AppIcon name="gallery" size={34} />
              </PressableScale>
              <Text style={styles.sideLabel}>Galerie</Text>
            </View>
            <View style={styles.shutterStage}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.shutterAura,
                  isCheck && styles.shutterAuraCheck,
                  shutterAuraStyle,
                ]}
              />
              <Animated.View style={shutterScaleStyle}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={cameraFailed ? 'Repornește camera' : 'Fă fotografia'}
                  disabled={working}
                  onPress={() => void takePhoto()}
                  style={({ pressed }) => [styles.shutterOuter, isCompact && styles.shutterOuterCompact, pressed && styles.shutterPressed]}
                >
                  <View style={[styles.shutterInner, isCheck && styles.shutterInnerCheck, isCompact && styles.shutterInnerCompact]}>
                    <LinearGradient
                      colors={isCheck
                        ? ['#FFC0A3', '#FF8D6B', '#EE6846']
                        : ['#EDFF7A', '#D8FF3E', '#BCEF12']}
                      start={{ x: 0.12, y: 0 }}
                      end={{ x: 0.88, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View pointerEvents="none" style={styles.shutterShine} />
                    {working
                      ? <PlayfulLoader micro />
                      : cameraFailed
                        ? <AppIcon name="retake" size={39} />
                        : <View style={styles.shutterLensRing} />}
                  </View>
                </Pressable>
              </Animated.View>
            </View>
            <View style={styles.sideControl}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Ajutor pentru fotografie"
                accessibilityState={{ expanded: showHelp }}
                pressedScale={0.94}
                haptic="selection"
                onPress={toggleHelp}
                contentStyle={[styles.sideIcon, showHelp && styles.sideIconActive]}
              >
                <View pointerEvents="none" style={styles.darkShine} />
                <AppIcon name="help" size={34} />
              </PressableScale>
              <Text style={styles.sideLabel}>Ajutor</Text>
            </View>
          </View>
        </View>
      ) : null}

      {captureError ? <View accessibilityRole="alert" style={[styles.errorBanner, { bottom: bottomSpace + (isCompact ? 151 : 169), left: gutter, right: gutter }]}><Text style={styles.errorText}>{captureError}</Text></View> : null}

      {showHelp ? (
        <Animated.View style={[styles.helpBubble, { left: gutter, right: gutter, bottom: bottomSpace + (isCompact ? 147 : 165) }, helpBubbleStyle]}>
          <View style={styles.helpIcon}><AppIcon name="hint" size={35} /></View>
          <View style={styles.helpCopy}><Text style={styles.helpTitle}>Pentru o fotografie clară</Text><Text style={styles.helpText}>Ține telefonul paralel cu foaia, evită umbrele și include tot exercițiul.</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Închide ajutorul" hitSlop={9} onPress={toggleHelp} style={styles.helpClose}><CloseGlyph /></Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, width: '100%', backgroundColor: '#0C091F', overflow: 'hidden' },
  cameraLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#0C091F' },
  cameraAtmosphere: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 2 },
  cameraTint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(14,10,36,0.06)' },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomGradient: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  topBar: { position: 'absolute', zIndex: 20, left: 0, right: 0, height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modeChipWrap: { maxWidth: 228, position: 'relative' },
  modeChipNarrow: { maxWidth: 202 },
  modeChipShadow: { display: 'none' },
  modeChip: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: 'rgba(28, 20, 68, 0.92)',
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: 'rgba(196, 176, 255, 0.34)',
    borderBottomColor: 'rgba(7, 4, 24, 0.78)',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  modeChipCheck: { borderColor: 'rgba(255, 184, 107, 0.48)' },
  darkShine: { position: 'absolute', top: 0, left: 14, right: 14, height: 1.5, backgroundColor: 'rgba(255, 255, 255, 0.22)' },
  modeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime },
  modeDotCheck: { backgroundColor: colors.peach },
  modeChipText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 11.5, letterSpacing: 0.75 },
  finderArea: { position: 'absolute', zIndex: 4, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  finder: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(12,9,31,0.06)',
    overflow: 'hidden',
  },
  finderCheck: { aspectRatio: 1.08, borderColor: 'rgba(255,184,107,0.3)' },
  scanBeamWrap: {
    position: 'absolute',
    top: '50%',
    left: 16,
    right: 16,
    height: 22,
    marginTop: -11,
    justifyContent: 'center',
  },
  scanAura: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 11,
  },
  scanLine: { height: 3, borderRadius: 2, backgroundColor: colors.lime },
  scanLineCheck: { backgroundColor: colors.peach },
  corner: { position: 'absolute', width: 38, height: 38, borderColor: colors.lime },
  cornerCheck: { borderColor: colors.peach },
  cornerTL: { left: 0, top: 0, borderLeftWidth: 4.5, borderTopWidth: 4.5, borderTopLeftRadius: 26 },
  cornerTR: { right: 0, top: 0, borderRightWidth: 4.5, borderTopWidth: 4.5, borderTopRightRadius: 26 },
  cornerBL: { left: 0, bottom: 0, borderLeftWidth: 4.5, borderBottomWidth: 4.5, borderBottomLeftRadius: 26 },
  cornerBR: { right: 0, bottom: 0, borderRightWidth: 4.5, borderBottomWidth: 4.5, borderBottomRightRadius: 26 },
  bottomChrome: { position: 'absolute', zIndex: 20, left: 0, right: 0, alignItems: 'center', gap: 6 },
  captureGuide: { minHeight: 36, borderRadius: 999, backgroundColor: 'rgba(24,18,58,0.92)', borderWidth: 1.3, borderBottomWidth: 3, borderColor: 'rgba(196,176,255,0.32)', borderBottomColor: 'rgba(7, 4, 24, 0.72)', paddingHorizontal: 15, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  captureGuideDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime },
  captureGuideDotCheck: { backgroundColor: colors.peach },
  captureHint: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 11.5, lineHeight: 15, textAlign: 'center' },
  controls: { width: '100%', height: 102, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideControl: { width: 72, minHeight: 78, alignItems: 'center', justifyContent: 'center', gap: 5 },
  sideIcon: {
    width: 56,
    height: 54,
    borderRadius: 19,
    backgroundColor: 'rgba(36, 26, 82, 0.92)',
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: 'rgba(196, 176, 255, 0.34)',
    borderBottomColor: 'rgba(7, 4, 24, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sideIconActive: { backgroundColor: colors.lime, borderColor: '#E8FF78', borderBottomColor: '#7EA508' },
  sideLabel: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 11.5 },
  shutterStage: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  shutterAura: {
    position: 'absolute',
    width: 98,
    height: 98,
    borderRadius: 49,
    backgroundColor: 'rgba(216,255,62,0.22)',
  },
  shutterAuraCheck: {
    backgroundColor: 'rgba(255,184,107,0.24)',
  },
  shutterOuter: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 3.5,
    borderColor: 'rgba(255, 255, 255, 0.94)',
    backgroundColor: 'rgba(23,19,55,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#04030A',
    shadowOpacity: 0.38,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  shutterOuterCompact: { width: 78, height: 78, borderRadius: 39 },
  shutterInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1.4,
    borderBottomWidth: 4,
    borderColor: '#EEFF94',
    borderBottomColor: '#7EA508',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  shutterInnerCheck: { borderColor: '#FFD6C4', borderBottomColor: '#B84426' },
  shutterInnerCompact: { width: 62, height: 62, borderRadius: 31 },
  shutterLensRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.25,
    borderColor: 'rgba(23,19,55,0.26)',
  },
  shutterShine: {
    position: 'absolute',
    top: 4,
    left: 16,
    right: 16,
    height: 5,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
  },
  shutterPressed: { transform: [{ scale: 0.91 }] },
  permissionPanel: { flex: 1, zIndex: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17132E' },
  permissionMascot: { width: 146, height: 146, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  permissionHalo: { position: 'absolute', width: 128, height: 128, borderRadius: 64, backgroundColor: 'rgba(124, 60, 255, 0.16)', borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(167, 139, 250, 0.4)' },
  permissionTitle: { fontFamily: fonts.display, color: colors.paper, fontSize: 27, lineHeight: 31, textAlign: 'center' },
  permissionText: { maxWidth: 300, marginTop: 5, fontFamily: fonts.body, color: '#CFC7E0', fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  permissionButtonWrap: { width: '100%', maxWidth: 330, marginTop: 20 },
  permissionGalleryWrap: { marginTop: 8 },
  permissionGallery: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18 },
  permissionGalleryText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 13.5 },
  errorBanner: { position: 'absolute', zIndex: 35, minHeight: 48, borderRadius: 16, backgroundColor: '#D84A61', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  errorText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  helpBubble: { position: 'absolute', zIndex: 40, minHeight: 84, borderRadius: 24, borderWidth: 1.5, borderBottomWidth: 4, borderColor: '#E5DCFF', borderBottomColor: '#CEC0F8', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 12, shadowColor: '#171337', shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  helpIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.limeSoft, alignItems: 'center', justifyContent: 'center' },
  helpCopy: { flex: 1, minWidth: 0 },
  helpTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 15, lineHeight: 18 },
  helpText: { marginTop: 2, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12.5, lineHeight: 16.5 },
  helpClose: { width: 38, height: 38, borderRadius: 13, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
