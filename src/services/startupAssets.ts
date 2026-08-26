import { Asset } from 'expo-asset';
import { iconAssets } from '../components/AppIcon';

const criticalAssetModules = [
  require('../../assets/brand/splash-mark-v2.png'),
  require('../../assets/brand/profu-mark-v2.png'),
  require('../../assets/profu-mascot-v2.png'),
  iconAssets.camera,
  iconAssets.explain,
  iconAssets.gallery,
  iconAssets.notebook,
  iconAssets.scan,
  iconAssets.settings,
  iconAssets.verify,
];

let criticalAssetsPromise: Promise<void> | null = null;

/**
 * Warms only the artwork needed by the splash and first Home frame. Other
 * screens keep their assets lazy so startup does not trade a flash for excess
 * decoding and memory pressure.
 */
export function preloadCriticalAppAssets(): Promise<void> {
  if (criticalAssetsPromise) return criticalAssetsPromise;
  criticalAssetsPromise = Asset.loadAsync(criticalAssetModules)
    .then(() => undefined)
    .catch((error) => {
      criticalAssetsPromise = null;
      throw error;
    });
  return criticalAssetsPromise;
}
