import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const temporaryImagesSource = await readFile(
  new URL('../src/services/temporaryImages.ts', import.meta.url),
  'utf8',
);
const imagePipelineSource = await readFile(
  new URL('../src/services/imagePipeline.ts', import.meta.url),
  'utf8',
);
const reviewSource = await readFile(
  new URL('../src/screens/ReviewScreen.tsx', import.meta.url),
  'utf8',
);
const homeSource = await readFile(
  new URL('../src/screens/HomeScreen.tsx', import.meta.url),
  'utf8',
);
const processingSource = await readFile(
  new URL('../src/screens/ProcessingScreen.tsx', import.meta.url),
  'utf8',
);
const lessonSource = await readFile(
  new URL('../src/screens/LessonScreen.tsx', import.meta.url),
  'utf8',
);
const lessonPresentationSource = await readFile(
  new URL('../src/services/lessonPresentation.ts', import.meta.url),
  'utf8',
);
const pendingAnalysisSource = await readFile(
  new URL('../src/services/pendingAnalysis.ts', import.meta.url),
  'utf8',
);
const mathAnalysisSource = await readFile(
  new URL('../src/services/mathAnalysis.ts', import.meta.url),
  'utf8',
);
const captureSource = await readFile(
  new URL('../src/screens/CaptureScreen.tsx', import.meta.url),
  'utf8',
);
const cropSource = await readFile(
  new URL('../src/components/ImageCropEditor.tsx', import.meta.url),
  'utf8',
);
const appSource = await readFile(
  new URL('../App.tsx', import.meta.url),
  'utf8',
);

test('raw camera and picker cache copies remain visible through finalization and are released by the flow owner', () => {
  assert.doesNotMatch(imagePipelineSource, /deleteTransientCapturedSource/);
  assert.match(temporaryImagesSource, /uri\.startsWith\(getCachePrefix\(\)\)/);
  assert.match(temporaryImagesSource, /isManagedTemporaryImage\(uri\)/);
  assert.match(temporaryImagesSource, /export function deleteCapturedImageFiles/);
  assert.match(cropSource, /originalImage\.current\.uri,[\s\S]*workingImageRef\.current\.uri,[\s\S]*preparedSubmission\.current\?\.image\.uri/);
});

test('capture cleanup is retried for every root startup and Home focus', () => {
  assert.doesNotMatch(temporaryImagesSource, /startupCleanupComplete/);
  assert.match(temporaryImagesSource, /clearTemporaryCapturedImagesExcept\(keepUris\)/);
  assert.match(homeSource, /useFocusEffect[\s\S]*preparePendingAnalysisOnStartup\(\)/);
});

