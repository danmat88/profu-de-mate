import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { beginAppTransition } from '../../../shared/context/TransitionMotionContext';
import { useActionToast } from '../../../shared/hooks/useActionToast';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { useTransitionSettled } from '../../../shared/hooks/useTransitionSettled';
import * as Haptics from '../../../shared/services/haptics';
import {
  getMathReadingScale,
  mathReadingScaleBadge,
  nextMathReadingScale,
  setMathReadingScale,
  type MathReadingScale,
} from '../../../shared/storage/localPreferences';
import { colors, fonts, radii } from '../../../shared/theme';
import type { AiPracticeExercisePayload, RootStackParamList } from '../../../shared/types';
import { ActionToast } from '../../../shared/ui/ActionToast';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { FavoriteStarButton } from '../../../shared/ui/FavoriteStarButton';
import { IconButton } from '../../../shared/ui/IconButton';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { StepTransitionStage } from '../../../shared/ui/StepTransitionStage';
import { Text } from '../../../shared/ui/Typography';
import { NativeMathFormula } from '../../math/components/NativeMathFormula';
import { AiPracticeSheet } from '../../practice/components/AiPracticeSheet';
import { getPracticeQuestionsForFormula } from '../../practice/utils/practiceEngine';
import { NativeMathVisual } from '../components/NativeMathVisual';
import { StudyInlineText } from '../components/StudyInlineText';
import { StudyBlocksView } from '../components/StudyRichContent';
import { FORMULAS_CATALOG } from '../data/formulasCatalog';
import { getRenderedStudyMath } from '../data/renderedMath.generated';
import { recordFormulaViewed, toggleFavoriteFormula, useStudyProfile } from '../services/studyStorage';
import { getFormulaCategoryMeta } from '../types';
import { prewarmStudyMath } from '../utils/prewarmStudyMath';
import { getFormulaById } from '../utils/studyDocumentBuilder';

type Props = NativeStackScreenProps<RootStackParamList, 'FormulaDetail'>;

/**
 * Pure native textbook formula sheet. Paints completely on Frame 0 using
 * pre-compiled Fira Math SVG vectors (`NativeMathFormula`) — zero WebView boot,
 * zero title-then-content flash, instant `A / A+ / A++` zoom, 60fps scroll,
 * and 1-tap AI exercise generation tailored directly to the active formula.
 */
