import { BalsamiqSans_700Bold } from '@expo-google-fonts/balsamiq-sans/700Bold';
import { FiraSans_400Regular } from '@expo-google-fonts/fira-sans/400Regular';
import { FiraSans_500Medium } from '@expo-google-fonts/fira-sans/500Medium';
import { FiraSans_600SemiBold } from '@expo-google-fonts/fira-sans/600SemiBold';
import { Asset } from 'expo-asset';
import type { MathDocumentFonts } from '../utils/mathDocument';
import { withDeadline } from '../../../shared/utils/latestTask';

let cachedFonts: MathDocumentFonts | undefined;
let pending: Promise<MathDocumentFonts> | undefined;

export const getCachedDocumentFonts = () => cachedFonts;

/**
 * Resolves each bundled font to its local file:// URI cached by expo-asset.
 * Keeping file:// references instead of inlining ~2.3MB of base64 TTF data
 * shrinks every WebView HTML payload by >200x and eliminates UI-thread stalls.
 */
async function resolveLocalFontUri(moduleId: number): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  return asset.localUri ?? asset.uri;
}

export function preloadDocumentFonts(): Promise<MathDocumentFonts> {
  if (cachedFonts) return Promise.resolve(cachedFonts);
  pending ??= withDeadline(Promise.all([
    resolveLocalFontUri(FiraSans_400Regular),
    resolveLocalFontUri(FiraSans_500Medium),
    resolveLocalFontUri(FiraSans_600SemiBold),
    resolveLocalFontUri(BalsamiqSans_700Bold),
  ]).then(([bodyRegular, bodyMedium, bodySemibold, display]) => {
    cachedFonts = { bodyRegular, bodyMedium, bodySemibold, display };
    return cachedFonts;
  }), 8_000, 'Document fonts timed out.').catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
