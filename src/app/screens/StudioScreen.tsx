import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Keyboard, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCommercial } from '../../features/access/context/CommercialContext';
import { HomeScreen } from '../../features/home/screens/HomeScreen';
import { NotebookScreen } from '../../features/lessons/screens/NotebookScreen';
import { getCachedFavoriteLessons } from '../../features/lessons/services/lessons';
import { usePracticeState } from '../../features/practice/services/practiceStorage';
import { StudyHubScreen } from '../../features/study/screens/StudyHubScreen';
import { useStudyProfile } from '../../features/study/services/studyStorage';
import { startStudyProgressSync } from '../../features/study/services/studySync';
import { useKeyboardHeight } from '../../shared/hooks/useKeyboardHeight';
import { colors } from '../../shared/theme';
import { STUDIO_DOCK_HEIGHT, StudioTabBar, type StudioTabId } from '../components/StudioTabBar';

/**
 * Root 3-tab Profu studio shell hosted at route "Home".
 *
 * Frame 0 mounts ONLY HomeScreen ("Rezolvă") so cold startup stays instant.
 * "Învață" and "Caiet" mount lazily on first tap and stay mounted in memory
 * for zero-latency switching while pausing inactive animations automatically.
 */
export function StudioScreen() {
  const insets = useSafeAreaInsets();
  const { keyboardVisible } = useKeyboardHeight();
  const { authSessionKey } = useCommercial();
  const profile = useStudyProfile();
  const practiceState = usePracticeState();
  const [activeTab, setActiveTab] = useState<StudioTabId>('solve');
  const [visited, setVisited] = useState<{ study: boolean; notebook: boolean }>({
    study: false,
    notebook: false,
  });
  const [savedLessonsCount, setSavedLessonsCount] = useState<number>(
    () => getCachedFavoriteLessons()?.length ?? 0,
  );
  const [screenFocused, setScreenFocused] = useState(true);

  useEffect(() => {
    if (!authSessionKey) return undefined;
    return startStudyProgressSync();
  }, [authSessionKey]);

  useFocusEffect(useCallback(() => {
    setScreenFocused(true);
    setSavedLessonsCount(getCachedFavoriteLessons()?.length ?? 0);
    return () => {
      setScreenFocused(false);
    };
  }, []));

  useEffect(() => {
    if (!screenFocused || activeTab === 'solve') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      Keyboard.dismiss();
      setActiveTab('solve');
      return true;
    });
    return () => subscription.remove();
  }, [activeTab, screenFocused]);

  const selectTab = useCallback((next: StudioTabId) => {
    Keyboard.dismiss();
    setActiveTab(next);
    if (next === 'study') {
      setVisited((current) => (current.study ? current : { ...current, study: true }));
    } else if (next === 'notebook') {
      setVisited((current) => (current.notebook ? current : { ...current, notebook: true }));
    }
  }, []);

  const openStudyTab = useCallback(() => selectTab('study'), [selectTab]);
  const openNotebookTab = useCallback(() => selectTab('notebook'), [selectTab]);

  const bottomClearance = STUDIO_DOCK_HEIGHT + Math.max(insets.bottom, 10) + 18;
  const notebookBadgeCount = savedLessonsCount
    + profile.favoriteFormulaIds.length
    + practiceState.wrongQuestionIds.length;

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.tabLayer,
          activeTab !== 'solve' && styles.tabHidden,
        ]}
      >
        <HomeScreen
          embedded
          active={activeTab === 'solve'}
          bottomClearance={bottomClearance}
          onOpenStudy={openStudyTab}
          onOpenNotebookTab={openNotebookTab}
        />
      </View>

      {visited.study ? (
        <View
          style={[
            styles.tabLayer,
            activeTab !== 'study' && styles.tabHidden,
          ]}
        >
          <StudyHubScreen
            active={screenFocused && activeTab === 'study'}
            bottomClearance={bottomClearance}
          />
        </View>
      ) : null}

      {visited.notebook ? (
        <View
          style={[
            styles.tabLayer,
            activeTab !== 'notebook' && styles.tabHidden,
          ]}
        >
          <NotebookScreen
            embedded
            active={activeTab === 'notebook'}
            bottomClearance={bottomClearance}
          />
        </View>
      ) : null}

      {!keyboardVisible ? (
        <StudioTabBar
          activeTab={activeTab}
          notebookBadgeCount={notebookBadgeCount}
          onSelect={selectTab}
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
  tabLayer: {
    flex: 1,
  },
  tabHidden: {
    display: 'none',
  },
});
