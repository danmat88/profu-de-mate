import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, type ListRenderItem } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, type AppIconName } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { MiniGlyph } from '../components/MiniGlyph';
import { MathFormula } from '../components/MathFormula';
import { ScreenHeader } from '../components/ScreenHeader';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { getCachedFavoriteLessons, subscribeToFavoriteLessons } from '../services/lessons';
import { colors, fonts } from '../theme';
import type { RootStackParamList, StoredLesson } from '../types';
import { contentToAccessibleText, firstTextBlock, representativeMathBlock } from '../utils/mathContent';

type Props = NativeStackScreenProps<RootStackParamList, 'Notebook'>;
type Filter = 'all' | 'solve' | 'check';

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Toate' },
  { value: 'solve', label: 'Rezolvate' },
  { value: 'check', label: 'Verificate' },
];

function lessonTime(lesson: StoredLesson): string {
  const date = lesson.createdAt?.toDate?.();
  if (!date) return 'acum';
  const today = new Date();
  const sameDay = date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
  if (sameDay) return `astăzi, ${date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

type LessonCardProps = {
  note: StoredLesson;
  isRecent: boolean;
  isNarrow: boolean;
  formulaWidth: number;
  onOpen: (note: StoredLesson) => void;
};

const LessonCard = memo(function LessonCard({ note, isRecent, isNarrow, formulaWidth, onOpen }: LessonCardProps) {
  const icon: AppIconName = note.mode === 'check' ? 'verify' : 'practice';
  const tone = note.mode === 'check' ? colors.peach : colors.cyan;
  const type = note.mode === 'check' ? 'AI · VERIFICATĂ' : 'AI · REZOLVATĂ';
  const problemLabel = contentToAccessibleText(note.problem);
  const previewMath = representativeMathBlock(note.problem);
  const previewText = firstTextBlock(note.problem);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${type}: ${problemLabel}, ${note.topic}`}
      android_ripple={{ color: colors.violetSoft }}
      onPress={() => onOpen(note)}
      style={styles.lessonCard}
    >
      <View style={[styles.cardAccent, { backgroundColor: tone }]} />
      <View style={styles.cardHeader}>
        <View style={[styles.rowIcon, { backgroundColor: tone }]}><AppIcon name={icon} size={38} /></View>
        <View style={styles.cardHeadingCopy}>
          <View style={styles.rowMeta}>
            <View style={styles.rowStatus}>
              {isRecent ? <View style={styles.recentChip}><Text style={styles.recentText}>RECENTĂ</Text></View> : null}
              <Text style={styles.rowType}>{type}</Text>
            </View>
            <Text style={styles.rowTime}>{lessonTime(note)}</Text>
          </View>
          <Text numberOfLines={2} style={styles.rowTitle}>{note.title}</Text>
        </View>
      </View>

      <View style={styles.problemPanel}>
        <Text style={styles.problemLabel}>PROBLEMA</Text>
        {previewMath ? (
          <MathFormula
            math={previewMath}
            color={colors.ink}
            fontSize={isNarrow ? 17 : 18}
            minHeight={30}
            containerWidth={formulaWidth}
            align="left"
            style={styles.rowFormula}
          />
        ) : <Text numberOfLines={2} style={styles.rowProblemText}>{previewText}</Text>}
      </View>

      <View style={styles.cardFooter}>
        <Text numberOfLines={1} style={styles.rowTopic}>{note.topic}</Text>
        <View style={styles.openBadge}><MiniGlyph name="next" size={18} color={colors.ink} /></View>
      </View>
    </Pressable>
  );
});

function LessonSeparator() {
  return <View style={styles.lessonSeparator} />;
}

function NotebookSkeleton() {
  return (
    <View accessibilityLabel="Se încarcă lecțiile" style={styles.skeletonCard}>
      <View style={styles.skeletonHeader}>
        <View style={[styles.skeletonShape, styles.skeletonIcon]} />
        <View style={styles.skeletonCopy}>
          <View style={[styles.skeletonShape, styles.skeletonMeta]} />
          <View style={[styles.skeletonShape, styles.skeletonTitle]} />
          <View style={[styles.skeletonShape, styles.skeletonTitleShort]} />
        </View>
      </View>
      <View style={[styles.skeletonShape, styles.skeletonFormula]} />
      <View style={[styles.skeletonShape, styles.skeletonFooter]} />
    </View>
  );
}

