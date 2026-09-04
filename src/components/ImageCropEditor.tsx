import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { cropCapturedImage, rotateCapturedImage } from '../services/imagePipeline';
import { deleteCapturedImageFiles, isManagedTemporaryImage } from '../services/temporaryImages';
import { colors, fonts } from '../theme';
import type { CapturedImage, FlowMode } from '../types';
import { AppIcon } from './AppIcon';
import { PlayfulLoader } from './PlayfulLoader';
import { Text } from './Typography';

type Props = {
  image: CapturedImage;
  mode: FlowMode;
  actionError?: string | null;
  onCancel: () => void;
  onApply: (image: CapturedImage) => Promise<boolean | void> | boolean | void;
};

type Size = { width: number; height: number };
type Rect = { x: number; y: number; width: number; height: number };
type GestureKind = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

const MIN_CROP_SIZE = 92;
const CROP_A11Y_STEP = 14;
const CANVAS_INSET = 14;
const CROP_RADIUS = 22;
const cropAccessibilityActions = [
  { name: 'moveUp', label: 'Mută în sus' },
  { name: 'moveDown', label: 'Mută în jos' },
  { name: 'moveLeft', label: 'Mută la stânga' },
  { name: 'moveRight', label: 'Mută la dreapta' },
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function clampOnUI(value: number, minimum: number, maximum: number) {
  'worklet';
  return Math.min(Math.max(value, minimum), maximum);
}

function getImageRect(workspace: Size, image: CapturedImage): Rect {
  if (!workspace.width || !workspace.height || !image.width || !image.height) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const availableWidth = Math.max(1, workspace.width - CANVAS_INSET * 2);
  const availableHeight = Math.max(1, workspace.height - CANVAS_INSET * 2);
  const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    x: CANVAS_INSET + (availableWidth - width) / 2,
    y: CANVAS_INSET + (availableHeight - height) / 2,
    width,
    height,
  };
}

function getInitialCrop(imageRect: Rect): Rect {
  return { x: 0, y: 0, width: imageRect.width, height: imageRect.height };
}

function isFullImageCrop(crop: Rect, imageRect: Rect) {
  const tolerance = 1.5;
  return Math.abs(crop.x) <= tolerance
    && Math.abs(crop.y) <= tolerance
    && Math.abs(crop.width - imageRect.width) <= tolerance
    && Math.abs(crop.height - imageRect.height) <= tolerance;
}

