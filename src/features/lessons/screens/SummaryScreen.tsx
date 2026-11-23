import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Share, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useTransitionMotion } from '../../../shared/context/TransitionMotionContext';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { useScreenMotionActive, useTransitionSettled } from '../../../shared/hooks/useTransitionSettled';
import * as Haptics from '../../../shared/services/haptics';
import {
  getMathReadingScale,
  hasSeenSaveCoach,
  markSaveCoachSeen,
  mathReadingScaleBadge,
  nextMathReadingScale,
  setMathReadingScale,
  type MathReadingScale,
} from '../../../shared/storage/localPreferences';
import { borders, colors, fonts, radii, shadows, typography } from '../../../shared/theme';
import type { RootStackParamList } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { Chip } from '../../../shared/ui/Chip';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { ComicTabBar, type ComicTabOption } from '../../../shared/ui/ComicTabBar';
import { ConfettiBurst } from '../../../shared/ui/ConfettiBurst';
import { IconButton } from '../../../shared/ui/IconButton';
import { Mascot, type MascotPose } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { Text } from '../../../shared/ui/Typography';
import { FeedbackSheet } from '../../feedback/components/FeedbackSheet';
import { MathDocumentView } from '../../math/components/MathDocumentView';
import { contentToAccessibleText } from '../../math/utils/mathContent';
import type { MathDocumentDefinition, MathDocumentTone } from '../../math/utils/mathDocument';
import { RemoveFromNotebookModal } from '../components/RemoveFromNotebookModal';
import { setLessonFavorite } from '../services/lessons';
import { formatLessonShareMessage } from '../utils/lessonShare';

type Props = NativeStackScreenProps<RootStackParamList, 'Summary'>;
type SummaryTab = 'answer' | 'ideas';

const takeawayTones: MathDocumentTone[] = ['cyan', 'peach', 'lime'];