export function NotebookScreen({ navigation }: Props) {
  const { width, gutter, isNarrow } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const [queryText, setQueryText] = useState('');
  const deferredQueryText = useDeferredValue(queryText);
  const [notes, setNotes] = useState<StoredLesson[]>(() => getCachedFavoriteLessons() ?? []);
  const [loading, setLoading] = useState(() => getCachedFavoriteLessons() === undefined);
  const [loadError, setLoadError] = useState(false);
  const [subscriptionAttempt, setSubscriptionAttempt] = useState(0);

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
      () => {
        if (!mounted) return;
        setLoading(false);
        setLoadError(true);
      },
    ).then((stop) => {
      if (mounted) unsubscribe = stop;
      else stop();
    }).catch(() => {
      if (!mounted) return;
      setLoading(false);
      setLoadError(true);
    });
    return () => { mounted = false; unsubscribe?.(); };
  }, [subscriptionAttempt]);

  const normalizedQuery = deferredQueryText.trim().toLocaleLowerCase('ro-RO');
  const visibleNotes = useMemo(() => {
    const filteredNotes = filter === 'all' ? notes : notes.filter((note) => note.mode === filter);
    if (!normalizedQuery) return filteredNotes;
    return filteredNotes.filter((note) => (
      `${note.title} ${contentToAccessibleText(note.problem)} ${note.topic}`
        .toLocaleLowerCase('ro-RO')
        .includes(normalizedQuery)
    ));
  }, [filter, normalizedQuery, notes]);

  const chooseFilter = useCallback((next: Filter) => {
    setFilter((current) => {
      if (current === next) return current;
      void Haptics.selectionAsync();
      return next;
    });
  }, []);

  const openNote = useCallback((note: StoredLesson) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Lesson', { lesson: note, lessonId: note.id, isFavorite: true, source: 'notebook' });
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
  const formulaWidth = Math.max(120, Math.floor(width - gutter * 2 - 60));
  const renderLesson = useCallback<ListRenderItem<StoredLesson>>(({ item }) => (
    <LessonCard
      note={item}
      isRecent={item.id === newestNoteId}
      isNarrow={isNarrow}
      formulaWidth={formulaWidth}
      onOpen={openNote}
    />
  ), [formulaWidth, isNarrow, newestNoteId, openNote]);
  const keyExtractor = useCallback((item: StoredLesson) => item.id, []);

  const sectionTitle = normalizedQuery
    ? 'Rezultate'
    : filter === 'solve' ? 'Probleme rezolvate' : filter === 'check' ? 'Rezolvări verificate' : 'Lecțiile tale';

  const emptyState = loading ? (
    <NotebookSkeleton />
  ) : loadError && notes.length === 0 ? (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><AppIcon name="notebook" size={52} /></View>
      <Text style={styles.emptyTitle}>Caietul nu s-a încărcat.</Text>
      <Text style={styles.emptyText}>Verifică internetul și încearcă din nou.</Text>
      <Pressable accessibilityRole="button" onPress={retrySubscription} style={styles.resetButton}><Text style={styles.resetText}>Reîncearcă</Text></Pressable>
    </View>
  ) : (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><AppIcon name={normalizedQuery ? 'search' : 'notebook'} size={52} /></View>
      <Text style={styles.emptyTitle}>{normalizedQuery ? 'N-am găsit nimic.' : 'Caietul așteaptă prima lecție.'}</Text>
      <Text style={styles.emptyText}>{normalizedQuery ? 'Încearcă altă problemă, formulă sau subiect.' : 'Salvează o rezolvare și o vei găsi aici.'}</Text>
      {normalizedQuery || filter !== 'all' ? (
        <Pressable accessibilityRole="button" onPress={resetFilters} style={styles.resetButton}><Text style={styles.resetText}>Arată toate lecțiile</Text></Pressable>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <ScreenHeader
        title="Caietul meu"
        eyebrow={loading && notes.length === 0 ? 'LECȚIILE TALE' : `${notes.length} ${notes.length === 1 ? 'LECȚIE SALVATĂ' : 'LECȚII SALVATE'}`}
        onBack={() => navigation.goBack()}
        rightIcon="camera"
        rightLabel="Rezolvă o problemă nouă"
        onRight={() => navigation.navigate('Capture', { mode: 'solve' })}
      />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={visibleNotes}
          renderItem={renderLesson}
          keyExtractor={keyExtractor}
          ItemSeparatorComponent={LessonSeparator}
          ListHeaderComponent={(
            <View>
              <View style={styles.searchBox}>
                <AppIcon name="search" size={34} />
                <TextInput
                  autoCorrect={false}
                  returnKeyType="search"
                  value={queryText}
                  onChangeText={setQueryText}
                  placeholder="Caută o problemă sau un subiect"
                  placeholderTextColor={colors.inkSoft}
                  selectionColor={colors.violet}
                  style={[styles.searchInput, isNarrow && styles.searchInputNarrow]}
                />
                {queryText ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Șterge căutarea" onPress={clearSearch} style={styles.clearSearch}>
                    <MiniGlyph name="close" size={16} />
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.filterTrack} accessibilityRole="tablist">
                {filters.map((item) => {
                  const active = item.value === filter;
                  return (
                    <Pressable key={item.value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => chooseFilter(item.value)} style={[styles.filter, active && styles.filterActive]}>
                      <Text numberOfLines={1} style={[styles.filterText, isNarrow && styles.filterTextNarrow, active && styles.filterTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {loadError && notes.length > 0 ? (
                <Pressable accessibilityRole="button" onPress={retrySubscription} style={styles.syncWarning}>
                  <MiniGlyph name="spark" size={15} color={colors.ink} />
                  <Text style={styles.syncWarningText}>Caietul este offline. Atinge pentru reconectare.</Text>
                </Pressable>
              ) : null}

              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>{sectionTitle}</Text>
                <View style={styles.countBadge}><Text style={styles.countText}>{loading && notes.length === 0 ? '—' : visibleNotes.length}</Text></View>
              </View>
            </View>
          )}
          ListEmptyComponent={emptyState}
          ListFooterComponent={<View style={styles.listFooter} />}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 16) + 18 }]}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { paddingTop: 8 },
  searchBox: { height: 54, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 18, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6 },
  searchInput: { flex: 1, height: 50, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 13 },
  searchInputNarrow: { fontSize: 12 },
  clearSearch: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center' },
  filterTrack: { height: 46, marginTop: 10, borderRadius: 15, borderWidth: 2, borderColor: colors.line, backgroundColor: 'rgba(255,255,255,0.76)', padding: 3, flexDirection: 'row', gap: 3 },
  filter: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: colors.ink },
  filterText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 11 },
  filterTextNarrow: { fontSize: 10 },
  filterTextActive: { color: colors.paper },
  syncWarning: { minHeight: 40, marginTop: 10, borderRadius: 13, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.peach, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  syncWarningText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 10.5 },
  sectionHeading: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 19 },
  countBadge: { minWidth: 28, height: 28, borderRadius: 10, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  countText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 10 },
  lessonSeparator: { height: 12 },
  lessonCard: { position: 'relative', overflow: 'hidden', borderWidth: 2.5, borderColor: colors.ink, borderRadius: 22, backgroundColor: colors.paper, padding: 12, paddingLeft: 15, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 7 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardHeadingCopy: { flex: 1 },
  rowIcon: { width: 50, height: 50, borderRadius: 16, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-2deg' }] },
  rowMeta: { minHeight: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  rowStatus: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  recentChip: { borderRadius: 7, backgroundColor: colors.lime, paddingHorizontal: 6, paddingVertical: 2 },
  recentText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 6.5, letterSpacing: 0.7 },
  rowType: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7.5, letterSpacing: 0.8 },
  rowTime: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 9.5 },
  rowTitle: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12.5, lineHeight: 16, marginTop: 2 },
  problemPanel: { minHeight: 62, marginTop: 10, borderRadius: 15, backgroundColor: colors.violetSoft, borderLeftWidth: 4, borderLeftColor: colors.violet, paddingHorizontal: 11, paddingTop: 7, paddingBottom: 8, justifyContent: 'center' },
  problemLabel: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7, letterSpacing: 1.1, marginBottom: 2 },
  rowProblemText: { fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 11.5, lineHeight: 15 },
  rowFormula: { marginTop: 0 },
  cardFooter: { minHeight: 34, marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTopic: { flex: 1, fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 10.5 },
  openBadge: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  skeletonCard: { minHeight: 268, borderWidth: 2.5, borderColor: colors.line, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.72)', padding: 15 },
  skeletonHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  skeletonCopy: { flex: 1, gap: 8 },
  skeletonShape: { backgroundColor: colors.violetSoft, borderRadius: 10 },
  skeletonIcon: { width: 50, height: 50, borderRadius: 16 },
  skeletonMeta: { width: '38%', height: 8 },
  skeletonTitle: { width: '88%', height: 13 },
  skeletonTitleShort: { width: '62%', height: 13 },
  skeletonFormula: { height: 74, marginTop: 15, borderRadius: 15 },
  skeletonFooter: { width: '42%', height: 12, marginTop: 18 },
  empty: { minHeight: 350, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyIcon: { width: 70, height: 70, borderRadius: 22, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  emptyTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 20, textAlign: 'center', marginTop: 10 },
  emptyText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 2 },
  resetButton: { minHeight: 40, marginTop: 13, borderRadius: 12, backgroundColor: colors.ink, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  resetText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 11 },
  listFooter: { height: 5 },
});
