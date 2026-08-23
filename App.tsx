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
import { useEffect, useState } from 'react';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { useReducedMotion } from './src/hooks/useReducedMotion';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LessonScreen } from './src/screens/LessonScreen';
import { LegalScreen } from './src/screens/LegalScreen';
import { NotebookScreen } from './src/screens/NotebookScreen';
import { ProcessingScreen } from './src/screens/ProcessingScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SummaryScreen } from './src/screens/SummaryScreen';
import { initializeVerifiedFirebaseServices } from './src/services/firebase';
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
  const reducedMotion = useReducedMotion();
  const darkSystemBars = activeRoute === 'Capture' || activeRoute === 'Processing';
  const fontsReady = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    initializeVerifiedFirebaseServices().catch(() => {
      // Ecranele care au nevoie de rețea afișează eroarea și permit reîncercarea.
    });
  }, []);

  useEffect(() => {
    if (fontsReady) void SplashScreen.hideAsync();
  }, [fontsReady]);

  if (!fontsReady) return null;

  return (
    <>
      <NavigationBar hidden style={darkSystemBars ? 'dark' : 'light'} />
      <NavigationContainer
        theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.canvas, card: colors.canvas, text: colors.ink } }}
        onStateChange={(state) => {
          const route = state?.routes[state.index];
          if (route) setActiveRoute(route.name as keyof RootStackParamList);
        }}
      >
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: reducedMotion ? 'none' : 'slide_from_right' }}>
          <Stack.Screen name="Home" component={HomeScreen} options={{ animation: reducedMotion ? 'none' : 'fade' }} />
          <Stack.Screen name="Notebook" component={NotebookScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Legal" component={LegalScreen} />
          <Stack.Screen name="Capture" component={CaptureScreen} options={{ animation: reducedMotion ? 'none' : 'slide_from_bottom', contentStyle: { backgroundColor: colors.ink } }} />
          <Stack.Screen name="Review" component={ReviewScreen} options={{ animation: reducedMotion ? 'none' : 'fade' }} />
          <Stack.Screen name="Processing" component={ProcessingScreen} options={{ animation: reducedMotion ? 'none' : 'fade', gestureEnabled: false }} />
          <Stack.Screen name="Lesson" component={LessonScreen} options={{ animation: reducedMotion ? 'none' : 'fade', gestureEnabled: false }} />
          <Stack.Screen name="Summary" component={SummaryScreen} options={{ animation: reducedMotion ? 'none' : 'fade' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AppErrorBoundary onError={() => { void SplashScreen.hideAsync(); }}>
        <AppRoot />
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
