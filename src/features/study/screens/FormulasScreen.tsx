import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { beginAppTransition } from '../../../shared/context/TransitionMotionContext';
import { useKeyboardHeight } from '../../../shared/hooks/useKeyboardHeight';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { useScreenMotionActive, useTransitionSettled } from '../../../shared/hooks/useTransitionSettled';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, radii } from '../../../shared/theme';
import type { RootStackParamList } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { Text, TextInput } from '../../../shared/ui/Typography';
import { FormulaCard } from '../components/FormulaCard';
import { StudyTrackSheet } from '../components/StudyTrackSheet';
import { FORMULAS_CATALOG } from '../data/formulasCatalog';
import { setStudyTrack, toggleFavoriteFormula, useStudyProfile } from '../services/studyStorage';
import {
  FORMULA_CATEGORIES,
  getStudyTrackMeta,
  type FormulaCategoryId,
  type FormulaEntry,
  type StudyTrackId,
} from '../types';
import { filterFormulas } from '../utils/studyDocumentBuilder';

type Props = NativeStackScreenProps<RootStackParamList, 'Formulas'>;

function FormulaSeparator() {
  return <View style={styles.separator} />;
}

export function FormulasScreen({ navigation, route }: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, isNarrow } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { keyboardInset, keyboardVisible } = useKeyboardHeight();
  const transitionSettled = useTransitionSettled(navigation, reducedMotion);
  const motionActive = useScreenMotionActive(navigation, reducedMotion);
  const profile = useStudyProfile();
  const trackMeta = getStudyTrackMeta(profile.track);

  const [queryText, setQueryText] = useState('');
  const deferredQuery = useDeferredValue(queryText);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchActivated, setSearchActivated] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<FormulaCategoryId | 'all'>(
    route.params?.initialCategory ?? 'all',
  );
  const [favoritesOnly, setFavoritesOnly] = useState(Boolean(route.params?.initialFavoritesOnly));
  const [trackOnly, setTrackOnly] = useState(!route.params?.showAllTracks && !route.params?.initialFavoritesOnly);
  const [trackSheetOpen, setTrackSheetOpen] = useState(false);
  const [trackSheetEverOpened, setTrackSheetEverOpened] = useState(false);

  const listRef = useRef<FlatList<FormulaEntry>>(null);
  const openingRef = useRef(false);

  useFocusEffect(useCallback(() => {
    openingRef.current = false;
  }, []));

  const favoriteSet = useMemo(() => new Set(profile.favoriteFormulaIds), [profile.favoriteFormulaIds]);

  const filteredFormulas = useMemo(
    () => filterFormulas(FORMULAS_CATALOG, {
      track: trackOnly ? profile.track : null,
      category: selectedCategory,
      query: deferredQuery,
      favoritesOnly,
      favoriteIds: profile.favoriteFormulaIds,
    }),
    [deferredQuery, favoritesOnly, profile.favoriteFormulaIds, profile.track, selectedCategory, trackOnly],
  );

  const renderedFormulas = useMemo(
    () => (transitionSettled || filteredFormulas.length <= 4 ? filteredFormulas : filteredFormulas.slice(0, 4)),
    [filteredFormulas, transitionSettled],
  );

  const visibleIds = useMemo(
    () => filteredFormulas.map((item) => item.id),
    [filteredFormulas],
  );

  const openTrackPicker = () => {
    Keyboard.dismiss();
    Haptics.selection();
    setTrackSheetEverOpened(true);
    setTrackSheetOpen(true);
  };

  const handleSelectTrack = useCallback((next: StudyTrackId) => {
    Keyboard.dismiss();
    setStudyTrack(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const openFormula = useCallback((formula: FormulaEntry) => {
    if (openingRef.current) return;
    Keyboard.dismiss();
    openingRef.current = true;
    beginAppTransition();
    navigation.navigate('FormulaDetail', {
      formulaId: formula.id,
      formulaIds: visibleIds,
    });
  }, [navigation, visibleIds]);

  const handleToggleFavorite = useCallback((formulaId: string) => {
    Keyboard.dismiss();
    toggleFavoriteFormula(formulaId);
  }, []);

  const resetFilters = () => {
    Keyboard.dismiss();
    Haptics.selection();
    setQueryText('');
    setSelectedCategory('all');
    setFavoritesOnly(false);
    setTrackOnly(false);
  };

  const renderItem = useCallback<ListRenderItem<FormulaEntry>>(({ item }) => (
    <FormulaCard
      formula={item}
      isFavorite={favoriteSet.has(item.id)}
      onOpen={openFormula}
      onToggleFavorite={handleToggleFavorite}
    />
  ), [favoriteSet, handleToggleFavorite, openFormula]);

  const keyExtractor = useCallback((item: FormulaEntry) => item.id, []);
  const mountSearchInput = transitionSettled || searchActivated;
  const searchPlaceholder = isNarrow ? 'Caută o formulă' : 'Caută formule: Pitagora, delta, logaritmi...';
  const eyebrowText = trackOnly
    ? `${trackMeta.shortLabel.toUpperCase()} · ${filteredFormulas.length} FIȘE`
    : `TOATĂ PROGRAMA · ${filteredFormulas.length} FIȘE`;
  const listBottomPadding = keyboardVisible ? 18 : Math.max(insets.bottom, 16) + 22;

  return (
    <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
      <ComicBackdrop />
      <ScreenHeader
        compact
        title="Formule & Fișe"
        eyebrow={eyebrowText}
        onBack={() => {
          Keyboard.dismiss();
          navigation.goBack();
        }}
        rightIcon="class"
        rightLabel="Schimbă nivelul de studiu"
        onRight={openTrackPicker}
      />

      <View style={[styles.flex, keyboardVisible && { paddingBottom: keyboardInset }]}>
        <Pressable
          accessible={false}
          onPress={Keyboard.dismiss}
          style={[styles.controls, { paddingHorizontal: gutter }]}
        >
          <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
            <AppIcon name="search" size={22} />
            {mountSearchInput ? (
              <TextInput
                autoFocus={searchActivated}
                autoCorrect={false}
                returnKeyType="search"
                value={queryText}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onChangeText={setQueryText}
                onSubmitEditing={() => Keyboard.dismiss()}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.inkSoft}
                selectionColor={colors.violet}
                style={styles.searchInput}
              />
            ) : (
              <Pressable
                accessibilityRole="search"
                accessibilityLabel={searchPlaceholder}
                onPress={() => setSearchActivated(true)}
                style={styles.searchPlaceholderTouch}
              >
                <Text numberOfLines={1} style={styles.searchPlaceholderText}>{searchPlaceholder}</Text>
              </Pressable>
            )}
            {queryText ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Șterge căutarea"
                hitSlop={9}
                onPress={() => setQueryText('')}
                style={styles.clearSearch}
              >
                <MiniGlyph name="close" size={14} color={colors.ink} />
              </Pressable>
            ) : null}
            {searchFocused || keyboardVisible ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ascunde tastatura"
                hitSlop={6}
                onPress={() => {
                  Haptics.selection();
                  Keyboard.dismiss();
                }}
                style={({ pressed }) => [styles.dismissSearchChip, pressed && styles.pressed]}
              >
                <Text style={styles.dismissSearchText}>Gata</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.scopeRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: trackOnly }}
              onPress={() => {
                Keyboard.dismiss();
                Haptics.selection();
                setTrackOnly((value) => !value);
                listRef.current?.scrollToOffset({ offset: 0, animated: false });
              }}
              style={({ pressed }) => [
                styles.scopeChip,
                trackOnly && styles.scopeChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.84}
                style={[styles.scopeChipText, trackOnly && styles.scopeChipTextActive]}
              >
                {trackOnly ? `✦ ${trackMeta.shortLabel}` : 'Toată programa'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: favoritesOnly }}
              onPress={() => {
                Keyboard.dismiss();
                Haptics.selection();
                setFavoritesOnly((value) => !value);
                listRef.current?.scrollToOffset({ offset: 0, animated: false });
              }}
              style={({ pressed }) => [
                styles.scopeChip,
                favoritesOnly && styles.favChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.84}
                style={[styles.scopeChipText, favoritesOnly && styles.favChipTextActive]}
              >
                ★ Favorite ({profile.favoriteFormulaIds.length})
              </Text>
            </Pressable>
          </View>
        </Pressable>

        <View style={styles.categoryStripWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.categoryStrip, { paddingHorizontal: gutter }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: selectedCategory === 'all' }}
              onPress={() => {
                Keyboard.dismiss();
                Haptics.selection();
                setSelectedCategory('all');
                listRef.current?.scrollToOffset({ offset: 0, animated: false });
              }}
              style={({ pressed }) => [
                styles.catPill,
                selectedCategory === 'all' && styles.catPillActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.catPillText, selectedCategory === 'all' && styles.catPillTextActive]}>
                Toate
              </Text>
            </Pressable>

            {FORMULA_CATEGORIES.map((category) => {
              const active = selectedCategory === category.id;
              return (
                <Pressable
                  key={category.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    Keyboard.dismiss();
                    Haptics.selection();
                    setSelectedCategory(active ? 'all' : category.id);
                    listRef.current?.scrollToOffset({ offset: 0, animated: false });
                  }}
                  style={({ pressed }) => [
                    styles.catPill,
                    active && styles.catPillActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.catDot, { backgroundColor: active ? colors.lime : category.accent }]} />
                  <Text style={[styles.catPillText, active && styles.catPillTextActive]}>
                    {category.shortLabel}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <FlatList
          ref={listRef}
          data={renderedFormulas}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ItemSeparatorComponent={FormulaSeparator}
          ListEmptyComponent={(
            <Pressable
              accessible={false}
              onPress={Keyboard.dismiss}
              style={styles.emptyState}
            >
              <Mascot pose="thinking" size={108} active={motionActive} />
              <Text style={styles.emptyTitle}>
                {favoritesOnly && profile.favoriteFormulaIds.length === 0
                  ? 'Nicio formulă favorită încă'
                  : 'Nu am găsit această formulă'}
              </Text>
              <Text style={styles.emptyText}>
                {favoritesOnly && profile.favoriteFormulaIds.length === 0
                  ? 'Apasă pe steluța ☆ din dreptul formulelor importante ca să le ai la îndemână înainte de test.'
                  : 'Încearcă un alt cuvânt cheie sau afișează toate formulele din programă.'}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={resetFilters}
                style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
              >
                <Text style={styles.resetButtonText}>Arată toate formulele</Text>
              </Pressable>
            </Pressable>
          )}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={7}
          contentContainerStyle={[
            styles.listContent,
            { paddingHorizontal: gutter, paddingBottom: listBottomPadding },
          ]}
        />
      </View>

      {trackSheetEverOpened ? (
        <StudyTrackSheet
          visible={trackSheetOpen}
          selectedTrack={profile.track}
          onSelect={handleSelectTrack}
          onClose={() => setTrackSheetOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1, minHeight: 0 },
  controls: { paddingTop: 4, gap: 9 },
  searchBox: {
    height: 46,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.12)',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  searchBoxFocused: { borderColor: colors.violet },
  searchInput: {
    flex: 1,
    height: 42,
    paddingVertical: 0,
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 13.5,
  },
  searchPlaceholderTouch: { flex: 1, height: 42, justifyContent: 'center' },
  searchPlaceholderText: { fontFamily: fonts.bodyMedium, color: colors.inkMuted, fontSize: 13.5 },
  clearSearch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissSearchChip: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dismissSearchText: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 11.5,
    includeFontPadding: false,
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scopeChip: {
    flex: 1,
    minHeight: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeChipActive: {
    borderColor: colors.violet,
    backgroundColor: colors.violetSoft,
  },
  favChipActive: {
    borderColor: '#E3B63B',
    backgroundColor: colors.goldSoft,
  },
  scopeChipText: {
    fontFamily: fonts.bodyBold,
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 15,
    includeFontPadding: false,
  },
  scopeChipTextActive: {
    color: colors.violetDeep,
  },
  favChipTextActive: {
    color: '#7D4E00',
  },
  categoryStripWrap: {
    marginTop: 10,
    marginBottom: 4,
  },
  categoryStrip: {
    gap: 7,
    paddingVertical: 2,
    alignItems: 'center',
  },
  catPill: {
    minHeight: 33,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.11)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  catPillActive: {
    borderColor: colors.violet,
    backgroundColor: colors.violet,
  },
  catDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  catPillText: {
    fontFamily: fonts.bodyBold,
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 15,
    includeFontPadding: false,
  },
  catPillTextActive: {
    color: colors.paper,
  },
  listContent: {
    flexGrow: 1,
    paddingTop: 8,
  },
  separator: { height: 11 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 6,
    maxWidth: 310,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  resetButton: {
    marginTop: 16,
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 13,
  },
  pressed: { opacity: 0.78 },
});
