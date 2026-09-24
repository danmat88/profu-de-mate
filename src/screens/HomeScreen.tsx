import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, type AppIconName } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { MiniGlyph } from '../components/MiniGlyph';
import { PlayfulLoader } from '../components/PlayfulLoader';
import { Text } from '../components/Typography';
import { useCommercial } from '../context/CommercialContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import * as Haptics from '../services/haptics';
import { getPreparedPendingAnalysis, preparePendingAnalysisOnStartup, type PendingAnalysis } from '../services/pendingAnalysis';
import { assertSessionActive, captureSession } from '../services/sessionGuard';
import { colors, fonts } from '../theme';
import type { FlowMode, RootStackParamList } from '../types';
import { allowancePresentation } from '../utils/commercialPresentation';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

function HomeViewport({ allowScroll, children }: { allowScroll: boolean; children: ReactNode }) {
  if (allowScroll) {
    return <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollViewport}>{children}</ScrollView>;
  }
  return <View style={styles.viewport}>{children}</View>;
}

function ModeOption({ active, compact, icon, label, note, tone, disabled, onPress }: {
  active: boolean;
  compact: boolean;
  icon: AppIconName;
  label: string;
  note: string;
  tone: 'violet' | 'peach';
  disabled: boolean;
  onPress: () => void;
}) {
  const peach = tone === 'peach';
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeShadow,
        active && (peach ? styles.modeShadowPeach : styles.modeShadowViolet),
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={[
        styles.modeCard,
        compact && styles.modeCardCompact,
        active && (peach ? styles.modeCardCheck : styles.modeCardSolve),
      ]}>
        <View style={[styles.modeIcon, active && styles.modeIconActive]}><AppIcon name={icon} size={compact ? 31 : 36} /></View>
        <View style={styles.modeCopy}>
          <Text numberOfLines={1} style={[styles.modeTitle, active && !peach && styles.modeTitleOnDark]}>{label}</Text>
          {!compact ? <Text numberOfLines={1} style={[styles.modeNote, active && !peach && styles.modeNoteOnDark]}>{note}</Text> : null}
        </View>
        {active ? (
          <View style={[styles.selectedDot, !peach && styles.selectedDotOnDark]}>
            <MiniGlyph name="check" size={11} color={colors.ink} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function SmallSourceButton({ icon, label, onPress, disabled, busy = false }: {
  icon: AppIconName;
  label: string;
  onPress: () => void;
  disabled: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.smallSource, pressed && styles.actionPressed, disabled && styles.disabled]}
    >
      {busy ? <PlayfulLoader micro /> : <AppIcon name={icon} size={28} />}
      <Text numberOfLines={1} style={styles.smallSourceText}>{busy ? 'Deschid…' : label}</Text>
    </Pressable>
  );
}

function ProcessStep({ icon, label, tone }: { icon: AppIconName; label: string; tone: 'lime' | 'peach' | 'cyan' }) {
  return (
    <View style={styles.processStep}>
      <View style={[styles.processIcon, tone === 'lime' ? styles.processIconLime : tone === 'peach' ? styles.processIconPeach : styles.processIconCyan]}>
        <AppIcon name={icon} size={24} />
      </View>
      <Text numberOfLines={1} style={styles.processLabel}>{label}</Text>
    </View>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const { contentWidth, isNarrow, isVeryNarrow, isVeryShort, isShort, isLargeText, isVeryLargeText } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const {
    access,
    status: commercialStatus,
    refresh: refreshCommercialAccess,
    refreshIfStale: refreshCommercialAccessIfStale,
  } = useCommercial();
  const [mode, setMode] = useState<FlowMode>('solve');
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [pendingAnalysis, setPendingAnalysis] = useState<PendingAnalysis | null>(() => getPreparedPendingAnalysis() ?? null);
  const navigationLocked = useRef(false);
  const galleryLocked = useRef(false);
  const alive = useRef(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    alive.current = true;
    navigationLocked.current = false;
    galleryLocked.current = false;
    void preparePendingAnalysisOnStartup().then((pending) => {
      if (active) setPendingAnalysis(pending);
    });
    void refreshCommercialAccessIfStale();
    return () => { active = false; alive.current = false; };
  }, [refreshCommercialAccessIfStale]));

  const chooseMode = (next: FlowMode) => {
    if (next === mode || pendingAnalysis) return;
    Haptics.selection();
    setGalleryError(null);
    setMode(next);
  };

  const resume = useCallback(() => {
    const pending = getPreparedPendingAnalysis();
    if (!pending) {
      setPendingAnalysis(null);
      return false;
    }
    if (pending.schemaVersion === 3) navigation.navigate('MathProcessing', { ...pending, origin: 'home' });
    else navigation.navigate('Processing', { ...pending, origin: 'home' });
    return true;
  }, [navigation]);

  const openCapture = () => {
    if (navigationLocked.current || galleryLocked.current) return;
    navigationLocked.current = true;
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    if (!resume()) navigation.navigate('Capture', { mode });
  };

  const openMath = () => {
    if (navigationLocked.current || galleryLocked.current) return;
    navigationLocked.current = true;
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    if (!resume()) navigation.navigate('MathInput', { mode });
  };

  const openNotebook = () => {
    if (navigationLocked.current || galleryLocked.current) return;
    navigationLocked.current = true;
    Haptics.selection();
    navigation.navigate('Notebook');
  };

  const openGallery = useCallback(async () => {
    if (galleryLocked.current || navigationLocked.current) return;
    if (resume()) return;
    galleryLocked.current = true;
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    setGalleryError(null);
    setGalleryBusy(true);
    try {
      const session = captureSession();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 1,
        exif: false,
      });
      assertSessionActive(session);
      if (!alive.current || result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri || asset.width <= 0 || asset.height <= 0) throw new Error('invalid-image');
      const image = { uri: asset.uri, width: asset.width, height: asset.height, source: 'gallery' as const };
      Haptics.notification(Haptics.NotificationFeedbackType.Success);
      navigation.navigate('Review', { mode, image });
    } catch {
      if (alive.current) setGalleryError('Fotografia nu s-a deschis. Încearcă alta.');
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    } finally {
      galleryLocked.current = false;
      if (alive.current) setGalleryBusy(false);
    }
  }, [mode, navigation, resume]);

  const activeMode = pendingAnalysis?.mode ?? mode;
  const isSolve = activeMode === 'solve';
  const hasPendingAnalysis = Boolean(pendingAnalysis);
  const allowance = allowancePresentation(access, commercialStatus);
  const openAllowance = () => {
    if (allowance.canOpenAccess && access) navigation.navigate('Paywall', { source: 'home', access });
    else if (allowance.canRetry) void refreshCommercialAccess();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <HomeViewport allowScroll={isLargeText}>
        <View style={[styles.page, { width: contentWidth, paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={[styles.header, isVeryShort && styles.headerCompact]}>
            <View style={styles.brandRow}>
              <View style={styles.logoShadow} />
              <View style={styles.logo}>
                <Image accessible={false} source={require('../../assets/brand/profu-mark-v2.png')} resizeMode="contain" style={styles.logoImage} />
              </View>
              <View style={styles.brandCopy}>
                <Text numberOfLines={1} style={[styles.brand, isVeryNarrow && styles.brandNarrow]}>Profu’ de mate</Text>
                <Text numberOfLines={1} style={styles.brandNote}>EXPLICAȚII PAS CU PAS</Text>
              </View>
            </View>

            <Pressable accessibilityRole="button" accessibilityLabel={allowance.accessibilityLabel}
              accessibilityState={{ disabled: !allowance.canOpenAccess && !allowance.canRetry }}
              disabled={!allowance.canOpenAccess && !allowance.canRetry} onPress={openAllowance}
              style={({ pressed }) => [styles.allowanceShadow, pressed && styles.pressed]}>
              <View style={[styles.allowancePill, access?.premium.active && styles.allowancePillPremium]}>
                {!access && commercialStatus === 'resolving' ? <PlayfulLoader micro /> : <>
                  <MiniGlyph name={access?.premium.active ? 'spark' : 'dot'} size={13} color={colors.ink} />
                  <View style={styles.allowanceCopy}>
                    <Text numberOfLines={1} style={styles.allowanceText}>{allowance.label}</Text>
                    <Text numberOfLines={1} style={styles.allowanceNote}>{allowance.note}</Text>
                  </View>
                </>}
              </View>
            </Pressable>

            <Pressable accessibilityRole="button" accessibilityLabel="Deschide setările" hitSlop={5}
              onPress={() => navigation.navigate('Settings')} style={({ pressed }) => [styles.settingsShadow, pressed && styles.pressed]}>
              <View style={styles.settingsButton}><AppIcon name="settings" size={34} /></View>
            </Pressable>
          </View>

          <View style={[styles.composition, isVeryShort && styles.compositionCompact, isLargeText && styles.compositionLarge]}>
            <View style={[styles.intro, isVeryShort && styles.introCompact]}>
              <View style={styles.kickerRow}>
                <View style={styles.kickerMark}><Text style={styles.kickerMarkText}>✦</Text></View>
                <Text style={styles.kicker}>{hasPendingAnalysis ? 'ANALIZA TA TE AȘTEAPTĂ' : 'PROFU’ E PREGĂTIT'}</Text>
              </View>
              <Text numberOfLines={isLargeText ? 3 : 2} style={[styles.title, isNarrow && !isLargeText && styles.titleNarrow]}>
                {hasPendingAnalysis ? 'Continuăm de unde ai rămas?' : <>Cu ce vrei să <Text style={styles.titleAccent}>începem?</Text></>}
              </Text>
            </View>

            <View accessibilityRole="tablist" style={[styles.modeRow, isVeryShort && styles.modeRowCompact, isLargeText && styles.modeRowLarge]}>
              <ModeOption active={isSolve} compact={isVeryShort || isVeryNarrow} icon="camera" label="Rezolvă" note="o problemă" tone="violet" disabled={hasPendingAnalysis || galleryBusy} onPress={() => chooseMode('solve')} />
              <ModeOption active={!isSolve} compact={isVeryShort || isVeryNarrow} icon="verify" label="Verifică" note="o rezolvare" tone="peach" disabled={hasPendingAnalysis || galleryBusy} onPress={() => chooseMode('check')} />
            </View>

            <View style={[styles.cameraStageShadow, isShort && styles.cameraStageShort, isVeryShort && styles.cameraStageCompact, isLargeText && styles.cameraStageLarge, isVeryLargeText && styles.cameraStageVeryLarge]}>
              <LinearGradient colors={isSolve ? ['#8450FF', '#5C27D8'] : ['#7750EE', '#5429C6']}
                start={{ x: 0.04, y: 0 }} end={{ x: 0.96, y: 1 }} style={styles.cameraStage}>
                <View pointerEvents="none" style={styles.stageGlow} />
                <View style={[styles.stageSticker, !isSolve && styles.stageStickerCheck]}>
                  <Text style={styles.stageStickerText}>{hasPendingAnalysis ? 'ANALIZĂ ÎN CURS' : isSolve ? 'PAS CU PAS' : 'FIECARE PAS'}</Text>
                </View>

                <View style={[styles.stageContent, isVeryShort && styles.stageContentCompact, isLargeText && styles.stageContentLarge, isVeryLargeText && styles.stageContentVeryLarge]}>
                  <View style={styles.focusFrame}>
                    <View style={[styles.focusCorner, styles.focusCornerTL]} />
                    <View style={[styles.focusCorner, styles.focusCornerTR]} />
                    <View style={[styles.focusCorner, styles.focusCornerBL]} />
                    <View style={[styles.focusCorner, styles.focusCornerBR]} />
                    <AppIcon name={hasPendingAnalysis || isSolve ? 'scan' : 'verify'} size={isVeryNarrow ? 55 : 64} />
                    <View style={styles.scanBeam} />
                  </View>
                  <View style={styles.stageCopy}>
                    <Text numberOfLines={1} style={styles.stageEyebrow}>{hasPendingAnalysis ? 'REZULTATUL TĂU SE PREGĂTEȘTE' : isSolve ? 'REZOLVĂ O PROBLEMĂ' : 'VERIFICĂ O REZOLVARE'}</Text>
                    <Text numberOfLines={isLargeText ? 3 : 2} style={[styles.stageTitle, isVeryNarrow && styles.stageTitleNarrow]}>
                      {hasPendingAnalysis ? 'Revino la analiză.' : isSolve ? 'Fotografiază problema.' : 'Fotografiază rezolvarea.'}
                    </Text>
                    {!isVeryShort || galleryError ? <Text numberOfLines={isLargeText ? 4 : 2} style={[styles.stageNote, galleryError && styles.stageNoteError]}>
                      {hasPendingAnalysis ? 'Fotografia și progresul sunt păstrate.' : galleryError ?? (isSolve ? 'Îți explic fiecare pas.' : 'Vezi ce corectezi și de ce.')}
                    </Text> : null}
                  </View>
                </View>

                <View style={[styles.stageActions, isLargeText && styles.stageActionsLarge]}>
                  <Pressable accessibilityRole="button"
                    accessibilityLabel={hasPendingAnalysis ? 'Revino la analiza în curs' : isSolve ? 'Fotografiază o problemă de rezolvat' : 'Fotografiază o rezolvare de verificat'}
                    disabled={galleryBusy} onPress={openCapture}
                    style={({ pressed }) => [styles.captureRibbon, !isSolve && styles.captureRibbonCheck, pressed && styles.actionPressed, galleryBusy && styles.disabled]}>
                    <View style={styles.captureRibbonIcon}><AppIcon name={hasPendingAnalysis ? 'scan' : 'camera'} size={30} /></View>
                    <Text numberOfLines={1} style={styles.captureRibbonText}>{hasPendingAnalysis ? 'Continuă' : 'Cameră'}</Text>
                    <MiniGlyph name="next" size={20} color={colors.ink} />
                  </Pressable>
                  {!hasPendingAnalysis ? <>
                    <SmallSourceButton icon="gallery" label="Galerie" onPress={() => void openGallery()} disabled={galleryBusy} busy={galleryBusy} />
                    <SmallSourceButton icon="practice" label="Scrie" onPress={openMath} disabled={galleryBusy} />
                  </> : null}
                </View>

                <View pointerEvents="none" style={styles.mascotWrap}>
                  <Image accessible={false} source={require('../../assets/profu-mascot-v2.png')} resizeMode="contain" style={styles.mascot} />
                </View>
              </LinearGradient>
            </View>

            <Pressable accessibilityRole="button" accessibilityLabel="Deschide caietul cu lecții salvate" onPress={openNotebook}
              style={({ pressed }) => [styles.notebookShadow, isVeryShort && styles.notebookShadowCompact, isLargeText && styles.notebookShadowLarge, pressed && styles.pressed]}>
              <View style={styles.notebookShelf}>
                <View style={styles.notebookSpine} />
                <View style={styles.notebookIcon}><AppIcon name="notebook" size={42} /></View>
                <View style={styles.notebookCopy}>
                  <Text style={styles.notebookKicker}>LECȚII SALVATE</Text>
                  <Text numberOfLines={1} style={styles.notebookTitle}>Revezi ce ai lucrat</Text>
                </View>
                <View style={styles.notebookArrow}><MiniGlyph name="next" size={18} color={colors.paper} /></View>
              </View>
            </Pressable>

            <View accessible accessibilityLabel="Cum funcționează: fotografiezi, înțelegi și salvezi lecția"
              style={[styles.processRail, isVeryShort && styles.processRailCompact, isLargeText && styles.processRailLarge]}>
              <Text style={styles.processKicker}>CUM FUNCȚIONEAZĂ</Text>
              <View style={[styles.processRow, isLargeText && styles.processRowLarge]}>
                <ProcessStep icon="camera" label="Fotografiezi" tone="lime" />
                <MiniGlyph name="next" size={15} color={colors.violetDeep} />
                <ProcessStep icon="explain" label="Înțelegi" tone="peach" />
                <MiniGlyph name="next" size={15} color={colors.violetDeep} />
                <ProcessStep icon="notebook" label="Salvezi" tone="cyan" />
              </View>
            </View>

            <View style={styles.promise}>
              <Text style={styles.promiseSpark}>✦</Text>
              <Text numberOfLines={isLargeText ? 3 : 1} style={styles.promiseText}>Îți explic de ce, nu îți dau doar răspunsul.</Text>
            </View>
          </View>
        </View>
      </HomeViewport>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas, overflow: 'hidden' },
  viewport: { flex: 1, alignItems: 'center' },
  scrollViewport: { flexGrow: 1, alignItems: 'center', paddingVertical: 4 },
  page: { flex: 1, maxWidth: 560, alignSelf: 'center' },
  header: { flexShrink: 0, height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCompact: { height: 52 },
  brandRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9, position: 'relative' },
  brandCopy: { flex: 1, minWidth: 0 },
  logoShadow: { position: 'absolute', left: 3, top: 7, width: 43, height: 43, borderRadius: 14, backgroundColor: colors.ink },
  logo: { width: 43, height: 43, borderRadius: 14, backgroundColor: colors.lime, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', transform: [{ rotate: '-3deg' }] },
  logoImage: { width: 40, height: 40 },
  brand: { fontFamily: fonts.display, color: colors.ink, fontSize: 19, lineHeight: 23 },
  brandNarrow: { fontSize: 17 },
  brandNote: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7, letterSpacing: 0.8, marginTop: -1 },
  allowanceShadow: { flexShrink: 0, height: 42, width: 84, marginLeft: 6, paddingBottom: 3, borderRadius: 14, backgroundColor: colors.ink },
  allowancePill: { flex: 1, borderRadius: 13, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.limeSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 6 },
  allowancePillPremium: { backgroundColor: colors.lime },
  allowanceCopy: { flex: 1, minWidth: 0 },
  allowanceText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9, lineHeight: 11 },
  allowanceNote: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 6, letterSpacing: 0.5, lineHeight: 8 },
  settingsShadow: { flexShrink: 0, width: 44, height: 47, marginLeft: 7, borderRadius: 15, backgroundColor: colors.ink },
  settingsButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.86, transform: [{ translateY: 2 }] },
  disabled: { opacity: 0.48 },
  composition: { flex: 1, justifyContent: 'center', gap: 9 },
  compositionCompact: { gap: 6 },
  compositionLarge: { flex: 0, justifyContent: 'flex-start', gap: 12 },
  intro: { flexShrink: 0, height: 60, justifyContent: 'center' },
  introCompact: { height: 44 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  kickerMark: { width: 23, height: 23, borderRadius: 8, backgroundColor: colors.peach, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }] },
  kickerMarkText: { fontFamily: fonts.display, color: colors.ink, fontSize: 14, lineHeight: 18 },
  kicker: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8.5, letterSpacing: 1.2 },
  title: { marginTop: 3, fontFamily: fonts.display, color: colors.ink, fontSize: 29, lineHeight: 32, letterSpacing: -0.35 },
  titleNarrow: { fontSize: 26, lineHeight: 29 },
  titleAccent: { color: colors.violet },
  modeRow: { flexShrink: 0, height: 74, flexDirection: 'row', gap: 9 },
  modeRowCompact: { height: 60 },
  modeRowLarge: { height: 172, flexDirection: 'column' },
  modeShadow: { flex: 1, minWidth: 0, paddingBottom: 5, borderRadius: 20, backgroundColor: colors.ink },
  modeShadowViolet: { backgroundColor: '#32126E' },
  modeShadowPeach: { backgroundColor: '#9B3D29' },
  modeCard: { flex: 1, borderRadius: 19, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 7 },
  modeCardCompact: { paddingHorizontal: 6, gap: 4 },
  modeCardSolve: { backgroundColor: colors.violet },
  modeCardCheck: { backgroundColor: colors.peach },
  modeIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: colors.canvasDeep, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  modeIconActive: { backgroundColor: colors.paper },
  modeCopy: { flex: 1, minWidth: 0 },
  modeTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 16, lineHeight: 19 },
  modeTitleOnDark: { color: colors.paper },
  modeNote: { marginTop: 1, fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 10, lineHeight: 12 },
  modeNoteOnDark: { color: '#EEE7FF' },
  selectedDot: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 7, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  selectedDotOnDark: { backgroundColor: colors.lime },
  cameraStageShadow: { flexShrink: 0, height: 258, paddingBottom: 7, borderRadius: 28, backgroundColor: colors.ink },
  cameraStageShort: { height: 232 },
  cameraStageCompact: { height: 194 },
  cameraStageLarge: { height: 460 },
  cameraStageVeryLarge: { height: 610 },
  cameraStage: { flex: 1, overflow: 'hidden', borderWidth: 2.5, borderColor: colors.ink, borderRadius: 27 },
  stageGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: -112, right: -64, backgroundColor: 'rgba(255,255,255,0.1)' },
  stageSticker: { position: 'absolute', left: 14, top: 12, zIndex: 3, borderWidth: 2, borderColor: colors.ink, borderRadius: 9, backgroundColor: colors.lime, paddingHorizontal: 8, paddingVertical: 4, transform: [{ rotate: '-2deg' }] },
  stageStickerCheck: { backgroundColor: colors.peach },
  stageStickerText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 7.5, letterSpacing: 0.85 },
  stageContent: { flex: 1, zIndex: 2, flexDirection: 'row', alignItems: 'center', paddingTop: 34, paddingBottom: 68, paddingHorizontal: 15, gap: 13 },
  stageContentCompact: { paddingTop: 31, paddingBottom: 61, paddingHorizontal: 11, gap: 9 },
  stageContentLarge: { paddingTop: 46, paddingBottom: 82, paddingHorizontal: 18 },
  stageContentVeryLarge: { flexDirection: 'column', justifyContent: 'center', paddingBottom: 88 },
  focusFrame: { flexShrink: 0, width: 96, height: 92, alignItems: 'center', justifyContent: 'center' },
  focusCorner: { position: 'absolute', width: 23, height: 23, borderColor: colors.lime },
  focusCornerTL: { left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 7 },
  focusCornerTR: { right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 7 },
  focusCornerBL: { left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 7 },
  focusCornerBR: { right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 7 },
  scanBeam: { position: 'absolute', left: 10, right: 10, height: 3, borderRadius: 2, backgroundColor: colors.lime, opacity: 0.65 },
  stageCopy: { flex: 1, minWidth: 0, zIndex: 2 },
  stageEyebrow: { fontFamily: fonts.bodyBold, color: colors.lime, fontSize: 7.5, letterSpacing: 0.95 },
  stageTitle: { marginTop: 4, fontFamily: fonts.display, color: colors.paper, fontSize: 21, lineHeight: 24 },
  stageTitleNarrow: { fontSize: 18, lineHeight: 21 },
  stageNote: { maxWidth: 225, marginTop: 3, fontFamily: fonts.body, color: '#E7E0FA', fontSize: 11, lineHeight: 14 },
  stageNoteError: { color: '#FFF0A9', fontFamily: fonts.bodyBold },
  stageActions: { position: 'absolute', zIndex: 4, left: 9, right: 9, bottom: 9, height: 54, flexDirection: 'row', gap: 6 },
  stageActionsLarge: { height: 70 },
  captureRibbon: { flex: 1.3, minWidth: 0, paddingHorizontal: 8, borderWidth: 2, borderColor: colors.ink, borderRadius: 16, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', gap: 6 },
  captureRibbonCheck: { backgroundColor: colors.peach },
  captureRibbonIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  captureRibbonText: { flex: 1, fontFamily: fonts.display, color: colors.ink, fontSize: 14 },
  smallSource: { flex: 0.82, minWidth: 0, borderWidth: 2, borderColor: colors.ink, borderRadius: 16, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  smallSourceText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9.5, lineHeight: 12 },
  actionPressed: { opacity: 0.9, transform: [{ translateY: 2 }] },
  mascotWrap: { position: 'absolute', zIndex: 0, width: 122, height: 132, right: -17, bottom: 48, opacity: 0.13, transform: [{ rotate: '3deg' }] },
  mascot: { width: '100%', height: '100%' },
  notebookShadow: { flexShrink: 0, height: 62, paddingBottom: 5, borderRadius: 20, backgroundColor: colors.ink },
  notebookShadowCompact: { height: 53 },
  notebookShadowLarge: { height: 94 },
  notebookShelf: { flex: 1, overflow: 'hidden', borderRadius: 19, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', paddingRight: 9 },
  notebookSpine: { alignSelf: 'stretch', width: 7, backgroundColor: colors.cyan, borderRightWidth: 2, borderRightColor: colors.ink },
  notebookIcon: { width: 53, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  notebookCopy: { flex: 1, minWidth: 0 },
  notebookKicker: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7, letterSpacing: 0.95 },
  notebookTitle: { marginTop: 1, fontFamily: fonts.display, color: colors.ink, fontSize: 14, lineHeight: 17 },
  notebookArrow: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  processRail: { flexShrink: 0, height: 62, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: '#DCCEF5', paddingVertical: 5, paddingHorizontal: 3 },
  processRailCompact: { height: 52, paddingVertical: 3 },
  processRailLarge: { height: 112, paddingVertical: 9 },
  processKicker: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7, letterSpacing: 1.05, textAlign: 'center', marginBottom: 3 },
  processRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  processRowLarge: { minHeight: 70 },
  processStep: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  processIcon: { width: 31, height: 31, borderRadius: 10, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-2deg' }] },
  processIconLime: { backgroundColor: colors.limeSoft },
  processIconPeach: { backgroundColor: '#FFE0D6' },
  processIconCyan: { backgroundColor: '#CFF7FA' },
  processLabel: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 10.5 },
  promise: { flexShrink: 0, height: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  promiseSpark: { fontFamily: fonts.display, color: colors.violet, fontSize: 14 },
  promiseText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 10.5 },
});
