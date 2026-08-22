import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { ComicButton } from '../components/ComicButton';
import { MiniGlyph } from '../components/MiniGlyph';
import { RichMathContent } from '../components/RichMathContent';
import { ScreenHeader } from '../components/ScreenHeader';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { setLessonFavorite } from '../services/lessons';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../types';
import { contentToAccessibleText, firstMathBlock, firstTextBlock } from '../utils/mathContent';

type Props = NativeStackScreenProps<RootStackParamList, 'Lesson'>;

export function LessonScreen({ navigation, route }: Props) {
  const { gutter, isNarrow, isCompact } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [alternate, setAlternate] = useState(false);
  const [problemOpen, setProblemOpen] = useState(false);
  const [saved, setSaved] = useState(route.params.isFavorite ?? false);
  const [showSavedToast, setShowSavedToast] = useState(false);
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
  const steps = lesson.steps;
  const current = steps[step];
  const tone = [colors.cyan, colors.peach, colors.lime, colors.mint, colors.violetSoft, colors.cyan][step % 6];
  const problemMath = firstMathBlock(lesson.problem);
  const problemText = firstTextBlock(lesson.problem);
  const problemAccessible = contentToAccessibleText(lesson.problem);
  const nextTitle = step === steps.length - 1
    ? 'Rezultat'
    : 'Continuă';
  const bottomSpace = Math.max(insets.bottom, 10);

  useEffect(() => {
    setAlternate(false);
    alternateReveal.setValue(0);
    reveal.setValue(0);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    Animated.spring(reveal, { toValue: 1, useNativeDriver: true, speed: 9, bounciness: 6 }).start();
  }, [alternateReveal, reveal, step]);

  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  const next = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < steps.length - 1) setStep((value) => value + 1);
    else navigation.replace('Summary', { lesson, lessonId: route.params.lessonId, isFavorite: saved });
  };

  const explainDifferently = () => {
    Haptics.selectionAsync();
    if (alternate) {
      Animated.timing(alternateReveal, { toValue: 0, duration: 130, useNativeDriver: true }).start(() => setAlternate(false));
      return;
    }
    setAlternate(true);
    Animated.spring(alternateReveal, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
  };

  const toggleProblem = () => {
    Haptics.selectionAsync();
    if (problemOpen) {
      Animated.timing(problemReveal, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => setProblemOpen(false));
      return;
    }
    setProblemOpen(true);
    problemReveal.setValue(0);
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
    Animated.spring(savedReveal, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 9 }).start();
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
      <ScreenHeader title={isCheck ? 'Feedback pe rezolvare' : 'Lecția ta'} eyebrow={`PASUL ${step + 1} DIN ${steps.length}`} onBack={() => isFromNotebook ? navigation.goBack() : navigation.popToTop()} rightIcon="bookmark" rightLabel={saved ? 'Elimină din caiet' : 'Salvează în caiet'} rightActive={saved} onRight={toggleSaved} />
      {showSavedToast ? <Animated.View pointerEvents="none" style={[styles.savedToast, { opacity: savedReveal, transform: [{ translateY: savedReveal.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }, { scale: savedReveal.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}><MiniGlyph name="check" size={16} /><Text style={styles.savedText}>Salvat în caiet</Text></Animated.View> : null}
      <View style={[styles.progress, { paddingHorizontal: gutter }]}>
        {steps.map((_, index) => <View key={index} style={styles.progressPart}>{index <= step ? <Animated.View style={[styles.progressPartActive, index === step && { opacity: reveal, transform: [{ scaleX: reveal }] }]} /> : null}</View>)}
      </View>
      <ScrollView ref={scrollRef} style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Deschide enunțul: ${problemAccessible}`} onPress={toggleProblem} style={styles.problemRow}>
          <View style={styles.problemIcon}><Text style={styles.problemIconText}>x</Text></View>
          <View style={styles.problemCopy}>
            <Text style={styles.problemLabel}>{lesson.topic.toLocaleUpperCase('ro-RO')}</Text>
            {problemMath ? (
              <RichMathContent content={[problemMath]} color={colors.ink} textStyle={styles.problem} mathFontSize={13} mathMinHeight={22} mathAlign="left" gap={0} />
            ) : <Text numberOfLines={2} style={styles.problem}>{problemText}</Text>}
          </View>
          <View style={styles.problemOpen}><MiniGlyph name="next" size={16} color={colors.violetDeep} /></View>
        </Pressable>

        <Animated.View style={[styles.panelWrap, { opacity: reveal, transform: [{ translateX: reveal.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }, { rotate: '-0.5deg' }] }]}>
          <View style={styles.panelShadow} />
          <View style={[styles.panel, isCompact && styles.panelCompact]}>
            <View style={[styles.kicker, { backgroundColor: tone }]}><Text style={styles.kickerText}>{current.kicker}</Text></View>
            <Text style={[styles.title, isNarrow && styles.titleNarrow]}>{current.title}</Text>
            <RichMathContent
              content={current.explanation}
              color={colors.ink}
              textStyle={styles.body}
              mathFontSize={isNarrow ? 17 : 19}
              mathMinHeight={32}
              mathBlockStyle={[styles.mathBox, { borderBottomColor: tone }]}
              containerStyle={styles.stepContent}
              gap={8}
            />
            <View style={styles.noteRow}>
              <Image source={require('../../assets/profu-mascot-v2.png')} resizeMode="contain" style={[styles.miniMascot, isNarrow && styles.miniMascotNarrow]} />
              <View style={styles.noteBubble}>
                <RichMathContent content={current.note} color={colors.ink} textStyle={styles.note} mathFontSize={14} mathMinHeight={23} mathAlign="left" gap={4} />
              </View>
            </View>
          </View>
        </Animated.View>

      </ScrollView>
      <View style={[styles.actionDock, { paddingHorizontal: gutter, paddingBottom: bottomSpace }]}>
        {step > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Pasul anterior" onPress={() => setStep((value) => value - 1)} style={styles.previousAction}>
            <MiniGlyph name="back" size={22} color={colors.ink} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Explică-mi altfel"
          accessibilityState={{ expanded: alternate }}
          onPress={explainDifferently}
          style={styles.alternateAction}
        >
          <AppIcon name="explain" size={32} />
          <Text style={styles.alternateActionText}>Altfel</Text>
        </Pressable>
        <ComicButton compact title={nextTitle} icon={step === steps.length - 1 ? 'trophy' : 'verify'} tone="lime" onPress={next} style={styles.nextAction} />
      </View>
      {alternate ? (
        <View style={styles.alternateLayer}>
          <Pressable accessibilityRole="button" accessibilityLabel="Închide explicația" onPress={explainDifferently} style={styles.scrim} />
          <Animated.View style={[styles.alternateSheet, { paddingBottom: bottomSpace + 14, opacity: alternateReveal, transform: [{ translateY: alternateReveal.interpolate({ inputRange: [0, 1], outputRange: [42, 0] }) }] }]}>
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
          <Pressable accessibilityRole="button" accessibilityLabel="Închide enunțul" onPress={toggleProblem} style={styles.scrim} />
          <Animated.View style={[styles.problemSheet, { paddingBottom: bottomSpace + 14, opacity: problemReveal, transform: [{ translateY: problemReveal.interpolate({ inputRange: [0, 1], outputRange: [42, 0] }) }] }]}>
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
                mathBlockStyle={styles.problemSheetMath}
                gap={9}
              />
            </ScrollView>
          </Animated.View>
        </View>
      ) : null}
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
  panelWrap: { marginTop: 8, marginBottom: 16, position: 'relative' },
  panelShadow: { position: 'absolute', left: 8, right: -8, top: 9, bottom: -9, borderRadius: 28, backgroundColor: colors.ink },
  panel: { borderRadius: 28, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper, padding: 17, overflow: 'hidden' },
  panelCompact: { borderRadius: 24, padding: 15 },
  kicker: { alignSelf: 'flex-start', borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 10, paddingVertical: 5, transform: [{ rotate: '-3deg' }] },
  kickerText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9, letterSpacing: 1.2 },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 27, lineHeight: 30, marginTop: 12 },
  titleNarrow: { fontSize: 24, lineHeight: 27 },
  body: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  stepContent: { marginTop: 5 },
  mathBox: { minHeight: 52, backgroundColor: '#F7F3FF', borderRadius: 15, borderWidth: 2, borderColor: colors.ink, borderBottomWidth: 6, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  noteRow: { minHeight: 76, marginTop: 11, flexDirection: 'row', alignItems: 'center' },
  miniMascot: { width: 68, height: 70, marginLeft: -5, zIndex: 2 },
  miniMascotNarrow: { width: 58, height: 62 },
  noteBubble: { flex: 1, minHeight: 54, borderRadius: 16, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.limeSoft, paddingHorizontal: 11, paddingVertical: 7, marginLeft: -3, justifyContent: 'center' },
  note: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11.5, lineHeight: 15 },
  actionDock: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: colors.canvas, borderTopWidth: 1.5, borderTopColor: colors.line, paddingTop: 10 },
  previousAction: { width: 57, height: 57, borderRadius: 18, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  alternateAction: { width: 58, height: 57, borderRadius: 18, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#F4EEFF', alignItems: 'center', justifyContent: 'center' },
  alternateActionText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8.5, marginTop: -3 },
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
