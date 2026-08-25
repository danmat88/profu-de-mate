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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { cropCapturedImage, rotateCapturedImage } from '../services/imagePipeline';
import { deleteTemporaryCapturedImages } from '../services/temporaryImages';
import { colors, fonts } from '../theme';
import type { CapturedImage } from '../types';
import { AppIcon } from './AppIcon';
import { MiniGlyph } from './MiniGlyph';
import { Text } from './Typography';

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
const CROP_A11Y_STEP = 12;
const cropAccessibilityActions = [
  { name: 'moveUp', label: 'Mută în sus' },
  { name: 'moveDown', label: 'Mută în jos' },
  { name: 'moveLeft', label: 'Mută la stânga' },
  { name: 'moveRight', label: 'Mută la dreapta' },
];

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
  const responsiveLayout = useResponsiveLayout();
  const liveInsets = useSafeAreaInsets();
  const stableLayout = useRef(responsiveLayout).current;
  const stableInsets = useRef(liveInsets).current;
  const { height, gutter, isNarrow, isVeryShort, isLargeText } = stableLayout;
  const topSpace = Math.max(stableInsets.top, 0);
  const bottomSpace = Math.max(stableInsets.bottom, 12);
  const reducedMotion = useReducedMotion();
  const entrance = useRef(new Animated.Value(0)).current;
  const cropRef = useRef<Rect>({ x: 0, y: 0, width: 0, height: 0 });
  const gestureStart = useRef<Rect>(cropRef.current);
  const initializedCropFor = useRef<string | null>(null);
  const operationLocked = useRef(false);
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
    initializedCropFor.current = null;
    entrance.setValue(0);
    if (reducedMotion) {
      entrance.setValue(1);
      return;
    }
    Animated.spring(entrance, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 5 }).start();
  }, [entrance, image, reducedMotion, visible]);

  useEffect(() => {
    if (!visible || imageRect.width <= 0 || imageRect.height <= 0) return;
    const imageKey = `${workingImage.uri}:${workingImage.width}x${workingImage.height}`;
    if (initializedCropFor.current === imageKey) return;
    const initial = getInitialCrop(imageRect);
    initializedCropFor.current = imageKey;
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

  const adjustCropForAccessibility = (kind: GestureKind, actionName: string) => {
    gestureStart.current = cropRef.current;
    const dx = actionName === 'moveLeft' ? -CROP_A11Y_STEP : actionName === 'moveRight' ? CROP_A11Y_STEP : 0;
    const dy = actionName === 'moveUp' ? -CROP_A11Y_STEP : actionName === 'moveDown' ? CROP_A11Y_STEP : 0;
    updateCrop(kind, dx, dy);
    void Haptics.selectionAsync();
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

  const cancelEditing = () => {
    if (operationLocked.current || busy) return;
    deleteTemporaryCapturedImages([workingImage.uri], [image.uri]);
    onCancel();
  };

  const rotate = async () => {
    if (operationLocked.current) return;
    operationLocked.current = true;
    setBusy(true);
    setError(null);
    setImageReady(false);
    try {
      const previousUri = workingImage.uri;
      const rotated = await rotateCapturedImage(workingImage);
      setWorkingImage(rotated);
      deleteTemporaryCapturedImages([previousUri], [image.uri, rotated.uri]);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    } catch {
      setImageReady(true);
      setError('Nu am putut roti fotografia. Încearcă din nou.');
    } finally {
      operationLocked.current = false;
      setBusy(false);
    }
  };

  const applyCrop = async () => {
    if (operationLocked.current || !imageRect.width || !crop.width) return;
    operationLocked.current = true;
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
      onApply(edited);
      deleteTemporaryCapturedImages([image.uri, workingImage.uri], [edited.uri]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch {
      setError('Nu am putut decupa fotografia. Fotografia originală nu a fost modificată.');
    } finally {
      operationLocked.current = false;
      setBusy(false);
    }
  };

  const absoluteCrop = {
    x: imageRect.x + crop.x,
    y: imageRect.y + crop.y,
    width: crop.width,
    height: crop.height,
  };
  const cropPercent = imageRect.width && imageRect.height
    ? Math.round((crop.width * crop.height * 100) / (imageRect.width * imageRect.height))
    : 0;

  return (
    <Modal visible={visible} animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={busy ? undefined : cancelEditing}>
      <StatusBar style="light" />
      <View style={[styles.safe, { height, paddingTop: topSpace }]}>
        <Animated.View accessibilityViewIsModal style={[styles.screen, {
          opacity: entrance,
          transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.992, 1] }) }],
        }]}>
          <View style={[styles.header, isLargeText && styles.headerLargeText, { paddingHorizontal: gutter }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Anulează încadrarea" disabled={busy} onPress={cancelEditing} style={styles.headerButton}>
              <MiniGlyph name="close" size={25} color={colors.paper} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>PREGĂTEȘTE FOTOGRAFIA</Text>
              <Text numberOfLines={isLargeText ? 2 : 1} adjustsFontSizeToFit={!isLargeText} minimumFontScale={0.78} style={[styles.title, isNarrow && styles.titleNarrow]}>Păstrează doar exercițiul</Text>
            </View>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>PASUL 1/1</Text></View>
          </View>

          <View
            style={[styles.workspace, isVeryShort && styles.workspaceShort, { marginHorizontal: Math.max(gutter - 5, 8) }]}
            onLayout={(event) => {
              const next = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
              setWorkspace((current) => Math.abs(current.width - next.width) < 0.5 && Math.abs(current.height - next.height) < 0.5 ? current : next);
            }}
          >
            <Image
              accessible
              accessibilityLabel="Fotografia pe care o încadrezi"
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
                  <View pointerEvents="none" style={styles.cropLabel}>
                    <Text style={styles.cropLabelText}>ZONA PĂSTRATĂ · {cropPercent}%</Text>
                  </View>
                  <View
                    accessible
                    accessibilityRole="adjustable"
                    accessibilityLabel="Mută zona selectată"
                    accessibilityHint="Folosește acțiunile de accesibilitate pentru sus, jos, stânga sau dreapta"
                    accessibilityActions={cropAccessibilityActions}
                    onAccessibilityAction={(event) => adjustCropForAccessibility('move', event.nativeEvent.actionName)}
                    style={StyleSheet.absoluteFill}
                    {...responders.move.panHandlers}
                  />
                  <View pointerEvents="none" style={[styles.gridLine, styles.gridVerticalOne]} />
                  <View pointerEvents="none" style={[styles.gridLine, styles.gridVerticalTwo]} />
                  <View pointerEvents="none" style={[styles.gridLine, styles.gridHorizontalOne]} />
                  <View pointerEvents="none" style={[styles.gridLine, styles.gridHorizontalTwo]} />
                  <View accessible accessibilityRole="adjustable" accessibilityLabel="Colțul stânga sus" accessibilityActions={cropAccessibilityActions} onAccessibilityAction={(event) => adjustCropForAccessibility('topLeft', event.nativeEvent.actionName)} style={[styles.handleTouch, styles.handleTopLeft]} {...responders.topLeft.panHandlers}><View style={[styles.handle, styles.handleBorderTopLeft]} /></View>
                  <View accessible accessibilityRole="adjustable" accessibilityLabel="Colțul dreapta sus" accessibilityActions={cropAccessibilityActions} onAccessibilityAction={(event) => adjustCropForAccessibility('topRight', event.nativeEvent.actionName)} style={[styles.handleTouch, styles.handleTopRight]} {...responders.topRight.panHandlers}><View style={[styles.handle, styles.handleBorderTopRight]} /></View>
                  <View accessible accessibilityRole="adjustable" accessibilityLabel="Colțul stânga jos" accessibilityActions={cropAccessibilityActions} onAccessibilityAction={(event) => adjustCropForAccessibility('bottomLeft', event.nativeEvent.actionName)} style={[styles.handleTouch, styles.handleBottomLeft]} {...responders.bottomLeft.panHandlers}><View style={[styles.handle, styles.handleBorderBottomLeft]} /></View>
                  <View accessible accessibilityRole="adjustable" accessibilityLabel="Colțul dreapta jos" accessibilityActions={cropAccessibilityActions} onAccessibilityAction={(event) => adjustCropForAccessibility('bottomRight', event.nativeEvent.actionName)} style={[styles.handleTouch, styles.handleBottomRight]} {...responders.bottomRight.panHandlers}><View style={[styles.handle, styles.handleBorderBottomRight]} /></View>
                </View>
              </>
            ) : null}

            {!imageReady || busy ? (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color={colors.lime} />
                {busy ? <Text style={styles.loadingText}>Pregătesc fotografia…</Text> : null}
              </View>
            ) : null}
            {error ? <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}
          </View>

          <View style={[styles.dock, isLargeText && styles.dockLargeText, { paddingHorizontal: gutter, paddingBottom: bottomSpace }]}>
            <View style={styles.hintRow}>
              <View style={styles.hintIcon}><AppIcon name="crop" size={30} /></View>
              <View style={styles.hintCopy}>
                <Text style={styles.hintTitle}>Alege ce păstrăm</Text>
                <Text numberOfLines={isLargeText ? 4 : 2} style={styles.instruction}>Trage colțurile sau mută rama până cuprinde numai exercițiul.</Text>
              </View>
            </View>
            <View style={styles.actionRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="Resetează încadrarea" disabled={busy} onPress={resetCrop} style={styles.toolButton}>
                <MiniGlyph name="close" size={18} color={colors.paper} />
                <Text style={styles.toolText}>De la început</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Rotește fotografia" disabled={busy} onPress={() => void rotate()} style={styles.toolButton}>
                <AppIcon name="retake" size={30} />
                <Text style={styles.toolText}>Rotește</Text>
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Folosește fotografia încadrată" disabled={busy} onPress={() => void applyCrop()} style={styles.applyButton}>
              <View style={styles.applyIcon}>{busy ? <ActivityIndicator size="small" color={colors.ink} /> : <AppIcon name="crop" size={31} />}</View>
              <View style={styles.applyCopy}>
                <Text style={styles.applyText}>Folosește fotografia</Text>
                {!isVeryShort ? <Text style={styles.applyNote}>Apoi verifici dacă se vede tot</Text> : null}
              </View>
              <MiniGlyph name="next" size={22} color={colors.ink} />
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { width: '100%', flexGrow: 0, flexShrink: 0, backgroundColor: '#17132E' },
  screen: { flex: 1, backgroundColor: '#17132E' },
  header: { minHeight: 76, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLargeText: { minHeight: 104 },
  headerButton: { width: 48, height: 48, borderRadius: 15, borderWidth: 2, borderColor: '#777090', backgroundColor: '#292346', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  eyebrow: { fontFamily: fonts.bodyBold, color: colors.lime, fontSize: 8, letterSpacing: 1.15 },
  title: { fontFamily: fonts.display, color: colors.paper, fontSize: 21, lineHeight: 24 },
  titleNarrow: { fontSize: 18.5, lineHeight: 22 },
  stepBadge: { minWidth: 57, minHeight: 31, borderRadius: 10, borderWidth: 1.5, borderColor: colors.lime, backgroundColor: '#292346', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, transform: [{ rotate: '2deg' }] },
  stepBadgeText: { fontFamily: fonts.bodyBold, color: colors.lime, fontSize: 7, letterSpacing: 0.7 },
  workspace: { flex: 1, minHeight: 250, borderWidth: 2.5, borderColor: '#847AA6', borderRadius: 20, overflow: 'hidden', backgroundColor: '#090817', shadowColor: '#080615', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 5 }, elevation: 7 },
  workspaceShort: { minHeight: 180 },
  shade: { position: 'absolute', backgroundColor: 'rgba(6, 5, 18, 0.76)' },
  cropFrame: { position: 'absolute', borderWidth: 2.5, borderColor: colors.lime, shadowColor: colors.lime, shadowOpacity: 0.55, shadowRadius: 9, elevation: 5 },
  cropLabel: { position: 'absolute', left: 6, top: 6, zIndex: 3, borderRadius: 7, backgroundColor: colors.lime, paddingHorizontal: 7, paddingVertical: 3 },
  cropLabelText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 6.5, letterSpacing: 0.65 },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.5)' },
  gridVerticalOne: { top: 0, bottom: 0, left: '33.333%', width: 1 },
  gridVerticalTwo: { top: 0, bottom: 0, left: '66.666%', width: 1 },
  gridHorizontalOne: { left: 0, right: 0, top: '33.333%', height: 1 },
  gridHorizontalTwo: { left: 0, right: 0, top: '66.666%', height: 1 },
  handleTouch: { position: 'absolute', zIndex: 5, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 24, height: 24, borderColor: colors.lime },
  handleTopLeft: { left: -24, top: -24 },
  handleTopRight: { right: -24, top: -24 },
  handleBottomLeft: { left: -24, bottom: -24 },
  handleBottomRight: { right: -24, bottom: -24 },
  handleBorderTopLeft: { borderLeftWidth: 7, borderTopWidth: 7, borderTopLeftRadius: 6 },
  handleBorderTopRight: { borderRightWidth: 7, borderTopWidth: 7, borderTopRightRadius: 6 },
  handleBorderBottomLeft: { borderLeftWidth: 7, borderBottomWidth: 7, borderBottomLeftRadius: 6 },
  handleBorderBottomRight: { borderRightWidth: 7, borderBottomWidth: 7, borderBottomRightRadius: 6 },
  loading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(12,10,28,0.7)' },
  loadingText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 12 },
  error: { position: 'absolute', left: 12, right: 12, bottom: 12, borderWidth: 2, borderColor: colors.paper, borderRadius: 14, backgroundColor: colors.rose, paddingHorizontal: 12, paddingVertical: 9 },
  errorText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  dock: { minHeight: 166, paddingTop: 10, paddingHorizontal: 14, gap: 9 },
  dockLargeText: { minHeight: 226 },
  hintRow: { minHeight: 43, maxWidth: 560, width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 9 },
  hintIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.violet, borderWidth: 1.5, borderColor: '#8C81AE', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  hintCopy: { flex: 1, minWidth: 0 },
  hintTitle: { fontFamily: fonts.display, color: colors.paper, fontSize: 13, lineHeight: 16 },
  instruction: { marginTop: 1, fontFamily: fonts.body, color: '#CFC7E0', fontSize: 12, lineHeight: 16 },
  actionRow: { maxWidth: 560, width: '100%', alignSelf: 'center', flexDirection: 'row', gap: 8 },
  toolButton: { flex: 1, minHeight: 48, borderRadius: 13, borderWidth: 1.5, borderColor: '#777090', backgroundColor: '#292346', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  toolText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 12 },
  applyButton: { maxWidth: 560, width: '100%', minHeight: 57, alignSelf: 'center', borderRadius: 17, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, gap: 8, shadowColor: '#080615', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  applyIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  applyCopy: { flex: 1, minWidth: 0 },
  applyText: { fontFamily: fonts.display, color: colors.ink, fontSize: 15.5, lineHeight: 18 },
  applyNote: { marginTop: 1, fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 12 },
});
