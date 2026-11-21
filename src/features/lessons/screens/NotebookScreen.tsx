import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useDelayedBusy } from '../../../shared/hooks/useDelayedBusy';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { recordDiagnosticError } from '../../../shared/services/diagnostics';
import * as Haptics from '../../../shared/services/haptics';
import { borders, colors, fonts, shadows, typography } from '../../../shared/theme';
import type { FlowMode, RootStackParamList, StoredLesson } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { Chip } from '../../../shared/ui/Chip';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { ComicTabBar, type ComicTabOption } from '../../../shared/ui/ComicTabBar';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { TabPanel } from '../../../shared/ui/TabPanel';
import { Text, TextInput } from '../../../shared/ui/Typography';
import { RemoveFromNotebookModal } from '../components/RemoveFromNotebookModal';
import { beginLessonPresentation, forgetLessonPresentation, waitForLessonPresentation } from '../services/lessonPresentation';
import { getCachedFavoriteLessons, setLessonFavorite, subscribeToFavoriteLessons } from '../services/lessons';
import {
  filterNotebookLessons,
  notebookFilterCounts,
  notebookProblemPresentation,
  notebookVerdictPresentation,
  type NotebookFilter,
} from '../utils/notebookPresentation';

type Props = NativeStackScreenProps<RootStackParamList, 'Notebook'>;

const FILTER_ORDER: Record<NotebookFilter, number> = { all: 0, solve: 1, check: 2 };

const verdictTones = {
  correct: { backgroundColor: colors.lime, color: colors.ink },
  partial: { backgroundColor: colors.gold, color: colors.ink },
  incorrect: { backgroundColor: colors.roseSoft, color: colors.berryDeep },
} as const;

function TrashGlyph({ size = 16, color = colors.inkSoft }: { size?: number; color?: string }) {
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
  opening: boolean;
  onOpen: (lesson: StoredLesson) => void;
  onRemove: (lesson: StoredLesson) => void;
};

