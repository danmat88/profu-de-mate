import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Share, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { beginAppTransition } from '../../../shared/context/TransitionMotionContext';
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
import { colors, fonts, radii, typography } from '../../../shared/theme';
import type { RootStackParamList } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { ComicTabBar, type ComicTabOption } from '../../../shared/ui/ComicTabBar';
import { ConfettiBurst } from '../../../shared/ui/ConfettiBurst';
import { IconButton } from '../../../shared/ui/IconButton';
import { Mascot, type MascotPose } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { SpotlightAura } from '../../../shared/ui/SpotlightAura';
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

  useLayoutEffect(() => {
    if (previousTab.current === activeTab) return;
    previousTab.current = activeTab;
    if (reducedMotion || !motionActive || tabState.direction === 0) return;

    const direction = tabState.direction;
    cardShiftX.stopAnimation();
    cardShiftX.setValue(direction * 10);
    Animated.spring(cardShiftX, {
      toValue: 0,
      tension: 320,
      friction: 26,
      useNativeDriver: true,
    }).start();
    playRibbonSweep();
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
    beginAppTransition();
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.popToTop();
  };

  const reviewSteps = () => {
    Haptics.selection();
    beginAppTransition();
    navigation.replace('Lesson', {
      lesson,
      lessonId: route.params.lessonId,
      isFavorite: saved,
      source: route.params.source ?? (saved ? 'notebook' : 'flow'),
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
  const coachAnimatedStyle = useMemo(
    () => ({
      opacity: coachReveal.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 1, 1] }),
      transform: [
        { translateY: coachReveal.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
        { scale: coachReveal.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
      ],
    }),
    [coachReveal],
  );
  const ribbonSweepStyle = useMemo(
    () => ({
      opacity: ribbonSweep.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 0.78, 0.78, 0] }),
      transform: [
        { translateX: ribbonSweep.interpolate({ inputRange: [0, 1], outputRange: [-90, 420] }) },
        { skewX: '-24deg' },
      ],
    }),
    [ribbonSweep],
  );

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      <ComicBackdrop />

      {/* Full-bleed curved Celebration Summary Canopy */}
      <View
        style={[
          styles.canopy,
          isShort && styles.canopyShort,
          hasTakeaways && styles.canopyWithTabs,
          { paddingTop: insets.top ?? 0 },
        ]}
      >
        <LinearGradient
          colors={isPositive
            ? ['#823EFF', '#5A1EE0', '#380E9F']
            : ['#C83B67', '#8622A2', '#44138F']}
          start={{ x: 0.06, y: 0 }}
          end={{ x: 0.94, y: 1 }}
          style={styles.fill}
        />
        <View pointerEvents="none" style={styles.canopyGlowTop} />
        <View pointerEvents="none" style={styles.canopyGlowLime} />
        <View pointerEvents="none" style={styles.canopyOrbitArc} />
        <Text accessible={false} style={styles.canopyGlyphStar}>★</Text>
        <Text accessible={false} style={styles.canopyGlyphPi}>π</Text>

        <View style={[styles.heroRow, { paddingHorizontal: gutter }, isShort && styles.heroRowShort]}>
          <Animated.View style={[styles.celebration, isShort && styles.celebrationShort, { transform: [{ scale: heroPop }] }]}>
            {isPositive && celebrationReady && motionActive ? <ConfettiBurst /> : null}
            <SpotlightAura size={isShort ? 74 : 86} tone="onViolet" active={motionActive} />
            <Mascot pose={mascotPose} size={isShort ? 68 : 78} active={motionActive} interactive style={styles.mascot} />
          </Animated.View>

          <View style={styles.heroCopy}>
            <View style={styles.heroBadgeRow}>
              <View style={[styles.verdictPill, isPositive ? styles.verdictPillPositive : styles.verdictPillReview]}>
                <Text numberOfLines={1} style={styles.verdictPillText}>{sticker}</Text>
              </View>
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
            <Text numberOfLines={1} style={styles.heroMetaSummary}>
              {lesson.topic} · {stepCountLabel}
            </Text>
          </View>

          <IconButton
            label="Închide recapitularea"
            onPress={closeSummary}
            size={40}
            style={styles.canopyActionBtn}
          >
            <MiniGlyph name="close" size={18} color={colors.violetDeep} />
          </IconButton>
        </View>
      </View>

      {hasTakeaways ? (
        <View style={[styles.tabsWrap, { paddingHorizontal: gutter }]}>
          <ComicTabBar
            compact
            options={summaryTabs}
            value={activeTab}
            onChange={switchTab}
          />
        </View>
      ) : null}

      <View style={[styles.main, { paddingHorizontal: gutter }, !hasTakeaways && styles.mainNoTabs]}>
        <View style={styles.documentCardWrap}>
          <GestureDetector gesture={swipeGesture}>
            <Animated.View
              collapsable={false}
              style={[
                styles.cardMotion,
                { transform: [{ translateX: cardShiftX }] },
              ]}
            >
              <View collapsable={false} style={styles.documentFrame}>
                <View style={[styles.cardRibbon, { backgroundColor: ribbonColor }]}>
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.cardRibbonSweep, ribbonSweepStyle]}
                  />
                </View>

                <View collapsable={false} style={[styles.cardMetaBar, { backgroundColor: ribbonBg }]}>
                  <View collapsable={false} style={styles.pageStampPill}>
                    <Text style={styles.pageStampGlyph}>{activeTab === 'ideas' ? '✦' : '★'}</Text>
                    <Text style={styles.pageStampText}>
                      {activeTab === 'ideas' ? 'IDEI DE REȚINUT' : 'REZULTAT FINAL'}
                    </Text>
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
              pressedScale={0.965}
              haptic="selection"
              onPress={() => void toggleSaved()}
              contentStyle={[
                styles.saveAction,
                isLargeText && styles.secondaryActionLargeText,
                saved && styles.saveActionActive,
              ]}
            >
              <AppIcon name="bookmark" size={22} />
              <Text numberOfLines={isLargeText ? 2 : 1} adjustsFontSizeToFit={!isLargeText} minimumFontScale={0.85} style={styles.secondaryText}>
                {saved ? 'Salvată în Caiet' : 'Salvează în Caiet'}
              </Text>
              <View style={[styles.saveBadge, saved && styles.saveBadgeActive]}>
                <MiniGlyph name={saved ? 'check' : 'next'} size={13} color={saved ? colors.ink : colors.violetDeep} />
              </View>
            </PressableScale>
          </Animated.View>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Distribuie rezolvarea"
            pressedScale={0.96}
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
            pressedScale={0.94}
            haptic="selection"
            onPress={() => {
              setFeedbackEverOpened(true);
              setFeedbackOpen(true);
            }}
            contentStyle={[styles.reportButton, isLargeText && styles.secondaryActionLargeText]}
          >
            <MiniGlyph name="flag" size={16} color={colors.inkSoft} />
          </PressableScale>
        </View>

        <ComicButton
          compact
          title={isCheck ? 'Verifică altă rezolvare' : 'Rezolvă altă problemă'}
          icon={isCheck ? 'verify' : 'camera'}
          tone="violet"
          onPress={() => {
            beginAppTransition();
            navigation.replace('Capture', { mode: lesson.mode });
          }}
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
            coachAnimatedStyle,
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
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },

  canopy: {
    width: '100%',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    paddingBottom: 14,
    position: 'relative',
    zIndex: 4,
  },
  canopyShort: {
    paddingBottom: 10,
  },
  canopyWithTabs: {
    paddingBottom: 30,
  },
  canopyGlowTop: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    top: -80,
    right: -45,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  canopyGlowLime: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: -70,
    left: -30,
    backgroundColor: 'rgba(216, 255, 62, 0.15)',
  },
  canopyOrbitArc: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    top: -120,
    right: -80,
  },
  canopyGlyphStar: {
    position: 'absolute',
    left: 24,
    bottom: 10,
    fontFamily: fonts.display,
    fontSize: 18,
    color: 'rgba(216, 255, 62, 0.25)',
  },
  canopyGlyphPi: {
    position: 'absolute',
    right: 68,
    bottom: 12,
    fontFamily: fonts.display,
    fontSize: 26,
    color: 'rgba(255, 255, 255, 0.12)',
    transform: [{ rotate: '-10deg' }],
  },
  heroRow: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingTop: 6,
  },
  heroRowShort: {
    minHeight: 76,
    gap: 8,
    paddingTop: 4,
  },
  canopyActionBtn: {
    borderRadius: 20,
    borderBottomWidth: 3.2,
    borderBottomColor: '#C5B8FA',
    backgroundColor: '#FFFFFF',
  },
  celebration: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  celebrationShort: { width: 74, height: 74 },
  mascot: { zIndex: 6 },
  heroCopy: { flex: 1, minWidth: 0, gap: 3 },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verdictPill: {
    paddingHorizontal: 9,
    paddingVertical: 2.5,
    borderRadius: radii.pill,
  },
  verdictPillPositive: { backgroundColor: colors.lime },
  verdictPillReview: { backgroundColor: colors.gold },
  verdictPillText: { fontFamily: fonts.bodyBold, fontSize: 9.5, lineHeight: 13, letterSpacing: 0.4, color: colors.ink, includeFontPadding: false },
  eyebrow: { flexShrink: 1, ...typography.kicker, fontSize: 10, color: 'rgba(242, 240, 255, 0.92)', includeFontPadding: false },
  title: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 19,
    lineHeight: 22.5,
    textShadowColor: 'rgba(18, 6, 62, 0.28)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },
  titleNarrow: { fontSize: 17.5, lineHeight: 21 },
  titleShort: { fontSize: 16.5, lineHeight: 19.5 },
  heroMetaSummary: {
    fontFamily: fonts.bodyMedium,
    color: 'rgba(240, 236, 255, 0.88)',
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 1,
  },

  tabsWrap: { marginTop: -20, marginBottom: 6, zIndex: 8 },
  main: { flex: 1, minHeight: 0, paddingTop: 2 },
  mainNoTabs: { paddingTop: 10 },

  // Pure-white 3D porcelain paper canvas
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
  },
  documentFrame: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    borderRadius: 26,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFDF9',
  },
  cardRibbon: {
    height: 4,
    position: 'relative',
    overflow: 'hidden',
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
    minHeight: 38,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124, 60, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardMetaRight: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillInner: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scalePill: {
    flexShrink: 0,
    minWidth: 36,
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.12)',
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scalePillActive: {
    backgroundColor: colors.violetSoft,
    borderColor: '#C9B2FA',
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
  pageStampPill: {
    flexShrink: 1,
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.paper,
  },
  pageStampGlyph: {
    fontFamily: fonts.display,
    color: colors.violet,
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
    borderRadius: 999,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewStepsPillPressed: {
    transform: [{ scale: 0.96 }],
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

  actionDock: { backgroundColor: colors.canvas, paddingTop: 7, gap: 7 },
  secondaryActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveActionWrap: { flex: 1.5 },
  saveAction: {
    height: 46,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 11,
  },
  saveActionActive: { backgroundColor: '#F3FFE0', borderColor: '#C5EA63', borderBottomColor: '#98C40E' },
  saveBadge: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBadgeActive: {
    backgroundColor: colors.lime,
  },
  homeActionWrap: { flex: 0.85 },
  shareAction: {
    height: 46,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#DFD2FA',
    borderBottomColor: '#C2ADF4',
    backgroundColor: colors.violetSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
  },
  shareGlyph: { fontFamily: fonts.display, color: colors.violetDeep, fontSize: 14, lineHeight: 16, includeFontPadding: false },
  shareLinkText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 12.5 },
  reportButton: {
    width: 46,
    height: 46,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
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
    borderRadius: 22,
    borderWidth: 1.25,
    borderColor: '#C9EB46',
    backgroundColor: '#F5FFD6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
    shadowColor: '#261758',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  saveCoachPointer: {
    position: 'absolute',
    left: '22%',
    bottom: -7,
    width: 14,
    height: 14,
    borderRightWidth: 1.25,
    borderBottomWidth: 1.25,
    borderColor: '#C9EB46',
    backgroundColor: '#F5FFD6',
    transform: [{ rotate: '45deg' }],
  },
  saveCoachIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveCoachCopy: { flex: 1, minWidth: 0 },
  saveCoachEyebrow: { ...typography.kicker, color: colors.violetDeep },
  saveCoachTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 16, lineHeight: 19, marginTop: 1 },
  saveCoachText: { fontFamily: fonts.bodyMedium, color: '#3F375D', fontSize: 12, lineHeight: 16, marginTop: 2 },
  saveCoachClose: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(23, 19, 55, 0.12)',
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
