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
const pendingAnalysisSource = await readFile(
  new URL('../src/services/pendingAnalysis.ts', import.meta.url),
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

test('raw camera and picker cache copies are deleted even when processing fails', () => {
  assert.match(imagePipelineSource, /finally\s*{\s*deleteTransientCapturedSource\(image\.uri\);\s*}/s);
  assert.match(temporaryImagesSource, /uri\.startsWith\(getCachePrefix\(\)\)/);
  assert.match(temporaryImagesSource, /isManagedTemporaryImage\(uri\)/);
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
  assert.match(reviewSource, /addListener\('beforeRemove'[\s\S]*deleteTemporaryCapturedImages\(\[currentImage\.uri\]\)/);
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