const LessonRow = memo(function LessonRow({ lesson, newest, opening, onOpen, onRemove }: LessonRowProps) {
  const presentation = notebookProblemPresentation(lesson);
  const verdict = notebookVerdictPresentation(lesson);
  const checked = lesson.mode === 'check';
  const spineTone = verdict?.tone === 'correct'
    ? colors.lime
    : verdict?.tone === 'incorrect'
      ? colors.rose
      : checked ? colors.peach : colors.cyan;
  const modePillBg = checked ? colors.peachSoft : colors.cyanSoft;
  const modeLabel = checked ? 'VERIFICATĂ' : 'REZOLVATĂ';
  const actionLabel = checked ? 'Vezi verificarea' : 'Vezi rezolvarea';
  const stepLabel = `${lesson.steps.length} ${lesson.steps.length === 1 ? 'pas' : 'pași'}`;
  const requestLabel = presentation.requestCount > 1 ? `${presentation.requestCount} cerințe` : undefined;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${modeLabel}: ${presentation.identity}. ${lesson.topic}. ${verdict ? `${verdict.label}. ` : ''}${stepLabel}.`}
      accessibilityHint={actionLabel}
      depth={5}
      radius={22}
      shadowColor={colors.ink}
      haptic="light"
      onPress={() => onOpen(lesson)}
      contentStyle={styles.lessonCard}
    >
        <View style={[styles.lessonRail, { backgroundColor: spineTone }]}>
          <View pointerEvents="none" style={styles.railShine} />
          {[0, 1, 2].map((dot) => (
            <View key={dot} style={styles.railHole}>
              <View style={styles.railRing} />
            </View>
          ))}
        </View>

        <View style={styles.lessonBody}>
          <View pointerEvents="none" style={styles.cardShine} />
          <View pointerEvents="none" style={styles.ruledLines}>
            <View style={styles.ruledLine} />
            <View style={styles.ruledLine} />
            <View style={styles.ruledLine} />
          </View>

          <View style={styles.lessonMeta}>
            <View style={styles.metaLeft}>
              <View style={[styles.modeStamp, { backgroundColor: modePillBg }]}>
                <AppIcon name={checked ? 'verify' : 'practice'} size={15} />
                <Text style={styles.modeText}>{modeLabel}</Text>
              </View>
              {newest ? (
                <View style={styles.newDot}>
                  <Text style={styles.newDotText}>★ NOUĂ</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.timeText}>{lessonTime(lesson)}</Text>
          </View>

          <Text numberOfLines={2} style={styles.problemIdentity}>{presentation.title}</Text>

          <View style={styles.topicRow}>
            <View style={styles.topicTag}>
              <View style={[styles.topicMarker, { backgroundColor: spineTone }]} />
              <Text numberOfLines={1} style={styles.topicText}>{lesson.topic}</Text>
            </View>
            {verdict ? (
              <View style={[styles.verdictBadge, { backgroundColor: verdictTones[verdict.tone].backgroundColor }]}>
                <Text style={[styles.verdictText, { color: verdictTones[verdict.tone].color }]}>{verdict.label}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.lessonFooter}>
            <View style={styles.detailCluster}>
              <View style={styles.detailChip}>
                <View style={[styles.detailDot, { backgroundColor: colors.violet }]} />
                <Text style={styles.detailText}>{stepLabel}</Text>
              </View>
              {requestLabel ? (
                <View style={styles.detailChip}>
                  <Text style={styles.detailText}>{requestLabel}</Text>
                </View>
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
                <TrashGlyph size={15} color={colors.inkSoft} />
                <Text style={styles.removeText}>Scoate</Text>
              </Pressable>
              <View style={styles.openPill}>
                {opening ? (
                  <PlayfulLoader micro inverse />
                ) : (
                  <>
                    <Text style={styles.openPillText}>Deschide</Text>
                    <MiniGlyph name="next" size={14} color={colors.paper} />
                  </>
                )}
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
  && previous.opening === next.opening
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
      <View>
        <Chip
          label={error ? 'CONEXIUNE ÎNTRERUPTĂ' : 'PRIMA PAGINĂ E LIBERĂ'}
          tone={error ? 'peach' : 'lime'}
          tilt={-2}
        />
      </View>
      <View style={styles.emptyCopyWrap}>
        <Text style={styles.fullStateTitle}>
          {error ? 'Caietul e încă pe raft' : 'Prima lecție merită un loc bun'}
        </Text>
        <Text style={styles.fullStateText}>
          {error
            ? 'Lecțiile tale rămân în siguranță. Verifică internetul și încearcă din nou.'
            : 'Rezolvă ori verifică o problemă, apoi salveaz-o. Revii oricând la enunț și la pașii explicați.'}
        </Text>
      </View>
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
  const [filterState, setFilterState] = useState<{ filter: NotebookFilter; direction: -1 | 0 | 1 }>({
    filter: 'all',
    direction: 0,
  });
  const { filter, direction } = filterState;
  const [queryText, setQueryText] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const deferredQueryText = useDeferredValue(queryText);
  const [notes, setNotes] = useState<StoredLesson[]>(() => getCachedFavoriteLessons() ?? []);
  const [loading, setLoading] = useState(() => getCachedFavoriteLessons() === undefined);
  const [loadError, setLoadError] = useState(false);
  const [subscriptionAttempt, setSubscriptionAttempt] = useState(0);
  const [pendingRemoval, setPendingRemoval] = useState<StoredLesson>();
  const [removeVisible, setRemoveVisible] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState(false);
  const [openingNoteId, setOpeningNoteId] = useState<string | null>(null);

  const openingNoteRef = useRef(false);
  const focusedRef = useRef(true);

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    openingNoteRef.current = false;
    setOpeningNoteId(null);
    return () => {
      focusedRef.current = false;
    };
  }, []));

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

  const tabOptions = useMemo<readonly ComicTabOption<NotebookFilter>[]>(() => [
    {
      value: 'all',
      label: 'Toate',
      badge: counts.all,
      activeFill: colors.violet,
      activeText: colors.paper,
      badgeFill: colors.lime,
      badgeText: colors.ink,
    },
    {
      value: 'solve',
      label: 'Rezolvate',
      badge: counts.solve,
      activeFill: colors.cyan,
      activeText: colors.ink,
      badgeFill: colors.paper,
      badgeText: colors.ink,
    },
    {
      value: 'check',
      label: 'Verificate',
      badge: counts.check,
      activeFill: colors.peach,
      activeText: colors.ink,
      badgeFill: colors.paper,
      badgeText: colors.ink,
    },
  ], [counts.all, counts.check, counts.solve]);

  const chooseFilter = useCallback((next: NotebookFilter) => {
    setFilterState((current) => (current.filter === next
      ? current
      : { filter: next, direction: FILTER_ORDER[next] > FILTER_ORDER[current.filter] ? 1 : -1 }));
  }, []);

  const openNote = useCallback((lesson: StoredLesson) => {
    if (openingNoteRef.current) return;
    openingNoteRef.current = true;
    setOpeningNoteId(lesson.id);
    const params: RootStackParamList['Lesson'] = {
      lesson,
      lessonId: lesson.id,
      isFavorite: true,
      source: 'notebook',
    };
    beginLessonPresentation(lesson.id);
    navigation.preload('Lesson', params);
    void waitForLessonPresentation(lesson.id, 900).then(() => {
      if (!focusedRef.current) {
        forgetLessonPresentation(lesson.id);
        openingNoteRef.current = false;
        setOpeningNoteId(null);
        return;
      }
      navigation.navigate('Lesson', params);
    });
  }, [navigation]);

  const requestRemove = useCallback((lesson: StoredLesson) => {
    Haptics.selection();
    setRemoveError(false);
    setPendingRemoval(lesson);
    setRemoveVisible(true);
  }, []);

  const closeRemoval = useCallback((force = false) => {
    if (removing && !force) return;
    setRemoveVisible(false);
  }, [removing]);

  const handleRemovalClosed = useCallback(() => {
    setPendingRemoval(undefined);
    setRemoveError(false);
  }, []);

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
      setRemoveVisible(false);
    } catch (error) {
      recordDiagnosticError('notebook_update', error);
      setRemoveError(true);
      setRemoving(false);
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    }
  }, [pendingRemoval, removing]);

  const startMode = useCallback((mode: FlowMode) => {
    if (openingNoteRef.current) return;
    openingNoteRef.current = true;
    navigation.navigate('Capture', { mode });
  }, [navigation]);
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
    <LessonRow lesson={item} newest={item.id === newestNoteId} opening={item.id === openingNoteId} onOpen={openNote} onRemove={requestRemove} />
  ), [newestNoteId, openNote, openingNoteId, requestRemove]);
  const keyExtractor = useCallback((item: StoredLesson) => item.id, []);
  const activeTabLabel = tabOptions.find((tab) => tab.value === filter)?.label ?? 'Toate';
  const resultLabel = normalizedQuery ? 'Rezultatele căutării' : filter === 'all' ? 'Probleme salvate' : activeTabLabel;
  const headerCount = loading && notes.length === 0 ? 'LECȚII SALVATE' : `${notes.length} ${notes.length === 1 ? 'PROBLEMĂ SALVATĂ' : 'PROBLEME SALVATE'}`;
  const pendingRemovalTitle = pendingRemoval ? notebookProblemPresentation(pendingRemoval).title : '';

  if (loading && notes.length === 0) {
    return (
      <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
        <StatusBar style="dark" />
        <ComicBackdrop />
        <ScreenHeader title="Caietul meu" eyebrow={headerCount} onBack={() => navigation.goBack()} rightIcon="camera" rightLabel="Rezolvă o problemă nouă" onRight={() => startMode('solve')} />
        <NotebookLoading />
      </View>
    );
  }

  if (notes.length === 0) {
    return (
      <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
        <StatusBar style="dark" />
        <ComicBackdrop />
        <ScreenHeader title="Caietul meu" eyebrow={headerCount} onBack={() => navigation.goBack()} rightIcon="camera" rightLabel="Rezolvă o problemă nouă" onRight={() => startMode('solve')} />
        <FullNotebookState kind={loadError ? 'error' : 'empty'} onPrimary={loadError ? retrySubscription : () => startMode('solve')} onSecondary={() => startMode('check')} />
      </View>
    );
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <ScreenHeader compact title="Caietul meu" eyebrow={headerCount} onBack={() => navigation.goBack()} rightIcon="camera" rightLabel="Rezolvă o problemă nouă" onRight={() => startMode('solve')} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.controls, { paddingHorizontal: gutter }]}>
          <View style={[styles.searchShadow, searchFocused && styles.searchShadowFocused]}>
            <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
              <View pointerEvents="none" style={styles.searchShine} />
              <AppIcon name="search" size={26} />
              <TextInput
                autoCorrect={false}
                returnKeyType="search"
                value={queryText}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onChangeText={setQueryText}
                placeholder={isNarrow ? 'Caută în enunțuri' : 'Caută în enunțuri, formule sau capitole'}
                placeholderTextColor={colors.inkSoft}
                selectionColor={colors.violet}
                style={styles.searchInput}
              />
              {queryText ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Șterge căutarea" hitSlop={9} onPress={clearSearch} style={styles.clearSearch}>
                  <MiniGlyph name="close" size={14} color={colors.ink} />
                </Pressable>
              ) : null}
            </View>
          </View>

          <ComicTabBar
            compact
            options={tabOptions}
            value={filter}
            onChange={chooseFilter}
          />
        </View>

        {loadError ? (
          <Pressable accessibilityRole="button" onPress={retrySubscription} style={[styles.syncWarning, { marginHorizontal: gutter }]}>
            <MiniGlyph name="spark" size={14} color={colors.ink} />
            <Text style={styles.syncWarningText}>Vezi copia salvată pe telefon. Atinge pentru reconectare.</Text>
          </Pressable>
        ) : null}

        <View style={[styles.listHeading, { paddingHorizontal: gutter }]}>
          <View style={styles.listHeadingLeft}>
            <View style={styles.miniMascotBadge}>
              <Mascot pose="wave" size={38} active interactive />
            </View>
            <View style={styles.listHeadingCopy}>
              <Text numberOfLines={1} style={styles.listEyebrow}>
                {normalizedQuery ? `CĂUTARE: ${normalizedQuery.toLocaleUpperCase('ro-RO')}` : 'CAIETUL TĂU'}
              </Text>
              <Text numberOfLines={1} style={styles.listTitle}>{resultLabel}</Text>
            </View>
          </View>
          <View style={styles.visibleCountPill}>
            <Text style={styles.visibleCount}>
              {visibleNotes.length} {visibleNotes.length === 1 ? 'lecție' : 'lecții'}
            </Text>
          </View>
        </View>

        <TabPanel key={filter} direction={direction} style={styles.listMotion}>
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
        </TabPanel>
      </KeyboardAvoidingView>

      <RemoveFromNotebookModal
        visible={removeVisible && Boolean(pendingRemoval)}
        lessonTitle={pendingRemovalTitle}
        description="Lecția va dispărea din lista ta. Fotografia nu este păstrată în Caiet."
        removing={removing}
        error={removeError}
        onConfirm={() => void confirmRemoval()}
        onCancel={() => closeRemoval()}
        onAfterClose={handleRemovalClosed}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1, minHeight: 0 },
  controls: { paddingTop: 4, gap: 9 },

  searchShadow: { borderRadius: 17, backgroundColor: colors.ink, paddingBottom: shadows.sm },
  searchShadowFocused: { backgroundColor: colors.violetShadow },
  searchBox: {
    height: 46,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    borderRadius: 16,
    backgroundColor: colors.paper,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
    overflow: 'hidden',
  },
  searchBoxFocused: { borderColor: colors.violet },
  searchShine: {
    position: 'absolute',
    top: 2,
    left: 12,
    right: 12,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.shine,
  },
  searchInput: { flex: 1, height: 42, paddingVertical: 0, fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 13.5 },
  clearSearch: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

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

  listHeading: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 6,
    paddingBottom: 2,
  },
  listHeadingLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  miniMascotBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  listHeadingCopy: { flex: 1, minWidth: 0 },
  listEyebrow: { ...typography.kicker, fontSize: 10.5, color: colors.violetDeep },
  listTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 19.5, lineHeight: 22.5, marginTop: 1 },
  visibleCountPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.violetSoft,
    transform: [{ rotate: '1.5deg' }],
  },
  visibleCount: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 11.5 },

  listMotion: { flex: 1, minHeight: 0 },
  listContent: { flexGrow: 1, paddingTop: 4 },
  lessonSeparator: { height: 13 },

  lessonCard: {
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    flexDirection: 'row',
  },
  lessonRail: {
    width: 18,
    borderRightWidth: borders.thin,
    borderRightColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 16,
    position: 'relative',
  },
  railShine: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 2,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.shine,
  },
  railHole: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railRing: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.ink,
  },
  lessonBody: { flex: 1, minWidth: 0, paddingHorizontal: 13, paddingTop: 11, paddingBottom: 10, position: 'relative' },
  cardShine: {
    position: 'absolute',
    top: 3,
    left: 12,
    right: 12,
    height: 5,
    borderRadius: 4,
    backgroundColor: colors.shine,
  },
  ruledLines: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 46,
    bottom: 46,
    justifyContent: 'space-evenly',
    opacity: 0.45,
  },
  ruledLine: {
    height: 1,
    backgroundColor: '#ECE4FA',
  },
  lessonMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  metaLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  modeStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.ink,
    transform: [{ rotate: '-1deg' }],
  },
  modeText: { ...typography.kicker, fontSize: 9.5, lineHeight: 12, color: colors.ink },
  newDot: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    paddingHorizontal: 6,
    paddingVertical: 2,
    transform: [{ rotate: '2.5deg' }],
  },
  newDotText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9.5, letterSpacing: 0.45 },
  timeText: { fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 11 },
  problemIdentity: { marginTop: 7, fontFamily: fonts.display, color: colors.ink, fontSize: 18.5, lineHeight: 23 },
  topicRow: { minHeight: 24, marginTop: 7, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  topicTag: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.paperTint,
  },
  topicMarker: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.25, borderColor: colors.ink },
  topicText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 11.5 },
  verdictBadge: {
    flexShrink: 0,
    minHeight: 22,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.ink,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '1.2deg' }],
  },
  verdictText: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.45 },

  lessonFooter: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1.5,
    borderTopColor: '#EFEAF8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailCluster: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
  },
  detailText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 11 },
  detailDot: { width: 5, height: 5, borderRadius: 3 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  removeAction: {
    minHeight: 32,
    borderRadius: 10,
    borderWidth: 1.25,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.paperTint,
  },
  removeText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 11 },
  openPill: {
    minWidth: 88,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.violet,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  openPillText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 11.5 },

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
  emptyCopyWrap: { alignItems: 'center' },
  fullStateTitle: { marginTop: 10, fontFamily: fonts.display, color: colors.ink, fontSize: 24, lineHeight: 28, textAlign: 'center' },
  fullStateText: { maxWidth: 330, marginTop: 6, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  emptyActions: { width: '100%', maxWidth: 340, marginTop: 22, gap: 6 },
  secondaryEmptyWrap: { alignSelf: 'center' },
  secondaryEmptyAction: { minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryEmptyText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 13 },

  filterEmpty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingTop: 34, paddingBottom: 24 },
  filterEmptyTitle: { marginTop: 8, fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 20, lineHeight: 24, textAlign: 'center' },
  filterEmptyText: { maxWidth: 300, marginTop: 6, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  filterEmptyActionWrap: { marginTop: 16 },
  filterEmptyAction: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterEmptyActionText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 13 },

  listFooter: { height: 10 },
  actionPressed: { opacity: 0.72 },
});
