import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Animated, BackHandler, Keyboard, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';
import { useCommercial } from '../../features/access/context/CommercialContext';
import { WelcomeOnboardingScreen } from '../../features/account/screens/WelcomeOnboardingScreen';
import { getPreparedPendingAnalysis } from '../../features/analysis/services/pendingAnalysis';
import { HomeMotionReadyContext } from '../../features/home/context/HomeMotionContext';
import { HomeScreen } from '../../features/home/screens/HomeScreen';
import { NotebookScreen } from '../../features/lessons/screens/NotebookScreen';
import {
  getCachedFavoriteLessons,
  subscribeFavoriteLessonsCache,
} from '../../features/lessons/services/lessons';
import { getActiveStreakDays, usePracticeState } from '../../features/practice/services/practiceStorage';
import { StudyTrackSheet } from '../../features/study/components/StudyTrackSheet';
import { StudyHubScreen } from '../../features/study/screens/StudyHubScreen';
import { setStudyTrack, useStudyProfile } from '../../features/study/services/studyStorage';
import { getStudyTrackMeta, type StudyTrackId } from '../../features/study/types';
import { useActionToast } from '../../shared/hooks/useActionToast';
import { useKeyboardHeight } from '../../shared/hooks/useKeyboardHeight';
import { useReducedMotion } from '../../shared/hooks/useReducedMotion';
import * as Haptics from '../../shared/services/haptics';
import {
  hasConfirmedAgeEligibility,
  saveAgeEligibilityConfirmation,
} from '../../shared/storage/localPreferences';
import { colors } from '../../shared/theme';
import type { RootStackParamList } from '../../shared/types';
import { ActionToast } from '../../shared/ui/ActionToast';
import type { AgeEligibilityGroup } from '../../shared/utils/ageEligibility';
import { StudioTabBar, type StudioTabId } from '../components/StudioTabBar';

// Spatial rail order matching the Split-Island dock: Rezolvă (0) -> Învață (1) -> Caiet (2)
const TAB_ORDER: Record<StudioTabId, 0 | 1 | 2> = {
  solve: 0,
  study: 1,
  notebook: 2,
};

const MemoHomePane = memo(function MemoHomePane({
  active,
  studyTrackLabel,
  studyTrackChosen,
  streakDays,
  wrongCount,
  captureActionRef,
  onOpenStudy,
  onChooseStudyTrack,
  onOpenNotebookTab,
}: {
  active: boolean;
  studyTrackLabel: string;
  studyTrackChosen: boolean;
  streakDays: number;
  wrongCount: number;
  captureActionRef: MutableRefObject<(() => void) | null>;
  onOpenStudy: () => void;
  onChooseStudyTrack: () => void;
  onOpenNotebookTab: () => void;
}) {
  return (
    <HomeScreen
      embedded
      active={active}
      bottomClearance={8}
      studyTrackLabel={studyTrackLabel}
      studyTrackChosen={studyTrackChosen}
      streakDays={streakDays}
      wrongCount={wrongCount}
      captureActionRef={captureActionRef}
      onOpenStudy={onOpenStudy}
      onChooseStudyTrack={onChooseStudyTrack}
      onOpenNotebookTab={onOpenNotebookTab}
    />
  );
});

const MemoStudyPane = memo(function MemoStudyPane({ active }: { active: boolean }) {
  return <StudyHubScreen active={active} bottomClearance={22} />;
});

const MemoNotebookPane = memo(function MemoNotebookPane({ active }: { active: boolean }) {
  return <NotebookScreen embedded active={active} bottomClearance={22} />;
});

/**
 * Root 3-tab Profu studio shell hosted at route "Home".
 *
 * Frame 0 mounts ONLY HomeScreen ("Rezolvă") so cold startup stays instant.
 * Once the launch splash settles, Învață and Caiet pre-warm quietly offscreen
 * in staggered idle slices so tapping any tab glides smoothly at 60fps on the
 * Android RenderThread with zero first-tap freeze and zero display:none layout
 * thrash. StudioTabBar lives in its own bottom flex slot so scrolling content
 * can never bleed underneath the navigator.
 */
