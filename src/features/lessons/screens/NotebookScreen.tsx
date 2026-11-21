import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useDelayedBusy } from '../../../shared/hooks/useDelayedBusy';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { recordDiagnosticError } from '../../../shared/services/diagnostics';
import * as Haptics from '../../../shared/services/haptics';
import { borders, colors, fonts, radii, shadows, springs, typography } from '../../../shared/theme';
import type { FlowMode, RootStackParamList, StoredLesson } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { Chip } from '../../../shared/ui/Chip';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { Text, TextInput } from '../../../shared/ui/Typography';
import { getCachedFavoriteLessons, setLessonFavorite, subscribeToFavoriteLessons } from '../services/lessons';
import {
  filterNotebookLessons,
  notebookFilterCounts,
  notebookProblemPresentation,
  notebookVerdictPresentation,
  type NotebookFilter,
} from '../utils/notebookPresentation';

type Props = NativeStackScreenProps<RootStackParamList, 'Notebook'>;

const tabs: { value: NotebookFilter; label: string }[] = [
  { value: 'all', label: 'Toate' },
  { value: 'solve', label: 'Rezolvate' },
  { value: 'check', label: 'Verificate' },
];

const verdictTones = {
  correct: { backgroundColor: colors.limeSoft, color: colors.ink },
  partial: { backgroundColor: colors.goldSoft, color: colors.ink },
  incorrect: { backgroundColor: colors.roseSoft, color: colors.berryDeep },
} as const;

function TrashGlyph({ size = 18, color = colors.inkSoft }: { size?: number; color?: string }) {
  return (
    <Svg accessible={false} width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 7h16M9 7V4.8h6V7M6.7 7l.9 13h8.8l.9-13M10 10.2v6.6M14 10.2v6.6" fill="none" stroke={color} strokeWidth={2.15} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function lessonTime(lesson: StoredLesson): string {
  const date = lesson.createdAt?.toDate?.();
  if (!date) return 'Salvată recent';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startLesson = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (startLesson === startToday) return `Astăzi · ${date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`;
  if (startLesson === startToday - 24 * 60 * 60 * 1000) return 'Ieri';
  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' }).replace('.', '');
}

function sameProblemPreview(previous: StoredLesson, next: StoredLesson) {
  const previousPreview = notebookProblemPresentation(previous);
  const nextPreview = notebookProblemPresentation(next);
  return previousPreview.identity === nextPreview.identity
    && previousPreview.title === nextPreview.title;
}

type LessonRowProps = {
  lesson: StoredLesson;
  newest: boolean;
  onOpen: (lesson: StoredLesson) => void;
  onRemove: (lesson: StoredLesson) => void;
};

const LessonRow = memo(function LessonRow({ lesson, newest, onOpen, onRemove }: LessonRowProps) {
  const presentation = notebookProblemPresentation(lesson);
  const verdict = notebookVerdictPresentation(lesson);
  const checked = lesson.mode === 'check';
  const tone = verdict?.tone === 'correct'
    ? colors.lime
    : verdict?.tone === 'incorrect'
      ? colors.rose
      : checked ? colors.peach : colors.cyan;
  const modeLabel = checked ? 'VERIFICATĂ' : 'REZOLVATĂ';
  const actionLabel = checked ? 'Vezi verificarea' : 'Vezi rezolvarea';
  const stepLabel = `${lesson.steps.length} ${lesson.steps.length === 1 ? 'pas explicat' : 'pași explicați'}`;
  const requestLabel = presentation.requestCount > 1 ? `${presentation.requestCount} cerințe` : undefined;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${modeLabel}: ${presentation.identity}. ${lesson.topic}. ${verdict ? `${verdict.label}. ` : ''}${stepLabel}.`}
      accessibilityHint={actionLabel}
      depth={4}
      radius={20}
      shadowColor={colors.ink}
      haptic="light"
      onPress={() => onOpen(lesson)}
      contentStyle={styles.lessonCard}
    >
      <View style={[styles.lessonRail, { backgroundColor: tone }]}>
        {[0, 1, 2].map((dot) => <View key={dot} style={styles.railDot} />)}
      </View>

      <View style={styles.lessonBody}>
        <View style={styles.lessonMeta}>
          <View style={styles.metaLeft}>
            <View style={[styles.modeDot, { backgroundColor: tone }]} />
            <Text style={styles.modeText}>{modeLabel}</Text>
            {newest ? (
              <View style={styles.newDot}>
                <Text style={styles.newDotText}>NOUĂ</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.timeText}>{lessonTime(lesson)}</Text>
        </View>

        <Text numberOfLines={2} style={styles.problemIdentity}>{presentation.title}</Text>

        <View style={styles.topicRow}>
          <View style={[styles.topicMarker, { backgroundColor: tone }]} />
          <Text numberOfLines={1} style={styles.topicText}>{lesson.topic}</Text>
          {verdict ? (
            <View style={[styles.verdictBadge, { backgroundColor: verdictTones[verdict.tone].backgroundColor }]}>
              <Text style={[styles.verdictText, { color: verdictTones[verdict.tone].color }]}>{verdict.label}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.lessonFooter}>
          <View style={styles.detailCluster}>
            <Text style={styles.detailText}>{stepLabel}</Text>
            {requestLabel ? (
              <>
                <View style={styles.detailDot} />
                <Text style={styles.detailText}>{requestLabel}</Text>
              </>
            ) : null}
          </View>

          <View style={styles.rowActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Scoate ${presentation.title} din Caiet`}
              hitSlop={8}
              onPress={(event) => {
                event.stopPropagation();
                onRemove(lesson);
              }}
              style={({ pressed }) => [styles.removeAction, pressed && styles.actionPressed]}
            >
              <TrashGlyph size={16} color={colors.inkSoft} />
              <Text style={styles.removeText}>Scoate</Text>
            </Pressable>
            <View style={styles.openChevron}>
              <MiniGlyph name="next" size={16} color={colors.paper} />
            </View>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}, (previous, next) => (
  previous.lesson.id === next.lesson.id
  && previous.lesson.topic === next.lesson.topic
  && previous.lesson.mode === next.lesson.mode
  && previous.lesson.steps.length === next.lesson.steps.length
  && previous.lesson.createdAt?.toDate?.().getTime() === next.lesson.createdAt?.toDate?.().getTime()
  && previous.newest === next.newest
  && previous.onOpen === next.onOpen
  && previous.onRemove === next.onRemove
  && sameProblemPreview(previous.lesson, next.lesson)
));

