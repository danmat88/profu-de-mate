import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { MiniGlyph } from '../components/MiniGlyph';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { prepareCapturedImage } from '../services/imagePipeline';
import { colors, fonts } from '../theme';
import type { CaptureSource, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Capture'>;

export function CaptureScreen({ navigation, route }: Props) {
  const { gutter, isNarrow, isShort, isCompact } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [finderHeight, setFinderHeight] = useState(isShort ? 300 : 420);
  const [isFocused, setIsFocused] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [working, setWorking] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const scan = useRef(new Animated.Value(0)).current;
  const shutterPulse = useRef(new Animated.Value(0)).current;
  const captureFlash = useRef(new Animated.Value(0)).current;
  const helpPop = useRef(new Animated.Value(0)).current;
  const cameraRef = useRef<CameraView | null>(null);
  const capturing = useRef(false);
  const isCheck = route.params.mode === 'check';
  const scanTravel = Math.max(76, finderHeight * 0.31);
  const bottomSpace = Math.max(insets.bottom, 10);

  useFocusEffect(useCallback(() => {
    capturing.current = false;
    setWorking(false);
    setCaptureError(null);
    setIsFocused(true);
    return () => {
      setIsFocused(false);
      setCameraReady(false);
    };
  }, []));

  useEffect(() => {
    if (reducedMotion || !isFocused) {
      scan.setValue(0.5);
      shutterPulse.setValue(0);
      return;
    }
    const scanning = Animated.loop(Animated.sequence([
      Animated.timing(scan, { toValue: 1, duration: 1850, useNativeDriver: true }),
      Animated.timing(scan, { toValue: 0, duration: 1850, useNativeDriver: true }),
    ]));
    const breathing = Animated.loop(Animated.sequence([
      Animated.timing(shutterPulse, { toValue: 1, duration: 1050, useNativeDriver: true }),
      Animated.timing(shutterPulse, { toValue: 0, duration: 1050, useNativeDriver: true }),
    ]));
    scanning.start();
    breathing.start();
    return () => { scanning.stop(); breathing.stop(); };
  }, [isFocused, reducedMotion, scan, shutterPulse]);

  const animateCapture = useCallback(() => {
    if (reducedMotion) return;
    Animated.sequence([
      Animated.timing(captureFlash, { toValue: 1, duration: 70, useNativeDriver: true }),
      Animated.timing(captureFlash, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [captureFlash, reducedMotion]);

  const acceptImage = useCallback(async (raw: { uri: string; width: number; height: number }, source: CaptureSource) => {
    if (capturing.current) return;
    capturing.current = true;
    setWorking(true);
    setCaptureError(null);

    try {
      const image = await prepareCapturedImage(raw, source);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setWorking(false);
      navigation.navigate('Review', { mode: route.params.mode, image });
    } catch {
      capturing.current = false;
      setWorking(false);
      setCaptureError('N-am putut pregăti fotografia. Încearcă din nou.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [navigation, route.params.mode]);

  useEffect(() => {
    let mounted = true;
    ImagePicker.getPendingResultAsync().then((result) => {
      if (!mounted || !result || 'code' in result || result.canceled) return;
      const asset = result.assets?.[0];
      if (asset?.uri && asset.width > 0 && asset.height > 0) {
        void acceptImage(asset, 'gallery');
      }
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, [acceptImage]);

  const takePhoto = async () => {
    if (capturing.current || working) return;
    if (!permission?.granted) {
      await requestPermission();
      return;
    }
    if (!cameraReady || !cameraRef.current) {
      setCaptureError('Camera încă pornește. Mai încearcă o dată.');
      return;
    }

    try {
      capturing.current = true;
      setWorking(true);
      setCaptureError(null);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: false, shutterSound: true });
      animateCapture();
      capturing.current = false;
      setWorking(false);
      await acceptImage(photo, 'camera');
    } catch {
      capturing.current = false;
      setWorking(false);
      setCaptureError('Fotografia nu a reușit. Ține telefonul stabil și încearcă din nou.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const pickFromGallery = async () => {
    if (capturing.current || working) return;
    setCaptureError(null);
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
    await acceptImage(asset, 'gallery');
  };

  const toggleHelp = () => {
    Haptics.selectionAsync();
    if (showHelp) {
      if (reducedMotion) {
        setShowHelp(false);
        return;
      }
      Animated.timing(helpPop, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => setShowHelp(false));
      return;
    }
    setShowHelp(true);
    if (reducedMotion) {
      helpPop.setValue(1);
      return;
    }
    Animated.spring(helpPop, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 7 }).start();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <ComicBackdrop dark />

      <View style={[styles.topBar, { paddingHorizontal: gutter }, isNarrow && styles.topBarNarrow]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide camera" onPress={() => navigation.goBack()} style={styles.roundButton}>
          <MiniGlyph name="close" size={27} color={colors.paper} />
        </Pressable>
        <View style={[styles.modeChip, isNarrow && styles.modeChipNarrow]}>
          <Animated.View style={[styles.liveDot, isCheck && styles.liveDotCheck, { opacity: scan.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) }]} />
          <Text numberOfLines={1} style={styles.modeChipText}>{isCheck ? 'VERIFICĂ REZOLVAREA' : 'REZOLVĂ PROBLEMA'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={flash ? 'Oprește blițul' : 'Pornește blițul'} accessibilityState={{ selected: flash }} onPress={() => { Haptics.selectionAsync(); setFlash((value) => !value); }} style={[styles.roundButton, flash && styles.roundButtonActive]}>
          <AppIcon name="flash" size={41} style={{ opacity: flash ? 1 : 0.52 }} />
        </Pressable>
      </View>

      <View style={[styles.copy, isShort && styles.copyCompact]}>
        <Text style={[styles.title, isNarrow && styles.titleNarrow]}>{isCheck ? 'Încadrează toată rezolvarea' : 'Încadrează problema'}</Text>
        <Text style={styles.hint}>Foaia întreagă, telefonul drept, iar toate marginile să rămână vizibile.</Text>
      </View>

      <View onLayout={(event) => setFinderHeight(event.nativeEvent.layout.height)} style={[styles.finderWrap, { marginHorizontal: gutter }]}>
        <View style={styles.finderShadow} />
        <View style={styles.finder}>
          {permission?.granted && isFocused ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              flash={flash ? 'on' : 'off'}
              mode="picture"
              ratio="4:3"
              animateShutter={false}
              onCameraReady={() => { setCameraReady(true); setCaptureError(null); }}
              onMountError={(event) => { setCameraReady(false); setCaptureError(event.message || 'Camera nu a putut porni.'); }}
            />
          ) : (
            <View style={styles.permissionPanel}>
              {permission === null ? (
                <>
                  <ActivityIndicator size="large" color={colors.lime} />
                  <Text style={styles.permissionTitle}>Pornesc camera…</Text>
                </>
              ) : (
                <>
                  <View style={styles.permissionIcon}><AppIcon name="camera" size={67} /></View>
                  <Text style={styles.permissionEyebrow}>O SINGURĂ PERMISIUNE</Text>
                  <Text style={styles.permissionTitle}>Activăm camera. Atât.</Text>
                  <Text style={styles.permissionText}>Camera se deschide numai aici, când vrei să fotografiezi o problemă.</Text>
                  <View style={styles.permissionPromise}>
                    <MiniGlyph name="check" size={15} color={colors.ink} />
                    <Text style={styles.permissionPromiseText}>Fără microfon · fără acces la toate pozele</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => permission.canAskAgain ? void requestPermission() : void Linking.openSettings()}
                    style={styles.permissionButton}
                  >
                    <Text style={styles.permissionButtonText}>{permission.canAskAgain ? 'Activează camera' : 'Deschide setările'}</Text>
                    <MiniGlyph name="next" size={19} color={colors.ink} />
                  </Pressable>
                </>
              )}
            </View>
          )}
          {permission?.granted ? (
            <>
              <View style={styles.cameraShadeTop} />
              <View style={styles.alignmentStatus}>
                <View style={[styles.alignmentDot, !cameraReady && styles.alignmentDotWaiting]} />
                <Text style={styles.alignmentText}>{cameraReady ? 'CAMERA PREGĂTITĂ' : 'PORNESC CAMERA'}</Text>
              </View>
              <Animated.View style={[styles.scanLine, { opacity: cameraReady ? 1 : 0.25, transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [-scanTravel, scanTravel] }) }] }]} />
              <Animated.View style={[styles.corner, styles.cornerTL, { opacity: scan.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }]} />
              <Animated.View style={[styles.corner, styles.cornerTR, { opacity: scan.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }]} />
              <Animated.View style={[styles.corner, styles.cornerBL, { opacity: scan.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }]} />
              <Animated.View style={[styles.corner, styles.cornerBR, { opacity: scan.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }]} />
              <View style={styles.detected}><MiniGlyph name="spark" size={15} /><Text style={styles.detectedText}>Ține foaia în cadru</Text></View>
            </>
          ) : null}
          {working ? <View style={styles.workingBadge}><ActivityIndicator size="small" color={colors.ink} /><Text style={styles.workingText}>Pregătesc fotografia…</Text></View> : null}
          {captureError ? <View style={styles.errorBanner}><MiniGlyph name="wrong" size={16} color={colors.paper} /><Text style={styles.errorText}>{captureError}</Text></View> : null}
        </View>
      </View>

      <View style={[styles.controlDock, { paddingBottom: bottomSpace }]}>
        <View style={[styles.controls, isCompact && styles.controlsCompact, { paddingHorizontal: gutter + 12 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Alege din galerie" disabled={working} onPress={() => void pickFromGallery()} style={[styles.sideControl, working && styles.controlDisabled]}>
            <View style={styles.sideIcon}><AppIcon name="gallery" size={45} /></View>
            <Text style={styles.sideLabel}>Galerie</Text>
          </Pressable>
          <Animated.View style={{ transform: [{ scale: shutterPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }] }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Fă fotografia" disabled={working} onPress={() => void takePhoto()} style={[styles.shutterOuter, isCompact && styles.shutterOuterCompact, working && styles.controlDisabled]}>
              <View style={[styles.shutterMiddle, isCompact && styles.shutterMiddleCompact]}><AppIcon name="camera" size={isCompact ? 56 : 64} /></View>
            </Pressable>
          </Animated.View>
          <Pressable accessibilityRole="button" accessibilityLabel="Ajutor pentru fotografie" accessibilityState={{ expanded: showHelp }} onPress={toggleHelp} style={styles.sideControl}>
            <View style={[styles.sideIcon, showHelp && styles.sideIconActive]}><AppIcon name="help" size={45} /></View>
            <Text style={styles.sideLabel}>Ajutor</Text>
          </Pressable>
        </View>
        <View style={styles.privacy}><AppIcon name="privacy" size={24} /><Text style={styles.privacyText}>Se trimite securizat pentru analiză și nu se salvează în Caiet</Text></View>
      </View>

      {showHelp ? (
        <Animated.View style={[styles.helpBubble, { left: gutter, right: gutter, bottom: bottomSpace + (isCompact ? 106 : 118), opacity: helpPop, transform: [{ translateY: helpPop.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
          <View style={styles.helpIcon}><AppIcon name="hint" size={40} /></View>
          <View style={styles.helpCopy}><Text style={styles.helpTitle}>O poză clară, din prima</Text><Text style={styles.helpText}>Folosește lumină bună și ține telefonul paralel cu foaia.</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Închide ajutorul" onPress={toggleHelp} style={styles.helpClose}><MiniGlyph name="close" size={18} /></Pressable>
        </Animated.View>
      ) : null}
      <Animated.View pointerEvents="none" style={[styles.captureFlash, { opacity: captureFlash }]} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  topBar: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topBarNarrow: { height: 56 },
  roundButton: { width: 43, height: 43, borderRadius: 15, backgroundColor: '#2A2351', borderWidth: 2, borderColor: '#766D99', alignItems: 'center', justifyContent: 'center' },
  roundButtonActive: { backgroundColor: colors.lime, borderColor: colors.paper },
  modeChip: { maxWidth: 220, height: 34, borderRadius: 12, backgroundColor: '#2A2351', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 7 },
  modeChipNarrow: { maxWidth: 185, paddingHorizontal: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime },
  liveDotCheck: { backgroundColor: colors.peach },
  modeChipText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 9, letterSpacing: 0.6 },
  copy: { paddingHorizontal: 25, paddingTop: 8, paddingBottom: 14 },
  copyCompact: { paddingTop: 3, paddingBottom: 10 },
  title: { fontFamily: fonts.display, color: colors.paper, fontSize: 27, lineHeight: 30, textAlign: 'center' },
  titleNarrow: { fontSize: 24, lineHeight: 27 },
  hint: { fontFamily: fonts.body, color: '#BDB5D6', fontSize: 11.5, lineHeight: 16, textAlign: 'center', marginTop: 2 },
  finderWrap: { flex: 1, minHeight: 225, position: 'relative', marginBottom: 14 },
  finderShadow: { position: 'absolute', top: 6, left: 6, right: -6, bottom: -6, borderRadius: 25, backgroundColor: colors.violetDeep },
  finder: { flex: 1, borderRadius: 25, borderWidth: 2.5, borderColor: colors.paper, backgroundColor: '#393258', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  cameraShadeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 76, backgroundColor: 'rgba(18,14,43,0.22)' },
  permissionPanel: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#393258', paddingHorizontal: 28 },
  permissionIcon: { width: 82, height: 76, borderRadius: 23, borderWidth: 2, borderColor: '#776E98', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A2351', marginBottom: 10, transform: [{ rotate: '-2deg' }] },
  permissionEyebrow: { fontFamily: fonts.bodyBold, color: colors.lime, fontSize: 9, letterSpacing: 1.25 },
  permissionTitle: { fontFamily: fonts.displaySemi, color: colors.paper, fontSize: 22, lineHeight: 25, textAlign: 'center', marginTop: 3 },
  permissionText: { maxWidth: 290, fontFamily: fonts.body, color: '#D1CBE1', fontSize: 11.5, lineHeight: 16, textAlign: 'center', marginTop: 4 },
  permissionPromise: { minHeight: 28, borderRadius: 10, backgroundColor: colors.limeSoft, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, marginTop: 9 },
  permissionPromiseText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9.5 },
  permissionButton: { minHeight: 46, borderRadius: 15, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 18, marginTop: 13, shadowColor: colors.ink, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 3, height: 4 }, elevation: 4 },
  permissionButtonText: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 14 },
  cameraNoiseA: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: '#50496B', top: -55, right: -45, opacity: 0.45 },
  cameraNoiseB: { position: 'absolute', width: 140, height: 70, borderRadius: 35, backgroundColor: '#282241', bottom: 20, left: -31, transform: [{ rotate: '25deg' }] },
  alignmentStatus: { position: 'absolute', zIndex: 3, top: 13, left: 15, height: 25, borderRadius: 9, backgroundColor: 'rgba(23,19,55,0.76)', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  alignmentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.mint },
  alignmentDotWaiting: { backgroundColor: colors.peach },
  alignmentText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 8, letterSpacing: 0.8 },
  paperSheet: { width: '78%', minHeight: 220, backgroundColor: colors.canvas, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 20, paddingVertical: 26, transform: [{ rotate: '-1.5deg' }] },
  paperSheetCompact: { minHeight: 180, paddingVertical: 20 },
  paperLine: { position: 'absolute', left: 0, right: 0, height: 1, top: 65, backgroundColor: '#DCD2C1' },
  paperLabel: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13 },
  equation: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 24, marginTop: 16 },
  equationNarrow: { fontSize: 21 },
  handwriting: { fontFamily: fonts.body, color: colors.violetDeep, fontSize: 16, marginTop: 13, transform: [{ rotate: '-1deg' }] },
  pencilDash: { width: 147, height: 5, borderRadius: 3, backgroundColor: colors.peach, marginTop: 21, transform: [{ rotate: '-2deg' }] },
  scanLine: { position: 'absolute', left: 34, right: 34, height: 3, borderRadius: 2, backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: 0.8, shadowRadius: 8, elevation: 5 },
  corner: { position: 'absolute', width: 34, height: 34, borderColor: colors.lime },
  cornerTL: { left: 15, top: 15, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 9 },
  cornerTR: { right: 15, top: 15, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 9 },
  cornerBL: { left: 15, bottom: 15, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 9 },
  cornerBR: { right: 15, bottom: 15, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 9 },
  detected: { position: 'absolute', bottom: 13, backgroundColor: colors.lime, borderWidth: 2, borderColor: colors.ink, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  detectedText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 10 },
  workingBadge: { position: 'absolute', zIndex: 12, minHeight: 44, borderRadius: 14, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  workingText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11 },
  errorBanner: { position: 'absolute', zIndex: 11, left: 12, right: 12, bottom: 48, minHeight: 43, borderRadius: 14, backgroundColor: '#D84A61', borderWidth: 2, borderColor: colors.paper, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 7 },
  errorText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 10.5, lineHeight: 14, textAlign: 'center' },
  controlDock: { backgroundColor: '#211A43', borderTopWidth: 1, borderTopColor: '#3D3564', paddingTop: 4 },
  controls: { height: 94, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  controlsCompact: { height: 84 },
  sideControl: { minWidth: 68, minHeight: 68, alignItems: 'center', justifyContent: 'center', gap: 3 },
  controlDisabled: { opacity: 0.48 },
  sideIcon: { width: 52, height: 46, borderRadius: 15, backgroundColor: '#2D2653', alignItems: 'center', justifyContent: 'center' },
  sideIconActive: { backgroundColor: colors.lime },
  sideLabel: { fontFamily: fonts.bodyBold, color: '#D8D2E8', fontSize: 10 },
  shutterOuter: { width: 82, height: 82, borderRadius: 41, borderWidth: 3, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  shutterOuterCompact: { width: 74, height: 74, borderRadius: 37 },
  shutterMiddle: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.lime, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  shutterMiddleCompact: { width: 59, height: 59, borderRadius: 30 },
  privacy: { height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  privacyText: { fontFamily: fonts.body, color: '#B6AECF', fontSize: 10 },
  helpBubble: { position: 'absolute', zIndex: 10, minHeight: 82, borderRadius: 20, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 0, shadowOffset: { width: 5, height: 6 }, elevation: 10 },
  helpIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: colors.limeSoft, alignItems: 'center', justifyContent: 'center' },
  helpCopy: { flex: 1 },
  helpTitle: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12 },
  helpText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 10.5, lineHeight: 14, marginTop: 1 },
  helpClose: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center' },
  captureFlash: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, backgroundColor: colors.paper },
});
