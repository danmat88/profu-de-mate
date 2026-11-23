import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebView as WebViewHandle } from 'react-native-webview';
import { useDelayedBusy } from '../../../shared/hooks/useDelayedBusy';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { colors, fonts } from '../../../shared/theme';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { Text } from '../../../shared/ui/Typography';
import { getCachedDocumentFonts, preloadDocumentFonts } from '../services/documentFonts';
import type { MathDocumentDefinition, MathDocumentFonts } from '../utils/mathDocument';
import {
  buildMathDocumentHtml,
  buildMathDocumentMarkup,
  buildMathDocumentUpdateScript,
} from '../utils/mathDocument';
import { mathDocumentFallbackText } from '../utils/mathDocumentFallback';

type Props = {
  definition: MathDocumentDefinition;
  /** Optional slide direction when swapping document content (-1 = from left, 1 = from right). */
  transitionDirection?: -1 | 0 | 1;
  /**
   * True when the host screen is already visible on screen. Keeps preloaded
   * off-screen paints instant so the slide-in arrives fully painted on Frame 0,
   * while late post-slide arrivals glide in smoothly instead of snapping.
   */
  animateInitialReveal?: boolean;
  style?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
  testID?: string;
  onReady?: () => void;
};

/**
 * Local math WebView powered by native-driver Animated transforms (zero
 * Reanimated worklet mount cost) for crisp step turns and smooth lesson opens.
 */
