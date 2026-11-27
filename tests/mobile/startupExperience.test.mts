import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { authSessionIdentityKey } from '../../src/shared/services/authSessionIdentity.ts';
import {
  AUTOMATIC_COMMERCIAL_REFRESH_INTERVAL_MS,
  isCurrentCommercialRefreshGeneration,
  shouldAutomaticallyRefreshCommercialAccess,
} from '../../src/features/access/services/commercialRefreshPolicy.ts';
import { resolveSplashMood } from '../../src/app/utils/splashMood.ts';

const appSource = await readFile(new URL('../../src/app/App.tsx', import.meta.url), 'utf8');
const splashSource = await readFile(new URL('../../src/app/components/LaunchSplash.tsx', import.meta.url), 'utf8');
const assetsSource = await readFile(new URL('../../src/app/services/startupAssets.ts', import.meta.url), 'utf8');
const cacheSource = await readFile(new URL('../../src/features/access/services/commercialAccessCache.ts', import.meta.url), 'utf8');
const commercialSource = await readFile(new URL('../../src/features/access/services/commercial.ts', import.meta.url), 'utf8');
const commercialContextSource = await readFile(new URL('../../src/features/access/context/CommercialContext.tsx', import.meta.url), 'utf8');
const lessonsSource = await readFile(new URL('../../src/features/lessons/services/lessons.ts', import.meta.url), 'utf8');
const deletionSource = await readFile(new URL('../../src/features/account/services/dataManagement.ts', import.meta.url), 'utf8');
const homeSource = await readFile(new URL('../../src/features/home/screens/HomeScreen.tsx', import.meta.url), 'utf8');
const homeSurfaceSource = await readFile(new URL('../../src/features/home/components/HomeSurface.tsx', import.meta.url), 'utf8');
const paywallSource = await readFile(new URL('../../src/features/access/screens/PaywallScreen.tsx', import.meta.url), 'utf8');
const premiumSurfaceSource = await readFile(new URL('../../src/features/access/components/PremiumSurface.tsx', import.meta.url), 'utf8');
const settingsSource = await readFile(new URL('../../src/features/account/screens/SettingsScreen.tsx', import.meta.url), 'utf8');
const legalSource = await readFile(new URL('../../src/features/account/screens/LegalScreen.tsx', import.meta.url), 'utf8');
const mathInputSource = await readFile(new URL('../../src/features/math/screens/MathInputScreen.tsx', import.meta.url), 'utf8');
const mathEditorSource = await readFile(new URL('../../src/features/math/components/MathEditor.tsx', import.meta.url), 'utf8');
const notebookSource = await readFile(new URL('../../src/features/lessons/screens/NotebookScreen.tsx', import.meta.url), 'utf8');
const pressableScaleSource = await readFile(new URL('../../src/shared/ui/PressableScale.tsx', import.meta.url), 'utf8');
const screenHeaderSource = await readFile(new URL('../../src/shared/ui/ScreenHeader.tsx', import.meta.url), 'utf8');
const comicTabBarSource = await readFile(new URL('../../src/shared/ui/ComicTabBar.tsx', import.meta.url), 'utf8');
const comicSwitchSource = await readFile(new URL('../../src/shared/ui/ComicSwitch.tsx', import.meta.url), 'utf8');
const mascotSource = await readFile(new URL('../../src/shared/ui/Mascot.tsx', import.meta.url), 'utf8');
const quotaTimerSource = await readFile(new URL('../../src/features/access/components/QuotaResetTimer.tsx', import.meta.url), 'utf8');
const tabPanelSource = await readFile(new URL('../../src/shared/ui/TabPanel.tsx', import.meta.url), 'utf8');
const enterSource = await readFile(new URL('../../src/shared/ui/Enter.tsx', import.meta.url), 'utf8');
const speechBubbleSource = await readFile(new URL('../../src/shared/ui/SpeechBubble.tsx', import.meta.url), 'utf8');
const confettiSource = await readFile(new URL('../../src/shared/ui/ConfettiBurst.tsx', import.meta.url), 'utf8');
const analysisActivitySource = await readFile(new URL('../../src/features/analysis/components/AnalysisActivity.tsx', import.meta.url), 'utf8');
const transitionSettledSource = await readFile(new URL('../../src/shared/hooks/useTransitionSettled.ts', import.meta.url), 'utf8');
const lessonSource = await readFile(new URL('../../src/features/lessons/screens/LessonScreen.tsx', import.meta.url), 'utf8');
const summarySource = await readFile(new URL('../../src/features/lessons/screens/SummaryScreen.tsx', import.meta.url), 'utf8');
const progressDotsSource = await readFile(new URL('../../src/shared/ui/ProgressDots.tsx', import.meta.url), 'utf8');
const playfulLoaderSource = await readFile(new URL('../../src/shared/ui/PlayfulLoader.tsx', import.meta.url), 'utf8');
const mathDocumentViewSource = await readFile(new URL('../../src/features/math/components/MathDocumentView.tsx', import.meta.url), 'utf8');
const mathDocumentHtmlSource = await readFile(new URL('../../src/features/math/utils/mathDocument.ts', import.meta.url), 'utf8');

