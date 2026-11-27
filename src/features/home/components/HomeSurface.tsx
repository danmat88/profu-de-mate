import { LinearGradient } from 'expo-linear-gradient';
import { memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { computeHeroGeometry } from '../../../shared/layout/heroGeometry';
import {
  cosinePingPongRange,
  cosinePulseRange,
  createNativeLoop,
  SILKY_EASE_OUT,
  WAVE_INPUT_17,
} from '../../../shared/motion/nativeMotion';
import { bundledImageSource } from '../../../shared/services/bundledImages';
import { colors, fonts, radii } from '../../../shared/theme';
import type { FlowMode } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { CachedInsetRelief, CachedOutsetShadow, CachedSurface } from '../../../shared/ui/CachedRelief';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { Enter } from '../../../shared/ui/Enter';
import { IconButton } from '../../../shared/ui/IconButton';
import { Mascot, type MascotPose } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { MissionCardBackdrop, ROYAL_HERO_GRADIENT, RoyalHeroCanopyBackdrop, StudioCardBackdrop } from '../../../shared/ui/RoyalHeroCanopyBackdrop';
import { SegmentedToggle, type SegmentedOption } from '../../../shared/ui/SegmentedToggle';
import { SpeechBubble, type SpeechBubbleTone } from '../../../shared/ui/SpeechBubble';
import { SpotlightAura, type SpotlightAuraTone } from '../../../shared/ui/SpotlightAura';
import { Text } from '../../../shared/ui/Typography';
import { ComicClockIcon, HomeResetPillNote } from '../../access/components/QuotaResetTimer';
import type { AllowancePresentation } from '../../access/utils/commercialPresentation';
import { HomeMotionReadyContext } from '../context/HomeMotionContext';

type Props = {
  mode: FlowMode;
  focused?: boolean;
  pending: boolean;
  pendingKind?: 'photo' | 'written' | null;
  galleryBusy: boolean;
  galleryError: string | null;
  allowance: AllowancePresentation;
  resetAt?: string | null;
  remaining?: number;
  limit?: number;
  premiumActive?: boolean;
  latestLessonTitle?: string | null;
  savedLessonsCount?: number;
  studyTrackLabel?: string;
  studyTrackChosen?: boolean;
  streakDays?: number;
  wrongCount?: number;
  showGuide?: boolean;
  embedded?: boolean;
  animateSkyDome?: boolean;
  bottomClearance?: number;
  onDismissGuide?: () => void;
  onClearGalleryError?: () => void;
  onDiscardPending?: () => void;
  onMode: (mode: FlowMode) => void;
  onCapture: () => void;
  onGallery: () => void;
  onMath: () => void;
  onNotebook: () => void;
  onStudy?: () => void;
  onChooseStudyTrack?: () => void;
  onQuickPractice?: () => void;
  onSettings: () => void;
  onAllowance: () => void;
};

const SHADOWS = {
  headerOutset: '0 4px 8px -1px rgba(20, 4, 66, 0.24), 0 1px 3px rgba(20, 4, 66, 0.16)',
  logoInset: 'inset 0 2px 4px rgba(255, 255, 255, 0.96), inset 0 -3px 5px rgba(82, 24, 210, 0.16)',
  trackOutset: '0 4px 8px -1px rgba(20, 4, 66, 0.20), 0 1px 3px rgba(20, 4, 66, 0.14)',
  trackInset: 'inset 0 2px 4px rgba(255, 255, 255, 0.48), inset 0 -3px 5px rgba(22, 5, 72, 0.26)',
  allowanceInset: 'inset 0 2.5px 4px rgba(255, 255, 255, 0.98), inset 0 -4px 7px rgba(102, 58, 214, 0.20)',
  allowanceInsetPremium: 'inset 0 2.5px 4px rgba(255, 255, 240, 0.98), inset 0 -4px 7px rgba(108, 152, 0, 0.24)',
  allowanceInsetExhausted: 'inset 0 2.5px 4px rgba(255, 255, 255, 0.98), inset 0 -4px 7px rgba(212, 92, 62, 0.22)',
  stageOutsetSolve: '0 6px 12px -3px rgba(58, 18, 168, 0.14), 0 2px 5px -1px rgba(58, 18, 168, 0.08)',
  stageOutsetCheck: '0 6px 12px -3px rgba(168, 28, 84, 0.14), 0 2px 5px -1px rgba(168, 28, 84, 0.08)',
  stageInsetSolve: 'inset 0 2.5px 5px rgba(255, 255, 255, 0.98), inset 0 -6px 12px rgba(108, 66, 216, 0.12)',
  stageInsetCheck: 'inset 0 2.5px 5px rgba(255, 255, 255, 0.98), inset 0 -6px 12px rgba(196, 36, 98, 0.12)',
  eyebrowSolve: '0 2px 5px -1px rgba(72, 26, 184, 0.12), inset 0 1.5px 2.5px rgba(255, 255, 255, 0.98), inset 0 -2px 3.5px rgba(114, 62, 232, 0.13)',
  eyebrowCheck: '0 2px 5px -1px rgba(180, 26, 86, 0.12), inset 0 1.5px 2.5px rgba(255, 255, 255, 0.98), inset 0 -2px 3.5px rgba(214, 38, 102, 0.13)',
  eyebrowPending: '0 2px 5px -1px rgba(86, 120, 0, 0.14), inset 0 1.5px 2.5px rgba(255, 255, 255, 0.98), inset 0 -2px 3.5px rgba(110, 154, 0, 0.14)',
  scopeSolve: '0 2px 5px -1px rgba(72, 26, 184, 0.10), inset 0 1.5px 2.5px rgba(255, 255, 255, 1), inset 0 -2px 3.5px rgba(120, 74, 224, 0.10)',
  scopeCheck: '0 2px 5px -1px rgba(176, 26, 86, 0.10), inset 0 1.5px 2.5px rgba(255, 255, 255, 1), inset 0 -2px 3.5px rgba(210, 42, 102, 0.10)',
  scopePending: '0 2px 5px -1px rgba(86, 120, 0, 0.12), inset 0 1.5px 2.5px rgba(255, 255, 255, 1), inset 0 -2px 3.5px rgba(110, 154, 0, 0.12)',
  lensOutsetSolve: '0 5px 10px -2px rgba(68, 18, 192, 0.28), 0 2px 4px rgba(40, 8, 126, 0.16)',
  lensOutsetCheck: '0 5px 10px -2px rgba(178, 22, 82, 0.28), 0 2px 4px rgba(120, 12, 54, 0.16)',
  lensInset: 'inset 0 3px 6px rgba(255, 255, 255, 0.44), inset 0 -5px 10px rgba(18, 4, 68, 0.44)',
  lensPlate: '0 3px 6px rgba(20, 4, 66, 0.24), inset 0 2px 3px rgba(255, 255, 255, 1), inset 0 -3px 5px rgba(96, 48, 220, 0.16)',
  ctaOutsetSolve: '0 5px 10px -2px rgba(108, 152, 0, 0.32), 0 2px 4px rgba(82, 118, 0, 0.18)',
  ctaOutsetCheck: '0 5px 10px -2px rgba(186, 118, 0, 0.30), 0 2px 4px rgba(154, 92, 0, 0.16)',
  ctaInsetSolve: 'inset 0 3.5px 6px rgba(255, 255, 236, 0.85), inset 0 -5px 9px rgba(80, 116, 0, 0.36)',
  ctaInsetCheck: 'inset 0 3.5px 6px rgba(255, 252, 232, 0.88), inset 0 -5px 9px rgba(162, 92, 0, 0.34)',
  ctaBadge: '0 2px 4px rgba(68, 98, 0, 0.18), inset 0 1.5px 2px rgba(255, 255, 255, 1), inset 0 -2px 3px rgba(86, 120, 0, 0.14)',
  ctaArrow: '0 2px 4px rgba(23, 19, 55, 0.24), inset 0 1.5px 2px rgba(255, 255, 255, 0.22), inset 0 -2px 3px rgba(6, 4, 22, 0.4)',
  splitOutsetCyan: '0 4px 8px -2px rgba(11, 130, 158, 0.16), 0 1px 3px rgba(11, 130, 158, 0.09)',
  splitOutsetAmber: '0 4px 8px -2px rgba(176, 114, 0, 0.16), 0 1px 3px rgba(176, 114, 0, 0.09)',
  splitOutsetDiscard: '0 4px 8px -2px rgba(184, 42, 70, 0.15), 0 1px 3px rgba(184, 42, 70, 0.08)',
  splitInsetCyan: 'inset 0 2.5px 4px rgba(255, 255, 255, 0.98), inset 0 -4px 7px rgba(14, 146, 178, 0.19)',
  splitInsetAmber: 'inset 0 2.5px 4px rgba(255, 255, 255, 0.98), inset 0 -4px 7px rgba(202, 136, 0, 0.21)',
  splitInsetDiscard: 'inset 0 2.5px 4px rgba(255, 255, 255, 0.98), inset 0 -4px 7px rgba(204, 62, 74, 0.18)',
  splitIconCyan: '0 2px 4px rgba(11, 128, 156, 0.13), inset 0 1.5px 2px rgba(255, 255, 255, 1), inset 0 -2px 3px rgba(14, 146, 178, 0.12)',
  splitIconAmber: '0 2px 4px rgba(178, 118, 0, 0.13), inset 0 1.5px 2px rgba(255, 255, 255, 1), inset 0 -2px 3px rgba(196, 132, 0, 0.13)',
  splitIconDiscard: '0 2px 4px rgba(190, 44, 72, 0.12), inset 0 1.5px 2px rgba(255, 255, 255, 1), inset 0 -2px 3px rgba(200, 56, 74, 0.12)',
  questOutsetQuiz: '0 6px 12px -3px rgba(12, 126, 96, 0.15), 0 2px 5px -1px rgba(12, 126, 96, 0.08)',
  questOutsetSetup: '0 6px 12px -3px rgba(180, 114, 0, 0.16), 0 2px 5px -1px rgba(180, 114, 0, 0.09)',
  questOutsetMistakes: '0 6px 12px -3px rgba(192, 28, 86, 0.15), 0 2px 5px -1px rgba(192, 28, 86, 0.08)',
  questInsetQuiz: 'inset 0 2.5px 5px rgba(255, 255, 255, 0.98), inset 0 -5px 9px rgba(14, 166, 127, 0.18)',
  questInsetSetup: 'inset 0 2.5px 5px rgba(255, 255, 255, 0.98), inset 0 -5px 9px rgba(212, 144, 0, 0.22)',
  questInsetMistakes: 'inset 0 2.5px 5px rgba(255, 255, 255, 0.98), inset 0 -5px 9px rgba(214, 34, 92, 0.18)',
  questMetaQuiz: '0 2px 5px -1px rgba(12, 126, 96, 0.12), inset 0 1.5px 2px rgba(255, 255, 255, 0.96), inset 0 -2px 3px rgba(14, 166, 127, 0.13)',
  questMetaSetup: '0 2px 5px -1px rgba(180, 118, 0, 0.13), inset 0 1.5px 2px rgba(255, 255, 255, 0.96), inset 0 -2px 3px rgba(212, 144, 0, 0.15)',
  questMetaMistakes: '0 2px 5px -1px rgba(196, 30, 88, 0.12), inset 0 1.5px 2px rgba(255, 255, 255, 0.96), inset 0 -2px 3px rgba(214, 34, 92, 0.13)',
  questInfoQuiz: '0 2px 5px -1px rgba(12, 126, 96, 0.10), inset 0 1.5px 2px rgba(255, 255, 255, 1), inset 0 -2px 3px rgba(14, 166, 127, 0.10)',
  questInfoSetup: '0 2px 5px -1px rgba(180, 118, 0, 0.11), inset 0 1.5px 2px rgba(255, 255, 255, 1), inset 0 -2px 3px rgba(212, 144, 0, 0.12)',
  questInfoMistakes: '0 2px 5px -1px rgba(196, 30, 88, 0.10), inset 0 1.5px 2px rgba(255, 255, 255, 1), inset 0 -2px 3px rgba(214, 34, 92, 0.10)',
  questOrbQuiz: '0 3px 6px -1px rgba(12, 125, 96, 0.15), inset 0 2px 3px rgba(255, 255, 255, 1), inset 0 -3px 5px rgba(14, 166, 127, 0.14)',
  questOrbSetup: '0 3px 6px -1px rgba(181, 116, 0, 0.16), inset 0 2px 3px rgba(255, 255, 255, 1), inset 0 -3px 5px rgba(212, 144, 0, 0.16)',
  questOrbMistakes: '0 3px 6px -1px rgba(196, 31, 88, 0.15), inset 0 2px 3px rgba(255, 255, 255, 1), inset 0 -3px 5px rgba(214, 34, 92, 0.15)',
  questActionQuiz: '0 4px 8px -2px rgba(8, 130, 98, 0.34), 0 1px 3px rgba(6, 102, 77, 0.18)',
  questActionSetup: '0 4px 8px -2px rgba(198, 116, 0, 0.36), 0 1px 3px rgba(154, 84, 0, 0.18)',
  questActionMistakes: '0 4px 8px -2px rgba(192, 20, 74, 0.34), 0 1px 3px rgba(148, 14, 58, 0.18)',
  questActionInset: 'inset 0 2.5px 4px rgba(255, 255, 255, 0.48), inset 0 -4px 7px rgba(0, 0, 0, 0.24)',
} as const;

const modeOptions: readonly [SegmentedOption<FlowMode>, SegmentedOption<FlowMode>] = [
  {
    value: 'solve',
    label: 'Rezolvă',
    subtitle: 'Explică pas cu pas',
    icon: 'scan',
    activeFill: colors.violet,
    activeGradient: ['#8E49FF', '#6520EC', '#4410B4'],
    activeText: colors.paper,
    dotFill: colors.lime,
    dotText: colors.ink,
  },
  {
    value: 'check',
    label: 'Verifică',
    subtitle: 'Enunț + rezolvare',
    icon: 'verify',
    activeFill: '#E63876',
    activeGradient: ['#FF7B63', '#E63876', '#B5175B'],
    activeText: colors.paper,
    dotFill: colors.gold,
    dotText: colors.ink,
  },
];

type TutorMessage = {
  title: string;
  body: string;
  compactBody: string;
  pose: MascotPose;
  tone: SpeechBubbleTone;
};

const LAST_PROBLEM_MESSAGE: TutorMessage = {
  title: 'Ultima problemă pe azi!',
  body: 'Alege una bună — revin la 00:00.',
  compactBody: 'Ultima pe azi — revin la 00:00.',
  pose: 'point',
  tone: 'peachSoft',
};

const SOLVE_CHEER_MESSAGES: readonly TutorMessage[] = [
  { title: 'Hai că poți!', body: 'Fiecare problemă devine clară pas cu pas.', compactBody: 'Clar, pas cu pas.', pose: 'cheer', tone: 'limeSoft' },
  { title: 'E mai simplu decât pare!', body: 'Fă o poză sau scrie enunțul direct.', compactBody: 'Fă o poză sau scrie enunțul.', pose: 'point', tone: 'limeSoft' },
  { title: 'Sunt aici cu tine!', body: 'Îți explic pe înțeles, fără grabă.', compactBody: 'Îți explic simplu, fără grabă.', pose: 'wave', tone: 'paper' },
  { title: 'Nivel de campion!', body: 'Un exercițiu pe zi face diferența.', compactBody: 'Un exercițiu pe zi contează.', pose: 'cheer', tone: 'limeSoft' },
];

const CHECK_CHEER_MESSAGES: readonly TutorMessage[] = [
  { title: 'Bravo că încerci întâi!', body: 'Așa înveți cel mai repede la mate.', compactBody: 'Așa înveți cel mai repede.', pose: 'cheer', tone: 'limeSoft' },
  { title: 'Verificăm fără stres!', body: 'Prinde enunțul și pașii tăi — vezi ce e bine.', compactBody: 'Enunțul și pașii tăi în cadru.', pose: 'point', tone: 'peachSoft' },
  { title: 'Fiecare pas contează!', body: 'Prinde enunțul și rezolvarea ta în cadru.', compactBody: 'Prinde enunțul și rezolvarea.', pose: 'wave', tone: 'peachSoft' },
];

const EXHAUSTED_FREE_MESSAGES: readonly TutorMessage[] = [
  { title: 'Super treabă azi!', body: 'Problemele revin automat la 00:00.', compactBody: 'Revin automat la 00:00.', pose: 'wave', tone: 'peachSoft' },
  { title: 'Caietul e mereu liber!', body: 'Recitește lecțiile salvate și offline.', compactBody: 'Lecțiile tale merg și offline.', pose: 'point', tone: 'limeSoft' },
  { title: 'Vrei mai multă practică?', body: 'Atinge cronometrul pentru Pro sau Max.', compactBody: 'Atinge sus pentru Pro & Max.', pose: 'cheer', tone: 'violetSoft' },
  { title: 'Pauză binemeritată!', body: 'Sus vezi exact cât mai e până la 00:00.', compactBody: 'Cronometrul arată timpul rămas.', pose: 'thinking', tone: 'peachSoft' },
];

const EXHAUSTED_PREMIUM_MESSAGES: readonly TutorMessage[] = [
  { title: 'Super ritm azi!', body: 'Toate problemele revin la 00:00.', compactBody: 'Revin automat la 00:00.', pose: 'wave', tone: 'limeSoft' },
  { title: 'Caietul e mereu liber!', body: 'Recitește lecțiile salvate și offline.', compactBody: 'Lecțiile tale merg și offline.', pose: 'point', tone: 'limeSoft' },
  { title: 'Pauză binemeritată!', body: 'Sus vezi exact cât mai e până la 00:00.', compactBody: 'Cronometrul arată timpul rămas.', pose: 'thinking', tone: 'peachSoft' },
];

const PENDING_MESSAGES: readonly TutorMessage[] = [
  { title: 'Aproape gata!', body: 'Apasă „Revino la analiză” să vezi starea.', compactBody: 'Apasă „Revino la analiză”.', pose: 'point', tone: 'limeSoft' },
  { title: 'Nu pierzi nimic!', body: 'Între timp poți răsfoi liniștit Caietul.', compactBody: 'Poți răsfoi Caietul între timp.', pose: 'wave', tone: 'limeSoft' },
];

const WAVE_INPUT = WAVE_INPUT_17;
const COS_PING_PONG = cosinePingPongRange(-1, 1);
const COS_PULSE = cosinePulseRange(0, 1);

function solveGreeting(hour: number): string {
  if (hour >= 6 && hour < 12) return 'Bună dimineața!';
  if (hour >= 18 && hour < 23) return 'Lucrăm ceva azi?';
  return 'Salut! Ce rezolvăm?';
}

export const HomeSurface = memo(function HomeSurface({
  mode,
  focused = true,
  pending,
  pendingKind = null,
  galleryBusy,
  galleryError,
  allowance,
  resetAt = null,
  remaining,
  limit,
  premiumActive = false,
  latestLessonTitle = null,
  savedLessonsCount = 0,
  studyTrackLabel,
  studyTrackChosen = true,
  streakDays = 0,
  wrongCount = 0,
  showGuide = false,
  embedded = false,
  animateSkyDome = true,
  bottomClearance = 8,
  onDismissGuide,
  onClearGalleryError,
  onDiscardPending,
  onMode,
  onCapture,
  onGallery,
  onMath,
  onNotebook,
  onStudy,
  onChooseStudyTrack,
  onQuickPractice,
  onSettings,
  onAllowance,
}: Props) {
  const frame = useSafeAreaFrame();
  const { contentWidth, fontScale, isVeryNarrow } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const hero = computeHeroGeometry({
    width: frame.width,
    height: frame.height,
    topInset: insets.top,
    fontScale,
  });
  const compact = hero.compact;
  const reducedMotion = useReducedMotion();
  const motionReady = useContext(HomeMotionReadyContext);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [ambientReady, setAmbientReady] = useState(false);
  const [cheer, setCheer] = useState<{ index: number; scope: string } | null>(null);
  const [mascotNudge, setMascotNudge] = useState(0);
  const cheerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousMode = useRef(mode);
  const skyDomePlayed = useRef(reducedMotion || !animateSkyDome);
  const initialRevealSettled = useRef(false);

  const isSolve = mode === 'solve';
  const hasPendingAnalysis = pending;
  const quotaExhausted = remaining !== undefined && remaining <= 0;
  const lastProblemLeft = !hasPendingAnalysis && !quotaExhausted && remaining === 1;
  const showPillResetTimer = Boolean(resetAt) && remaining !== undefined && limit !== undefined && remaining < limit;
  const energyRatio = remaining !== undefined && limit !== undefined && limit > 0
    ? Math.max(0, Math.min(1, remaining / limit))
    : null;
  const cheerScope = `${mode}:${hasPendingAnalysis}:${quotaExhausted}:${premiumActive}:${lastProblemLeft}:${galleryError ?? ''}`;
  const baseCheerPool: readonly TutorMessage[] = hasPendingAnalysis
    ? PENDING_MESSAGES
    : quotaExhausted
      ? (premiumActive ? EXHAUSTED_PREMIUM_MESSAGES : EXHAUSTED_FREE_MESSAGES)
      : isSolve
        ? SOLVE_CHEER_MESSAGES
        : CHECK_CHEER_MESSAGES;
  const cheerPool: readonly TutorMessage[] = lastProblemLeft
    ? [LAST_PROBLEM_MESSAGE, ...baseCheerPool]
    : baseCheerPool;
  const cheerIndex = cheer && cheer.scope === cheerScope ? cheer.index % cheerPool.length : null;
  const motionActive = motionReady && focused && foreground && !reducedMotion;

  const skyDomeEnter = useRef(new Animated.Value(reducedMotion || !animateSkyDome ? 1 : 0)).current;
  const stagePop = useRef(new Animated.Value(1)).current;
  const medallionPop = useRef(new Animated.Value(1)).current;
  const modeBlend = useRef(new Animated.Value(isSolve ? 0 : 1)).current;
  const beamProgress = useRef(new Animated.Value(0)).current;
  const beamVisible = useRef(new Animated.Value(0)).current;
  const sparkPulse = useRef(new Animated.Value(0)).current;
  const arrowNudge = useRef(new Animated.Value(0)).current;
  const ctaSheen = useRef(new Animated.Value(0)).current;
  const tapSpark = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => () => {
    if (cheerTimer.current) clearTimeout(cheerTimer.current);
  }, []);

  useEffect(() => {
    if (cheerTimer.current) {
      clearTimeout(cheerTimer.current);
      cheerTimer.current = null;
    }
  }, [cheerScope]);

  // Smoothly unfurl the curved Royal-Violet/Coral sky canopy with unhurried splash-like ease.
  useEffect(() => {
    if (reducedMotion || !animateSkyDome) {
      skyDomeEnter.stopAnimation();
      skyDomeEnter.setValue(1);
      skyDomePlayed.current = true;
      return undefined;
    }
    if (!motionReady) {
      if (!skyDomePlayed.current) skyDomeEnter.setValue(0);
      return undefined;
    }
    if (skyDomePlayed.current) {
      skyDomeEnter.setValue(1);
      return undefined;
    }
    skyDomePlayed.current = true;

    let anim: Animated.CompositeAnimation | undefined;
    const frame = requestAnimationFrame(() => {
      anim = Animated.timing(skyDomeEnter, {
        toValue: 1,
        duration: 580,
        easing: SILKY_EASE_OUT,
        useNativeDriver: true,
      });
      anim.start();
    });
    const watchdog = setTimeout(() => {
      skyDomeEnter.stopAnimation();
      skyDomeEnter.setValue(1);
    }, 820);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(watchdog);
      anim?.stop();
      skyDomeEnter.stopAnimation();
    };
  }, [animateSkyDome, motionReady, reducedMotion, skyDomeEnter]);

  // Gate all self-running Home ambient loops strictly AFTER the unhurried entrance lands
  // so cold-start reveal runs at an uninterrupted 60fps with zero RenderThread contention.
  useEffect(() => {
    if (!motionActive) {
      setAmbientReady(false);
      return undefined;
    }
    const wakeDelay = initialRevealSettled.current ? 180 : 1_080;
    const wakeTimer = setTimeout(() => {
      initialRevealSettled.current = true;
      setAmbientReady(true);
    }, wakeDelay);
    return () => clearTimeout(wakeTimer);
  }, [motionActive]);

  // Ambient studio loops execute via pure single-timing native _startNativeLoop(-1)
  // on Android RenderThread with zero JS callbacks, waking smoothly in Wave B after the owl.
  useEffect(() => {
    if (!ambientReady) {
      beamProgress.stopAnimation();
      beamVisible.stopAnimation();
      sparkPulse.stopAnimation();
      arrowNudge.stopAnimation();
      ctaSheen.stopAnimation();
      beamVisible.setValue(0);
      return undefined;
    }

    const loops: Animated.CompositeAnimation[] = [];
    let fadeAnim: Animated.CompositeAnimation | undefined;
    const startNativeLoop = (value: Animated.Value, duration: number) => {
      const loop = createNativeLoop(value, duration);
      loops.push(loop);
      loop.start();
    };

    const startTimer = setTimeout(() => {
      startNativeLoop(beamProgress, hasPendingAnalysis ? 2_600 : 3_400);
      startNativeLoop(sparkPulse, hasPendingAnalysis ? 2_200 : 2_800);
      startNativeLoop(arrowNudge, 1_900);
      startNativeLoop(ctaSheen, 3_600);
      fadeAnim = Animated.timing(beamVisible, {
        toValue: 0.96,
        duration: 320,
        easing: SILKY_EASE_OUT,
        useNativeDriver: true,
      });
      fadeAnim.start();
    }, 200);

    return () => {
      clearTimeout(startTimer);
      fadeAnim?.stop();
      loops.forEach((loop) => loop.stop());
      beamProgress.stopAnimation();
      beamVisible.stopAnimation();
      sparkPulse.stopAnimation();
      arrowNudge.stopAnimation();
      ctaSheen.stopAnimation();
    };
  }, [ambientReady, arrowNudge, beamProgress, beamVisible, ctaSheen, hasPendingAnalysis, sparkPulse]);

  useEffect(() => {
    const targetBlend = isSolve ? 0 : 1;
    const anims: Animated.CompositeAnimation[] = [];
    if (reducedMotion || !motionReady || !focused) {
      modeBlend.stopAnimation();
      modeBlend.setValue(targetBlend);
    } else {
      const blendAnim = Animated.timing(modeBlend, {
        toValue: targetBlend,
        duration: 320,
        easing: SILKY_EASE_OUT,
        useNativeDriver: true,
      });
      anims.push(blendAnim);
      blendAnim.start();
    }

    if (previousMode.current === mode) {
      return () => anims.forEach((anim) => anim.stop());
    }
    previousMode.current = mode;
    if (reducedMotion || !motionReady || !focused) {
      stagePop.stopAnimation();
      medallionPop.stopAnimation();
      stagePop.setValue(1);
      medallionPop.setValue(1);
      return () => anims.forEach((anim) => anim.stop());
    }
    stagePop.setValue(0.985);
    medallionPop.setValue(0.9);
    const stageAnim = Animated.spring(stagePop, {
      toValue: 1,
      tension: 220,
      friction: 20,
      useNativeDriver: true,
    });
    const medallionAnim = Animated.spring(medallionPop, {
      toValue: 1,
      tension: 200,
      friction: 16,
      useNativeDriver: true,
    });
    anims.push(stageAnim, medallionAnim);
    stageAnim.start();
    medallionAnim.start();

    return () => anims.forEach((anim) => anim.stop());
  }, [focused, hasPendingAnalysis, isSolve, medallionPop, mode, modeBlend, motionReady, reducedMotion, stagePop]);

  const cycleEncouragement = () => {
    if (!reducedMotion) {
      tapSpark.stopAnimation();
      tapSpark.setValue(0);
      Animated.timing(tapSpark, {
        toValue: 1,
        duration: 540,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    if (galleryError) {
      onClearGalleryError?.();
      setCheer(null);
      return;
    }
    if (cheerTimer.current) clearTimeout(cheerTimer.current);
    setCheer((current) => {
      const nextIndex = current && current.scope === cheerScope
        ? (current.index + 1) % cheerPool.length
        : 0;
      return { index: nextIndex, scope: cheerScope };
    });
    cheerTimer.current = setTimeout(() => setCheer(null), 4200);
  };

  const triggerTutorFromHeader = () => {
    setMascotNudge((value) => value + 1);
    cycleEncouragement();
  };

  const skyDomeAnimatedStyle = useMemo(() => ({
    opacity: skyDomeEnter.interpolate({
      inputRange: [0, 0.45, 1],
      outputRange: [0.01, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: skyDomeEnter.interpolate({
          inputRange: [0, 1],
          outputRange: [-60, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [skyDomeEnter]);

  const stageAnimated = useMemo(() => ({
    transform: [{ scale: stagePop }],
  }), [stagePop]);

  const checkGradientStyle = useMemo(() => ({
    opacity: modeBlend,
  }), [modeBlend]);

  const medallionAnimated = useMemo(() => ({
    transform: [{ scale: medallionPop }],
  }), [medallionPop]);

  const beamRange = compact ? 22 : isVeryNarrow ? 29 : 34;
  const beamTranslateY = useMemo(
    () => beamProgress.interpolate({
      inputRange: WAVE_INPUT,
      outputRange: COS_PING_PONG.map((value) => value * beamRange),
    }),
    [beamProgress, beamRange],
  );
  const beamStyle = useMemo(() => ({
    opacity: beamVisible,
    transform: [{ translateY: beamTranslateY }],
  }), [beamTranslateY, beamVisible]);

  const sparkStyle = useMemo(() => ({
    opacity: sparkPulse.interpolate({
      inputRange: WAVE_INPUT,
      outputRange: COS_PULSE.map((value) => 0.72 + value * 0.28),
    }),
    transform: [
      {
        scale: sparkPulse.interpolate({
          inputRange: WAVE_INPUT,
          outputRange: COS_PULSE.map((value) => 0.92 + value * 0.18),
        }),
      },
      {
        rotate: sparkPulse.interpolate({
          inputRange: WAVE_INPUT,
          outputRange: COS_PULSE.map((value) => `${(-8 + value * 16).toFixed(2)}deg`),
        }),
      },
    ],
  }), [sparkPulse]);

  const lensHaloStyle = useMemo(() => ({
    opacity: sparkPulse.interpolate({
      inputRange: WAVE_INPUT,
      outputRange: COS_PULSE.map((value) => 0.24 + value * 0.36),
    }),
    transform: [
      {
        scale: sparkPulse.interpolate({
          inputRange: WAVE_INPUT,
          outputRange: COS_PULSE.map((value) => 0.96 + value * 0.08),
        }),
      },
    ],
  }), [sparkPulse]);

  const arrowStyle = useMemo(() => ({
    transform: [
      {
        translateX: arrowNudge.interpolate({
          inputRange: WAVE_INPUT,
          outputRange: COS_PULSE.map((value) => value * 3.5),
        }),
      },
    ],
  }), [arrowNudge]);

  const ctaSheenStyle = useMemo(() => ({
    opacity: ctaSheen.interpolate({
      inputRange: [0, 0.1, 0.14, 0.3, 0.34, 1],
      outputRange: [0, 0, 0.46, 0.46, 0, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: ctaSheen.interpolate({
          inputRange: [0, 0.1, 0.34, 1],
          outputRange: [-90, -90, 340, 340],
        }),
      },
      { skewX: '-22deg' },
    ],
  }), [ctaSheen]);

  const { sparkTopStyle, sparkRightStyle, sparkLeftStyle } = useMemo(() => {
    const arcOpacity = tapSpark.interpolate({
      inputRange: [0, 0.22, 0.5, 0.78, 1],
      outputRange: [0, 0.78, 1, 0.78, 0],
      extrapolate: 'clamp',
    });
    return {
      sparkTopStyle: {
        opacity: arcOpacity,
        transform: [
          { translateX: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) },
          { translateY: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0, -22] }) },
          { scale: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.25] }) },
          { rotate: tapSpark.interpolate({ inputRange: [0, 1], outputRange: ['-16deg', '18deg'] }) },
        ],
      },
      sparkRightStyle: {
        opacity: arcOpacity,
        transform: [
          { translateX: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) },
          { translateY: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }) },
          { scale: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.2] }) },
          { rotate: tapSpark.interpolate({ inputRange: [0, 1], outputRange: ['18deg', '-18deg'] }) },
        ],
      },
      sparkLeftStyle: {
        opacity: arcOpacity,
        transform: [
          { translateX: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0, -22] }) },
          { translateY: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) },
          { scale: tapSpark.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.15] }) },
          { rotate: tapSpark.interpolate({ inputRange: [0, 1], outputRange: ['-10deg', '18deg'] }) },
        ],
      },
    };
  }, [tapSpark]);

  const activeCheer = !galleryError && cheerIndex !== null
    ? cheerPool[cheerIndex]
    : null;

  const mascotPose: MascotPose = galleryError
    ? 'oops'
    : activeCheer
      ? activeCheer.pose
      : hasPendingAnalysis
        ? 'thinking'
        : quotaExhausted
          ? 'cheer'
          : isSolve
            ? 'wave'
            : 'point';

  const bubbleTone: SpeechBubbleTone = galleryError
    ? 'roseSoft'
    : activeCheer
      ? activeCheer.tone
      : hasPendingAnalysis
        ? 'limeSoft'
        : quotaExhausted
          ? 'peachSoft'
          : isSolve
            ? 'paper'
            : 'peachSoft';

  const auraTone: SpotlightAuraTone = galleryError ? 'rose' : 'onViolet';

  const greetingTitle = galleryError
    ? 'Hopa! Încearcă alta.'
    : activeCheer
      ? activeCheer.title
      : hasPendingAnalysis
        ? 'Încă lucrez la ea!'
        : quotaExhausted
          ? 'Ai terminat pe azi!'
          : isSolve
            ? solveGreeting(new Date().getHours())
            : 'Hai să verificăm!';

  const isWrittenPending = hasPendingAnalysis && pendingKind === 'written';
  const fullGreetingBody = galleryError
    ?? activeCheer?.body
    ?? (hasPendingAnalysis
      ? (isWrittenPending ? 'Exercițiul scris și progresul sunt păstrate.' : 'Fotografia și progresul sunt păstrate.')
      : quotaExhausted
        ? 'Revin la 00:00. Offline merge mereu.'
        : isSolve
          ? 'Poză sau scrie enunțul — îți explic pas cu pas.'
          : 'Prinde enunțul și pașii tăi — îți verific rezolvarea.');

  const compactGreetingBody = galleryError
    ?? activeCheer?.compactBody
    ?? (hasPendingAnalysis
      ? 'Progresul tău este păstrat.'
      : quotaExhausted
        ? 'Revin la 00:00. Offline e liber.'
        : isSolve
          ? 'Poză sau scrie enunțul.'
          : 'Prinde enunțul și pașii tăi.');

  const greetingBody = compact ? compactGreetingBody : fullGreetingBody;

  const mascotSize = hero.homeMascotSize;
  const spotlightSize = hero.homeSpotlightSize;
  // Curved sky dome matches LaunchSplash's retracting curtain height & arch radius pixel-for-pixel.
  const skyDomeHeight = hero.homeCanopyHeight;
  const isCheckTheme = !isSolve;
  const cornerColor = isCheckTheme ? colors.gold : colors.lime;
  const energyPercent = energyRatio !== null
    ? `${Math.round((energyRatio > 0 ? Math.max(0.08, energyRatio) : 0) * 100)}%` as `${number}%`
    : null;
  const savedCountLabel = savedLessonsCount > 0
    ? `${savedLessonsCount} ${savedLessonsCount === 1 ? 'lecție' : 'lecții'}`
    : null;
  const showTrackSetupBanner = !studyTrackChosen && wrongCount === 0 && !hasPendingAnalysis && Boolean(onChooseStudyTrack || onStudy);
  const trackPillLabel = !studyTrackChosen
    ? 'Alege clasa'
    : studyTrackLabel
      ? (streakDays > 0 && !isVeryNarrow ? `${studyTrackLabel} · ${streakDays}z` : studyTrackLabel)
      : (streakDays > 0 ? `Serie · ${streakDays} ${streakDays === 1 ? 'zi' : 'zile'}` : 'Clasa ta');
  const handleTrackPillPress = onChooseStudyTrack ?? onStudy ?? triggerTutorFromHeader;

  return (
    <View style={styles.safe}>
      <ComicBackdrop />
      <View style={styles.homeScene}>
        <View
          style={[
            styles.page,
            compact && styles.pageCompact,
            { width: contentWidth, paddingTop: insets.top + (compact ? 2 : 4) },
            embedded && { paddingBottom: bottomClearance },
          ]}
        >
          <Enter
            ready={motionReady}
            delay={250}
            duration={200}
            distance={0}
            scaleFrom={1}
            preRasterize
            style={[styles.header, compact && styles.headerCompact]}
          >
            <View style={[styles.brandRow, isVeryNarrow && styles.brandRowNarrow]}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Profu’ de mate"
                pressedScale={0.92}
                haptic="selection"
                onPress={triggerTutorFromHeader}
                backdrop={(
                  <CachedOutsetShadow
                    borderRadius={compact || isVeryNarrow ? 17.5 : 22}
                    shadow={SHADOWS.headerOutset}
                    padTop={12}
                    padX={16}
                    padBottom={20}
                  />
                )}
                style={styles.logoShadow}
                contentStyle={[styles.logo, (compact || isVeryNarrow) && styles.logoCompact]}
              >
                <CachedInsetRelief
                  borderRadius={compact || isVeryNarrow ? 17.5 : 22}
                  shadow={SHADOWS.logoInset}
                  zIndex={1}
                />
                <Image
                  accessible={false}
                  source={bundledImageSource(require('../../../../assets/brand/profu_mark_v2.png'))}
                  resizeMode="contain"
                  style={[styles.logoImage, (compact || isVeryNarrow) && styles.logoImageCompact]}
                />
              </PressableScale>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={
                  !studyTrackChosen
                    ? 'Alege clasa sau examenul pentru a personaliza aplicația'
                    : studyTrackLabel
                      ? `Nivel activ: ${studyTrackLabel}. Schimbă nivelul`
                      : 'Deschide nivelul de studiu'
                }
                pressedScale={0.95}
                haptic="selection"
                onPress={handleTrackPillPress}
                backdrop={(
                  <CachedOutsetShadow
                    borderRadius={radii.pill}
                    shadow={SHADOWS.trackOutset}
                    padTop={12}
                    padX={16}
                    padBottom={20}
                  />
                )}
                style={styles.trackPillWrap}
                contentStyle={[
                  styles.trackPill,
                  !studyTrackChosen && styles.trackPillSetup,
                  (compact || isVeryNarrow) && styles.trackPillCompact,
                ]}
              >
                <LinearGradient
                  pointerEvents="none"
                  colors={
                    !studyTrackChosen
                      ? ['rgba(255, 232, 126, 0.36)', 'rgba(255, 198, 64, 0.16)']
                      : ['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.12)']
                  }
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.fill}
                />
                <CachedInsetRelief borderRadius={radii.pill} shadow={SHADOWS.trackInset} zIndex={1} />
                <View
                  style={[
                    styles.trackDotHalo,
                    !studyTrackChosen && styles.trackDotHaloSetup,
                  ]}
                >
                  <View
                    style={[
                      styles.trackPillDot,
                      !studyTrackChosen
                        ? styles.trackPillDotSetup
                        : isCheckTheme && styles.trackPillDotCheck,
                    ]}
                  />
                </View>
                <Text
                  maxFontSizeMultiplier={1.15}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[
                    styles.trackPillText,
                    !studyTrackChosen && styles.trackPillTextSetup,
                    (compact || isVeryNarrow) && styles.trackPillTextCompact,
                  ]}
                >
                  {trackPillLabel}
                </Text>
                <View style={[styles.trackChevronOrb, !studyTrackChosen && styles.trackChevronOrbSetup]}>
                  <Text
                    accessible={false}
                    style={[styles.trackPillChevron, !studyTrackChosen && styles.trackPillChevronSetup]}
                  >
                    ▾
                  </Text>
                </View>
              </PressableScale>
            </View>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={allowance.accessibilityLabel}
              pressedScale={0.95}
              haptic="selection"
              onPress={onAllowance}
              backdrop={(
                <CachedOutsetShadow
                  borderRadius={radii.pill}
                  shadow={SHADOWS.headerOutset}
                  padTop={12}
                  padX={16}
                  padBottom={20}
                />
              )}
              style={[styles.allowanceWrap, isVeryNarrow && styles.allowanceWrapNarrow]}
              contentStyle={[
                styles.allowancePill,
                (compact || isVeryNarrow) && styles.allowancePillCompact,
                premiumActive && !quotaExhausted && styles.allowancePillPremium,
                quotaExhausted && styles.allowancePillExhausted,
              ]}
            >
              <LinearGradient
                pointerEvents="none"
                colors={
                  quotaExhausted
                    ? ['#FFF9F6', '#FFEBE3']
                    : premiumActive
                      ? ['#F8FFE6', '#EAFFB5']
                      : ['#FFFFFF', '#F5F0FF']
                }
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.fill}
              />
              <CachedInsetRelief
                borderRadius={radii.pill}
                shadow={
                  quotaExhausted
                    ? SHADOWS.allowanceInsetExhausted
                    : premiumActive
                      ? SHADOWS.allowanceInsetPremium
                      : SHADOWS.allowanceInset
                }
                zIndex={1}
              />
              <View
                style={[
                  styles.allowanceIconWell,
                  premiumActive && !quotaExhausted && styles.allowanceIconWellPremium,
                  quotaExhausted && styles.allowanceIconWellExhausted,
                ]}
              >
                {quotaExhausted ? (
                  <ComicClockIcon size={13} color={colors.peachDeep} accent={colors.peach} />
                ) : (
                  <MiniGlyph name="spark" size={13} color={premiumActive ? colors.limeDeep : colors.violetDeep} />
                )}
              </View>
              <View style={styles.allowanceCopy}>
                <Text
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                  style={styles.allowanceText}
                >
                  {allowance.label}
                </Text>
                {showPillResetTimer ? (
                  <HomeResetPillNote
                    resetAt={resetAt}
                    exhausted={quotaExhausted}
                    active={focused}
                    fallbackNote={allowance.note}
                  />
                ) : (
                  <Text
                    maxFontSizeMultiplier={1.3}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    style={styles.allowanceNote}
                  >
                    {allowance.note}
                  </Text>
                )}
              </View>
              {energyPercent !== null ? (
                <View pointerEvents="none" style={styles.energyTrack}>
                  <LinearGradient
                    colors={
                      quotaExhausted
                        ? ['#FF8B6E', '#E54B6B']
                        : premiumActive
                          ? ['#B4ED12', '#10B981']
                          : ['#9652FF', '#581EE0', '#18C4DC']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.energyFill, { width: energyPercent }]}
                  />
                </View>
              ) : null}
            </PressableScale>

            <IconButton
              label="Deschide setările"
              onPress={onSettings}
              size={compact ? 38 : 42}
              backdrop={(
                <CachedOutsetShadow
                  borderRadius={compact ? 19 : 21}
                  shadow={SHADOWS.headerOutset}
                  padTop={12}
                  padX={16}
                  padBottom={20}
                />
              )}
              style={styles.settingsWrap}
            >
              <AppIcon name="settings" size={compact ? 25 : 28} />
            </IconButton>
          </Enter>

          <Enter
            ready={motionReady}
            delay={340}
            duration={440}
            distance={14}
            scaleFrom={0.97}
            preRasterize
            style={[styles.tutorRow, compact && styles.tutorRowCompact]}
          >
            <SpeechBubble
              variant="sky"
              title={greetingTitle}
              body={greetingBody}
              tone={bubbleTone}
              tail="none"
              compact={compact}
              messageKey={`${greetingTitle}:${greetingBody}`}
              onPress={triggerTutorFromHeader}
            />
            <View style={[styles.tutorMascotStage, { width: mascotSize + 4, height: mascotSize + 2 }]}>
              <SpotlightAura size={spotlightSize} tone={auraTone} active={ambientReady} />
              <View pointerEvents="none" style={[styles.mascotFloorGlow, compact && styles.mascotFloorGlowCompact]} />
              <Animated.View pointerEvents="none" style={[styles.tapSpark, styles.tapSparkTop, sparkTopStyle]}>
                <Text accessible={false} style={styles.tapSparkLime}>✦</Text>
              </Animated.View>
              <Animated.View pointerEvents="none" style={[styles.tapSpark, styles.tapSparkRight, sparkRightStyle]}>
                <Text accessible={false} style={styles.tapSparkGold}>✦</Text>
              </Animated.View>
              <Animated.View pointerEvents="none" style={[styles.tapSpark, styles.tapSparkLeft, sparkLeftStyle]}>
                <Text accessible={false} style={styles.tapSparkCyan}>✦</Text>
              </Animated.View>
              <Mascot
                pose={mascotPose}
                size={mascotSize}
                active={ambientReady}
                interactive
                nudgeSignal={mascotNudge}
                onPress={cycleEncouragement}
              />
            </View>
          </Enter>

          <Enter
            ready={motionReady}
            delay={120}
            duration={460}
            distance={16}
            scaleFrom={0.96}
            preRasterize
            style={styles.modeSwitchEnter}
          >
            <SegmentedToggle
              options={modeOptions}
              value={mode}
              onChange={onMode}
              disabled={pending || galleryBusy}
              dimWhenDisabled={false}
              compact={compact}
              style={styles.modeSwitchFloating}
            />
          </Enter>

          <Enter
            ready={motionReady}
            delay={175}
            duration={480}
            distance={20}
            scaleFrom={0.955}
            preRasterize
            style={styles.cameraStageEnter}
          >
            <Animated.View
              style={[
                styles.cameraStageShadow,
                stageAnimated,
              ]}
            >
              <CachedOutsetShadow
                borderRadius={30}
                shadow={isCheckTheme ? SHADOWS.stageOutsetCheck : SHADOWS.stageOutsetSolve}
                padTop={16}
                padX={20}
                padBottom={28}
              />
              <View style={[styles.cameraStage, isCheckTheme && styles.cameraStageCheck, compact && styles.cameraStageCompact]}>
                <StudioCardBackdrop checkTheme={isCheckTheme} />
                <CachedInsetRelief
                  borderRadius={29}
                  shadow={isCheckTheme ? SHADOWS.stageInsetCheck : SHADOWS.stageInsetSolve}
                  zIndex={1}
                />

                {/* Top precision studio chips: mode indicator + matched framing pill */}
                <View style={styles.stageHudBar}>
                  <View style={styles.stageEyebrowPill}>
                    <CachedSurface
                      borderRadius={radii.pill}
                      backgroundColor={hasPendingAnalysis ? '#F0FFDC' : isCheckTheme ? '#FFF2F6' : '#F7F2FF'}
                      shadow={hasPendingAnalysis ? SHADOWS.eyebrowPending : isCheckTheme ? SHADOWS.eyebrowCheck : SHADOWS.eyebrowSolve}
                      padTop={9}
                      padX={11}
                      padBottom={14}
                    />
                    <Animated.View style={[styles.frontLayer, sparkStyle]}>
                      <View
                        style={[
                          styles.stageEyebrowDot,
                          {
                            backgroundColor: hasPendingAnalysis
                              ? colors.limeDeep
                              : isCheckTheme
                                ? '#D92567'
                                : colors.violet,
                          },
                        ]}
                      />
                    </Animated.View>
                    <Text
                      maxFontSizeMultiplier={1.12}
                      numberOfLines={1}
                      style={[
                        styles.stageEyebrowText,
                        hasPendingAnalysis && styles.stageEyebrowPending,
                        !hasPendingAnalysis && isCheckTheme && styles.stageEyebrowCheck,
                      ]}
                    >
                      {hasPendingAnalysis
                        ? 'ANALIZĂ ÎN CURS'
                        : isSolve
                          ? 'REZOLVARE AI'
                          : 'VERIFICARE AI'}
                    </Text>
                  </View>

                  {!isVeryNarrow ? (
                    <View style={styles.hudScopeChip}>
                      <CachedSurface
                        borderRadius={radii.pill}
                        backgroundColor="#FFFFFF"
                        shadow={hasPendingAnalysis ? SHADOWS.scopePending : isCheckTheme ? SHADOWS.scopeCheck : SHADOWS.scopeSolve}
                        padTop={9}
                        padX={11}
                        padBottom={14}
                      />
                      <Text
                        maxFontSizeMultiplier={1.1}
                        numberOfLines={1}
                        style={[
                          styles.hudScopeHint,
                          isCheckTheme && styles.hudScopeHintCheck,
                          hasPendingAnalysis && styles.hudScopeHintPending,
                        ]}
                      >
                        {hasPendingAnalysis
                          ? 'În fundal'
                          : isSolve
                            ? 'Doar enunțul'
                            : 'Enunț + rezolvare'}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Horizontal Optical Studio Stage — crisp glass lens + zero overlap */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={hasPendingAnalysis ? 'Revino la analiza în curs' : 'Deschide camera din cadru'}
                  disabled={galleryBusy}
                  onPress={onCapture}
                  style={({ pressed }) => [
                    styles.portalStage,
                    compact && styles.portalStageCompact,
                    pressed && styles.portalStagePressed,
                  ]}
                >
                  <View style={[styles.lensFrameWrap, isVeryNarrow && styles.lensFrameWrapNarrow, compact && styles.lensFrameWrapCompact]}>
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.lensAuraRing,
                        compact && styles.lensAuraRingCompact,
                        { borderColor: isCheckTheme ? '#FFB53D' : '#18C4DC' },
                        lensHaloStyle,
                      ]}
                    />
                    <View style={[styles.lensBoxShadow, compact && styles.lensBoxCompact]}>
                      <CachedOutsetShadow
                        borderRadius={compact ? 18 : 24}
                        shadow={isCheckTheme ? SHADOWS.lensOutsetCheck : SHADOWS.lensOutsetSolve}
                        padTop={14}
                        padX={18}
                        padBottom={24}
                      />
                      <View style={[styles.lensBox, compact && styles.lensBoxCompact]}>
                        <LinearGradient
                          colors={['#8B47FF', '#621EEB', '#400EB0']}
                          start={{ x: 0.1, y: 0 }}
                          end={{ x: 0.9, y: 1 }}
                          style={styles.fill}
                        />
                        <Animated.View pointerEvents="none" style={[styles.fill, checkGradientStyle]}>
                          <LinearGradient
                            colors={['#FF7B62', '#E53574', '#AD1455']}
                            start={{ x: 0.1, y: 0 }}
                            end={{ x: 0.9, y: 1 }}
                            style={styles.fill}
                          />
                        </Animated.View>
                        <CachedInsetRelief borderRadius={compact ? 18 : 24} shadow={SHADOWS.lensInset} zIndex={1} />
                        <View pointerEvents="none" style={[styles.lensLiveDot, { backgroundColor: cornerColor }]} />

                        <View pointerEvents="none" style={[styles.corner, styles.cornerTL, { borderColor: cornerColor }]} />
                        <View pointerEvents="none" style={[styles.corner, styles.cornerTR, { borderColor: cornerColor }]} />
                        <View pointerEvents="none" style={[styles.corner, styles.cornerBL, { borderColor: cornerColor }]} />
                        <View pointerEvents="none" style={[styles.corner, styles.cornerBR, { borderColor: cornerColor }]} />

                        <Animated.View pointerEvents="none" style={[styles.lensIconPlate, compact && styles.lensIconPlateCompact, medallionAnimated]}>
                          <CachedSurface
                            borderRadius={compact ? 13 : 18}
                            backgroundColor="#FFFFFF"
                            shadow={SHADOWS.lensPlate}
                            padTop={10}
                            padX={12}
                            padBottom={16}
                          />
                          <View style={styles.frontLayer}>
                            <AppIcon
                              name={isWrittenPending ? 'practice' : isSolve ? 'scan' : 'verify'}
                              size={compact ? 30 : isVeryNarrow ? 38 : 44}
                            />
                          </View>
                        </Animated.View>

                        <Animated.View pointerEvents="none" style={[styles.scanBeamWrap, beamStyle]}>
                          <View
                            style={[
                              styles.scanBeamHalo,
                              { backgroundColor: isCheckTheme ? 'rgba(255,212,71,0.44)' : 'rgba(216,255,62,0.44)' },
                            ]}
                          />
                          <View style={[styles.scanBeam, { backgroundColor: cornerColor }]} />
                        </Animated.View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.portalCopy}>
                    <Text
                      maxFontSizeMultiplier={1.25}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.84}
                      style={[styles.stageTitle, isVeryNarrow && styles.stageTitleNarrow, compact && styles.stageTitleCompact]}
                    >
                      {hasPendingAnalysis
                        ? 'Analiză în curs'
                        : isSolve
                          ? 'Fotografiază enunțul'
                          : 'Enunțul și rezolvarea'}
                    </Text>
                    <Text
                      maxFontSizeMultiplier={1.25}
                      numberOfLines={2}
                      style={[styles.stageNote, compact && styles.stageNoteCompact]}
                    >
                      {hasPendingAnalysis
                        ? (isWrittenPending
                          ? (isSolve ? 'Exercițiul scris se rezolvă în fundal.' : 'Rezolvarea scrisă se verifică în fundal.')
                          : (isSolve ? 'Fotografia ta se analizează în fundal.' : 'Rezolvarea fotografiată se verifică în fundal.'))
                        : isSolve
                          ? 'Încadrezi enunțul clar și primești rezolvarea pas cu pas.'
                          : 'Prinde atât problema, cât și pașii tăi, să îi verific.'}
                    </Text>
                  </View>
                </Pressable>

                {/* Unified Bottom Studio Controls inside Photo Card: Radiant Shutter CTA + Airy Light Galerie & Scrie */}
                <View style={[styles.monolithControls, compact && styles.monolithControlsCompact]}>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={
                      hasPendingAnalysis
                        ? 'Revino la analiza în curs'
                        : isSolve
                          ? 'Fotografiază o problemă de rezolvat'
                          : 'Fotografiază o rezolvare de verificat'
                    }
                    disabled={galleryBusy}
                    dimWhenDisabled={false}
                    pressedScale={0.975}
                    haptic="medium"
                    onPress={onCapture}
                    backdrop={(
                      <CachedOutsetShadow
                        borderRadius={radii.pill}
                        shadow={isCheckTheme ? SHADOWS.ctaOutsetCheck : SHADOWS.ctaOutsetSolve}
                        padTop={14}
                        padX={18}
                        padBottom={24}
                      />
                    )}
                    style={styles.captureCtaShadow}
                    contentStyle={[
                      styles.captureCta,
                      isCheckTheme && styles.captureCtaCheck,
                      compact && styles.captureCtaCompact,
                    ]}
                  >
                    <LinearGradient
                      colors={isCheckTheme ? ['#FFE98A', '#FFD04A', '#F4AA1C'] : ['#F2FF82', '#D8FF3E', '#B5EB0A']}
                      start={{ x: 0.06, y: 0 }}
                      end={{ x: 0.94, y: 1 }}
                      style={styles.fill}
                    />
                    <CachedInsetRelief
                      borderRadius={radii.pill}
                      shadow={isCheckTheme ? SHADOWS.ctaInsetCheck : SHADOWS.ctaInsetSolve}
                      zIndex={1}
                    />
                    <Animated.View pointerEvents="none" style={[styles.ctaSweep, ctaSheenStyle]} />
                    <View style={[styles.ctaIconBadge, compact && styles.ctaIconBadgeCompact]}>
                      <CachedSurface
                        borderRadius={compact ? 14 : 17}
                        backgroundColor={colors.paper}
                        shadow={SHADOWS.ctaBadge}
                        padTop={7}
                        padX={8}
                        padBottom={11}
                      />
                      <View style={styles.frontLayer}>
                        <AppIcon name={hasPendingAnalysis ? 'scan' : 'camera'} size={compact ? 22 : 26} />
                      </View>
                    </View>
                    <Text
                      maxFontSizeMultiplier={1.3}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.84}
                      style={[styles.captureCtaText, compact && styles.captureCtaTextCompact]}
                    >
                      {hasPendingAnalysis ? 'Revino la analiză' : 'Deschide camera'}
                    </Text>
                    <Animated.View
                      style={[
                        styles.captureArrow,
                        compact && styles.captureArrowCompact,
                        arrowStyle,
                      ]}
                    >
                      <CachedSurface
                        borderRadius={compact ? 14 : 17}
                        backgroundColor={colors.ink}
                        shadow={SHADOWS.ctaArrow}
                        padTop={7}
                        padX={8}
                        padBottom={11}
                      />
                      <View style={styles.frontLayer}>
                        <MiniGlyph name="next" size={compact ? 14 : 16} color={colors.paper} />
                      </View>
                    </Animated.View>
                  </PressableScale>

                  {hasPendingAnalysis ? (
                    <View style={[styles.inputDuoRow, compact && styles.inputDuoRowCompact]}>
                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel="Anulează analiza în curs și începe altă problemă"
                        disabled={galleryBusy}
                        dimWhenDisabled={false}
                        pressedScale={0.97}
                        haptic="light"
                        onPress={onDiscardPending}
                        backdrop={(
                          <CachedOutsetShadow
                            borderRadius={compact ? 14 : 18}
                            shadow={SHADOWS.splitOutsetDiscard}
                            padTop={12}
                            padX={15}
                            padBottom={20}
                          />
                        )}
                        style={styles.splitSlotWrap}
                        contentStyle={[styles.splitPill, styles.splitPillDiscard, compact && styles.splitPillCompact]}
                      >
                        <View style={[styles.splitIconWrap, compact && styles.splitIconWrapCompact]}>
                          <CachedSurface
                            borderRadius={compact ? 9 : 12}
                            backgroundColor="#FFF9F8"
                            shadow={SHADOWS.splitIconDiscard}
                            padTop={7}
                            padX={8}
                            padBottom={11}
                          />
                          <View style={styles.frontLayer}>
                            <MiniGlyph name="close" size={compact ? 14 : 16} color={colors.berryDeep} />
                          </View>
                        </View>
                        <View style={styles.splitCopy}>
                          <Text maxFontSizeMultiplier={1.25} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.splitTitle, styles.discardTitle, compact && styles.splitTitleCompact]}>
                            Anulează
                          </Text>
                          {!compact ? (
                            <Text maxFontSizeMultiplier={1.15} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86} style={styles.splitNote}>
                              Începe alta
                            </Text>
                          ) : null}
                        </View>
                        <LinearGradient
                          pointerEvents="none"
                          colors={['#FFF9F7', '#FFE8E3']}
                          start={{ x: 0.5, y: 0 }}
                          end={{ x: 0.5, y: 1 }}
                          style={[styles.fill, styles.behind]}
                        />
                        <CachedInsetRelief borderRadius={compact ? 13 : 17} shadow={SHADOWS.splitInsetDiscard} zIndex={1} />
                      </PressableScale>

                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel={savedCountLabel ? `Deschide caietul cu ${savedCountLabel} salvate` : 'Deschide caietul cu lecții salvate'}
                        disabled={galleryBusy}
                        dimWhenDisabled={false}
                        pressedScale={0.97}
                        haptic="light"
                        onPress={onNotebook}
                        backdrop={(
                          <CachedOutsetShadow
                            borderRadius={compact ? 14 : 18}
                            shadow={SHADOWS.splitOutsetCyan}
                            padTop={12}
                            padX={15}
                            padBottom={20}
                          />
                        )}
                        style={styles.splitSlotWrap}
                        contentStyle={[styles.splitPill, styles.splitPillCyan, compact && styles.splitPillCompact]}
                      >
                        <View style={[styles.splitIconWrap, compact && styles.splitIconWrapCompact]}>
                          <CachedSurface
                            borderRadius={compact ? 9 : 12}
                            backgroundColor="#FFFFFF"
                            shadow={SHADOWS.splitIconCyan}
                            padTop={7}
                            padX={8}
                            padBottom={11}
                          />
                          <View style={styles.frontLayer}>
                            <AppIcon name="notebook" size={compact ? 21 : 25} />
                          </View>
                        </View>
                        <View style={styles.splitCopy}>
                          <Text maxFontSizeMultiplier={1.25} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.splitTitle, compact && styles.splitTitleCompact]}>
                            Caiet
                          </Text>
                          {!compact ? (
                            <Text maxFontSizeMultiplier={1.15} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86} style={[styles.splitNote, styles.splitNoteCyan]}>
                              {savedCountLabel ?? 'Lecții salvate'}
                            </Text>
                          ) : null}
                        </View>
                        <LinearGradient
                          pointerEvents="none"
                          colors={['#F7FEFF', '#E2F8FE']}
                          start={{ x: 0.5, y: 0 }}
                          end={{ x: 0.5, y: 1 }}
                          style={[styles.fill, styles.behind]}
                        />
                        <CachedInsetRelief borderRadius={compact ? 13 : 17} shadow={SHADOWS.splitInsetCyan} zIndex={1} />
                      </PressableScale>
                    </View>
                  ) : (
                    <View style={[styles.inputDuoRow, compact && styles.inputDuoRowCompact]}>
                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel="Alege o fotografie din galerie"
                        accessibilityState={{ disabled: galleryBusy, busy: galleryBusy }}
                        disabled={galleryBusy}
                        dimWhenDisabled={false}
                        pressedScale={0.97}
                        haptic="light"
                        onPress={onGallery}
                        backdrop={(
                          <CachedOutsetShadow
                            borderRadius={compact ? 14 : 18}
                            shadow={SHADOWS.splitOutsetCyan}
                            padTop={12}
                            padX={15}
                            padBottom={20}
                          />
                        )}
                        style={styles.splitSlotWrap}
                        contentStyle={[styles.splitPill, styles.splitPillCyan, compact && styles.splitPillCompact]}
                      >
                        <View style={[styles.splitIconWrap, compact && styles.splitIconWrapCompact]}>
                          <CachedSurface
                            borderRadius={compact ? 9 : 12}
                            backgroundColor="#FFFFFF"
                            shadow={SHADOWS.splitIconCyan}
                            padTop={7}
                            padX={8}
                            padBottom={11}
                          />
                          <View style={styles.frontLayer}>
                            {galleryBusy ? (
                              <PlayfulLoader micro />
                            ) : (
                              <AppIcon name="gallery" size={compact ? 22 : 26} />
                            )}
                          </View>
                        </View>
                        <View style={styles.splitCopy}>
                          <Text maxFontSizeMultiplier={1.25} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.splitTitle, compact && styles.splitTitleCompact]}>
                            Galerie
                          </Text>
                          {!compact ? (
                            <Text maxFontSizeMultiplier={1.15} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86} style={[styles.splitNote, styles.splitNoteCyan]}>
                              {isSolve ? 'Poză cu enunțul' : 'Enunț + pașii tăi'}
                            </Text>
                          ) : null}
                        </View>
                        <LinearGradient
                          pointerEvents="none"
                          colors={['#F7FEFF', '#E2F8FE']}
                          start={{ x: 0.5, y: 0 }}
                          end={{ x: 0.5, y: 1 }}
                          style={[styles.fill, styles.behind]}
                        />
                        <CachedInsetRelief borderRadius={compact ? 13 : 17} shadow={SHADOWS.splitInsetCyan} zIndex={1} />
                      </PressableScale>

                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel="Scrie o problemă sau o rezolvare"
                        accessibilityState={{ disabled: galleryBusy }}
                        disabled={galleryBusy}
                        dimWhenDisabled={false}
                        pressedScale={0.97}
                        haptic="light"
                        onPress={onMath}
                        backdrop={(
                          <CachedOutsetShadow
                            borderRadius={compact ? 14 : 18}
                            shadow={SHADOWS.splitOutsetAmber}
                            padTop={12}
                            padX={15}
                            padBottom={20}
                          />
                        )}
                        style={styles.splitSlotWrap}
                        contentStyle={[styles.splitPill, styles.splitPillAmber, compact && styles.splitPillCompact]}
                      >
                        <View style={[styles.splitIconWrap, compact && styles.splitIconWrapCompact]}>
                          <CachedSurface
                            borderRadius={compact ? 9 : 12}
                            backgroundColor="#FFFFFF"
                            shadow={SHADOWS.splitIconAmber}
                            padTop={7}
                            padX={8}
                            padBottom={11}
                          />
                          <View style={styles.frontLayer}>
                            <AppIcon name="practice" size={compact ? 22 : 26} />
                          </View>
                        </View>
                        <View style={styles.splitCopy}>
                          <Text maxFontSizeMultiplier={1.25} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.splitTitle, compact && styles.splitTitleCompact]}>
                            Scrie
                          </Text>
                          {!compact ? (
                            <Text maxFontSizeMultiplier={1.15} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86} style={[styles.splitNote, styles.splitNoteAmber]}>
                              {isSolve ? 'Scrie enunțul' : 'Enunț + soluția ta'}
                            </Text>
                          ) : null}
                        </View>
                        <LinearGradient
                          pointerEvents="none"
                          colors={['#FFFDF6', '#FFF1C7']}
                          start={{ x: 0.5, y: 0 }}
                          end={{ x: 0.5, y: 1 }}
                          style={[styles.fill, styles.behind]}
                        />
                        <CachedInsetRelief borderRadius={compact ? 13 : 17} shadow={SHADOWS.splitInsetAmber} zIndex={1} />
                      </PressableScale>
                    </View>
                  )}
                </View>
              </View>
            </Animated.View>
          </Enter>

          {/* Flagship 2-Row Luminous Quest Showcase Card for Antrenament / Alege clasa / Repetă greșelile */}
          <View style={styles.questWrap}>
            {embedded && (onQuickPractice || showTrackSetupBanner) ? (
              <Enter
                ready={motionReady}
                delay={235}
                duration={480}
                distance={16}
                scaleFrom={0.965}
                preRasterize
              >
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={
                    showTrackSetupBanner
                      ? 'Alege nivelul de studiu pentru a personaliza aplicația'
                      : wrongCount > 0
                        ? (wrongCount === 1 ? 'Reia exercițiul greșit' : `Reia cele ${wrongCount} exerciții greșite`)
                        : 'Începe un antrenament fulger de 5 minute'
                  }
                  accessibilityState={{ disabled: galleryBusy }}
                  disabled={galleryBusy}
                  dimWhenDisabled={false}
                  pressedScale={0.975}
                  haptic="medium"
                  onPress={showTrackSetupBanner ? (onChooseStudyTrack ?? onStudy) : onQuickPractice}
                  backdrop={(
                    <CachedOutsetShadow
                      borderRadius={compact ? 19 : 26}
                      shadow={
                        showTrackSetupBanner
                          ? SHADOWS.questOutsetSetup
                          : wrongCount > 0
                            ? SHADOWS.questOutsetMistakes
                            : SHADOWS.questOutsetQuiz
                      }
                      padTop={16}
                      padX={20}
                      padBottom={28}
                    />
                  )}
                  style={styles.questShadow}
                  contentStyle={[
                    styles.questCard,
                    showTrackSetupBanner
                      ? styles.questCardSetup
                      : wrongCount > 0 && styles.questCardMistakes,
                    compact && styles.questCardCompact,
                  ]}
                >
                  <MissionCardBackdrop
                    tone={showTrackSetupBanner ? 'setup' : wrongCount > 0 ? 'mistakes' : 'quiz'}
                  />
                  <CachedInsetRelief
                    borderRadius={compact ? 18 : 25}
                    shadow={
                      showTrackSetupBanner
                        ? SHADOWS.questInsetSetup
                        : wrongCount > 0
                          ? SHADOWS.questInsetMistakes
                          : SHADOWS.questInsetQuiz
                    }
                    zIndex={1}
                  />

                  {!compact ? (
                    <View style={styles.questMetaRow}>
                      <View style={styles.questMetaPill}>
                        <CachedSurface
                          borderRadius={radii.pill}
                          backgroundColor={showTrackSetupBanner ? '#FFF5DA' : wrongCount > 0 ? '#FFEBF0' : '#E8FAF4'}
                          shadow={showTrackSetupBanner ? SHADOWS.questMetaSetup : wrongCount > 0 ? SHADOWS.questMetaMistakes : SHADOWS.questMetaQuiz}
                          padTop={9}
                          padX={11}
                          padBottom={14}
                        />
                        <Text
                          accessible={false}
                          style={[
                            styles.questMetaSpark,
                            showTrackSetupBanner
                              ? styles.questMetaSparkSetup
                              : wrongCount > 0 && styles.questMetaSparkMistakes,
                          ]}
                        >
                          ✦
                        </Text>
                        <Text
                          maxFontSizeMultiplier={1.08}
                          numberOfLines={1}
                          style={[
                            styles.questMetaLabel,
                            showTrackSetupBanner
                              ? styles.questMetaLabelSetup
                              : wrongCount > 0 && styles.questMetaLabelMistakes,
                          ]}
                        >
                          {showTrackSetupBanner
                            ? 'PERSONALIZARE'
                            : wrongCount > 0
                              ? 'RECAPITULARE'
                              : streakDays > 0
                                ? `SERIE · ${streakDays} ${streakDays === 1 ? 'ZI' : 'ZILE'}`
                                : 'ANTRENAMENT ZILNIC'}
                        </Text>
                      </View>

                      <View style={styles.questInfoPill}>
                        <CachedSurface
                          borderRadius={radii.pill}
                          backgroundColor="#FFFFFF"
                          shadow={showTrackSetupBanner ? SHADOWS.questInfoSetup : wrongCount > 0 ? SHADOWS.questInfoMistakes : SHADOWS.questInfoQuiz}
                          padTop={9}
                          padX={11}
                          padBottom={14}
                        />
                        <Text
                          maxFontSizeMultiplier={1.08}
                          numberOfLines={1}
                          style={[
                            styles.questInfoText,
                            showTrackSetupBanner
                              ? styles.questInfoTextSetup
                              : wrongCount > 0 && styles.questInfoTextMistakes,
                          ]}
                        >
                          {showTrackSetupBanner
                            ? 'V–XII · EN · BAC'
                            : wrongCount > 0
                              ? `${wrongCount} ${wrongCount === 1 ? 'greșeală' : 'greșeli'}`
                              : '5 întrebări · offline'}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.questMainRow}>
                    <View style={[styles.questIconOrb, compact && styles.questIconOrbCompact]}>
                      <CachedSurface
                        borderRadius={compact ? 12 : 16}
                        backgroundColor="#FFFFFF"
                        shadow={showTrackSetupBanner ? SHADOWS.questOrbSetup : wrongCount > 0 ? SHADOWS.questOrbMistakes : SHADOWS.questOrbQuiz}
                        padTop={9}
                        padX={11}
                        padBottom={15}
                      />
                      <View style={styles.frontLayer}>
                        <AppIcon name={showTrackSetupBanner ? 'class' : wrongCount > 0 ? 'retake' : 'streak'} size={compact ? 23 : 30} />
                      </View>
                    </View>
                    <View style={styles.questCopy}>
                      <Text
                        maxFontSizeMultiplier={1.25}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.82}
                        style={[
                          styles.questTitle,
                          showTrackSetupBanner
                            ? styles.questTitleSetup
                            : wrongCount > 0 && styles.questTitleMistakes,
                          compact && styles.questTitleCompact,
                        ]}
                      >
                        {showTrackSetupBanner
                          ? 'Alege clasa ta'
                          : wrongCount > 0
                            ? 'Repetă greșelile'
                            : 'Antrenament fulger'}
                      </Text>
                      {!compact ? (
                        <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.questNote}>
                          {showTrackSetupBanner
                            ? 'Formule, teste și simulări pe nivelul tău'
                            : wrongCount > 0
                              ? 'Reia rapid exercițiile greșite'
                              : studyTrackLabel
                                ? `Ritm zilnic · ${studyTrackLabel}`
                                : 'Grilă și răspuns scurt, cu explicații'}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.questActionShadow}>
                      <CachedOutsetShadow
                        borderRadius={radii.pill}
                        shadow={
                          showTrackSetupBanner
                            ? SHADOWS.questActionSetup
                            : wrongCount > 0
                              ? SHADOWS.questActionMistakes
                              : SHADOWS.questActionQuiz
                        }
                        padTop={11}
                        padX={14}
                        padBottom={19}
                      />
                      <View
                        style={[
                          styles.questActionPill,
                          showTrackSetupBanner
                            ? styles.questActionPillSetup
                            : wrongCount > 0
                              ? styles.questActionPillMistakes
                              : styles.questActionPillQuiz,
                          compact && styles.questActionPillCompact,
                        ]}
                      >
                        <LinearGradient
                          pointerEvents="none"
                          colors={
                            showTrackSetupBanner
                              ? ['#FFB42E', '#EB8A00', '#D46E00']
                              : wrongCount > 0
                                ? ['#FF5280', '#DF215A', '#BF1449']
                                : ['#16C898', '#0CA37B', '#078262']
                          }
                          start={{ x: 0.1, y: 0 }}
                          end={{ x: 0.9, y: 1 }}
                          style={styles.fill}
                        />
                        <CachedInsetRelief borderRadius={radii.pill} shadow={SHADOWS.questActionInset} zIndex={1} />
                        <Text
                          maxFontSizeMultiplier={1.1}
                          numberOfLines={1}
                          style={styles.questActionText}
                        >
                          {showTrackSetupBanner ? 'Alege' : wrongCount > 0 ? 'Reia' : 'Începe'}
                        </Text>
                        <View style={styles.frontLayer}>
                          <MiniGlyph name="next" size={compact ? 11 : 12} color={colors.paper} />
                        </View>
                      </View>
                    </View>
                  </View>
                </PressableScale>
              </Enter>
            ) : null}

            {!embedded ? (
              <Enter ready={motionReady} delay={250} distance={12} scaleFrom={0.97} style={styles.notebookGroup}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={savedCountLabel ? `Deschide caietul cu ${savedCountLabel} salvate` : 'Deschide caietul cu lecții salvate'}
                  pressedScale={0.975}
                  haptic="selection"
                  onPress={onNotebook}
                  backdrop={(
                    <CachedOutsetShadow
                      borderRadius={compact ? 19 : 26}
                      shadow={SHADOWS.questOutsetQuiz}
                      padTop={16}
                      padX={20}
                      padBottom={28}
                    />
                  )}
                  style={styles.questShadow}
                  contentStyle={[styles.questCard, compact && styles.questCardCompact]}
                >
                  <MissionCardBackdrop tone="quiz" />
                  <CachedInsetRelief borderRadius={compact ? 18 : 25} shadow={SHADOWS.questInsetQuiz} zIndex={1} />
                  <View style={styles.questMainRow}>
                    <View style={[styles.questIconOrb, compact && styles.questIconOrbCompact]}>
                      <CachedSurface
                        borderRadius={compact ? 12 : 16}
                        backgroundColor="#FFFFFF"
                        shadow={SHADOWS.questOrbQuiz}
                        padTop={9}
                        padX={11}
                        padBottom={15}
                      />
                      <View style={styles.frontLayer}>
                        <AppIcon name="notebook" size={compact ? 23 : 30} />
                      </View>
                    </View>
                    <View style={styles.questCopy}>
                      <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={[styles.questTitle, compact && styles.questTitleCompact]}>
                        Caietul meu
                      </Text>
                      {!compact ? (
                        <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.questNote}>
                          {latestLessonTitle ? latestLessonTitle : 'Lecțiile tale salvate, disponibile și offline'}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[styles.questActionPill, styles.questActionPillQuiz, compact && styles.questActionPillCompact]}>
                      <Text maxFontSizeMultiplier={1.1} numberOfLines={1} style={styles.questActionText}>
                        {savedCountLabel ?? 'Deschide'}
                      </Text>
                      <MiniGlyph name="next" size={compact ? 11 : 12} color={colors.paper} />
                    </View>
                  </View>
                </PressableScale>

                {showGuide && !compact && !hasPendingAnalysis ? (
                  <View
                    accessible
                    accessibilityLabel="Cum funcționează: fotografiezi, înțelegi și salvezi lecția"
                    style={styles.guidePill}
                  >
                    <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.guideText}>
                      ✦  Fotografiezi  →  Înțelegi  →  Salvezi
                    </Text>
                    {onDismissGuide ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Ascunde ghidul"
                        hitSlop={10}
                        onPress={onDismissGuide}
                        style={styles.guideDismiss}
                      >
                        <MiniGlyph name="close" size={14} color={colors.violetDeep} />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </Enter>
            ) : null}
          </View>
        </View>
      </View>

      {/* Full-bleed curved Royal-Violet / Coral-Berry hero canopy unified with LaunchSplash & Onboarding */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.skyDome,
          {
            height: skyDomeHeight,
            borderBottomLeftRadius: hero.canopyRadius,
            borderBottomRightRadius: hero.canopyRadius,
          },
          skyDomeAnimatedStyle,
        ]}
      >
        <LinearGradient
          colors={ROYAL_HERO_GRADIENT}
          start={{ x: 0.08, y: 0 }}
          end={{ x: 0.92, y: 1 }}
          style={styles.fill}
        />
        <Animated.View style={[styles.fill, checkGradientStyle]}>
          <LinearGradient
            colors={['#FF8764', '#EE457C', '#C42064', '#94144F']}
            start={{ x: 0.08, y: 0 }}
            end={{ x: 0.92, y: 1 }}
            style={styles.fill}
          />
        </Animated.View>
        <RoyalHeroCanopyBackdrop
          width={hero.width}
          height={skyDomeHeight}
          showGradient={false}
        />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  safe: { flex: 1, overflow: 'hidden', backgroundColor: colors.canvas },
  homeScene: { flex: 1, overflow: 'hidden', zIndex: 2 },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  behind: { zIndex: 0 },
  frontLayer: { zIndex: 2, alignItems: 'center', justifyContent: 'center' },
  page: { flex: 1, minHeight: 0, maxWidth: 560, alignSelf: 'center', gap: 10, paddingTop: 4, paddingBottom: 8 },
  pageCompact: { gap: 6, paddingTop: 2 },

  // Full-bleed curved sky dome canopy (smooth gradient arch matching LaunchSplash curtain)
  skyDome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    overflow: 'hidden',
  },

  // Brand top bar floating in 3D relief over curved sky dome
  header: { height: 58, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCompact: { height: 44 },
  brandRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandRowNarrow: { gap: 6 },
  logoShadow: {
    position: 'relative',
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  logoCompact: { width: 35, height: 35, borderRadius: 17.5, borderWidth: 2 },
  logoImage: { width: 35, height: 35, zIndex: 2 },
  logoImageCompact: { width: 28, height: 28 },
  trackPillWrap: {
    flexShrink: 1,
    minWidth: 0,
    alignSelf: 'center',
    position: 'relative',
  },
  trackPill: {
    height: 36,
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.34)',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 9,
    paddingRight: 7,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  trackPillSetup: {
    backgroundColor: 'rgba(255, 212, 71, 0.2)',
    borderColor: 'rgba(255, 234, 140, 0.56)',
  },
  trackPillCompact: {
    height: 32,
    paddingLeft: 8,
    paddingRight: 6,
    gap: 5,
  },
  trackDotHalo: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(216, 255, 62, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    zIndex: 2,
  },
  trackDotHaloSetup: {
    backgroundColor: 'rgba(255, 216, 77, 0.28)',
  },
  trackPillDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.lime,
  },
  trackPillDotCheck: {
    backgroundColor: '#FFE169',
  },
  trackPillDotSetup: {
    backgroundColor: '#FFD84D',
  },
  trackPillText: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 12.5,
    lineHeight: 15,
    letterSpacing: -0.1,
    includeFontPadding: false,
    zIndex: 2,
  },
  trackPillTextSetup: {
    color: '#FFF8D8',
  },
  trackPillTextCompact: {
    fontSize: 11,
    lineHeight: 13.5,
  },
  trackChevronOrb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    zIndex: 2,
  },
  trackChevronOrbSetup: {
    backgroundColor: 'rgba(255, 224, 112, 0.24)',
  },
  trackPillChevron: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 10.5,
    lineHeight: 12,
    includeFontPadding: false,
  },
  trackPillChevronSetup: {
    color: '#FFE88A',
  },

  allowanceWrap: {
    marginLeft: 8,
    position: 'relative',
  },
  allowanceWrapNarrow: { marginLeft: 6 },
  allowancePill: {
    minWidth: 104,
    maxWidth: 140,
    height: 42,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingLeft: 8,
    paddingRight: 11,
    paddingBottom: 2,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  allowancePillCompact: { minWidth: 92, height: 36, paddingLeft: 7, paddingRight: 9 },
  allowancePillPremium: { backgroundColor: '#F4FFE0', borderColor: '#EAFFBA' },
  allowancePillExhausted: { backgroundColor: '#FFF2EC', borderColor: '#FFE0D4' },
  allowanceIconWell: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F2EAFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    zIndex: 2,
  },
  allowanceIconWellPremium: { backgroundColor: '#E6FFAC' },
  allowanceIconWellExhausted: { backgroundColor: '#FFE0D4' },
  energyTrack: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 2.5,
    height: 3.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(124, 60, 255, 0.12)',
    overflow: 'hidden',
    zIndex: 2,
  },
  energyFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  allowanceCopy: { flexShrink: 1, minWidth: 0, alignItems: 'flex-start', zIndex: 2 },
  allowanceText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11.5, lineHeight: 13.5, includeFontPadding: false },
  allowanceNote: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 9.5, letterSpacing: 0.4, lineHeight: 11.5, includeFontPadding: false },
  settingsWrap: {
    marginLeft: 8,
    position: 'relative',
  },

  // Hero owl + borderless luminous message row inside the sky dome
  tutorRow: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tutorRowCompact: { gap: 4 },
  tutorMascotStage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  mascotFloorGlow: {
    position: 'absolute',
    bottom: 2,
    width: 66,
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(20, 4, 64, 0.24)',
  },
  mascotFloorGlowCompact: { width: 44, height: 8 },
  tapSpark: { position: 'absolute', zIndex: 8 },
  tapSparkTop: { top: 8, left: '42%' },
  tapSparkRight: { top: 18, right: 6 },
  tapSparkLeft: { bottom: 26, left: 6 },
  tapSparkLime: { fontFamily: fonts.display, fontSize: 17, color: colors.lime },
  tapSparkGold: { fontFamily: fonts.display, fontSize: 15, color: colors.gold },
  tapSparkCyan: { fontFamily: fonts.display, fontSize: 14, color: colors.cyan },

  // Solid white 3D mode switcher straddling the smooth curved sky arch
  modeSwitchEnter: { zIndex: 4 },
  modeSwitchFloating: {
    borderRadius: radii.pill,
  },

  // Unified Sculpted 3D Ceramic-White Photo Hero Card
  cameraStageEnter: { flex: 1, minHeight: 0, width: '100%', zIndex: 3 },
  cameraStageShadow: { flex: 1, minHeight: 0, width: '100%', position: 'relative' },
  cameraStage: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
    padding: 15,
    position: 'relative',
    zIndex: 1,
  },
  cameraStageCheck: {
    borderColor: 'rgba(255, 245, 248, 0.96)',
  },
  cameraStageCompact: { padding: 10 },
  stageHudBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 2,
  },
  stageEyebrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: radii.pill,
    position: 'relative',
  },
  stageEyebrowDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
  },
  stageEyebrowText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 0.85,
    color: colors.violetDeep,
    includeFontPadding: false,
    zIndex: 2,
  },
  stageEyebrowCheck: {
    color: '#B01955',
  },
  stageEyebrowPending: {
    color: colors.limeDeep,
  },
  hudScopeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: radii.pill,
    position: 'relative',
  },
  hudScopeHint: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    lineHeight: 13,
    color: colors.violetDeep,
    includeFontPadding: false,
    zIndex: 2,
  },
  hudScopeHintCheck: {
    color: '#A52458',
  },
  hudScopeHintPending: {
    color: colors.limeDeep,
  },

  // Clean Horizontal Optical Viewfinder Stage (zero vertical overflow)
  portalStage: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 14,
    paddingHorizontal: 2,
    zIndex: 2,
  },
  portalStageCompact: {
    gap: 11,
    paddingHorizontal: 1,
  },
  portalStagePressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  lensFrameWrap: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  lensFrameWrapNarrow: { width: 78, height: 78 },
  lensFrameWrapCompact: { width: 62, height: 62 },
  lensAuraRing: {
    position: 'absolute',
    top: -5,
    right: -5,
    bottom: -5,
    left: -5,
    borderRadius: 29,
    borderWidth: 2,
  },
  lensAuraRingCompact: {
    top: -4,
    right: -4,
    bottom: -4,
    left: -4,
    borderRadius: 22,
  },
  lensBoxShadow: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    position: 'relative',
  },
  lensBox: {
    flex: 1,
    width: '100%',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  lensBoxCompact: {
    borderRadius: 18,
  },
  lensLiveDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
    zIndex: 4,
  },
  corner: {
    position: 'absolute',
    width: 13,
    height: 13,
    zIndex: 3,
  },
  cornerTL: { top: 8, left: 8, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderTopLeftRadius: 5 },
  cornerTR: { top: 8, right: 8, borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopRightRadius: 5 },
  cornerBL: { bottom: 8, left: 8, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderBottomLeftRadius: 5 },
  cornerBR: { bottom: 8, right: 8, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderBottomRightRadius: 5 },
  lensIconPlate: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
  },
  lensIconPlateCompact: {
    width: 42,
    height: 42,
    borderRadius: 13,
  },
  scanBeamWrap: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 10,
    justifyContent: 'center',
    zIndex: 4,
  },
  scanBeamHalo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 5,
  },
  scanBeam: { width: '100%', height: 2.5, borderRadius: 2.5 },
  portalCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  stageTitle: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 21.5,
    lineHeight: 24.5,
    letterSpacing: -0.35,
    textAlign: 'left',
  },
  stageTitleNarrow: { fontSize: 19, lineHeight: 22 },
  stageTitleCompact: { fontSize: 16.5, lineHeight: 19.5 },
  stageNote: {
    marginTop: 4,
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 12.5,
    lineHeight: 16.5,
    textAlign: 'left',
  },
  stageNoteCompact: { marginTop: 2, fontSize: 11.5, lineHeight: 15 },

  // Integrated Sculpted 3D Shutter CTA + Airy Light Galerie & Scrie inside Photo Card
  monolithControls: {
    gap: 10,
    zIndex: 3,
  },
  monolithControlsCompact: {
    gap: 6,
  },
  captureCtaShadow: {
    position: 'relative',
  },
  captureCta: {
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  captureCtaCheck: {
    backgroundColor: '#FFD04A',
  },
  captureCtaCompact: { height: 42, paddingHorizontal: 7, gap: 8 },
  ctaSweep: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    width: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.52)',
    zIndex: 1,
  },
  ctaIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
  },
  ctaIconBadgeCompact: { width: 28, height: 28, borderRadius: 14 },
  captureCtaText: { flex: 1, fontFamily: fonts.display, color: colors.ink, fontSize: 18, lineHeight: 21, zIndex: 2 },
  captureCtaTextCompact: { fontSize: 15.5, lineHeight: 18.5 },
  captureArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
  },
  captureArrowCompact: { width: 28, height: 28, borderRadius: 14 },

  // Airy Light Sculpted 3D Ceramic Galerie + Scrie Action Pills inside the Photo Card
  inputDuoRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 9,
  },
  inputDuoRowCompact: { gap: 6 },
  splitSlotWrap: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
  },
  splitPill: {
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    gap: 8,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  splitPillCompact: {
    height: 40,
    borderRadius: 14,
    paddingHorizontal: 7,
    gap: 6,
  },
  splitPillCyan: {
    backgroundColor: '#EDFCFF',
    borderColor: '#D6F5FD',
  },
  splitPillAmber: {
    backgroundColor: '#FFFBEF',
    borderColor: '#FCEBC0',
  },
  splitPillDiscard: {
    backgroundColor: '#FFF2F0',
    borderColor: '#FFD8D1',
  },
  splitIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
    zIndex: 2,
  },
  splitIconWrapCompact: {
    width: 26,
    height: 26,
    borderRadius: 9,
  },
  splitCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start', zIndex: 2 },
  splitTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 15, lineHeight: 18, letterSpacing: -0.2 },
  splitTitleCompact: { fontSize: 13.5, lineHeight: 16.5 },
  discardTitle: { color: colors.berryDeep },
  splitNote: { marginTop: 0.5, fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 10.5, lineHeight: 13 },
  splitNoteCyan: { color: '#0B6F86' },
  splitNoteAmber: { color: '#8A5A00' },

  // Chill Sculpted 3D Luminous 2-Row Quest Showcase Card (Antrenament / Alege clasa / Repetă greșelile)
  questWrap: { flexShrink: 0, zIndex: 3 },
  questShadow: {
    position: 'relative',
  },
  questCard: {
    minHeight: 104,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.92)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 11,
    justifyContent: 'space-between',
    gap: 9,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  questCardSetup: {
    borderColor: 'rgba(255, 252, 240, 0.95)',
  },
  questCardMistakes: {
    borderColor: 'rgba(255, 245, 248, 0.95)',
  },
  questCardCompact: {
    minHeight: 56,
    borderRadius: 19,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 0,
    justifyContent: 'center',
  },
  questMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 2,
  },
  questMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: radii.pill,
    position: 'relative',
  },
  questMetaSpark: {
    fontFamily: fonts.display,
    color: '#0A8F6C',
    fontSize: 10,
    lineHeight: 12,
    includeFontPadding: false,
    zIndex: 2,
  },
  questMetaSparkSetup: { color: '#C67B00' },
  questMetaSparkMistakes: { color: '#D4225A' },
  questMetaLabel: {
    fontFamily: fonts.bodyBold,
    color: '#0A7B5D',
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 0.75,
    includeFontPadding: false,
    zIndex: 2,
  },
  questMetaLabelSetup: { color: '#9E6100' },
  questMetaLabelMistakes: { color: '#B81B4D' },
  questInfoPill: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: radii.pill,
    position: 'relative',
  },
  questInfoText: {
    fontFamily: fonts.bodyBold,
    color: '#0D5E49',
    fontSize: 10,
    lineHeight: 12.5,
    includeFontPadding: false,
    zIndex: 2,
  },
  questInfoTextSetup: { color: '#7D4E00' },
  questInfoTextMistakes: { color: '#9E1843' },
  questMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    zIndex: 2,
  },
  questIconOrb: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  questIconOrbCompact: { width: 34, height: 34, borderRadius: 12 },
  questCopy: { flex: 1, minWidth: 0 },
  questTitle: {
    fontFamily: fonts.display,
    color: '#0B3E33',
    fontSize: 18.5,
    lineHeight: 21.5,
    letterSpacing: -0.3,
  },
  questTitleSetup: { color: '#583400' },
  questTitleMistakes: { color: '#7A1138' },
  questTitleCompact: { fontSize: 15, lineHeight: 18 },
  questNote: {
    marginTop: 1.5,
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 11.5,
    lineHeight: 14.5,
  },
  questActionShadow: {
    borderRadius: radii.pill,
    position: 'relative',
    flexShrink: 0,
  },
  questActionPill: {
    height: 38,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  questActionPillQuiz: {
    backgroundColor: '#0CA37B',
  },
  questActionPillSetup: {
    backgroundColor: '#EB8A00',
  },
  questActionPillMistakes: {
    backgroundColor: '#DF215A',
  },
  questActionPillCompact: {
    height: 30,
    paddingLeft: 10,
    paddingRight: 8,
  },
  questActionText: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 12,
    lineHeight: 14,
    includeFontPadding: false,
    zIndex: 2,
  },

  notebookGroup: { gap: 7 },
  guidePill: {
    minHeight: 34,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#E4D8FA',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 5,
    gap: 8,
  },
  guideText: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 11.5,
    lineHeight: 15,
    textAlign: 'center',
  },
  guideDismiss: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F2EAFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
