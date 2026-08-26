import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { settleStartupTask } from '../src/services/startupBootstrap.ts';

const appSource = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
const splashSource = await readFile(new URL('../src/components/LaunchSplash.tsx', import.meta.url), 'utf8');
const assetsSource = await readFile(new URL('../src/services/startupAssets.ts', import.meta.url), 'utf8');
const cacheSource = await readFile(new URL('../src/services/commercialAccessCache.ts', import.meta.url), 'utf8');
const commercialSource = await readFile(new URL('../src/services/commercial.ts', import.meta.url), 'utf8');
const commercialContextSource = await readFile(new URL('../src/context/CommercialContext.tsx', import.meta.url), 'utf8');
const lessonsSource = await readFile(new URL('../src/services/lessons.ts', import.meta.url), 'utf8');
const deletionSource = await readFile(new URL('../src/services/dataManagement.ts', import.meta.url), 'utf8');

test('startup prepares the first frame before handing off the native splash', () => {
  assert.match(appSource, /const firebaseSession = initializeFirebaseServices\(\)/);
  assert.match(appSource, /const cachedAccessForSession = firebaseSession\.then\(\(\) => readCachedCommercialAccess\(\)\)/);
  assert.match(appSource, /Promise\.all\(\[[\s\S]*settleStartupTask\(preloadCriticalAppAssets\(\)[\s\S]*settleStartupTask\(preparePendingAnalysisOnStartup\(\)[\s\S]*settleStartupTask\(cachedAccessForSession/);
  assert.match(appSource, /<CommercialProvider initialAccess=\{startup\.initialAccess\}>/);
  assert.match(appSource, /onReady=\{\(\) => setNavigationReady\(true\)\}/);
  assert.match(appSource, /firstFrameReady = navigationReady && \(Boolean\(access\) \|\| !commercialLoading\)/);
  assert.match(appSource, /<LaunchSplash ready=\{firstFrameReady\}/);
  assert.match(appSource, /if \(!fontsReady \|\| !startup\)[\s\S]*styles\.preloadSurface/);
  assert.match(appSource, /preloadSurface: \{ flex: 1, backgroundColor: colors\.ink \}/);
  assert.doesNotMatch(appSource, /if \(!fontsReady \|\| !startup\) return null/);
});

test('local startup work is bounded and always settles with an explicit outcome', async () => {
  const ready = await settleStartupTask(Promise.resolve('cached'), 'fallback', 50);
  assert.deepEqual(ready, { value: 'cached', outcome: 'ready' });

  const failure = new Error('local failure');
  const failed = await settleStartupTask(Promise.reject(failure), 'fallback', 50);
  assert.equal(failed.value, 'fallback');
  assert.equal(failed.outcome, 'failed');
  assert.equal(failed.error, failure);

  const timedOut = await settleStartupTask(new Promise<string>(() => undefined), 'fallback', 5);
  assert.deepEqual(timedOut, { value: 'fallback', outcome: 'timed_out' });
});

test('critical artwork is bundled and preloaded without eagerly decoding every route', () => {
  for (const asset of ['splash-mark-v2', 'profu-mark-v2', 'profu-mascot-v2']) {
    assert.match(assetsSource, new RegExp(asset));
  }
  for (const icon of ['camera', 'gallery', 'notebook', 'scan', 'settings', 'verify']) {
    assert.match(assetsSource, new RegExp(`iconAssets\\.${icon}`));
  }
  assert.match(assetsSource, /Asset\.loadAsync\(criticalAssetModules\)/);
  assert.match(assetsSource, /Other[\s\S]*assets lazy/);
});

test('React splash waits for readiness but can never trap an offline user', () => {
  assert.match(splashSource, /readyRef\.current = ready/);
  assert.match(splashSource, /if \(!force && !readyRef\.current\) return/);
  assert.match(splashSource, /readinessWatchdog = setTimeout[\s\S]*1_500 : 5_000/);
  assert.match(splashSource, /hardWatchdog = setTimeout\(finishOnce, reducedMotion \? 2_500 : 6_500\)/);
  assert.doesNotMatch(splashSource, /timer = setTimeout\(finishOnce, 520\)/);
});

test('cached access is uid-bound, expiring and display-only', () => {
  assert.match(cacheSource, /parsed\.firebaseUserId !== currentUserId/);
  assert.match(cacheSource, /age < 0 \|\| age > MAX_CACHE_AGE_MS/);
  assert.match(cacheSource, /Date\.parse\(entry\.access\.resetAt\) <= Date\.now\(\)/);
  assert.match(cacheSource, /premium\.expiresAt[\s\S]*Date\.parse/);
  assert.match(commercialSource, /const access = \(await callable\(\{ installationToken \}\)\)\.data;[\s\S]*writeCachedCommercialAccess\(access\)/);
  assert.match(commercialSource, /preflightAnalysisAccess[\s\S]*let access = await getCommercialAccess\(\)/);
  assert.match(deletionSource, /clearCachedCommercialAccess\(\)/);
});

test('the notebook is warmed during startup and still subscribes live when opened', () => {
  assert.match(commercialContextSource, /prewarmFavoriteLessonsCache\(\)/);
  assert.match(lessonsSource, /export function prewarmFavoriteLessonsCache/);
  assert.match(lessonsSource, /subscribeToFavoriteLessons\(/);
  assert.match(lessonsSource, /setTimeout\(finish, 3_500\)/);
});
