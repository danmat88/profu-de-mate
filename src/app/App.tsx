import { DarkTheme, NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationBar } from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { LaunchSplash } from './components/LaunchSplash';
import { HomeMotionReadyContext } from '../features/home/context/HomeMotionContext';
import { CommercialProvider, useCommercial } from '../features/access/context/CommercialContext';
import { useReducedMotion } from '../shared/hooks/useReducedMotion';
import { CaptureScreen } from '../features/capture/screens/CaptureScreen';
import { HomeScreen } from '../features/home/screens/HomeScreen';
import { MathInputScreen } from '../features/math/screens/MathInputScreen';
import { MathProcessingScreen } from '../features/analysis/screens/MathProcessingScreen';
import { LessonScreen } from '../features/lessons/screens/LessonScreen';
import { LegalScreen } from '../features/account/screens/LegalScreen';
import { NotebookScreen } from '../features/lessons/screens/NotebookScreen';
import { PaywallScreen } from '../features/access/screens/PaywallScreen';
import { ProcessingScreen } from '../features/analysis/screens/ProcessingScreen';
import { ReviewScreen } from '../features/capture/screens/ReviewScreen';
import { SettingsScreen } from '../features/account/screens/SettingsScreen';
import { SummaryScreen } from '../features/lessons/screens/SummaryScreen';
import { recordDiagnosticError } from '../shared/services/diagnostics';
import { getPreparedPendingAnalysis } from '../features/analysis/services/pendingAnalysis';
import { preloadCriticalAppAssets } from './services/startupAssets';
import { StartupError, type StartupSnapshot } from './services/startupBootstrap';
import { currentStartupSession, prepareApplication } from './services/applicationStartup';
import { navigationStateAfterIdentityChange } from './navigation/sessionNavigation';
import { ReadinessScreen } from '../shared/ui/ReadinessScreen';
import { colors } from '../shared/theme';
import type { RootStackParamList } from '../shared/types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const NAVIGATION_THEME = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.canvas, card: colors.canvas, text: colors.ink },
};

function isDarkSystemBarRoute(routeName: string | undefined): boolean {
  return routeName === 'Capture' || routeName === 'Processing' || routeName === 'MathProcessing';
}

SplashScreen.setOptions({ duration: 0, fade: false });
void SplashScreen.preventAutoHideAsync();

type AppStartup = (StartupSnapshot & { offline: false }) | {
  offline: true; initialAccess: null; pendingAnalysis: null; verifiedAt: 0; sessionKey: string;
};

function SystemBarChrome({
  navigationRef,
  initialDark,
}: {
  navigationRef: ReturnType<typeof useNavigationContainerRef<RootStackParamList>>;
  initialDark: boolean;
}) {
  const [dark, setDark] = useState(initialDark);

  useEffect(() => {
    const sync = () => {
      const route = navigationRef.getCurrentRoute();
      if (route) setDark(isDarkSystemBarRoute(route.name));
    };
    const unsubscribe = navigationRef.addListener('state', sync);
    return unsubscribe;
  }, [navigationRef]);

  return (
    <>
      <NavigationBar hidden style={dark ? 'dark' : 'light'} />
      <StatusBar style={dark ? 'light' : 'dark'} />
    </>
  );
}

