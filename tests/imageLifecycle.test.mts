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

test('raw camera and picker cache copies are deleted even when processing fails', () => {
  assert.match(imagePipelineSource, /finally\s*{\s*deleteTransientCapturedSource\(image\.uri\);\s*}/s);
  assert.match(temporaryImagesSource, /uri\.startsWith\(getCachePrefix\(\)\)/);
  assert.match(temporaryImagesSource, /isManagedTemporaryImage\(uri\)/);
});

test('capture cleanup is retried for every root startup and Home focus', () => {
  assert.doesNotMatch(temporaryImagesSource, /startupCleanupComplete/);
  assert.match(temporaryImagesSource, /clearTemporaryCapturedImagesExcept\(keepUris\)/);
  assert.match(homeSource, /useFocusEffect[\s\S]*clearTemporaryCapturedImages\(\)/);
});

test('leaving Review deletes the currently managed image', () => {
  assert.match(reviewSource, /addListener\('beforeRemove'[\s\S]*deleteTemporaryCapturedImages\(\[currentImage\.uri\]\)/);
});
