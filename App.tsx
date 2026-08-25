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
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { LaunchSplash } from './src/components/LaunchSplash';
import { CommercialProvider } from './src/context/CommercialContext';
import { useReducedMotion } from './src/hooks/useReducedMotion';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LessonScreen } from './src/screens/LessonScreen';
import { LegalScreen } from './src/screens/LegalScreen';
import { NotebookScreen } from './src/screens/NotebookScreen';
import { PaywallScreen } from './src/screens/PaywallScreen';
import { ProcessingScreen } from './src/screens/ProcessingScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SummaryScreen } from './src/screens/SummaryScreen';
import { initializeVerifiedFirebaseServices } from './src/services/firebase';
import { recordDiagnosticError } from './src/services/diagnostics';
import { preparePendingAnalysisOnStartup, type PendingAnalysis } from './src/services/pendingAnalysis';
import { colors } from './src/theme';
import type { RootStackParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

void SplashScreen.preventAutoHideAsync();

function AppRoot() {
  const [fontsLoaded, fontError] = useFonts({
    BalsamiqSans_400Regular,
    BalsamiqSans_700Bold,
    FiraSans_400Regular,
    FiraSans_500Medium,
    FiraSans_600SemiBold,
  });
  const [activeRoute, setActiveRoute] = useState<keyof RootStackParamList>('Home');
  const [pendingAnalysis, setPendingAnalysis] = useState<PendingAnalysis | null | undefined>(undefined);
  const [showLaunchSplash, setShowLaunchSplash] = useState(true);
  const reducedMotion = useReducedMotion();
  const darkSystemBars = activeRoute === 'Capture' || activeRoute === 'Processing';
  const fontsReady = fontsLoaded || Boolean(fontError);
  const finishLaunch = useCallback(() => setShowLaunchSplash(false), []);

  useEffect(() => {
    preparePendingAnalysisOnStartup().then((pending) => {
      setPendingAnalysis(pending);
      if (pending) setActiveRoute('Processing');
    });
    initializeVerifiedFirebaseServices().catch((error) => {
      recordDiagnosticError('firebase_initialization', error);
      // Ecranele care au nevoie de rețea afișează eroarea și permit reîncercarea.
    });
  }, []);

  if (!fontsReady || pendingAnalysis === undefined) return null;

  return (
    <View style={styles.app}>
      <NavigationBar hidden style={darkSystemBars ? 'dark' : 'light'} />
      <View
        style={styles.navigator}
        pointerEvents={showLaunchSplash ? 'none' : 'auto'}
        importantForAccessibility={showLaunchSplash ? 'no-hide-descendants' : 'auto'}
      >
        <CommercialProvider>
          <NavigationContainer
            theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.canvas, card: colors.canvas, text: colors.ink } }}
            onStateChange={(state) => {
              const route = state?.routes[state.index];
              if (route) setActiveRoute(route.name as keyof RootStackParamList);
            }}
          >
            <StatusBar style="dark" />
            <Stack.Navigator initialRouteName={pendingAnalysis ? 'Processing' : 'Home'} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: reducedMotion ? 'none' : 'slide_from_right' }}>
              <Stack.Screen name="Home" component={HomeScreen} options={{ animation: reducedMotion ? 'none' : 'fade' }} />
              <Stack.Screen name="Notebook" component={NotebookScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="Legal" component={LegalScreen} />
              <Stack.Screen name="Paywall" component={PaywallScreen} options={{ animation: reducedMotion ? 'none' : 'slide_from_bottom', presentation: 'modal' }} />
              <Stack.Screen name="Capture" component={CaptureScreen} options={{ animation: reducedMotion ? 'none' : 'slide_from_bottom', contentStyle: { backgroundColor: colors.ink } }} />
              <Stack.Screen name="Review" component={ReviewScreen} options={{ animation: reducedMotion ? 'none' : 'fade' }} />
              <Stack.Screen name="Processing" component={ProcessingScreen} initialParams={pendingAnalysis ?? undefined} options={{ animation: reducedMotion ? 'none' : 'fade', gestureEnabled: false }} />
              <Stack.Screen name="Lesson" component={LessonScreen} options={{ animation: reducedMotion ? 'none' : 'fade', gestureEnabled: false }} />
              <Stack.Screen name="Summary" component={SummaryScreen} options={{ animation: reducedMotion ? 'none' : 'fade' }} />
            </Stack.Navigator>
          </NavigationContainer>
        </CommercialProvider>
      </View>
      {showLaunchSplash ? <LaunchSplash reducedMotion={reducedMotion} onFinish={finishLaunch} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.canvas },
  navigator: { flex: 1 },
});

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppErrorBoundary onError={(error) => {
        void SplashScreen.hideAsync();
        recordDiagnosticError('app_render', error);
      }}>
        <AppRoot />
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