function LessonSeparator() {
  return <View style={styles.lessonSeparator} />;
}

function NotebookLoading() {
  const showProgress = useDelayedBusy(true, 300);
  return (
    <View style={styles.loadingState}>
      <Mascot pose="thinking" size={132} active />
      <Chip label="CAIETUL TĂU" tone="violetSoft" outlined={false} style={styles.stateChip} />
      <Text style={styles.loadingTitle}>Lecțiile tale, la un loc.</Text>
      <View style={styles.notebookProgress}>
        {showProgress ? <PlayfulLoader compact label="Sincronizez lecțiile" style={styles.notebookLoader} /> : null}
      </View>
    </View>
  );
}

type FullStateProps = {
  kind: 'empty' | 'error';
  onPrimary: () => void;
  onSecondary?: () => void;
};

function FullNotebookState({ kind, onPrimary, onSecondary }: FullStateProps) {
  const error = kind === 'error';
  return (
    <ScrollView
      alwaysBounceVertical={false}
      contentContainerStyle={styles.fullState}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.emptyMascotStage}>
        <View style={[styles.emptyHalo, error && styles.emptyHaloError]} />
        <Mascot pose={error ? 'oops' : 'wave'} size={142} active interactive />
      </View>
      <Chip
        label={error ? 'CONEXIUNE ÎNTRERUPTĂ' : 'PRIMA PAGINĂ E LIBERĂ'}
        tone={error ? 'peach' : 'lime'}
        tilt={-2}
      />
      <Text style={styles.fullStateTitle}>
        {error ? 'Caietul e încă pe raft' : 'Prima lecție merită un loc bun'}
      </Text>
      <Text style={styles.fullStateText}>
        {error
          ? 'Lecțiile tale rămân în siguranță. Verifică internetul și încearcă din nou.'
          : 'Rezolvă ori verifică o problemă, apoi salveaz-o. Revii oricând la enunț și la pașii explicați.'}
      </Text>
      <View style={styles.emptyActions}>
        <ComicButton
          compact
          title={error ? 'Reîncearcă' : 'Rezolvă prima problemă'}
          icon={error ? 'scan' : 'camera'}
          tone="lime"
          onPress={onPrimary}
        />
        {!error && onSecondary ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Sau verifică o rezolvare"
            haptic="selection"
            onPress={onSecondary}
            style={styles.secondaryEmptyWrap}
            contentStyle={styles.secondaryEmptyAction}
          >
            <Text style={styles.secondaryEmptyText}>Sau verifică o rezolvare →</Text>
          </PressableScale>
        ) : null}
      </View>
    </ScrollView>
  );
}