export function FormulaDetailScreen({ navigation, route }: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, contentWidth } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const transitionSettled = useTransitionSettled(navigation, reducedMotion);
  const profile = useStudyProfile();

  const sequenceIds = useMemo(
    () => (route.params.formulaIds && route.params.formulaIds.length > 0
      ? route.params.formulaIds
      : FORMULAS_CATALOG.map((item) => item.id)),
    [route.params.formulaIds],
  );

  const [currentId, setCurrentId] = useState(route.params.formulaId);
  const [stepTransition, setStepTransition] = useState<{ direction: -1 | 0 | 1; animate: boolean }>({
    direction: 0,
    animate: false,
  });
  const [readingScale, setReadingScale] = useState<MathReadingScale>(() => getMathReadingScale());
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [aiSheetEverOpened, setAiSheetEverOpened] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setStepTransition({ direction: 0, animate: false });
    setCurrentId(route.params.formulaId);
  }, [route.params.formulaId]);

  const formula = useMemo(
    () => getFormulaById(currentId) ?? FORMULAS_CATALOG[0],
    [currentId],
  );
  const categoryMeta = getFormulaCategoryMeta(formula.category);
  const isFavorite = profile.favoriteFormulaIds.includes(formula.id);
  const currentIndex = sequenceIds.indexOf(formula.id);
  const prevId = currentIndex > 0 ? sequenceIds[currentIndex - 1] : undefined;
  const nextId = currentIndex >= 0 && currentIndex < sequenceIds.length - 1 ? sequenceIds[currentIndex + 1] : undefined;

  // Persist viewed progress strictly after the push transition settles so disk
  // writes and cross-stack profile notifications never stall the slide-in.
  useEffect(() => {
    if (!transitionSettled) return undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      recordFormulaViewed(formula.id);
    });
    return () => task.cancel();
  }, [formula.id, transitionSettled]);

  // Reset scroll atomically with the newly mounted formula sheet.
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [formula.id]);

  // Pre-flatten neighboring formula sheets strictly after the active sheet settles.
  useEffect(() => {
    if (!transitionSettled) return undefined;
    const neighborIds = [nextId, prevId].filter((id): id is string => Boolean(id));
    if (neighborIds.length === 0) return undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      for (const id of neighborIds) {
        const entry = getFormulaById(id);
        if (!entry) continue;
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
  }, [nextId, prevId, transitionSettled]);

  const keyFormulas = useMemo(() => {
    if (formula.formulas && formula.formulas.length > 0) return formula.formulas;
    return [{ latex: formula.formulaLatex, spoken: formula.formulaSpoken }];
  }, [formula]);

  const formulaPracticeQuestions = useMemo(
    () => getPracticeQuestionsForFormula(formula.id),
    [formula.id],
  );
  const hasFormulaPractice = formulaPracticeQuestions.length > 0;

  const { toast, showToast } = useActionToast();

  const handleToggleFavorite = useCallback(() => {
    const added = toggleFavoriteFormula(formula.id);
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
          toggleFavoriteFormula(formula.id);
        },
      });
    }
  }, [formula.id, showToast]);

  const cycleScale = useCallback(() => {
    Haptics.selection();
    setReadingScale((current) => {
      const next = nextMathReadingScale(current);
      setMathReadingScale(next);
      return next;
    });
  }, []);

  const stepTo = useCallback((targetId: string | undefined, stepDirection: -1 | 1) => {
    if (!targetId) return;
    Haptics.selection();
    setStepTransition({ direction: stepDirection, animate: true });
    setCurrentId(targetId);
  }, []);

  const openFormulaAiGenerator = useCallback(() => {
    Haptics.selection();
    setAiSheetEverOpened(true);
    setAiSheetOpen(true);
  }, []);

  const handleAiGenerated = useCallback((exercise: AiPracticeExercisePayload) => {
    beginAppTransition();
    navigation.navigate('PracticeSession', {
      mode: 'ai',
      category: exercise.category,
      formulaId: formula.id,
      aiExercise: exercise,
    });
  }, [formula.id, navigation]);

  const handlePrimaryPractice = useCallback(() => {
    if (hasFormulaPractice) {
      beginAppTransition();
      navigation.navigate('PracticeSession', {
        mode: 'formula',
        formulaId: formula.id,
        category: formula.category,
      });
      return;
    }
    openFormulaAiGenerator();
  }, [formula.category, formula.id, hasFormulaPractice, navigation, openFormulaAiGenerator]);

  const innerMathWidth = Math.max(220, Math.min(contentWidth, frame.width - gutter * 2) - 32);
  const heroMathWidth = Math.max(200, innerMathWidth - 26);
  const eyebrowText = sequenceIds.length > 1 && currentIndex >= 0
    ? `FIȘA ${currentIndex + 1} DIN ${sequenceIds.length}`
    : 'FIȘĂ DE FORMULĂ';

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      <ComicBackdrop />

      {/* Full-bleed curved Sapphire-Violet formula canopy */}
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
              onPress={() => navigation.goBack()}
              size={42}
              style={styles.canopyActionBtn}
            >
              <MiniGlyph name="back" size={18} color={colors.violetDeep} />
            </IconButton>

            <View style={styles.canopyCopy}>
              <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={styles.canopyTitle}>
                {categoryMeta.shortLabel}
              </Text>
              <View style={styles.canopyEyebrowRow}>
                <View style={styles.canopyEyebrowDot} />
                <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.canopyEyebrow}>
                  {eyebrowText}
                </Text>
              </View>
            </View>

            <FavoriteStarButton
              active={isFavorite}
              variant="canopy"
              icon="bookmark"
              accessibilityLabel={isFavorite ? 'Scoate formula din favorite' : 'Păstrează formula la favorite'}
              onPress={handleToggleFavorite}
            />
          </View>
        </View>
      </View>

      {/* Straddling 3D formula metadata & zoom bar */}
      <View style={[styles.toolbarWrap, { paddingHorizontal: gutter }]}>
        <View style={[styles.toolbar, { maxWidth: contentWidth }]}>
          <View style={styles.toolbarLeft}>
            <View style={styles.categoryPill}>
              <View style={[styles.catDot, { backgroundColor: categoryMeta.accent }]} />
              <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.categoryPillText}>
                {formula.examTag ?? categoryMeta.label}
              </Text>
            </View>
            {isFavorite ? (
              <View style={styles.savedPill}>
                <Text maxFontSizeMultiplier={1.15} style={styles.savedPillText}>★ Favorită</Text>
              </View>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Mărime text formule: ${mathReadingScaleBadge(readingScale)}`}
            hitSlop={6}
            onPress={cycleScale}
            style={({ pressed }) => [styles.scaleButton, pressed && styles.pressed]}
          >
            <Text maxFontSizeMultiplier={1.15} style={styles.scaleButtonText}>
              {mathReadingScaleBadge(readingScale)}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: gutter },
        ]}
      >
        <StepTransitionStage
          key={formula.id}
          direction={stepTransition.direction}
          animate={stepTransition.animate}
          style={[styles.sheetCard, { maxWidth: contentWidth }]}
        >
          <View pointerEvents="none" style={styles.cardTopGloss} />
          <View style={styles.heroHeader}>
            <View style={[styles.accentBar, { backgroundColor: categoryMeta.accent }]} />
            <Text style={styles.sheetTitle}>{formula.title}</Text>
          </View>

          <View style={styles.formulaHeroBox}>
            <Text style={styles.formulaHeroEyebrow}>FORMULE ESENȚIALE</Text>
            <View style={styles.formulaRows}>
              {keyFormulas.map((expr, idx) => {
                const compiled = getRenderedStudyMath(expr.latex, 'display');
                return (
                  <View
                    key={`${formula.id}-f-${idx}`}
                    style={[
                      styles.formulaRow,
                      idx > 0 && styles.formulaRowBorder,
                    ]}
                  >
                    {expr.label ? (
                      <StudyInlineText
                        text={expr.label}
                        scale={readingScale * 0.9}
                        color={colors.violetDeep}
                        textStyle={styles.formulaRowLabel}
                        maxMathWidth={heroMathWidth}
                      />
                    ) : null}
                    {compiled ? (
                      <View style={styles.formulaSvgWrap}>
                        <NativeMathFormula
                          rendered={compiled}
                          size="hero"
                          scale={readingScale}
                          maxWidth={heroMathWidth}
                          fadeColor="#FFFFFF"
                          accessibilityLabel={expr.spoken}
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>CÂND O FOLOSEȘTI</Text>
            <StudyInlineText
              text={formula.whenToUse}
              scale={readingScale}
              maxMathWidth={innerMathWidth}
              textStyle={styles.bodyText}
            />
          </View>

          {formula.visual ? (
            <NativeMathVisual
              visual={formula.visual.visual}
              spoken={formula.visual.spoken}
              scale={readingScale}
            />
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>EXEMPLU REZOLVAT PAS CU PAS</Text>
            <StudyBlocksView
              blocks={formula.example}
              scale={readingScale}
              maxWidth={innerMathWidth}
            />
          </View>

          <View style={styles.pitfallBox}>
            <View style={styles.pitfallHeader}>
              <View style={styles.pitfallDot} />
              <Text style={styles.pitfallEyebrow}>ATENȚIE LA CAPCANĂ!</Text>
            </View>
            <StudyInlineText
              text={formula.pitfall}
              scale={readingScale * 0.97}
              maxMathWidth={innerMathWidth - 16}
              textStyle={styles.pitfallText}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Generează un exercițiu AI cu ${formula.title}`}
            onPress={openFormulaAiGenerator}
            style={({ pressed }) => [styles.aiFormulaCard, pressed && styles.pressed]}
          >
            <View style={styles.aiFormulaIcon}>
              <MiniGlyph name="spark" size={16} color={colors.violetDeep} />
            </View>
            <View style={styles.aiFormulaCopy}>
              <Text style={styles.aiFormulaEyebrow}>✦ EXERCIȚIU ORIGINAL · PROFU’ AI</Text>
              <Text style={styles.aiFormulaTitle}>Generează o problemă pe această formulă</Text>
            </View>
            <MiniGlyph name="next" size={15} color={colors.violetDeep} />
          </Pressable>
        </StepTransitionStage>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            paddingHorizontal: gutter,
            paddingBottom: Math.max(insets.bottom, 12) + 6,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Formula anterioară"
          disabled={!prevId}
          onPress={() => stepTo(prevId, -1)}
          style={({ pressed }) => [
            styles.stepBtn,
            !prevId && styles.stepBtnDisabled,
            pressed && prevId && styles.pressed,
          ]}
        >
          <MiniGlyph name="back" size={18} color={prevId ? colors.ink : colors.inkMuted} />
        </Pressable>

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={
            hasFormulaPractice
              ? `Exersează întrebări cu ${formula.title}`
              : `Generează exercițiu AI pentru ${formula.title}`
          }
          pressedScale={0.97}
          haptic="medium"
          onPress={handlePrimaryPractice}
          style={styles.practiceCtaWrap}
          contentStyle={styles.practiceCta}
        >
          <LinearGradient
            colors={['#EDFF7A', '#D8FF3E', '#BCEF12']}
            start={{ x: 0.08, y: 0 }}
            end={{ x: 0.92, y: 1 }}
            style={styles.fill}
          />
          <View pointerEvents="none" style={styles.ctaTopGloss} />
          <View style={styles.practiceCtaBadge}>
            <AppIcon name={hasFormulaPractice ? 'practice' : 'hint'} size={20} />
          </View>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={styles.practiceCtaText}
          >
            {hasFormulaPractice
              ? `Exersează (${formulaPracticeQuestions.length})`
              : 'Exercițiu AI'}
          </Text>
          <View style={styles.practiceArrow}>
            <MiniGlyph name="next" size={14} color={colors.paper} />
          </View>
        </PressableScale>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Formula următoare"
          disabled={!nextId}
          onPress={() => stepTo(nextId, 1)}
          style={({ pressed }) => [
            styles.stepBtn,
            !nextId && styles.stepBtnDisabled,
            pressed && nextId && styles.pressed,
          ]}
        >
          <MiniGlyph name="next" size={18} color={nextId ? colors.ink : colors.inkMuted} />
        </Pressable>
      </View>

      {aiSheetEverOpened ? (
        <AiPracticeSheet
          visible={aiSheetOpen}
          track={profile.track}
          hasChosenTrack={profile.hasChosenTrack}
          initialCategory={formula.category}
          formulaTitle={formula.title}
          formulaId={formula.id}
          onGenerated={handleAiGenerated}
          onClose={() => setAiSheetOpen(false)}
        />
      ) : null}

      <ActionToast toast={toast} bottomOffset={Math.max(insets.bottom, 16) + 72} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },

  canopy: {
    width: '100%',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    paddingBottom: 30,
    position: 'relative',
    zIndex: 4,
  },
  canopyGlowCyan: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    top: -80,
    left: -50,
    backgroundColor: 'rgba(67, 214, 230, 0.24)',
  },
  canopyGlowRight: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    top: -42,
    right: -38,
    backgroundColor: 'rgba(216, 255, 62, 0.14)',
  },
  canopyOrbitArc: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    top: -118,
    right: -76,
  },
  canopyGlyphPi: {
    position: 'absolute',
    right: 72,
    bottom: 10,
    fontFamily: fonts.display,
    fontSize: 26,
    color: 'rgba(255, 255, 255, 0.12)',
    transform: [{ rotate: '-10deg' }],
  },
  canopyGlyphRoot: {
    position: 'absolute',
    left: 24,
    bottom: 8,
    fontFamily: fonts.display,
    fontSize: 21,
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
  canopyFavActive: {
    backgroundColor: '#FFE57A',
    borderColor: '#FFF3B8',
    borderBottomColor: '#D6A118',
  },
  canopyCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  canopyTitle: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(18, 6, 62, 0.28)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
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

  toolbarWrap: {
    marginTop: -20,
    paddingBottom: 10,
    zIndex: 8,
    alignItems: 'center',
  },
  toolbar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  toolbarLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  categoryPill: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
  },
  catDot: {
    width: 7.5,
    height: 7.5,
    borderRadius: 4,
    flexShrink: 0,
  },
  categoryPillText: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: colors.ink,
    letterSpacing: 0.25,
  },
  savedPill: {
    minHeight: 36,
    paddingHorizontal: 11,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 3.2,
    borderColor: '#FBE08A',
    borderBottomColor: '#DDB038',
    backgroundColor: '#FFF5C4',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  savedPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    color: '#8C5600',
  },
  scaleButton: {
    minWidth: 48,
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scaleButtonText: {
    fontFamily: fonts.display,
    fontSize: 13.5,
    color: colors.violetDeep,
  },
  scrollContent: {
    paddingTop: 2,
    paddingBottom: 20,
    alignItems: 'center',
  },
  sheetCard: {
    width: '100%',
    borderRadius: 26,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 17,
    gap: 17,
    overflow: 'hidden',
    position: 'relative',
  },
  cardTopGloss: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  accentBar: {
    width: 4.5,
    alignSelf: 'stretch',
    minHeight: 28,
    borderRadius: 4,
    marginTop: 2,
  },
  sheetTitle: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 27,
    color: colors.ink,
  },
  formulaHeroBox: {
    borderRadius: 22,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#DFD2FA',
    borderBottomColor: '#C5B0F4',
    backgroundColor: '#F7F2FF',
    paddingHorizontal: 10,
    paddingVertical: 13,
    gap: 10,
  },
  formulaHeroEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.9,
    color: colors.violetDeep,
    paddingHorizontal: 2,
  },
  formulaRows: {
    gap: 11,
  },
  formulaRow: {
    gap: 7,
  },
  formulaRowBorder: {
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 60, 255, 0.12)',
  },
  formulaRowLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 2,
  },
  formulaSvgWrap: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.3,
    borderBottomWidth: 3,
    borderColor: '#E8E0FC',
    borderBottomColor: '#D4C7F7',
    paddingVertical: 13,
    paddingHorizontal: 8,
    alignItems: 'center',
    overflow: 'hidden',
  },
  section: {
    gap: 9,
  },
  sectionEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.85,
    color: colors.violetDeep,
  },
  bodyText: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22.5,
    color: colors.ink,
  },
  pitfallBox: {
    borderRadius: 20,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#FFD6C4',
    borderBottomColor: '#F2B296',
    backgroundColor: '#FFF5F0',
    padding: 14,
    gap: 6,
  },
  pitfallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  pitfallDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.peachDeep,
  },
  pitfallEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.peachDeep,
  },
  pitfallText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20.5,
    color: colors.ink,
  },
  aiFormulaCard: {
    borderRadius: 20,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#DFD2FA',
    borderBottomColor: '#C5B0F4',
    backgroundColor: '#F7F2FF',
    paddingHorizontal: 13,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiFormulaIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    borderWidth: 1.2,
    borderBottomWidth: 2.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  aiFormulaCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  aiFormulaEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.65,
    color: colors.violetDeep,
  },
  aiFormulaTitle: {
    fontFamily: fonts.display,
    fontSize: 14.5,
    lineHeight: 19,
    color: colors.ink,
  },
  bottomBar: {
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 18,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepBtnDisabled: {
    opacity: 0.42,
  },
  practiceCtaWrap: {
    flex: 1,
    minWidth: 0,
  },
  practiceCta: {
    minHeight: 52,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderBottomWidth: 4.5,
    borderColor: '#E8FF78',
    borderBottomColor: '#7EA508',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  ctaTopGloss: {
    position: 'absolute',
    top: 2,
    left: 22,
    right: 22,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  practiceCtaBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  practiceCtaText: {
    flex: 1,
    flexShrink: 1,
    fontFamily: fonts.display,
    fontSize: 15.5,
    color: colors.ink,
    textAlign: 'center',
  },
  practiceArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.78,
  },
});
