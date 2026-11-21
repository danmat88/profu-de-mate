import { BalsamiqSans_400Regular } from '@expo-google-fonts/balsamiq-sans/400Regular';
import { BalsamiqSans_700Bold } from '@expo-google-fonts/balsamiq-sans/700Bold';
import { FiraSans_400Regular } from '@expo-google-fonts/fira-sans/400Regular';
import { FiraSans_500Medium } from '@expo-google-fonts/fira-sans/500Medium';
import { FiraSans_600SemiBold } from '@expo-google-fonts/fira-sans/600SemiBold';
import { loadAsync } from 'expo-font';
import { iconAssets } from '../../shared/ui/AppIcon';
import { mascotAssets } from '../../shared/ui/Mascot';
import { prepareBundledImages } from '../../shared/services/bundledImages';
import { preloadDocumentFonts } from '../../features/math/services/documentFonts';

const criticalAssetModules = [
  require('../../../assets/brand/splash_mark_v2.png'),
  require('../../../assets/brand/profu_mark_v2.png'),
  require('../../../assets/profu_mascot_v2.png'),
  ...Object.values(mascotAssets),
  ...Object.values(iconAssets),
];

let criticalAssetsPromise: Promise<void> | null = null;

/**
 * All shared icons, mascot poses, branding, UI fonts and document fonts are
 * prerequisites. Failure is reported to the launch boundary; it never becomes
 * partial UI.
 */
export function preloadCriticalAppAssets(): Promise<void> {
  if (criticalAssetsPromise) return criticalAssetsPromise;
  criticalAssetsPromise = Promise.all([
    prepareBundledImages(criticalAssetModules),
    loadAsync({ BalsamiqSans_400Regular, BalsamiqSans_700Bold, FiraSans_400Regular, FiraSans_500Medium, FiraSans_600SemiBold }),
    preloadDocumentFonts(),
  ])
    .then(() => undefined)
    .catch((error) => {
      criticalAssetsPromise = null;
      throw error;
    });
  return criticalAssetsPromise;
}
