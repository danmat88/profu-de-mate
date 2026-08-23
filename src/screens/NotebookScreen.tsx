import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, type ListRenderItem } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, type AppIconName } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { MiniGlyph } from '../components/MiniGlyph';
import { RichMathContent } from '../components/RichMathContent';
import { ScreenHeader } from '../components/ScreenHeader';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { getCachedFavoriteLessons, subscribeToFavoriteLessons } from '../services/lessons';
import { colors, fonts } from '../theme';
import type { RootStackParamList, StoredLesson } from '../types';
import { compactProblemContent, contentToAccessibleText } from '../utils/mathContent';

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
  tiltRight: boolean;
  formulaWidth: number;
  onOpen: (note: StoredLesson) => void;
};

function sameProblemPreview(previous: StoredLesson, next: StoredLesson) {
  const previousContent = compactProblemContent(previous.problem);
  const nextContent = compactProblemContent(next.problem);
  return previousContent.length === nextContent.length && previousContent.every((block, index) => {
    const nextBlock = nextContent[index];
    if (block.type !== nextBlock?.type) return false;
    if (block.type === 'text' && nextBlock.type === 'text') return block.text === nextBlock.text;
    return block.type === 'math' && nextBlock.type === 'math'
      && block.latex === nextBlock.latex
      && block.rendered.svg === nextBlock.rendered.svg;
  });
}

