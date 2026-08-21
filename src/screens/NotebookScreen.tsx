import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, AppIconName } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { MiniGlyph } from '../components/MiniGlyph';
import { ScreenHeader } from '../components/ScreenHeader';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Notebook'>;
type Filter = 'all' | 'solve' | 'check';

const notes = [
  { id: 'quadratic', type: 'REZOLVATĂ', filter: 'solve', equation: '2x² − 5x − 3 = 0', topic: 'Ecuații de gradul II', time: 'astăzi, 14:32', icon: 'practice' as AppIconName, tone: colors.cyan },
  { id: 'triangle', type: 'VERIFICATĂ', filter: 'check', equation: 'A△ = b · h / 2', topic: 'Geometrie', time: 'ieri, 18:10', icon: 'verify' as AppIconName, tone: colors.peach },
  { id: 'limit', type: 'REZOLVATĂ', filter: 'solve', equation: 'lim (x² − 1)/(x − 1)', topic: 'Limite', time: 'luni, 16:45', icon: 'scan' as AppIconName, tone: colors.lime },
] as const;

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Toate' },
  { value: 'solve', label: 'Rezolvate' },
  { value: 'check', label: 'Verificate' },
];

export function NotebookScreen({ navigation }: Props) {
  const { gutter, isNarrow } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const listReveal = useRef(new Animated.Value(1)).current;
  const filteredNotes = filter === 'all' ? notes : notes.filter((note) => note.filter === filter);
  const normalizedQuery = query.trim().toLocaleLowerCase('ro-RO');
  const visibleNotes = normalizedQuery
    ? filteredNotes.filter((note) => (note.type + ' ' + note.equation + ' ' + note.topic + ' ' + note.time).toLocaleLowerCase('ro-RO').includes(normalizedQuery))
    : filteredNotes;

  const chooseFilter = (next: Filter) => {
    if (next === filter) return;
    Haptics.selectionAsync();
    Animated.timing(listReveal, { toValue: 0, duration: 90, useNativeDriver: true }).start(() => {
      setFilter(next);
      Animated.spring(listReveal, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 4 }).start();
    });
  };

  const openNote = (note: typeof notes[number]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Lesson', { mode: note.filter, source: 'notebook' });
  };

  const sectionTitle = normalizedQuery
    ? 'Rezultate'
    : filter === 'solve'
      ? 'Probleme rezolvate'
      : filter === 'check'
        ? 'Rezolvări verificate'
        : 'Lecțiile tale';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <ScreenHeader
        title="Caietul meu"
        eyebrow={notes.length + ' LECȚII SALVATE'}
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
              value={query}
              onChangeText={setQuery}
              placeholder="Caută o problemă sau un subiect"
              placeholderTextColor={colors.inkSoft}
              selectionColor={colors.violet}
              style={[styles.searchInput, isNarrow && styles.searchInputNarrow]}
            />
            {query ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Șterge căutarea" onPress={() => setQuery('')} style={styles.clearSearch}>
                <MiniGlyph name="close" size={16} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filterTrack} accessibilityRole="tablist">
            {filters.map((item) => {
              const active = item.value === filter;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => chooseFilter(item.value)}
                  style={[styles.filter, active && styles.filterActive]}
                >
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

            {visibleNotes.length > 0 ? (
              <View style={styles.lessonList}>
                {visibleNotes.map((note, index) => (
                  <Pressable
                    key={note.id}
                    accessibilityRole="button"
                    accessibilityLabel={note.type + ': ' + note.equation + ', ' + note.topic}
                    onPress={() => openNote(note)}
                    style={[styles.lessonRow, index === visibleNotes.length - 1 && styles.lessonRowLast]}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: note.tone }]}><AppIcon name={note.icon} size={44} /></View>
                    <View style={styles.rowCopy}>
                      <View style={styles.rowMeta}>
                        <View style={styles.rowStatus}>
                          {index === 0 && !normalizedQuery && filter === 'all' ? <View style={styles.recentChip}><Text style={styles.recentText}>RECENTĂ</Text></View> : null}
                          <Text style={styles.rowType}>{note.type}</Text>
                        </View>
                        <Text style={styles.rowTime}>{note.time}</Text>
                      </View>
                      <Text numberOfLines={1} style={[styles.rowEquation, isNarrow && styles.rowEquationNarrow]}>{note.equation}</Text>
                      <Text numberOfLines={1} style={styles.rowTopic}>{note.topic}</Text>
                    </View>
                    <View style={styles.openBadge}><MiniGlyph name="next" size={18} color={colors.ink} /></View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}><AppIcon name="search" size={52} /></View>
                <Text style={styles.emptyTitle}>N-am găsit nimic.</Text>
                <Text style={styles.emptyText}>Încearcă altă problemă, formulă sau subiect.</Text>
                <Pressable accessibilityRole="button" onPress={() => { setQuery(''); chooseFilter('all'); }} style={styles.resetButton}>
                  <Text style={styles.resetText}>Arată toate lecțiile</Text>
                </Pressable>
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
  rowTopic: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 10.5, marginTop: 1 },
  openBadge: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  empty: { minHeight: 350, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyIcon: { width: 70, height: 70, borderRadius: 22, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  emptyTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 20, marginTop: 10 },
  emptyText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 2 },
  resetButton: { minHeight: 38, marginTop: 13, borderRadius: 12, backgroundColor: colors.ink, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  resetText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 11 },
});
