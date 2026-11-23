import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HomeSurface } from '../components/HomeSurface';
import { ReadinessScreen } from '../../../shared/ui/ReadinessScreen';
import { useCommercial } from '../../access/context/CommercialContext';
import * as Haptics from '../../../shared/services/haptics';
import { getPreparedPendingAnalysis, preparePendingAnalysisOnStartup, type PendingAnalysis } from '../../analysis/services/pendingAnalysis';
import { getCachedFavoriteLessons } from '../../lessons/services/lessons';
import { prewarmNotebookPresentations } from '../../lessons/utils/notebookPresentation';
import { warmMathDrafts } from '../../math/services/mathDraft';
import { assertSessionActive, captureSession } from '../../../shared/services/sessionGuard';
import { hasSeenHomeGuide, markHomeGuideSeen } from '../../../shared/storage/localPreferences';
import type { FlowMode, RootStackParamList } from '../../../shared/types';
import { allowancePresentation } from '../../access/utils/commercialPresentation';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

type NotebookPreview = {
  latestTitle: string | null;
  count: number;
};

function readNotebookPreview(): NotebookPreview {
  const lessons = getCachedFavoriteLessons();
  if (!lessons || lessons.length === 0) return { latestTitle: null, count: 0 };
  const first = lessons[0];
  return {
    latestTitle: first.title.trim() || first.topic.trim() || null,
    count: lessons.length,
  };
}

export function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const {
    authSessionKey,
    access,
    refresh: refreshCommercialAccess,
    status: commercialStatus,
    refreshIfStale: refreshCommercialAccessIfStale,
  } = useCommercial();
  const [mode, setMode] = useState<FlowMode>('solve');
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [pendingAnalysis, setPendingAnalysis] = useState<PendingAnalysis | null>(() => getPreparedPendingAnalysis() ?? null);
  const [notebookPreview, setNotebookPreview] = useState<NotebookPreview>(() => readNotebookPreview());
  const [guideDismissed, setGuideDismissed] = useState<boolean>(() => hasSeenHomeGuide());
  const [homeFocused, setHomeFocused] = useState(true);
  const navigationLocked = useRef(false);
  const galleryLocked = useRef(false);
  const mounted = useRef(true);
  const focused = useRef(true);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    mounted.current = false;
    if (focusTimer.current) clearTimeout(focusTimer.current);
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }, []);

  useEffect(() => {
    setNotebookPreview(readNotebookPreview());
    setPendingAnalysis(getPreparedPendingAnalysis() ?? null);
  }, [authSessionKey]);

  useFocusEffect(useCallback(() => {
    let active = true;
    focused.current = true;
    navigationLocked.current = false;
    galleryLocked.current = false;
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    if (focusTimer.current) {
      clearTimeout(focusTimer.current);
      focusTimer.current = null;
    }
    focusTimer.current = setTimeout(() => {
      focusTimer.current = null;
      if (active && mounted.current) setHomeFocused(true);
    }, 220);
    setGalleryBusy(false);
    setNotebookPreview((previous) => {
      const next = readNotebookPreview();
      return previous.latestTitle === next.latestTitle && previous.count === next.count ? previous : next;
    });
    setPendingAnalysis((previous) => {
      const next = getPreparedPendingAnalysis() ?? null;
      return previous?.requestId === next?.requestId && previous?.mode === next?.mode ? previous : next;
    });
    const warmFrame = requestAnimationFrame(() => {
      if (!active) return;
      try { warmMathDrafts(captureSession()); } catch { /* Ignore when session is not yet ready. */ }
      try { prewarmNotebookPresentations(getCachedFavoriteLessons()); } catch { /* Ignore cache prewarm errors. */ }
    });
    void preparePendingAnalysisOnStartup().then((pending) => {
      if (active) setPendingAnalysis(pending);
    });
    void refreshCommercialAccessIfStale();
    return () => {
      active = false;
      focused.current = false;
      cancelAnimationFrame(warmFrame);
      if (focusTimer.current) {
        clearTimeout(focusTimer.current);
        focusTimer.current = null;
      }
      // Pause Home ambient loops quietly only after the pushed screen has slid in.
      blurTimer.current = setTimeout(() => {
        blurTimer.current = null;
        if (mounted.current && !focused.current) setHomeFocused(false);
      }, 320);
    };
  }, [refreshCommercialAccessIfStale]));

  const activeMode = pendingAnalysis?.mode ?? mode;

  const chooseMode = (next: FlowMode) => {
    if (next === activeMode || pendingAnalysis || galleryLocked.current) return;
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
    if (!resume()) navigation.navigate('Capture', { mode });
  };

  const openMath = () => {
    if (navigationLocked.current || galleryLocked.current) return;
    navigationLocked.current = true;
    if (!resume()) navigation.navigate('MathInput', { mode });
  };

  const openNotebook = () => {
    if (navigationLocked.current || galleryLocked.current) return;
    navigationLocked.current = true;
    navigation.navigate('Notebook');
  };

  const openGallery = useCallback(async () => {
    if (galleryLocked.current || navigationLocked.current) return;
    if (resume()) return;
    galleryLocked.current = true;
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
      if (!focused.current || result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri || asset.width <= 0 || asset.height <= 0) throw new Error('invalid-image');
      const image = { uri: asset.uri, width: asset.width, height: asset.height, source: 'gallery' as const };
      Haptics.notification(Haptics.NotificationFeedbackType.Success);
      navigation.navigate('Review', { mode, image });
    } catch {
      if (mounted.current && focused.current) setGalleryError('Fotografia nu s-a deschis. Încearcă alta.');
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    } finally {
      galleryLocked.current = false;
      if (mounted.current) setGalleryBusy(false);
    }
  }, [mode, navigation, resume]);

  const openAllowance = () => {
    if (navigationLocked.current || galleryLocked.current) return;
    navigationLocked.current = true;
    navigation.navigate('Paywall', { source: 'home', ...(access ? { access } : {}) });
  };
  const openSettings = () => {
    if (navigationLocked.current || galleryLocked.current) return;
    navigationLocked.current = true;
    navigation.navigate('Settings');
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
      focused={homeFocused}
      pending={Boolean(pendingAnalysis)}
      galleryBusy={galleryBusy}
      galleryError={galleryError}
      allowance={allowance}
      resetAt={access.resetAt}
      remaining={access.remaining}
      limit={access.limit}
      premiumActive={Boolean(access?.premium.active)}
      latestLessonTitle={notebookPreview.latestTitle}
      savedLessonsCount={notebookPreview.count}
      showGuide={!guideDismissed}
      onDismissGuide={dismissGuide}
      onClearGalleryError={() => setGalleryError(null)}
      onMode={chooseMode}
      onCapture={openCapture}
      onGallery={() => void openGallery()}
      onMath={openMath}
      onNotebook={openNotebook}
      onSettings={openSettings}
      onAllowance={openAllowance}
    />
  );
}