test('navigation receives verified launch data, waits for splash intro to settle, and stays covered until ready', () => {
  assert.match(appSource, /startup && \(splashIntroDone \|\| reducedMotion\) \? <CommercialProvider initialAccess=\{startup\.initialAccess\} initialVerifiedAt=\{startup\.verifiedAt\}/);
  assert.match(appSource, /onReady=\{markNavigationReady\}/);
  assert.match(appSource, /<LaunchSplash ready=\{Boolean\(startup\) && navigationReady\} visualsReady=\{visualsReady\}[\s\S]*onIntroSettled=\{markSplashIntroDone\}/);
  assert.match(appSource, /if \(failure && !startup\)/);
  assert.doesNotMatch(appSource, /settleStartupTask|readCachedCommercialAccess/);
});

test('launch preparation includes all shared icons and branding', () => {
  for (const asset of ['splash_mark_v2', 'profu_mark_v2', 'profu_mascot_v2']) {
    assert.match(assetsSource, new RegExp(asset));
  }
  assert.match(assetsSource, /Object\.values\(iconAssets\)/);
  assert.match(assetsSource, /prepareBundledImages\(criticalAssetModules\)/);
});

test('React splash restores the Royal-Violet curtain studio with true SVG radial light and a bounded morph handoff', () => {
  assert.doesNotMatch(splashSource, /imageFallback/);
  assert.doesNotMatch(splashSource, /react-native-reanimated/);
  assert.match(splashSource, /if \(!sceneReady \|\| !imageReady \|\| !visualsReady\) return/);
  assert.match(splashSource, /if \(!ready \|\| !introComplete \|\| !nativeSplashHidden\) return/);
  assert.match(splashSource, /const hardDeadline = setTimeout\(finishOnce, 2_500\)/);
  assert.match(splashSource, /assets\/brand\/splash_mark_v2\.png/);
  assert.match(splashSource, /backgroundColor: colors\.splashRoyal/);
  assert.match(splashSource, /gradientReveal/);
  assert.match(splashSource, /gridReveal/);
  assert.match(splashSource, /lightReveal/);
  assert.match(splashSource, /RadialGradient/);
  assert.match(splashSource, /translateX: ribbonFill\.interpolate\(/);
  assert.match(splashSource, /curtainRetractY/);
  assert.doesNotMatch(splashSource, /Animated\.loop\(\s*Animated\.sequence/);
  assert.doesNotMatch(splashSource, /setBarWidth|displayPercent/);
  assert.match(splashSource, /useNativeDriver: true/);
  assert.match(splashSource, /notifyIntroSettledOnce\(\)/);
  assert.match(splashSource, /notifyRevealOnce\(\)/);
  assert.equal(resolveSplashMood(8, 0).period, 'morning');
  assert.equal(resolveSplashMood(14, 1).period, 'day');
  assert.equal(resolveSplashMood(21, 2).period, 'evening');
  assert.notEqual(resolveSplashMood(14, 0).formula, resolveSplashMood(14, 1).formula);
});

test('native splash hands off only after the branded scene and image are painted', () => {
  assert.match(appSource, /SplashScreen\.setOptions\(\{ duration: 0, fade: false \}\)/);
  assert.match(splashSource, /const \[sceneReady, setSceneReady\] = useState\(false\)/);
  assert.match(splashSource, /onLayout=\{handleSceneLayout\}/);
  assert.match(splashSource, /if \(!sceneReady \|\| !imageReady \|\| !visualsReady\) return/);
  assert.match(splashSource, /SplashScreen\.hideAsync\(\)/);
  assert.match(splashSource, /Animated\.timing\(curtainExit,/);
});

test('Home fills the safe-area viewport without a scrolling container', () => {
  assert.doesNotMatch(homeSurfaceSource, /ScrollView/);
  assert.match(homeSurfaceSource, /page: \{ flex: 1, minHeight: 0/);
  assert.match(homeSurfaceSource, /cameraStageShadow: \{ flex: 1, minHeight: 0/);
  assert.match(homeSurfaceSource, /paddingBottom: 8/);
  assert.match(homeSurfaceSource, /<ComicBackdrop \/>[\s\S]*<View style=\{styles\.homeScene\}>/);
});

test('cached access is uid-bound, expiring and display-only', () => {
  assert.match(cacheSource, /parsed\.firebaseUserId !== currentUser\.uid/);
  assert.match(cacheSource, /parsed\.firebaseSessionKey !== currentSessionKey/);
  assert.match(cacheSource, /age < 0 \|\| age > MAX_CACHE_AGE_MS/);
  assert.match(cacheSource, /Date\.parse\(entry\.access\.resetAt\) <= Date\.now\(\)/);
  assert.match(cacheSource, /premium\.expiresAt[\s\S]*Date\.parse/);
  assert.match(commercialSource, /access = \(await callable\(\{ installationToken \}\)\)\.data;[\s\S]*activeSessionKey !== requestedSessionKey[\s\S]*writeCachedCommercialAccess\(access, requestedSessionKey\)/);
  assert.match(commercialSource, /preflightAnalysisAccess[\s\S]*let access = await getCommercialAccess\(\)/);
  assert.match(deletionSource, /clearCachedCommercialAccess\(\)/);
});

test('notebook warming is independent from commercial network refresh and still subscribes live', () => {
  assert.match(commercialContextSource, /prewarmFavoriteLessonsCache\(\)/);
  assert.match(commercialContextSource, /useEffect\(\(\) => \{[^}]*prewarmFavoriteLessonsCache\(\)[\s\S]*?\}, \[authSessionKey\]\)/);
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
  assert.doesNotMatch(commercialContextSource, /INITIAL_ACCESS_DEADLINE_MS/);
  assert.match(commercialContextSource, /lastSuccessfulRefreshAt = useRef\(initialAccess \? initialVerifiedAt : 0\)/);
  assert.match(commercialContextSource, /startupReady/);
  assert.match(homeSource, /refreshIfStale: refreshCommercialAccessIfStale/);
  assert.doesNotMatch(homeSource, /getCommercialAccess\(/);
  assert.match(paywallSource, /await connectGoogle\(\)/);
  assert.doesNotMatch(paywallSource, /connectGoogle\(\)[\s\S]{0,180}await refresh\(\)/);
  assert.doesNotMatch(paywallSource, /purchasePremium\(plan\)[\s\S]{0,180}await refresh\(\)/);
  assert.doesNotMatch(paywallSource, /restorePremium\(\)[\s\S]{0,180}await refresh\(\)/);
});

test('Home reserves a stable allowance slot and never exposes an internal verification label', () => {
  assert.doesNotMatch(homeSource, /commercialLoading \? 'Verific/);
  assert.doesNotMatch(homeSource, />Verific…</);
  assert.match(homeSource, /if \(!access\)[\s\S]*return <ReadinessScreen[\s\S]*allowancePresentation\(access\)/);
  assert.match(homeSource, /navigation\.navigate\('Paywall', \{ source: 'home'/);
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

test('Settings, Paywall and Legal apply synchronous top insets, render complete on Frame 0, and lock cleanly without ugly dimming', () => {
  for (const source of [settingsSource, premiumSurfaceSource, legalSource, notebookSource]) {
    assert.doesNotMatch(source, /<SafeAreaView/);
    assert.match(source, /paddingTop: insets\.top \?\? 0/);
    assert.doesNotMatch(source, /<Enter[\s>]/);
    assert.doesNotMatch(source, /contentReady/);
  }
  assert.doesNotMatch(settingsSource, /sectionLocked/);
  assert.doesNotMatch(premiumSurfaceSource, /contentLocked/);
  assert.doesNotMatch(settingsSource, /react-native-reanimated/);
  assert.doesNotMatch(premiumSurfaceSource, /react-native-reanimated/);
  assert.match(settingsSource, /styles\.busyPill/);
  assert.match(settingsSource, /removeClippedSubviews=\{false\}/);
  assert.match(settingsSource, /backDisabled=\{accountBusy\}/);
  assert.match(settingsSource, /scrollEnabled=\{!accountBusy\}/);
  assert.match(settingsSource, /BackHandler\.addEventListener\('hardwareBackPress'/);
  assert.match(settingsSource, /navigation\.addListener\('beforeRemove'/);
  assert.match(settingsSource, /style=\{styles\.lockOverlay\}/);
  assert.match(settingsSource, /finally \{\s*logoutLocked\.current = false;\s*setDisconnectingGoogle\(false\);/);
  assert.match(settingsSource, /finally \{\s*deletionLocked\.current = false;\s*setDeleting\(false\);/);
  assert.match(paywallSource, /identityTransitionBusy/);
  assert.match(paywallSource, /beforeRemove/);
  assert.match(premiumSurfaceSource, /style=\{styles\.lockOverlay\}/);
  assert.match(premiumSurfaceSource, /styles\.busyPill/);
  assert.match(enterSource, /progress\.stopAnimation\(\)/);
  assert.match(enterSource, /clearTimeout\(watchdog\)/);
  assert.doesNotMatch(enterSource, /react-native-reanimated/);
  assert.match(homeSource, /showGuide=\{!guideDismissed\}/);
  assert.match(homeSource, /setGalleryBusy\(false\)/);
  assert.doesNotMatch(notebookSource, /navigation\.preload\('Lesson'/);
  assert.match(notebookSource, /beginAppTransition\(\)/);
  assert.match(lessonSource, /const mountMathDocument = !isFromNotebook \|\| transitionSettled;/);
  assert.match(summarySource, /\{transitionSettled \? \(\s*<MathDocumentView/);
});

test('taps rebound crisply, full screens mount with minimal worklets, and living animations wake on transitionEnd', () => {
  assert.match(appSource, /const NAVIGATION_THEME = \{/);
  assert.match(appSource, /enableFreeze\(true\)/);
  assert.match(appSource, /freezeOnBlur: true/);
  assert.match(appSource, /function SystemBarChrome\(/);
  assert.match(appSource, /<TransitionMotionProvider>/);
  assert.match(appSource, /transitionStart:\s*\(\)\s*=>\s*\{[\s\S]*beginAppTransition\(\)/);
  assert.match(appSource, /transitionEnd:\s*\(\)\s*=>\s*\{[\s\S]*endAppTransition\(\)/);
  assert.doesNotMatch(appSource, /useTransitionMotion\(/);
  assert.doesNotMatch(appSource, /setActiveRoute/);

  assert.match(pressableScaleSource, /deferPressMs = 0/);
  assert.doesNotMatch(pressableScaleSource, /react-native-reanimated/);
  assert.doesNotMatch(homeSurfaceSource, /react-native-reanimated/);
  assert.doesNotMatch(homeSurfaceSource, /Animated\.loop\(\s*Animated\.sequence/);
  assert.match(homeSurfaceSource, /COS_PING_PONG/);
  assert.doesNotMatch(homeSurfaceSource, /deferPressMs=/);
  assert.doesNotMatch(homeSurfaceSource, /useIsFocused/);
  assert.match(homeSource, /focused=\{homeFocused\}/);
  assert.doesNotMatch(homeSource, /useTransitionMotion\(/);
  assert.doesNotMatch(screenHeaderSource, /deferPressMs=/);
  assert.doesNotMatch(screenHeaderSource, /useTransitionMotion\(/);
  assert.match(screenHeaderSource, /styles\.rightBadge/);
  assert.doesNotMatch(premiumSurfaceSource, /deferPressMs=/);
  assert.doesNotMatch(mathInputSource, /deferPressMs=/);

  assert.doesNotMatch(comicTabBarSource, /react-native-reanimated/);
  assert.doesNotMatch(comicSwitchSource, /react-native-reanimated/);
  assert.doesNotMatch(quotaTimerSource, /react-native-reanimated/);
  assert.doesNotMatch(tabPanelSource, /react-native-reanimated/);
  assert.doesNotMatch(speechBubbleSource, /react-native-reanimated/);
  assert.doesNotMatch(confettiSource, /react-native-reanimated/);
  assert.doesNotMatch(analysisActivitySource, /react-native-reanimated/);
  assert.match(transitionSettledSource, /useTransitionMotion\(focused && !reducedMotion\)/);
  assert.match(tabPanelSource, /if \(reducedMotion \|\| direction === 0\) \{\s*return <View style=\{style\}>\{children\}<\/View>;/);
  assert.doesNotMatch(mascotSource, /react-native-reanimated/);
  assert.match(mascotSource, /const justActivated = active && !previousActive\.current/);

  assert.match(notebookSource, /useTransitionSettled\(navigation, reducedMotion\)/);
  assert.match(notebookSource, /if \(initialWarmCache && !transitionSettled\) return undefined;/);
  assert.match(notebookSource, /styles\.lessonRowWrap/);
  assert.match(notebookSource, /visibleNotes\.slice\(0, 3\)/);
  assert.match(notebookSource, /function StaggerCardSlot\(/);
  assert.match(notebookSource, /const mountSearchInput = transitionSettled \|\| searchActivated/);
  assert.doesNotMatch(notebookSource, /<TabPanel\s+key=\{filter\}/);
  assert.doesNotMatch(notebookSource, /toLocaleTimeString|toLocaleDateString/);
  assert.match(notebookSource, /\{pendingRemoval \? \(\s*<RemoveFromNotebookModal/);

  assert.match(settingsSource, /useTransitionSettled\(navigation, reducedMotion\)/);
  assert.match(settingsSource, /if \(!everOpened\) return null;/);
  assert.doesNotMatch(settingsSource, /react-native-reanimated/);

  assert.match(paywallSource, /useTransitionSettled\(navigation, reducedMotion\)/);
  assert.match(paywallSource, /if \(!ambientActive\) return undefined;/);
  assert.match(paywallSource, /active=\{ambientActive\}/);
  assert.doesNotMatch(premiumSurfaceSource, /react-native-reanimated/);
  assert.doesNotMatch(premiumSurfaceSource, /useSharedValue|useAnimatedStyle/);

  assert.doesNotMatch(mathInputSource, /keypadReady/);
  assert.match(mathEditorSource, /const SimpleEditorKey = memo\(/);
  assert.match(mathEditorSource, /const RepeatEditorKey = memo\(/);
  assert.doesNotMatch(mathEditorSource, /keypadPlaceholder|<Enter[\s>]/);

  // Opening a problem from Caiet keeps Frame 0 free of WebView construction and
  // Reanimated worklet bursts, pauses animations on transitionStart, and wakes
  // animations plus WebView strictly after transitionEnd.
  assert.doesNotMatch(lessonSource, /react-native-reanimated/);
  assert.doesNotMatch(summarySource, /react-native-reanimated/);
  assert.doesNotMatch(progressDotsSource, /react-native-reanimated/);
  assert.doesNotMatch(playfulLoaderSource, /react-native-reanimated/);
  assert.doesNotMatch(mathDocumentViewSource, /react-native-reanimated/);
  assert.match(lessonSource, /useScreenMotionActive\(navigation, reducedMotion\)/);
  assert.match(summarySource, /useScreenMotionActive\(navigation, reducedMotion\)/);
  assert.match(notebookSource, /useScreenMotionActive\(navigation, reducedMotion\)/);
  assert.match(homeSource, /useScreenMotionActive\(navigation,/);
  assert.match(lessonSource, /\{removeEverOpened \? \(/);
  assert.match(lessonSource, /\{feedbackEverOpened \? \(/);
  assert.match(lessonSource, /animateInitialReveal=\{screenFocused\}/);
  assert.match(summarySource, /\{removeEverOpened \? \(/);
  assert.match(summarySource, /\{feedbackEverOpened \? \(/);
  assert.match(mathDocumentHtmlSource, /function afterPaint\(/);
});

async function walkSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkSourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  }));
  return nested.flat();
}

test('app-wide cohesion: zero JS-driven sequence loops, unified native ComicBottomSheet modals, and strict shared boundary', async () => {
  const allSrcFiles = await walkSourceFiles(path.resolve('src'));
  for (const file of allSrcFiles) {
    const source = await readFile(file, 'utf8');
    const rel = path.relative(process.cwd(), file);
    assert.doesNotMatch(
      source,
      /Animated\.loop\(\s*Animated\.sequence\(/,
      `${rel} must use createNativeLoop + WAVE_INPUT_17 instead of JS-restarted Animated.loop(Animated.sequence(...))`,
    );
  }

  const modalPaths = [
    'src/features/lessons/components/RemoveFromNotebookModal.tsx',
    'src/features/feedback/components/FeedbackSheet.tsx',
    'src/features/lessons/components/LessonRoadmapModal.tsx',
  ];
  for (const rel of modalPaths) {
    const source = await readFile(path.resolve(rel), 'utf8');
    assert.match(source, /<ComicBottomSheet/, `${rel} should reuse the unified ComicBottomSheet`);
    assert.doesNotMatch(source, /react-native-reanimated/, `${rel} should stay free of Reanimated worklets`);
  }
  assert.match(settingsSource, /<ComicBottomSheet/);

  const sharedFiles = await walkSourceFiles(path.resolve('src/shared'));
  for (const file of sharedFiles) {
    const source = await readFile(file, 'utf8');
    const rel = path.relative(process.cwd(), file);
    assert.doesNotMatch(
      source,
      /from\s+['"][^'"]*(?:\/app\/|\/features\/)/,
      `${rel} in src/shared must not import from src/app or src/features`,
    );
  }
});