const LessonCard = memo(function LessonCard({ note, isRecent, isNarrow, tiltRight, formulaWidth, onOpen }: LessonCardProps) {
  const icon: AppIconName = note.mode === 'check' ? 'verify' : 'practice';
  const tone = note.mode === 'check' ? colors.peach : colors.cyan;
  const type = note.mode === 'check' ? 'Rezolvare verificată' : 'Problemă rezolvată';
  const problemLabel = contentToAccessibleText(note.problem);
  const previewContent = compactProblemContent(note.problem);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${type}: ${problemLabel}, ${note.topic}`}
      accessibilityHint="Deschide lecția completă"
      onPress={() => onOpen(note)}
      style={({ pressed }) => [
        styles.lessonShadow,
        { transform: [{ rotate: tiltRight ? '0.35deg' : '-0.35deg' }, { translateY: pressed ? 3 : 0 }] },
      ]}
    >
      <View style={styles.lessonSheet}>
        <View style={[styles.sheetMargin, { backgroundColor: tone }]}>
          <View style={styles.binderHole} />
          <View style={styles.binderHole} />
          <View style={styles.binderHole} />
        </View>
        <View style={styles.sheetBody}>
          <View style={styles.rowMeta}>
            <View style={[styles.typeTicket, { backgroundColor: tone }]}>
              <Text style={styles.typeTicketText}>{note.mode === 'check' ? 'VERIFICATĂ' : 'REZOLVATĂ'}</Text>
            </View>
            <Text style={styles.rowTime}>{lessonTime(note)}</Text>
          </View>
          <View style={styles.cardHeader}>
            <View style={[styles.rowIcon, { backgroundColor: tone }]}><AppIcon name={icon} size={40} /></View>
            <View style={styles.cardHeadingCopy}>
              <View style={styles.titleLine}>
                <Text numberOfLines={2} style={styles.rowTitle}>{note.title}</Text>
                {isRecent ? <View style={styles.recentChip}><Text style={styles.recentText}>NOUĂ</Text></View> : null}
              </View>
              <Text numberOfLines={1} style={styles.rowTopic}>{note.topic}</Text>
            </View>
          </View>

          <View style={styles.problemPaper}>
            <View pointerEvents="none" style={[styles.ruleLine, styles.ruleLineOne]} />
            <View pointerEvents="none" style={[styles.ruleLine, styles.ruleLineTwo]} />
            <Text style={styles.problemLabel}>ENUNȚ</Text>
            <RichMathContent
              content={previewContent}
              color={colors.ink}
              textStyle={styles.rowProblemText}
              textNumberOfLines={2}
              mathFontSize={isNarrow ? 16 : 17}
              inlineMathFontSize={isNarrow ? 12 : 13}
              mathMinHeight={28}
              mathContainerWidth={formulaWidth}
              mathAlign="left"
              inlineCompactMath
              gap={2}
            />
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.aiMark}><Text style={styles.aiMarkText}>✦ PROFU’</Text></View>
            <View style={styles.openCopy}>
              <Text style={styles.openText}>Deschide lecția</Text>
              <View style={styles.openBadge}><MiniGlyph name="next" size={17} color={colors.paper} /></View>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}, (previous, next) => (
  previous.note.id === next.note.id
  && previous.note.title === next.note.title
  && previous.note.topic === next.note.topic
  && previous.note.mode === next.note.mode
  && previous.note.createdAt?.toDate?.().getTime() === next.note.createdAt?.toDate?.().getTime()
  && previous.isRecent === next.isRecent
  && previous.isNarrow === next.isNarrow
  && previous.tiltRight === next.tiltRight
  && previous.formulaWidth === next.formulaWidth
  && previous.onOpen === next.onOpen
  && sameProblemPreview(previous.note, next.note)
));

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
  const formulaWidth = Math.max(120, Math.floor(width - gutter * 2 - 86));
  const renderLesson = useCallback<ListRenderItem<StoredLesson>>(({ item, index }) => (
    <LessonCard
      note={item}
      isRecent={item.id === newestNoteId}
      isNarrow={isNarrow}
      tiltRight={index % 2 === 1}
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
      <Text style={styles.emptyTitle}>{normalizedQuery ? 'Nu am găsit nimic.' : 'Nu ai nicio lecție salvată.'}</Text>
      <Text style={styles.emptyText}>{normalizedQuery ? 'Caută după altă problemă, formulă sau noțiune.' : 'Salvează o rezolvare, iar ea va apărea aici.'}</Text>
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
                  placeholder="Caută o problemă sau o noțiune"
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
                    <Pressable key={item.value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => chooseFilter(item.value)} style={({ pressed }) => [styles.filter, active && styles.filterActive, pressed && styles.filterPressed]}>
                      {active ? <Text style={styles.filterSpark}>✦</Text> : null}
                      <Text numberOfLines={1} style={[styles.filterText, isNarrow && styles.filterTextNarrow, active && styles.filterTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {loadError && notes.length > 0 ? (
                <Pressable accessibilityRole="button" onPress={retrySubscription} style={styles.syncWarning}>
                  <MiniGlyph name="spark" size={15} color={colors.ink} />
                  <Text style={styles.syncWarningText}>Nu există conexiune. Atinge aici ca să încerci din nou.</Text>
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
  content: { paddingTop: 9 },
  searchBox: { height: 56, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 18, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 0, elevation: 2 },
  searchInput: { flex: 1, height: 50, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 13 },
  searchInputNarrow: { fontSize: 12 },
  clearSearch: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center' },
  filterTrack: { minHeight: 45, marginTop: 12, flexDirection: 'row', gap: 7 },
  filter: { flex: 1, minWidth: 0, borderRadius: 13, borderWidth: 2, borderColor: colors.line, backgroundColor: 'rgba(255,255,255,0.8)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  filterActive: { borderColor: colors.ink, backgroundColor: colors.violet, shadowColor: colors.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 },
  filterPressed: { transform: [{ translateY: 2 }] },
  filterSpark: { fontFamily: fonts.display, color: colors.lime, fontSize: 10 },
  filterText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 11 },
  filterTextNarrow: { fontSize: 10 },
  filterTextActive: { color: colors.paper },
  syncWarning: { minHeight: 40, marginTop: 10, borderRadius: 13, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.peach, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  syncWarningText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 10.5 },
  sectionHeading: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 20 },
  countBadge: { minWidth: 29, height: 29, borderRadius: 10, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, transform: [{ rotate: '3deg' }] },
  countText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 10 },
  lessonSeparator: { height: 16 },
  lessonShadow: { minHeight: 224, borderRadius: 22, backgroundColor: colors.ink, paddingBottom: 5 },
  lessonSheet: { flex: 1, minHeight: 219, overflow: 'hidden', borderWidth: 2.5, borderColor: colors.ink, borderRadius: 21, backgroundColor: colors.paper, flexDirection: 'row' },
  sheetMargin: { width: 24, borderRightWidth: 2, borderRightColor: colors.ink, alignItems: 'center', justifyContent: 'space-around', paddingVertical: 23 },
  binderHole: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.canvas },
  sheetBody: { flex: 1, minWidth: 0, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  cardHeader: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 5 },
  cardHeadingCopy: { flex: 1 },
  rowIcon: { width: 52, height: 52, borderRadius: 17, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  rowMeta: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  typeTicket: { borderWidth: 1.5, borderColor: colors.ink, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, transform: [{ rotate: '-1deg' }] },
  typeTicketText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 7, letterSpacing: 0.9 },
  titleLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  recentChip: { marginTop: 1, borderWidth: 1.5, borderColor: colors.ink, borderRadius: 7, backgroundColor: colors.lime, paddingHorizontal: 5, paddingVertical: 2, transform: [{ rotate: '4deg' }] },
  recentText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 6.5, letterSpacing: 0.7 },
  rowTime: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 9.5 },
  rowTitle: { flex: 1, fontFamily: fonts.display, color: colors.ink, fontSize: 14.5, lineHeight: 17, marginTop: 1 },
  rowTopic: { fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 9.5, marginTop: 2 },
  problemPaper: { position: 'relative', minHeight: 76, marginTop: 8, overflow: 'hidden', borderWidth: 1.5, borderColor: '#DCD1F0', borderRadius: 13, backgroundColor: '#FFFCF6', paddingHorizontal: 10, paddingTop: 7, paddingBottom: 7, justifyContent: 'center' },
  ruleLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#E9DFF6' },
  ruleLineOne: { top: 31 },
  ruleLineTwo: { top: 59 },
  problemLabel: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 6.5, letterSpacing: 1.15, marginBottom: 1 },
  rowProblemText: { fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 11.5, lineHeight: 15 },
  cardFooter: { minHeight: 32, marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  aiMark: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, backgroundColor: colors.violetSoft },
  aiMarkText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 6.5, letterSpacing: 0.8 },
  openCopy: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  openText: { fontFamily: fonts.display, color: colors.ink, fontSize: 11.5 },
  openBadge: { width: 29, height: 29, borderRadius: 10, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
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
