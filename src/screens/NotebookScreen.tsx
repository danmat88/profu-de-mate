import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, type AppIconName } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { MathFormula } from '../components/MathFormula';
import { MiniGlyph } from '../components/MiniGlyph';
import { ScreenHeader } from '../components/ScreenHeader';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { subscribeToFavoriteLessons } from '../services/lessons';
import { colors, fonts } from '../theme';
import type { RootStackParamList, StoredLesson } from '../types';
import { contentToAccessibleText, firstMathBlock, firstTextBlock } from '../utils/mathContent';

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

export function NotebookScreen({ navigation }: Props) {
  const { gutter, isNarrow } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const [queryText, setQueryText] = useState('');
  const [notes, setNotes] = useState<StoredLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const listReveal = useRef(new Animated.Value(1)).current;

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
  }, []);

  const filteredNotes = filter === 'all' ? notes : notes.filter((note) => note.mode === filter);
  const normalizedQuery = queryText.trim().toLocaleLowerCase('ro-RO');
  const visibleNotes = normalizedQuery
    ? filteredNotes.filter((note) => `${note.title} ${contentToAccessibleText(note.problem)} ${note.topic}`.toLocaleLowerCase('ro-RO').includes(normalizedQuery))
    : filteredNotes;

  const chooseFilter = (next: Filter) => {
    if (next === filter) return;
    Haptics.selectionAsync();
    Animated.timing(listReveal, { toValue: 0, duration: 90, useNativeDriver: true }).start(() => {
      setFilter(next);
      Animated.spring(listReveal, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 4 }).start();
    });
  };

  const openNote = (note: StoredLesson) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Lesson', { lesson: note, lessonId: note.id, isFavorite: true, source: 'notebook' });
  };

  const sectionTitle = normalizedQuery
    ? 'Rezultate'
    : filter === 'solve' ? 'Probleme rezolvate' : filter === 'check' ? 'Rezolvări verificate' : 'Lecțiile tale';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <ScreenHeader
        title="Caietul meu"
        eyebrow={`${notes.length} ${notes.length === 1 ? 'LECȚIE SALVATĂ' : 'LECȚII SALVATE'}`}
        onBack={() => navigation.goBack()}
        rightIcon="camera"
        rightLabel="Rezolvă o problemă nouă"
        onRight={() => navigation.navigate('Capture', { mode: 'solve' })}
      />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 16) + 18 }]}
        >
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
              <Pressable accessibilityRole="button" accessibilityLabel="Șterge căutarea" onPress={() => setQueryText('')} style={styles.clearSearch}>
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

          <Animated.View style={{ opacity: listReveal, transform: [{ translateY: listReveal.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>{sectionTitle}</Text>
              <View style={styles.countBadge}><Text style={styles.countText}>{visibleNotes.length}</Text></View>
            </View>

            {loading ? (
              <View style={styles.statePanel}><ActivityIndicator color={colors.violetDeep} /><Text style={styles.stateText}>Deschid caietul…</Text></View>
            ) : loadError ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}><AppIcon name="notebook" size={52} /></View>
                <Text style={styles.emptyTitle}>Caietul nu s-a încărcat.</Text>
                <Text style={styles.emptyText}>Verifică internetul și deschide din nou ecranul.</Text>
              </View>
            ) : visibleNotes.length > 0 ? (
              <View style={styles.lessonList}>
                {visibleNotes.map((note, index) => {
                  const icon: AppIconName = note.mode === 'check' ? 'verify' : 'practice';
                  const tone = note.mode === 'check' ? colors.peach : colors.cyan;
                  const type = note.mode === 'check' ? 'VERIFICATĂ' : 'REZOLVATĂ';
                  const problemLabel = contentToAccessibleText(note.problem);
                  const previewMath = firstMathBlock(note.problem);
                  const previewText = firstTextBlock(note.problem);
                  return (
                    <Pressable key={note.id} accessibilityRole="button" accessibilityLabel={`${type}: ${problemLabel}, ${note.topic}`} onPress={() => openNote(note)} style={[styles.lessonRow, index === visibleNotes.length - 1 && styles.lessonRowLast]}>
                      <View style={[styles.rowIcon, { backgroundColor: tone }]}><AppIcon name={icon} size={44} /></View>
                      <View style={styles.rowCopy}>
                        <View style={styles.rowMeta}>
                          <View style={styles.rowStatus}>
                            {index === 0 && !normalizedQuery && filter === 'all' ? <View style={styles.recentChip}><Text style={styles.recentText}>RECENTĂ</Text></View> : null}
                            <Text style={styles.rowType}>{type}</Text>
                          </View>
                          <Text style={styles.rowTime}>{lessonTime(note)}</Text>
                        </View>
                        {previewMath ? (
                          <MathFormula math={previewMath} color={colors.ink} fontSize={isNarrow ? 14 : 16} minHeight={25} horizontalPadding={0} align="left" style={styles.rowFormula} />
                        ) : <Text numberOfLines={1} style={[styles.rowEquation, isNarrow && styles.rowEquationNarrow]}>{previewText}</Text>}
                        <Text numberOfLines={1} style={styles.rowTopic}>{note.topic}</Text>
                      </View>
                      <View style={styles.openBadge}><MiniGlyph name="next" size={18} color={colors.ink} /></View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}><AppIcon name={normalizedQuery ? 'search' : 'notebook'} size={52} /></View>
                <Text style={styles.emptyTitle}>{normalizedQuery ? 'N-am găsit nimic.' : 'Caietul așteaptă prima lecție.'}</Text>
                <Text style={styles.emptyText}>{normalizedQuery ? 'Încearcă altă problemă, formulă sau subiect.' : 'Salvează o rezolvare și o vei găsi aici.'}</Text>
                {normalizedQuery || filter !== 'all' ? (
                  <Pressable accessibilityRole="button" onPress={() => { setQueryText(''); chooseFilter('all'); }} style={styles.resetButton}><Text style={styles.resetText}>Arată toate lecțiile</Text></Pressable>
                ) : null}
              </View>
            )}
          </Animated.View>
        </ScrollView>
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
  sectionHeading: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 19 },
  countBadge: { minWidth: 28, height: 28, borderRadius: 10, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  countText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 10 },
  lessonList: { borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.line },
  lessonRow: { minHeight: 106, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 11 },
  lessonRowLast: { borderBottomWidth: 0 },
  rowIcon: { width: 56, height: 56, borderRadius: 18, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-2deg' }] },
  rowCopy: { flex: 1 },
  rowMeta: { minHeight: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  rowStatus: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  recentChip: { borderRadius: 7, backgroundColor: colors.lime, paddingHorizontal: 6, paddingVertical: 2 },
  recentText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 6.5, letterSpacing: 0.7 },
  rowType: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7.5, letterSpacing: 0.8 },
  rowTime: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 9.5 },
  rowEquation: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 18, lineHeight: 22, marginTop: 2 },
  rowEquationNarrow: { fontSize: 16 },
  rowFormula: { marginTop: 1 },
  rowTopic: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 10.5, marginTop: 1 },
  openBadge: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  statePanel: { minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 12 },
  empty: { minHeight: 350, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyIcon: { width: 70, height: 70, borderRadius: 22, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  emptyTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 20, textAlign: 'center', marginTop: 10 },
  emptyText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 2 },
  resetButton: { minHeight: 38, marginTop: 13, borderRadius: 12, backgroundColor: colors.ink, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  resetText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 11 },
});