export function MathDocumentView({
  definition,
  transitionDirection = 0,
  animateInitialReveal = true,
  style,
  scrollEnabled = true,
  testID,
  onReady,
}: Props) {
  const { fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const webViewRef = useRef<WebViewHandle>(null);
  const latestDefinition = useRef(definition);
  const animateInitialRef = useRef(animateInitialReveal);
  const loaded = useRef(false);
  const initialMarkup = useRef<string | undefined>(undefined);
  const lastInjectedMarkup = useRef<string | undefined>(undefined);
  const revision = useRef(0);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRaf1 = useRef(0);
  const readyRaf2 = useRef(0);
  const [fontsReady, setFontsReady] = useState<MathDocumentFonts | undefined>(getCachedDocumentFonts);
  const [documentReady, setDocumentReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);
  const showProgress = useDelayedBusy(!documentReady && !failed, 220);

  const stageOpacity = useRef(new Animated.Value(0)).current;
  const stageShiftX = useRef(new Animated.Value(0)).current;
  const stageShiftY = useRef(new Animated.Value(0)).current;

  useLayoutEffect(() => {
    latestDefinition.current = definition;
    animateInitialRef.current = animateInitialReveal;
  }, [animateInitialReveal, definition]);

  const stopStageMotion = useCallback(() => {
    stageOpacity.stopAnimation();
    stageShiftX.stopAnimation();
    stageShiftY.stopAnimation();
  }, [stageOpacity, stageShiftX, stageShiftY]);

  const revealDocument = useCallback((initialGlide = false) => {
    if (revealTimer.current) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
    stopStageMotion();
    if (reducedMotion) {
      stageOpacity.setValue(1);
      stageShiftX.setValue(0);
      stageShiftY.setValue(0);
      return;
    }
    if (initialGlide) {
      stageShiftX.setValue(0);
      stageShiftY.setValue(10);
      Animated.parallel([
        Animated.timing(stageOpacity, {
          toValue: 1,
          duration: 210,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(stageShiftY, {
          toValue: 0,
          tension: 250,
          friction: 22,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    stageShiftY.setValue(0);
    Animated.parallel([
      Animated.timing(stageOpacity, {
        toValue: 1,
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(stageShiftX, {
        toValue: 0,
        tension: 260,
        friction: 22,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reducedMotion, stageOpacity, stageShiftX, stageShiftY, stopStageMotion]);

  useEffect(() => () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    if (swapTimer.current) clearTimeout(swapTimer.current);
    cancelAnimationFrame(readyRaf1.current);
    cancelAnimationFrame(readyRaf2.current);
    stopStageMotion();
  }, [stopStageMotion]);

  useEffect(() => {
    if (!fontsReady || documentReady || failed) return;
    const timeout = setTimeout(() => setFailed(true), 12_000);
    return () => clearTimeout(timeout);
  }, [fontsReady, documentReady, failed, webViewKey]);

  useEffect(() => {
    // The native fallback is readable even if WebView never sends its bridge event.
    if (failed) onReady?.();
  }, [failed, onReady]);

  useEffect(() => {
    let active = true;
    preloadDocumentFonts()
      .then((resolved) => { if (active) setFontsReady(resolved); })
      .catch(() => { if (active) setFontsReady({}); });
    return () => { active = false; };
  }, []);

  const markup = useMemo(() => buildMathDocumentMarkup(definition), [definition]);

  const source = useMemo(() => {
    if (!fontsReady) return undefined;
    if (initialMarkup.current === undefined) initialMarkup.current = markup;
    return {
      html: buildMathDocumentHtml(definition, fontsReady, initialMarkup.current),
      baseUrl: 'about:blank',
    };
  // The first document becomes the immutable WebView shell. Later definitions
  // are injected into the existing DOM so the native view never remounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsReady, webViewKey]);

  useLayoutEffect(() => {
    if (!loaded.current || !fontsReady || failed) return;
    if (lastInjectedMarkup.current === markup) return;
    lastInjectedMarkup.current = markup;
    revision.current += 1;
    const targetRevision = String(revision.current);
    if (swapTimer.current) {
      clearTimeout(swapTimer.current);
      swapTimer.current = null;
    }
    if (revealTimer.current) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
    stopStageMotion();

    const injectUpdatedDocument = () => {
      stageOpacity.setValue(0);
      stageShiftY.setValue(0);
      stageShiftX.setValue(reducedMotion ? 0 : transitionDirection * 18);
      webViewRef.current?.injectJavaScript(
        buildMathDocumentUpdateScript(definition, targetRevision),
      );
      revealTimer.current = setTimeout(() => revealDocument(false), 380);
    };

    if (reducedMotion || transitionDirection === 0) {
      injectUpdatedDocument();
      return;
    }

    // Phase 1: crisp outgoing glide before swapping HTML, then spring-settle the next step in.
    Animated.parallel([
      Animated.timing(stageOpacity, {
        toValue: 0,
        duration: 85,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(stageShiftX, {
        toValue: -transitionDirection * 12,
        duration: 85,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    swapTimer.current = setTimeout(() => {
      swapTimer.current = null;
      injectUpdatedDocument();
    }, 88);
  }, [definition, failed, fontsReady, markup, reducedMotion, revealDocument, stageOpacity, stageShiftX, stageShiftY, stopStageMotion, transitionDirection]);

  const retry = () => {
    if (swapTimer.current) {
      clearTimeout(swapTimer.current);
      swapTimer.current = null;
    }
    if (revealTimer.current) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
    loaded.current = false;
    initialMarkup.current = undefined;
    lastInjectedMarkup.current = undefined;
    revision.current = 0;
    stopStageMotion();
    stageOpacity.setValue(0);
    stageShiftX.setValue(0);
    stageShiftY.setValue(0);
    setFailed(false);
    setDocumentReady(false);
    setWebViewKey((value) => value + 1);
  };

  if (!fontsReady || !source) {
    return (
      <View style={[styles.frame, styles.loading, style]}>
        {showProgress ? <PlayfulLoader compact label="Deschid explicația" /> : null}
      </View>
    );
  }

  if (failed) {
    return (
      <ScrollView style={[styles.frame, style]} contentContainerStyle={styles.error} testID={testID}>
        <Text accessibilityRole="alert" style={styles.errorTitle}>Afișare simplificată</Text>
        <Text style={styles.errorText}>Poți citi explicațiile și formulele mai jos. Pentru aspectul complet și desene, reîncarcă pagina.</Text>
        <Pressable accessibilityRole="button" onPress={retry} style={styles.retryButton}>
          <Text style={styles.retryText}>Reîncarcă</Text>
        </Pressable>
        <Text selectable style={styles.fallbackText}>{mathDocumentFallbackText(definition)}</Text>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.frame, style]} testID={testID}>
      <Animated.View
        style={[
          styles.webViewStage,
          {
            opacity: stageOpacity,
            transform: [
              { translateX: stageShiftX },
              { translateY: stageShiftY },
            ],
          },
        ]}
      >
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
            if (lastInjectedMarkup.current === undefined) {
              lastInjectedMarkup.current = initialMarkup.current;
            }
            const currentMarkup = buildMathDocumentMarkup(latestDefinition.current);
            if (lastInjectedMarkup.current !== currentMarkup) {
              lastInjectedMarkup.current = currentMarkup;
              revision.current += 1;
              stopStageMotion();
              stageOpacity.setValue(0);
              stageShiftX.setValue(0);
              stageShiftY.setValue(0);
              webViewRef.current?.injectJavaScript(
                buildMathDocumentUpdateScript(latestDefinition.current, String(revision.current)),
              );
              if (revealTimer.current) clearTimeout(revealTimer.current);
              revealTimer.current = setTimeout(() => revealDocument(false), 380);
            }
          }}
          onMessage={(event) => {
            try {
              const message = JSON.parse(event.nativeEvent.data) as { type?: unknown; revision?: unknown };
              if (message.type === 'document-ready') {
                loaded.current = true;
                const expected = revision.current === 0 ? 'initial' : String(revision.current);
                if (message.revision !== undefined && String(message.revision) !== expected) {
                  return;
                }
                if (lastInjectedMarkup.current === undefined) {
                  lastInjectedMarkup.current = initialMarkup.current;
                }
                setDocumentReady(true);
                if (revision.current === 0 && onReady && !animateInitialRef.current) {
                  stopStageMotion();
                  stageOpacity.setValue(1);
                  stageShiftX.setValue(0);
                  stageShiftY.setValue(0);
                  // Give Chromium two frames to upload GPU tiles before the screen slide starts.
                  cancelAnimationFrame(readyRaf1.current);
                  cancelAnimationFrame(readyRaf2.current);
                  readyRaf1.current = requestAnimationFrame(() => {
                    readyRaf2.current = requestAnimationFrame(() => onReady());
                  });
                } else {
                  revealDocument(revision.current === 0);
                  onReady?.();
                }
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
          style={styles.webView}
          containerStyle={styles.webViewContainer}
        />
      </Animated.View>
      {showProgress ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <PlayfulLoader compact label="Deschid explicația" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: 120, overflow: 'hidden', backgroundColor: 'transparent' },
  webViewStage: { flex: 1 },
  webViewContainer: { backgroundColor: 'transparent' },
  webView: { flex: 1, backgroundColor: 'transparent' },
  loading: { alignItems: 'center', justifyContent: 'center', padding: 18 },
  loadingOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', padding: 18 },
  error: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 19, textAlign: 'center' },
  errorText: { marginTop: 4, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  fallbackText: { alignSelf: 'stretch', marginTop: 20, fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.ink },
  retryButton: { minHeight: 48, marginTop: 14, borderRadius: 14, backgroundColor: colors.violet, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 13 },
});
