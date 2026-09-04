import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { authSessionIdentityKey } from '../src/services/authSessionIdentity.ts';
import {
  AUTOMATIC_COMMERCIAL_REFRESH_INTERVAL_MS,
  isCurrentCommercialRefreshGeneration,
  shouldAutomaticallyRefreshCommercialAccess,
} from '../src/services/commercialRefreshPolicy.ts';
import { settleStartupTask } from '../src/services/startupBootstrap.ts';

const appSource = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
const splashSource = await readFile(new URL('../src/components/LaunchSplash.tsx', import.meta.url), 'utf8');
const assetsSource = await readFile(new URL('../src/services/startupAssets.ts', import.meta.url), 'utf8');
const cacheSource = await readFile(new URL('../src/services/commercialAccessCache.ts', import.meta.url), 'utf8');
const commercialSource = await readFile(new URL('../src/services/commercial.ts', import.meta.url), 'utf8');
const commercialContextSource = await readFile(new URL('../src/context/CommercialContext.tsx', import.meta.url), 'utf8');
const lessonsSource = await readFile(new URL('../src/services/lessons.ts', import.meta.url), 'utf8');
const deletionSource = await readFile(new URL('../src/services/dataManagement.ts', import.meta.url), 'utf8');
const homeSource = await readFile(new URL('../src/screens/HomeScreen.tsx', import.meta.url), 'utf8');
const paywallSource = await readFile(new URL('../src/screens/PaywallScreen.tsx', import.meta.url), 'utf8');