type FilterEmptyProps = {
  filter: NotebookFilter;
  query: string;
  onReset: () => void;
  onStart: (mode: FlowMode) => void;
};

function FilterEmpty({ filter, query, onReset, onStart }: FilterEmptyProps) {
  const searching = Boolean(query);
  const check = filter === 'check';
  const title = searching
    ? `Nicio problemă pentru „${query}”`
    : check ? 'Nicio verificare salvată' : 'Nicio problemă rezolvată';
  const description = searching
    ? 'Încearcă un capitol, o formulă sau un alt cuvânt din enunț.'
    : check ? 'Verifică o rezolvare, apoi păstreaz-o aici pentru recapitulare.' : 'Rezolvă o problemă, apoi salveaz-o în Caiet.';

  return (
    <View style={styles.filterEmpty}>
      <Mascot pose="thinking" size={108} active />
      <Text style={styles.filterEmptyTitle}>{title}</Text>
      <Text style={styles.filterEmptyText}>{description}</Text>
      <PressableScale
        accessibilityRole="button"
        depth={shadows.sm}
        radius={14}
        shadowColor={colors.ink}
        haptic="selection"
        onPress={searching ? onReset : () => onStart(check ? 'check' : 'solve')}
        style={styles.filterEmptyActionWrap}
        contentStyle={styles.filterEmptyAction}
      >
        <Text style={styles.filterEmptyActionText}>
          {searching ? 'Șterge căutarea' : check ? 'Verifică o rezolvare' : 'Rezolvă o problemă'}
        </Text>
      </PressableScale>
    </View>
  );
}

