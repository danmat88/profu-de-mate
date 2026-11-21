import { Asset } from 'expo-asset';
import { Image, type ImageSourcePropType } from 'react-native';

const sources = new Map<number, ImageSourcePropType>();
const preparation = new Map<number, Promise<void>>();

/**
 * Release Android builds package bundled PNGs in `res/drawable*` and resolve
 * `Asset.fromModule()` to bare drawable resource names (no URI scheme). React
 * Native's `Image.getSize()` delegates to Fresco's `fetchEncodedImage()`, which
 * throws `Unsupported uri scheme for encoded image fetch` for `res:` / `asset:`
 * / Android embedded resource URIs.
 */
function isNativeEmbeddedResourceUri(uri: string): boolean {
  return !/^[a-z][a-z0-9+.-]*:/i.test(uri)
    || /^(?:res|asset):/i.test(uri)
    || /^file:\/\/\/android_(?:res|asset)\//i.test(uri);
}

/** Download and decode shared artwork before any app screen is revealed. */
export async function prepareBundledImages(modules: readonly number[]): Promise<void> {
  await Promise.all([...new Set(modules)].map((moduleId) => {
    if (sources.has(moduleId)) return Promise.resolve();
    const pending = preparation.get(moduleId);
    if (pending) return pending;
    const operation = (async () => {
      const asset = Asset.fromModule(moduleId);
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      if (!uri) {
        throw new Error(`Bundled image asset "${moduleId}" did not resolve to a URI.`);
      }
      if (isNativeEmbeddedResourceUri(uri)) {
        // Keep the numeric module ID so <Image> loads directly from compiled
        // native resources with its full width, height and density metadata.
        sources.set(moduleId, moduleId);
        return;
      }
      // getSize resolves through the native image pipeline, warming decoded
      // data too. Screens use the prepared URI instead of fetching it again.
      await Image.getSize(uri);
      sources.set(moduleId, { uri });
    })().finally(() => preparation.delete(moduleId));
    preparation.set(moduleId, operation);
    return operation;
  }));
}

export function bundledImageSource(moduleId: number): ImageSourcePropType {
  return sources.get(moduleId) ?? moduleId;
}