test('startup prepares commercial identity before revealing the first Home frame', () => {
  assert.match(appSource, /const firebaseSession = initializeFirebaseServices\(\)/);
  assert.match(appSource, /const cachedAccessForSession = firebaseSession\.then\(\(\) => readCachedCommercialAccess\(\)\)/);
  assert.match(appSource, /Promise\.all\(\[[\s\S]*settleStartupTask\(preloadCriticalAppAssets\(\)[\s\S]*settleStartupTask\(preparePendingAnalysisOnStartup\(\)[\s\S]*settleStartupTask\(cachedAccessForSession/);
  assert.match(appSource, /<CommercialProvider initialAccess=\{startup\.initialAccess\}>/);
  assert.match(appSource, /onReady=\{\(\) => setNavigationReady\(true\)\}/);
  assert.match(appSource, /startupReady: commercialStartupReady/);
  assert.match(appSource, /<LaunchSplash ready=\{navigationReady && commercialStartupReady\}/);
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

test('React splash starts its entrance after readiness but can never trap an offline user', () => {
  assert.match(splashSource, /readyRef\.current = ready/);
  assert.match(splashSource, /requestEntryRef\.current/);
  assert.match(splashSource, /const beginEntry = \(force = false\)/);
  assert.match(splashSource, /if \(!force && !readyRef\.current\) return/);
  assert.match(splashSource, /readinessWatchdog = setTimeout[\s\S]*4_800 : 6_500/);
  assert.match(splashSource, /hardWatchdog = setTimeout\(finishOnce, reducedMotion \? 6_000 : 9_500\)/);
  assert.ok(splashSource.indexOf('const beginEntry') < splashSource.indexOf('entryAnimation.start'));
  assert.doesNotMatch(splashSource, /timer = setTimeout\(finishOnce, 520\)/);
});

test('native splash hands off only to a painted scene without a decorative-only flash', () => {
  assert.match(appSource, /SplashScreen\.setOptions\(\{ duration: 0, fade: false \}\)/);
  assert.match(splashSource, /const \[sceneReady, setSceneReady\] = useState\(false\)/);
  assert.match(splashSource, /onLayout=\{handleSceneLayout\}/);
  assert.match(splashSource, /if \(!sceneReady\) return undefined/);
  assert.match(splashSource, /Animated\.parallel\(\[[\s\S]*Animated\.spring\(heroReveal[\s\S]*Animated\.timing\(orbsReveal[\s\S]*Animated\.timing\(symbolsReveal/);
  assert.doesNotMatch(splashSource, /Animated\.sequence\(\[\s*Animated\.timing\(orbsReveal/);
});

test('cached access is uid-bound, expiring and display-only', () => {
  assert.match(cacheSource, /parsed\.firebaseUserId !== currentUser\.uid/);
  assert.match(cacheSource, /parsed\.firebaseSessionKey !== currentSessionKey/);
  assert.match(cacheSource, /age < 0 \|\| age > MAX_CACHE_AGE_MS/);
  assert.match(cacheSource, /Date\.parse\(entry\.access\.resetAt\) <= Date\.now\(\)/);
  assert.match(cacheSource, /premium\.expiresAt[\s\S]*Date\.parse/);
  assert.match(commercialSource, /const access = \(await callable\(\{ installationToken \}\)\)\.data;[\s\S]*activeSessionKey !== requestedSessionKey[\s\S]*writeCachedCommercialAccess\(access, requestedSessionKey\)/);
  assert.match(commercialSource, /preflightAnalysisAccess[\s\S]*let access = await getCommercialAccess\(\)/);
  assert.match(deletionSource, /clearCachedCommercialAccess\(\)/);
});

test('notebook warming is independent from commercial network refresh and still subscribes live', () => {
  assert.match(commercialContextSource, /prewarmFavoriteLessonsCache\(\)/);
  const prewarmAt = commercialContextSource.indexOf('void prewarmFavoriteLessonsCache()');
  const prepareAt = commercialContextSource.indexOf('prepareCommercialServices()');
  assert.ok(prewarmAt >= 0 && prepareAt >= 0 && prewarmAt < prepareAt);
  assert.match(lessonsSource, /export function prewarmFavoriteLessonsCache/);
  assert.match(lessonsSource, /subscribeToFavoriteLessons\(/);
  assert.match(lessonsSource, /setTimeout\(finish, 3_500\)/);
});

test('notebook cache is bound to the active Firebase identity and ignores stale snapshots', () => {
  assert.match(lessonsSource, /favoriteLessonsCacheSessionKey/);
  assert.match(lessonsSource, /currentSessionKey === favoriteLessonsCacheSessionKey/);
  assert.match(lessonsSource, /favoriteLessonsCacheSessionKey = null/);
  assert.match(lessonsSource, /const sessionKey = firebaseUserSessionKey\(user\)/);
  assert.match(lessonsSource, /firebaseUserSessionKey\(getAuth\(getApp\(\)\)\.currentUser\) !== sessionKey/);
  assert.match(lessonsSource, /favoriteLessonsCacheSessionKey = sessionKey/);
});

test('commercial refresh has one owner, a staleness policy and identity-race protection', () => {
  assert.match(commercialContextSource, /identityGeneration\.current \+= 1/);
  assert.match(commercialContextSource, /identityTransitionActive\.current/);
  assert.match(commercialContextSource, /activeRequest\?\.generation === generation/);
  assert.match(commercialContextSource, /isCurrentCommercialRefreshGeneration\(generation, identityGeneration\.current\)/);
  assert.match(commercialContextSource, /shouldAutomaticallyRefreshCommercialAccess\(\{/);
  assert.match(commercialContextSource, /INITIAL_ACCESS_DEADLINE_MS = 4_500/);
  assert.match(commercialContextSource, /const \[startupReady, setStartupReady\] = useState\(false\)/);
  assert.match(commercialContextSource, /startupReady/);
  assert.match(homeSource, /refreshIfStale: refreshCommercialAccessIfStale/);
  assert.match(homeSource, /refresh: refreshCommercialAccess/);
  assert.doesNotMatch(homeSource, /getCommercialAccess\(/);
  assert.match(paywallSource, /const next = await connectGoogle\(\)/);
  assert.doesNotMatch(paywallSource, /connectGoogle\(\)[\s\S]{0,180}await refresh\(\)/);
  assert.doesNotMatch(paywallSource, /purchasePremium\(plan\)[\s\S]{0,180}await refresh\(\)/);
  assert.doesNotMatch(paywallSource, /restorePremium\(\)[\s\S]{0,180}await refresh\(\)/);
});

test('Home reserves a stable allowance slot and never exposes an internal verification label', () => {
  assert.doesNotMatch(homeSource, /commercialLoading \? 'Verific/);
  assert.doesNotMatch(homeSource, />Verific…</);
  assert.match(homeSource, /allowancePresentation\(access, commercialStatus\)/);
  assert.match(homeSource, /allowancePill: \{ width: 88/);
  assert.match(homeSource, /if \(allowance\.canRetry\) void refreshCommercialAccess\(\)/);
});

test('auth session cache identity changes when an anonymous account is linked in place', () => {
  const anonymous = authSessionIdentityKey({
    uid: 'same-firebase-uid',
    isAnonymous: true,
    providerData: [],
  });
  const google = authSessionIdentityKey({
    uid: 'same-firebase-uid',
    isAnonymous: false,
    providerData: [{ providerId: 'google.com' }],
  });
  assert.notEqual(anonymous, google);
  assert.equal(anonymous, 'same-firebase-uid|anonymous|');
  assert.equal(google, 'same-firebase-uid|identified|google.com');
  assert.equal(authSessionIdentityKey(null), null);
});

test('auth session identity is stable regardless of provider ordering', () => {
  const first = authSessionIdentityKey({
    uid: 'account-uid',
    isAnonymous: false,
    providerData: [{ providerId: 'password' }, { providerId: 'google.com' }],
  });
  const second = authSessionIdentityKey({
    uid: 'account-uid',
    isAnonymous: false,
    providerData: [{ providerId: 'google.com' }, { providerId: 'password' }],
  });
  assert.equal(first, second);
});

test('automatic commercial refresh is stale-while-revalidate and pauses during identity changes', () => {
  const now = 1_000_000;
  assert.equal(shouldAutomaticallyRefreshCommercialAccess({
    now,
    lastSuccessfulRefreshAt: 0,
    identityTransitionActive: false,
  }), true);
  assert.equal(shouldAutomaticallyRefreshCommercialAccess({
    now,
    lastSuccessfulRefreshAt: now - AUTOMATIC_COMMERCIAL_REFRESH_INTERVAL_MS + 1,
    identityTransitionActive: false,
  }), false);
  assert.equal(shouldAutomaticallyRefreshCommercialAccess({
    now,
    lastSuccessfulRefreshAt: now - AUTOMATIC_COMMERCIAL_REFRESH_INTERVAL_MS,
    identityTransitionActive: false,
  }), true);
  assert.equal(shouldAutomaticallyRefreshCommercialAccess({
    now,
    lastSuccessfulRefreshAt: 0,
    identityTransitionActive: true,
  }), false);
  assert.equal(isCurrentCommercialRefreshGeneration(4, 4), true);
  assert.equal(isCurrentCommercialRefreshGeneration(4, 5), false);
});
