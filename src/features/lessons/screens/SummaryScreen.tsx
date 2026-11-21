import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import * as Haptics from '../../../shared/services/haptics';
import { hasSeenSaveCoach, markSaveCoachSeen } from '../../../shared/storage/localPreferences';
import { borders, colors, fonts, radii, shadows, springs, typography } from '../../../shared/theme';
import type { RootStackParamList } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { Chip } from '../../../shared/ui/Chip';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { ComicTabBar, type ComicTabOption } from '../../../shared/ui/ComicTabBar';
import { ConfettiBurst } from '../../../shared/ui/ConfettiBurst';
import { Enter } from '../../../shared/ui/Enter';
import { IconButton } from '../../../shared/ui/IconButton';
import { Mascot, type MascotPose } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { Text } from '../../../shared/ui/Typography';
import { FeedbackSheet } from '../../feedback/components/FeedbackSheet';
import { MathDocumentView } from '../../math/components/MathDocumentView';
import { contentToAccessibleText } from '../../math/utils/mathContent';
import type { MathDocumentDefinition, MathDocumentTone } from '../../math/utils/mathDocument';
import { setLessonFavorite } from '../services/lessons';

type Props = NativeStackScreenProps<RootStackParamList, 'Summary'>;
type SummaryTab = 'answer' | 'ideas';

const takeawayTones: MathDocumentTone[] = ['cyan', 'peach', 'lime'];

