import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Animated, BackHandler, Keyboard, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';
import { useCommercial } from '../../features/access/context/CommercialContext';
import { HomeMotionReadyContext } from '../../features/home/context/HomeMotionContext';
import { HomeScreen } from '../../features/home/screens/HomeScreen';
import { NotebookScreen } from '../../features/lessons/screens/NotebookScreen';
import { getCachedFavoriteLessons } from '../../features/lessons/services/lessons';
import { getActiveStreakDays, usePracticeState } from '../../features/practice/services/practiceStorage';
import { StudyHubScreen } from '../../features/study/screens/StudyHubScreen';
import { useStudyProfile } from '../../features/study/services/studyStorage';
import { startStudyProgressSync } from '../../features/study/services/studySync';
import { getStudyTrackMeta } from '../../features/study/types';
import { useKeyboardHeight } from '../../shared/hooks/useKeyboardHeight';
import { useReducedMotion } from '../../shared/hooks/useReducedMotion';
import { colors } from '../../shared/theme';
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
  streakDays,
  wrongCount,
  captureActionRef,
  onOpenStudy,
  onOpenNotebookTab,
}: {
  active: boolean;
  studyTrackLabel: string;
  streakDays: number;
  wrongCount: number;
  captureActionRef: MutableRefObject<(() => void) | null>;
  onOpenStudy: () => void;
  onOpenNotebookTab: () => void;
}) {
  return (
    <HomeScreen
      embedded
      active={active}
      bottomClearance={8}
      studyTrackLabel={studyTrackLabel}
      streakDays={streakDays}
      wrongCount={wrongCount}
      captureActionRef={captureActionRef}
      onOpenStudy={onOpenStudy}
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
  const frame = useSafeAreaFrame();
  const stageWidth = Math.max(1, Math.round(frame.width));
  const reducedMotion = useReducedMotion();
  const motionReady = useContext(HomeMotionReadyContext);
  const { keyboardVisible } = useKeyboardHeight();
  const { authSessionKey } = useCommercial();
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
  const captureActionRef = useRef<(() => void) | null>(null);
  const railPosition = useRef(new Animated.Value(TAB_ORDER.solve)).current;
  const activeTabRef = useRef<StudioTabId>('solve');

  // Start cloud study-progress sync immediately behind LaunchSplash so track,
  // streak, and mistake data are ready right when Home appears.
  useEffect(() => {
    if (!authSessionKey) return undefined;
    return startStudyProgressSync();
  }, [authSessionKey]);

  // Flip StatusBar icons strictly after Home entrance finishes landing so Android
  // WindowInsetsController never triggers a mid-animation window relayout hitch.
  useEffect(() => {
    if (reducedMotion) {
      setStatusBarReady(true);
      return undefined;
    }
    if (!motionReady) {
      setStatusBarReady(false);
      return undefined;
    }
    const timer = setTimeout(() => setStatusBarReady(true), 940);
    return () => clearTimeout(timer);
  }, [motionReady, reducedMotion]);

  // Pre-warm offscreen Învață and Caiet tabs quietly after Home entrance finishes
  // landing (all Home data is already loaded during splash).
  useEffect(() => {
    if (!motionReady) return undefined;
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
  }, [motionReady]);

  useFocusEffect(useCallback(() => {
    setScreenFocused(true);
    setSavedLessonsCount(getCachedFavoriteLessons()?.length ?? 0);
    return () => {
      setScreenFocused(false);
    };
  }, []));

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
  const handleQuickCapture = useCallback(() => {
    Keyboard.dismiss();
    captureActionRef.current?.();
  }, []);

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

  return (
    <View style={styles.root}>
      {statusBarReady && screenFocused ? (
        <StatusBar style="light" />
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
              streakDays={streakDays}
              wrongCount={wrongCount}
              captureActionRef={captureActionRef}
              onOpenStudy={openStudyTab}
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
          ready={motionReady}
          active={screenFocused}
          notebookBadgeCount={notebookBadgeCount}
          studyDot={hasStudyAlerts}
          onSelect={selectTab}
          onQuickCapture={handleQuickCapture}
        />
      ) : null}
    </View>
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
