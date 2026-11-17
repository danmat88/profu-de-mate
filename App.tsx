import { BalsamiqSans_400Regular } from '@expo-google-fonts/balsamiq-sans/400Regular';
import { BalsamiqSans_700Bold } from '@expo-google-fonts/balsamiq-sans/700Bold';
import { FiraSans_400Regular } from '@expo-google-fonts/fira-sans/400Regular';
import { FiraSans_500Medium } from '@expo-google-fonts/fira-sans/500Medium';
import { FiraSans_600SemiBold } from '@expo-google-fonts/fira-sans/600SemiBold';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import { NavigationBar } from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { LaunchSplash } from './src/components/LaunchSplash';
import { HomeMotionReadyContext } from './src/components/home/HomePrimitives';
import { CommercialProvider, useCommercial } from './src/context/CommercialContext';
import { useReducedMotion } from './src/hooks/useReducedMotion';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MathInputScreen } from './src/screens/MathInputScreen';
import { MathProcessingScreen } from './src/screens/MathProcessingScreen';
import { LessonScreen } from './src/screens/LessonScreen';
import { LegalScreen } from './src/screens/LegalScreen';
import { NotebookScreen } from './src/screens/NotebookScreen';
import { PaywallScreen } from './src/screens/PaywallScreen';
import { ProcessingScreen } from './src/screens/ProcessingScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SummaryScreen } from './src/screens/SummaryScreen';
import { initializeFirebaseServices, initializeVerifiedFirebaseServices } from './src/services/firebase';
import { recordDiagnosticError } from './src/services/diagnostics';
import { readCachedCommercialAccess } from './src/services/commercialAccessCache';
import { getPreparedPendingAnalysis, preparePendingAnalysisOnStartup, type PendingAnalysis } from './src/services/pendingAnalysis';
import { preloadCriticalAppAssets } from './src/services/startupAssets';
import { settleStartupTask, type StartupTaskResult } from './src/services/startupBootstrap';
import { colors } from './src/theme';
import type { CommercialAccess, RootStackParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

SplashScreen.setOptions({ duration: 0, fade: false });
void SplashScreen.preventAutoHideAsync();

type StartupSnapshot = {
  pendingAnalysis: PendingAnalysis | null;
  initialAccess: CommercialAccess | null;
};

const LOCAL_STARTUP_DEADLINE_MS = 2_200;
const FONT_STARTUP_DEADLINE_MS = 3_000;

function reportStartupTask<T>(result: StartupTaskResult<T>) {
  if (result.outcome === 'ready') return;
  recordDiagnosticError(
    'startup_bootstrap',
    result.error ?? { code: `startup/${result.outcome}` },
  );
}

function AppExperience({ pendingAnalysis }: { pendingAnalysis: PendingAnalysis | null }) {
  const [activeRoute, setActiveRoute] = useState<keyof RootStackParamList>(pendingAnalysis?.schemaVersion === 3 ? 'MathProcessing' : pendingAnalysis ? 'Processing' : 'Home');
  const [showLaunchSplash, setShowLaunchSplash] = useState(true);
  const [navigationReady, setNavigationReady] = useState(false);
  const reducedMotion = useReducedMotion();
  const { authSessionKey } = useCommercial();
  const activePending = pendingAnalysis && getPreparedPendingAnalysis()?.requestId === pendingAnalysis.requestId ? pendingAnalysis : null;
  const darkSystemBars = activeRoute === 'Capture' || activeRoute === 'Processing' || activeRoute === 'MathProcessing';
  const finishLaunch = useCallback(() => setShowLaunchSplash(false), []);

  return (
    <View style={styles.app}>
      <NavigationBar hidden style={darkSystemBars ? 'dark' : 'light'} />
      <View
        style={styles.navigator}
        pointerEvents={showLaunchSplash ? 'none' : 'auto'}
        importantForAccessibility={showLaunchSplash ? 'no-hide-descendants' : 'auto'}
      >
        <HomeMotionReadyContext.Provider value={!showLaunchSplash}>
        <NavigationContainer
            key={authSessionKey ?? 'signed-out'}
            theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.canvas, card: colors.canvas, text: colors.ink } }}
            onReady={() => setNavigationReady(true)}
            onStateChange={(state) => {
              const route = state?.routes[state.index];
              if (route) setActiveRoute(route.name as keyof RootStackParamList);
            }}
          >
            <StatusBar style={darkSystemBars ? 'light' : 'dark'} />
            <Stack.Navigator initialRouteName={activePending?.schemaVersion === 3 ? 'MathProcessing' : activePending ? 'Processing' : 'Home'} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: reducedMotion ? 'none' : 'slide_from_right' }}>
              <Stack.Screen name="Home" component={HomeScreen} options={{ animation: 'none' }} />
              <Stack.Screen name="MathInput" component={MathInputScreen} />
              <Stack.Screen name="MathProcessing" component={MathProcessingScreen} initialParams={activePending?.schemaVersion === 3 ? { ...activePending, origin: 'home' } : undefined} options={{ gestureEnabled: false, animation: reducedMotion ? 'none' : 'fade', contentStyle: { backgroundColor: colors.ink } }} />
              <Stack.Screen name="Notebook" component={NotebookScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="Legal" component={LegalScreen} />
              <Stack.Screen name="Paywall" component={PaywallScreen} options={{ animation: reducedMotion ? 'none' : 'slide_from_bottom', presentation: 'modal' }} />
              <Stack.Screen name="Capture" component={CaptureScreen} options={{ animation: reducedMotion ? 'none' : 'slide_from_bottom', gestureEnabled: false, freezeOnBlur: true, contentStyle: { backgroundColor: colors.ink } }} />
              <Stack.Screen name="Review" component={ReviewScreen} options={{ animation: 'none', gestureEnabled: false, freezeOnBlur: true, contentStyle: { backgroundColor: colors.ink } }} />
              <Stack.Screen name="Processing" component={ProcessingScreen} initialParams={activePending?.schemaVersion === 2 ? { ...activePending, origin: 'home' } : undefined} options={{ animation: reducedMotion ? 'none' : 'fade', gestureEnabled: false, contentStyle: { backgroundColor: colors.ink } }} />
              <Stack.Screen name="Lesson" component={LessonScreen} options={{ animation: reducedMotion ? 'none' : 'fade', gestureEnabled: false }} />
              <Stack.Screen name="Summary" component={SummaryScreen} />
            </Stack.Navigator>
        </NavigationContainer>
        </HomeMotionReadyContext.Provider>
      </View>
      {showLaunchSplash ? <LaunchSplash ready={navigationReady} reducedMotion={reducedMotion} onFinish={finishLaunch} /> : null}
    </View>
  );
}

