import { BalsamiqSans_700Bold } from '@expo-google-fonts/balsamiq-sans/700Bold';
import { FiraSans_400Regular } from '@expo-google-fonts/fira-sans/400Regular';
import { FiraSans_600SemiBold } from '@expo-google-fonts/fira-sans/600SemiBold';
import { Asset } from 'expo-asset';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebView as WebViewHandle } from 'react-native-webview';
import { colors, fonts } from '../theme';
import type { MathDocumentDefinition, MathDocumentFonts } from '../utils/mathDocument';
import {
  buildMathDocumentHtml,
  buildMathDocumentMarkup,
  buildMathDocumentUpdateScript,
} from '../utils/mathDocument';
import { PlayfulLoader } from './PlayfulLoader';
import { Text } from './Typography';

type Props = {
  definition: MathDocumentDefinition;
  style?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
  testID?: string;
  onReady?: () => void;
};

let documentFontsPromise: Promise<MathDocumentFonts> | undefined;

async function resolvedAssetUri(moduleId: number) {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  return asset.localUri ?? asset.uri;
}

function loadDocumentFonts() {
  documentFontsPromise ??= Promise.all([
    resolvedAssetUri(FiraSans_400Regular),
    resolvedAssetUri(FiraSans_600SemiBold),
    resolvedAssetUri(BalsamiqSans_700Bold),
  ]).then(([bodyRegular, bodySemibold, display]) => ({ bodyRegular, bodySemibold, display }));
  return documentFontsPromise;
}

export function MathDocumentView({ definition, style, scrollEnabled = true, testID, onReady }: Props) {
  const { fontScale } = useWindowDimensions();
  const webViewRef = useRef<WebViewHandle>(null);
  const latestDefinition = useRef(definition);
  const loaded = useRef(false);
  const initialMarkup = useRef<string | undefined>(undefined);
  const revision = useRef(0);
  const [fontsReady, setFontsReady] = useState<MathDocumentFonts>();
  const [documentReady, setDocumentReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);

  latestDefinition.current = definition;

  useEffect(() => {
    let active = true;
    loadDocumentFonts()
      .then((resolved) => { if (active) setFontsReady(resolved); })
      .catch(() => { if (active) setFontsReady({}); });
    return () => { active = false; };
  }, []);

  const markup = useMemo(() => buildMathDocumentMarkup(definition), [definition]);

  if (fontsReady && initialMarkup.current === undefined) initialMarkup.current = markup;

  const source = useMemo(() => fontsReady
    ? { html: buildMathDocumentHtml(definition, fontsReady, initialMarkup.current ?? markup), baseUrl: 'about:blank' }
    : undefined,
  // The first document becomes the immutable WebView shell. Later definitions
  // are injected into the existing DOM so the native view never remounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [fontsReady, markup, webViewKey]);

  useEffect(() => {
    if (!loaded.current || !fontsReady || failed) return;
    revision.current += 1;
    webViewRef.current?.injectJavaScript(buildMathDocumentUpdateScript(definition, String(revision.current)));
  }, [definition, failed, fontsReady, markup]);

  const retry = () => {
    loaded.current = false;
    initialMarkup.current = undefined;
    setFailed(false);
    setDocumentReady(false);
    setWebViewKey((value) => value + 1);
  };

  if (!fontsReady || !source) {
    return (
      <View style={[styles.frame, styles.loading, style]}>
        <PlayfulLoader compact label="Așez matematica în pagină" />
      </View>
    );
  }

  if (failed) {
    return (
      <View accessibilityRole="alert" style={[styles.frame, styles.error, style]}>
        <Text style={styles.errorTitle}>Documentul nu s-a afișat.</Text>
        <Text style={styles.errorText}>Reîncarcă această pagină; lecția rămâne salvată.</Text>
        <Pressable accessibilityRole="button" onPress={retry} style={styles.retryButton}>
          <Text style={styles.retryText}>Reîncarcă</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.frame, style]} testID={testID}>
      <WebView
        key={webViewKey}
        ref={webViewRef}
        source={source}
        originWhitelist={['about:blank', 'file://*', 'data:*']}
        javaScriptEnabled
        javaScriptCanOpenWindowsAutomatically={false}
        domStorageEnabled={false}
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
        cacheEnabled
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never"
        setSupportMultipleWindows={false}
        bounces={false}
        overScrollMode="never"
        nestedScrollEnabled={false}
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        textZoom={Math.round(Math.min(2, Math.max(1, fontScale)) * 100)}
        onShouldStartLoadWithRequest={(request) => request.url === 'about:blank' || request.url.startsWith('data:text/html')}
        onLoadEnd={() => {
          loaded.current = true;
          if (initialMarkup.current !== buildMathDocumentMarkup(latestDefinition.current)) {
            revision.current += 1;
            webViewRef.current?.injectJavaScript(buildMathDocumentUpdateScript(latestDefinition.current, String(revision.current)));
          }
        }}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data) as { type?: unknown };
            if (message.type === 'document-ready') {
              setDocumentReady(true);
              onReady?.();
            }
          } catch {
            // The document bridge accepts only the tiny JSON readiness message.
          }
        }}
        onError={() => setFailed(true)}
        onRenderProcessGone={() => {
          setFailed(true);
          return true;
        }}
        style={[styles.webView, !documentReady && styles.webViewLoading]}
        containerStyle={styles.webViewContainer}
      />
      {!documentReady ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <PlayfulLoader compact label="Așez matematica în pagină" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: 120, overflow: 'hidden', backgroundColor: 'transparent' },
  webViewContainer: { backgroundColor: 'transparent' },
  webView: { flex: 1, backgroundColor: 'transparent', opacity: 1 },
  webViewLoading: { opacity: 0 },
  loading: { alignItems: 'center', justifyContent: 'center', padding: 18 },
  loadingOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', padding: 18 },
  error: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 19, textAlign: 'center' },
  errorText: { marginTop: 4, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  retryButton: { minHeight: 48, marginTop: 14, borderRadius: 14, backgroundColor: colors.violet, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 13 },
});
