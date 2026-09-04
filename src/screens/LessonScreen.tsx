import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { ComicButton } from '../components/ComicButton';
import { FeedbackSheet } from '../components/FeedbackSheet';
import { MathDocumentView } from '../components/MathDocumentView';
import { MiniGlyph } from '../components/MiniGlyph';
import { ScreenHeader } from '../components/ScreenHeader';
import { Text } from '../components/Typography';
import { useCommercial } from '../context/CommercialContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { setLessonFavorite } from '../services/lessons';
import { forgetLessonPresentation, markLessonPresentationReady } from '../services/lessonPresentation';
import { deleteTemporaryCapturedImages } from '../services/temporaryImages';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../types';
import { contentToAccessibleText } from '../utils/mathContent';
import type { MathDocumentDefinition, MathDocumentTone } from '../utils/mathDocument';

type Props = NativeStackScreenProps<RootStackParamList, 'Lesson'>;
type ProblemView = 'statement' | 'photo';

const documentTones: MathDocumentTone[] = ['cyan', 'peach', 'lime', 'violet'];

export function LessonScreen({ navigation, route }: Props) {
  const { gutter } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { refresh: refreshCommercialAccess } = useCommercial();
  const lesson = route.params.lesson;
  const sourceImage = route.params.sourceImage;
  const isCheck = lesson.mode === 'check';
  const isFromNotebook = route.params.source === 'notebook';
  const [step, setStep] = useState(0);
  const [alternate, setAlternate] = useState(false);
  const [problemOpen, setProblemOpen] = useState(false);
  const [problemView, setProblemView] = useState<ProblemView>('statement');
  const [saved, setSaved] = useState(route.params.isFavorite ?? false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const alternateReveal = useRef(new Animated.Value(0)).current;
  const problemReveal = useRef(new Animated.Value(0)).current;
  const savedReveal = useRef(new Animated.Value(0)).current;
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveLocked = useRef(false);
  const pagingLocked = useRef(false);
  const pagingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = lesson.steps[step];
  const tone = documentTones[step % documentTones.length];
  const bottomSpace = Math.max(insets.bottom, 10);
  const problemAccessible = contentToAccessibleText(lesson.problem);
  const nextTitle = step === lesson.steps.length - 1 ? 'Vezi rezultatul' : 'Continuă';

  const lessonDocument = useMemo<MathDocumentDefinition>(() => ({
    accessibilityLabel: `${current.title}. ${contentToAccessibleText(current.explanation)}. ${contentToAccessibleText(current.note)}`,
    variant: 'lesson',
    sections: [
      { kind: 'heading', eyebrow: current.kicker, title: current.title, tone },
      { kind: 'content', content: current.explanation },
      ...(current.note.length > 0
        ? [{ kind: 'note' as const, label: 'DE ȚINUT MINTE', content: current.note, tone: 'lime' as const }]
        : []),
    ],
  }), [current, tone]);

  const alternateDocument = useMemo<MathDocumentDefinition>(() => ({
    accessibilityLabel: `O altă explicație. ${contentToAccessibleText(current.alternative)}`,
    variant: 'alternate',
    sections: [{ kind: 'content', content: current.alternative }],
  }), [current.alternative]);

  const problemDocument = useMemo<MathDocumentDefinition>(() => ({
    accessibilityLabel: `Enunțul complet. ${problemAccessible}`,
    variant: 'problem',
    sections: [{ kind: 'content', content: lesson.problem }],
  }), [lesson.problem, problemAccessible]);

  useEffect(() => {
    setAlternate(false);
    alternateReveal.setValue(0);
  }, [alternateReveal, step]);

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    if (pagingTimer.current) clearTimeout(pagingTimer.current);
  }, []);

  useEffect(() => navigation.addListener('beforeRemove', () => {
    forgetLessonPresentation(route.params.lessonId);
    deleteTemporaryCapturedImages([sourceImage?.uri]);
  }), [navigation, route.params.lessonId, sourceImage?.uri]);

  useEffect(() => {
    if (route.params.source !== 'flow') return undefined;
    let refreshed = false;
    return navigation.addListener('transitionEnd', (event) => {
      if (event.data.closing || refreshed) return;
      refreshed = true;
      void refreshCommercialAccess();
    });
  }, [navigation, refreshCommercialAccess, route.params.source]);

  const lockPaging = () => {
    if (pagingLocked.current) return false;
    pagingLocked.current = true;
    pagingTimer.current = setTimeout(() => { pagingLocked.current = false; }, 420);
    return true;
  };

  const next = () => {
    if (!lockPaging()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < lesson.steps.length - 1) {
      setStep((value) => value + 1);
      return;
    }
    if (isFromNotebook) {
      navigation.replace('Summary', { lesson, lessonId: route.params.lessonId, isFavorite: saved });
      return;
    }
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Home' },
        { name: 'Summary', params: { lesson, lessonId: route.params.lessonId, isFavorite: saved } },
      ],
    });
  };

  const back = () => {
    if (!lockPaging()) return;
    Haptics.selectionAsync();
    if (step > 0) {
      setStep((value) => value - 1);
      return;
    }
    if (isFromNotebook) navigation.goBack();
    else if (navigation.canGoBack()) navigation.popToTop();
    else navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const closeAlternate = () => {
    if (reducedMotion) {
      setAlternate(false);
      return;
    }
    Animated.timing(alternateReveal, { toValue: 0, duration: 140, useNativeDriver: true })
      .start(() => setAlternate(false));
  };

  const explainDifferently = () => {
    Haptics.selectionAsync();
    if (alternate) {
      closeAlternate();
      return;
    }
    setAlternate(true);
    alternateReveal.setValue(0);
    if (reducedMotion) alternateReveal.setValue(1);
    else Animated.spring(alternateReveal, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 7 }).start();
  };

  const closeProblem = () => {
    if (reducedMotion) {
      setProblemOpen(false);
      return;
    }
    Animated.timing(problemReveal, { toValue: 0, duration: 140, useNativeDriver: true })
      .start(() => setProblemOpen(false));
  };

  const toggleProblem = () => {
    Haptics.selectionAsync();
    if (problemOpen) {
      closeProblem();
      return;
    }
    setProblemView('statement');
    setProblemOpen(true);
    problemReveal.setValue(0);
    if (reducedMotion) problemReveal.setValue(1);
    else Animated.spring(problemReveal, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 7 }).start();
  };

  const toggleSaved = async () => {
    if (saveLocked.current) return;
    saveLocked.current = true;
    const nextSaved = !saved;
    setSaved(nextSaved);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    if (!nextSaved) setShowSavedToast(false);
    else {
      setShowSavedToast(true);
      savedReveal.setValue(0);
      if (reducedMotion) savedReveal.setValue(1);
      else Animated.spring(savedReveal, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 9 }).start();
      savedTimer.current = setTimeout(() => setShowSavedToast(false), 1700);
    }
    try {
      await setLessonFavorite(route.params.lessonId, nextSaved);
    } catch {
      setSaved(!nextSaved);
      setShowSavedToast(false);
    } finally {
      saveLocked.current = false;
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <ScreenHeader
        title={isCheck ? 'Verificarea rezolvării' : 'Rezolvarea pas cu pas'}
        eyebrow={`PASUL ${step + 1} DIN ${lesson.steps.length}`}
        onBack={back}
        rightIcon="bookmark"
        rightLabel={saved ? 'Scoate din Caiet' : 'Salvează în Caiet'}
        rightActive={saved}
        onRight={toggleSaved}
      />
      {showSavedToast ? (
        <Animated.View pointerEvents="none" style={[styles.savedToast, {
          opacity: savedReveal,
          transform: [
            { translateY: savedReveal.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
            { scale: savedReveal.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
          ],
        }]}>
          <MiniGlyph name="check" size={16} />
          <Text style={styles.savedText}>Lecție salvată</Text>
        </Animated.View>
      ) : null}
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: lesson.steps.length, now: step + 1, text: `Pasul ${step + 1} din ${lesson.steps.length}` }}
        style={[styles.progress, { marginHorizontal: gutter }]}
      >
        {lesson.steps.map((lessonStep, index) => (
          <View
            key={`${lessonStep.title}-${index}`}
            style={[
              styles.progressPart,
              index < step && styles.progressPartDone,
              index === step && styles.progressPartCurrent,
            ]}
          />
        ))}
      </View>

      <View style={[styles.stage, { paddingHorizontal: gutter }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Deschide enunțul: ${problemAccessible}`}
          onPress={toggleProblem}
          style={({ pressed }) => [styles.problemRow, pressed && styles.pressed]}
        >
          <View style={styles.problemIcon}><Text style={styles.problemIconText}>x²</Text></View>
          <View style={styles.problemCopy}>
            <Text style={styles.problemLabel}>PROBLEMA CURENTĂ</Text>
            <Text numberOfLines={2} style={styles.problem}>{lesson.title}</Text>
          </View>
          <Text style={styles.problemAction}>Enunț</Text>
          <MiniGlyph name="next" size={15} color={colors.violetDeep} />
        </Pressable>

        <View style={styles.documentFrame}>
          <MathDocumentView definition={lessonDocument}
            testID="lesson-math-document"
            onReady={() => markLessonPresentationReady(route.params.lessonId)}
          />
        </View>
      </View>

      <View style={[styles.actionDock, { paddingHorizontal: gutter, paddingBottom: bottomSpace }]}>
        <View style={styles.secondaryRow}>
          <Pressable accessibilityRole="button" onPress={explainDifferently} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
            <AppIcon name="hint" size={23} />
            <View style={styles.secondaryCopy}>
              <Text style={styles.secondaryTitle}>Explică-mi altfel</Text>
            </View>
            <MiniGlyph name="next" size={15} color={colors.violetDeep} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Raportează o problemă în explicație" onPress={() => setFeedbackOpen(true)} style={({ pressed }) => [styles.reportAction, pressed && styles.pressed]}>
            <MiniGlyph name="wrong" size={16} color={colors.inkSoft} />
            <Text numberOfLines={1} style={styles.reportText}>Semnalează</Text>
          </Pressable>
        </View>
        <ComicButton compact title={nextTitle} trailingIcon={step === lesson.steps.length - 1 ? 'check' : 'next'} tone="lime" onPress={next} />
      </View>

      {alternate ? (
        <View style={styles.modalLayer}>
          <Animated.View pointerEvents="none" style={[styles.scrim, { opacity: alternateReveal }]} />
          <Pressable accessible={false} onPress={closeAlternate} style={StyleSheet.absoluteFill} />
          <Animated.View accessibilityViewIsModal style={[styles.sheet, {
            paddingBottom: bottomSpace + 14,
            opacity: alternateReveal,
            transform: [{ translateY: alternateReveal.interpolate({ inputRange: [0, 1], outputRange: [54, 0] }) }],
          }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeading}>
              <View style={styles.sheetIcon}><AppIcon name="hint" size={37} /></View>
              <View style={styles.sheetCopy}><Text style={styles.sheetEyebrow}>PROFU’ ÎȚI ARATĂ ALTFEL</Text><Text style={styles.sheetTitle}>O explicație mai simplă</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Închide explicația" hitSlop={8} onPress={closeAlternate} style={styles.sheetClose}><MiniGlyph name="close" size={19} /></Pressable>
            </View>
            <MathDocumentView definition={alternateDocument} style={styles.sheetDocument} testID="alternate-math-document" />
            <ComicButton compact title="Am înțeles" trailingIcon="check" tone="lime" onPress={closeAlternate} />
          </Animated.View>
        </View>
      ) : null}

      {problemOpen ? (
        <View style={styles.modalLayer}>
          <Animated.View pointerEvents="none" style={[styles.scrim, { opacity: problemReveal }]} />
          <Pressable accessible={false} onPress={closeProblem} style={StyleSheet.absoluteFill} />
          <Animated.View accessibilityViewIsModal style={[styles.problemSheet, {
            paddingBottom: bottomSpace + 14,
            opacity: problemReveal,
            transform: [{ translateY: problemReveal.interpolate({ inputRange: [0, 1], outputRange: [54, 0] }) }],
          }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeading}>
              <View style={[styles.sheetIcon, styles.problemSheetIcon]}><AppIcon name="notebook" size={37} /></View>
              <View style={styles.sheetCopy}><Text style={styles.sheetEyebrow}>PROBLEMA TA</Text><Text numberOfLines={2} style={styles.sheetTitle}>{lesson.title}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Închide enunțul" hitSlop={8} onPress={closeProblem} style={styles.sheetClose}><MiniGlyph name="close" size={19} /></Pressable>
            </View>
            {sourceImage ? (
              <View accessibilityRole="tablist" style={styles.problemTabs}>
                <Pressable accessibilityRole="tab" accessibilityState={{ selected: problemView === 'statement' }} onPress={() => setProblemView('statement')} style={[styles.problemTab, problemView === 'statement' && styles.problemTabActive]}><Text style={[styles.problemTabText, problemView === 'statement' && styles.problemTabTextActive]}>Enunț citit</Text></Pressable>
                <Pressable accessibilityRole="tab" accessibilityState={{ selected: problemView === 'photo' }} onPress={() => setProblemView('photo')} style={[styles.problemTab, problemView === 'photo' && styles.problemTabActive]}><Text style={[styles.problemTabText, problemView === 'photo' && styles.problemTabTextActive]}>Fotografia ta</Text></Pressable>
              </View>
            ) : null}
            <View style={styles.problemContent}>
              {problemView === 'photo' && sourceImage ? (
                <View accessible accessibilityRole="image" accessibilityLabel="Fotografia originală a problemei" style={styles.sourceImageCard}>
                  <Image accessible={false} source={{ uri: sourceImage.uri }} resizeMode="contain" style={styles.sourceImage} />
                </View>
              ) : (
                <MathDocumentView definition={problemDocument} testID="problem-math-document" />
              )}
            </View>
          </Animated.View>
        </View>
      ) : null}
      <FeedbackSheet visible={feedbackOpen} lessonId={route.params.lessonId} onClose={() => setFeedbackOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  progress: { height: 7, flexDirection: 'row', gap: 4, marginBottom: 8 },
  progressPart: { flex: 1, height: '100%', borderRadius: 5, backgroundColor: colors.line },
  progressPartDone: { backgroundColor: colors.violetSoft },
  progressPartCurrent: { backgroundColor: colors.violet },
  savedToast: { position: 'absolute', zIndex: 20, right: 18, top: 59, minHeight: 34, borderRadius: 12, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9 },
  savedText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12 },
  stage: { flex: 1, minHeight: 0, paddingBottom: 4 },
  problemRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7, borderRadius: 18, backgroundColor: '#F1E9FF', paddingHorizontal: 9, paddingVertical: 6 },
  problemIcon: { width: 31, height: 31, borderRadius: 10, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  problemIconText: { fontFamily: fonts.display, color: colors.violetDeep, fontSize: 15 },
  problemCopy: { flex: 1, minWidth: 0 },
  problemLabel: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7, letterSpacing: 1.05 },
  problem: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11.5, lineHeight: 14.5 },
  problemAction: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 10 },
  documentFrame: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: 'transparent' },
  actionDock: { backgroundColor: colors.canvas, paddingTop: 8 },
  secondaryRow: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  secondaryAction: { flex: 1, minWidth: 0, height: 42, borderRadius: 14, backgroundColor: colors.violetSoft, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 9 },
  secondaryCopy: { flex: 1, minWidth: 0 },
  secondaryTitle: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11 },
  reportAction: { minWidth: 96, height: 42, borderRadius: 14, backgroundColor: '#EFE9F4', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 8 },
  reportText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 9.5 },
  pressed: { opacity: 0.62, transform: [{ translateY: 1 }] },
  modalLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 30, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(23,19,55,0.46)' },
  sheet: { width: '100%', maxWidth: 640, height: '82%', alignSelf: 'center', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 3, borderBottomWidth: 0, borderColor: colors.ink, backgroundColor: colors.paper, paddingHorizontal: 16, paddingTop: 9 },
  problemSheet: { width: '100%', maxWidth: 640, height: '86%', alignSelf: 'center', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 3, borderBottomWidth: 0, borderColor: colors.ink, backgroundColor: colors.paper, paddingHorizontal: 16, paddingTop: 9 },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 10 },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 8 },
  sheetIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.cyan, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  problemSheetIcon: { backgroundColor: colors.violetSoft },
  sheetCopy: { flex: 1, minWidth: 0 },
  sheetEyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7.5, letterSpacing: 1.1 },
  sheetTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 17, lineHeight: 20 },
  sheetClose: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center' },
  sheetDocument: { marginBottom: 8 },
  problemTabs: { flexDirection: 'row', borderRadius: 14, backgroundColor: colors.violetSoft, padding: 3, marginBottom: 9 },
  problemTab: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  problemTabActive: { borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.paper },
  problemTabText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 11.5 },
  problemTabTextActive: { color: colors.violetDeep },
  problemContent: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: colors.paper },
  sourceImageCard: { flex: 1, padding: 8, backgroundColor: '#F4EEFF' },
  sourceImage: { width: '100%', height: '100%', borderRadius: 12 },
});