function AppExperience({ startup, interactive, revealReady, onReady }: { startup: AppStartup; interactive: boolean; revealReady: boolean; onReady: () => void }) {
  const { pendingAnalysis } = startup;
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const initialRoute: keyof RootStackParamList = startup.offline ? 'Notebook' : pendingAnalysis?.schemaVersion === 3 ? 'MathProcessing' : pendingAnalysis ? 'Processing' : 'Home';
  const reducedMotion = useReducedMotion();
  const { authSessionKey } = useCommercial();
  const previousSessionKey = useRef(authSessionKey);
  const activePending = pendingAnalysis && getPreparedPendingAnalysis()?.requestId === pendingAnalysis.requestId ? pendingAnalysis : null;
  const initialState = useMemo(
    () => (startup.offline ? { index: 1, routes: [{ name: 'Home' as const }, { name: 'Notebook' as const }] } : undefined),
    [startup.offline],
  );
  const defaultScreenOptions = useMemo(() => ({
    headerShown: false,
    contentStyle: { backgroundColor: colors.canvas },
    animation: (reducedMotion ? 'none' : 'ios_from_right') as 'none' | 'ios_from_right',
  }), [reducedMotion]);
  const handleNavigationReady = useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(onReady));
  }, [onReady]);

  useEffect(() => {
    if (previousSessionKey.current === authSessionKey) return;
    previousSessionKey.current = authSessionKey;
    if (!navigationRef.isReady()) return;
    const rootState = navigationRef.getRootState();
    const routes = rootState?.routes ?? [];
    const currentRoute = routes[rootState?.index ?? routes.length - 1]?.name as keyof RootStackParamList | undefined;
    if (!currentRoute) return;
    const nextState = navigationStateAfterIdentityChange(
      routes.map((route) => route.name as keyof RootStackParamList),
      currentRoute,
    );
    if (nextState) {
      navigationRef.resetRoot(nextState);
    }
  }, [authSessionKey, navigationRef]);

  return (
    <View style={styles.app}>
      <SystemBarChrome navigationRef={navigationRef} initialDark={isDarkSystemBarRoute(initialRoute)} />
      <View
        style={styles.navigator}
        pointerEvents={interactive ? 'auto' : 'none'}
        importantForAccessibility={interactive ? 'auto' : 'no-hide-descendants'}
      >
        <HomeMotionReadyContext.Provider value={revealReady}>
        <NavigationContainer
            ref={navigationRef}
            initialState={initialState}
            theme={NAVIGATION_THEME}
            onReady={handleNavigationReady}
          >
            <Stack.Navigator initialRouteName={activePending?.schemaVersion === 3 ? 'MathProcessing' : activePending ? 'Processing' : 'Home'} screenOptions={defaultScreenOptions}>
              <Stack.Screen name="Home" component={HomeScreen} options={{ animation: 'none' }} />
              <Stack.Screen name="MathInput" component={MathInputScreen} options={{ animation: reducedMotion ? 'none' : 'fade_from_bottom' }} />
              <Stack.Screen name="MathProcessing" component={MathProcessingScreen} initialParams={activePending?.schemaVersion === 3 ? { ...activePending, origin: 'home' } : undefined} options={{ gestureEnabled: false, animation: reducedMotion ? 'none' : 'fade', contentStyle: { backgroundColor: colors.ink } }} />
              <Stack.Screen name="Notebook" component={NotebookScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="Legal" component={LegalScreen} />
              <Stack.Screen name="Paywall" component={PaywallScreen} initialParams={{ source: 'settings' }} options={{ animation: reducedMotion ? 'none' : 'slide_from_bottom', presentation: 'modal' }} />
              <Stack.Screen name="Capture" component={CaptureScreen} options={{ animation: reducedMotion ? 'none' : 'fade_from_bottom', gestureEnabled: false, freezeOnBlur: true, contentStyle: { backgroundColor: colors.ink } }} />
              <Stack.Screen name="Review" component={ReviewScreen} options={{ animation: reducedMotion ? 'none' : 'fade', gestureEnabled: false, freezeOnBlur: true, contentStyle: { backgroundColor: colors.ink } }} />
              <Stack.Screen name="Processing" component={ProcessingScreen} initialParams={activePending?.schemaVersion === 2 ? { ...activePending, origin: 'home' } : undefined} options={{ animation: reducedMotion ? 'none' : 'fade', gestureEnabled: false, contentStyle: { backgroundColor: colors.ink } }} />
              <Stack.Screen
                name="Lesson"
                component={LessonScreen}
                options={({ route }) => ({
                  animation: reducedMotion ? 'none' : route.params?.source === 'notebook' ? 'ios_from_right' : 'fade',
                  gestureEnabled: route.params?.source === 'notebook',
                })}
              />
              <Stack.Screen name="Summary" component={SummaryScreen} />
            </Stack.Navigator>
        </NavigationContainer>
        </HomeMotionReadyContext.Provider>
      </View>
    </View>
  );
}

