import { BalsamiqSans_400Regular } from '@expo-google-fonts/balsamiq-sans/400Regular';
import { BalsamiqSans_700Bold } from '@expo-google-fonts/balsamiq-sans/700Bold';
import { FiraSans_400Regular } from '@expo-google-fonts/fira-sans/400Regular';
import { FiraSans_500Medium } from '@expo-google-fonts/fira-sans/500Medium';
import { FiraSans_600SemiBold } from '@expo-google-fonts/fira-sans/600SemiBold';
import { loadAsync } from 'expo-font';
import { iconAssets } from '../../shared/ui/AppIcon';
import { mascotAssets } from '../../shared/ui/Mascot';
import { controlAssets } from '../../shared/ui/MiniGlyph';
import { prepareBundledImages } from '../../shared/services/bundledImages';
import { preloadDocumentFonts } from '../../features/math/services/documentFonts';

const criticalAssetModules = [
  require('../../../assets/brand/splash_mark_v2.png'),
  require('../../../assets/brand/profu_mark_v2.png'),
  require('../../../assets/brand/wordmark_v2.png'),
  require('../../../assets/profu_mascot_v2.png'),
  ...Object.values(mascotAssets),
  ...Object.values(iconAssets),
  ...Object.values(controlAssets),
];

const UI_FONTS = {
  BalsamiqSans_400Regular,
  BalsamiqSans_700Bold,
  FiraSans_400Regular,
  FiraSans_500Medium,
  FiraSans_600SemiBold,
};

let splashFontsPromise: Promise<void> | null = null;
let criticalAssetsPromise: Promise<void> | null = null;

/**
 * Fast-path UI typeface preload so LaunchSplash hands off from the native
 * Android splash almost immediately instead of sitting on empty solid purple
 * while secondary screen icons and lesson document fonts decode in parallel.
 */
export function preloadSplashFonts(): Promise<void> {
  if (splashFontsPromise) return splashFontsPromise;
  splashFontsPromise = loadAsync(UI_FONTS)
    .then(() => undefined)
    .catch((error) => {
      splashFontsPromise = null;
      throw error;
    });
  return splashFontsPromise;
}

/**
 * All shared icons, mascot poses, branding, UI fonts and document fonts are
 * prerequisites. Failure is reported to the launch boundary; it never becomes
 * partial UI.
 */
export function preloadCriticalAppAssets(): Promise<void> {
  if (criticalAssetsPromise) return criticalAssetsPromise;
  criticalAssetsPromise = Promise.all([
    prepareBundledImages(criticalAssetModules),
    preloadSplashFonts(),
    preloadDocumentFonts(),
  ])
    .then(() => undefined)
    .catch((error) => {
      criticalAssetsPromise = null;
      throw error;
    });
  return criticalAssetsPromise;
}