function AppRoot() {
  const [fontsLoaded, fontError] = useFonts({
    BalsamiqSans_400Regular,
    BalsamiqSans_700Bold,
    FiraSans_400Regular,
    FiraSans_500Medium,
    FiraSans_600SemiBold,
  });
  const [startup, setStartup] = useState<StartupSnapshot>();
  const [fontDeadlineReached, setFontDeadlineReached] = useState(false);
  const fontsReady = fontsLoaded || Boolean(fontError) || fontDeadlineReached;

  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const deadline = setTimeout(() => {
      setFontDeadlineReached(true);
      recordDiagnosticError('startup_bootstrap', { code: 'startup/font-timeout' });
    }, FONT_STARTUP_DEADLINE_MS);
    return () => clearTimeout(deadline);
  }, [fontError, fontsLoaded]);

  useEffect(() => {
    if (fontError) recordDiagnosticError('startup_bootstrap', fontError);
  }, [fontError]);

  useEffect(() => {
    let mounted = true;
    const firebaseSession = initializeFirebaseServices();
    void firebaseSession.then(() => initializeVerifiedFirebaseServices()).catch((error) => {
      recordDiagnosticError('firebase_initialization', error);
      // Ecranele de rețea păstrează propriul retry; startup-ul nu rămâne blocat.
    });

    const cachedAccessForSession = firebaseSession.then(() => readCachedCommercialAccess());

    Promise.all([
      settleStartupTask(preloadCriticalAppAssets(), undefined, LOCAL_STARTUP_DEADLINE_MS),
      settleStartupTask(preparePendingAnalysisOnStartup(), null, LOCAL_STARTUP_DEADLINE_MS),
      settleStartupTask(cachedAccessForSession, null, LOCAL_STARTUP_DEADLINE_MS),
    ]).then(([assets, pending, access]) => {
      reportStartupTask(assets);
      reportStartupTask(pending);
      reportStartupTask(access);
      if (assets.outcome === 'failed' && assets.error) {
        recordDiagnosticError('startup_assets', assets.error);
      }
      if (mounted) {
        setStartup({
          pendingAnalysis: pending.value,
          initialAccess: access.value,
        });
      }
    });

    return () => { mounted = false; };
  }, []);

  if (!fontsReady || !startup) {
    return (
      <View style={styles.preloadSurface}>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <CommercialProvider initialAccess={startup.initialAccess}>
      <AppExperience pendingAnalysis={startup.pendingAnalysis} />
    </CommercialProvider>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  app: { flex: 1, backgroundColor: colors.canvas },
  preloadSurface: { flex: 1, backgroundColor: colors.ink },
  navigator: { flex: 1 },
});

export default function App() {
  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <AppErrorBoundary onError={(error) => {
          void SplashScreen.hideAsync();
          recordDiagnosticError('app_render', error);
        }}>
          <AppRoot />
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