function AppRoot() {
  const [startup, setStartup] = useState<AppStartup>();
  const [visualsReady, setVisualsReady] = useState(false);
  const [navigationReady, setNavigationReady] = useState(false);
  const [showLaunchSplash, setShowLaunchSplash] = useState(true);
  const [homeRevealReady, setHomeRevealReady] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [openingNotebook, setOpeningNotebook] = useState(false);
  const reducedMotion = useReducedMotion();
  const markNavigationReady = useCallback(() => setNavigationReady(true), []);
  const startHomeReveal = useCallback(() => setHomeRevealReady(true), []);
  const finishLaunch = useCallback(() => {
    setHomeRevealReady(true);
    setShowLaunchSplash(false);
  }, []);

  useEffect(() => {
    let active = true;
    let retryFeedbackTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    if (attempt === 0) setFailure(null);
    setStartup(undefined);
    setNavigationReady(false);
    setHomeRevealReady(false);
    setShowLaunchSplash(true);
    void preloadCriticalAppAssets().then(() => {
      if (active) setVisualsReady(true);
    }).catch(() => undefined);
    void prepareApplication().then((snapshot) => {
      if (!active) return;
      if (__DEV__) console.info('[startup:ready]', snapshot.timings);
      setFailure(null);
      setRetrying(false);
      setStartup({ ...snapshot, offline: false });
    }).catch((error: unknown) => {
      recordDiagnosticError('startup_bootstrap', error);
      if (!active) return;
      const elapsed = Date.now() - startedAt;
      const delay = attempt > 0 ? Math.max(0, 350 - elapsed) : 0;
      if (delay > 0) {
        retryFeedbackTimer = setTimeout(() => {
          if (!active) return;
          setFailure(error);
          setRetrying(false);
        }, delay);
      } else {
        setFailure(error);
        setRetrying(false);
      }
    });
    return () => {
      active = false;
      if (retryFeedbackTimer) clearTimeout(retryFeedbackTimer);
    };
  }, [attempt]);

  useEffect(() => {
    if (failure) void SplashScreen.hideAsync().catch(() => undefined);
  }, [failure]);

  const retryStartup = () => {
    if (retrying || openingNotebook) return;
    setRetrying(true);
    setAttempt(value => value + 1);
  };

  const openNotebookOffline = async () => {
    if (openingNotebook || retrying) return;
    setOpeningNotebook(true);
    try {
      await preloadCriticalAppAssets();
      const session = currentStartupSession();
      if (!session) return;
      setVisualsReady(true);
      setNavigationReady(false);
      setHomeRevealReady(false);
      setShowLaunchSplash(true);
      setStartup({ offline: true, initialAccess: null, pendingAnalysis: null, verifiedAt: 0, sessionKey: session.key });
      setFailure(null);
    } catch (error) {
      recordDiagnosticError('startup_assets', error);
      setFailure(new StartupError('visuals', error));
    } finally { setOpeningNotebook(false); }
  };

  if (failure && !startup) {
    const resourceFailure = failure instanceof StartupError && failure.stage === 'visuals';
    return <ReadinessScreen
      busy={openingNotebook || retrying}
      title={resourceFailure ? 'Aplicația nu este încă pregătită' : 'Nu putem verifica accesul'}
      message={resourceFailure ? 'Unele resurse nu s-au putut încărca. Verifică legătura și reîncearcă.' : 'Verifică conexiunea și reîncearcă. Vom deschide Home după confirmarea contului și a limitei de azi.'}
      onRetry={retryStartup}
      onNotebook={currentStartupSession() ? () => void openNotebookOffline() : undefined}
    />;
  }

  return (
    <View style={styles.app}>
      {startup ? <CommercialProvider initialAccess={startup.initialAccess} initialVerifiedAt={startup.verifiedAt} initiallyOffline={startup.offline}>
        <AppExperience
          startup={startup}
          interactive={!showLaunchSplash}
          revealReady={homeRevealReady || reducedMotion}
          onReady={markNavigationReady}
        />
      </CommercialProvider> : null}
      {showLaunchSplash ? <LaunchSplash ready={Boolean(startup) && navigationReady} visualsReady={visualsReady} startupReady={Boolean(startup)} reducedMotion={reducedMotion} onRevealStart={startHomeReveal} onFinish={finishLaunch} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  app: { flex: 1, backgroundColor: colors.canvas },
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
