import { BalsamiqSans_700Bold } from '@expo-google-fonts/balsamiq-sans/700Bold';
import { FiraSans_400Regular } from '@expo-google-fonts/fira-sans/400Regular';
import { FiraSans_600SemiBold } from '@expo-google-fonts/fira-sans/600SemiBold';
import { Asset } from 'expo-asset';
import type { MathDocumentFonts } from '../utils/mathDocument';
import { withDeadline } from '../../../shared/utils/latestTask';

let cachedFonts: MathDocumentFonts | undefined;
let pending: Promise<MathDocumentFonts> | undefined;

export const getCachedDocumentFonts = () => cachedFonts;

async function resolveAsset(moduleId: number) {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  return asset.localUri ?? asset.uri;
}

export function preloadDocumentFonts(): Promise<MathDocumentFonts> {
  if (cachedFonts) return Promise.resolve(cachedFonts);
  pending ??= withDeadline(Promise.all([
    resolveAsset(FiraSans_400Regular), resolveAsset(FiraSans_600SemiBold), resolveAsset(BalsamiqSans_700Bold),
  ]).then(([bodyRegular, bodySemibold, display]) => {
    cachedFonts = { bodyRegular, bodySemibold, display };
    return cachedFonts;
  }), 3_000, 'Document fonts timed out.').catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
