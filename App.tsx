import { Baloo2_700Bold, Baloo2_800ExtraBold, useFonts as useBalooFonts } from '@expo-google-fonts/baloo-2';
import { BalsamiqSans_400Regular, BalsamiqSans_700Bold, useFonts as useBalsamiqFonts } from '@expo-google-fonts/balsamiq-sans';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LessonScreen } from './src/screens/LessonScreen';
import { NotebookScreen } from './src/screens/NotebookScreen';
import { ProcessingScreen } from './src/screens/ProcessingScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { SummaryScreen } from './src/screens/SummaryScreen';
import { colors } from './src/theme';
import type { RootStackParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [balooLoaded] = useBalooFonts({ Baloo2_700Bold, Baloo2_800ExtraBold });
  const [balsamiqLoaded] = useBalsamiqFonts({ BalsamiqSans_400Regular, BalsamiqSans_700Bold });
  const [activeRoute, setActiveRoute] = useState<keyof RootStackParamList>('Home');
  const darkSystemBars = activeRoute === 'Capture' || activeRoute === 'Processing';

  if (!balooLoaded || !balsamiqLoaded) {
    return <SafeAreaProvider initialMetrics={initialWindowMetrics}><NavigationBar hidden style="dark" /><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink }}><ActivityIndicator size="large" color={colors.lime} /></View></SafeAreaProvider>;
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <NavigationBar hidden style={darkSystemBars ? 'dark' : 'light'} />
      <NavigationContainer
        theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.canvas, card: colors.canvas, text: colors.ink } }}
        onStateChange={(state) => {
          const route = state?.routes[state.index];
          if (route) setActiveRoute(route.name as keyof RootStackParamList);
        }}
      >
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'slide_from_right' }}>
          <Stack.Screen name="Home" component={HomeScreen} options={{ animation: 'fade' }} />
          <Stack.Screen name="Notebook" component={NotebookScreen} />
          <Stack.Screen name="Capture" component={CaptureScreen} options={{ animation: 'slide_from_bottom', contentStyle: { backgroundColor: colors.ink } }} />
          <Stack.Screen name="Review" component={ReviewScreen} options={{ animation: 'fade' }} />
          <Stack.Screen name="Processing" component={ProcessingScreen} options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="Lesson" component={LessonScreen} options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="Summary" component={SummaryScreen} options={{ animation: 'fade' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
