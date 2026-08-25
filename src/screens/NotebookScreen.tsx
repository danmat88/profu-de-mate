import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { AppIcon } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { MiniGlyph } from '../components/MiniGlyph';
import { PlayfulLoader } from '../components/PlayfulLoader';
import { ScreenHeader } from '../components/ScreenHeader';
import { Text, TextInput } from '../components/Typography';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { recordDiagnosticError } from '../services/diagnostics';
import { getCachedFavoriteLessons, setLessonFavorite, subscribeToFavoriteLessons } from '../services/lessons';
import { colors, fonts } from '../theme';
import type { FlowMode, RootStackParamList, StoredLesson } from '../types';
import {
  filterNotebookLessons,
  notebookFilterCounts,
  notebookProblemPresentation,
  notebookVerdictPresentation,
  type NotebookFilter,
} from '../utils/notebookPresentation';

type Props = NativeStackScreenProps<RootStackParamList, 'Notebook'>;

const tabs: Array<{ value: NotebookFilter; label: string }> = [
  { value: 'all', label: 'Toate' },
  { value: 'solve', label: 'Rezolvate' },
  { value: 'check', label: 'Verificate' },
];

const verdictTones = {
  correct: { backgroundColor: colors.limeSoft, color: colors.ink },
  partial: { backgroundColor: '#FFE3B8', color: colors.ink },
  incorrect: { backgroundColor: colors.rose, color: colors.paper },
} as const;

function TrashGlyph({ size = 19, color = colors.inkSoft }: { size?: number; color?: string }) {
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
    <View style={styles.lessonShadow}>
      <View style={styles.lessonCard}>
        <View style={[styles.lessonRail, { backgroundColor: tone }]}>
          {[0, 1, 2].map((dot) => <View key={dot} style={styles.railDot} />)}
        </View>
        <View style={styles.lessonBody}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${modeLabel}: ${presentation.identity}. ${lesson.topic}. ${verdict ? `${verdict.label}. ` : ''}${stepLabel}.`}
            accessibilityHint={actionLabel}
            onPress={() => onOpen(lesson)}
            style={({ pressed }) => [styles.lessonMain, pressed && styles.lessonMainPressed]}
          >
            <View style={styles.lessonMeta}>
              <View style={styles.metaLeft}>
                <View style={[styles.modeDot, { backgroundColor: tone }]} />
                <Text style={styles.modeText}>{modeLabel}</Text>
                {newest ? <View style={styles.newDot}><Text style={styles.newDotText}>NOUĂ</Text></View> : null}
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
          </Pressable>

          <View style={styles.lessonFooter}>
            <View style={styles.detailCluster}>
              <Text style={styles.detailText}>{stepLabel}</Text>
              {requestLabel ? <><View style={styles.detailDot} /><Text style={styles.detailText}>{requestLabel}</Text></> : null}
            </View>
            <View style={styles.rowActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Scoate ${presentation.title} din Caiet`}
                onPress={() => onRemove(lesson)}
                style={({ pressed }) => [styles.removeAction, pressed && styles.actionPressed]}
              >
                <TrashGlyph />
                <Text style={styles.removeText}>Scoate</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={actionLabel}
                onPress={() => onOpen(lesson)}
                style={({ pressed }) => [styles.openAction, pressed && styles.actionPressed]}
              >
                <Text style={styles.openText}>Deschide</Text>
                <View style={styles.openArrow}><MiniGlyph name="next" size={15} color={colors.paper} /></View>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
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