export function StudioScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const frame = useSafeAreaFrame();
  const stageWidth = Math.max(1, Math.round(frame.width));
  const reducedMotion = useReducedMotion();
  const motionReady = useContext(HomeMotionReadyContext);
  const { keyboardVisible } = useKeyboardHeight();
  const { authSessionKey, access, refresh: refreshAccess } = useCommercial();
  const profile = useStudyProfile();
  const practiceState = usePracticeState();

  const [activeTab, setActiveTab] = useState<StudioTabId>('solve');
  const [settledTab, setSettledTab] = useState<StudioTabId>('solve');
  const [mountedTabs, setMountedTabs] = useState<{ study: boolean; notebook: boolean }>({
    study: false,
    notebook: false,
  });
  const [savedLessonsCount, setSavedLessonsCount] = useState<number>(
    () => getCachedFavoriteLessons()?.length ?? 0,
  );
  const [screenFocused, setScreenFocused] = useState(true);
  const [statusBarReady, setStatusBarReady] = useState(reducedMotion);
  const [homeTrackSheetOpen, setHomeTrackSheetOpen] = useState(false);
  const [homeTrackSheetEverOpened, setHomeTrackSheetEverOpened] = useState(false);
  const [ageConsentConfirmed, setAgeConsentConfirmed] = useState<boolean>(
    () => hasConfirmedAgeEligibility(),
  );
  const [postOnboardingReveal, setPostOnboardingReveal] = useState<boolean>(
    () => hasConfirmedAgeEligibility(),
  );
  const { toast, showToast } = useActionToast();
  const captureActionRef = useRef<(() => void) | null>(null);
  const railPosition = useRef(new Animated.Value(TAB_ORDER.solve)).current;
  const activeTabRef = useRef<StudioTabId>('solve');
  const effectiveHomeMotionReady = motionReady && postOnboardingReveal;

  // After completing first-launch onboarding, mount Home pre-rasterized for two
  // frames on the shared warm cream canvas, then unleash Home's full entrance
  // choreography (sky canopy unfurl, hero cascade, and Split-Island dock rise).
  useEffect(() => {
    if (!ageConsentConfirmed || postOnboardingReveal) return undefined;
    if (reducedMotion) {
      setPostOnboardingReveal(true);
      return undefined;
    }
    let secondFrame: number | undefined;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        setPostOnboardingReveal(true);
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
    };
  }, [ageConsentConfirmed, postOnboardingReveal, reducedMotion]);

  // Keep the Caiet dock badge synchronized live whenever lessons finish
  // prewarming, arrive after Google sign-in, are saved/removed, or clear on
  // Google sign-out.
  useEffect(() => {
    const syncCount = () => {
      const next = getCachedFavoriteLessons()?.length ?? 0;
      setSavedLessonsCount((current) => (current === next ? current : next));
    };
    syncCount();
    return subscribeFavoriteLessonsCache(syncCount);
  }, [authSessionKey]);

  // Flip StatusBar icons strictly after Home entrance finishes landing so Android
  // WindowInsetsController never triggers a mid-animation window relayout hitch.
  useEffect(() => {
    if (reducedMotion) {
      setStatusBarReady(true);
      return undefined;
    }
    if (!effectiveHomeMotionReady) {
      setStatusBarReady(false);
      return undefined;
    }
    const timer = setTimeout(() => setStatusBarReady(true), 940);
    return () => clearTimeout(timer);
  }, [effectiveHomeMotionReady, reducedMotion]);

  // Pre-warm offscreen Învață and Caiet tabs quietly after onboarding is done and Home entrance settles.
  useEffect(() => {
    if (!effectiveHomeMotionReady || !ageConsentConfirmed) return undefined;
    const studyTimer = setTimeout(() => {
      setMountedTabs((current) => (current.study ? current : { ...current, study: true }));
    }, 1_900);
    const notebookTimer = setTimeout(() => {
      setMountedTabs((current) => (current.notebook ? current : { ...current, notebook: true }));
    }, 2_600);
    return () => {
      clearTimeout(studyTimer);
      clearTimeout(notebookTimer);
    };
  }, [ageConsentConfirmed, effectiveHomeMotionReady]);

  useFocusEffect(useCallback(() => {
    setScreenFocused(true);
    setSavedLessonsCount(getCachedFavoriteLessons()?.length ?? 0);
    const confirmed = hasConfirmedAgeEligibility();
    setAgeConsentConfirmed(confirmed);
    if (!confirmed) {
      setPostOnboardingReveal(false);
      activeTabRef.current = 'solve';
      setActiveTab('solve');
      setSettledTab('solve');
      railPosition.setValue(TAB_ORDER.solve);
      setMountedTabs({ study: false, notebook: false });
      setHomeTrackSheetOpen(false);
    }
    return () => {
      setScreenFocused(false);
    };
  }, [railPosition]));

  // Smooth pure-GPU horizontal slide aligned with Split-Island tab order.
  useEffect(() => {
    const target = TAB_ORDER[activeTab];
    railPosition.stopAnimation();
    if (reducedMotion) {
      railPosition.setValue(target);
      setSettledTab(activeTab);
      return undefined;
    }

    let cancelled = false;
    const anim = Animated.spring(railPosition, {
      toValue: target,
      tension: 215,
      friction: 25,
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (!cancelled && finished) {
        setSettledTab(activeTab);
      }
    });

    const settleGuard = setTimeout(() => {
      if (!cancelled) setSettledTab(activeTab);
    }, 290);

    return () => {
      cancelled = true;
      clearTimeout(settleGuard);
      anim.stop();
    };
  }, [activeTab, railPosition, reducedMotion]);

  const selectTab = useCallback((next: StudioTabId) => {
    if (activeTabRef.current === next) return;
    Keyboard.dismiss();
    activeTabRef.current = next;
    setActiveTab(next);
    if (next === 'study') {
      setMountedTabs((current) => (current.study ? current : { ...current, study: true }));
    } else if (next === 'notebook') {
      setMountedTabs((current) => (current.notebook ? current : { ...current, notebook: true }));
    }
  }, []);

  useEffect(() => {
    if (!screenFocused || activeTab === 'solve') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      selectTab('solve');
      return true;
    });
    return () => subscription.remove();
  }, [activeTab, screenFocused, selectTab]);

  const openStudyTab = useCallback(() => selectTab('study'), [selectTab]);
  const openNotebookTab = useCallback(() => selectTab('notebook'), [selectTab]);
  const openHomeTrackPicker = useCallback(() => {
    Haptics.selection();
    setHomeTrackSheetEverOpened(true);
    setHomeTrackSheetOpen(true);
  }, []);
  const handleSelectHomeTrack = useCallback((next: StudyTrackId) => {
    setStudyTrack(next);
    const meta = getStudyTrackMeta(next);
    showToast({ message: `Nivel activ: ${meta.label}`, tone: 'lime' });
  }, [showToast]);
  const handleQuickCapture = useCallback(() => {
    Keyboard.dismiss();
    if (captureActionRef.current) {
      captureActionRef.current();
      return;
    }
    const pending = getPreparedPendingAnalysis();
    if (pending) {
      if (pending.schemaVersion === 3) navigation.navigate('MathProcessing', { ...pending, origin: 'home' });
      else navigation.navigate('Processing', { ...pending, origin: 'home' });
      return;
    }
    selectTab('solve');
    void refreshAccess();
    showToast({
      message: 'Verificăm accesul înainte să deschidem camera.',
      tone: 'neutral',
    });
  }, [navigation, refreshAccess, selectTab, showToast]);
  const handleConfirmAgeEligibility = useCallback((group: AgeEligibilityGroup, track: StudyTrackId | null) => {
    saveAgeEligibilityConfirmation(group);
    if (track) {
      setStudyTrack(track);
    }
    setPostOnboardingReveal(reducedMotion);
    setAgeConsentConfirmed(true);
  }, [reducedMotion]);
  const handleOpenLegalFromConsent = useCallback(() => {
    navigation.navigate('Legal');
  }, [navigation]);

  const railAnimatedStyle = useMemo(
    () => ({
      width: stageWidth * 3,
      transform: [
        {
          translateX: railPosition.interpolate({
            inputRange: [0, 1, 2],
            outputRange: [0, -stageWidth, -stageWidth * 2],
          }),
        },
      ],
    }),
    [railPosition, stageWidth],
  );

  const notebookBadgeCount = savedLessonsCount
    + profile.favoriteFormulaIds.length
    + practiceState.wrongQuestionIds.length;
  const streakDays = getActiveStreakDays(practiceState);
  const wrongCount = practiceState.wrongQuestionIds.length;
  const trackShortLabel = getStudyTrackMeta(profile.track).shortLabel;
  const hasStudyAlerts = wrongCount > 0;

  if (!ageConsentConfirmed) {
    return (
      <WelcomeOnboardingScreen
        active={screenFocused && motionReady}
        ready={motionReady}
        onConfirm={handleConfirmAgeEligibility}
        onOpenLegal={handleOpenLegalFromConsent}
      />
    );
  }

  return (
    <HomeMotionReadyContext.Provider value={effectiveHomeMotionReady}>
    <View style={styles.root}>
      {statusBarReady && screenFocused ? (
        <StatusBar style={activeTab === 'solve' && !access ? 'dark' : 'light'} />
      ) : null}
      <View style={styles.contentStage}>
        <Animated.View
          collapsable={false}
          style={[styles.rail, railAnimatedStyle]}
        >
          {/* Pane 0: Rezolvă (Home) */}
          <View
            pointerEvents={activeTab === 'solve' ? 'auto' : 'none'}
            importantForAccessibility={activeTab === 'solve' ? 'yes' : 'no-hide-descendants'}
            style={[styles.pane, { width: stageWidth }]}
          >
            <MemoHomePane
              active={screenFocused && settledTab === 'solve' && activeTab === 'solve'}
              studyTrackLabel={trackShortLabel}
              studyTrackChosen={profile.hasChosenTrack}
              streakDays={streakDays}
              wrongCount={wrongCount}
              captureActionRef={captureActionRef}
              onOpenStudy={openStudyTab}
              onChooseStudyTrack={openHomeTrackPicker}
              onOpenNotebookTab={openNotebookTab}
            />
          </View>

          {/* Pane 1: Învață */}
          <View
            pointerEvents={activeTab === 'study' ? 'auto' : 'none'}
            importantForAccessibility={activeTab === 'study' ? 'yes' : 'no-hide-descendants'}
            style={[styles.pane, { width: stageWidth }]}
          >
            {mountedTabs.study ? (
              <MemoStudyPane active={screenFocused && settledTab === 'study' && activeTab === 'study'} />
            ) : null}
          </View>

          {/* Pane 2: Caiet */}
          <View
            pointerEvents={activeTab === 'notebook' ? 'auto' : 'none'}
            importantForAccessibility={activeTab === 'notebook' ? 'yes' : 'no-hide-descendants'}
            style={[styles.pane, { width: stageWidth }]}
          >
            {mountedTabs.notebook ? (
              <MemoNotebookPane active={screenFocused && settledTab === 'notebook' && activeTab === 'notebook'} />
            ) : null}
          </View>
        </Animated.View>
      </View>

      {!keyboardVisible ? (
        <StudioTabBar
          activeTab={activeTab}
          ready={effectiveHomeMotionReady}
          active={screenFocused}
          notebookBadgeCount={notebookBadgeCount}
          studyDot={hasStudyAlerts}
          onSelect={selectTab}
          onQuickCapture={handleQuickCapture}
        />
      ) : null}

      {homeTrackSheetEverOpened ? (
        <StudyTrackSheet
          visible={homeTrackSheetOpen}
          selectedTrack={profile.hasChosenTrack ? profile.track : null}
          onSelect={handleSelectHomeTrack}
          onClose={() => setHomeTrackSheetOpen(false)}
        />
      ) : null}

      <ActionToast toast={toast} bottomOffset={96} />
    </View>
    </HomeMotionReadyContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  contentStage: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  rail: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  pane: {
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
  },
});
