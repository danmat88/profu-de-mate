import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  InteractionManager,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { beginAppTransition } from '../../../shared/context/TransitionMotionContext';
import { useActionToast } from '../../../shared/hooks/useActionToast';
import { useKeyboardHeight } from '../../../shared/hooks/useKeyboardHeight';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { useScreenMotionActive, useTransitionSettled } from '../../../shared/hooks/useTransitionSettled';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, radii } from '../../../shared/theme';
import type { RootStackParamList } from '../../../shared/types';
import { ActionToast } from '../../../shared/ui/ActionToast';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { IconButton } from '../../../shared/ui/IconButton';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
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
import { prewarmStudyMath } from '../utils/prewarmStudyMath';
import { filterFormulas } from '../utils/studyDocumentBuilder';

type Props = NativeStackScreenProps<RootStackParamList, 'Formulas'>;

function FormulaSeparator() {
  return <View style={styles.separator} />;
}

export function FormulasScreen({ navigation, route }: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, contentWidth, isNarrow } = useResponsiveLayout(frame);
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
  const [trackOnly, setTrackOnly] = useState(
    profile.hasChosenTrack && !route.params?.showAllTracks && !route.params?.initialFavoritesOnly,
  );
  const [trackSheetOpen, setTrackSheetOpen] = useState(false);
  const [trackSheetEverOpened, setTrackSheetEverOpened] = useState(false);
  const [listExpanded, setListExpanded] = useState(reducedMotion);

  const listRef = useRef<FlatList<FormulaEntry>>(null);
  const openingRef = useRef(false);

  // Stagger full list expansion one frame after the visible cards upgrade to SVG
  // vectors so Android never bursts SearchInput + 25 cards + SVG ASTs on one tick.
  useEffect(() => {
    if (!transitionSettled) {
      setListExpanded(reducedMotion);
      return undefined;
    }
    if (reducedMotion) {
      setListExpanded(true);
      return undefined;
    }
    const raf = requestAnimationFrame(() => {
      setListExpanded(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, transitionSettled]);

  useFocusEffect(useCallback(() => {
    openingRef.current = false;
  }, []));

  const favoriteSet = useMemo(() => new Set(profile.favoriteFormulaIds), [profile.favoriteFormulaIds]);

  const filteredFormulas = useMemo(
    () => filterFormulas(FORMULAS_CATALOG, {
      track: trackOnly && profile.hasChosenTrack ? profile.track : null,
      category: selectedCategory,
      query: deferredQuery,
      favoritesOnly,
      favoriteIds: profile.favoriteFormulaIds,
    }),
    [deferredQuery, favoritesOnly, profile.favoriteFormulaIds, profile.hasChosenTrack, profile.track, selectedCategory, trackOnly],
  );

  const renderedFormulas = useMemo(
    () => (listExpanded || filteredFormulas.length <= 4 ? filteredFormulas : filteredFormulas.slice(0, 4)),
    [filteredFormulas, listExpanded],
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

  const handleSelectTrack = (next: StudyTrackId) => {
    Keyboard.dismiss();
    setStudyTrack(next);
    setTrackOnly(true);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const openFormula = useCallback((formula: FormulaEntry) => {
    if (openingRef.current) return;
    if (keyboardVisible) Keyboard.dismiss();
    openingRef.current = true;
    beginAppTransition();
    navigation.navigate('FormulaDetail', {
      formulaId: formula.id,
      formulaIds: visibleIds,
    });
  }, [keyboardVisible, navigation, visibleIds]);

  const { toast, showToast } = useActionToast();

  const handleToggleFavorite = useCallback((formulaId: string) => {
    if (keyboardVisible) Keyboard.dismiss();
    const added = toggleFavoriteFormula(formulaId);
    if (added) {
      showToast({
        message: 'Salvată în Caiet → Formule',
        tone: 'gold',
      });
    } else {
      showToast({
        message: 'Scoasă din favorite',
        tone: 'neutral',
        actionLabel: 'Anulează',
        onAction: () => {
          toggleFavoriteFormula(formulaId);
        },
      });
    }
  }, [keyboardVisible, showToast]);

  const resetFilters = () => {
    if (keyboardVisible) Keyboard.dismiss();
    Haptics.selection();
    setQueryText('');
    setSelectedCategory('all');
    setFavoritesOnly(false);
    setTrackOnly(false);
  };

  // Quietly pre-flatten the first visible formula sheets while idle so tapping
  // any card opens FormulaDetail in 0ms JS math time with zero morphing.
  useEffect(() => {
    if (!transitionSettled || filteredFormulas.length === 0) return undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      const top = filteredFormulas.slice(0, 6);
      for (const entry of top) {
        prewarmStudyMath({
          displayLatex: [
            entry.formulaLatex,
            ...(entry.formulas?.map((item) => item.latex) ?? []),
          ],
          inlineTexts: [
            entry.whenToUse,
            entry.pitfall,
            ...(entry.formulas?.map((item) => item.label) ?? []),
          ],
          blocks: entry.example,
        });
      }
    });
    return () => task.cancel();
  }, [filteredFormulas, transitionSettled]);

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
  const eyebrowText = trackOnly && profile.hasChosenTrack
    ? `${trackMeta.shortLabel.toUpperCase()} · ${filteredFormulas.length} FIȘE`
    : `TOATĂ PROGRAMA · ${filteredFormulas.length} FIȘE`;
  const listBottomPadding = keyboardVisible ? 18 : Math.max(insets.bottom, 16) + 22;

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      <ComicBackdrop />

      {/* Full-bleed curved Sapphire-Cyan formulas library canopy */}
      <View style={[styles.canopy, { paddingTop: insets.top ?? 0 }]}>
        <LinearGradient
          colors={['#1E8EE2', '#2E4DE8', '#3F1EC6', '#2B1098']}
          start={{ x: 0.06, y: 0 }}
          end={{ x: 0.94, y: 1 }}
          style={styles.fill}
        />
        <View pointerEvents="none" style={styles.canopyGlowCyan} />
        <View pointerEvents="none" style={styles.canopyGlowRight} />
        <View pointerEvents="none" style={styles.canopyOrbitArc} />
        <Text accessible={false} style={styles.canopyGlyphPi}>π</Text>
        <Text accessible={false} style={styles.canopyGlyphRoot}>√</Text>

        <View style={[styles.canopyInner, { width: contentWidth }]}>
          <View style={styles.canopyRow}>
            <IconButton
              label="Înapoi"
              onPress={() => {
                Keyboard.dismiss();
                navigation.goBack();
              }}
              size={42}
              style={styles.canopyActionBtn}
            >
              <MiniGlyph name="back" size={18} color={colors.violetDeep} />
            </IconButton>

            <View style={styles.canopyCopy}>
              <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={styles.canopyTitle}>
                Formule <Text style={styles.canopyTitleAccent}>&amp; Fișe</Text>
              </Text>
              <View style={styles.canopyEyebrowRow}>
                <View style={styles.canopyEyebrowDot} />
                <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.canopyEyebrow}>
                  {eyebrowText}
                </Text>
              </View>
            </View>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={profile.hasChosenTrack ? 'Schimbă nivelul de studiu' : 'Alege nivelul de studiu'}
              pressedScale={0.95}
              haptic="selection"
              onPress={openTrackPicker}
              contentStyle={[styles.trackPill, !profile.hasChosenTrack && styles.trackPillUnchosen]}
            >
              <View style={[styles.trackPillDot, !profile.hasChosenTrack && styles.trackPillDotUnchosen]} />
              <Text
                maxFontSizeMultiplier={1.15}
                numberOfLines={1}
                style={[styles.trackPillText, !profile.hasChosenTrack && styles.trackPillTextUnchosen]}
              >
                {profile.hasChosenTrack ? `${trackMeta.shortLabel} ▾` : 'Nivel ▾'}
              </Text>
            </PressableScale>
          </View>
        </View>
      </View>

      <View style={[styles.flex, keyboardVisible && { paddingBottom: keyboardInset }]}>
        {/* Elevated 3D search box straddling the curved canopy horizon */}
        <Pressable
          accessible={false}
          onPress={Keyboard.dismiss}
          style={[styles.controls, { paddingHorizontal: gutter }]}
        >
          <View style={[styles.controlsInner, { maxWidth: contentWidth }]}>
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
                accessibilityState={{ selected: trackOnly && profile.hasChosenTrack }}
                onPress={() => {
                  Keyboard.dismiss();
                  Haptics.selection();
                  if (!profile.hasChosenTrack) {
                    openTrackPicker();
                    return;
                  }
                  setTrackOnly((value) => !value);
                  listRef.current?.scrollToOffset({ offset: 0, animated: false });
                }}
                style={({ pressed }) => [
                  styles.scopeChip,
                  trackOnly && profile.hasChosenTrack && styles.scopeChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.84}
                  style={[styles.scopeChipText, trackOnly && profile.hasChosenTrack && styles.scopeChipTextActive]}
                >
                  {trackOnly && profile.hasChosenTrack ? `✦ ${trackMeta.shortLabel}` : 'Toată programa'}
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
          initialNumToRender={4}
          maxToRenderPerBatch={2}
          updateCellsBatchingPeriod={48}
          windowSize={5}
          contentContainerStyle={[
            styles.listContent,
            { paddingHorizontal: gutter, paddingBottom: listBottomPadding },
          ]}
        />
      </View>

      {trackSheetEverOpened ? (
        <StudyTrackSheet
          visible={trackSheetOpen}
          selectedTrack={profile.hasChosenTrack ? profile.track : null}
          onSelect={handleSelectTrack}
          onClose={() => setTrackSheetOpen(false)}
        />
      ) : null}

      <ActionToast toast={toast} bottomOffset={Math.max(insets.bottom, 16) + 14} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  flex: { flex: 1, minHeight: 0 },

  canopy: {
    width: '100%',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    paddingBottom: 34,
    position: 'relative',
    zIndex: 4,
  },
  canopyGlowCyan: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -80,
    left: -50,
    backgroundColor: 'rgba(67, 214, 230, 0.24)',
  },
  canopyGlowRight: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -40,
    right: -40,
    backgroundColor: 'rgba(216, 255, 62, 0.14)',
  },
  canopyOrbitArc: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    top: -120,
    right: -80,
  },
  canopyGlyphPi: {
    position: 'absolute',
    right: 98,
    bottom: 12,
    fontFamily: fonts.display,
    fontSize: 28,
    color: 'rgba(255, 255, 255, 0.12)',
    transform: [{ rotate: '-10deg' }],
  },
  canopyGlyphRoot: {
    position: 'absolute',
    left: 24,
    bottom: 10,
    fontFamily: fonts.display,
    fontSize: 22,
    color: 'rgba(216, 255, 62, 0.24)',
  },
  canopyInner: {
    maxWidth: 560,
    alignSelf: 'center',
    paddingTop: 6,
  },
  canopyRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  canopyActionBtn: {
    borderRadius: 21,
    borderBottomWidth: 3.5,
    borderBottomColor: '#C5B8FA',
    backgroundColor: '#FFFFFF',
  },
  canopyCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  canopyTitle: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 23,
    lineHeight: 27,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(18, 6, 62, 0.28)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },
  canopyTitleAccent: {
    color: colors.lime,
  },
  canopyEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  canopyEyebrowDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
    backgroundColor: colors.lime,
  },
  canopyEyebrow: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: 'rgba(240, 245, 255, 0.92)',
    fontSize: 10,
    letterSpacing: 0.9,
    includeFontPadding: false,
  },
  trackPill: {
    minHeight: 38,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#FFFFFF',
    borderBottomColor: '#BDD5FA',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  trackPillDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
    backgroundColor: colors.cyanDeep,
  },
  trackPillUnchosen: {
    backgroundColor: '#FFF7CF',
    borderColor: '#F6E076',
    borderBottomColor: '#C49F12',
  },
  trackPillDotUnchosen: {
    backgroundColor: '#B87B00',
  },
  trackPillText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 11.5,
    includeFontPadding: false,
  },
  trackPillTextUnchosen: {
    color: '#6E4600',
  },

  controls: { marginTop: -23, zIndex: 8 },
  controlsInner: { width: '100%', alignSelf: 'center', gap: 9 },
  searchBox: {
    height: 48,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  searchBoxFocused: {
    borderColor: colors.violet,
    borderBottomColor: colors.violetDeep,
  },
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
    minHeight: 38,
    borderRadius: radii.pill,
    borderWidth: 1.3,
    borderBottomWidth: 3,
    borderColor: '#E8E0FC',
    borderBottomColor: '#D4C7F7',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeChipActive: {
    borderColor: colors.violet,
    borderBottomColor: '#4A18C4',
    backgroundColor: colors.violetSoft,
  },
  favChipActive: {
    borderColor: '#E3B63B',
    borderBottomColor: '#C49218',
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
    minHeight: 35,
    borderRadius: radii.pill,
    borderWidth: 1.2,
    borderBottomWidth: 2.8,
    borderColor: '#EAE2FF',
    borderBottomColor: '#D6CAFA',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  catPillActive: {
    borderColor: colors.violet,
    borderBottomColor: '#4114B4',
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
    minHeight: 46,
    paddingHorizontal: 22,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: '#BCEF12',
    borderBottomColor: '#7EA508',
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 13.5,
  },
  pressed: { opacity: 0.82 },
});
