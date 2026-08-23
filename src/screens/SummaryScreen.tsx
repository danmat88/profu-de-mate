import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { ComicButton } from '../components/ComicButton';
import { ConfettiBurst } from '../components/ConfettiBurst';
import { FeedbackSheet } from '../components/FeedbackSheet';
import { MiniGlyph } from '../components/MiniGlyph';
import { RichMathContent } from '../components/RichMathContent';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { setLessonFavorite } from '../services/lessons';
import { hasSeenSaveCoach, markSaveCoachSeen } from '../services/localPreferences';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../types';
import { contentToAccessibleText } from '../utils/mathContent';

type Props = NativeStackScreenProps<RootStackParamList, 'Summary'>;

export function SummaryScreen({ navigation, route }: Props) {
  const { contentWidth, gutter, isNarrow, isShort } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [saved, setSaved] = useState(route.params.isFavorite ?? false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [showSaveCoach, setShowSaveCoach] = useState(false);
  const pop = useRef(new Animated.Value(0.72)).current;
  const details = useRef(new Animated.Value(0)).current;
  const coachReveal = useRef(new Animated.Value(0)).current;
  const lesson = route.params.lesson;
  const isCheck = lesson.mode === 'check';
  const isPositive = !isCheck || lesson.verdict === 'correct';
  const isPartial = lesson.verdict === 'partially_correct';
  const takeaways = lesson.takeaways;
  const bottomSpace = Math.max(insets.bottom, 10);
  const summaryMathWidth = Math.max(120, contentWidth - 32);
  const answerMathWidth = Math.max(120, contentWidth - 54);
  const takeawayMathWidth = Math.max(100, contentWidth - 63);

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
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 10 }),
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(details, { toValue: 1, duration: 420, useNativeDriver: true }),
      ]),
    ]).start();
  }, [details, isPositive, pop, reducedMotion]);

  useEffect(() => {
    if (saved || hasSeenSaveCoach()) return;
    const timer = setTimeout(() => {
      setShowSaveCoach(true);
      if (reducedMotion) {
        coachReveal.setValue(1);
        return;
      }
      Animated.spring(coachReveal, { toValue: 1, useNativeDriver: true, speed: 17, bounciness: 9 }).start();
    }, 650);
    return () => clearTimeout(timer);
  }, [coachReveal, reducedMotion, saved]);

  const dismissSaveCoach = () => {
    markSaveCoachSeen();
    if (reducedMotion) {
      setShowSaveCoach(false);
      return;
    }
    Animated.timing(coachReveal, { toValue: 0, duration: 130, useNativeDriver: true }).start(() => setShowSaveCoach(false));
  };

  const toggleSaved = async () => {
    if (saveBusy) return;
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
      setSaveBusy(false);
    }
  };

  const verdictEyebrow = !isCheck
    ? 'REZOLVARE ÎNCHEIATĂ'
    : lesson.verdict === 'correct'
      ? 'REZOLVARE CORECTĂ'
      : isPartial
        ? 'EȘTI FOARTE APROAPE'
        : 'ȘTIM CE TREBUIE CORECTAT';
  const sticker = !isCheck ? 'GATA!' : lesson.verdict === 'correct' ? 'BRAVO!' : isPartial ? 'APROAPE!' : 'DE CORECTAT';

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
          <Pressable accessibilityRole="button" accessibilityLabel="Închide recapitularea" onPress={() => navigation.popToTop()} style={styles.close}>
            <MiniGlyph name="close" size={25} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.resultScroll} contentContainerStyle={[styles.resultBody, isShort && styles.resultBodyShort]}>
          <View style={[styles.hero, isShort && styles.heroShort]}>
            <Animated.View style={[styles.celebration, isNarrow && styles.celebrationNarrow, isShort && styles.celebrationShort, { transform: [{ scale: pop }] }]}>
              {isPositive ? <ConfettiBurst /> : null}
              <View style={[styles.burstOuter, !isPositive && styles.burstOuterReview, isShort && styles.burstOuterShort]} />
              <View style={[styles.burstInner, !isPositive && styles.burstInnerReview, isShort && styles.burstInnerShort]} />
              <Image accessible={false} source={require('../../assets/profu-mascot-v2.png')} resizeMode="contain" style={[styles.mascot, isShort && styles.mascotShort]} />
              <View style={[styles.doneSticker, !isPositive && styles.doneStickerReview]}><Text style={styles.doneStickerText}>{sticker}</Text></View>
            </Animated.View>
            <Animated.View style={[styles.heroCopy, { opacity: details, transform: [{ translateX: details.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
              <Text style={styles.eyebrow}>{verdictEyebrow}</Text>
              <Text adjustsFontSizeToFit minimumFontScale={0.76} numberOfLines={3} style={[styles.title, isNarrow && styles.titleNarrow, isShort && styles.titleShort]}>{lesson.headline}</Text>
            </Animated.View>
          </View>

          <Animated.View style={[styles.summaryPanel, { opacity: details }]}>
            <Text style={styles.summaryLabel}>PE SCURT</Text>
            <RichMathContent
              content={lesson.summary}
              color={colors.ink}
              textStyle={styles.subtitle}
              mathFontSize={15}
              inlineMathFontSize={13.5}
              mathMinHeight={25}
              mathContainerWidth={summaryMathWidth}
              mathAlign="left"
              containerStyle={styles.summaryContent}
              gap={4}
            />
          </Animated.View>

          <Animated.View style={[styles.answerBand, isShort && styles.answerBandShort, { opacity: details }]}>
            <View style={styles.answerCopy}>
              <Text style={styles.answerLabel}>{isCheck ? 'REZULTATUL CORECT' : 'RĂSPUNS FINAL'}</Text>
              <RichMathContent
                content={lesson.finalAnswer}
                color={colors.ink}
                textStyle={styles.answerText}
                mathFontSize={isNarrow ? 17 : 19}
                mathMinHeight={30}
                mathContainerWidth={answerMathWidth}
                mathAlign="left"
                gap={3}
              />
            </View>
            <View style={styles.check}><MiniGlyph name="check" size={20} /></View>
          </Animated.View>

          <View style={styles.takeawayBlock}>
            <Text style={styles.sectionTitle}>Ideile importante</Text>
            <View style={styles.takeawayList}>
              {takeaways.map((item, index) => (
                <Animated.View key={`${index}-${contentToAccessibleText(item.content)}`} style={[styles.takeaway, isShort && styles.takeawayShort, index === takeaways.length - 1 && styles.takeawayLast, { opacity: details.interpolate({ inputRange: [index * 0.14, 0.52 + index * 0.12], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
                  <View style={[styles.takeawayNumber, { backgroundColor: [colors.cyan, colors.peach, colors.lime][index % 3] }]}><Text style={styles.takeawayNumberText}>0{index + 1}</Text></View>
                  <RichMathContent content={item.content} color={colors.ink} textStyle={styles.takeawayText} mathFontSize={13} mathMinHeight={22} mathContainerWidth={takeawayMathWidth} mathAlign="left" containerStyle={styles.takeawayContent} gap={2} />
                  <MiniGlyph name="check" size={16} color={colors.violetDeep} />
                </Animated.View>
              ))}
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setFeedbackOpen(true)} style={styles.reportLink}>
            <MiniGlyph name="wrong" size={14} color={colors.inkSoft} />
            <Text style={styles.reportText}>Ai observat o greșeală? Spune-ne</Text>
          </Pressable>
        </ScrollView>
      </View>

      <View style={[styles.actionDock, { paddingHorizontal: gutter, paddingBottom: bottomSpace }]}>
        <View style={styles.secondaryActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Scoate lecția din Caiet' : 'Salvează lecția în Caiet'}
            disabled={saveBusy}
            onPress={() => void toggleSaved()}
            style={({ pressed }) => [styles.saveAction, saved && styles.saveActionActive, (pressed || saveBusy) && styles.secondaryPressed]}
          >
            <AppIcon name="bookmark" size={30} />
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86} style={styles.secondaryText}>{saved ? 'Salvat în Caiet' : 'Salvează în Caiet'}</Text>
            <MiniGlyph name={saved ? 'check' : 'next'} size={16} color={colors.violetDeep} />
          </Pressable>
          <View style={styles.secondaryDivider} />
          <Pressable accessibilityRole="button" accessibilityLabel="Înapoi la început" onPress={() => navigation.popToTop()} style={({ pressed }) => [styles.homeAction, pressed && styles.secondaryPressed]}>
            <MiniGlyph name="back" size={17} color={colors.inkSoft} />
            <Text style={styles.homeLinkText}>La început</Text>
          </Pressable>
        </View>
        <ComicButton
          compact
          title={isCheck ? 'Verifică altă rezolvare' : 'Rezolvă altă problemă'}
          icon={isCheck ? 'verify' : 'practice'}
          tone="violet"
          onPress={() => navigation.replace('Capture', { mode: lesson.mode })}
        />
      </View>
      {showSaveCoach && !saved ? (
        <Animated.View
          accessibilityLiveRegion="polite"
          style={[styles.saveCoach, {
            left: gutter,
            right: gutter,
            bottom: bottomSpace + 128,
            opacity: coachReveal,
            transform: [
              { translateY: coachReveal.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
              { scale: coachReveal.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
            ],
          }]}
        >
          <View style={styles.saveCoachPointer} />
          <View style={styles.saveCoachIcon}><AppIcon name="notebook" size={40} /></View>
          <View style={styles.saveCoachCopy}>
            <Text style={styles.saveCoachEyebrow}>MIC TRUC</Text>
            <Text style={styles.saveCoachTitle}>Păstrează lecția în Caiet</Text>
            <Text style={styles.saveCoachText}>O vei găsi acolo când vrei să repeți.</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Am înțeles" onPress={dismissSaveCoach} style={styles.saveCoachClose}>
            <MiniGlyph name="close" size={17} color={colors.ink} />
          </Pressable>
        </Animated.View>
      ) : null}
      <FeedbackSheet visible={feedbackOpen} lessonId={route.params.lessonId} onClose={() => setFeedbackOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  main: { flex: 1 },
  topRow: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 18, lineHeight: 20 },
  topEyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7.5, letterSpacing: 1.2, marginTop: 1 },
  close: { width: 48, height: 48, borderRadius: 16, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  resultScroll: { flex: 1 },
  resultBody: { flexGrow: 1, gap: 13, paddingTop: 4, paddingBottom: 14 },
  resultBodyShort: { gap: 7, paddingTop: 0, paddingBottom: 8 },
  hero: { minHeight: 178, flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroShort: { minHeight: 126 },
  celebration: { width: 154, height: 162, alignItems: 'center', justifyContent: 'center' },
  celebrationNarrow: { width: 142 },
  celebrationShort: { width: 118, height: 126 },
  burstOuter: { position: 'absolute', width: 139, height: 139, borderRadius: 70, backgroundColor: colors.violet, borderWidth: 3, borderColor: colors.ink, transform: [{ rotate: '-5deg' }] },
  burstOuterReview: { backgroundColor: '#FFE2D8' },
  burstOuterShort: { width: 110, height: 110, borderRadius: 55 },
  burstInner: { position: 'absolute', width: 119, height: 119, borderRadius: 60, borderWidth: 3, borderStyle: 'dashed', borderColor: colors.lime },
  burstInnerReview: { borderColor: colors.peach },
  burstInnerShort: { width: 94, height: 94, borderRadius: 47 },
  mascot: { width: 146, height: 153, zIndex: 6 },
  mascotShort: { width: 116, height: 122 },
  doneSticker: { position: 'absolute', zIndex: 7, right: -1, bottom: 10, backgroundColor: colors.lime, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 8, paddingVertical: 3, transform: [{ rotate: '8deg' }] },
  doneStickerReview: { backgroundColor: colors.peach },
  doneStickerText: { fontFamily: fonts.display, color: colors.ink, fontSize: 11 },
  heroCopy: { flex: 1 },
  eyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.25 },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 25, lineHeight: 27, marginTop: 3 },
  titleNarrow: { fontSize: 23, lineHeight: 25 },
  titleShort: { fontSize: 21, lineHeight: 23 },
  summaryPanel: { borderLeftWidth: 6, borderLeftColor: colors.violet, borderRadius: 18, backgroundColor: colors.violetSoft, paddingHorizontal: 13, paddingVertical: 10 },
  summaryLabel: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.2, marginBottom: 3 },
  subtitle: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12.5, lineHeight: 17 },
  summaryContent: { width: '100%' },
  answerBand: { minHeight: 62, borderTopWidth: 2.5, borderBottomWidth: 2.5, borderColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 9 },
  answerBandShort: { minHeight: 56 },
  answerCopy: { flex: 1, minWidth: 0, paddingVertical: 7 },
  answerLabel: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7.5, letterSpacing: 1.2 },
  answer: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 18, marginTop: 1 },
  answerNarrow: { fontSize: 15.5 },
  answerText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 13, lineHeight: 17 },
  check: { width: 36, height: 36, borderRadius: 12, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  takeawayBlock: { minHeight: 158 },
  sectionTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 18, lineHeight: 21, marginBottom: 6 },
  takeawayList: { borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.line },
  takeaway: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 5 },
  takeawayShort: { minHeight: 44, paddingVertical: 4 },
  takeawayLast: { borderBottomWidth: 0 },
  takeawayNumber: { width: 29, height: 29, borderRadius: 10, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  takeawayNumberText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 8 },
  takeawayText: { flex: 1, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 10.5, lineHeight: 13 },
  takeawayContent: { flex: 1 },
  reportLink: { alignSelf: 'center', minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10 },
  reportText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 10.5 },
  actionDock: { backgroundColor: colors.canvas, borderTopWidth: 1.5, borderTopColor: colors.line, paddingTop: 7, gap: 5 },
  secondaryActions: { height: 43, flexDirection: 'row', alignItems: 'center' },
  saveAction: { flex: 1.35, minWidth: 0, height: 39, borderRadius: 13, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 7 },
  saveActionActive: { borderColor: '#BCD94B', backgroundColor: colors.limeSoft },
  homeAction: { flex: 0.85, minWidth: 0, height: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 7 },
  secondaryDivider: { width: 1.5, height: 23, backgroundColor: colors.line, marginHorizontal: 5 },
  secondaryPressed: { opacity: 0.62, transform: [{ translateY: 1 }] },
  secondaryText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 10.5 },
  homeLinkText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 11 },
  saveCoach: { position: 'absolute', zIndex: 25, minHeight: 79, borderRadius: 20, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, paddingVertical: 9, shadowColor: colors.ink, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
  saveCoachPointer: { position: 'absolute', left: '22%', bottom: -8, width: 16, height: 16, borderRightWidth: 2.5, borderBottomWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.lime, transform: [{ rotate: '45deg' }] },
  saveCoachIcon: { width: 50, height: 50, borderRadius: 16, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  saveCoachCopy: { flex: 1, minWidth: 0 },
  saveCoachEyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7.5, letterSpacing: 1.2 },
  saveCoachTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 15, lineHeight: 18 },
  saveCoachText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 10.5, lineHeight: 14 },
  saveCoachClose: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
});
