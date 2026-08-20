import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon, AppIconName } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { MiniGlyph } from '../components/MiniGlyph';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Notebook'>;

const notes = [
  { type: 'REZOLVATĂ', filter: 'solve', equation: '2x² − 5x − 3 = 0', detail: 'Ecuații de gradul II · azi', icon: 'practice' as AppIconName },
  { type: 'VERIFICATĂ', filter: 'check', equation: 'A△ = b · h / 2', detail: 'Geometrie · ieri', icon: 'verify' as AppIconName },
  { type: 'REZOLVATĂ', filter: 'solve', equation: 'lim (x² − 1)/(x − 1)', detail: 'Limite · luni', icon: 'scan' as AppIconName },
] as const;

type Filter = 'all' | 'solve' | 'check';
const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Toate' },
  { value: 'solve', label: 'Rezolvate' },
  { value: 'check', label: 'Verificate' },
];

export function NotebookScreen({ navigation }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const listReveal = useRef(new Animated.Value(1)).current;
  const filteredNotes = filter === 'all' ? notes : notes.filter((note) => note.filter === filter);
  const normalizedQuery = query.trim().toLocaleLowerCase('ro-RO');
  const visibleNotes = normalizedQuery ? filteredNotes.filter((note) => `${note.type} ${note.equation} ${note.detail}`.toLocaleLowerCase('ro-RO').includes(normalizedQuery)) : filteredNotes;

  const chooseFilter = (next: Filter) => {
    if (next === filter) return;
    Haptics.selectionAsync();
    Animated.timing(listReveal, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      setFilter(next);
      Animated.spring(listReveal, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <ScreenHeader title="Caietul meu" eyebrow="TOT CE AI ÎNȚELES" onBack={() => navigation.goBack()} rightIcon="search" rightActive={searching} onRight={() => { setSearching((value) => !value); if (searching) setQuery(''); }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Ideile tale,{`\n`}păstrate frumos.</Text>
        <Text style={styles.subtitle}>Reiei orice explicație exact de unde ai rămas.</Text>
        {searching ? (
          <View style={styles.searchBox}>
            <AppIcon name="search" size={39} />
            <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Ecuație, capitol sau tip…" placeholderTextColor={colors.inkSoft} selectionColor={colors.violet} style={styles.searchInput} />
            {query ? <Pressable accessibilityLabel="Șterge căutarea" onPress={() => setQuery('')} style={styles.clearSearch}><MiniGlyph name="close" size={17} /></Pressable> : null}
          </View>
        ) : null}
        <View style={styles.filterRow}>
          {filters.map((item) => {
            const active = item.value === filter;
            return <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => chooseFilter(item.value)} style={[styles.filter, active && styles.filterActive]}><Text style={[styles.filterText, active && styles.filterActiveText]}>{item.label}</Text></Pressable>;
          })}
        </View>
        <View style={styles.notebookWrap}>
          <View style={styles.notebookShadow} />
          <Animated.View style={[styles.notebook, { opacity: listReveal, transform: [{ translateY: listReveal.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
            <View style={styles.marginLine} />
            {visibleNotes.map((note, index) => (
              <Pressable key={note.equation} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('Lesson', { mode: note.filter }); }} style={[styles.note, index === visibleNotes.length - 1 && styles.lastNote]}>
                <View style={styles.noteIcon}><AppIcon name={note.icon} size={55} /></View>
                <View style={styles.noteCopy}>
                  <Text style={styles.noteType}>{note.type}</Text>
                  <Text style={styles.equation}>{note.equation}</Text>
                  <Text style={styles.detail}>{note.detail}</Text>
                </View>
                <MiniGlyph name="next" size={21} color={colors.violetDeep} />
              </Pressable>
            ))}
            {visibleNotes.length === 0 ? (
              <View style={styles.empty}>
                <AppIcon name="search" size={62} />
                <Text style={styles.emptyTitle}>N-am găsit încă.</Text>
                <Text style={styles.emptyText}>Încearcă alt cuvânt sau schimbă filtrul.</Text>
              </View>
            ) : null}
            {Array.from({ length: 6 }).map((_, index) => <View key={index} style={[styles.punch, { top: 31 + index * 77 }]} />)}
          </Animated.View>
        </View>
        <View style={styles.footerNote}><AppIcon name="hint" size={38} /><Text style={styles.footerText}>În versiunea completă, Profu’ va grupa automat lecțiile pe capitole și clasă.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 19, paddingBottom: 35 },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 35, lineHeight: 37, marginTop: 10 },
  subtitle: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 14, marginTop: 5 },
  searchBox: { minHeight: 56, marginTop: 16, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 18, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 4, shadowColor: colors.ink, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 4, height: 5 }, elevation: 4 },
  searchInput: { flex: 1, height: 50, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 13 },
  clearSearch: { width: 29, height: 29, borderRadius: 10, backgroundColor: colors.limeSoft, alignItems: 'center', justifyContent: 'center' },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  filter: { backgroundColor: colors.paper, borderRadius: 14, borderWidth: 2, borderColor: colors.line, paddingHorizontal: 13, paddingVertical: 8 },
  filterText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 11 },
  filterActive: { backgroundColor: colors.ink, borderColor: colors.ink, transform: [{ rotate: '-2deg' }] },
  filterActiveText: { color: colors.paper },
  notebookWrap: { marginTop: 21, position: 'relative' },
  notebookShadow: { position: 'absolute', left: 8, right: -8, top: 8, bottom: -9, borderRadius: 20, backgroundColor: colors.ink },
  notebook: { minHeight: 365, backgroundColor: colors.paper, borderWidth: 3, borderColor: colors.ink, borderRadius: 20, paddingLeft: 27, paddingRight: 14, overflow: 'hidden' },
  marginLine: { position: 'absolute', left: 37, top: 0, bottom: 0, width: 2, backgroundColor: '#FFB9AE' },
  note: { minHeight: 118, borderBottomWidth: 1.5, borderBottomColor: '#BBD7E5', flexDirection: 'row', alignItems: 'center', gap: 11, paddingLeft: 20 },
  lastNote: { borderBottomWidth: 0 },
  noteIcon: { width: 55, height: 55, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  noteCopy: { flex: 1 },
  noteType: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.1 },
  equation: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 17, marginTop: 2 },
  detail: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 10.5, marginTop: 2 },
  empty: { minHeight: 260, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 18, marginTop: 4 },
  emptyText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 11, textAlign: 'center', marginTop: 2 },
  punch: { position: 'absolute', left: -7, width: 17, height: 17, borderRadius: 9, backgroundColor: colors.canvas, borderWidth: 2, borderColor: colors.ink },
  footerNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 24, paddingHorizontal: 6 },
  footerText: { flex: 1, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12, lineHeight: 17 },
});
