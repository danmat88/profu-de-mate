import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { ComicButton } from '../components/ComicButton';
import { ConfettiBurst } from '../components/ConfettiBurst';
import { FeedbackSheet } from '../components/FeedbackSheet';
import { MathDocumentView } from '../components/MathDocumentView';
import { MiniGlyph } from '../components/MiniGlyph';
import { Text } from '../components/Typography';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { setLessonFavorite } from '../services/lessons';
import { hasSeenSaveCoach, markSaveCoachSeen } from '../services/localPreferences';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../types';
import { contentToAccessibleText } from '../utils/mathContent';
import type { MathDocumentDefinition, MathDocumentTone } from '../utils/mathDocument';

type Props = NativeStackScreenProps<RootStackParamList, 'Summary'>;
const takeawayTones: MathDocumentTone[] = ['cyan', 'peach', 'lime'];

export function SummaryScreen({ navigation, route }: Props) {
  const { gutter, isNarrow, isShort, isLargeText } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [saved, setSaved] = useState(route.params.isFavorite ?? false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [showSaveCoach, setShowSaveCoach] = useState(false);
  const pop = useRef(new Animated.Value(0.72)).current;
  const details = useRef(new Animated.Value(0)).current;
  const coachReveal = useRef(new Animated.Value(0)).current;
  const saveLocked = useRef(false);
  const lesson = route.params.lesson;
  const isCheck = lesson.mode === 'check';
  const isPositive = !isCheck || lesson.verdict === 'correct';
  const isPartial = lesson.verdict === 'partially_correct';
  const bottomSpace = Math.max(insets.bottom, 10);

  const verdictEyebrow = !isCheck
    ? 'REZOLVARE ÎNCHEIATĂ'
    : lesson.verdict === 'correct'
      ? 'REZOLVARE CORECTĂ'
      : isPartial
        ? 'EȘTI FOARTE APROAPE'
        : 'ȘTIM CE TREBUIE CORECTAT';
  const sticker = !isCheck ? 'GATA!' : lesson.verdict === 'correct' ? 'BRAVO!' : isPartial ? 'APROAPE!' : 'DE CORECTAT';

  const summaryDocument = useMemo<MathDocumentDefinition>(() => ({
    accessibilityLabel: [
      contentToAccessibleText(lesson.summary),
      contentToAccessibleText(lesson.finalAnswer),
      ...lesson.takeaways.map((item) => contentToAccessibleText(item.content)),
    ].join('. '),
    variant: 'summary',
    sections: [
      { kind: 'section_title', eyebrow: 'PE SCURT', title: 'Cum am ajuns la rezultat' },
      { kind: 'content', content: lesson.summary },
      {
        kind: 'answer',
        label: isCheck ? 'REZULTATUL CORECT' : 'RĂSPUNS FINAL',
        caption: isCheck ? 'Acesta este rezultatul de comparat cu rezolvarea ta.' : 'Acesta este rezultatul obținut după toți pașii.',
        content: lesson.finalAnswer,
      },
      { kind: 'section_title', eyebrow: 'DE PĂSTRAT', title: 'Ideile importante' },
      ...lesson.takeaways.map((item, index) => ({
        kind: 'takeaway' as const,
        index: index + 1,
        content: item.content,
        tone: takeawayTones[index % takeawayTones.length],
      })),
    ],
  }), [isCheck, lesson.finalAnswer, lesson.summary, lesson.takeaways]);

  useEffect(() => {
    Haptics.notificationAsync(isPositive
      ? Haptics.NotificationFeedbackType.Success
      : Haptics.NotificationFeedbackType.Warning);
    if (reducedMotion) {
      pop.setValue(1);
      details.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 8 }),
      Animated.sequence([
        Animated.delay(150),
        Animated.timing(details, { toValue: 1, duration: 360, useNativeDriver: true }),
      ]),
    ]).start();
  }, [details, isPositive, pop, reducedMotion]);

  useEffect(() => {
    if (saved || hasSeenSaveCoach()) return;
    const timer = setTimeout(() => {
      setShowSaveCoach(true);
      if (reducedMotion) coachReveal.setValue(1);
      else Animated.spring(coachReveal, { toValue: 1, useNativeDriver: true, speed: 17, bounciness: 9 }).start();
    }, 650);
    return () => clearTimeout(timer);
  }, [coachReveal, reducedMotion, saved]);

  const dismissSaveCoach = () => {
    markSaveCoachSeen();
    if (reducedMotion) {
      setShowSaveCoach(false);
      return;
    }
    Animated.timing(coachReveal, { toValue: 0, duration: 130, useNativeDriver: true })
      .start(() => setShowSaveCoach(false));
  };

  const toggleSaved = async () => {
    if (saveLocked.current) return;
    saveLocked.current = true;
    const nextSaved = !saved;
    setSaved(nextSaved);
    setSaveBusy(true);
    if (showSaveCoach) dismissSaveCoach();
    if (nextSaved) markSaveCoachSeen();
    try {
      await setLessonFavorite(route.params.lessonId, nextSaved);
      await Haptics.notificationAsync(nextSaved
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning);
    } catch {
      setSaved(!nextSaved);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      saveLocked.current = false;
      setSaveBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <View style={[styles.main, { paddingHorizontal: gutter }]}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.brand}>Profu’ de mate</Text>
            <Text style={styles.topEyebrow}>{isCheck ? 'VERIFICARE ÎNCHEIATĂ' : 'REZOLVARE ÎNCHEIATĂ'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Închide recapitularea" onPress={() => navigation.popToTop()} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <MiniGlyph name="close" size={24} />
          </Pressable>
        </View>

        <View style={[styles.hero, isShort && styles.heroShort]}>
          <Animated.View style={[styles.celebration, isNarrow && styles.celebrationNarrow, isShort && styles.celebrationShort, { transform: [{ scale: pop }] }]}>
            {isPositive ? <ConfettiBurst /> : null}
            <View style={[styles.burstOuter, !isPositive && styles.burstOuterReview, isShort && styles.burstOuterShort]} />
            <Image accessible={false} source={require('../../assets/profu-mascot-v2.png')} resizeMode="contain" style={[styles.mascot, isShort && styles.mascotShort]} />
            <View style={[styles.doneSticker, !isPositive && styles.doneStickerReview]}><Text style={styles.doneStickerText}>{sticker}</Text></View>
          </Animated.View>
          <Animated.View style={[styles.heroCopy, {
            opacity: details,
            transform: [{ translateX: details.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }]}>
            <Text style={styles.eyebrow}>{verdictEyebrow}</Text>
            <Text adjustsFontSizeToFit minimumFontScale={0.76} numberOfLines={3} style={[styles.title, isNarrow && styles.titleNarrow, isShort && styles.titleShort]}>{lesson.headline}</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.documentFrame, { opacity: details }]}>
          <MathDocumentView definition={summaryDocument} testID="summary-math-document" />
        </Animated.View>
        <Pressable accessibilityRole="button" onPress={() => setFeedbackOpen(true)} style={({ pressed }) => [styles.reportLink, pressed && styles.pressed]}>
          <MiniGlyph name="wrong" size={14} color={colors.inkSoft} />
          <Text style={styles.reportText}>Ai observat o greșeală? Spune-ne</Text>
        </Pressable>
      </View>

      <View style={[styles.actionDock, { paddingHorizontal: gutter, paddingBottom: bottomSpace }]}>
        <View style={[styles.secondaryActions, isLargeText && styles.secondaryActionsLargeText]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Scoate lecția din Caiet' : 'Salvează lecția în Caiet'}
            disabled={saveBusy}
            onPress={() => void toggleSaved()}
            style={({ pressed }) => [styles.saveAction, isLargeText && styles.secondaryActionLargeText, saved && styles.saveActionActive, (pressed || saveBusy) && styles.pressed]}
          >
            <AppIcon name="bookmark" size={28} />
            <Text numberOfLines={isLargeText ? 2 : 1} adjustsFontSizeToFit={!isLargeText} minimumFontScale={0.86} style={styles.secondaryText}>{saved ? 'Salvat în Caiet' : 'Salvează în Caiet'}</Text>
            <MiniGlyph name={saved ? 'check' : 'next'} size={16} color={colors.violetDeep} />
          </Pressable>
          <View style={styles.secondaryDivider} />
          <Pressable accessibilityRole="button" accessibilityLabel="Înapoi la început" onPress={() => navigation.popToTop()} style={({ pressed }) => [styles.homeAction, isLargeText && styles.secondaryActionLargeText, pressed && styles.pressed]}>
            <MiniGlyph name="back" size={17} color={colors.inkSoft} />
            <Text numberOfLines={isLargeText ? 2 : 1} style={styles.homeLinkText}>La început</Text>
          </Pressable>
        </View>
        <ComicButton compact title={isCheck ? 'Verifică altă rezolvare' : 'Rezolvă altă problemă'} icon={isCheck ? 'verify' : 'practice'} tone="violet" onPress={() => navigation.replace('Capture', { mode: lesson.mode })} />
      </View>

      {showSaveCoach && !saved ? (
        <Animated.View accessibilityLiveRegion="polite" style={[styles.saveCoach, {
          left: gutter,
          right: gutter,
          bottom: bottomSpace + (isLargeText ? 166 : 137),
          opacity: coachReveal,
          transform: [
            { translateY: coachReveal.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
            { scale: coachReveal.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
          ],
        }]}>
          <View style={styles.saveCoachPointer} />
          <View style={styles.saveCoachIcon}><AppIcon name="notebook" size={38} /></View>
          <View style={styles.saveCoachCopy}>
            <Text style={styles.saveCoachEyebrow}>MIC TRUC</Text>
            <Text style={styles.saveCoachTitle}>Păstrează lecția în Caiet</Text>
            <Text style={styles.saveCoachText}>O vei găsi acolo când vrei să repeți.</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Am înțeles" hitSlop={8} onPress={dismissSaveCoach} style={styles.saveCoachClose}><MiniGlyph name="close" size={17} color={colors.ink} /></Pressable>
        </Animated.View>
      ) : null}
      <FeedbackSheet visible={feedbackOpen} lessonId={route.params.lessonId} onClose={() => setFeedbackOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  main: { flex: 1, minHeight: 0 },
  topRow: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 18, lineHeight: 20 },
  topEyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7.5, letterSpacing: 1.2, marginTop: 1 },
  close: { width: 44, height: 44, borderRadius: 15, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  hero: { height: 128, flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroShort: { height: 104 },
  celebration: { width: 126, height: 126, alignItems: 'center', justifyContent: 'center' },
  celebrationNarrow: { width: 112 },
  celebrationShort: { width: 102, height: 102 },
  burstOuter: { position: 'absolute', width: 105, height: 105, borderRadius: 54, backgroundColor: colors.violet, borderWidth: 3, borderColor: colors.ink, transform: [{ rotate: '-5deg' }] },
  burstOuterReview: { backgroundColor: '#FFE2D8' },
  burstOuterShort: { width: 88, height: 88, borderRadius: 45 },
  mascot: { width: 116, height: 121, zIndex: 6 },
  mascotShort: { width: 96, height: 100 },
  doneSticker: { position: 'absolute', zIndex: 7, right: 1, bottom: 4, backgroundColor: colors.lime, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 7, paddingVertical: 3, transform: [{ rotate: '8deg' }] },
  doneStickerReview: { backgroundColor: colors.peach },
  doneStickerText: { fontFamily: fonts.display, color: colors.ink, fontSize: 10 },
  heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.15 },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 23, lineHeight: 25, marginTop: 3 },
  titleNarrow: { fontSize: 21, lineHeight: 23 },
  titleShort: { fontSize: 19, lineHeight: 21 },
  documentFrame: { flex: 1, minHeight: 0, overflow: 'hidden', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  reportLink: { alignSelf: 'center', height: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10 },
  reportText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 10.5 },
  actionDock: { backgroundColor: colors.canvas, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 5, gap: 2 },
  secondaryActions: { height: 44, flexDirection: 'row', alignItems: 'center' },
  secondaryActionsLargeText: { height: 60 },
  saveAction: { flex: 1.35, minWidth: 0, height: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 7 },
  saveActionActive: { borderColor: '#BCD94B', backgroundColor: colors.limeSoft },
  homeAction: { flex: 0.85, minWidth: 0, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 7 },
  secondaryActionLargeText: { height: 56 },
  secondaryDivider: { width: 1.5, height: 23, backgroundColor: colors.line, marginHorizontal: 5 },
  secondaryText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12 },
  homeLinkText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 12 },
  pressed: { opacity: 0.62, transform: [{ translateY: 1 }] },
  saveCoach: { position: 'absolute', zIndex: 25, minHeight: 79, borderRadius: 20, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, paddingVertical: 9, shadowColor: colors.ink, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
  saveCoachPointer: { position: 'absolute', left: '22%', bottom: -8, width: 16, height: 16, borderRightWidth: 2.5, borderBottomWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.lime, transform: [{ rotate: '45deg' }] },
  saveCoachIcon: { width: 50, height: 50, borderRadius: 16, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  saveCoachCopy: { flex: 1, minWidth: 0 },
  saveCoachEyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7.5, letterSpacing: 1.2 },
  saveCoachTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 15, lineHeight: 18 },
  saveCoachText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12, lineHeight: 16 },
  saveCoachClose: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
});