export function SummaryScreen({ navigation, route }: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, isNarrow, isShort, isLargeText } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { beginTransition } = useTransitionMotion();
  const transitionSettled = useTransitionSettled(navigation, reducedMotion);
  const motionActive = useScreenMotionActive(navigation, reducedMotion);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackEverOpened, setFeedbackEverOpened] = useState(false);
  const [saved, setSaved] = useState(route.params.isFavorite ?? false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removeEverOpened, setRemoveEverOpened] = useState(false);

  if (removeConfirmOpen && !removeEverOpened) {
    setRemoveEverOpened(true);
  }
  const [removingFromNotebook, setRemovingFromNotebook] = useState(false);
  const [removeError, setRemoveError] = useState(false);
  const [showSaveCoach, setShowSaveCoach] = useState(false);
  const [readingScale, setReadingScale] = useState<MathReadingScale>(() => getMathReadingScale());
  const [celebrationReady, setCelebrationReady] = useState(reducedMotion);
  const [tabState, setTabState] = useState<{ tab: SummaryTab; direction: -1 | 0 | 1 }>({
    tab: 'answer',
    direction: 0,
  });
  const activeTab = tabState.tab;

  const heroPop = useRef(new Animated.Value(reducedMotion ? 1 : 0.88)).current;
  const saveStamp = useRef(new Animated.Value(1)).current;
  const coachReveal = useRef(new Animated.Value(0)).current;
  const cardShiftX = useRef(new Animated.Value(0)).current;
  const ribbonSweep = useRef(new Animated.Value(0)).current;

  const coachCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveLocked = useRef(false);
  const previousTab = useRef<SummaryTab>('answer');
  const lesson = route.params.lesson;
  const isCheck = lesson.mode === 'check';
  const isPositive = !isCheck || lesson.verdict === 'correct';
  const isPartial = lesson.verdict === 'partially_correct';
  const hasTakeaways = lesson.takeaways.length > 0;
  const bottomSpace = Math.max(insets.bottom, 8);
  const stepCountLabel = `${lesson.steps.length} ${lesson.steps.length === 1 ? 'pas' : 'pași'}`;

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

  const playRibbonSweep = useCallback(() => {
    if (reducedMotion || !motionActive) return;
    ribbonSweep.stopAnimation();
    ribbonSweep.setValue(0);
    Animated.timing(ribbonSweep, {
      toValue: 1,
      duration: 560,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [motionActive, reducedMotion, ribbonSweep]);

  const switchTab = useCallback((next: SummaryTab) => {
    setTabState((current) => (current.tab === next
      ? current
      : { tab: next, direction: next === 'ideas' ? 1 : -1 }));
  }, []);

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

  // Immediately stop all Summary animations whenever a screen transition begins.
  useEffect(() => {
    if (motionActive) return;
    if (turnTimer.current) {
      clearTimeout(turnTimer.current);
      turnTimer.current = null;
    }
    heroPop.stopAnimation();
    saveStamp.stopAnimation();
    cardShiftX.stopAnimation();
    ribbonSweep.stopAnimation();
    cardShiftX.setValue(0);
    ribbonSweep.setValue(0);
  }, [cardShiftX, heroPop, motionActive, ribbonSweep, saveStamp]);

  useEffect(() => {
    if (reducedMotion || motionActive) {
      setCelebrationReady(true);
    }
  }, [motionActive, reducedMotion]);

  useEffect(() => {
    if (!celebrationReady || !motionActive) return;
    Haptics.notification(isPositive
      ? Haptics.NotificationFeedbackType.Success
      : Haptics.NotificationFeedbackType.Warning);
    if (reducedMotion) {
      heroPop.setValue(1);
      return;
    }
    Animated.spring(heroPop, {
      toValue: 1,
      tension: 220,
      friction: 14,
      useNativeDriver: true,
    }).start();
    playRibbonSweep();
  }, [celebrationReady, heroPop, isPositive, motionActive, playRibbonSweep, reducedMotion]);

  useEffect(() => {
    if (previousTab.current === activeTab) return;
    previousTab.current = activeTab;
    if (turnTimer.current) {
      clearTimeout(turnTimer.current);
      turnTimer.current = null;
    }
    if (reducedMotion || !motionActive || tabState.direction === 0) return;

    const direction = tabState.direction;
    cardShiftX.stopAnimation();
    Animated.timing(cardShiftX, {
      toValue: -direction * 6,
      duration: 58,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    turnTimer.current = setTimeout(() => {
      turnTimer.current = null;
      cardShiftX.setValue(direction * 10);
      Animated.spring(cardShiftX, {
        toValue: 0,
        tension: 275,
        friction: 23,
        useNativeDriver: true,
      }).start();
      playRibbonSweep();
    }, 60);
  }, [activeTab, cardShiftX, motionActive, playRibbonSweep, reducedMotion, tabState.direction]);

  useEffect(() => {
    if (!celebrationReady || saved || hasSeenSaveCoach()) return;
    const timer = setTimeout(() => {
      setShowSaveCoach(true);
      if (reducedMotion) {
        coachReveal.setValue(1);
      } else {
        Animated.spring(coachReveal, {
          toValue: 1,
          tension: 240,
          friction: 16,
          useNativeDriver: true,
        }).start();
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [celebrationReady, coachReveal, reducedMotion, saved]);

  useEffect(() => () => {
    if (coachCloseTimer.current) clearTimeout(coachCloseTimer.current);
    if (turnTimer.current) clearTimeout(turnTimer.current);
    heroPop.stopAnimation();
    saveStamp.stopAnimation();
    coachReveal.stopAnimation();
    cardShiftX.stopAnimation();
    ribbonSweep.stopAnimation();
  }, [cardShiftX, coachReveal, heroPop, ribbonSweep, saveStamp]);

  const dismissSaveCoach = () => {
    markSaveCoachSeen();
    if (coachCloseTimer.current) clearTimeout(coachCloseTimer.current);
    if (reducedMotion) {
      coachReveal.setValue(0);
      setShowSaveCoach(false);
      return;
    }
    Animated.timing(coachReveal, {
      toValue: 0,
      duration: 130,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
    coachCloseTimer.current = setTimeout(() => setShowSaveCoach(false), 135);
  };

  const closeSummary = () => {
    beginTransition();
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.popToTop();
  };

  const reviewSteps = () => {
    Haptics.selection();
    beginTransition();
    navigation.replace('Lesson', {
      lesson,
      lessonId: route.params.lessonId,
      isFavorite: saved,
      source: 'notebook',
    });
  };

  const cycleReadingScale = () => {
    Haptics.selection();
    setReadingScale((currentScale) => {
      const nextScale = nextMathReadingScale(currentScale);
      setMathReadingScale(nextScale);
      return nextScale;
    });
    playRibbonSweep();
  };

  const shareLesson = () => {
    Haptics.selection();
    void Share.share({
      title: lesson.title,
      message: formatLessonShareMessage(lesson),
    }).catch(() => undefined);
  };

  const toggleSaved = async () => {
    if (saveLocked.current || removingFromNotebook) return;
    if (saved) {
      Haptics.selection();
      setRemoveError(false);
      setRemoveConfirmOpen(true);
      return;
    }
    saveLocked.current = true;
    setSaved(true);
    setSaveBusy(true);
    if (!reducedMotion) {
      saveStamp.stopAnimation();
      Animated.sequence([
        Animated.timing(saveStamp, {
          toValue: 1.06,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(saveStamp, {
          toValue: 1,
          tension: 250,
          friction: 15,
          useNativeDriver: true,
        }),
      ]).start();
    }
    if (showSaveCoach) dismissSaveCoach();
    markSaveCoachSeen();
    try {
      await setLessonFavorite(route.params.lessonId, true);
      Haptics.notification(Haptics.NotificationFeedbackType.Success);
    } catch {
      setSaved(false);
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    } finally {
      saveLocked.current = false;
      setSaveBusy(false);
    }
  };

  const confirmRemoveFromNotebook = async () => {
    if (removingFromNotebook || saveLocked.current) return;
    setRemovingFromNotebook(true);
    setRemoveError(false);
    try {
      await setLessonFavorite(route.params.lessonId, false);
      Haptics.notification(Haptics.NotificationFeedbackType.Success);
      setSaved(false);
      setRemovingFromNotebook(false);
      setRemoveConfirmOpen(false);
    } catch {
      setRemoveError(true);
      setRemovingFromNotebook(false);
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    }
  };

  const ribbonColor = activeTab === 'ideas' ? colors.cyan : isPositive ? colors.lime : colors.peach;
  const ribbonBg = activeTab === 'ideas' ? '#E8FAFC' : isPositive ? '#F5FFD6' : '#FFF2EC';
  const coachOpacity = coachReveal.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 1, 1] });
  const coachTranslateY = coachReveal.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  const coachScale = coachReveal.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const ribbonSweepTranslateX = ribbonSweep.interpolate({ inputRange: [0, 1], outputRange: [-90, 420] });
  const ribbonSweepOpacity = ribbonSweep.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 0.78, 0.78, 0] });

  return (
    <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <View style={[styles.main, { paddingHorizontal: gutter }]}>
        <View style={styles.heroCardWrap}>
          <View pointerEvents="none" style={styles.heroCardShadow} />
          <View style={[styles.heroCard, !isPositive && styles.heroCardReview, isShort && styles.heroCardShort]}>
            <View pointerEvents="none" style={styles.heroCardShine} />
            <Animated.View style={[styles.celebration, isShort && styles.celebrationShort, { transform: [{ scale: heroPop }] }]}>
              {isPositive && celebrationReady && motionActive ? <ConfettiBurst /> : null}
              <View style={[styles.burstOuter, !isPositive && styles.burstOuterReview, isShort && styles.burstOuterShort]}>
                <View pointerEvents="none" style={styles.burstShine} />
              </View>
              <Mascot pose={mascotPose} size={isShort ? 70 : 80} active={motionActive} interactive style={styles.mascot} />
              <Chip
                label={sticker}
                tone={isPositive ? 'lime' : isPartial ? 'gold' : 'peach'}
                tilt={6}
                style={styles.doneSticker}
              />
            </Animated.View>

            <View style={styles.heroCopy}>
              <View style={styles.heroBadgeRow}>
                <Text numberOfLines={1} style={styles.eyebrow}>{verdictEyebrow}</Text>
              </View>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.78}
                numberOfLines={2}
                style={[styles.title, isNarrow && styles.titleNarrow, isShort && styles.titleShort]}
              >
                {lesson.headline}
              </Text>
              <View style={styles.heroMetaRow}>
                <View collapsable={false} style={styles.heroMetaPill}>
                  <View style={[styles.heroMetaDot, { backgroundColor: ribbonColor }]} />
                  <Text numberOfLines={1} style={styles.heroMetaText}>{lesson.topic}</Text>
                </View>
                <View collapsable={false} style={styles.heroMetaPill}>
                  <Text style={styles.heroMetaText}>{stepCountLabel}</Text>
                </View>
              </View>
            </View>

            <IconButton label="Închide recapitularea" onPress={closeSummary} size={40}>
              <MiniGlyph name="close" size={19} color={colors.ink} />
            </IconButton>
          </View>
        </View>

        {hasTakeaways ? (
          <View style={styles.tabsWrap}>
            <ComicTabBar
              compact
              options={summaryTabs}
              value={activeTab}
              onChange={switchTab}
            />
          </View>
        ) : null}

        <View style={styles.documentCardWrap}>
          <GestureDetector gesture={swipeGesture}>
            <Animated.View
              collapsable={false}
              style={[
                styles.cardMotion,
                { transform: [{ translateX: cardShiftX }] },
              ]}
            >
              <View pointerEvents="none" style={styles.documentCardShadow} />
              <View collapsable={false} style={styles.documentFrame}>
                <View style={[styles.cardRibbon, { backgroundColor: ribbonColor }]}>
                  <View pointerEvents="none" style={styles.cardRibbonShine} />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.cardRibbonSweep,
                      {
                        opacity: ribbonSweepOpacity,
                        transform: [
                          { translateX: ribbonSweepTranslateX },
                          { skewX: '-24deg' },
                        ],
                      },
                    ]}
                  />
                </View>

                <View collapsable={false} style={[styles.cardMetaBar, { backgroundColor: ribbonBg }]}>
                  <View style={styles.cardMetaLeft}>
                    <View style={styles.binderDots}>
                      <View style={styles.binderDot} />
                      <View style={styles.binderDot} />
                    </View>
                    <View collapsable={false} style={styles.pageStampPill}>
                      <Text style={styles.pageStampGlyph}>{activeTab === 'ideas' ? '✦' : '★'}</Text>
                      <Text style={styles.pageStampText}>
                        {activeTab === 'ideas' ? 'IDEI DE REȚINUT' : 'REZULTAT FINAL'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardMetaRight}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Mărime text ${mathReadingScaleBadge(readingScale)}. Apasă pentru a mări sau reseta`}
                      hitSlop={6}
                      onPress={cycleReadingScale}
                      style={({ pressed }) => [
                        styles.scalePill,
                        readingScale > 1 && styles.scalePillActive,
                        pressed && styles.reviewStepsPillPressed,
                      ]}
                    >
                      <View collapsable={false} style={styles.pillInner}>
                        <Text style={[styles.scalePillText, readingScale > 1 && styles.scalePillTextActive]}>
                          {mathReadingScaleBadge(readingScale)}
                        </Text>
                      </View>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Revezi pașii rezolvării"
                      hitSlop={6}
                      onPress={reviewSteps}
                      style={({ pressed }) => [styles.reviewStepsPill, pressed && styles.reviewStepsPillPressed]}
                    >
                      <View collapsable={false} style={styles.pillInner}>
                        <Text style={styles.reviewStepsText}>← Pași</Text>
                      </View>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.documentInner}>
                  {transitionSettled ? (
                    <MathDocumentView definition={summaryDocument}
                      readingScale={readingScale}
                      transitionDirection={tabState.direction}
                      testID="summary-math-document"
                    />
                  ) : null}
                </View>
              </View>
            </Animated.View>
          </GestureDetector>
        </View>
      </View>

      <View style={[styles.actionDock, { paddingHorizontal: gutter, paddingBottom: bottomSpace }]}>
        <View style={styles.secondaryActions}>
          <Animated.View style={[styles.saveActionWrap, { transform: [{ scale: saveStamp }] }]}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Scoate lecția din Caiet' : 'Salvează lecția în Caiet'}
              disabled={saveBusy || removingFromNotebook}
              dimWhenDisabled={false}
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
            accessibilityLabel="Distribuie rezolvarea"
            depth={shadows.sm}
            radius={15}
            shadowColor={colors.ink}
            haptic="selection"
            onPress={shareLesson}
            style={styles.homeActionWrap}
            contentStyle={[styles.shareAction, isLargeText && styles.secondaryActionLargeText]}
          >
            <Text style={styles.shareGlyph}>↗</Text>
            <Text numberOfLines={isLargeText ? 2 : 1} style={styles.shareLinkText}>Trimite</Text>
          </PressableScale>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Semnalează o greșeală în recapitulare"
            depth={shadows.sm}
            radius={15}
            shadowColor={colors.ink}
            haptic="selection"
            onPress={() => {
              setFeedbackEverOpened(true);
              setFeedbackOpen(true);
            }}
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
              opacity: coachOpacity,
              transform: [{ translateY: coachTranslateY }, { scale: coachScale }],
            },
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
      {removeEverOpened ? (
        <RemoveFromNotebookModal
          visible={removeConfirmOpen}
          lessonTitle={lesson.title}
          description="Lecția va dispărea din Caietul tău. O poți salva din nou oricând cât ești aici."
          removing={removingFromNotebook}
          error={removeError}
          onConfirm={() => void confirmRemoveFromNotebook()}
          onCancel={() => {
            if (removingFromNotebook) return;
            setRemoveConfirmOpen(false);
          }}
          onAfterClose={() => setRemoveError(false)}
        />
      ) : null}
      {feedbackEverOpened ? (
        <FeedbackSheet visible={feedbackOpen} lessonId={route.params.lessonId} onClose={() => setFeedbackOpen(false)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  main: { flex: 1, minHeight: 0, paddingTop: 6 },

  // Collectible victory studio banner
  heroCardWrap: {
    position: 'relative',
    paddingBottom: shadows.sm + 1,
  },
  heroCardShadow: {
    position: 'absolute',
    top: shadows.sm + 1,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 22,
    backgroundColor: colors.ink,
  },
  heroCard: {
    minHeight: 96,
    borderRadius: 22,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  heroCardReview: {
    backgroundColor: '#FFF9F4',
  },
  heroCardShort: {
    minHeight: 84,
    paddingVertical: 6,
    gap: 8,
  },
  heroCardShine: {
    position: 'absolute',
    top: 3,
    left: 14,
    right: 14,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: colors.shine,
  },
  celebration: { width: 82, height: 82, alignItems: 'center', justifyContent: 'center' },
  celebrationShort: { width: 72, height: 72 },
  burstOuter: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.violet,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    overflow: 'hidden',
    transform: [{ rotate: '-5deg' }],
  },
  burstOuterReview: { backgroundColor: colors.peachSoft },
  burstOuterShort: { width: 60, height: 60, borderRadius: 30 },
  burstShine: {
    position: 'absolute',
    top: 5,
    left: 11,
    right: 11,
    height: 10,
    borderRadius: 6,
    backgroundColor: colors.shineSoft,
  },
  mascot: { zIndex: 6 },
  doneSticker: { position: 'absolute', zIndex: 7, right: -6, bottom: -1 },
  heroCopy: { flex: 1, minWidth: 0, gap: 3 },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center' },
  eyebrow: { ...typography.kicker, fontSize: 10, color: colors.violetDeep, includeFontPadding: false },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 18.5, lineHeight: 21.5 },
  titleNarrow: { fontSize: 17, lineHeight: 20 },
  titleShort: { fontSize: 16.5, lineHeight: 19.5 },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 1,
  },
  heroMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#D9CEF2',
    backgroundColor: colors.paperTint,
  },
  heroMetaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  heroMetaText: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.inkSoft,
    fontSize: 10,
    lineHeight: 13,
    includeFontPadding: false,
  },

  tabsWrap: { marginTop: 8, marginBottom: 6 },

  // Summary comic card
  documentCardWrap: {
    flex: 1,
    minHeight: 0,
    marginTop: 4,
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
    backgroundColor: '#FFFDF9',
  },
  cardRibbon: {
    height: 10,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.ink,
    position: 'relative',
    overflow: 'hidden',
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
  cardRibbonSweep: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    left: 0,
    width: 72,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  cardMetaBar: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderBottomWidth: 1.5,
    borderBottomColor: '#E8DFF7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardMetaLeft: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardMetaRight: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillInner: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scalePill: {
    flexShrink: 0,
    minWidth: 36,
    minHeight: 28,
    borderRadius: 9,
    borderWidth: 1.5,
    borderBottomWidth: 2.5,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scalePillActive: {
    backgroundColor: colors.violetSoft,
    borderColor: colors.violetDeep,
  },
  scalePillText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 11,
    lineHeight: 15,
    paddingHorizontal: 1,
    includeFontPadding: false,
  },
  scalePillTextActive: {
    color: colors.violetDeep,
  },
  binderDots: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  binderDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.25,
    borderColor: colors.ink,
    backgroundColor: colors.canvas,
  },
  pageStampPill: {
    flexShrink: 1,
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    borderWidth: 1.5,
    borderBottomWidth: 2.5,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
  },
  pageStampGlyph: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 11,
    lineHeight: 15,
    includeFontPadding: false,
  },
  pageStampText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 10.5,
    lineHeight: 15,
    letterSpacing: 0.3,
    paddingHorizontal: 1,
    includeFontPadding: false,
  },
  reviewStepsPill: {
    flexShrink: 0,
    minHeight: 28,
    borderRadius: 9,
    borderWidth: 1.5,
    borderBottomWidth: 2.5,
    borderColor: colors.ink,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewStepsPillPressed: {
    transform: [{ translateY: 1.5 }],
  },
  reviewStepsText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 11,
    lineHeight: 15,
    paddingHorizontal: 1,
    includeFontPadding: false,
  },
  documentInner: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: '#FFFDF9' },

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
  homeActionWrap: { flex: 0.85 },
  shareAction: {
    height: 42,
    borderRadius: 15,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.violetSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 9,
  },
  shareGlyph: { fontFamily: fonts.display, color: colors.violetDeep, fontSize: 14, lineHeight: 16, includeFontPadding: false },
  shareLinkText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 12.5 },
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
  saveCoachTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 16, lineHeight: 19, marginTop: 1 },
  saveCoachText: { fontFamily: fonts.bodyMedium, color: '#2E2A47', fontSize: 12, lineHeight: 16, marginTop: 2 },
  saveCoachClose: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
