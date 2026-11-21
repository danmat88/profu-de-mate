import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useContext, useEffect, useRef, useState } from 'react';
import { AppState, Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { bundledImageSource } from '../../../shared/services/bundledImages';
import { borders, colors, fonts, radii, shadows, springs } from '../../../shared/theme';
import type { FlowMode } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { Chip } from '../../../shared/ui/Chip';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { Enter } from '../../../shared/ui/Enter';
import { IconButton } from '../../../shared/ui/IconButton';
import { Mascot, type MascotPose } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { SegmentedToggle, type SegmentedOption } from '../../../shared/ui/SegmentedToggle';
import { SpeechBubble, type SpeechBubbleTone } from '../../../shared/ui/SpeechBubble';
import { Text } from '../../../shared/ui/Typography';
import type { AllowancePresentation } from '../../access/utils/commercialPresentation';
import { HomeMotionReadyContext } from '../context/HomeMotionContext';

type Props = {
  mode: FlowMode;
  pending: boolean;
  galleryBusy: boolean;
  galleryError: string | null;
  allowance: AllowancePresentation;
  premiumActive?: boolean;
  latestLessonTitle?: string | null;
  showGuide?: boolean;
  onDismissGuide?: () => void;
  onMode: (mode: FlowMode) => void;
  onCapture: () => void;
  onGallery: () => void;
  onMath: () => void;
  onNotebook: () => void;
  onSettings: () => void;
  onAllowance: () => void;
};

const modeOptions: readonly [SegmentedOption<FlowMode>, SegmentedOption<FlowMode>] = [
  {
    value: 'solve',
    label: 'Rezolvă',
    icon: 'camera',
    activeFill: colors.violet,
    activeText: colors.paper,
    dotFill: colors.lime,
    dotText: colors.ink,
  },
  {
    value: 'check',
    label: 'Verifică',
    icon: 'verify',
    activeFill: colors.peach,
    activeText: colors.ink,
    dotFill: colors.ink,
    dotText: colors.paper,
  },
];

const CHEER_MESSAGES: readonly { title: string; body: string }[] = [
  { title: 'Hai că poți!', body: 'Fiecare problemă devine clară pas cu pas.' },
  { title: 'E mai simplu decât pare!', body: 'Arată-mi exercițiul și îl luăm pe rând.' },
  { title: 'Sunt aici cu tine!', body: 'Poți face poză sau poți scrie formula direct.' },
  { title: 'Super ritm!', body: 'Deschide camera când ești gata să începem.' },
];

function solveGreeting(hour: number): string {
  if (hour >= 6 && hour < 12) return 'Bună dimineața!';
  if (hour >= 18 && hour < 23) return 'Lucrăm ceva azi?';
  return 'Salut! Ce rezolvăm?';
}

export function HomeSurface({
  mode,
  pending,
  galleryBusy,
  galleryError,
  allowance,
  premiumActive = false,
  latestLessonTitle = null,
  showGuide = false,
  onDismissGuide,
  onMode,
  onCapture,
  onGallery,
  onMath,
  onNotebook,
  onSettings,
  onAllowance,
}: Props) {
  // The provider frame describes our actual root view. Android's window
  // dimensions can change independently while a native picker is dismissed.
  const frame = useSafeAreaFrame();
  const { contentWidth, height, fontScale, isVeryNarrow } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  // Navigation bars are hidden for this immersive screen; temporary bars
  // overlay Home instead of changing its spacing and responsive breakpoint.
  const compact = height - insets.top < 690 || fontScale >= 1.3;
  const reducedMotion = useReducedMotion();
  const focused = useIsFocused();
  const motionReady = useContext(HomeMotionReadyContext);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [cheer, setCheer] = useState<{ index: number; scope: string } | null>(null);
  const cheerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousMode = useRef(mode);

  const stagePop = useSharedValue(1);
  const beamProgress = useSharedValue(0.5);
  const sparkPulse = useSharedValue(0);
  const arrowNudge = useSharedValue(0);

  const isSolve = mode === 'solve';
  const hasPendingAnalysis = pending;
  const cheerScope = `${mode}:${hasPendingAnalysis}:${galleryError ?? ''}`;
  const cheerIndex = cheer && cheer.scope === cheerScope ? cheer.index : null;
  const motionActive = motionReady && focused && foreground && !reducedMotion;

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

  useEffect(() => {
    if (!motionActive || hasPendingAnalysis) {
      cancelAnimation(beamProgress);
      cancelAnimation(sparkPulse);
      cancelAnimation(arrowNudge);
      beamProgress.set(0.5);
      sparkPulse.set(0);
      arrowNudge.set(0);
      return;
    }

    beamProgress.set(0);
    beamProgress.set(withRepeat(
      withSequence(
        withTiming(1, { duration: 1850, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1850, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    ));

    sparkPulse.set(0);
    sparkPulse.set(withRepeat(
      withSequence(
        withTiming(1, { duration: 1350, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1350, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    ));

    arrowNudge.set(0);
    arrowNudge.set(withRepeat(
      withSequence(
        withTiming(3, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    ));

    return () => {
      cancelAnimation(beamProgress);
      cancelAnimation(sparkPulse);
      cancelAnimation(arrowNudge);
    };
  }, [arrowNudge, beamProgress, hasPendingAnalysis, motionActive, sparkPulse]);

  useEffect(() => {
    if (previousMode.current === mode) return;
    previousMode.current = mode;
    if (reducedMotion || !motionReady || !focused) {
      stagePop.set(1);
      return;
    }
    stagePop.set(withSequence(
      withTiming(0.985, { duration: 60, easing: Easing.out(Easing.quad) }),
      withSpring(1, springs.snappy),
    ));
  }, [focused, mode, motionReady, reducedMotion, stagePop]);

  const cycleEncouragement = () => {
    if (hasPendingAnalysis || galleryError) return;
    if (cheerTimer.current) clearTimeout(cheerTimer.current);
    setCheer((current) => {
      const nextIndex = current && current.scope === cheerScope
        ? (current.index + 1) % CHEER_MESSAGES.length
        : 0;
      return { index: nextIndex, scope: cheerScope };
    });
    cheerTimer.current = setTimeout(() => setCheer(null), 3200);
  };

  const stageAnimated = useAnimatedStyle(() => ({
    transform: [{ scale: stagePop.get() }],
  }));

  const beamRange = compact ? 22 : 34;
  const beamStyle = useAnimatedStyle(() => ({
    opacity: hasPendingAnalysis ? 0 : 0.94,
    transform: [{ translateY: (beamProgress.get() - 0.5) * 2 * beamRange }],
  }), [beamRange, hasPendingAnalysis]);

  const sparkStyle = useAnimatedStyle(() => {
    const p = sparkPulse.get();
    return {
      opacity: 0.72 + p * 0.28,
      transform: [{ scale: 0.92 + p * 0.22 }, { rotate: `${-8 + p * 16}deg` }],
    };
  });

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: arrowNudge.get() }],
  }));

  const activeCheer = !hasPendingAnalysis && !galleryError && cheerIndex !== null
    ? CHEER_MESSAGES[cheerIndex]
    : null;

  const mascotPose: MascotPose = hasPendingAnalysis
    ? 'thinking'
    : galleryError
      ? 'oops'
      : activeCheer
        ? 'cheer'
        : isSolve
          ? 'wave'
          : 'point';

  const bubbleTone: SpeechBubbleTone = hasPendingAnalysis
    ? 'limeSoft'
    : galleryError
      ? 'roseSoft'
      : activeCheer
        ? 'limeSoft'
        : isSolve
          ? 'paper'
          : 'peachSoft';

  const greetingTitle = hasPendingAnalysis
    ? 'Încă lucrez la ea!'
    : galleryError
      ? 'Hopa! Încearcă alta.'
      : activeCheer
        ? activeCheer.title
        : isSolve
          ? solveGreeting(new Date().getHours())
          : 'Hai să verificăm!';

  const greetingBody = hasPendingAnalysis
    ? 'Fotografia și progresul sunt păstrate.'
    : galleryError
      ?? activeCheer?.body
      ?? (isSolve
        ? 'Fă o poză sau scrie problema — explicăm pas cu pas.'
        : 'Arată-mi rezolvarea ta și vedem fiecare pas.');

  const mascotSize = compact ? 74 : isVeryNarrow ? 90 : 102;
  const cornerColor = isSolve || hasPendingAnalysis ? colors.lime : colors.gold;

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <View style={styles.homeScene}>
        <View style={[styles.page, { width: contentWidth }, compact && styles.pageCompact]}>
          <Enter ready={motionReady} delay={35} distance={14} scaleFrom={0.96} style={[styles.header, compact && styles.headerCompact]}>
            <View style={[styles.brandRow, isVeryNarrow && styles.brandRowNarrow]}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Profu’ de mate"
                depth={3}
                radius={compact || isVeryNarrow ? 11 : 14}
                shadowColor={colors.ink}
                haptic="selection"
                onPress={cycleEncouragement}
                contentStyle={[styles.logo, (compact || isVeryNarrow) && styles.logoCompact]}
              >
                <View pointerEvents="none" style={styles.logoShine} />
                <Image
                  accessible={false}
                  source={bundledImageSource(require('../../../../assets/brand/profu_mark_v2.png'))}
                  resizeMode="contain"
                  style={[styles.logoImage, (compact || isVeryNarrow) && styles.logoImageCompact]}
                />
              </PressableScale>
              <Text
                maxFontSizeMultiplier={1.3}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.68}
                style={[styles.brand, (compact || isVeryNarrow) && styles.brandCompact]}
              >
                Profu’ de mate
              </Text>
            </View>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={allowance.accessibilityLabel}
              depth={shadows.sm}
              radius={14}
              haptic="selection"
              onPress={onAllowance}
              style={[styles.allowanceWrap, isVeryNarrow && styles.allowanceWrapNarrow]}
              contentStyle={[
                styles.allowancePill,
                (compact || isVeryNarrow) && styles.allowancePillCompact,
                premiumActive && styles.allowancePillPremium,
              ]}
            >
              <View pointerEvents="none" style={styles.pillShine} />
              <MiniGlyph name="spark" size={14} color={colors.ink} />
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
                <Text
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={styles.allowanceNote}
                >
                  {allowance.note}
                </Text>
              </View>
            </PressableScale>

            <IconButton
              label="Deschide setările"
              onPress={onSettings}
              size={compact ? 38 : 44}
              style={styles.settingsWrap}
            >
              <AppIcon name="settings" size={compact ? 28 : 32} />
            </IconButton>
          </Enter>

          <Enter ready={motionReady} delay={95} distance={20} scaleFrom={0.9} tiltFrom={-2} style={[styles.tutorRow, compact && styles.tutorRowCompact]}>
            <Mascot
              pose={mascotPose}
              size={mascotSize}
              active={motionActive}
              interactive
              onPress={cycleEncouragement}
            />
            <SpeechBubble
              title={greetingTitle}
              body={greetingBody}
              tone={bubbleTone}
              tail="left"
              compact={compact}
              messageKey={`${mascotPose}:${galleryError ?? mode}:${cheerIndex ?? 'idle'}`}
            />
          </Enter>

          <Enter ready={motionReady} delay={150} distance={18} scaleFrom={0.94}>
            <SegmentedToggle
              options={modeOptions}
              value={mode}
              onChange={onMode}
              disabled={pending || galleryBusy}
              compact={compact}
            />
          </Enter>

          <Enter ready={motionReady} delay={205} distance={22} scaleFrom={0.92} style={styles.cameraStageEnter}>
            <Animated.View
              style={[
                styles.cameraStageShadow,
                !isSolve && !hasPendingAnalysis && styles.cameraStageShadowCheck,
                stageAnimated,
              ]}
            >
              <LinearGradient
                colors={isSolve || hasPendingAnalysis ? ['#8E54FF', '#6B2CE8', '#4F1CC4'] : ['#9037E6', '#C23574', '#98225A']}
                start={{ x: 0.06, y: 0 }}
                end={{ x: 0.94, y: 1 }}
                style={[styles.cameraStage, compact && styles.cameraStageCompact]}
              >
                <View pointerEvents="none" style={styles.stageGlowTop} />
                <View pointerEvents="none" style={styles.stageGlowBottom} />
                <View pointerEvents="none" style={styles.stageTopShine} />
                <Text accessible={false} style={styles.stageWatermark}>{isSolve ? 'π' : '✓'}</Text>

                <View style={[styles.stageTopRow, compact && styles.stageTopRowCompact]}>
                  <Chip
                    label={hasPendingAnalysis ? 'ANALIZĂ ÎN CURS' : isSolve ? 'PAS CU PAS' : 'FIECARE PAS'}
                    tone={hasPendingAnalysis || !isSolve ? 'gold' : 'lime'}
                    tilt={-2}
                  />
                  <Animated.View style={sparkStyle}>
                    <Text accessible={false} style={[styles.stageSpark, { color: cornerColor }]}>✦</Text>
                  </Animated.View>
                </View>

                <View style={[styles.stageContent, compact && styles.stageContentCompact]}>
                  <View style={[styles.focusFrame, compact && styles.focusFrameCompact]}>
                    <View pointerEvents="none" style={styles.focusGlass} />
                    <View style={[styles.focusCorner, styles.focusCornerTL, { borderColor: cornerColor }]} />
                    <View style={[styles.focusCorner, styles.focusCornerTR, { borderColor: cornerColor }]} />
                    <View style={[styles.focusCorner, styles.focusCornerBL, { borderColor: cornerColor }]} />
                    <View style={[styles.focusCorner, styles.focusCornerBR, { borderColor: cornerColor }]} />
                    <View style={[styles.focusMedallion, compact && styles.focusMedallionCompact]}>
                      <AppIcon
                        name={hasPendingAnalysis || isSolve ? 'scan' : 'verify'}
                        size={compact ? 42 : isVeryNarrow ? 54 : 60}
                      />
                    </View>
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.scanBeam,
                        { backgroundColor: cornerColor },
                        beamStyle,
                      ]}
                    />
                  </View>

                  <View style={styles.stageCopy}>
                    <Text
                      maxFontSizeMultiplier={1.3}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.84}
                      style={[styles.stageTitle, isVeryNarrow && styles.stageTitleNarrow, compact && styles.stageTitleCompact]}
                    >
                      {hasPendingAnalysis ? 'Revino la analiză' : isSolve ? 'Fotografiază problema' : 'Fotografiază rezolvarea'}
                    </Text>
                    <Text
                      maxFontSizeMultiplier={1.3}
                      numberOfLines={2}
                      style={[styles.stageNote, compact && styles.stageNoteCompact]}
                    >
                      {hasPendingAnalysis
                        ? 'Rezultatul tău se pregătește.'
                        : isSolve
                          ? 'Încadrezi enunțul și primești pașii clari.'
                          : 'Vezi ce ai făcut bine și ce corectezi.'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.stageCtaWrap, compact && styles.stageCtaWrapCompact]}>
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
                    depth={compact ? 4 : shadows.md}
                    radius={18}
                    shadowColor={colors.ink}
                    haptic="medium"
                    onPress={onCapture}
                    contentStyle={[
                      styles.captureCta,
                      compact && styles.captureCtaCompact,
                      !isSolve && !hasPendingAnalysis && styles.captureCtaCheck,
                    ]}
                  >
                    <View pointerEvents="none" style={styles.ctaShine} />
                    <View style={[styles.captureIconBadge, compact && styles.captureIconBadgeCompact]}>
                      <AppIcon name={hasPendingAnalysis ? 'scan' : 'camera'} size={compact ? 26 : 32} />
                    </View>
                    <Text
                      maxFontSizeMultiplier={1.3}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.82}
                      style={[styles.captureCtaText, compact && styles.captureCtaTextCompact]}
                    >
                      {hasPendingAnalysis ? 'Revino la analiză' : 'Deschide camera'}
                    </Text>
                    <Animated.View style={[styles.captureArrow, compact && styles.captureArrowCompact, arrowStyle]}>
                      <MiniGlyph name="next" size={compact ? 18 : 21} color={colors.paper} />
                    </Animated.View>
                  </PressableScale>
                </View>
              </LinearGradient>
            </Animated.View>
          </Enter>

          <View style={styles.lowerStack}>
            {!hasPendingAnalysis ? (
              <Enter ready={motionReady} delay={265} distance={18} scaleFrom={0.94} style={[styles.secondaryRow, compact && styles.secondaryRowCompact]}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Alege o fotografie din galerie"
                  accessibilityState={{ disabled: galleryBusy, busy: galleryBusy }}
                  disabled={galleryBusy}
                  depth={compact ? 4 : shadows.md}
                  radius={20}
                  shadowColor={colors.ink}
                  haptic="light"
                  onPress={onGallery}
                  style={styles.secondaryTileWrap}
                  contentStyle={[
                    styles.secondaryTile,
                    styles.galleryTile,
                    isVeryNarrow && styles.secondaryTileNarrow,
                    compact && styles.secondaryTileCompact,
                  ]}
                >
                  <View pointerEvents="none" style={styles.tileShine} />
                  <View style={[styles.tileIconBadge, (compact || isVeryNarrow) && styles.tileIconBadgeCompact]}>
                    {galleryBusy ? <PlayfulLoader micro /> : <AppIcon name="gallery" size={compact || isVeryNarrow ? 26 : 34} />}
                  </View>
                  <View style={styles.tileCopy}>
                    <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.tileTitle, compact && styles.tileTitleCompact]}>
                      Galerie
                    </Text>
                    {!compact ? (
                      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.tileNote}>
                        Din telefon
                      </Text>
                    ) : null}
                  </View>
                </PressableScale>

                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Scrie o problemă sau o rezolvare"
                  accessibilityState={{ disabled: galleryBusy }}
                  disabled={galleryBusy}
                  depth={compact ? 4 : shadows.md}
                  radius={20}
                  shadowColor={colors.ink}
                  haptic="light"
                  onPress={onMath}
                  style={styles.secondaryTileWrap}
                  contentStyle={[
                    styles.secondaryTile,
                    styles.mathTile,
                    isVeryNarrow && styles.secondaryTileNarrow,
                    compact && styles.secondaryTileCompact,
                  ]}
                >
                  <View pointerEvents="none" style={styles.tileShine} />
                  <View style={[styles.tileIconBadge, styles.mathIconBadge, (compact || isVeryNarrow) && styles.tileIconBadgeCompact]}>
                    <AppIcon name="practice" size={compact || isVeryNarrow ? 26 : 34} />
                  </View>
                  <View style={styles.tileCopy}>
                    <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.tileTitle, compact && styles.tileTitleCompact]}>
                      Scrie
                    </Text>
                    {!compact ? (
                      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.tileNote}>
                        Fără poză
                      </Text>
                    ) : null}
                  </View>
                </PressableScale>
              </Enter>
            ) : null}

            <Enter ready={motionReady} delay={320} distance={16} scaleFrom={0.95} style={styles.notebookGroup}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Deschide caietul cu lecții salvate"
                depth={compact ? 4 : shadows.md}
                radius={20}
                shadowColor={colors.ink}
                haptic="selection"
                onPress={onNotebook}
                style={styles.notebookWrap}
                contentStyle={[styles.notebookShelf, compact && styles.notebookShelfCompact]}
              >
                <View pointerEvents="none" style={styles.notebookShine} />
                <View pointerEvents="none" style={styles.notebookLines}>
                  <View style={styles.notebookLine} />
                  <View style={styles.notebookLine} />
                </View>
                <View style={styles.notebookSpine}>
                  <View style={styles.spineRing} />
                  <View style={styles.spineRing} />
                  {!compact ? <View style={styles.spineRing} /> : null}
                </View>
                <View style={[styles.notebookIcon, compact && styles.notebookIconCompact]}>
                  <AppIcon name="notebook" size={compact ? 34 : 42} />
                </View>
                <View style={styles.notebookCopy}>
                  <View style={styles.notebookHeaderRow}>
                    <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={styles.notebookKicker}>
                      CAIETUL MEU
                    </Text>
                    {latestLessonTitle && !compact ? (
                      <View style={styles.latestBadge}>
                        <Text style={styles.latestBadgeText}>ULTIMA</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[styles.notebookTitle, compact && styles.notebookTitleCompact]}>
                    {latestLessonTitle ? 'Revezi ce ai lucrat' : 'Lecții salvate'}
                  </Text>
                  {!compact ? (
                    <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={styles.notebookNote}>
                      {latestLessonTitle ? latestLessonTitle : 'Explicațiile tale, disponibile și offline'}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.notebookArrow, compact && styles.notebookArrowCompact]}>
                  <MiniGlyph name="next" size={compact ? 18 : 20} color={colors.paper} />
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
                      <MiniGlyph name="close" size={16} color={colors.violetDeep} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </Enter>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, overflow: 'hidden', backgroundColor: colors.canvas },
  homeScene: { flex: 1, overflow: 'hidden' },
  page: { flex: 1, minHeight: 0, maxWidth: 560, alignSelf: 'center', gap: 10, paddingTop: 4, paddingBottom: 8 },
  pageCompact: { gap: 7, paddingTop: 2 },

  // Header
  header: { height: 58, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCompact: { height: 44 },
  brandRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandRowNarrow: { gap: 7 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.lime,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    transform: [{ rotate: '-3deg' }],
  },
  logoCompact: { width: 36, height: 36, borderRadius: 11 },
  logoShine: {
    position: 'absolute',
    top: 2,
    left: 6,
    right: 6,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.shine,
  },
  logoImage: { width: 40, height: 40 },
  logoImageCompact: { width: 32, height: 32 },
  brand: { flex: 1, fontFamily: fonts.display, color: colors.ink, fontSize: 21, lineHeight: 25 },
  brandCompact: { fontSize: 17, lineHeight: 21 },

  allowanceWrap: { marginLeft: 8 },
  allowanceWrapNarrow: { marginLeft: 6 },
  allowancePill: {
    minWidth: 104,
    maxWidth: 132,
    height: 42,
    borderRadius: 14,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.limeSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 9,
    overflow: 'hidden',
  },
  allowancePillCompact: { minWidth: 92, height: 36, paddingHorizontal: 7 },
  allowancePillPremium: { backgroundColor: colors.lime },
  pillShine: {
    position: 'absolute',
    top: 2,
    left: 8,
    right: 8,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.shine,
  },
  allowanceCopy: { flexShrink: 1, minWidth: 0, alignItems: 'flex-start' },
  allowanceText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11.5, lineHeight: 13.5, includeFontPadding: false },
  allowanceNote: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 9.5, letterSpacing: 0.45, lineHeight: 11.5, includeFontPadding: false },
  settingsWrap: { marginLeft: 8 },

  // Tutor row (Owl + Speech Bubble)
  tutorRow: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 2 },
  tutorRowCompact: { gap: 2 },

  // Hero camera stage
  cameraStageEnter: { flex: 1, minHeight: 0, width: '100%' },
  cameraStageShadow: { flex: 1, minHeight: 0, width: '100%', borderRadius: radii.xl, backgroundColor: colors.violetShadow, paddingBottom: shadows.lg },
  cameraStageShadowCheck: {
    backgroundColor: colors.berryDeep,
  },
  cameraStage: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    borderWidth: borders.thick,
    borderColor: colors.ink,
    borderRadius: radii.xl - 1,
    backgroundColor: colors.violet,
    justifyContent: 'space-between',
    padding: 13,
  },
  cameraStageCompact: {
    padding: 10,
  },
  stageGlowTop: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -110,
    right: -60,
    backgroundColor: 'rgba(255, 255, 255, 0.13)',
  },
  stageGlowBottom: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    bottom: -70,
    left: -50,
    backgroundColor: 'rgba(23, 19, 55, 0.2)',
  },
  stageTopShine: {
    position: 'absolute',
    top: 4,
    left: 20,
    right: 20,
    height: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  stageWatermark: {
    position: 'absolute',
    right: 12,
    bottom: 58,
    fontFamily: fonts.display,
    fontSize: 78,
    lineHeight: 82,
    color: 'rgba(255, 255, 255, 0.08)',
    transform: [{ rotate: '12deg' }],
  },
  stageTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  stageTopRowCompact: {
    marginBottom: 2,
  },
  stageSpark: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
  },
  stageContent: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingHorizontal: 4,
    zIndex: 2,
  },
  stageContentCompact: {
    gap: 10,
    paddingHorizontal: 2,
  },
  focusFrame: {
    width: 98,
    height: 98,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  focusFrameCompact: {
    width: 72,
    height: 72,
  },
  focusGlass: {
    position: 'absolute',
    top: 8,
    right: 8,
    bottom: 8,
    left: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  focusMedallion: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusMedallionCompact: {
    width: 50,
    height: 50,
    borderRadius: 14,
  },
  focusCorner: { position: 'absolute', width: 24, height: 24 },
  focusCornerTL: { left: 0, top: 0, borderLeftWidth: 4.5, borderTopWidth: 4.5, borderTopLeftRadius: 9 },
  focusCornerTR: { right: 0, top: 0, borderRightWidth: 4.5, borderTopWidth: 4.5, borderTopRightRadius: 9 },
  focusCornerBL: { left: 0, bottom: 0, borderLeftWidth: 4.5, borderBottomWidth: 4.5, borderBottomLeftRadius: 9 },
  focusCornerBR: { right: 0, bottom: 0, borderRightWidth: 4.5, borderBottomWidth: 4.5, borderBottomRightRadius: 9 },
  scanBeam: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 3.5,
    borderRadius: 3,
  },
  stageCopy: { flex: 1, minWidth: 0 },
  stageTitle: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 23,
    lineHeight: 26,
  },
  stageTitleNarrow: { fontSize: 20, lineHeight: 23 },
  stageTitleCompact: { fontSize: 18, lineHeight: 21 },
  stageNote: {
    marginTop: 5,
    fontFamily: fonts.bodyMedium,
    color: '#F2ECFF',
    fontSize: 13,
    lineHeight: 17.5,
  },
  stageNoteCompact: { marginTop: 2, fontSize: 11.5, lineHeight: 15 },

  stageCtaWrap: { zIndex: 3 },
  stageCtaWrapCompact: {},
  captureCta: {
    height: 58,
    borderRadius: 18,
    borderWidth: borders.thick,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
    overflow: 'hidden',
  },
  captureCtaCompact: {
    height: 48,
    borderRadius: 15,
    paddingHorizontal: 8,
    gap: 8,
  },
  captureCtaCheck: {
    backgroundColor: '#FFB86B',
  },
  ctaShine: {
    position: 'absolute',
    top: 3,
    left: 12,
    right: 12,
    height: 6,
    borderRadius: 5,
    backgroundColor: colors.shine,
  },
  captureIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureIconBadgeCompact: { width: 32, height: 32, borderRadius: 10 },
  captureCtaText: { flex: 1, fontFamily: fonts.display, color: colors.ink, fontSize: 20, lineHeight: 23 },
  captureCtaTextCompact: { fontSize: 17, lineHeight: 20 },
  captureArrow: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureArrowCompact: { width: 30, height: 30, borderRadius: 10 },

  // Secondary actions + Notebook shelf
  lowerStack: { flexShrink: 0, gap: 9 },
  secondaryRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  secondaryRowCompact: { gap: 8 },
  secondaryTileWrap: { flex: 1, minWidth: 0 },
  secondaryTile: {
    height: 68,
    borderRadius: 20,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    gap: 10,
    overflow: 'hidden',
  },
  secondaryTileNarrow: { paddingHorizontal: 9, gap: 8 },
  secondaryTileCompact: { height: 52, borderRadius: 16, paddingHorizontal: 8, gap: 7 },
  galleryTile: { backgroundColor: colors.cyanSoft },
  mathTile: { backgroundColor: colors.goldSoft },
  tileShine: {
    position: 'absolute',
    top: 3,
    left: 12,
    right: 12,
    height: 5,
    borderRadius: 4,
    backgroundColor: colors.shine,
  },
  tileIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  mathIconBadge: {
    transform: [{ rotate: '3deg' }],
  },
  tileIconBadgeCompact: { width: 34, height: 34, borderRadius: 11 },
  tileCopy: { flex: 1, minWidth: 0 },
  tileTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 17.5, lineHeight: 20 },
  tileTitleCompact: { fontSize: 15, lineHeight: 18 },
  tileNote: { marginTop: 1, fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 11.5, lineHeight: 14 },

  notebookGroup: { gap: 7 },
  notebookWrap: {},
  notebookShelf: {
    minHeight: 74,
    borderRadius: 20,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 11,
    gap: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  notebookShelfCompact: { minHeight: 54, borderRadius: 16, paddingRight: 9, gap: 9 },
  notebookShine: {
    position: 'absolute',
    top: 3,
    left: 22,
    right: 14,
    height: 5,
    borderRadius: 4,
    backgroundColor: colors.shine,
  },
  notebookLines: {
    position: 'absolute',
    left: 22,
    right: 14,
    top: 22,
    bottom: 16,
    justifyContent: 'space-evenly',
    opacity: 0.4,
  },
  notebookLine: {
    height: 1,
    backgroundColor: '#EAE1FA',
  },
  notebookSpine: {
    width: 16,
    alignSelf: 'stretch',
    backgroundColor: colors.cyan,
    borderRightWidth: borders.thin,
    borderRightColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 10,
  },
  spineRing: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
  },
  notebookIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  notebookIconCompact: { width: 38, height: 38, borderRadius: 12 },
  notebookCopy: { flex: 1, minWidth: 0, paddingVertical: 8 },
  notebookHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notebookKicker: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 10, letterSpacing: 0.85 },
  latestBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1.25,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    transform: [{ rotate: '-2deg' }],
  },
  latestBadgeText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 8.5, letterSpacing: 0.5 },
  notebookTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 17, lineHeight: 20, marginTop: 1 },
  notebookTitleCompact: { fontSize: 15, lineHeight: 18 },
  notebookNote: { marginTop: 1, fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 11.5, lineHeight: 15 },
  notebookArrow: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notebookArrowCompact: { width: 30, height: 30, borderRadius: 10 },

  guidePill: {
    minHeight: 34,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.paperTint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 13,
    paddingRight: 8,
    gap: 8,
  },
  guideText: { flex: 1, fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 11.5, lineHeight: 15 },
  guideDismiss: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