test('leaving Processing for Home preserves and resumes the same pending analysis', () => {
  const backgroundAction = processingSource.match(/const continueInBackground = \(\) => \{([\s\S]*?)\n  \};/)?.[1] ?? '';
  assert.match(backgroundAction, /navigation\.reset/);
  assert.doesNotMatch(backgroundAction, /clearPendingAnalysis/);
  assert.doesNotMatch(processingSource, /Oprește analiza și revino acasă|>OPREȘTE</);
  assert.match(processingSource, /analyzeOrResumeMathImage\([\s\S]*route\.params\.origin === 'home'/);
  assert.match(mathAnalysisSource, /getAnalysisStatus/);
  assert.match(mathAnalysisSource, /waitForExistingAnalysis/);
  assert.match(homeSource, /navigation\.navigate\('Processing', \{ \.\.\.pendingAnalysis, origin: 'home' \}\)/);
  assert.match(homeSource, /Fotografia și progresul sunt păstrate în siguranță\./);
  assert.match(homeSource, /useState<PendingAnalysis \| null>\(\(\) => getPreparedPendingAnalysis\(\) \?\? null\)/);
  assert.doesNotMatch(homeSource, /pendingStatusLoading|pendingAnalysis === undefined/);
  assert.match(pendingAnalysisSource, /preparedSnapshot = pending/);
  assert.match(pendingAnalysisSource, /preparedSnapshot = value/);
  assert.match(pendingAnalysisSource, /preparedSnapshot = null/);
});

test('Processing returns to Review only when Review is the real origin', () => {
  assert.match(processingSource, /route\.params\.origin === 'review' && navigation\.canGoBack\(\)/);
  assert.match(reviewSource, /requestId,[\s\S]*origin: 'review'/);
  assert.match(processingSource, /canReturnToPhoto \? 'Înapoi la fotografia aleasă' : 'Înapoi acasă'/);
});

test('Processing releases its managed photo when the flow abandons it', () => {
  const returnAction = processingSource.match(/const returnToPhotoOrHome = \(\) => \{([\s\S]*?)\n  \};/)?.[1] ?? '';
  const retakeAction = processingSource.match(/const retakePhoto = \(\) => \{([\s\S]*?)\n  \};/)?.[1] ?? '';
  assert.match(returnAction, /if \(canReturnToPhoto\) navigation\.goBack\(\)/);
  assert.match(returnAction, /else \{[\s\S]*deleteTemporaryCapturedImages\(\[route\.params\.image\.uri\]\)/);
  assert.match(retakeAction, /deleteTemporaryCapturedImages\(\[route\.params\.image\.uri\]\)/);
});

test('leaving Review deletes the currently managed image', () => {
  assert.match(reviewSource, /addListener\('beforeRemove'[\s\S]*deleteCapturedImageFiles\(\[route\.params\.image\.uri, currentImage\.uri\]\)/);
});

test('camera and gallery open the crop workspace directly with one final confirmation', () => {
  assert.match(captureSource, /navigation\.navigate\('Review', \{ mode: route\.params\.mode, image \}\)/);
  assert.match(homeSource, /navigation\.navigate\('Review', \{ mode, image \}\)/);
  assert.match(reviewSource, /<ImageCropEditor/);
  assert.match(reviewSource, /onApply=\{continueToAnalysis\}/);
  assert.doesNotMatch(reviewSource, /cropOpen|setCropOpen|Verifică fotografia/);
  assert.doesNotMatch(cropSource, /<Modal|PASUL 1\/1|Folosește fotografia/);
  assert.match(cropSource, /return \{ x: 0, y: 0, width: imageRect\.width, height: imageRect\.height \}/);
  assert.match(cropSource, /isFullImageCrop\(selectedCrop, imageRect\)/);
  const applyAction = cropSource.match(/const applyCrop = async \(\) => \{([\s\S]*?)\n  \};/)?.[1] ?? '';
  assert.doesNotMatch(applyAction, /setWorkingImage/);
  assert.match(applyAction, /preparedSubmission\.current = \{ key: submissionKey, image: edited \}/);
});

test('crop gestures stay on the native UI thread and commit only after interaction', () => {
  assert.match(appSource, /<GestureHandlerRootView style=\{styles\.gestureRoot\}>/);
  assert.match(cropSource, /Gesture\.Simultaneous\(move, pinch\)/);
  assert.match(cropSource, /const createHandle = \(kind: GestureKind\) => Gesture\.Pan\(\)/);
  assert.match(cropSource, /scheduleOnRN\(commitCrop/);
  assert.match(cropSource, /cropX\.set\(/);
  assert.match(cropSource, /cropX\.get\(\)/);
  assert.doesNotMatch(cropSource, /PanResponder|setNativeProps/);
});

test('heavy photo routes paint first without stacking duplicate transitions', () => {
  assert.match(appSource, /name="Review"[^>]*options=\{\{[^}]*animation: 'none'/);
  assert.match(appSource, /name="Capture"[^>]*animation: reducedMotion \? 'none' : 'slide_from_bottom'/);
  for (const routeName of ['Processing', 'Lesson']) {
    assert.match(appSource, new RegExp(`name="${routeName}"[^>]*animation: reducedMotion \\? 'none' : 'slide_from_right'`));
  }
  assert.doesNotMatch(cropSource, /accessibilityViewIsModal style=\{\[styles\.screen, \{\s*opacity:/);
  assert.match(cropSource, /<View accessibilityViewIsModal style=\{styles\.screen\}>/);
  assert.doesNotMatch(homeSource, /exitCurtain|portalBlade|portalSeam/);
  assert.doesNotMatch(captureSource, /capturePortal|capturePortalCore/);
  assert.doesNotMatch(reviewSource, /transitionCover|scanWipe|scanEdge/);
  assert.doesNotMatch(processingSource, /entryScan|resultSheet/);
  assert.match(homeSource, /Animated\.sequence\(\[[\s\S]*secondaryExit[\s\S]*modeExit[\s\S]*heroExit/);
  assert.match(captureSource, /onCameraReady=\{revealCamera\}/);
  assert.match(captureSource, /addListener\('transitionEnd'[\s\S]*setTransitionSettled\(true\)/);
  assert.match(captureSource, /permission\?\.granted && isFocused && transitionSettled/);
  assert.doesNotMatch(captureSource, /exitCameraToCrop|Pregătesc fotografia/);
  assert.doesNotMatch(cropSource, /withDelay|Deschid fotografia|busyStatus/);
  assert.match(processingSource, /const markReady = \(\) => \{[\s\S]*setSceneReady\(true\)/);
  assert.match(processingSource, /addListener\('transitionEnd'[\s\S]*markReady\(\)/);
  assert.doesNotMatch(processingSource, /headerEntrance\.setValue\(0\)|stageEntrance\.setValue\(0\)|copyEntrance\.setValue\(0\)|jobsEntrance\.setValue\(0\)/);
  assert.doesNotMatch(reviewSource, /remainingTransitionTime/);
  assert.doesNotMatch(appSource, /animation: reducedMotion \? 'none' : 'fade'/);
});

test('the completed analysis preloads its math document before the native lesson transition', () => {
  const preloadIndex = processingSource.indexOf("navigation.preload('Lesson', lessonParams)");
  const readinessIndex = processingSource.indexOf('lessonPresentation = waitForLessonPresentation(lessonId)');
  const awaitIndex = processingSource.indexOf('await lessonPresentation');
  const replaceIndex = processingSource.indexOf("navigation.replace('Lesson', lessonParams)");
  assert.ok(preloadIndex >= 0);
  assert.ok(readinessIndex > preloadIndex);
  assert.ok(awaitIndex > readinessIndex);
  assert.ok(replaceIndex > awaitIndex);
  assert.match(lessonSource, /onReady=\{\(\) => markLessonPresentationReady\(route\.params\.lessonId\)\}/);
  assert.match(lessonPresentationSource, /timeoutMs = 1_800/);
  assert.doesNotMatch(processingSource, /void refreshCommercialAccess\(\)/);
  assert.match(lessonSource, /addListener\('transitionEnd'[\s\S]*void refreshCommercialAccess\(\)/);
});

test('the processing scan follows the real photo bounds without a native shadow', () => {
  assert.match(processingSource, /containedImageRect\(analysisFrameWidth, analysisFrameHeight, route\.params\.image\)/);
  assert.match(processingSource, /left: analysisImageRect\.x,[\s\S]*top: analysisImageRect\.y,[\s\S]*width: analysisImageRect\.width,[\s\S]*height: analysisImageRect\.height/);
  assert.match(processingSource, /inputRange: \[0, 0\.06, 0\.9, 1\], outputRange: \[0, 0\.92, 0\.92, 0\]/);
  const scanCoreStyle = processingSource.match(/analysisScanCore: \{([^}]*)\}/)?.[1] ?? '';
  assert.doesNotMatch(scanCoreStyle, /shadow|elevation/);
});

test('processing progress advances from the same four stages shown to the user', () => {
  assert.match(processingSource, /const nextValue = step \/ 3/);
  assert.match(processingSource, /setActive\(1\);\s*moveProgressToStep\(1\)/);
  assert.match(processingSource, /setActive\(2\);\s*moveProgressToStep\(2\)/);
  assert.doesNotMatch(processingSource, /toValue: 0\.9/);
  assert.match(processingSource, /statusArea: \{ flex: 1, minHeight: 0, justifyContent: 'space-evenly' \}/);
});

test('camera navigation stays native and readiness-gated without a custom transition layer', () => {
  assert.match(homeSource, /navigation\.navigate\('Capture', \{ mode \}\)/);
  assert.match(captureSource, /opacity: cameraPreviewEntrance/);
  assert.doesNotMatch(homeSource, /cameraLaunch|crtGlow|crtCore/);
  assert.doesNotMatch(captureSource, /cameraReveal|crtIgnition|cameraHandoff|handoffFocus|cameraStarting/);
});

test('the in-camera gallery picker locks before opening and always unlocks', () => {
  const picker = captureSource.match(/const pickFromGallery = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[acceptImage, working\]\);/)?.[1] ?? '';
  assert.match(picker, /galleryPickerLocked\.current = true;[\s\S]*launchImageLibraryAsync/);
  assert.match(picker, /finally\s*{[\s\S]*galleryPickerLocked\.current = false/);
  assert.match(picker, /setWorking\(true\)/);
});

test('camera mount failures have a safe retry and crop waits for the image', () => {
  assert.match(captureSource, /onMountError=\{\(event\) => \{[\s\S]*setCameraFailed\(true\)/);
  assert.doesNotMatch(captureSource, /setCaptureError\(event\.message/);
  assert.match(captureSource, /cameraFailed \? 'Repornește camera' : 'Fă fotografia'/);
  assert.match(captureSource, /setCameraSessionKey\(\(value\) => value \+ 1\)/);
  assert.match(cropSource, /disabled=\{busy \|\| !imageReady\}/);
  assert.match(cropSource, /operationLocked\.current \|\| !imageReady \|\| !imageRect\.width/);
});
