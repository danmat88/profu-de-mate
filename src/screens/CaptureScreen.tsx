import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { AppIcon } from '../components/AppIcon';
import { MiniGlyph } from '../components/MiniGlyph';
import { PlayfulLoader } from '../components/PlayfulLoader';
import { Text } from '../components/Typography';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { recordDiagnosticError } from '../services/diagnostics';
import { colors, fonts } from '../theme';
import type { CaptureSource, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Capture'>;

function CloseGlyph() {
  return (
    <Svg accessible={false} width={24} height={24} viewBox="0 0 24 24">
      <Path d="M6 6l12 12M18 6L6 18" stroke={colors.paper} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

export function CaptureScreen({ navigation, route }: Props) {
  const responsiveLayout = useResponsiveLayout();
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
  const [cameraFailed, setCameraFailed] = useState(false);
  const [cameraSessionKey, setCameraSessionKey] = useState(0);
  const [working, setWorking] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const scan = useRef(new Animated.Value(0)).current;
  const shutterPulse = useRef(new Animated.Value(0)).current;
  const helpPop = useRef(new Animated.Value(0)).current;
  const cameraPreviewEntrance = useRef(new Animated.Value(0)).current;
  const chromeEntrance = useRef(new Animated.Value(1)).current;
  const finderEntrance = useRef(new Animated.Value(1)).current;
  const controlsEntrance = useRef(new Animated.Value(1)).current;
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
    setIsFocused(true);
    cameraPreviewEntrance.setValue(0);
    chromeEntrance.setValue(1);
    finderEntrance.setValue(1);
    controlsEntrance.setValue(1);
    return () => {
      setIsFocused(false);
      setCameraReady(false);
      cameraPreviewEntrance.stopAnimation();
      cameraPreviewEntrance.setValue(0);
    };
  }, [cameraPreviewEntrance, chromeEntrance, controlsEntrance, finderEntrance]));

  useEffect(() => {
    const unsubscribe = navigation.addListener('transitionEnd', (event) => {
      if (!event.data.closing) setTransitionSettled(true);
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (transitionSettled || !isFocused) return undefined;
    const fallback = setTimeout(() => setTransitionSettled(true), 600);
    return () => clearTimeout(fallback);
  }, [isFocused, transitionSettled]);

  useEffect(() => {
    if (reducedMotion || !isFocused) {
      scan.setValue(0.5);
      shutterPulse.setValue(0);
      return;
    }
    const scanning = Animated.loop(Animated.sequence([
      Animated.timing(scan, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(scan, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    const breathing = Animated.loop(Animated.sequence([
      Animated.timing(shutterPulse, { toValue: 1, duration: 1150, useNativeDriver: true }),
      Animated.timing(shutterPulse, { toValue: 0, duration: 1150, useNativeDriver: true }),
    ]));
    scanning.start();
    breathing.start();
    return () => { scanning.stop(); breathing.stop(); };
  }, [isFocused, reducedMotion, scan, shutterPulse]);

  const revealCamera = useCallback(() => {
    setCameraReady(true);
    setCameraFailed(false);
    setCaptureError(null);
    if (reducedMotion) {
      cameraPreviewEntrance.setValue(1);
      return;
    }
    Animated.timing(cameraPreviewEntrance, {
      toValue: 1,
      duration: 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
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
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
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
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    } finally {
      galleryPickerLocked.current = false;
      if (!capturing.current) setWorking(false);
    }
  }, [acceptImage, working]);

  const toggleHelp = () => {
    void Haptics.selectionAsync();
    if (showHelp) {
      if (reducedMotion) {
        setShowHelp(false);
        return;
      }
      Animated.timing(helpPop, { toValue: 0, duration: 130, useNativeDriver: true }).start(() => setShowHelp(false));
      return;
    }
    setShowHelp(true);
    if (reducedMotion) {
      helpPop.setValue(1);
      return;
    }
    helpPop.setValue(0);
    Animated.spring(helpPop, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 5 }).start();
  };

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
              chromeEntrance.setValue(1);
              finderEntrance.setValue(1);
              controlsEntrance.setValue(1);
              setCaptureError('Camera nu a putut porni. Apasă declanșatorul ca să încerci din nou.');
              recordDiagnosticError('camera_mount', event);
            }}
          />
        </Animated.View>
      ) : null}

      <Animated.View pointerEvents="none" style={[styles.cameraAtmosphere, { opacity: cameraPreviewEntrance }]}>
        <View style={styles.cameraTint} />
        <LinearGradient colors={['rgba(16,13,38,0.88)', 'rgba(16,13,38,0)']} style={[styles.topGradient, { height: topSpace + 132 }]} />
        <LinearGradient colors={['rgba(16,13,38,0)', 'rgba(16,13,38,0.94)', '#17132E']} style={[styles.bottomGradient, { height: bottomSpace + (isCompact ? 232 : 250) }]} />
      </Animated.View>

      <Animated.View style={[styles.topBar, {
        top: topSpace,
        paddingHorizontal: gutter,
        opacity: permission?.granted ? chromeEntrance : 1,
        transform: [{ translateY: permission?.granted ? chromeEntrance.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) : 0 }],
      }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide camera" disabled={working} onPress={() => navigation.goBack()} style={({ pressed }) => [styles.roundButton, pressed && styles.controlPressed]}>
          <CloseGlyph />
        </Pressable>
        <View style={[styles.modeChip, isNarrow && styles.modeChipNarrow]}>
          <View style={[styles.modeDot, isCheck && styles.modeDotCheck]} />
          <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.modeChipText}>{isCheck ? 'VERIFICĂ REZOLVAREA' : 'REZOLVĂ PROBLEMA'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={flash ? 'Oprește blițul' : 'Pornește blițul'} accessibilityState={{ selected: flash }} disabled={working} onPress={() => { void Haptics.selectionAsync(); setFlash((value) => !value); }} style={({ pressed }) => [styles.roundButton, flash && styles.roundButtonActive, pressed && styles.controlPressed]}>
          <AppIcon name="flash" size={31} />
        </Pressable>
      </Animated.View>

      {permission?.granted ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.finderArea, {
            top: topSpace + (isVeryShort ? 74 : 88),
            bottom: bottomSpace + (isCompact ? 156 : 174),
            paddingHorizontal: gutter + 5,
            opacity: finderEntrance,
            transform: [{ scale: finderEntrance.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
          }]}
        >
          <View onLayout={(event) => setFinderHeight(event.nativeEvent.layout.height)} style={[styles.finder, isCheck && styles.finderCheck]}>
            <Animated.View style={[styles.scanLine, { opacity: cameraReady ? 0.9 : 0, transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [-scanTravel, scanTravel] }) }] }]} />
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
        </Animated.View>
      ) : (
        <View style={[styles.permissionPanel, { paddingTop: topSpace + 80, paddingBottom: bottomSpace + 24, paddingHorizontal: gutter + 18 }]}>
          {permission === null ? (
            <PlayfulLoader inverse label="Deschid camera" />
          ) : (
            <>
              <View style={styles.permissionIcon}><AppIcon name="camera" size={62} /></View>
              <Text style={styles.permissionTitle}>Activează camera</Text>
              <Text style={styles.permissionText}>Avem nevoie de ea numai când fotografiezi un exercițiu.</Text>
              <Pressable accessibilityRole="button" onPress={() => permission.canAskAgain ? void requestPermission() : void Linking.openSettings()} style={({ pressed }) => [styles.permissionButton, pressed && styles.primaryPressed]}>
                <Text style={styles.permissionButtonText}>{permission.canAskAgain ? 'Permite accesul' : 'Deschide setările'}</Text>
                <MiniGlyph name="next" size={20} color={colors.ink} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Alege o fotografie din galerie" disabled={working} onPress={() => void pickFromGallery()} style={styles.permissionGallery}>
                <AppIcon name="gallery" size={31} />
                <Text style={styles.permissionGalleryText}>Alege din galerie</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {permission?.granted ? (
        <Animated.View style={[styles.bottomChrome, { bottom: bottomSpace + 12, paddingHorizontal: gutter + 14, opacity: controlsEntrance, transform: [{ translateY: controlsEntrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
          <View style={styles.captureGuide}>
            <View style={[styles.captureGuideDot, isCheck && styles.captureGuideDotCheck]} />
            <Text numberOfLines={1} maxFontSizeMultiplier={1.15} style={styles.captureHint}>{isCheck ? 'Prinde enunțul și toți pașii' : 'Prinde tot exercițiul în cadru'}</Text>
          </View>
          <View style={styles.controls}>
            <Pressable accessibilityRole="button" accessibilityLabel="Alege din galerie" disabled={working} onPress={() => void pickFromGallery()} style={({ pressed }) => [styles.sideControl, working && styles.controlDisabled, pressed && styles.controlPressed]}>
              <View style={styles.sideIcon}><AppIcon name="gallery" size={35} /></View>
              <Text style={styles.sideLabel}>Galerie</Text>
            </Pressable>
            <Animated.View style={{ transform: [{ scale: shutterPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) }] }}>
              <Pressable accessibilityRole="button" accessibilityLabel={cameraFailed ? 'Repornește camera' : 'Fă fotografia'} disabled={working} onPress={() => void takePhoto()} style={({ pressed }) => [styles.shutterOuter, isCompact && styles.shutterOuterCompact, working && styles.controlDisabled, pressed && styles.shutterPressed]}>
                <View style={[styles.shutterInner, isCheck && styles.shutterInnerCheck, isCompact && styles.shutterInnerCompact]}>
                  {working ? <PlayfulLoader micro /> : cameraFailed ? <AppIcon name="retake" size={39} /> : null}
                </View>
              </Pressable>
            </Animated.View>
            <Pressable accessibilityRole="button" accessibilityLabel="Ajutor pentru fotografie" accessibilityState={{ expanded: showHelp }} onPress={toggleHelp} style={({ pressed }) => [styles.sideControl, pressed && styles.controlPressed]}>
              <View style={[styles.sideIcon, showHelp && styles.sideIconActive]}><AppIcon name="help" size={35} /></View>
              <Text style={styles.sideLabel}>Ajutor</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {captureError ? <View accessibilityRole="alert" style={[styles.errorBanner, { bottom: bottomSpace + (isCompact ? 151 : 169), left: gutter, right: gutter }]}><Text style={styles.errorText}>{captureError}</Text></View> : null}

      {showHelp ? (
        <Animated.View style={[styles.helpBubble, { left: gutter, right: gutter, bottom: bottomSpace + (isCompact ? 147 : 165), opacity: helpPop, transform: [{ translateY: helpPop.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
          <View style={styles.helpIcon}><AppIcon name="hint" size={35} /></View>
          <View style={styles.helpCopy}><Text style={styles.helpTitle}>Pentru o fotografie clară</Text><Text style={styles.helpText}>Ține telefonul paralel cu foaia, evită umbrele și include tot exercițiul.</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Închide ajutorul" hitSlop={9} onPress={toggleHelp} style={styles.helpClose}><CloseGlyph /></Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, width: '100%', backgroundColor: '#090817' },
  cameraLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#090817' },
  cameraAtmosphere: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 2 },
  cameraTint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(17,13,40,0.08)' },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomGradient: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  topBar: { position: 'absolute', zIndex: 20, left: 0, right: 0, height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(25,20,55,0.82)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.32)', alignItems: 'center', justifyContent: 'center' },
  roundButtonActive: { backgroundColor: colors.lime, borderColor: colors.lime },
  modeChip: { maxWidth: 220, minHeight: 38, borderRadius: 19, backgroundColor: 'rgba(25,20,55,0.86)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  modeChipNarrow: { maxWidth: 198, paddingHorizontal: 10 },
  modeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime },
  modeDotCheck: { backgroundColor: colors.peach },
  modeChipText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 10.5, letterSpacing: 0.7 },
  finderArea: { position: 'absolute', zIndex: 4, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  finder: { width: '100%', aspectRatio: 4 / 3, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', backgroundColor: 'rgba(8,7,18,0.04)' },
  finderCheck: { aspectRatio: 1.08 },
  scanLine: { position: 'absolute', top: '50%', left: 23, right: 23, height: 2, borderRadius: 2, backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: 0.7, shadowRadius: 7, elevation: 5 },
  corner: { position: 'absolute', width: 36, height: 36, borderColor: colors.lime },
  cornerTL: { left: 0, top: 0, borderLeftWidth: 5, borderTopWidth: 5, borderTopLeftRadius: 11 },
  cornerTR: { right: 0, top: 0, borderRightWidth: 5, borderTopWidth: 5, borderTopRightRadius: 11 },
  cornerBL: { left: 0, bottom: 0, borderLeftWidth: 5, borderBottomWidth: 5, borderBottomLeftRadius: 11 },
  cornerBR: { right: 0, bottom: 0, borderRightWidth: 5, borderBottomWidth: 5, borderBottomRightRadius: 11 },
  bottomChrome: { position: 'absolute', zIndex: 20, left: 0, right: 0, alignItems: 'center' },
  captureGuide: { minHeight: 30, borderRadius: 15, backgroundColor: 'rgba(23,19,55,0.86)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 12, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  captureGuideDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lime },
  captureGuideDotCheck: { backgroundColor: colors.peach },
  captureHint: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 11, lineHeight: 15, textAlign: 'center' },
  controls: { width: '100%', height: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideControl: { width: 72, minHeight: 76, alignItems: 'center', justifyContent: 'center', gap: 4 },
  sideIcon: { width: 52, height: 52, borderRadius: 20, backgroundColor: 'rgba(35,28,73,0.9)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  sideIconActive: { backgroundColor: colors.lime, borderColor: colors.lime },
  sideLabel: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 10.5 },
  shutterOuter: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: colors.paper, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  shutterOuterCompact: { width: 78, height: 78, borderRadius: 39 },
  shutterInner: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.lime, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  shutterInnerCheck: { backgroundColor: colors.peach },
  shutterInnerCompact: { width: 60, height: 60, borderRadius: 30 },
  controlPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  shutterPressed: { transform: [{ scale: 0.92 }] },
  primaryPressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
  controlDisabled: { opacity: 0.45 },
  permissionPanel: { flex: 1, zIndex: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17132E' },
  permissionIcon: { width: 86, height: 86, borderRadius: 28, backgroundColor: '#2A2351', borderWidth: 1.5, borderColor: '#6E668A', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  permissionTitle: { fontFamily: fonts.display, color: colors.paper, fontSize: 27, lineHeight: 31, textAlign: 'center' },
  permissionText: { maxWidth: 300, marginTop: 5, fontFamily: fonts.body, color: '#CFC7E0', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  permissionButton: { width: '100%', maxWidth: 330, minHeight: 56, marginTop: 20, borderRadius: 18, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#090817', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  permissionButtonText: { fontFamily: fonts.display, color: colors.ink, fontSize: 16 },
  permissionGallery: { minHeight: 52, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18 },
  permissionGalleryText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 13 },
  errorBanner: { position: 'absolute', zIndex: 35, minHeight: 48, borderRadius: 16, backgroundColor: '#D84A61', borderWidth: 1.5, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  errorText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  helpBubble: { position: 'absolute', zIndex: 40, minHeight: 82, borderRadius: 22, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 0, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
  helpIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: colors.limeSoft, alignItems: 'center', justifyContent: 'center' },
  helpCopy: { flex: 1, minWidth: 0 },
  helpTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 13, lineHeight: 16 },
  helpText: { marginTop: 1, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 11.5, lineHeight: 15 },
  helpClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
