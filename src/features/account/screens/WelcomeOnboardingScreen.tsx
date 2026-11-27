import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import {
  createNativeLoop,
  SILKY_EASE_IN_OUT,
  SILKY_EASE_OUT,
} from '../../../shared/motion/nativeMotion';
import { bundledImageSource } from '../../../shared/services/bundledImages';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, radii, typography } from '../../../shared/theme';
import { AppIcon, type AppIconName } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { Mascot, type MascotPose } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { SpeechBubble, type SpeechBubbleTone } from '../../../shared/ui/SpeechBubble';
import { SpotlightAura } from '../../../shared/ui/SpotlightAura';
import { Text } from '../../../shared/ui/Typography';
import {
  canConfirmAgeEligibility,
  type AgeEligibilityGroup,
} from '../../../shared/utils/ageEligibility';
import { STUDY_TRACKS, type StudyTrackId } from '../../study/types';

type Props = {
  active?: boolean;
  ready?: boolean;
  onConfirm: (group: AgeEligibilityGroup, track: StudyTrackId | null) => void;
  onOpenLegal: () => void;
};

type AgeOptionConfig = {
  id: AgeEligibilityGroup;
  title: string;
  subtitle: string;
  icon: AppIconName;
  badgeBg: string;
  badgeRing: string;
};

type TrackChipConfig = {
  id: StudyTrackId;
  label: string;
  dot: string;
};

type SparkSpec = {
  symbol: string;
  dx: number;
  dy: number;
  rotate: string;
  color: string;
  size: number;
};

const AGE_OPTIONS: readonly AgeOptionConfig[] = [
  {
    id: '16_plus',
    title: '16+ ani',
    subtitle: 'Elev / student',
    icon: 'trophy',
    badgeBg: '#F1E8FF',
    badgeRing: '#DCC8FF',
  },
  {
    id: '13_15_parental',
    title: '13–15 ani',
    subtitle: 'Cu acord părinte',
    icon: 'class',
    badgeBg: '#E4FAFD',
    badgeRing: '#B2EEF6',
  },
  {
    id: 'parent',
    title: 'Părinte',
    subtitle: 'Pentru copil',
    icon: 'explain',
    badgeBg: '#F2FFCF',
    badgeRing: '#D2F287',
  },
];

const TRACK_CHIPS: readonly TrackChipConfig[] = [
  { id: 'en', label: 'EN · Clasa VIII', dot: colors.cyan },
  { id: 'bac_m1', label: 'BAC · M1', dot: colors.violet },
  { id: 'bac_m2', label: 'BAC · M2', dot: colors.peach },
  { id: 'bac_m3', label: 'BAC · M3', dot: colors.gold },
  { id: 'liceu', label: 'Liceu (IX–XI)', dot: colors.mint },
  { id: 'gimnaziu', label: 'Gimnaziu (V–VII)', dot: colors.limeDeep },
];

const CELEBRATION_SPARKS: readonly SparkSpec[] = [
  { symbol: '✦', dx: -68, dy: -46, rotate: '-26deg', color: colors.lime, size: 17 },
  { symbol: '+', dx: 66, dy: -44, rotate: '22deg', color: colors.cyan, size: 18 },
  { symbol: '★', dx: -64, dy: 28, rotate: '-18deg', color: colors.gold, size: 16 },
  { symbol: 'π', dx: 62, dy: 30, rotate: '24deg', color: colors.peach, size: 17 },
  { symbol: '✦', dx: -4, dy: -66, rotate: '14deg', color: colors.paper, size: 15 },
  { symbol: '×', dx: 16, dy: 52, rotate: '-20deg', color: colors.limeBright, size: 16 },
];

const PLAYFUL_TAPS: readonly { title: string; body: string; pose: MascotPose }[] = [
  { title: 'Abia aștept!', body: 'Alege vârsta și deschidem imediat tabla de mate.', pose: 'cheer' },
  { title: 'Pas cu pas!', body: 'Fiecare problemă devine clară — fără grabă și fără stres.', pose: 'point' },
  { title: 'Sunt aici cu tine!', body: 'O singură atingere și pornim împreună la treabă.', pose: 'wave' },
];