function NotebookIllustration({ error = false }: { error?: boolean }) {
  return (
    <View style={styles.emptyIllustration}>
      <View style={styles.emptyDeskSpot} />
      <View style={styles.emptyPageBack} />
      <View style={styles.emptyPage}>
        <View style={styles.emptyBinding}>
          {[0, 1, 2, 3].map((ring) => <View key={ring} style={styles.emptyRing} />)}
        </View>
        <View style={styles.emptyPageCopy}>
          <View style={styles.emptyLineLong} />
          <View style={styles.emptyLineShort} />
          <View style={styles.emptyFormula}><Text style={styles.emptyFormulaText}>x + ?</Text></View>
        </View>
        <View style={styles.emptyBookmark} />
      </View>
      <View style={styles.emptyIcon}><AppIcon name={error ? 'help' : 'notebook'} size={66} /></View>
      <View style={styles.emptySpark}><MiniGlyph name="spark" size={18} color={colors.violetDeep} /></View>
    </View>
  );
}

function NotebookLoading() {
  return (
    <View style={styles.loadingState}>
      <NotebookIllustration />
      <Text style={styles.fullStateEyebrow}>CAIETUL TĂU</Text>
      <Text style={styles.loadingTitle}>Așez lecțiile în ordine</Text>
      <PlayfulLoader
        label="Deschid Caietul"
        note="Aduc enunțurile și pașii salvați, fără să mut ecranul din loc."
        style={styles.notebookLoader}
      />
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
      <NotebookIllustration error={error} />
      <Text style={styles.fullStateEyebrow}>{error ? 'CONEXIUNE ÎNTRERUPTĂ' : 'PRIMA PAGINĂ E LIBERĂ'}</Text>
      <Text style={styles.fullStateTitle}>{error ? 'Caietul e încă pe raft' : 'Prima lecție merită un loc bun'}</Text>
      <Text style={styles.fullStateText}>{error
        ? 'Lecțiile tale rămân în siguranță. Verifică internetul și încearcă din nou.'
        : 'Rezolvă ori verifică o problemă, apoi salveaz-o. Revii oricând la enunț și la pașii explicați.'}</Text>
      {!error ? (
        <View style={styles.emptyJourney}>
          {['Rezolvă', 'Salvează', 'Revino'].map((label, index) => (
            <View key={label} style={styles.emptyJourneyItem}>
              <View style={[styles.emptyJourneyDot, index === 1 && styles.emptyJourneyDotPeach, index === 2 && styles.emptyJourneyDotCyan]}>
                <Text style={styles.emptyJourneyNumber}>{index + 1}</Text>
              </View>
              <Text style={styles.emptyJourneyText}>{label}</Text>
              {index < 2 ? <View style={styles.emptyJourneyLine} /> : null}
            </View>
          ))}
        </View>
      ) : null}
      <Pressable accessibilityRole="button" onPress={onPrimary} style={({ pressed }) => [styles.primaryEmptyAction, pressed && styles.actionPressed]}>
        <Text style={styles.primaryEmptyText}>{error ? 'Reîncearcă' : 'Rezolvă prima problemă'}</Text>
        <MiniGlyph name={error ? 'spark' : 'next'} size={18} color={colors.ink} />
      </Pressable>
      {!error && onSecondary ? (
        <Pressable accessibilityRole="button" onPress={onSecondary} style={({ pressed }) => [styles.secondaryEmptyAction, pressed && styles.actionPressed]}>
          <Text style={styles.secondaryEmptyText}>Sau verifică o rezolvare</Text>
          <MiniGlyph name="next" size={15} color={colors.violetDeep} />
        </Pressable>
      ) : null}
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
      <View style={styles.filterEmptyIcon}><AppIcon name={searching ? 'search' : check ? 'verify' : 'practice'} size={50} /></View>
      <Text style={styles.filterEmptyTitle}>{title}</Text>
      <Text style={styles.filterEmptyText}>{description}</Text>
      <Pressable accessibilityRole="button" onPress={searching ? onReset : () => onStart(check ? 'check' : 'solve')} style={({ pressed }) => [styles.filterEmptyAction, pressed && styles.actionPressed]}>
        <Text style={styles.filterEmptyActionText}>{searching ? 'Șterge căutarea' : check ? 'Verifică o rezolvare' : 'Rezolvă o problemă'}</Text>
      </Pressable>
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
  const controlsReveal = useRef(new Animated.Value(0)).current;
  const listReveal = useRef(new Animated.Value(1)).current;
  const removeProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      controlsReveal.setValue(1);
      return;
    }
    Animated.spring(controlsReveal, { toValue: 1, useNativeDriver: true, speed: 15, bounciness: 5 }).start();
  }, [controlsReveal, reducedMotion]);

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

  const animateListChange = useCallback(() => {
    if (reducedMotion) return;
    listReveal.stopAnimation();
    listReveal.setValue(0.72);
    Animated.timing(listReveal, { toValue: 1, duration: 170, useNativeDriver: true }).start();
  }, [listReveal, reducedMotion]);

  const chooseFilter = useCallback((next: NotebookFilter) => {
    setFilter((current) => {
      if (current === next) return current;
      void Haptics.selectionAsync();
      animateListChange();
      return next;
    });
  }, [animateListChange]);

  useEffect(() => { animateListChange(); }, [animateListChange, normalizedQuery]);

  const openNote = useCallback((lesson: StoredLesson) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Lesson', { lesson, lessonId: lesson.id, isFavorite: true, source: 'notebook' });
  }, [navigation]);

  const requestRemove = useCallback((lesson: StoredLesson) => {
    void Haptics.selectionAsync();
    setRemoveError(false);
    setPendingRemoval(lesson);
    removeProgress.setValue(reducedMotion ? 1 : 0);
    if (!reducedMotion) {
      Animated.spring(removeProgress, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 4 }).start();
    }
  }, [reducedMotion, removeProgress]);

  const closeRemoval = useCallback((force = false) => {
    if (removing && !force) return;
    const finish = () => {
      setPendingRemoval(undefined);
      setRemoveError(false);
      removeProgress.setValue(0);
    };
    if (reducedMotion) {
      finish();
      return;
    }
    Animated.timing(removeProgress, { toValue: 0, duration: 150, useNativeDriver: true }).start(({ finished }) => {
      if (finished) finish();
    });
  }, [reducedMotion, removeProgress, removing]);

  const confirmRemoval = useCallback(async () => {
    const lesson = pendingRemoval;
    if (!lesson || removing) return;
    setRemoving(true);
    setRemoveError(false);
    try {
      await setLessonFavorite(lesson.id, false);
      setNotes((current) => current.filter((note) => note.id !== lesson.id));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRemoving(false);
      closeRemoval(true);
    } catch (error) {
      recordDiagnosticError('notebook_update', error);
      setRemoveError(true);
      setRemoving(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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

  const newestNoteId = filter === 'all' && !normalizedQuery ? notes[0]?.id : undefined;
  const renderLesson = useCallback<ListRenderItem<StoredLesson>>(({ item }) => (
    <LessonRow lesson={item} newest={item.id === newestNoteId} onOpen={openNote} onRemove={requestRemove} />
  ), [newestNoteId, openNote, requestRemove]);
  const keyExtractor = useCallback((item: StoredLesson) => item.id, []);
  const activeTab = tabs.find((tab) => tab.value === filter)?.label ?? 'Toate';
  const resultLabel = normalizedQuery ? 'Rezultatele căutării' : filter === 'all' ? 'Probleme salvate' : activeTab;
  const headerCount = loading && notes.length === 0 ? 'SE ÎNCARCĂ LECȚIILE' : `${notes.length} ${notes.length === 1 ? 'PROBLEMĂ SALVATĂ' : 'PROBLEME SALVATE'}`;
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
        <Animated.View style={[styles.controls, { paddingHorizontal: gutter, opacity: controlsReveal, transform: [{ translateY: controlsReveal.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
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
                <MiniGlyph name="close" size={15} />
              </Pressable>
            ) : null}
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
                  <View style={[styles.tabCount, active && styles.tabCountActive]}><Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>{counts[tab.value]}</Text></View>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

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

        <Animated.View style={[styles.listMotion, { opacity: listReveal, transform: [{ translateY: listReveal.interpolate({ inputRange: [0.72, 1], outputRange: [4, 0] }) }] }]}>
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
          <Animated.View pointerEvents="none" style={[styles.removeScrim, { opacity: removeProgress }]} />
          <Pressable accessible={false} disabled={removing} onPress={() => closeRemoval()} style={StyleSheet.absoluteFill} />
          <Animated.View
            accessibilityViewIsModal
            style={[styles.removeSheet, {
              paddingBottom: Math.max(insets.bottom, 14) + 8,
              opacity: removeProgress,
              transform: [{ translateY: removeProgress.interpolate({ inputRange: [0, 1], outputRange: [320, 0] }) }],
            }]}
          >
            <View style={styles.removeHandle} />
            <View style={styles.removeSheetIcon}><TrashGlyph size={34} color={colors.ink} /></View>
            <Text style={styles.removeEyebrow}>GESTIONEAZĂ CAIETUL</Text>
            <Text style={styles.removeTitle}>Scoți problema din Caiet?</Text>
            <Text numberOfLines={2} style={styles.removeLessonTitle}>{pendingRemovalTitle}</Text>
            <Text style={styles.removeDescription}>Lecția va dispărea din lista ta. Fotografia nu este păstrată în Caiet.</Text>
            {removeError ? <Text accessibilityRole="alert" style={styles.removeError}>Nu am putut actualiza Caietul. Verifică internetul și încearcă din nou.</Text> : null}
            <Pressable accessibilityRole="button" disabled={removing} onPress={() => void confirmRemoval()} style={({ pressed }) => [styles.confirmRemove, pressed && styles.actionPressed]}>
              {removing ? <PlayfulLoader micro inverse /> : <MiniGlyph name="wrong" size={17} color={colors.paper} />}
              <Text style={styles.confirmRemoveText}>{removing ? 'Actualizez Caietul…' : 'Da, scoate problema'}</Text>
            </Pressable>
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
  controls: { paddingTop: 5 },
  searchBox: { height: 48, borderWidth: 1.5, borderColor: colors.line, borderRadius: 15, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 5 },
  searchInput: { flex: 1, height: 45, paddingVertical: 0, fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 12.5 },
  clearSearch: { width: 29, height: 29, borderRadius: 10, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center' },
  tabBar: { height: 47, marginTop: 5, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row' },
  tab: { flex: 1, minWidth: 0, borderBottomWidth: 3, borderBottomColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 3 },
  tabActive: { borderBottomColor: colors.violet },
  tabPressed: { opacity: 0.62, transform: [{ translateY: 1 }] },
  tabText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 11.5 },
  tabTextActive: { color: colors.violetDeep },
  tabCount: { minWidth: 21, height: 21, borderRadius: 7, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabCountActive: { backgroundColor: colors.violet },
  tabCountText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8.5 },
  tabCountTextActive: { color: colors.paper },
  syncWarning: { minHeight: 40, marginTop: 6, borderRadius: 12, backgroundColor: '#FFE9E2', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  syncWarningText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 10.5, lineHeight: 14 },
  listHeading: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  listEyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7, letterSpacing: 1.1 },
  listTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 18, lineHeight: 21, marginTop: 1 },
  visibleCount: { fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 10.5 },
  listMotion: { flex: 1, minHeight: 0 },
  listContent: { flexGrow: 1 },
  lessonSeparator: { height: 12 },
  lessonShadow: { borderRadius: 20, backgroundColor: colors.ink, paddingBottom: 4 },
  lessonCard: { minHeight: 151, overflow: 'hidden', borderRadius: 19, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, flexDirection: 'row' },
  lessonRail: { width: 12, borderRightWidth: 1.5, borderRightColor: colors.ink, alignItems: 'center', justifyContent: 'space-evenly', paddingVertical: 20 },
  railDot: { width: 5, height: 5, borderRadius: 3, borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.paper },
  lessonBody: { flex: 1, minWidth: 0 },
  lessonMain: { minHeight: 101, paddingHorizontal: 13, paddingTop: 10, paddingBottom: 8 },
  lessonMainPressed: { backgroundColor: '#FCFAFF' },
  lessonMeta: { height: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  metaLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  modeDot: { width: 8, height: 8, borderRadius: 3 },
  modeText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7, letterSpacing: 0.8 },
  newDot: { borderRadius: 6, backgroundColor: colors.lime, paddingHorizontal: 5, paddingVertical: 2, transform: [{ rotate: '2deg' }] },
  newDotText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 6.5, letterSpacing: 0.6 },
  timeText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 9.5 },
  problemIdentity: { marginTop: 3, fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 17, lineHeight: 21 },
  topicRow: { minHeight: 19, marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  topicMarker: { width: 13, height: 4, borderRadius: 3 },
  topicText: { flex: 1, minWidth: 0, fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 10.5 },
  verdictBadge: { flexShrink: 0, minHeight: 19, borderRadius: 7, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  verdictText: { fontFamily: fonts.bodyBold, fontSize: 6.5, letterSpacing: 0.55 },
  lessonFooter: { minHeight: 48, borderTopWidth: 1.5, borderTopColor: colors.line, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  detailCluster: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailText: { fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 9.5 },
  detailDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.line },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  removeAction: { minHeight: 38, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 5 },
  removeText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 9.5 },
  openAction: { minHeight: 38, borderRadius: 12, backgroundColor: colors.violet, flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 10, paddingRight: 5 },
  openText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 10 },
  openArrow: { width: 25, height: 25, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)', alignItems: 'center', justifyContent: 'center' },
  loadingState: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 34 },
  loadingTitle: { marginTop: 4, fontFamily: fonts.display, color: colors.ink, fontSize: 23, lineHeight: 28, textAlign: 'center' },
  notebookLoader: { marginTop: 17 },
  fullState: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 25, paddingTop: 16, paddingBottom: 32 },
  emptyIllustration: { width: 224, height: 172, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyDeskSpot: { position: 'absolute', bottom: 5, width: 195, height: 42, borderRadius: 22, backgroundColor: colors.violetSoft, opacity: 0.75 },
  emptyPageBack: { position: 'absolute', width: 139, height: 135, borderRadius: 19, backgroundColor: colors.cyan, transform: [{ rotate: '8deg' }, { translateX: 6 }] },
  emptyPage: { width: 144, height: 139, borderRadius: 19, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.paper, flexDirection: 'row', overflow: 'hidden', transform: [{ rotate: '-4deg' }, { translateX: -5 }] },
  emptyBinding: { width: 28, borderRightWidth: 1.5, borderRightColor: colors.line, alignItems: 'center', justifyContent: 'space-evenly', paddingVertical: 9 },
  emptyRing: { width: 18, height: 6, borderRadius: 4, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.peach, transform: [{ translateX: -8 }] },
  emptyPageCopy: { flex: 1, paddingHorizontal: 12, paddingTop: 20 },
  emptyLineLong: { height: 7, borderRadius: 4, backgroundColor: colors.cyan },
  emptyLineShort: { width: '67%', height: 6, borderRadius: 3, backgroundColor: colors.line, marginTop: 11 },
  emptyFormula: { width: '88%', height: 37, borderRadius: 10, backgroundColor: colors.violetSoft, marginTop: 16, alignItems: 'center', justifyContent: 'center' },
  emptyFormulaText: { fontFamily: fonts.displaySemi, color: colors.violetDeep, fontSize: 17 },
  emptyBookmark: { position: 'absolute', top: -2, right: 15, width: 19, height: 34, borderWidth: 1.5, borderTopWidth: 0, borderColor: colors.ink, borderBottomLeftRadius: 7, borderBottomRightRadius: 7, backgroundColor: colors.peach },
  emptyIcon: { position: 'absolute', right: 1, bottom: 7, width: 80, height: 80, borderRadius: 26, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '5deg' }] },
  emptySpark: { position: 'absolute', left: 9, top: 12, width: 34, height: 34, borderRadius: 12, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.peach, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-9deg' }] },
  fullStateEyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.25 },
  fullStateTitle: { marginTop: 4, fontFamily: fonts.display, color: colors.ink, fontSize: 23, lineHeight: 27, textAlign: 'center' },
  fullStateText: { maxWidth: 342, marginTop: 5, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12.5, lineHeight: 17, textAlign: 'center' },
  emptyJourney: { width: '100%', maxWidth: 350, marginTop: 15, flexDirection: 'row', justifyContent: 'center' },
  emptyJourneyItem: { flex: 1, alignItems: 'center', position: 'relative' },
  emptyJourneyDot: { zIndex: 1, width: 29, height: 29, borderRadius: 10, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  emptyJourneyDotPeach: { backgroundColor: colors.peach, transform: [{ rotate: '3deg' }] },
  emptyJourneyDotCyan: { backgroundColor: colors.cyan, transform: [{ rotate: '-2deg' }] },
  emptyJourneyNumber: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 10 },
  emptyJourneyText: { marginTop: 4, fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 9.5 },
  emptyJourneyLine: { position: 'absolute', top: 14, left: '66%', width: '68%', height: 2, backgroundColor: colors.line },
  primaryEmptyAction: { width: '100%', maxWidth: 360, minHeight: 54, marginTop: 15, borderRadius: 17, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.lime, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primaryEmptyText: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 16 },
  secondaryEmptyAction: { minHeight: 42, marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12 },
  secondaryEmptyText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 11.5 },
  actionPressed: { opacity: 0.68, transform: [{ translateY: 2 }] },
  filterEmpty: { minHeight: 330, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  filterEmptyIcon: { width: 68, height: 68, borderRadius: 22, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  filterEmptyTitle: { marginTop: 9, fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 19, textAlign: 'center' },
  filterEmptyText: { maxWidth: 310, marginTop: 3, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  filterEmptyAction: { minHeight: 45, marginTop: 12, borderRadius: 13, backgroundColor: colors.ink, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  filterEmptyActionText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 12 },
  removeModalLayer: { flex: 1, justifyContent: 'flex-end' },
  removeScrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16, 12, 38, 0.68)' },
  removeSheet: { width: '100%', maxWidth: 640, alignSelf: 'center', alignItems: 'center', borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 3, borderBottomWidth: 0, borderColor: colors.ink, backgroundColor: colors.canvas, paddingHorizontal: 22, paddingTop: 9 },
  removeHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 9 },
  removeSheetIcon: { width: 63, height: 63, borderRadius: 21, borderWidth: 2, borderColor: colors.ink, backgroundColor: '#FFD9DE', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  removeEyebrow: { marginTop: 10, fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.15 },
  removeTitle: { marginTop: 4, fontFamily: fonts.display, color: colors.ink, fontSize: 23, lineHeight: 27, textAlign: 'center' },
  removeLessonTitle: { maxWidth: 430, marginTop: 6, fontFamily: fonts.displaySemi, color: colors.violetDeep, fontSize: 15, lineHeight: 19, textAlign: 'center' },
  removeDescription: { maxWidth: 430, marginTop: 7, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  removeError: { width: '100%', marginTop: 9, borderRadius: 12, backgroundColor: '#FFE5E8', padding: 9, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11, lineHeight: 15, textAlign: 'center' },
  confirmRemove: { width: '100%', maxWidth: 430, minHeight: 52, marginTop: 14, borderRadius: 17, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.rose, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  confirmRemoveText: { fontFamily: fonts.displaySemi, color: colors.paper, fontSize: 16 },
  keepLesson: { minHeight: 47, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 4 },
  keepLessonText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 12 },
  listFooter: { height: 5 },
});