function CloseGlyph() {
  return (
    <Svg accessible={false} width={22} height={22} viewBox="0 0 24 24">
      <Path d="M6 6l12 12M18 6 6 18" stroke={colors.paper} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

export function ImageCropEditor({ image, mode, actionError, onCancel, onApply }: Props) {
  const responsiveLayout = useResponsiveLayout();
  const liveInsets = useSafeAreaInsets();
  const stableLayout = useRef(responsiveLayout).current;
  const stableInsets = useRef(liveInsets).current;
  const { height, gutter, isVeryShort, isLargeText } = stableLayout;
  const topSpace = Math.max(stableInsets.top, 0);
  const bottomSpace = Math.max(stableInsets.bottom, 12);
  const reducedMotion = useReducedMotion();
  const cropRef = useRef<Rect>({ x: 0, y: 0, width: 0, height: 0 });
  const initializedCropFor = useRef<string | null>(null);
  const operationLocked = useRef(false);
  const originalImage = useRef(image);
  const workingImageRef = useRef(image);
  const preparedSubmission = useRef<{ key: string; image: CapturedImage } | null>(null);
  const [workspace, setWorkspace] = useState<Size>({ width: 0, height: 0 });
  const [workingImage, setWorkingImage] = useState(image);
  const [busy, setBusy] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageRect = useMemo(() => getImageRect(workspace, workingImage), [workspace, workingImage]);
  const isCheck = mode === 'check';
  const visibleError = error ?? actionError;

  const cropX = useSharedValue(0);
  const cropY = useSharedValue(0);
  const cropWidth = useSharedValue(0);
  const cropHeight = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startWidth = useSharedValue(0);
  const startHeight = useSharedValue(0);
  const interacting = useSharedValue(0);
  const frameEntrance = useSharedValue(reducedMotion ? 1 : 0);

  const commitCrop = useCallback((x: number, y: number, width: number, cropHeightValue: number) => {
    cropRef.current = { x, y, width, height: cropHeightValue };
  }, []);

  const hapticTick = useCallback(() => {
    void Haptics.selectionAsync();
  }, []);

  useEffect(() => {
    frameEntrance.set(reducedMotion ? 1 : 0);
    setImageReady(false);
  }, [frameEntrance, reducedMotion, workingImage.uri]);

  useEffect(() => {
    workingImageRef.current = workingImage;
  }, [workingImage]);

  useEffect(() => () => {
    deleteCapturedImageFiles([
      originalImage.current.uri,
      workingImageRef.current.uri,
      preparedSubmission.current?.image.uri,
    ]);
    preparedSubmission.current = null;
  }, []);

  useEffect(() => {
    if (imageRect.width <= 0 || imageRect.height <= 0) return;
    const imageKey = `${workingImage.uri}:${workingImage.width}x${workingImage.height}`;
    if (initializedCropFor.current === imageKey) return;
    const initial = getInitialCrop(imageRect);
    initializedCropFor.current = imageKey;
    cropRef.current = initial;
    cropX.set(initial.x);
    cropY.set(initial.y);
    cropWidth.set(initial.width);
    cropHeight.set(initial.height);
  }, [cropHeight, cropWidth, cropX, cropY, imageRect, workingImage]);

  const cropFrameStyle = useAnimatedStyle(() => ({
    left: imageRect.x + cropX.get(),
    top: imageRect.y + cropY.get(),
    width: cropWidth.get(),
    height: cropHeight.get(),
    opacity: frameEntrance.get(),
    transform: [{ scale: 1.015 - frameEntrance.get() * 0.015 }],
  }));

  const cropPhotoStyle = useAnimatedStyle(() => ({
    width: imageRect.width,
    height: imageRect.height,
    transform: [
      { translateX: -cropX.get() },
      { translateY: -cropY.get() },
    ],
  }));

  const gridStyle = useAnimatedStyle(() => ({
    opacity: withTiming(interacting.get() ? 0.72 : 0.2, { duration: 110 }),
  }));

  const gestures = useMemo(() => {
    const beginGesture = () => {
      'worklet';
      startX.set(cropX.get());
      startY.set(cropY.get());
      startWidth.set(cropWidth.get());
      startHeight.set(cropHeight.get());
      interacting.set(1);
      scheduleOnRN(hapticTick);
    };

    const finishGesture = () => {
      'worklet';
      interacting.set(0);
      scheduleOnRN(commitCrop, cropX.get(), cropY.get(), cropWidth.get(), cropHeight.get());
    };

    const move = Gesture.Pan()
      .enabled(!busy)
      .maxPointers(1)
      .minDistance(1)
      .onBegin(beginGesture)
      .onUpdate((event) => {
        cropX.set(clampOnUI(startX.get() + event.translationX, 0, imageRect.width - cropWidth.get()));
        cropY.set(clampOnUI(startY.get() + event.translationY, 0, imageRect.height - cropHeight.get()));
      })
      .onFinalize(finishGesture);

    const pinch = Gesture.Pinch()
      .enabled(!busy)
      .onBegin(beginGesture)
      .onUpdate((event) => {
        const minimumScale = Math.max(
          Math.min(MIN_CROP_SIZE, imageRect.width) / startWidth.get(),
          Math.min(MIN_CROP_SIZE, imageRect.height) / startHeight.get(),
        );
        const maximumScale = Math.min(
          imageRect.width / startWidth.get(),
          imageRect.height / startHeight.get(),
        );
        const nextScale = clampOnUI(event.scale, minimumScale, maximumScale);
        const nextWidth = startWidth.get() * nextScale;
        const nextHeight = startHeight.get() * nextScale;
        const centerX = startX.get() + startWidth.get() / 2;
        const centerY = startY.get() + startHeight.get() / 2;
        cropWidth.set(nextWidth);
        cropHeight.set(nextHeight);
        cropX.set(clampOnUI(centerX - nextWidth / 2, 0, imageRect.width - nextWidth));
        cropY.set(clampOnUI(centerY - nextHeight / 2, 0, imageRect.height - nextHeight));
      })
      .onFinalize(finishGesture);

    const createHandle = (kind: GestureKind) => Gesture.Pan()
      .enabled(!busy)
      .minDistance(0)
      .onBegin(beginGesture)
      .onUpdate((event) => {
        let left = startX.get();
        let top = startY.get();
        let right = startX.get() + startWidth.get();
        let bottom = startY.get() + startHeight.get();
        const minimumWidth = Math.min(MIN_CROP_SIZE, imageRect.width);
        const minimumHeight = Math.min(MIN_CROP_SIZE, imageRect.height);

        if (kind === 'topLeft' || kind === 'bottomLeft') {
          left = clampOnUI(startX.get() + event.translationX, 0, right - minimumWidth);
        }
        if (kind === 'topRight' || kind === 'bottomRight') {
          right = clampOnUI(startX.get() + startWidth.get() + event.translationX, left + minimumWidth, imageRect.width);
        }
        if (kind === 'topLeft' || kind === 'topRight') {
          top = clampOnUI(startY.get() + event.translationY, 0, bottom - minimumHeight);
        }
        if (kind === 'bottomLeft' || kind === 'bottomRight') {
          bottom = clampOnUI(startY.get() + startHeight.get() + event.translationY, top + minimumHeight, imageRect.height);
        }

        cropX.set(left);
        cropY.set(top);
        cropWidth.set(right - left);
        cropHeight.set(bottom - top);
      })
      .onFinalize(finishGesture);

    return {
      content: Gesture.Simultaneous(move, pinch),
      topLeft: createHandle('topLeft'),
      topRight: createHandle('topRight'),
      bottomLeft: createHandle('bottomLeft'),
      bottomRight: createHandle('bottomRight'),
    };
  }, [busy, commitCrop, cropHeight, cropWidth, cropX, cropY, hapticTick, imageRect.height, imageRect.width, interacting, startHeight, startWidth, startX, startY]);

  const setCropFromJS = useCallback((next: Rect, animated = false) => {
    cropRef.current = next;
    const animation = (value: number) => animated && !reducedMotion
      ? withTiming(value, { duration: 180, easing: Easing.out(Easing.cubic) })
      : value;
    cropX.set(animation(next.x));
    cropY.set(animation(next.y));
    cropWidth.set(animation(next.width));
    cropHeight.set(animation(next.height));
  }, [cropHeight, cropWidth, cropX, cropY, reducedMotion]);

  const adjustCropForAccessibility = (kind: GestureKind | 'move', actionName: string) => {
    const start = {
      x: cropX.get(),
      y: cropY.get(),
      width: cropWidth.get(),
      height: cropHeight.get(),
    };
    const dx = actionName === 'moveLeft' ? -CROP_A11Y_STEP : actionName === 'moveRight' ? CROP_A11Y_STEP : 0;
    const dy = actionName === 'moveUp' ? -CROP_A11Y_STEP : actionName === 'moveDown' ? CROP_A11Y_STEP : 0;
    let left = start.x;
    let top = start.y;
    let right = start.x + start.width;
    let bottom = start.y + start.height;

    if (kind === 'move') {
      setCropFromJS({
        ...start,
        x: clamp(start.x + dx, 0, imageRect.width - start.width),
        y: clamp(start.y + dy, 0, imageRect.height - start.height),
      }, true);
      void Haptics.selectionAsync();
      return;
    }

    const minimumWidth = Math.min(MIN_CROP_SIZE, imageRect.width);
    const minimumHeight = Math.min(MIN_CROP_SIZE, imageRect.height);
    if (kind === 'topLeft' || kind === 'bottomLeft') left = clamp(start.x + dx, 0, right - minimumWidth);
    if (kind === 'topRight' || kind === 'bottomRight') right = clamp(start.x + start.width + dx, left + minimumWidth, imageRect.width);
    if (kind === 'topLeft' || kind === 'topRight') top = clamp(start.y + dy, 0, bottom - minimumHeight);
    if (kind === 'bottomLeft' || kind === 'bottomRight') bottom = clamp(start.y + start.height + dy, top + minimumHeight, imageRect.height);
    setCropFromJS({ x: left, y: top, width: right - left, height: bottom - top }, true);
    void Haptics.selectionAsync();
  };

  const resetCrop = () => {
    if (!imageRect.width || !imageRect.height) return;
    setCropFromJS(getInitialCrop(imageRect), true);
    setError(null);
    void Haptics.selectionAsync();
  };

  const cancelEditing = () => {
    if (operationLocked.current || busy) return;
    deleteCapturedImageFiles([originalImage.current.uri, workingImage.uri, preparedSubmission.current?.image.uri]);
    preparedSubmission.current = null;
    onCancel();
  };

  const rotate = async () => {
    if (operationLocked.current || busy) return;
    operationLocked.current = true;
    setBusy(true);
    setError(null);
    try {
      const previousUri = workingImage.uri;
      deleteCapturedImageFiles([preparedSubmission.current?.image.uri], [image.uri, previousUri]);
      preparedSubmission.current = null;
      const rotated = await rotateCapturedImage(workingImage);
      initializedCropFor.current = null;
      setWorkingImage(rotated);
      deleteCapturedImageFiles([previousUri], [image.uri, rotated.uri]);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    } catch {
      setError('Nu am putut roti fotografia. Încearcă din nou.');
    } finally {
      operationLocked.current = false;
      setBusy(false);
    }
  };

  const applyCrop = async () => {
    if (operationLocked.current || !imageReady || !imageRect.width) return;
    const selectedCrop = {
      x: cropX.get(),
      y: cropY.get(),
      width: cropWidth.get(),
      height: cropHeight.get(),
    };
    if (!selectedCrop.width || !selectedCrop.height) return;
    operationLocked.current = true;
    setBusy(true);
    setError(null);

    try {
      const scaleX = workingImage.width / imageRect.width;
      const scaleY = workingImage.height / imageRect.height;
      const crop = {
        originX: selectedCrop.x * scaleX,
        originY: selectedCrop.y * scaleY,
        width: selectedCrop.width * scaleX,
        height: selectedCrop.height * scaleY,
      };
      const submissionKey = [
        workingImage.uri,
        Math.round(crop.originX),
        Math.round(crop.originY),
        Math.round(crop.width),
        Math.round(crop.height),
      ].join(':');
      let edited = preparedSubmission.current?.key === submissionKey
        ? preparedSubmission.current.image
        : workingImage;

      if (edited === workingImage && (!isFullImageCrop(selectedCrop, imageRect) || !isManagedTemporaryImage(workingImage.uri))) {
        edited = await cropCapturedImage(workingImage, crop);
      }

      if (preparedSubmission.current?.image.uri !== edited.uri) {
        deleteCapturedImageFiles([preparedSubmission.current?.image.uri], [image.uri, workingImage.uri, edited.uri]);
      }
      preparedSubmission.current = { key: submissionKey, image: edited };

      const accepted = await onApply(edited);
      if (accepted === false) return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch {
      setError('Nu am putut pregăti fotografia. Imaginea originală este în siguranță.');
    } finally {
      operationLocked.current = false;
      setBusy(false);
    }
  };

  const revealImage = () => {
    setImageReady(true);
    frameEntrance.set(reducedMotion
      ? 1
      : withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) }));
  };

  const renderHandle = (kind: GestureKind, label: string, positionStyle: object, borderStyle: object) => (
    <GestureDetector gesture={gestures[kind]}>
      <Animated.View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityActions={cropAccessibilityActions}
        onAccessibilityAction={(event) => adjustCropForAccessibility(kind, event.nativeEvent.actionName)}
        style={[styles.handleTouch, positionStyle]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.handle,
            kind === 'topLeft' && styles.handlePieceTopLeft,
            kind === 'topRight' && styles.handlePieceTopRight,
            kind === 'bottomLeft' && styles.handlePieceBottomLeft,
            kind === 'bottomRight' && styles.handlePieceBottomRight,
            borderStyle,
          ]}
        />
      </Animated.View>
    </GestureDetector>
  );

  return (
    <View style={[styles.safe, { height, paddingTop: topSpace }]}>
      <StatusBar style="light" />
      <View accessibilityViewIsModal style={styles.screen}>
        <Animated.View style={[styles.header, isLargeText && styles.headerLargeText, { paddingHorizontal: gutter }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Renunță la fotografie" disabled={busy} onPress={cancelEditing} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <CloseGlyph />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.headerTitle}>Încadrează {isCheck ? 'rezolvarea' : 'problema'}</Text>
            <Text numberOfLines={1} maxFontSizeMultiplier={1.15} style={styles.headerSubtitle}>Păstrează doar exercițiul.</Text>
          </View>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.headerBadge}>
            <AppIcon name="crop" size={38} />
          </View>
        </Animated.View>

        <Animated.View
          style={[styles.workspace, isVeryShort && styles.workspaceShort]}
          onLayout={(event) => {
            const next = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
            setWorkspace((current) => Math.abs(current.width - next.width) < 0.5 && Math.abs(current.height - next.height) < 0.5 ? current : next);
          }}
        >
          {imageRect.width > 0 ? (
            <View
              pointerEvents="none"
              style={[styles.photoSurface, {
                left: imageRect.x,
                top: imageRect.y,
                width: imageRect.width,
                height: imageRect.height,
              }]}
            >
              <Animated.Image
                accessible
                accessibilityLabel="Fotografia pe care o încadrezi"
                source={{ uri: workingImage.uri }}
                resizeMode="cover"
                fadeDuration={0}
                onLoad={revealImage}
                onError={() => setError('Fotografia nu mai poate fi afișată.')}
                style={styles.photo}
              />
              <View style={styles.photoDim} />
            </View>
          ) : null}

          {imageRect.width > 0 ? (
            <>
              <Animated.View pointerEvents="box-none" style={[styles.cropFrame, cropFrameStyle]}>
                <View pointerEvents="none" style={styles.cropWindow}>
                  <Animated.Image
                    source={{ uri: workingImage.uri }}
                    resizeMode="cover"
                    fadeDuration={0}
                    style={[styles.cropPhoto, cropPhotoStyle]}
                  />
                </View>
                <GestureDetector gesture={gestures.content}>
                  <Animated.View
                    accessible
                    accessibilityRole="adjustable"
                    accessibilityLabel="Mută sau redimensionează zona selectată"
                    accessibilityHint="Trage zona sau folosește două degete pentru a-i schimba mărimea"
                    accessibilityActions={cropAccessibilityActions}
                    onAccessibilityAction={(event) => adjustCropForAccessibility('move', event.nativeEvent.actionName)}
                    style={styles.gestureSurface}
                  >
                    <Animated.View pointerEvents="none" style={[styles.grid, gridStyle]}>
                      <View style={[styles.gridLine, styles.gridVerticalOne]} />
                      <View style={[styles.gridLine, styles.gridVerticalTwo]} />
                      <View style={[styles.gridLine, styles.gridHorizontalOne]} />
                      <View style={[styles.gridLine, styles.gridHorizontalTwo]} />
                    </Animated.View>
                  </Animated.View>
                </GestureDetector>
                {renderHandle('topLeft', 'Colțul stânga sus', styles.handleTopLeft, styles.handleBorderTopLeft)}
                {renderHandle('topRight', 'Colțul dreapta sus', styles.handleTopRight, styles.handleBorderTopRight)}
                {renderHandle('bottomLeft', 'Colțul stânga jos', styles.handleBottomLeft, styles.handleBorderBottomLeft)}
                {renderHandle('bottomRight', 'Colțul dreapta jos', styles.handleBottomRight, styles.handleBorderBottomRight)}
              </Animated.View>
            </>
          ) : null}

          {visibleError ? (
            <View pointerEvents="none" accessibilityRole="alert" style={[styles.workspaceHint, styles.workspaceError]}>
              <View style={[styles.workspaceHintDot, styles.workspaceHintDotError]} />
              <Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={[styles.workspaceHintText, styles.workspaceErrorText]}>{visibleError}</Text>
            </View>
          ) : null}

        </Animated.View>

        <Animated.View style={[styles.dock, isLargeText && styles.dockLargeText, { paddingHorizontal: gutter, paddingBottom: bottomSpace }]}>
          <View style={[styles.actionRow, isLargeText && styles.actionRowLargeText]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Rotește fotografia" disabled={busy} onPress={() => void rotate()} style={({ pressed }) => [styles.toolButton, isLargeText && styles.toolButtonLargeText, pressed && styles.toolPressed]}>
              <View style={styles.toolIcon}>
                <AppIcon name="retake" size={40} />
              </View>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.15} style={styles.toolText}>Rotește</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Extinde selecția la toată fotografia" disabled={busy} onPress={resetCrop} style={({ pressed }) => [styles.toolButton, isLargeText && styles.toolButtonLargeText, pressed && styles.toolPressed]}>
              <View style={styles.toolIcon}>
                <AppIcon name="crop" size={40} />
              </View>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.15} style={styles.toolText}>Tot cadrul</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isCheck ? 'Verifică rezolvarea încadrată' : 'Rezolvă problema încadrată'}
              disabled={busy || !imageReady}
              onPress={() => void applyCrop()}
              style={({ pressed }) => [styles.applyButton, isLargeText && styles.buttonLargeText, isCheck && styles.applyButtonCheck, (busy || !imageReady) && styles.disabled, pressed && styles.applyPressed]}
            >
              <View style={styles.applyIcon}>{busy ? <PlayfulLoader micro /> : <AppIcon name={isCheck ? 'verify' : 'scan'} size={45} />}</View>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.15} style={styles.applyText}>{busy ? 'Pregătesc' : isCheck ? 'Verifică' : 'Rezolvă'}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { width: '100%', flexGrow: 0, flexShrink: 0, backgroundColor: '#080711' },
  screen: { flex: 1, backgroundColor: '#080711' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.96 }] },
  header: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 11, backgroundColor: '#080711' },
  headerLargeText: { minHeight: 88 },
  headerButton: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: '#19162B', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerCopy: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.displaySemi, color: colors.paper, fontSize: 17, lineHeight: 20, textAlign: 'center' },
  headerSubtitle: { marginTop: 1, fontFamily: fonts.bodyBold, color: '#AAA3BD', fontSize: 9.5, lineHeight: 12, textAlign: 'center' },
  headerBadge: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#151322', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  workspace: { flex: 1, minHeight: 260, overflow: 'hidden', backgroundColor: '#030308' },
  workspaceShort: { minHeight: 200 },
  photoSurface: { position: 'absolute', zIndex: 1, borderRadius: CROP_RADIUS, overflow: 'hidden', backgroundColor: '#0D0B16' },
  photo: { width: '100%', height: '100%', borderRadius: CROP_RADIUS },
  photoDim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(3,3,8,0.58)' },
  cropFrame: { position: 'absolute', zIndex: 4, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.96)', borderRadius: CROP_RADIUS },
  cropWindow: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: CROP_RADIUS, overflow: 'hidden', backgroundColor: '#0D0B16' },
  cropPhoto: { position: 'absolute', left: 0, top: 0 },
  gestureSurface: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  grid: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.82)' },
  gridVerticalOne: { top: 0, bottom: 0, left: '33.333%', width: 1 },
  gridVerticalTwo: { top: 0, bottom: 0, left: '66.666%', width: 1 },
  gridHorizontalOne: { left: 0, right: 0, top: '33.333%', height: 1 },
  gridHorizontalTwo: { left: 0, right: 0, top: '66.666%', height: 1 },
  handleTouch: { position: 'absolute', zIndex: 10, width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  handle: { position: 'absolute', width: 32, height: 32, borderColor: colors.lime },
  handlePieceTopLeft: { left: 32, top: 32 },
  handlePieceTopRight: { right: 32, top: 32 },
  handlePieceBottomLeft: { left: 32, bottom: 32 },
  handlePieceBottomRight: { right: 32, bottom: 32 },
  handleTopLeft: { left: -32, top: -32 },
  handleTopRight: { right: -32, top: -32 },
  handleBottomLeft: { left: -32, bottom: -32 },
  handleBottomRight: { right: -32, bottom: -32 },
  handleBorderTopLeft: { borderLeftWidth: 6, borderTopWidth: 6, borderTopLeftRadius: CROP_RADIUS },
  handleBorderTopRight: { borderRightWidth: 6, borderTopWidth: 6, borderTopRightRadius: CROP_RADIUS },
  handleBorderBottomLeft: { borderLeftWidth: 6, borderBottomWidth: 6, borderBottomLeftRadius: CROP_RADIUS },
  handleBorderBottomRight: { borderRightWidth: 6, borderBottomWidth: 6, borderBottomRightRadius: CROP_RADIUS },
  workspaceHint: { position: 'absolute', zIndex: 20, left: 20, right: 20, bottom: 13, minHeight: 38, maxWidth: 420, alignSelf: 'center', borderRadius: 19, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(18,16,31,0.94)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  workspaceHintDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime, flexShrink: 0 },
  workspaceHintDotError: { backgroundColor: colors.rose },
  workspaceHintText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 11.5, lineHeight: 15, textAlign: 'center' },
  workspaceError: { backgroundColor: 'rgba(91,31,50,0.95)', borderColor: 'rgba(255,215,220,0.32)' },
  workspaceErrorText: { color: '#FFE1E5' },
  dock: { minHeight: 118, paddingTop: 11, backgroundColor: '#080711' },
  dockLargeText: { minHeight: 130, paddingTop: 11 },
  actionRow: { maxWidth: 430, width: '100%', height: 92, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  actionRowLargeText: { height: 102 },
  toolButton: { width: 68, height: 84, alignItems: 'center', justifyContent: 'center', gap: 3 },
  toolButtonLargeText: { width: 74, height: 94 },
  toolIcon: { width: 56, height: 56, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: '#1B1731', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.42, shadowRadius: 0, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  toolPressed: { opacity: 0.82, transform: [{ scale: 0.94 }] },
  toolText: { fontFamily: fonts.bodyBold, color: '#E9E4F2', fontSize: 10.5, lineHeight: 13, textAlign: 'center' },
  applyButton: { flex: 1, minWidth: 0, height: 72, borderRadius: 24, borderWidth: 2.5, borderColor: '#11101C', backgroundColor: colors.lime, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.9, shadowRadius: 0, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  buttonLargeText: { height: 82, borderRadius: 26 },
  applyButtonCheck: { backgroundColor: colors.peach },
  applyPressed: { opacity: 0.92, transform: [{ translateY: 2 }] },
  applyIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  applyText: { flexShrink: 1, fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 16.5, lineHeight: 20, textAlign: 'center' },
  disabled: { opacity: 0.55 },
});
