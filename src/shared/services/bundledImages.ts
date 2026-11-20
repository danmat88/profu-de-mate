import { Asset } from 'expo-asset';
import { Image, type ImageSourcePropType } from 'react-native';

const sources = new Map<number, ImageSourcePropType>();
const preparation = new Map<number, Promise<void>>();

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
