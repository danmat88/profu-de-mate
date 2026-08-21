import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { cropCapturedImage, rotateCapturedImage } from '../services/imagePipeline';
import { colors, fonts } from '../theme';
import type { CapturedImage } from '../types';
import { AppIcon } from './AppIcon';
import { MiniGlyph } from './MiniGlyph';

type Props = {
  visible: boolean;
  image: CapturedImage;
  onCancel: () => void;
  onApply: (image: CapturedImage) => void;
};

type Size = { width: number; height: number };
type Rect = { x: number; y: number; width: number; height: number };
type GestureKind = 'move' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

const MIN_CROP_SIZE = 82;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getImageRect(workspace: Size, image: CapturedImage): Rect {
  if (!workspace.width || !workspace.height || !image.width || !image.height) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const scale = Math.min(workspace.width / image.width, workspace.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { x: (workspace.width - width) / 2, y: (workspace.height - height) / 2, width, height };
}

function getInitialCrop(imageRect: Rect): Rect {
  const shortestEdge = Math.min(imageRect.width, imageRect.height);
  const inset = Math.min(22, shortestEdge * 0.055);
  const minimumWidth = Math.min(MIN_CROP_SIZE, imageRect.width);
  const minimumHeight = Math.min(MIN_CROP_SIZE, imageRect.height);
  return {
    x: inset,
    y: inset,
    width: Math.max(minimumWidth, imageRect.width - inset * 2),
    height: Math.max(minimumHeight, imageRect.height - inset * 2),
  };
}

export function ImageCropEditor({ visible, image, onCancel, onApply }: Props) {
  const insets = useSafeAreaInsets();
  const entrance = useRef(new Animated.Value(0)).current;
  const cropRef = useRef<Rect>({ x: 0, y: 0, width: 0, height: 0 });
  const gestureStart = useRef<Rect>(cropRef.current);
  const [workspace, setWorkspace] = useState<Size>({ width: 0, height: 0 });
  const [workingImage, setWorkingImage] = useState(image);
  const [crop, setCrop] = useState<Rect>(cropRef.current);
  const [busy, setBusy] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageRect = useMemo(
    () => getImageRect(workspace, workingImage),
    [workspace.height, workspace.width, workingImage],
  );

  useEffect(() => {
    cropRef.current = crop;
  }, [crop]);

  useEffect(() => {
    if (!visible) return;
    setWorkingImage(image);
    setBusy(false);
    setError(null);
    setImageReady(false);
    entrance.setValue(0);
    Animated.spring(entrance, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 5 }).start();
  }, [entrance, image, visible]);

  useEffect(() => {
    if (!visible || imageRect.width <= 0 || imageRect.height <= 0) return;
    const initial = getInitialCrop(imageRect);
    cropRef.current = initial;
    setCrop(initial);
  }, [imageRect.height, imageRect.width, visible, workingImage.uri]);

  const updateCrop = (kind: GestureKind, dx: number, dy: number) => {
    const start = gestureStart.current;
    if (!imageRect.width || !imageRect.height) return;

    if (kind === 'move') {
      setCrop({
        ...start,
        x: clamp(start.x + dx, 0, imageRect.width - start.width),
        y: clamp(start.y + dy, 0, imageRect.height - start.height),
      });
      return;
    }

    let left = start.x;
    let top = start.y;
    let right = start.x + start.width;
    let bottom = start.y + start.height;
    const minimumWidth = Math.min(MIN_CROP_SIZE, imageRect.width);
    const minimumHeight = Math.min(MIN_CROP_SIZE, imageRect.height);

    if (kind === 'topLeft' || kind === 'bottomLeft') {
      left = clamp(start.x + dx, 0, right - minimumWidth);
    }
    if (kind === 'topRight' || kind === 'bottomRight') {
      right = clamp(start.x + start.width + dx, left + minimumWidth, imageRect.width);
    }
    if (kind === 'topLeft' || kind === 'topRight') {
      top = clamp(start.y + dy, 0, bottom - minimumHeight);
    }
    if (kind === 'bottomLeft' || kind === 'bottomRight') {
      bottom = clamp(start.y + start.height + dy, top + minimumHeight, imageRect.height);
    }

    setCrop({ x: left, y: top, width: right - left, height: bottom - top });
  };

  const responders = useMemo(() => {
    const create = (kind: GestureKind) => PanResponder.create({
      onStartShouldSetPanResponder: () => !busy,
      onMoveShouldSetPanResponder: (_, gesture) => !busy && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {
        gestureStart.current = cropRef.current;
        void Haptics.selectionAsync();
      },
      onPanResponderMove: (_, gesture) => updateCrop(kind, gesture.dx, gesture.dy),
    });

    return {
      move: create('move'),
      topLeft: create('topLeft'),
      topRight: create('topRight'),
      bottomLeft: create('bottomLeft'),
      bottomRight: create('bottomRight'),
    };
  // The responders must be recreated when the available bounds or busy state changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, imageRect.height, imageRect.width]);

  const resetCrop = () => {
    const initial = getInitialCrop(imageRect);
    cropRef.current = initial;
    setCrop(initial);
    void Haptics.selectionAsync();
  };

  const rotate = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setImageReady(false);
    try {
      const rotated = await rotateCapturedImage(workingImage);
      setWorkingImage(rotated);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      setImageReady(true);
      setError('Nu am putut roti fotografia. Încearcă din nou.');
    } finally {
      setBusy(false);
    }
  };

  const applyCrop = async () => {
    if (busy || !imageRect.width || !crop.width) return;
    setBusy(true);
    setError(null);
    try {
      const scaleX = workingImage.width / imageRect.width;
      const scaleY = workingImage.height / imageRect.height;
      const edited = await cropCapturedImage(workingImage, {
        originX: crop.x * scaleX,
        originY: crop.y * scaleY,
        width: crop.width * scaleX,
        height: crop.height * scaleY,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onApply(edited);
    } catch {
      setError('Nu am putut aplica încadrarea. Fotografia originală este în siguranță.');
    } finally {
      setBusy(false);
    }
  };

  const absoluteCrop = {
    x: imageRect.x + crop.x,
    y: imageRect.y + crop.y,
    width: crop.width,
    height: crop.height,
  };

  return (
    <Modal visible={visible} animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={busy ? undefined : onCancel}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Animated.View style={[styles.screen, {
          opacity: entrance,
          transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
        }]}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Anulează încadrarea" disabled={busy} onPress={onCancel} style={styles.headerButton}>
              <MiniGlyph name="close" size={25} color={colors.paper} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>AJUSTEAZĂ FOTOGRAFIA</Text>
              <Text style={styles.title}>Încadrează problema</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Resetează încadrarea" disabled={busy} onPress={resetCrop} style={styles.resetButton}>
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
          </View>

          <View
            style={styles.workspace}
            onLayout={(event) => setWorkspace({
              width: event.nativeEvent.layout.width,
              height: event.nativeEvent.layout.height,
            })}
          >
            <Image
              source={{ uri: workingImage.uri }}
              resizeMode="contain"
              onLoad={() => setImageReady(true)}
              onError={() => setError('Fotografia nu mai poate fi afișată.')}
              style={StyleSheet.absoluteFill}
            />

            {imageRect.width > 0 && crop.width > 0 ? (
              <>
                <View pointerEvents="none" style={[styles.shade, { left: 0, right: 0, top: 0, height: absoluteCrop.y }]} />
                <View pointerEvents="none" style={[styles.shade, { left: 0, right: 0, top: absoluteCrop.y + absoluteCrop.height, bottom: 0 }]} />
                <View pointerEvents="none" style={[styles.shade, { left: 0, top: absoluteCrop.y, width: absoluteCrop.x, height: absoluteCrop.height }]} />
                <View pointerEvents="none" style={[styles.shade, { left: absoluteCrop.x + absoluteCrop.width, right: 0, top: absoluteCrop.y, height: absoluteCrop.height }]} />

                <View pointerEvents="box-none" style={[styles.cropFrame, {
                  left: absoluteCrop.x,
                  top: absoluteCrop.y,
                  width: absoluteCrop.width,
                  height: absoluteCrop.height,
                }]}>
                  <View accessibilityLabel="Mută zona selectată" style={StyleSheet.absoluteFill} {...responders.move.panHandlers} />
                  <View pointerEvents="none" style={[styles.gridLine, styles.gridVerticalOne]} />
                  <View pointerEvents="none" style={[styles.gridLine, styles.gridVerticalTwo]} />
                  <View pointerEvents="none" style={[styles.gridLine, styles.gridHorizontalOne]} />
                  <View pointerEvents="none" style={[styles.gridLine, styles.gridHorizontalTwo]} />
                  <View style={[styles.handleTouch, styles.handleTopLeft]} {...responders.topLeft.panHandlers}><View style={[styles.handle, styles.handleBorderTopLeft]} /></View>
                  <View style={[styles.handleTouch, styles.handleTopRight]} {...responders.topRight.panHandlers}><View style={[styles.handle, styles.handleBorderTopRight]} /></View>
                  <View style={[styles.handleTouch, styles.handleBottomLeft]} {...responders.bottomLeft.panHandlers}><View style={[styles.handle, styles.handleBorderBottomLeft]} /></View>
                  <View style={[styles.handleTouch, styles.handleBottomRight]} {...responders.bottomRight.panHandlers}><View style={[styles.handle, styles.handleBorderBottomRight]} /></View>
                </View>
              </>
            ) : null}

            {!imageReady || busy ? (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color={colors.lime} />
                {busy ? <Text style={styles.loadingText}>Pregătesc fotografia…</Text> : null}
              </View>
            ) : null}
            {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}
          </View>

          <Text style={styles.instruction}>Trage colțurile până rămâne doar exercițiul. Poți muta și rama întreagă.</Text>

          <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Rotește fotografia" disabled={busy} onPress={() => void rotate()} style={styles.rotateButton}>
              <AppIcon name="retake" size={34} />
              <Text style={styles.rotateText}>Rotește</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Folosește fotografia încadrată" disabled={busy} onPress={() => void applyCrop()} style={styles.applyButton}>
              {busy ? <ActivityIndicator size="small" color={colors.ink} /> : <AppIcon name="crop" size={34} />}
              <Text style={styles.applyText}>Folosește poza</Text>
              <MiniGlyph name="next" size={22} color={colors.ink} />
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#17132E' },
  screen: { flex: 1, backgroundColor: '#17132E' },
  header: { minHeight: 82, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 11 },
  headerButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 2, borderColor: '#71688F', backgroundColor: '#292346', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  eyebrow: { fontFamily: fonts.bodyBold, color: colors.lime, fontSize: 9, letterSpacing: 1.2 },
  title: { fontFamily: fonts.display, color: colors.paper, fontSize: 23, lineHeight: 26 },
  resetButton: { minWidth: 58, minHeight: 40, borderRadius: 13, borderWidth: 2, borderColor: '#71688F', backgroundColor: '#292346', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  resetText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 11 },
  workspace: { flex: 1, minHeight: 260, marginHorizontal: 12, borderWidth: 2, borderColor: '#6E668A', borderRadius: 22, overflow: 'hidden', backgroundColor: '#090817' },
  shade: { position: 'absolute', backgroundColor: 'rgba(6, 5, 18, 0.7)' },
  cropFrame: { position: 'absolute', borderWidth: 3, borderColor: colors.lime, shadowColor: colors.lime, shadowOpacity: 0.45, shadowRadius: 7, elevation: 5 },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.42)' },
  gridVerticalOne: { top: 0, bottom: 0, left: '33.333%', width: 1 },
  gridVerticalTwo: { top: 0, bottom: 0, left: '66.666%', width: 1 },
  gridHorizontalOne: { left: 0, right: 0, top: '33.333%', height: 1 },
  gridHorizontalTwo: { left: 0, right: 0, top: '66.666%', height: 1 },
  handleTouch: { position: 'absolute', zIndex: 5, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 22, height: 22, borderColor: colors.lime },
  handleTopLeft: { left: -24, top: -24 },
  handleTopRight: { right: -24, top: -24 },
  handleBottomLeft: { left: -24, bottom: -24 },
  handleBottomRight: { right: -24, bottom: -24 },
  handleBorderTopLeft: { borderLeftWidth: 6, borderTopWidth: 6, borderTopLeftRadius: 5 },
  handleBorderTopRight: { borderRightWidth: 6, borderTopWidth: 6, borderTopRightRadius: 5 },
  handleBorderBottomLeft: { borderLeftWidth: 6, borderBottomWidth: 6, borderBottomLeftRadius: 5 },
  handleBorderBottomRight: { borderRightWidth: 6, borderBottomWidth: 6, borderBottomRightRadius: 5 },
  loading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(12,10,28,0.7)' },
  loadingText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 12 },
  error: { position: 'absolute', left: 12, right: 12, bottom: 12, borderWidth: 2, borderColor: colors.paper, borderRadius: 14, backgroundColor: colors.rose, paddingHorizontal: 12, paddingVertical: 9 },
  errorText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 11, lineHeight: 15, textAlign: 'center' },
  instruction: { minHeight: 54, paddingHorizontal: 30, paddingTop: 10, fontFamily: fonts.body, color: '#C6BEDA', fontSize: 11.5, lineHeight: 16, textAlign: 'center' },
  dock: { minHeight: 84, paddingTop: 10, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: '#393253', flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rotateButton: { minWidth: 92, height: 54, borderRadius: 17, borderWidth: 2, borderColor: '#71688F', backgroundColor: '#292346', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 10 },
  rotateText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 11 },
  applyButton: { flex: 1, height: 54, borderRadius: 17, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, shadowColor: '#080615', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  applyText: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 17 },
});