const AgeOptionCard = memo(function AgeOptionCard({
  option,
  selected,
  disabled,
  compact,
  reducedMotion,
  enterProgress,
  onPress,
}: {
  option: AgeOptionConfig;
  selected: boolean;
  disabled: boolean;
  compact: boolean;
  reducedMotion: boolean;
  enterProgress: Animated.Value;
  onPress: () => void;
}) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const selectPop = useRef(new Animated.Value(1)).current;
  const previousSelected = useRef(selected);

  useEffect(() => {
    if (selected && !previousSelected.current && !reducedMotion) {
      selectPop.stopAnimation();
      selectPop.setValue(0.94);
      Animated.spring(selectPop, {
        toValue: 1,
        tension: 300,
        friction: 15,
        useNativeDriver: true,
      }).start();
    }
    previousSelected.current = selected;
  }, [reducedMotion, selectPop, selected]);

  const handlePressIn = () => {
    if (disabled || reducedMotion) return;
    pressScale.stopAnimation();
    Animated.timing(pressScale, {
      toValue: 0.955,
      duration: 75,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reducedMotion) return;
    pressScale.stopAnimation();
    Animated.spring(pressScale, {
      toValue: 1,
      tension: 340,
      friction: 18,
      useNativeDriver: true,
    }).start();
  };

  const enterStyle = useMemo(() => ({
    opacity: enterProgress.interpolate({
      inputRange: [0, 0.55, 1],
      outputRange: [0.01, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: enterProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [22, 0],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: enterProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.93, 1],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [enterProgress]);

  const interactiveScale = useMemo(() => ({
    transform: [{ scale: Animated.multiply(pressScale, selectPop) }],
  }), [pressScale, selectPop]);

  return (
    <Animated.View style={[styles.ageCardCol, enterStyle]}>
      <Animated.View style={interactiveScale}>
        <Pressable
          accessibilityRole="radio"
          accessibilityLabel={`${option.title}, ${option.subtitle}`}
          accessibilityState={{ checked: selected, disabled }}
          disabled={disabled}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={onPress}
          style={[
            styles.ageCard,
            compact && styles.ageCardCompact,
            selected && styles.ageCardSelected,
          ]}
        >
          {selected ? (
            <>
              <LinearGradient
                colors={['#9456FF', '#6D28F4', '#4B14C9']}
                start={{ x: 0.08, y: 0 }}
                end={{ x: 0.92, y: 1 }}
                style={styles.fill}
              />
              <View pointerEvents="none" style={styles.ageCardGlowLime} />
              <View pointerEvents="none" style={styles.ageCardShineSelected} />
            </>
          ) : (
            <View pointerEvents="none" style={styles.ageCardShine} />
          )}

          <View style={styles.ageCardTop}>
            <View
              style={[
                styles.ageIconMedallion,
                compact && styles.ageIconMedallionCompact,
                selected
                  ? styles.ageIconMedallionSelected
                  : { backgroundColor: option.badgeBg, borderColor: option.badgeRing },
              ]}
            >
              <AppIcon name={option.icon} size={compact ? 24 : 28} />
            </View>

            {selected ? (
              <View style={styles.ageCheck}>
                <MiniGlyph name="check" size={11} color={colors.ink} />
              </View>
            ) : (
              <View style={styles.ageRadioEmpty} />
            )}
          </View>

          <View style={styles.ageCopy}>
            <Text
              maxFontSizeMultiplier={1.15}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              style={[styles.ageTitle, compact && styles.ageTitleCompact, selected && styles.ageTitleSelected]}
            >
              {option.title}
            </Text>
            <Text
              maxFontSizeMultiplier={1.1}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[styles.ageSubtitle, selected && styles.ageSubtitleSelected]}
            >
              {option.subtitle}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
});

/**
 * Full-screen first-launch studio onboarding shown strictly BEFORE Home mounts
 * so the user can never interact with underlying tabs before confirming age
 * eligibility (Romania GDPR 16+ / 13–15 parental consent / Play 13+).
 *
 * Choreographs a silky spatial baton-pass from LaunchSplash (curved canopy
 * unfurl + owl perch landing + cascading 3D age cards + rising CTA) and a
 * celebratory spatial handoff onto the shared warm cream canvas before Home
 * unfurls — 100% pure native driver (zero Reanimated).
 */
export const WelcomeOnboardingScreen = memo(function WelcomeOnboardingScreen({
  active = true,
  ready = true,
  onConfirm,
  onOpenLegal,
}: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, contentWidth, height, fontScale } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const compact = height - insets.top < 700 || fontScale >= 1.28;

  const [selectedGroup, setSelectedGroup] = useState<AgeEligibilityGroup | null>(null);
  const [parentalConfirmed, setParentalConfirmed] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<StudyTrackId | null>(null);
  const [mascotNudge, setMascotNudge] = useState(0);
  const [tapChatIndex, setTapChatIndex] = useState<number | null>(null);
  const [entranceSettled, setEntranceSettled] = useState(reducedMotion);
  const [statusBarReady, setStatusBarReady] = useState(reducedMotion);
  const [exiting, setExiting] = useState(false);

  const canProceed = canConfirmAgeEligibility(selectedGroup, parentalConfirmed);
  const entrancePlayed = useRef(reducedMotion);
  const exitLock = useRef(false);
  const previousCanProceed = useRef(false);
  const tapChatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Pure native-driver Animated values (100% Android RenderThread).
  const canopyEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const mascotEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const heroCopyEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const sectionOneTitleEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const cardEnter0 = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const cardEnter1 = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const cardEnter2 = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const tracksEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const footerEnter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  const parentalReveal = useRef(new Animated.Value(0)).current;
  const badgePop = useRef(new Animated.Value(1)).current;
  const ctaPop = useRef(new Animated.Value(1)).current;
  const ctaSheen = useRef(new Animated.Value(0)).current;
  const celebrateBurst = useRef(new Animated.Value(0)).current;

  const footerExit = useRef(new Animated.Value(0)).current;
  const bodyExit = useRef(new Animated.Value(0)).current;
  const canopyExit = useRef(new Animated.Value(0)).current;

  const cardEnters = useMemo(
    () => [cardEnter0, cardEnter1, cardEnter2] as const,
    [cardEnter0, cardEnter1, cardEnter2],
  );

  // Clean up any pending timers on unmount.
  useEffect(() => () => {
    if (tapChatTimer.current) clearTimeout(tapChatTimer.current);
    exitTimers.current.forEach((timer) => clearTimeout(timer));
    exitTimers.current = [];
  }, []);

  // Choreographed entrance synchronized with LaunchSplash's cream veil reveal.
  useEffect(() => {
    if (reducedMotion) {
      for (const val of [
        canopyEnter,
        mascotEnter,
        heroCopyEnter,
        sectionOneTitleEnter,
        cardEnter0,
        cardEnter1,
        cardEnter2,
        tracksEnter,
        footerEnter,
      ]) {
        val.stopAnimation();
        val.setValue(1);
      }
      entrancePlayed.current = true;
      setEntranceSettled(true);
      setStatusBarReady(true);
      return undefined;
    }

    if (!ready) {
      if (!entrancePlayed.current) {
        for (const val of [
          canopyEnter,
          mascotEnter,
          heroCopyEnter,
          sectionOneTitleEnter,
          cardEnter0,
          cardEnter1,
          cardEnter2,
          tracksEnter,
          footerEnter,
        ]) {
          val.setValue(0);
        }
      }
      return undefined;
    }

    if (entrancePlayed.current) {
      setEntranceSettled(true);
      setStatusBarReady(true);
      return undefined;
    }
    entrancePlayed.current = true;

    const anims: Animated.CompositeAnimation[] = [];
    const run = (value: Animated.Value, duration: number, delay: number) => {
      const anim = Animated.timing(value, {
        toValue: 1,
        duration,
        delay,
        easing: SILKY_EASE_OUT,
        useNativeDriver: true,
      });
      anims.push(anim);
      anim.start();
    };

    const frameId = requestAnimationFrame(() => {
      run(canopyEnter, 540, 0);
      run(mascotEnter, 480, 75);
      run(heroCopyEnter, 460, 130);
      run(sectionOneTitleEnter, 400, 175);
      run(cardEnter0, 440, 195);
      run(cardEnter1, 440, 250);
      run(cardEnter2, 440, 305);
      run(tracksEnter, 460, 315);
      run(footerEnter, 460, 365);
    });

    const statusBarTimer = setTimeout(() => setStatusBarReady(true), 560);
    const settleTimer = setTimeout(() => {
      for (const val of [
        canopyEnter,
        mascotEnter,
        heroCopyEnter,
        sectionOneTitleEnter,
        cardEnter0,
        cardEnter1,
        cardEnter2,
        tracksEnter,
        footerEnter,
      ]) {
        val.stopAnimation();
        val.setValue(1);
      }
      setEntranceSettled(true);
    }, 920);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(statusBarTimer);
      clearTimeout(settleTimer);
      anims.forEach((anim) => anim.stop());
    };
  }, [
    canopyEnter,
    cardEnter0,
    cardEnter1,
    cardEnter2,
    footerEnter,
    heroCopyEnter,
    mascotEnter,
    ready,
    reducedMotion,
    sectionOneTitleEnter,
    tracksEnter,
  ]);

  // Smooth glide-in for the 13–15 parental consent card.
  useEffect(() => {
    if (selectedGroup !== '13_15_parental') {
      parentalReveal.setValue(0);
      return undefined;
    }
    if (reducedMotion) {
      parentalReveal.setValue(1);
      return undefined;
    }
    parentalReveal.setValue(0);
    const anim = Animated.timing(parentalReveal, {
      toValue: 1,
      duration: 280,
      easing: SILKY_EASE_OUT,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [parentalReveal, reducedMotion, selectedGroup]);

  // Rewarding subtle spring pop on the badge and CTA the moment the user becomes ready to enter.
  useEffect(() => {
    if (canProceed && !previousCanProceed.current && !reducedMotion) {
      badgePop.stopAnimation();
      ctaPop.stopAnimation();
      badgePop.setValue(0.88);
      ctaPop.setValue(0.97);
      Animated.parallel([
        Animated.spring(badgePop, {
          toValue: 1,
          tension: 290,
          friction: 14,
          useNativeDriver: true,
        }),
        Animated.spring(ctaPop, {
          toValue: 1,
          tension: 260,
          friction: 15,
          useNativeDriver: true,
        }),
      ]).start();
    }
    previousCanProceed.current = canProceed;
  }, [badgePop, canProceed, ctaPop, reducedMotion]);

  // Gentle RenderThread light sheen sweeping across the unlocked Electric-Lime CTA.
  useEffect(() => {
    if (reducedMotion || !canProceed || !entranceSettled || !active || exiting) {
      ctaSheen.stopAnimation();
      ctaSheen.setValue(0);
      return undefined;
    }
    const loop = createNativeLoop(ctaSheen, 3_400);
    loop.start();
    return () => {
      loop.stop();
      ctaSheen.stopAnimation();
    };
  }, [active, canProceed, ctaSheen, entranceSettled, exiting, reducedMotion]);

  const fireMicroSpark = useCallback(() => {
    if (reducedMotion) return;
    celebrateBurst.stopAnimation();
    celebrateBurst.setValue(0);
    Animated.timing(celebrateBurst, {
      toValue: 1,
      duration: 540,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [celebrateBurst, reducedMotion]);

  const clearTapChat = useCallback(() => {
    if (tapChatTimer.current) {
      clearTimeout(tapChatTimer.current);
      tapChatTimer.current = null;
    }
    setTapChatIndex(null);
  }, []);

  const handleMascotTap = useCallback(() => {
    if (exiting) return;
    fireMicroSpark();
    if (tapChatTimer.current) clearTimeout(tapChatTimer.current);
    setTapChatIndex((current) => (current === null ? 0 : (current + 1) % PLAYFUL_TAPS.length));
    tapChatTimer.current = setTimeout(() => setTapChatIndex(null), 3_400);
  }, [exiting, fireMicroSpark]);

  const handleSelectAge = (group: AgeEligibilityGroup) => {
    if (exiting) return;
    Haptics.selection();
    clearTapChat();
    setSelectedGroup(group);
    setMascotNudge((n) => n + 1);
    if (group !== '13_15_parental') {
      setParentalConfirmed(false);
    }
  };

  const handleToggleParental = () => {
    if (exiting) return;
    Haptics.selection();
    clearTapChat();
    setParentalConfirmed((value) => {
      const next = !value;
      if (next) {
        setMascotNudge((n) => n + 1);
        fireMicroSpark();
      }
      return next;
    });
  };

  const handleToggleTrack = (track: StudyTrackId) => {
    if (exiting) return;
    Haptics.selection();
    clearTapChat();
    setSelectedTrack((current) => {
      const next = current === track ? null : track;
      if (next) setMascotNudge((n) => n + 1);
      return next;
    });
  };

  // Choreographed celebratory exit onto the warm cream canvas before Home unfurls.
  const handleSubmit = () => {
    if (!selectedGroup || !canProceed || exitLock.current) return;
    exitLock.current = true;
    clearTapChat();
    Haptics.notification(Haptics.NotificationFeedbackType.Success);

    if (reducedMotion) {
      onConfirm(selectedGroup, selectedTrack);
      return;
    }

    setExiting(true);
    setMascotNudge((n) => n + 1);
    celebrateBurst.stopAnimation();
    celebrateBurst.setValue(0);
    Animated.timing(celebrateBurst, {
      toValue: 1,
      duration: 560,
      easing: SILKY_EASE_OUT,
      useNativeDriver: true,
    }).start();

    const startExitTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(footerExit, {
          toValue: 1,
          duration: 260,
          easing: SILKY_EASE_IN_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(bodyExit, {
          toValue: 1,
          duration: 290,
          delay: 35,
          easing: SILKY_EASE_IN_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(canopyExit, {
          toValue: 1,
          duration: 320,
          delay: 80,
          easing: SILKY_EASE_IN_OUT,
          useNativeDriver: true,
        }),
      ]).start();
    }, 220);

    const handoffTimer = setTimeout(() => {
      onConfirm(selectedGroup, selectedTrack);
    }, 590);

    exitTimers.current.push(startExitTimer, handoffTimer);
  };

  const chosenTrackMeta = selectedTrack
    ? STUDY_TRACKS.find((item) => item.id === selectedTrack) ?? null
    : null;

  // Dynamic Profu companion state reacting to every selection and celebratory exit.
  const companion = useMemo((): { title: string; body: string; pose: MascotPose; tone: SpeechBubbleTone } => {
    if (exiting) {
      return {
        title: 'Gata! Intrăm în studio!',
        body: 'Așez tabla pentru prima ta problemă.',
        pose: 'cheer',
        tone: 'limeSoft',
      };
    }
    if (tapChatIndex !== null) {
      const chat = PLAYFUL_TAPS[tapChatIndex];
      return { title: chat.title, body: chat.body, pose: chat.pose, tone: 'limeSoft' };
    }
    if (selectedGroup === '13_15_parental' && !parentalConfirmed) {
      return {
        title: 'Încă un mic pas!',
        body: 'Bifează acordul părintelui ca să pornim în siguranță.',
        pose: 'point',
        tone: 'peachSoft',
      };
    }
    if (canProceed && chosenTrackMeta) {
      return {
        title: `Profil: ${chosenTrackMeta.shortLabel}!`,
        body: 'Adaptez formulele, testele și simulările pe stilul tău.',
        pose: 'cheer',
        tone: 'limeSoft',
      };
    }
    if (selectedGroup === '16_plus') {
      return {
        title: 'Super! Ești gata.',
        body: 'Poți alege și profilul tău mai jos sau intrăm direct!',
        pose: 'cheer',
        tone: 'limeSoft',
      };
    }
    if (selectedGroup === '13_15_parental' && parentalConfirmed) {
      return {
        title: 'Perfect! Acord confirmat.',
        body: 'Apasă butonul verde și intrăm la rezolvat!',
        pose: 'cheer',
        tone: 'limeSoft',
      };
    }
    if (selectedGroup === 'parent') {
      return {
        title: 'Bine ai venit!',
        body: 'Explicăm clar pas cu pas, fără reclame și fără stres.',
        pose: 'cheer',
        tone: 'limeSoft',
      };
    }
    return {
      title: 'Salut! Ne cunoaștem?',
      body: 'Alege categoria de vârstă și intrăm direct la tablă.',
      pose: 'wave',
      tone: 'paper',
    };
  }, [canProceed, chosenTrackMeta, exiting, parentalConfirmed, selectedGroup, tapChatIndex]);

  // Strictly memoized Fabric-safe native transform interpolations.
  const canopyEnterStyle = useMemo(() => ({
    opacity: canopyEnter.interpolate({
      inputRange: [0, 0.45, 1],
      outputRange: [0.01, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: canopyEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [-62, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [canopyEnter]);

  const canopyExitStyle = useMemo(() => ({
    opacity: canopyExit.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: canopyExit.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -38],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [canopyExit]);

  const mascotEnterStyle = useMemo(() => ({
    opacity: mascotEnter.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.01, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: mascotEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: mascotEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1],
          extrapolate: 'clamp',
        }),
      },
      {
        rotate: mascotEnter.interpolate({
          inputRange: [0, 1],
          outputRange: ['-6deg', '0deg'],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [mascotEnter]);

  const heroCopyEnterStyle = useMemo(() => ({
    opacity: heroCopyEnter.interpolate({
      inputRange: [0, 0.55, 1],
      outputRange: [0.01, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: heroCopyEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [heroCopyEnter]);

  const sectionOneTitleStyle = useMemo(() => ({
    opacity: sectionOneTitleEnter.interpolate({
      inputRange: [0, 0.6, 1],
      outputRange: [0.01, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: sectionOneTitleEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [sectionOneTitleEnter]);

  const tracksEnterStyle = useMemo(() => ({
    opacity: tracksEnter.interpolate({
      inputRange: [0, 0.55, 1],
      outputRange: [0.01, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: tracksEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [tracksEnter]);

  const bodyExitStyle = useMemo(() => ({
    opacity: bodyExit.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: bodyExit.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -20],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: bodyExit.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.965],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [bodyExit]);

  const footerEnterStyle = useMemo(() => ({
    opacity: footerEnter.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.01, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: footerEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [36, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [footerEnter]);

  const footerExitStyle = useMemo(() => ({
    opacity: footerExit.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: footerExit.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 44],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [footerExit]);

  const parentalRevealStyle = useMemo(() => ({
    opacity: parentalReveal.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: parentalReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [-10, 0],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: parentalReveal.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [parentalReveal]);

  const badgePopStyle = useMemo(() => ({
    transform: [{ scale: badgePop }],
  }), [badgePop]);

  const ctaPopStyle = useMemo(() => ({
    transform: [{ scale: ctaPop }],
  }), [ctaPop]);

  const sheenEndX = Math.round(contentWidth + 90);
  const ctaSheenStyle = useMemo(() => ({
    opacity: ctaSheen.interpolate({
      inputRange: [0, 0.08, 0.14, 0.3, 0.36, 1],
      outputRange: [0, 0, 0.5, 0.5, 0, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: ctaSheen.interpolate({
          inputRange: [0, 0.08, 0.36, 1],
          outputRange: [-90, -90, sheenEndX, sheenEndX],
        }),
      },
      { skewX: '-22deg' },
    ],
  }), [ctaSheen, sheenEndX]);

  const celebrateRippleStyle = useMemo(() => ({
    opacity: celebrateBurst.interpolate({
      inputRange: [0, 0.16, 0.78, 1],
      outputRange: [0, 0.85, 0.2, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        scale: celebrateBurst.interpolate({
          inputRange: [0, 1],
          outputRange: [0.68, 1.48],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [celebrateBurst]);

  const sparkStyles = useMemo(() => CELEBRATION_SPARKS.map((spark) => ({
    opacity: celebrateBurst.interpolate({
      inputRange: [0, 0.16, 0.68, 1],
      outputRange: [0, 1, 0.88, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: celebrateBurst.interpolate({
          inputRange: [0, 1],
          outputRange: [0, spark.dx],
          extrapolate: 'clamp',
        }),
      },
      {
        translateY: celebrateBurst.interpolate({
          inputRange: [0, 1],
          outputRange: [0, spark.dy],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: celebrateBurst.interpolate({
          inputRange: [0, 0.3, 1],
          outputRange: [0.3, 1.18, 0.72],
          extrapolate: 'clamp',
        }),
      },
      {
        rotate: celebrateBurst.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', spark.rotate],
          extrapolate: 'clamp',
        }),
      },
    ],
  })), [celebrateBurst]);

  const hardwareEntranceLayer = !entranceSettled && !reducedMotion;
  const mascotSize = compact ? 76 : 92;
  const spotlightSize = compact ? 74 : 90;

  return (
    <View
      pointerEvents={exiting ? 'none' : 'auto'}
      style={styles.safe}
    >
      {statusBarReady ? <StatusBar style="light" /> : null}
      <ComicBackdrop />

      {/* Full-bleed curved Royal-Violet hero canopy unfurling seamlessly from Splash */}
      <Animated.View
        renderToHardwareTextureAndroid={hardwareEntranceLayer}
        style={[styles.canopyExitWrap, canopyExitStyle]}
      >
        <Animated.View
          style={[
            styles.canopy,
            compact && styles.canopyCompact,
            { paddingTop: insets.top ?? 0 },
            canopyEnterStyle,
          ]}
        >
          <LinearGradient
            colors={['#8F44FF', '#601EE8', '#360CA0']}
            start={{ x: 0.06, y: 0 }}
            end={{ x: 0.94, y: 1 }}
            style={styles.fill}
          />
          <View pointerEvents="none" style={styles.canopyGlowCyan} />
          <View pointerEvents="none" style={styles.canopyGlowLime} />
          <View pointerEvents="none" style={styles.canopyGlowPeach} />
          <View pointerEvents="none" style={styles.canopyOrbitOuter} />
          <View pointerEvents="none" style={styles.canopyOrbitInner} />
          <Text accessible={false} style={styles.canopyGlyphPi}>π</Text>
          <Text accessible={false} style={styles.canopyGlyphRoot}>√</Text>
          <Text accessible={false} style={styles.canopyGlyphSum}>∑</Text>
          <View pointerEvents="none" style={styles.canopyBottomRim} />

          <View style={[styles.canopyInner, { width: contentWidth }]}>
            {/* Top brand strip + live readiness badge */}
            <Animated.View style={[styles.brandBar, heroCopyEnterStyle]}>
              <View style={styles.brandIdentity}>
                <View style={styles.brandMark}>
                  <Image
                    accessible={false}
                    source={bundledImageSource(require('../../../../assets/brand/profu_mark_v2.png'))}
                    resizeMode="contain"
                    fadeDuration={0}
                    style={styles.brandMarkImage}
                  />
                </View>
                <Text
                  maxFontSizeMultiplier={1.2}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  style={styles.brandTitle}
                >
                  Profu’ <Text style={styles.brandTitleAccent}>de mate</Text>
                </Text>
              </View>

              <Animated.View
                style={[
                  styles.statusBadge,
                  canProceed && styles.statusBadgeReady,
                  badgePopStyle,
                ]}
              >
                <Text
                  maxFontSizeMultiplier={1.08}
                  style={[styles.statusBadgeText, canProceed && styles.statusBadgeTextReady]}
                >
                  {exiting ? '✦ PORNIM!' : canProceed ? '✦ GATA DE START' : '✦ BUN VENIT'}
                </Text>
              </Animated.View>
            </Animated.View>

            {/* Live Profu companion row mirroring Home's sky speech dialogue & spotlight mascot */}
            <View style={[styles.heroRow, compact && styles.heroRowCompact]}>
              <Animated.View style={[styles.heroBubbleWrap, heroCopyEnterStyle]}>
                <SpeechBubble
                  variant="sky"
                  title={companion.title}
                  body={companion.body}
                  tone={companion.tone}
                  tail="none"
                  compact={compact}
                  messageKey={`${companion.title}:${companion.body}`}
                  onPress={handleMascotTap}
                />
              </Animated.View>

              <Animated.View
                style={[
                  styles.mascotWrap,
                  { width: mascotSize + 8, height: mascotSize + 6 },
                  mascotEnterStyle,
                ]}
              >
                <SpotlightAura size={spotlightSize} tone="onViolet" active={active && entranceSettled && !exiting} />
                <View pointerEvents="none" style={styles.mascotFloorGlow} />
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.celebrateRipple,
                    { width: spotlightSize, height: spotlightSize, borderRadius: spotlightSize / 2 },
                    celebrateRippleStyle,
                  ]}
                />
                {CELEBRATION_SPARKS.map((spark, index) => (
                  <Animated.View
                    key={`${spark.symbol}-${index}`}
                    pointerEvents="none"
                    style={[styles.celebrateSparkAnchor, sparkStyles[index]]}
                  >
                    <Text
                      accessible={false}
                      style={[
                        styles.celebrateSparkGlyph,
                        { color: spark.color, fontSize: spark.size, lineHeight: spark.size + 3 },
                      ]}
                    >
                      {spark.symbol}
                    </Text>
                  </Animated.View>
                ))}
                <Mascot
                  pose={companion.pose}
                  size={mascotSize}
                  active={active && entranceSettled}
                  interactive={!exiting}
                  nudgeSignal={mascotNudge}
                  onPress={handleMascotTap}
                />
              </Animated.View>
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Main setup workspace */}
      <Animated.View style={[styles.scrollExitWrap, bodyExitStyle]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          scrollEnabled={!exiting}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            compact && styles.scrollContentCompact,
            { paddingHorizontal: gutter },
          ]}
        >
          <View style={[styles.page, compact && styles.pageCompact, { maxWidth: contentWidth }]}>
            {/* Step 1: Age eligibility (privacy-minimized — never asks for date of birth) */}
            <View style={styles.section}>
              <Animated.View style={[styles.sectionHeader, sectionOneTitleStyle]}>
                <View style={styles.sectionTitleGroup}>
                  <View style={[styles.stepNumberPill, canProceed && styles.stepNumberPillDone]}>
                    {canProceed ? (
                      <MiniGlyph name="check" size={10} color={colors.ink} />
                    ) : (
                      <Text maxFontSizeMultiplier={1.05} style={styles.stepNumberText}>1</Text>
                    )}
                  </View>
                  <Text maxFontSizeMultiplier={1.15} style={styles.sectionKicker}>
                    CINE FOLOSEȘTE APLICAȚIA?
                  </Text>
                </View>
                <View style={[styles.requiredPill, canProceed && styles.requiredPillDone]}>
                  <Text
                    maxFontSizeMultiplier={1.05}
                    style={[styles.requiredPillText, canProceed && styles.requiredPillTextDone]}
                  >
                    {canProceed ? 'CONFIRMAT' : 'NECESAR'}
                  </Text>
                </View>
              </Animated.View>

              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Alege categoria de vârstă"
                style={styles.ageGrid}
              >
                {AGE_OPTIONS.map((option, index) => (
                  <AgeOptionCard
                    key={option.id}
                    option={option}
                    selected={selectedGroup === option.id}
                    disabled={exiting}
                    compact={compact}
                    reducedMotion={reducedMotion}
                    enterProgress={cardEnters[index]}
                    onPress={() => handleSelectAge(option.id)}
                  />
                ))}
              </View>

              {selectedGroup === '13_15_parental' ? (
                <Animated.View style={parentalRevealStyle}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: parentalConfirmed, disabled: exiting }}
                    disabled={exiting}
                    onPress={handleToggleParental}
                    style={({ pressed }) => [
                      styles.parentalBox,
                      parentalConfirmed && styles.parentalBoxChecked,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.checkbox, parentalConfirmed && styles.checkboxChecked]}>
                      {parentalConfirmed ? <MiniGlyph name="check" size={13} color={colors.ink} /> : null}
                    </View>
                    <Text maxFontSizeMultiplier={1.2} style={styles.parentalText}>
                      Confirm că am acordul părintelui sau tutorelui legal pentru a folosi Profu’ de mate, inclusiv analiza AI.
                    </Text>
                  </Pressable>
                </Animated.View>
              ) : null}

              <Animated.View style={sectionOneTitleStyle}>
                <Text maxFontSizeMultiplier={1.15} style={styles.ageNote}>
                  Pentru elevi de cel puțin 13 ani și părinți · sub 13 ani doar împreună cu un părinte.
                </Text>
              </Animated.View>
            </View>

            {/* Step 2: Optional curriculum personalization + privacy assurance */}
            <Animated.View
              renderToHardwareTextureAndroid={hardwareEntranceLayer}
              style={[styles.lowerCluster, tracksEnterStyle]}
            >
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleGroup}>
                    <View style={[styles.stepNumberPill, styles.stepNumberPillSoft, selectedTrack && styles.stepNumberPillDone]}>
                      {selectedTrack ? (
                        <MiniGlyph name="check" size={10} color={colors.ink} />
                      ) : (
                        <Text maxFontSizeMultiplier={1.05} style={styles.stepNumberTextSoft}>2</Text>
                      )}
                    </View>
                    <Text maxFontSizeMultiplier={1.15} style={styles.sectionKicker}>
                      PENTRU CE TE PREGĂTEȘTI?
                    </Text>
                  </View>
                  <View style={styles.optionalPill}>
                    <Text maxFontSizeMultiplier={1.05} style={styles.optionalPillText}>OPȚIONAL</Text>
                  </View>
                </View>

                <View style={styles.tracksWrap}>
                  {TRACK_CHIPS.map((item) => {
                    const activeTrack = selectedTrack === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: activeTrack, disabled: exiting }}
                        disabled={exiting}
                        onPress={() => handleToggleTrack(item.id)}
                        style={({ pressed }) => [
                          styles.trackChip,
                          activeTrack && styles.trackChipActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        {activeTrack ? (
                          <View style={styles.trackCheckDot}>
                            <MiniGlyph name="check" size={10} color={colors.ink} />
                          </View>
                        ) : (
                          <View style={[styles.trackAccentDot, { backgroundColor: item.dot }]} />
                        )}
                        <Text
                          maxFontSizeMultiplier={1.15}
                          numberOfLines={1}
                          style={[styles.trackChipText, activeTrack && styles.trackChipTextActive]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text maxFontSizeMultiplier={1.15} style={styles.trackHint}>
                  {chosenTrackMeta
                    ? `Adaptăm formulele, testele și simulările pentru ${chosenTrackMeta.shortLabel}.`
                    : 'Poți alege acum sau mai târziu din aplicație — formulele și simulările se adaptează instant.'}
                </Text>
              </View>

              {/* Compact privacy & safety reassurance */}
              <View style={styles.safetyBar}>
                <View style={styles.safetyIcon}>
                  <AppIcon name="privacy" size={22} />
                </View>
                <Text maxFontSizeMultiplier={1.15} style={styles.safetyText}>
                  Nu cerem data nașterii. Fotografiază doar probleme de matematică, fără fețe sau date personale.
                </Text>
              </View>
            </Animated.View>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Elevated CTA footer rising smoothly on entrance and gliding out on confirm */}
      <Animated.View style={[styles.footerExitWrap, footerExitStyle]}>
        <Animated.View
          renderToHardwareTextureAndroid={hardwareEntranceLayer}
          style={[
            styles.footer,
            { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 12) },
            footerEnterStyle,
          ]}
        >
          <View style={[styles.footerInner, { maxWidth: contentWidth }]}>
            <Animated.View style={[styles.ctaWrap, ctaPopStyle]}>
              <ComicButton
                title={exiting ? 'Pregătim studioul…' : 'Începe să rezolvi'}
                tone="lime"
                trailingIcon={exiting ? 'check' : 'next'}
                compact
                disabled={!canProceed || exiting}
                accessibilityHint="Confirmă selecția și intră în aplicație"
                onPress={handleSubmit}
              />
              {canProceed && !exiting && !reducedMotion ? (
                <View pointerEvents="none" style={styles.ctaSheenClip}>
                  <Animated.View style={[styles.ctaSheenBar, ctaSheenStyle]} />
                </View>
              ) : null}
            </Animated.View>

            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Citește Termenii și Politica de confidențialitate"
              disabled={exiting}
              onPress={() => {
                Haptics.selection();
                onOpenLegal();
              }}
              style={({ pressed }) => [styles.legalBtn, pressed && styles.pressed]}
            >
              <Text maxFontSizeMultiplier={1.15} style={styles.legalText}>
                Continuând, accepți <Text style={styles.legalLink}>Termenii și Confidențialitatea</Text>.
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  scrollExitWrap: { flex: 1, minHeight: 0 },
  scroll: { flex: 1 },
  canopyExitWrap: { zIndex: 4 },
  footerExitWrap: { zIndex: 5 },

  canopy: {
    width: '100%',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    paddingBottom: 18,
    position: 'relative',
  },
  canopyCompact: {
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    paddingBottom: 13,
  },
  canopyGlowCyan: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -102,
    left: -58,
    backgroundColor: 'rgba(67, 214, 230, 0.24)',
  },
  canopyGlowLime: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    bottom: -104,
    right: -14,
    backgroundColor: 'rgba(216, 255, 62, 0.18)',
  },
  canopyGlowPeach: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    top: 12,
    right: '36%',
    backgroundColor: 'rgba(255, 141, 107, 0.12)',
  },
  canopyOrbitOuter: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
    borderWidth: 1.25,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    top: -128,
    right: -84,
  },
  canopyOrbitInner: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1,
    borderColor: 'rgba(216, 255, 62, 0.14)',
    bottom: -90,
    left: -46,
  },
  canopyGlyphPi: {
    position: 'absolute',
    left: 18,
    bottom: 12,
    fontFamily: fonts.display,
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.11)',
    transform: [{ rotate: '-12deg' }],
  },
  canopyGlyphRoot: {
    position: 'absolute',
    right: 122,
    top: 42,
    fontFamily: fonts.display,
    fontSize: 22,
    color: 'rgba(216, 255, 62, 0.2)',
    transform: [{ rotate: '12deg' }],
  },
  canopyGlyphSum: {
    position: 'absolute',
    left: '44%',
    bottom: 8,
    fontFamily: fonts.display,
    fontSize: 19,
    color: 'rgba(67, 214, 230, 0.18)',
    transform: [{ rotate: '-6deg' }],
  },
  canopyBottomRim: {
    position: 'absolute',
    left: 28,
    right: 28,
    bottom: 1,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  canopyInner: {
    alignSelf: 'center',
    paddingTop: 10,
    gap: 10,
  },
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  brandIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.4,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandMarkImage: {
    width: 24,
    height: 24,
  },
  brandTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 24,
    color: colors.paper,
    letterSpacing: -0.25,
    textShadowColor: 'rgba(18, 6, 62, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  brandTitleAccent: {
    color: colors.lime,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(216, 255, 62, 0.18)',
    borderWidth: 1.2,
    borderColor: 'rgba(216, 255, 62, 0.5)',
    flexShrink: 0,
  },
  statusBadgeReady: {
    backgroundColor: colors.lime,
    borderColor: '#FFFFFF',
  },
  statusBadgeText: {
    ...typography.kicker,
    fontSize: 9.5,
    lineHeight: 12,
    color: colors.lime,
    includeFontPadding: false,
  },
  statusBadgeTextReady: {
    color: colors.ink,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroRowCompact: {
    gap: 8,
  },
  heroBubbleWrap: {
    flex: 1,
    minWidth: 0,
  },
  mascotWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  mascotFloorGlow: {
    position: 'absolute',
    bottom: 2,
    width: 58,
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(20, 6, 66, 0.28)',
  },
  celebrateRipple: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: colors.lime,
  },
  celebrateSparkAnchor: {
    position: 'absolute',
  },
  celebrateSparkGlyph: {
    fontFamily: fonts.display,
    includeFontPadding: false,
  },

  scrollContent: {
    paddingTop: 18,
    paddingBottom: 14,
  },
  scrollContentCompact: {
    paddingTop: 13,
    paddingBottom: 10,
  },
  page: {
    width: '100%',
    alignSelf: 'center',
    gap: 18,
  },
  pageCompact: {
    gap: 13,
  },
  lowerCluster: {
    gap: 14,
  },

  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 1,
    minWidth: 0,
  },
  stepNumberPill: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumberPillSoft: {
    backgroundColor: colors.violetSoft,
  },
  stepNumberPillDone: {
    backgroundColor: colors.lime,
    borderWidth: 1.2,
    borderColor: '#8BB509',
  },
  stepNumberText: {
    fontFamily: fonts.display,
    fontSize: 11,
    lineHeight: 13,
    color: colors.paper,
    includeFontPadding: false,
  },
  stepNumberTextSoft: {
    fontFamily: fonts.display,
    fontSize: 11,
    lineHeight: 13,
    color: colors.violetDeep,
    includeFontPadding: false,
  },
  sectionKicker: {
    ...typography.kicker,
    fontSize: 10.8,
    color: colors.violetDeep,
  },
  requiredPill: {
    paddingHorizontal: 8.5,
    paddingVertical: 2.5,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
  },
  requiredPillDone: {
    backgroundColor: colors.limeSoft,
  },
  requiredPillText: {
    ...typography.kicker,
    fontSize: 8.5,
    lineHeight: 11,
    color: colors.violetDeep,
  },
  requiredPillTextDone: {
    color: colors.limeDeep,
  },
  optionalPill: {
    paddingHorizontal: 8.5,
    paddingVertical: 2.5,
    borderRadius: radii.pill,
    backgroundColor: '#F3EEFF',
  },
  optionalPillText: {
    ...typography.kicker,
    fontSize: 8.5,
    lineHeight: 11,
    color: colors.inkMuted,
  },

  ageGrid: {
    flexDirection: 'row',
    gap: 9,
  },
  ageCardCol: {
    flex: 1,
    minWidth: 0,
  },
  ageCard: {
    minHeight: 114,
    borderRadius: 22,
    borderWidth: 1.4,
    borderBottomWidth: 4,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 11,
    justifyContent: 'space-between',
    gap: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  ageCardCompact: {
    minHeight: 100,
    borderRadius: 19,
    paddingHorizontal: 9,
    paddingVertical: 9,
    gap: 6,
  },
  ageCardSelected: {
    borderColor: '#A675FF',
    borderBottomColor: '#360EA0',
    backgroundColor: colors.violet,
  },
  ageCardGlowLime: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    bottom: -48,
    right: -28,
    backgroundColor: 'rgba(216, 255, 62, 0.2)',
  },
  ageCardShine: {
    position: 'absolute',
    top: 1.5,
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  ageCardShineSelected: {
    position: 'absolute',
    top: 1.5,
    left: 14,
    right: 14,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
  },
  ageCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  ageIconMedallion: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageIconMedallionCompact: {
    width: 34,
    height: 34,
    borderRadius: 12,
  },
  ageIconMedallionSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(216, 255, 62, 0.9)',
  },
  ageCheck: {
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: colors.lime,
    borderWidth: 1.4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageRadioEmpty: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.6,
    borderColor: '#D4C5F5',
    backgroundColor: '#FAF7FF',
  },
  ageCopy: {
    gap: 1.5,
  },
  ageTitle: {
    fontFamily: fonts.display,
    fontSize: 16.5,
    lineHeight: 20,
    color: colors.ink,
  },
  ageTitleCompact: {
    fontSize: 15,
    lineHeight: 18.5,
  },
  ageTitleSelected: {
    color: colors.paper,
  },
  ageSubtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.inkSoft,
  },
  ageSubtitleSelected: {
    color: 'rgba(244, 238, 255, 0.92)',
  },

  parentalBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 13,
    borderRadius: 20,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: '#A9EAF2',
    borderBottomColor: '#6FD4E2',
    backgroundColor: '#EFFDFE',
  },
  parentalBoxChecked: {
    borderColor: '#A8DC2B',
    borderBottomColor: '#7EA508',
    backgroundColor: '#F4FFCC',
  },
  checkbox: {
    width: 23,
    height: 23,
    borderRadius: 8,
    borderWidth: 1.8,
    borderColor: colors.cyanDeep,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    borderColor: '#7EA508',
    backgroundColor: colors.lime,
  },
  parentalText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 12.5,
    lineHeight: 17.5,
  },
  ageNote: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 15.5,
    color: colors.inkMuted,
  },

  tracksWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trackChip: {
    minHeight: 39,
    borderRadius: radii.pill,
    borderWidth: 1.3,
    borderBottomWidth: 3.2,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6.5,
  },
  trackChipActive: {
    borderColor: '#9960FF',
    borderBottomColor: '#3C12A8',
    backgroundColor: colors.violet,
  },
  trackAccentDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  trackCheckDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackChipText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    lineHeight: 16,
    color: colors.ink,
    includeFontPadding: false,
  },
  trackChipTextActive: {
    color: colors.paper,
  },
  trackHint: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.inkSoft,
  },

  safetyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 20,
    borderWidth: 1.3,
    borderBottomWidth: 3,
    borderColor: '#E5DCFF',
    borderBottomColor: '#D6C8FA',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  safetyIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  safetyText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11.8,
    lineHeight: 16.2,
    color: colors.inkSoft,
  },

  footer: {
    paddingTop: 10,
    backgroundColor: colors.canvas,
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 60, 255, 0.09)',
  },
  footerInner: {
    width: '100%',
    alignSelf: 'center',
    gap: 6,
  },
  ctaWrap: {
    position: 'relative',
  },
  ctaSheenClip: {
    position: 'absolute',
    top: 2,
    right: 2,
    bottom: 5,
    left: 2,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  ctaSheenBar: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    width: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.56)',
  },
  legalBtn: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  legalText: {
    fontFamily: fonts.body,
    fontSize: 11.8,
    lineHeight: 16,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  legalLink: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
});