export function SummaryScreen({ navigation, route }: Props) {
  const { gutter, isNarrow, isShort, isLargeText } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [saved, setSaved] = useState(route.params.isFavorite ?? false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [showSaveCoach, setShowSaveCoach] = useState(false);
  const [activeTab, setActiveTab] = useState<SummaryTab>('answer');

  const heroPop = useSharedValue(reducedMotion ? 1 : 0.88);
  const cardShift = useSharedValue(0);
  const saveStamp = useSharedValue(1);
  const coachReveal = useSharedValue(0);

  const coachCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveLocked = useRef(false);
  const lesson = route.params.lesson;
  const isCheck = lesson.mode === 'check';
  const isPositive = !isCheck || lesson.verdict === 'correct';
  const isPartial = lesson.verdict === 'partially_correct';
  const hasTakeaways = lesson.takeaways.length > 0;
  const bottomSpace = Math.max(insets.bottom, 8);

  const mascotPose: MascotPose = isPositive ? 'cheer' : isPartial ? 'point' : 'oops';
  const verdictEyebrow = !isCheck
    ? 'REZOLVARE ÎNCHEIATĂ'
    : lesson.verdict === 'correct'
      ? 'REZOLVARE CORECTĂ'
      : isPartial
        ? 'EȘTI FOARTE APROAPE'
        : 'ȘTIM CE TREBUIE CORECTAT';
  const sticker = !isCheck ? 'GATA!' : lesson.verdict === 'correct' ? 'BRAVO!' : isPartial ? 'APROAPE!' : 'DE CORECTAT';

  const summaryTabs = useMemo<readonly ComicTabOption<SummaryTab>[]>(() => [
    {
      value: 'answer',
      label: '★ Răspuns',
      activeFill: colors.violet,
      activeText: colors.paper,
    },
    {
      value: 'ideas',
      label: 'Idei cheie',
      badge: lesson.takeaways.length,
      activeFill: colors.cyan,
      activeText: colors.ink,
      badgeFill: colors.lime,
      badgeText: colors.ink,
    },
  ], [lesson.takeaways.length]);

  const switchTab = useCallback((next: SummaryTab) => {
    setActiveTab((current) => {
      if (current === next) return current;
      const direction = next === 'ideas' ? 1 : -1;
      if (!reducedMotion) {
        cardShift.set(direction * 22);
        cardShift.set(withSpring(0, springs.snappy));
      }
      return next;
    });
  }, [cardShift, reducedMotion]);

  const swipeToIdeas = useCallback(() => {
    if (!hasTakeaways || activeTab === 'ideas') return;
    Haptics.selection();
    switchTab('ideas');
  }, [activeTab, hasTakeaways, switchTab]);

  const swipeToAnswer = useCallback(() => {
    if (!hasTakeaways || activeTab === 'answer') return;
    Haptics.selection();
    switchTab('answer');
  }, [activeTab, hasTakeaways, switchTab]);

  const swipeGesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetX([-34, 34])
      .failOffsetY([-16, 16])
      .onEnd((event) => {
        if (event.translationX < -60 || event.velocityX < -520) {
          scheduleOnRN(swipeToIdeas);
        } else if (event.translationX > 60 || event.velocityX > 520) {
          scheduleOnRN(swipeToAnswer);
        }
      }),
    [swipeToAnswer, swipeToIdeas],
  );

  const summaryDocument = useMemo<MathDocumentDefinition>(() => {
    if (activeTab === 'ideas' && hasTakeaways) {
      return {
        accessibilityLabel: [
          'Ideile importante',
          ...lesson.takeaways.map((item) => contentToAccessibleText(item.content)),
        ].join('. '),
        variant: 'summary',
        sections: [
          { kind: 'section_title', eyebrow: 'DE PĂSTRAT', title: 'Ideile importante' },
          ...lesson.takeaways.map((item, index) => ({
            kind: 'takeaway' as const,
            index: index + 1,
            content: item.content,
            tone: takeawayTones[index % takeawayTones.length],
          })),
        ],
      };
    }

    return {
      accessibilityLabel: [
        contentToAccessibleText(lesson.finalAnswer),
        contentToAccessibleText(lesson.summary),
      ].join('. '),
      variant: 'summary',
      sections: [
        {
          kind: 'answer',
          label: isCheck ? '★ REZULTATUL CORECT' : '★ RĂSPUNS FINAL',
          caption: isCheck ? 'Compară acest rezultat cu rezolvarea ta.' : 'Rezultatul obținut după toți pașii.',
          content: lesson.finalAnswer,
        },
        { kind: 'section_title', eyebrow: 'PE SCURT', title: 'Cum am ajuns la rezultat' },
        { kind: 'content', content: lesson.summary },
      ],
    };
  }, [activeTab, hasTakeaways, isCheck, lesson.finalAnswer, lesson.summary, lesson.takeaways]);

  useEffect(() => {
    Haptics.notification(isPositive
      ? Haptics.NotificationFeedbackType.Success
      : Haptics.NotificationFeedbackType.Warning);
    if (reducedMotion) {
      heroPop.set(1);
      return;
    }
    heroPop.set(withSpring(1, springs.bouncy));
  }, [heroPop, isPositive, reducedMotion]);

  useEffect(() => {
    if (saved || hasSeenSaveCoach()) return;
    const timer = setTimeout(() => {
      setShowSaveCoach(true);
      if (reducedMotion) coachReveal.set(1);
      else coachReveal.set(withSpring(1, springs.bouncy));
    }, 650);
    return () => clearTimeout(timer);
  }, [coachReveal, reducedMotion, saved]);

  useEffect(() => () => {
    if (coachCloseTimer.current) clearTimeout(coachCloseTimer.current);
  }, []);

  const dismissSaveCoach = () => {
    markSaveCoachSeen();
    if (coachCloseTimer.current) clearTimeout(coachCloseTimer.current);
    if (reducedMotion) {
      coachReveal.set(0);
      setShowSaveCoach(false);
      return;
    }
    coachReveal.set(withTiming(0, { duration: 130, easing: Easing.in(Easing.quad) }));
    coachCloseTimer.current = setTimeout(() => setShowSaveCoach(false), 135);
  };

  const toggleSaved = async () => {
    if (saveLocked.current) return;
    saveLocked.current = true;
    const nextSaved = !saved;
    setSaved(nextSaved);
    setSaveBusy(true);
    if (nextSaved && !reducedMotion) {
      saveStamp.set(withSequence(
        withTiming(1.06, { duration: 95 }),
        withSpring(1, springs.bouncy),
      ));
    }
    if (showSaveCoach) dismissSaveCoach();
    if (nextSaved) markSaveCoachSeen();
    try {
      await setLessonFavorite(route.params.lessonId, nextSaved);
      Haptics.notification(nextSaved
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning);
    } catch {
      setSaved(!nextSaved);
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    } finally {
      saveLocked.current = false;
      setSaveBusy(false);
    }
  };

  const celebrationAnimated = useAnimatedStyle(() => ({
    transform: [{ scale: heroPop.get() }],
  }));

  const cardAnimated = useAnimatedStyle(() => ({
    transform: [{ translateX: cardShift.get() }],
  }));

  const saveStampAnimated = useAnimatedStyle(() => ({
    transform: [{ scale: saveStamp.get() }],
  }));

  const coachAnimated = useAnimatedStyle(() => {
    const p = coachReveal.get();
    return {
      opacity: Math.min(1, p * 1.25),
      transform: [{ translateY: (1 - p) * 16 }, { scale: 0.94 + p * 0.06 }],
    };
  });

  const ribbonColor = activeTab === 'ideas' ? colors.cyan : isPositive ? colors.lime : colors.peach;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <View style={[styles.main, { paddingHorizontal: gutter }]}>
        <View style={[styles.hero, isShort && styles.heroShort]}>
          <Animated.View style={[styles.celebration, isShort && styles.celebrationShort, celebrationAnimated]}>
            {isPositive ? <ConfettiBurst /> : null}
            <View style={[styles.burstOuter, !isPositive && styles.burstOuterReview, isShort && styles.burstOuterShort]}>
              <View pointerEvents="none" style={styles.burstShine} />
            </View>
            <Mascot pose={mascotPose} size={isShort ? 74 : 84} active interactive style={styles.mascot} />
            <Chip
              label={sticker}
              tone={isPositive ? 'lime' : isPartial ? 'gold' : 'peach'}
              tilt={6}
              style={styles.doneSticker}
            />
          </Animated.View>

          <Enter delay={40} distance={10} style={styles.heroCopy}>
            <Text numberOfLines={1} style={styles.eyebrow}>{verdictEyebrow}</Text>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              numberOfLines={2}
              style={[styles.title, isNarrow && styles.titleNarrow, isShort && styles.titleShort]}
            >
              {lesson.headline}
            </Text>
          </Enter>

          <IconButton label="Închide recapitularea" onPress={() => navigation.popToTop()} size={42}>
            <MiniGlyph name="close" size={20} color={colors.ink} />
          </IconButton>
        </View>

        {hasTakeaways ? (
          <Enter delay={75} distance={10} style={styles.tabsWrap}>
            <ComicTabBar
              compact
              options={summaryTabs}
              value={activeTab}
              onChange={switchTab}
            />
          </Enter>
        ) : null}

        <Enter delay={105} distance={14} style={styles.documentCardWrap}>
          <GestureDetector gesture={swipeGesture}>
            <Animated.View style={[styles.cardMotion, cardAnimated]}>
              <View pointerEvents="none" style={styles.documentCardShadow} />
              <View style={styles.documentFrame}>
                <View style={[styles.cardRibbon, { backgroundColor: ribbonColor }]}>
                  <View pointerEvents="none" style={styles.cardRibbonShine} />
                </View>
                <View style={styles.documentInner}>
                  <MathDocumentView definition={summaryDocument} testID="summary-math-document" />
                </View>
              </View>
            </Animated.View>
          </GestureDetector>
        </Enter>
      </View>

      <View style={[styles.actionDock, { paddingHorizontal: gutter, paddingBottom: bottomSpace }]}>
        <View style={styles.secondaryActions}>
          <Animated.View style={[styles.saveActionWrap, saveStampAnimated]}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Scoate lecția din Caiet' : 'Salvează lecția în Caiet'}
              disabled={saveBusy}
              depth={shadows.sm}
              radius={15}
              shadowColor={colors.ink}
              haptic="selection"
              onPress={() => void toggleSaved()}
              contentStyle={[
                styles.saveAction,
                isLargeText && styles.secondaryActionLargeText,
                saved && styles.saveActionActive,
              ]}
            >
              <AppIcon name="bookmark" size={24} />
              <Text numberOfLines={isLargeText ? 2 : 1} adjustsFontSizeToFit={!isLargeText} minimumFontScale={0.85} style={styles.secondaryText}>
                {saved ? 'Salvat în Caiet' : 'Salvează în Caiet'}
              </Text>
              <View style={[styles.saveBadge, saved && styles.saveBadgeActive]}>
                <MiniGlyph name={saved ? 'check' : 'next'} size={13} color={saved ? colors.ink : colors.violetDeep} />
              </View>
            </PressableScale>
          </Animated.View>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Înapoi la început"
            depth={shadows.sm}
            radius={15}
            shadowColor={colors.ink}
            haptic="selection"
            onPress={() => navigation.popToTop()}
            style={styles.homeActionWrap}
            contentStyle={[styles.homeAction, isLargeText && styles.secondaryActionLargeText]}
          >
            <MiniGlyph name="back" size={15} color={colors.ink} />
            <Text numberOfLines={isLargeText ? 2 : 1} style={styles.homeLinkText}>Acasă</Text>
          </PressableScale>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Semnalează o greșeală în recapitulare"
            depth={shadows.sm}
            radius={15}
            shadowColor={colors.ink}
            haptic="selection"
            onPress={() => setFeedbackOpen(true)}
            contentStyle={[styles.reportButton, isLargeText && styles.secondaryActionLargeText]}
          >
            <MiniGlyph name="wrong" size={16} color={colors.inkSoft} />
          </PressableScale>
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
          style={[
            styles.saveCoach,
            {
              left: gutter,
              right: gutter,
              bottom: bottomSpace + (isLargeText ? 168 : 134),
            },
            coachAnimated,
          ]}
        >
          <View style={styles.saveCoachPointer} />
          <View style={styles.saveCoachIcon}>
            <AppIcon name="notebook" size={34} />
          </View>
          <View style={styles.saveCoachCopy}>
            <Text style={styles.saveCoachEyebrow}>MIC TRUC</Text>
            <Text style={styles.saveCoachTitle}>Păstrează lecția în Caiet</Text>
            <Text style={styles.saveCoachText}>O vei găsi acolo când vrei să repeți.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Am înțeles"
            hitSlop={8}
            onPress={dismissSaveCoach}
            style={styles.saveCoachClose}
          >
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
  main: { flex: 1, minHeight: 0, paddingTop: 4 },

  // Unified compact Celebration Banner
  hero: { height: 92, flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroShort: { height: 80, gap: 8 },
  celebration: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  celebrationShort: { width: 76, height: 76 },
  burstOuter: {
    position: 'absolute',
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.violet,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    overflow: 'hidden',
    transform: [{ rotate: '-5deg' }],
  },
  burstOuterReview: { backgroundColor: colors.peachSoft },
  burstOuterShort: { width: 64, height: 64, borderRadius: 32 },
  burstShine: {
    position: 'absolute',
    top: 6,
    left: 12,
    right: 12,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.shineSoft,
  },
  mascot: { zIndex: 6 },
  doneSticker: { position: 'absolute', zIndex: 7, right: -6, bottom: 0 },
  heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: { ...typography.kicker, fontSize: 10.5, color: colors.violetDeep },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 20, lineHeight: 23, marginTop: 2 },
  titleNarrow: { fontSize: 18.5, lineHeight: 21.5 },
  titleShort: { fontSize: 17.5, lineHeight: 20.5 },

  tabsWrap: { marginTop: 6, marginBottom: 6 },

  // Summary comic card
  documentCardWrap: {
    flex: 1,
    minHeight: 0,
    marginTop: 2,
    paddingBottom: 2,
  },
  cardMotion: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    paddingBottom: shadows.md,
  },
  documentCardShadow: {
    position: 'absolute',
    top: shadows.md,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 23,
    backgroundColor: colors.ink,
  },
  documentFrame: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    borderRadius: 23,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
  },
  cardRibbon: {
    height: 9,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.ink,
    position: 'relative',
  },
  cardRibbonShine: {
    position: 'absolute',
    top: 1.5,
    left: 14,
    right: 14,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: colors.shine,
  },
  documentInner: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: colors.paper },

  actionDock: { backgroundColor: colors.canvas, paddingTop: 6, gap: 6 },
  secondaryActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveActionWrap: { flex: 1.5 },
  saveAction: {
    height: 42,
    borderRadius: 15,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  saveActionActive: { backgroundColor: colors.limeSoft },
  saveBadge: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBadgeActive: {
    backgroundColor: colors.lime,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  homeActionWrap: { flex: 0.78 },
  homeAction: {
    height: 42,
    borderRadius: 15,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.paperTint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 9,
  },
  reportButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionLargeText: { height: 54 },
  secondaryText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12.5 },
  homeLinkText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12.5 },

  // Save coach tooltip
  saveCoach: {
    position: 'absolute',
    zIndex: 25,
    minHeight: 80,
    borderRadius: radii.lg,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 11,
    paddingVertical: 10,
    shadowColor: colors.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  saveCoachPointer: {
    position: 'absolute',
    left: '22%',
    bottom: -8,
    width: 16,
    height: 16,
    borderRightWidth: borders.regular,
    borderBottomWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    transform: [{ rotate: '45deg' }],
  },
  saveCoachIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  saveCoachCopy: { flex: 1, minWidth: 0 },
  saveCoachEyebrow: { ...typography.kicker, color: colors.violetDeep },
  saveCoachTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 15.5, lineHeight: 19, marginTop: 1 },
  saveCoachText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12.5, lineHeight: 17 },
  saveCoachClose: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
