import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef, useState } from 'react';
import { HomeSurface } from '../components/HomeSurface';
import { ReadinessScreen } from '../../../shared/ui/ReadinessScreen';
import { useCommercial } from '../../access/context/CommercialContext';
import * as Haptics from '../../../shared/services/haptics';
import { getPreparedPendingAnalysis, preparePendingAnalysisOnStartup, type PendingAnalysis } from '../../analysis/services/pendingAnalysis';
import { getCachedFavoriteLessons } from '../../lessons/services/lessons';
import { warmMathDrafts } from '../../math/services/mathDraft';
import { assertSessionActive, captureSession } from '../../../shared/services/sessionGuard';
import { hasSeenHomeGuide, markHomeGuideSeen } from '../../../shared/storage/localPreferences';
import type { FlowMode, RootStackParamList } from '../../../shared/types';
import { allowancePresentation } from '../../access/utils/commercialPresentation';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

function readLatestLessonTitle(): string | null {
  const first = getCachedFavoriteLessons()?.[0];
  if (!first) return null;
  return first.title.trim() || first.topic.trim() || null;
}

export function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const {
    access,
    refresh: refreshCommercialAccess,
    status: commercialStatus,
    refreshIfStale: refreshCommercialAccessIfStale,
  } = useCommercial();
  const [mode, setMode] = useState<FlowMode>('solve');
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [pendingAnalysis, setPendingAnalysis] = useState<PendingAnalysis | null>(() => getPreparedPendingAnalysis() ?? null);
  const [latestLessonTitle, setLatestLessonTitle] = useState<string | null>(() => readLatestLessonTitle());
  const [guideDismissed, setGuideDismissed] = useState<boolean>(() => hasSeenHomeGuide());
  const navigationLocked = useRef(false);
  const galleryLocked = useRef(false);
  const alive = useRef(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    alive.current = true;
    navigationLocked.current = false;
    galleryLocked.current = false;
    setLatestLessonTitle(readLatestLessonTitle());
    const warmFrame = requestAnimationFrame(() => {
      if (!active) return;
      try { warmMathDrafts(captureSession()); } catch { /* Ignore when session is not yet ready. */ }
    });
    void preparePendingAnalysisOnStartup().then((pending) => {
      if (active) setPendingAnalysis(pending);
    });
    void refreshCommercialAccessIfStale();
    return () => { active = false; alive.current = false; cancelAnimationFrame(warmFrame); };
  }, [refreshCommercialAccessIfStale]));

  const chooseMode = (next: FlowMode) => {
    if (next === mode || pendingAnalysis) return;
    Haptics.selection();
    setGalleryError(null);
    setMode(next);
  };

  const dismissGuide = () => {
    Haptics.selection();
    markHomeGuideSeen();
    setGuideDismissed(true);
  };

  const resume = useCallback(() => {
    const pending = getPreparedPendingAnalysis();
    if (!pending) {
      setPendingAnalysis(null);
      return false;
    }
    if (pending.schemaVersion === 3) navigation.navigate('MathProcessing', { ...pending, origin: 'home' });
    else navigation.navigate('Processing', { ...pending, origin: 'home' });
    return true;
  }, [navigation]);

  const openCapture = () => {
    if (navigationLocked.current || galleryLocked.current) return;
    navigationLocked.current = true;
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    if (!resume()) navigation.navigate('Capture', { mode });
  };

  const openMath = () => {
    if (navigationLocked.current || galleryLocked.current) return;
    navigationLocked.current = true;
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    if (!resume()) navigation.navigate('MathInput', { mode });
  };

  const openNotebook = () => {
    if (navigationLocked.current || galleryLocked.current) return;
    navigationLocked.current = true;
    Haptics.selection();
    navigation.navigate('Notebook');
  };

  const openGallery = useCallback(async () => {
    if (galleryLocked.current || navigationLocked.current) return;
    if (resume()) return;
    galleryLocked.current = true;
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    setGalleryError(null);
    setGalleryBusy(true);
    try {
      const session = captureSession();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 1,
        exif: false,
      });
      assertSessionActive(session);
      if (!alive.current || result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri || asset.width <= 0 || asset.height <= 0) throw new Error('invalid-image');
      const image = { uri: asset.uri, width: asset.width, height: asset.height, source: 'gallery' as const };
      Haptics.notification(Haptics.NotificationFeedbackType.Success);
      navigation.navigate('Review', { mode, image });
    } catch {
      if (alive.current) setGalleryError('Fotografia nu s-a deschis. Încearcă alta.');
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    } finally {
      galleryLocked.current = false;
      if (alive.current) setGalleryBusy(false);
    }
  }, [mode, navigation, resume]);

  const activeMode = pendingAnalysis?.mode ?? mode;
  const openAllowance = () => {
    navigation.navigate('Paywall', { source: 'home', ...(access ? { access } : {}) });
  };

  if (!access) {
    return <ReadinessScreen
      busy={commercialStatus === 'resolving'}
      title={commercialStatus === 'resolving' ? 'Actualizăm accesul' : 'Accesul nu este confirmat'}
      message="Home se deschide după confirmarea contului și a limitei de azi. Caietul poate fi citit separat, inclusiv offline."
      onRetry={() => void refreshCommercialAccess()}
      onNotebook={openNotebook}
    />;
  }

  const allowance = allowancePresentation(access);

  return (
    <HomeSurface
      mode={activeMode}
      pending={Boolean(pendingAnalysis)}
      galleryBusy={galleryBusy}
      galleryError={galleryError}
      allowance={allowance}
      premiumActive={Boolean(access?.premium.active)}
      latestLessonTitle={latestLessonTitle}
      showGuide={!guideDismissed && !latestLessonTitle}
      onDismissGuide={dismissGuide}
      onMode={chooseMode}
      onCapture={openCapture}
      onGallery={() => void openGallery()}
      onMath={openMath}
      onNotebook={openNotebook}
      onSettings={() => navigation.navigate('Settings')}
      onAllowance={openAllowance}
    />
  );
}