export function NotebookScreen({ navigation }: Props) {
  const { gutter, isNarrow } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [filter, setFilter] = useState<NotebookFilter>('all');
  const [queryText, setQueryText] = useState('');
  const deferredQueryText = useDeferredValue(queryText);
  const [notes, setNotes] = useState<StoredLesson[]>(() => getCachedFavoriteLessons() ?? []);
  const [loading, setLoading] = useState(() => getCachedFavoriteLessons() === undefined);
  const [loadError, setLoadError] = useState(false);
  const [subscriptionAttempt, setSubscriptionAttempt] = useState(0);
  const [pendingRemoval, setPendingRemoval] = useState<StoredLesson>();
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState(false);

  const listOpacity = useSharedValue(1);
  const removeProgress = useSharedValue(0);
  const closeRemoveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (closeRemoveTimer.current) clearTimeout(closeRemoveTimer.current);
  }, []);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;
    subscribeToFavoriteLessons(
      (lessons) => {
        if (!mounted) return;
        setNotes(lessons);
        setLoading(false);
        setLoadError(false);
      },
      (error) => {
        if (!mounted) return;
        recordDiagnosticError('notebook_subscription', error);
        setLoading(false);
        setLoadError(true);
      },
    ).then((stop) => {
      if (mounted) unsubscribe = stop;
      else stop();
    }).catch((error) => {
      if (!mounted) return;
      recordDiagnosticError('notebook_subscription', error);
      setLoading(false);
      setLoadError(true);
    });
    return () => { mounted = false; unsubscribe?.(); };
  }, [subscriptionAttempt]);

  const normalizedQuery = deferredQueryText.trim();
  const visibleNotes = useMemo(
    () => filterNotebookLessons(notes, filter, normalizedQuery),
    [filter, normalizedQuery, notes],
  );
  const counts = useMemo(() => notebookFilterCounts(notes), [notes]);

  const chooseFilter = useCallback((next: NotebookFilter) => {
    setFilter((current) => {
      if (current === next) return current;
      Haptics.selection();
      if (!reducedMotion) {
        listOpacity.set(0.86);
        listOpacity.set(withSpring(1, springs.snappy));
      }
      return next;
    });
  }, [listOpacity, reducedMotion]);

  const openNote = useCallback((lesson: StoredLesson) => {
    navigation.navigate('Lesson', { lesson, lessonId: lesson.id, isFavorite: true, source: 'notebook' });
  }, [navigation]);

  const requestRemove = useCallback((lesson: StoredLesson) => {
    if (closeRemoveTimer.current) clearTimeout(closeRemoveTimer.current);
    Haptics.selection();
    setRemoveError(false);
    setPendingRemoval(lesson);
    removeProgress.set(reducedMotion ? 1 : 0);
    if (!reducedMotion) {
      removeProgress.set(withSpring(1, springs.snappy));
    }
  }, [reducedMotion, removeProgress]);

  const closeRemoval = useCallback((force = false) => {
    if (removing && !force) return;
    if (closeRemoveTimer.current) clearTimeout(closeRemoveTimer.current);
    const finish = () => {
      setPendingRemoval(undefined);
      setRemoveError(false);
      removeProgress.set(0);
    };
    if (reducedMotion) {
      finish();
      return;
    }
    removeProgress.set(withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) }));
    closeRemoveTimer.current = setTimeout(finish, 155);
  }, [reducedMotion, removeProgress, removing]);

  const confirmRemoval = useCallback(async () => {
    const lesson = pendingRemoval;
    if (!lesson || removing) return;
    setRemoving(true);
    setRemoveError(false);
    try {
      await setLessonFavorite(lesson.id, false);
      setNotes((current) => current.filter((note) => note.id !== lesson.id));
      Haptics.notification(Haptics.NotificationFeedbackType.Success);
      setRemoving(false);
      closeRemoval(true);
    } catch (error) {
      recordDiagnosticError('notebook_update', error);
      setRemoveError(true);
      setRemoving(false);
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    }
  }, [closeRemoval, pendingRemoval, removing]);

  const startMode = useCallback((mode: FlowMode) => navigation.navigate('Capture', { mode }), [navigation]);
  const clearSearch = useCallback(() => setQueryText(''), []);
  const resetFilters = useCallback(() => {
    setQueryText('');
    chooseFilter('all');
  }, [chooseFilter]);
  const retrySubscription = useCallback(() => {
    setLoadError(false);
    setLoading(notes.length === 0);
    setSubscriptionAttempt((attempt) => attempt + 1);
  }, [notes.length]);

  const listAnimated = useAnimatedStyle(() => ({
    opacity: listOpacity.get(),
  }));

  const removeScrimStyle = useAnimatedStyle(() => ({
    opacity: removeProgress.get(),
  }));

  const removeSheetStyle = useAnimatedStyle(() => {
    const p = removeProgress.get();
    return {
      opacity: Math.min(1, p * 1.25),
      transform: [{ translateY: (1 - p) * 280 }],
    };
  });

  const newestNoteId = filter === 'all' && !normalizedQuery ? notes[0]?.id : undefined;
  const renderLesson = useCallback<ListRenderItem<StoredLesson>>(({ item }) => (
    <LessonRow lesson={item} newest={item.id === newestNoteId} onOpen={openNote} onRemove={requestRemove} />
  ), [newestNoteId, openNote, requestRemove]);
  const keyExtractor = useCallback((item: StoredLesson) => item.id, []);
  const activeTab = tabs.find((tab) => tab.value === filter)?.label ?? 'Toate';
  const resultLabel = normalizedQuery ? 'Rezultatele căutării' : filter === 'all' ? 'Probleme salvate' : activeTab;
  const headerCount = loading && notes.length === 0 ? 'LECȚII SALVATE' : `${notes.length} ${notes.length === 1 ? 'PROBLEMĂ SALVATĂ' : 'PROBLEME SALVATE'}`;
  const pendingRemovalTitle = pendingRemoval ? notebookProblemPresentation(pendingRemoval).title : '';

  if (loading && notes.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar style="dark" />
        <ComicBackdrop />
        <ScreenHeader title="Caietul meu" eyebrow={headerCount} onBack={() => navigation.goBack()} rightIcon="camera" rightLabel="Rezolvă o problemă nouă" onRight={() => startMode('solve')} />
        <NotebookLoading />
      </SafeAreaView>
    );
  }

  if (notes.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar style="dark" />
        <ComicBackdrop />
        <ScreenHeader title="Caietul meu" eyebrow={headerCount} onBack={() => navigation.goBack()} rightIcon="camera" rightLabel="Rezolvă o problemă nouă" onRight={() => startMode('solve')} />
        <FullNotebookState kind={loadError ? 'error' : 'empty'} onPrimary={loadError ? retrySubscription : () => startMode('solve')} onSecondary={() => startMode('check')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <ScreenHeader title="Caietul meu" eyebrow={headerCount} onBack={() => navigation.goBack()} rightIcon="camera" rightLabel="Rezolvă o problemă nouă" onRight={() => startMode('solve')} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.controls, { paddingHorizontal: gutter }]}>
          <View style={styles.searchShadow}>
            <View style={styles.searchBox}>
              <AppIcon name="search" size={28} />
              <TextInput
                autoCorrect={false}
                returnKeyType="search"
                value={queryText}
                onChangeText={setQueryText}
                placeholder={isNarrow ? 'Caută în enunțuri' : 'Caută în enunțuri, formule sau capitole'}
                placeholderTextColor={colors.inkSoft}
                selectionColor={colors.violet}
                style={styles.searchInput}
              />
              {queryText ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Șterge căutarea" hitSlop={9} onPress={clearSearch} style={styles.clearSearch}>
                  <MiniGlyph name="close" size={15} color={colors.ink} />
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.tabBar} accessibilityRole="tablist">
            {tabs.map((tab) => {
              const active = tab.value === filter;
              return (
                <Pressable
                  key={tab.value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => chooseFilter(tab.value)}
                  style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.tabPressed]}
                >
                  <Text numberOfLines={1} style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                  <View style={[styles.tabCount, active && styles.tabCountActive]}>
                    <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>{counts[tab.value]}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {loadError ? (
          <Pressable accessibilityRole="button" onPress={retrySubscription} style={[styles.syncWarning, { marginHorizontal: gutter }]}>
            <MiniGlyph name="spark" size={14} color={colors.ink} />
            <Text style={styles.syncWarningText}>Vezi copia salvată pe telefon. Atinge pentru reconectare.</Text>
          </Pressable>
        ) : null}

        <View style={[styles.listHeading, { paddingHorizontal: gutter }]}>
          <View>
            <Text style={styles.listEyebrow}>{normalizedQuery ? `CĂUTARE: ${normalizedQuery.toLocaleUpperCase('ro-RO')}` : 'CAIETUL TĂU'}</Text>
            <Text style={styles.listTitle}>{resultLabel}</Text>
          </View>
          <Text style={styles.visibleCount}>{visibleNotes.length} {visibleNotes.length === 1 ? 'problemă' : 'probleme'}</Text>
        </View>

        <Animated.View style={[styles.listMotion, listAnimated]}>
          <FlatList
            data={visibleNotes}
            renderItem={renderLesson}
            keyExtractor={keyExtractor}
            ItemSeparatorComponent={LessonSeparator}
            ListEmptyComponent={<FilterEmpty filter={filter} query={normalizedQuery} onReset={resetFilters} onStart={startMode} />}
            ListFooterComponent={<View style={styles.listFooter} />}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            initialNumToRender={7}
            maxToRenderPerBatch={7}
            windowSize={7}
            contentContainerStyle={[styles.listContent, { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 16) + 18 }]}
          />
        </Animated.View>
      </KeyboardAvoidingView>

      <Modal
        visible={Boolean(pendingRemoval)}
        transparent
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={removing ? undefined : () => closeRemoval()}
      >
        <View style={styles.removeModalLayer}>
          <Animated.View pointerEvents="none" style={[styles.removeScrim, removeScrimStyle]} />
          <Pressable accessible={false} disabled={removing} onPress={() => closeRemoval()} style={StyleSheet.absoluteFill} />
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.removeSheet,
              { paddingBottom: Math.max(insets.bottom, 14) + 10 },
              removeSheetStyle,
            ]}
          >
            <View style={styles.removeHandle} />
            <View style={styles.removeSheetIcon}><TrashGlyph size={32} color={colors.ink} /></View>
            <Text style={styles.removeEyebrow}>GESTIONEAZĂ CAIETUL</Text>
            <Text style={styles.removeTitle}>Scoți problema din Caiet?</Text>
            <Text numberOfLines={2} style={styles.removeLessonTitle}>{pendingRemovalTitle}</Text>
            <Text style={styles.removeDescription}>Lecția va dispărea din lista ta. Fotografia nu este păstrată în Caiet.</Text>
            {removeError ? <Text accessibilityRole="alert" style={styles.removeError}>Nu am putut actualiza Caietul. Verifică internetul și încearcă din nou.</Text> : null}
            <PressableScale
              accessibilityRole="button"
              disabled={removing}
              depth={shadows.sm}
              radius={17}
              shadowColor={colors.ink}
              haptic="medium"
              onPress={() => void confirmRemoval()}
              style={styles.confirmRemoveWrap}
              contentStyle={styles.confirmRemove}
            >
              {removing ? <PlayfulLoader micro inverse /> : <MiniGlyph name="wrong" size={17} color={colors.paper} />}
              <Text style={styles.confirmRemoveText}>{removing ? 'Actualizez Caietul…' : 'Da, scoate problema'}</Text>
            </PressableScale>
            <Pressable accessibilityRole="button" disabled={removing} onPress={() => closeRemoval()} style={({ pressed }) => [styles.keepLesson, pressed && styles.actionPressed]}>
              <Text style={styles.keepLessonText}>Păstreaz-o în Caiet</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1, minHeight: 0 },
  controls: { paddingTop: 4, gap: 9 },

  searchShadow: { borderRadius: 17, backgroundColor: colors.ink, paddingBottom: 3 },
  searchBox: {
    height: 48,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    borderRadius: 16,
    backgroundColor: colors.paper,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
  },
  searchInput: { flex: 1, height: 44, paddingVertical: 0, fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 13.5 },
  clearSearch: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center' },

  tabBar: {
    height: 46,
    borderRadius: 16,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    flexDirection: 'row',
    padding: 3,
    gap: 3,
  },
  tab: { flex: 1, minWidth: 0, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 4 },
  tabActive: { backgroundColor: colors.violet, borderWidth: 1.5, borderColor: colors.ink },
  tabPressed: { opacity: 0.78 },
  tabText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 12 },
  tabTextActive: { color: colors.paper },
  tabCount: { minWidth: 22, height: 22, borderRadius: 8, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  tabCountActive: { backgroundColor: colors.lime },
  tabCountText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 11 },
  tabCountTextActive: { color: colors.ink },

  syncWarning: {
    minHeight: 40,
    marginTop: 8,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.peachSoft,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  syncWarningText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11.5, lineHeight: 15 },

  listHeading: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 4 },
  listEyebrow: { ...typography.kicker, fontSize: 10.5, color: colors.violetDeep },
  listTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 20, lineHeight: 23, marginTop: 1 },
  visibleCount: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 12 },

  listMotion: { flex: 1, minHeight: 0 },
  listContent: { flexGrow: 1 },
  lessonSeparator: { height: 12 },

  lessonCard: {
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    flexDirection: 'row',
  },
  lessonRail: {
    width: 12,
    borderRightWidth: borders.thin,
    borderRightColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 18,
  },
  railDot: { width: 6, height: 6, borderRadius: 3, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.paper },
  lessonBody: { flex: 1, minWidth: 0, paddingHorizontal: 13, paddingTop: 11, paddingBottom: 10 },
  lessonMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  metaLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  modeDot: { width: 9, height: 9, borderRadius: 3, borderWidth: 1, borderColor: colors.ink },
  modeText: { ...typography.kicker, fontSize: 10.5, color: colors.violetDeep },
  newDot: {
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    paddingHorizontal: 6,
    paddingVertical: 1,
    transform: [{ rotate: '2deg' }],
  },
  newDotText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9.5, letterSpacing: 0.5 },
  timeText: { fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 11.5 },
  problemIdentity: { marginTop: 5, fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 18, lineHeight: 22 },
  topicRow: { minHeight: 22, marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 6 },
  topicMarker: { width: 12, height: 4, borderRadius: 3 },
  topicText: { flex: 1, minWidth: 0, fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 12.5 },
  verdictBadge: {
    flexShrink: 0,
    minHeight: 22,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.ink,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verdictText: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.45 },

  lessonFooter: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1.5,
    borderTopColor: '#EFEAF8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailCluster: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 12 },
  detailDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.line },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  removeAction: {
    minHeight: 34,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.paperTint,
  },
  removeText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 11.5 },
  openChevron: {
    width: 32,
    height: 32,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingState: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 34 },
  stateChip: { marginTop: 12 },
  notebookProgress: { minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  loadingTitle: { marginTop: 8, fontFamily: fonts.display, color: colors.ink, fontSize: 23, lineHeight: 28, textAlign: 'center' },
  notebookLoader: { marginTop: 16 },

  fullState: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: 14, paddingBottom: 32 },
  emptyMascotStage: { width: 170, height: 158, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyHalo: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: colors.violetSoft,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderColor: colors.violet,
  },
  emptyHaloError: { backgroundColor: colors.peachSoft, borderColor: colors.peach },
  fullStateTitle: { marginTop: 10, fontFamily: fonts.display, color: colors.ink, fontSize: 24, lineHeight: 28, textAlign: 'center' },
  fullStateText: { maxWidth: 330, marginTop: 6, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  emptyActions: { width: '100%', maxWidth: 340, marginTop: 22, gap: 6 },
  secondaryEmptyWrap: { alignSelf: 'center' },
  secondaryEmptyAction: { minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryEmptyText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 13 },

  actionPressed: { opacity: 0.72 },
  filterEmpty: { minHeight: 310, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  filterEmptyTitle: { marginTop: 10, fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 20, textAlign: 'center' },
  filterEmptyText: { maxWidth: 310, marginTop: 4, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  filterEmptyActionWrap: { marginTop: 14 },
  filterEmptyAction: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterEmptyActionText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 13 },

  removeModalLayer: { flex: 1, justifyContent: 'flex-end' },
  removeScrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16, 12, 38, 0.68)' },
  removeSheet: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: borders.thick,
    borderBottomWidth: 0,
    borderColor: colors.ink,
    backgroundColor: colors.canvas,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  removeHandle: { width: 46, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 10 },
  removeSheetIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.roseSoft,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  removeEyebrow: { marginTop: 12, ...typography.kicker, color: colors.violetDeep },
  removeTitle: { marginTop: 4, fontFamily: fonts.display, color: colors.ink, fontSize: 24, lineHeight: 28, textAlign: 'center' },
  removeLessonTitle: { maxWidth: 430, marginTop: 6, fontFamily: fonts.displaySemi, color: colors.violetDeep, fontSize: 15.5, lineHeight: 20, textAlign: 'center' },
  removeDescription: { maxWidth: 430, marginTop: 7, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 18.5, textAlign: 'center' },
  removeError: { width: '100%', marginTop: 10, borderRadius: radii.sm, backgroundColor: colors.roseSoft, padding: 10, fontFamily: fonts.bodyBold, color: colors.berryDeep, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  confirmRemoveWrap: { width: '100%', maxWidth: 430, marginTop: 16 },
  confirmRemove: {
    width: '100%',
    minHeight: 52,
    borderRadius: 17,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.rose,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmRemoveText: { fontFamily: fonts.displaySemi, color: colors.paper, fontSize: 16.5 },
  keepLesson: { minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 6 },
  keepLessonText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 13 },
  listFooter: { height: 6 },
});
