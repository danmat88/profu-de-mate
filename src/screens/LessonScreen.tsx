import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { ComicButton } from '../components/ComicButton';
import { FeedbackSheet } from '../components/FeedbackSheet';
import { MathFormula } from '../components/MathFormula';
import { MiniGlyph } from '../components/MiniGlyph';
import { RichMathContent } from '../components/RichMathContent';
import { ScreenHeader } from '../components/ScreenHeader';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { setLessonFavorite } from '../services/lessons';
import { colors, fonts } from '../theme';
import type { LessonStep, RichContent, RootStackParamList } from '../types';
import { contentToAccessibleText, firstTextBlock, representativeMathBlock } from '../utils/mathContent';

type Props = NativeStackScreenProps<RootStackParamList, 'Lesson'>;

type LessonPage = {
  step: LessonStep;
  explanation: RichContent;
  part: number;
  partCount: number;
  showNote: boolean;
};

function contentWeight(content: RichContent) {
  return content.reduce((total, block) => total + (block.type === 'text'
    ? 1 + Math.min(block.text.length / 180, 0.7)
    : 1.25 + Math.min(block.rendered.heightEx / 4, 1.4)), 0);
}

function splitExplanation(content: RichContent, capacity: number): RichContent[] {
  // Eight blocks still fit comfortably on the compact lesson canvas. Longer
  // explanations are split at semantic boundaries even when their text is
  // unusually terse, so the bottom action never covers the last formula.
  if (content.length <= 8 && contentWeight(content) <= capacity) return [content];

  const groups: RichContent[] = [];
  let group: RichContent = [];
  content.forEach((block, index) => {
    group.push(block);
    if (block.type !== 'math') return;

    const next = content[index + 1];
    const following = content[index + 2];
    const atomicMath = /^(?:[A-Za-z]|\\[A-Za-z]+)(?:_(?:[A-Za-z0-9]|\{[A-Za-z0-9]+\}))?$/.test(block.latex.trim());
    const shortConnector = next?.type === 'text'
      && /^(?:și|sau|ori|respectiv)$/.test(next.text.trim().toLocaleLowerCase('ro-RO'))
      && following?.type === 'math';
    if ((atomicMath && next?.type === 'text') || shortConnector) return;

    groups.push(group);
    group = [];
  });
  if (group.length > 0) groups.push(group);

  const chunks: RichContent[] = [];
  let current: RichContent = [];
  for (const semanticGroup of groups) {
    if (current.length > 0 && contentWeight([...current, ...semanticGroup]) > capacity) {
      chunks.push(current);
      current = [...semanticGroup];
    } else {
      current.push(...semanticGroup);
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function LessonScreen({ navigation, route }: Props) {
  const { width, gutter, isNarrow, isShort, isCompact } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [alternate, setAlternate] = useState(false);
  const [problemOpen, setProblemOpen] = useState(false);
  const [saved, setSaved] = useState(route.params.isFavorite ?? false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const reveal = useRef(new Animated.Value(0)).current;
  const alternateReveal = useRef(new Animated.Value(0)).current;
  const problemReveal = useRef(new Animated.Value(0)).current;
  const savedReveal = useRef(new Animated.Value(0)).current;
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const lesson = route.params.lesson;
  const sourceImage = route.params.sourceImage;
  const sourceAspectRatio = sourceImage
    ? Math.max(0.68, Math.min(1.65, sourceImage.width / sourceImage.height))
    : 1;
  const isCheck = lesson.mode === 'check';
  const isFromNotebook = route.params.source === 'notebook';
  const pages = useMemo<LessonPage[]>(() => lesson.steps.flatMap((lessonStep) => {
    const chunks = splitExplanation(lessonStep.explanation, isShort ? 13.3 : 15.5);
    return chunks.map((explanation, part) => ({
      step: lessonStep,
      explanation,
      part,
      partCount: chunks.length,
      showNote: part === chunks.length - 1,
    }));
  }), [isShort, lesson.steps]);
  const currentPage = pages[step];
  const current = currentPage.step;
  const tone = [colors.cyan, colors.peach, colors.lime, colors.mint, colors.violetSoft, colors.cyan][step % 6];
  const problemMath = representativeMathBlock(lesson.problem);
  const problemText = firstTextBlock(lesson.problem);
  const problemAccessible = contentToAccessibleText(lesson.problem);
  const nextTitle = step === pages.length - 1
    ? 'Vezi rezultatul'
    : 'Continuă';
  const bottomSpace = Math.max(insets.bottom, 10);
  const problemPreviewWidth = Math.max(110, width - gutter * 2 - 97);
  const lessonMathWidth = Math.max(120, width - gutter * 2 - (isCompact ? 65 : 69));
  const noteMathWidth = Math.max(100, width - gutter * 2 - 101);
  const sheetMathWidth = Math.max(120, width - 62);

  useEffect(() => {
    setAlternate(false);
    alternateReveal.setValue(0);
    reveal.setValue(0);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (reducedMotion) {
      reveal.setValue(1);
      return;
    }
    Animated.spring(reveal, { toValue: 1, useNativeDriver: true, speed: 9, bounciness: 6 }).start();
  }, [alternateReveal, reducedMotion, reveal, step]);

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  const next = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < pages.length - 1) setStep((value) => value + 1);
    else navigation.replace('Summary', { lesson, lessonId: route.params.lessonId, isFavorite: saved });
  };

  const back = () => {
    Haptics.selectionAsync();
    if (step > 0) {
      setStep((value) => value - 1);
      return;
    }
    if (isFromNotebook) navigation.goBack();
    else navigation.popToTop();
  };

  const explainDifferently = () => {
    Haptics.selectionAsync();
    if (alternate) {
      if (reducedMotion) {
        setAlternate(false);
        return;
      }
      Animated.timing(alternateReveal, { toValue: 0, duration: 130, useNativeDriver: true }).start(() => setAlternate(false));
      return;
    }
    setAlternate(true);
    if (reducedMotion) {
      alternateReveal.setValue(1);
      return;
    }
    Animated.spring(alternateReveal, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
  };

  const toggleProblem = () => {
    Haptics.selectionAsync();
    if (problemOpen) {
      if (reducedMotion) {
        setProblemOpen(false);
        return;
      }
      Animated.timing(problemReveal, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => setProblemOpen(false));
      return;
    }
    setProblemOpen(true);
    problemReveal.setValue(0);
    if (reducedMotion) {
      problemReveal.setValue(1);
      return;
    }
    Animated.spring(problemReveal, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 7 }).start();
  };

  const toggleSaved = async () => {
    const nextSaved = !saved;
    setSaved(nextSaved);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    if (!nextSaved) {
      setShowSavedToast(false);
      try {
        await setLessonFavorite(route.params.lessonId, false);
      } catch {
        setSaved(true);
      }
      return;
    }
    setShowSavedToast(true);
    savedReveal.setValue(0);
    if (reducedMotion) savedReveal.setValue(1);
    else Animated.spring(savedReveal, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 9 }).start();
    savedTimer.current = setTimeout(() => setShowSavedToast(false), 1700);
    try {
      await setLessonFavorite(route.params.lessonId, true);
    } catch {
      setSaved(false);
      setShowSavedToast(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <ScreenHeader title={isCheck ? 'Feedback pe rezolvare' : 'Lecția ta'} eyebrow={`AI · PASUL ${step + 1} DIN ${pages.length}`} onBack={back} rightIcon="bookmark" rightLabel={saved ? 'Elimină din caiet' : 'Salvează în caiet'} rightActive={saved} onRight={toggleSaved} />
      {showSavedToast ? <Animated.View pointerEvents="none" style={[styles.savedToast, { opacity: savedReveal, transform: [{ translateY: savedReveal.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }, { scale: savedReveal.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}><MiniGlyph name="check" size={16} /><Text style={styles.savedText}>Salvat în caiet</Text></Animated.View> : null}
      <View style={[styles.progress, { paddingHorizontal: gutter }]}>
        {pages.map((_, index) => <View key={index} style={styles.progressPart}>{index <= step ? <Animated.View style={[styles.progressPartActive, index === step && { opacity: reveal, transform: [{ scaleX: reveal }] }]} /> : null}</View>)}
      </View>
      <ScrollView ref={scrollRef} style={styles.scroll} bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Deschide enunțul: ${problemAccessible}`} onPress={toggleProblem} style={styles.problemRow}>
          <View style={styles.problemIcon}><Text style={styles.problemIconText}>x</Text></View>
          <View style={styles.problemCopy}>
            <Text style={styles.problemLabel}>{lesson.topic.toLocaleUpperCase('ro-RO')}</Text>
            {problemMath ? (
              <MathFormula math={problemMath} color={colors.ink} fontSize={15} minHeight={25} containerWidth={problemPreviewWidth} align="left" style={styles.problemFormula} />
            ) : <Text numberOfLines={2} style={styles.problem}>{problemText}</Text>}
          </View>
          <View style={styles.problemOpen}><MiniGlyph name="next" size={16} color={colors.violetDeep} /></View>
        </Pressable>

        <Animated.View style={[styles.panelWrap, { opacity: reveal, transform: [{ translateX: reveal.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }, { rotate: '-0.5deg' }] }]}>
          <View style={styles.panelShadow} />
          <View style={[styles.panel, isCompact && styles.panelCompact]}>
            <View style={[styles.kicker, { backgroundColor: tone }]}><Text style={styles.kickerText}>{current.kicker}{currentPage.partCount > 1 ? ` · ${currentPage.part + 1}/${currentPage.partCount}` : ''}</Text></View>
            <Text style={[styles.title, isNarrow && styles.titleNarrow, isShort && styles.titleShort]}>{current.title}</Text>
            <RichMathContent
              content={currentPage.explanation}
              color={colors.ink}
              textStyle={[styles.body, isShort && styles.bodyShort]}
              mathFontSize={isShort ? 18 : isNarrow ? 19 : 21}
              inlineMathFontSize={isShort ? 12.5 : 14}
              mathMinHeight={isShort ? 31 : 36}
              mathContainerWidth={lessonMathWidth}
              mathBlockStyle={[styles.mathBox, isShort && styles.mathBoxShort, { borderLeftColor: tone }]}
              containerStyle={[styles.stepContent, isShort && styles.stepContentShort]}
              gap={isShort ? 4 : 7}
            />
            {currentPage.showNote ? (
              <View style={[styles.noteRow, isShort && styles.noteRowShort]}>
                <View style={styles.noteMark}>
                  <Image accessible={false} source={require('../../assets/brand/profu-mark-v2.png')} resizeMode="contain" style={styles.noteMarkImage} />
                </View>
                <View style={styles.noteCopy}>
                  <Text style={styles.noteLabel}>DE ȚINUT MINTE</Text>
                  <RichMathContent content={current.note} color={colors.ink} textStyle={[styles.note, isShort && styles.noteShort]} mathFontSize={isShort ? 14 : 15} inlineMathFontSize={isShort ? 11.5 : 13} mathMinHeight={isShort ? 21 : 24} mathContainerWidth={noteMathWidth} mathAlign="left" inlineCompactMath gap={isShort ? 1 : 3} />
                </View>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Explică-mi altfel"
              accessibilityState={{ expanded: alternate }}
              onPress={explainDifferently}
              style={styles.explainAction}
            >
              <View style={styles.explainIcon}><AppIcon name="hint" size={28} /></View>
              <View style={styles.explainCopy}>
                <Text style={styles.explainTitle}>Nu s-a legat încă?</Text>
                <Text style={styles.explainText}>Vezi aceeași idee explicată altfel</Text>
              </View>
              <MiniGlyph name="next" size={16} color={colors.violetDeep} />
            </Pressable>
          </View>
        </Animated.View>

        <Pressable accessibilityRole="button" onPress={() => setFeedbackOpen(true)} style={styles.reportLink}>
          <MiniGlyph name="wrong" size={14} color={colors.inkSoft} />
          <Text style={styles.reportText}>Ceva nu pare corect? Raportează răspunsul</Text>
        </Pressable>

      </ScrollView>
      <View style={[styles.actionDock, { paddingHorizontal: gutter, paddingBottom: bottomSpace }]}>
        <ComicButton compact title={nextTitle} trailingIcon={step === pages.length - 1 ? 'check' : 'next'} tone="lime" onPress={next} style={styles.nextAction} />
      </View>
      {alternate ? (
        <View style={styles.alternateLayer}>
          <Pressable accessible={false} onPress={explainDifferently} style={styles.scrim} />
          <Animated.View accessibilityViewIsModal style={[styles.alternateSheet, { paddingBottom: bottomSpace + 14, opacity: alternateReveal, transform: [{ translateY: alternateReveal.interpolate({ inputRange: [0, 1], outputRange: [42, 0] }) }] }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeading}>
              <View style={styles.alternateIcon}><AppIcon name="hint" size={42} /></View>
              <View style={styles.sheetCopy}><Text style={styles.sheetEyebrow}>ALTFEL, MAI VIZUAL</Text><Text style={styles.sheetTitle}>Hai s-o vedem mai simplu</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Închide explicația" onPress={explainDifferently} style={styles.sheetClose}><MiniGlyph name="close" size={19} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.alternateScroll} contentContainerStyle={styles.alternateScrollContent}>
              <RichMathContent
                content={current.alternative}
                color={colors.ink}
                textStyle={styles.alternateText}
                mathFontSize={18}
                mathContainerWidth={sheetMathWidth}
                inlineCompactMath
                mathBlockStyle={styles.alternateMath}
                gap={8}
              />
            </ScrollView>
            <ComicButton compact title="Acum e mai clar" trailingIcon="check" tone="lime" onPress={explainDifferently} />
          </Animated.View>
        </View>
      ) : null}
      {problemOpen ? (
        <View style={styles.alternateLayer}>
          <Pressable accessible={false} onPress={toggleProblem} style={styles.scrim} />
          <Animated.View accessibilityViewIsModal style={[styles.problemSheet, { paddingBottom: bottomSpace + 14, opacity: problemReveal, transform: [{ translateY: problemReveal.interpolate({ inputRange: [0, 1], outputRange: [42, 0] }) }] }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeading}>
              <View style={styles.alternateIcon}><AppIcon name="notebook" size={42} /></View>
              <View style={styles.sheetCopy}><Text style={styles.sheetEyebrow}>ENUNȚUL COMPLET</Text><Text style={styles.sheetTitle}>{lesson.title}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Închide enunțul" onPress={toggleProblem} style={styles.sheetClose}><MiniGlyph name="close" size={19} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.problemSheetScroll} contentContainerStyle={styles.problemSheetContent}>
              {sourceImage ? (
                <View
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel="Fotografia originală a problemei"
                  style={styles.sourceImageCard}
                >
                  <View style={styles.sourceImageBadge}><Text style={styles.sourceImageBadgeText}>FOTOGRAFIA TA</Text></View>
                  <Image
                    accessible={false}
                    source={{ uri: sourceImage.uri }}
                    resizeMode="contain"
                    style={[styles.sourceImage, { aspectRatio: sourceAspectRatio }]}
                  />
                </View>
              ) : null}
              <View style={styles.transcriptionHeading}>
                <View style={styles.transcriptionDot} />
                <Text style={styles.transcriptionLabel}>{sourceImage ? 'TRANSCRIERE CLARĂ' : 'ENUNȚ'}</Text>
              </View>
              <RichMathContent
                content={lesson.problem}
                color={colors.ink}
                textStyle={styles.problemSheetText}
                mathFontSize={19}
                mathContainerWidth={sheetMathWidth}
                mathBlockStyle={styles.problemSheetMath}
                gap={9}
              />
            </ScrollView>
          </Animated.View>
        </View>
      ) : null}
      <FeedbackSheet visible={feedbackOpen} lessonId={route.params.lessonId} onClose={() => setFeedbackOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flex: 1 },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginBottom: 9 },
  savedToast: { position: 'absolute', zIndex: 20, right: 18, top: 59, minHeight: 34, borderRadius: 12, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9 },
  savedText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 10 },
  progressPart: { flex: 1, height: 6, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' },
  progressPartActive: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 4, backgroundColor: colors.violet },
  content: { flexGrow: 1, paddingHorizontal: 19, paddingBottom: 0 },
  problemRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 3 },
  problemIcon: { width: 41, height: 41, borderRadius: 14, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] },
  problemIconText: { fontFamily: fonts.display, color: colors.violetDeep, fontSize: 23 },
  problemCopy: { flex: 1, minWidth: 0 },
  problemOpen: { width: 28, height: 28, borderRadius: 10, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center' },
  problemLabel: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.2 },
  problem: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11.5, lineHeight: 15 },
  problemFormula: { marginTop: 1 },
  panelWrap: { marginTop: 8, marginBottom: 16, position: 'relative' },
  panelShadow: { position: 'absolute', left: 8, right: -8, top: 9, bottom: -9, borderRadius: 28, backgroundColor: colors.ink },
  panel: { borderRadius: 28, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper, padding: 17, overflow: 'hidden' },
  panelCompact: { borderRadius: 24, padding: 15 },
  reportLink: { alignSelf: 'center', minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, marginBottom: 8 },
  reportText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 10.5 },
  kicker: { alignSelf: 'flex-start', borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 10, paddingVertical: 5, transform: [{ rotate: '-3deg' }] },
  kickerText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9, letterSpacing: 1.2 },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 27, lineHeight: 30, marginTop: 12 },
  titleNarrow: { fontSize: 24, lineHeight: 27 },
  titleShort: { fontSize: 22, lineHeight: 24, marginTop: 9 },
  body: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  bodyShort: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  stepContent: { marginTop: 5 },
  stepContentShort: { marginTop: 3 },
  mathBox: { minHeight: 48, backgroundColor: '#F7F4FF', borderRadius: 12, borderLeftWidth: 5, paddingHorizontal: 12, paddingVertical: 4, overflow: 'hidden' },
  mathBoxShort: { minHeight: 42, paddingVertical: 2 },
  noteRow: { minHeight: 62, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 15, borderWidth: 1.5, borderColor: '#BCD94B', backgroundColor: colors.limeSoft, paddingHorizontal: 9, paddingVertical: 7 },
  noteRowShort: { minHeight: 54, marginTop: 7, paddingVertical: 5 },
  noteMark: { width: 38, height: 38, borderRadius: 12, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  noteMarkImage: { width: 34, height: 34 },
  noteCopy: { flex: 1, minWidth: 0 },
  noteLabel: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7.5, letterSpacing: 1 },
  note: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11.5, lineHeight: 15 },
  noteShort: { fontSize: 10.5, lineHeight: 13.5 },
  explainAction: { minHeight: 49, marginTop: 10, borderRadius: 14, backgroundColor: '#F3EEFF', paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  explainIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  explainCopy: { flex: 1, minWidth: 0 },
  explainTitle: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 10.5, lineHeight: 13 },
  explainText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 9.5, lineHeight: 12 },
  actionDock: { backgroundColor: colors.canvas, borderTopWidth: 1.5, borderTopColor: colors.line, paddingTop: 10 },
  nextAction: { flex: 1, minWidth: 0 },
  alternateLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 30, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(23,19,55,0.42)' },
  alternateSheet: { maxHeight: '82%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 3, borderBottomWidth: 0, borderColor: colors.ink, backgroundColor: colors.paper, paddingHorizontal: 19, paddingTop: 9 },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 12 },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  alternateIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.cyan, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  sheetCopy: { flex: 1 },
  sheetEyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.2 },
  sheetTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 20, lineHeight: 23 },
  sheetClose: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center' },
  alternateScroll: { flexShrink: 1, marginTop: 14, marginBottom: 14 },
  alternateScrollContent: { paddingBottom: 2 },
  alternateText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 19 },
  alternateMath: { minHeight: 48, borderRadius: 15, backgroundColor: '#F7F3FF', borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 7, paddingVertical: 3 },
  problemSheet: { maxHeight: '84%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 3, borderBottomWidth: 0, borderColor: colors.ink, backgroundColor: colors.paper, paddingHorizontal: 19, paddingTop: 9 },
  problemSheetScroll: { flexShrink: 1, marginTop: 14 },
  problemSheetContent: { paddingBottom: 10 },
  sourceImageCard: { position: 'relative', borderRadius: 18, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#F4EEFF', padding: 8, overflow: 'hidden' },
  sourceImageBadge: { position: 'absolute', top: 8, left: 8, zIndex: 2, borderRadius: 8, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.lime, paddingHorizontal: 8, paddingVertical: 4 },
  sourceImageBadgeText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 7, letterSpacing: 0.9 },
  sourceImage: { width: '100%', minHeight: 150, maxHeight: 310, borderRadius: 11 },
  transcriptionHeading: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 13, marginBottom: 7 },
  transcriptionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.violet },
  transcriptionLabel: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.1 },
  problemSheetText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  problemSheetMath: { minHeight: 52, borderRadius: 15, backgroundColor: '#F7F3FF', borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 8, paddingVertical: 4 },
});
