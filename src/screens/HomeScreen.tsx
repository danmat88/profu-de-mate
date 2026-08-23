import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, type AppIconName } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { MiniGlyph } from '../components/MiniGlyph';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { prepareCapturedImage } from '../services/imagePipeline';
import { colors, fonts } from '../theme';
import type { FlowMode, RootStackParamList } from '../types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

type ModeOptionProps = {
  active: boolean;
  compact: boolean;
  icon: AppIconName;
  label: string;
  note: string;
  tone: 'violet' | 'peach';
  onPress: () => void;
};

function ModeOption({ active, compact, icon, label, note, tone, onPress }: ModeOptionProps) {
  const checkTone = tone === 'peach';
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeCardShadow,
        active && (checkTone ? styles.modeCardShadowPeach : styles.modeCardShadowViolet),
        pressed && styles.pressed,
      ]}
    >
      <View style={[
        styles.modeCard,
        compact && styles.modeCardCompact,
        active && (checkTone ? styles.modeCardCheckActive : styles.modeCardSolveActive),
      ]}>
        <View style={[styles.modeIcon, active && styles.modeIconActive]}>
          <AppIcon name={icon} size={compact ? 34 : 39} />
        </View>
        <View style={styles.modeCopy}>
          <View style={styles.modeTitleRow}>
            <Text numberOfLines={1} style={[styles.modeTitle, active && !checkTone && styles.modeTitleOnDark]}>{label}</Text>
            {active ? (
              <View style={[styles.selectedDot, !checkTone && styles.selectedDotOnDark]}>
                <Text style={[styles.selectedCheck, !checkTone && styles.selectedCheckOnDark]}>✓</Text>
              </View>
            ) : null}
          </View>
          {!compact ? <Text numberOfLines={1} style={[styles.modeNote, active && !checkTone && styles.modeNoteOnDark]}>{note}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const { contentWidth, gutter, isNarrow, isVeryNarrow, isVeryShort, isShort } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [mode, setMode] = useState<FlowMode>('solve');
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const beam = useRef(new Animated.Value(0)).current;
  const modePop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) {
      entrance.setValue(1);
      float.setValue(0.45);
      beam.setValue(0.5);
      return;
    }
    Animated.spring(entrance, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 6 }).start();
    const floating = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1550, useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1550, useNativeDriver: true }),
    ]));
    const scanning = Animated.loop(Animated.sequence([
      Animated.timing(beam, { toValue: 1, duration: 1750, useNativeDriver: true }),
      Animated.delay(350),
      Animated.timing(beam, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    floating.start();
    scanning.start();
    return () => { floating.stop(); scanning.stop(); };
  }, [beam, entrance, float, reducedMotion]);

  const chooseMode = (next: FlowMode) => {
    if (next === mode) return;
    void Haptics.selectionAsync();
    setGalleryError(null);
    setMode(next);
    if (reducedMotion) return;
    modePop.setValue(0.94);
    Animated.spring(modePop, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 11 }).start();
  };

  const openCapture = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Capture', { mode });
  };

  const openGallery = useCallback(async () => {
    if (galleryBusy) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGalleryError(null);
    setGalleryBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 1,
        exif: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri || asset.width <= 0 || asset.height <= 0) {
        throw new Error('invalid-image');
      }
      const image = await prepareCapturedImage(asset, 'gallery');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate('Review', { mode, image });
    } catch {
      setGalleryError('Fotografia nu a putut fi deschisă. Alege altă imagine.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setGalleryBusy(false);
    }
  }, [galleryBusy, mode, navigation]);

  const isSolve = mode === 'solve';
  const stageHeight = isVeryShort ? 226 : isShort ? 252 : 278;
  const mascotWidth = isVeryNarrow ? 128 : 148;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 10) + 10 }}
      >
        <View style={[styles.page, { width: contentWidth }]}>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.logoShadow} />
              <View style={styles.logo}>
                <Image accessible={false} source={require('../../assets/brand/profu-mark-v2.png')} resizeMode="contain" style={styles.logoImage} />
              </View>
              <View style={styles.brandCopy}>
                <Text style={[styles.brand, isVeryNarrow && styles.brandNarrow]}>Profu’ de mate</Text>
                <Text style={styles.brandNote}>EXPLICAȚII PAS CU PAS</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Deschide setările"
              hitSlop={5}
              onPress={() => navigation.navigate('Settings')}
              style={({ pressed }) => [styles.settingsShadow, pressed && styles.pressed]}
            >
              <View style={styles.settingsButton}><AppIcon name="settings" size={36} /></View>
            </Pressable>
          </View>

          <Animated.View style={[styles.intro, {
            opacity: entrance,
            transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
          }]}>
            <View style={styles.kickerRow}>
              <View style={styles.kickerMark}><Text style={styles.kickerMarkText}>✦</Text></View>
              <Text style={styles.kicker}>PROFU’ E PREGĂTIT</Text>
            </View>
            <Text numberOfLines={2} style={[styles.title, isNarrow && styles.titleNarrow]}>Cu ce vrei să <Text style={styles.titleAccent}>începem?</Text></Text>
          </Animated.View>

          <Animated.View
            accessibilityRole="tablist"
            style={[styles.modeRow, {
              opacity: entrance,
              transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }]}
          >
            <ModeOption active={isSolve} compact={isVeryNarrow} icon="camera" label="Rezolvă" note="o problemă" tone="violet" onPress={() => chooseMode('solve')} />
            <ModeOption active={!isSolve} compact={isVeryNarrow} icon="verify" label="Verifică" note="o rezolvare" tone="peach" onPress={() => chooseMode('check')} />
          </Animated.View>

          <Animated.View
            style={[
              styles.cameraStageShadow,
              { height: stageHeight, opacity: entrance, transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] },
            ]}
          >
            <View style={[styles.cameraStage, !isSolve && styles.cameraStageCheck]}>
              <View style={[styles.stageSticker, !isSolve && styles.stageStickerCheck]}>
                <Text style={styles.stageStickerText}>{isSolve ? 'PAS CU PAS' : 'FIECARE PAS'}</Text>
              </View>

              <View style={styles.stageContent}>
                <Animated.View style={[styles.focusFrame, { transform: [{ scale: modePop }] }]}>
                  <View style={[styles.focusCorner, styles.focusCornerTL]} />
                  <View style={[styles.focusCorner, styles.focusCornerTR]} />
                  <View style={[styles.focusCorner, styles.focusCornerBL]} />
                  <View style={[styles.focusCorner, styles.focusCornerBR]} />
                  <AppIcon name={isSolve ? 'scan' : 'verify'} size={isVeryNarrow ? 58 : 68} />
                  <Animated.View style={[styles.scanBeam, {
                    opacity: beam.interpolate({ inputRange: [0, 0.12, 0.88, 1], outputRange: [0, 0.8, 0.8, 0] }),
                    transform: [{ translateY: beam.interpolate({ inputRange: [0, 1], outputRange: [-46, 47] }) }],
                  }]} />
                </Animated.View>
                <View style={styles.stageCopy}>
                  <Text numberOfLines={1} style={styles.stageEyebrow}>{isSolve ? 'REZOLVĂ O PROBLEMĂ' : 'VERIFICĂ O REZOLVARE'}</Text>
                  <Text numberOfLines={2} style={[styles.stageTitle, isVeryNarrow && styles.stageTitleNarrow]}>{isSolve ? 'Fotografiază problema.' : 'Fotografiază rezolvarea.'}</Text>
                  <Text numberOfLines={2} style={[styles.stageNote, galleryError && styles.stageNoteError]}>{galleryError ?? (isSolve ? 'Îți explic rezolvarea pas cu pas.' : 'Îți arăt ce ai făcut bine și ce corectezi.')}</Text>
                </View>
              </View>

              <View style={styles.stageActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isSolve ? 'Fotografiază o problemă de rezolvat' : 'Fotografiază o rezolvare de verificat'}
                  onPress={openCapture}
                  style={({ pressed }) => [styles.captureRibbon, !isSolve && styles.captureRibbonCheck, pressed && styles.actionPressed]}
                >
                  <View style={styles.captureRibbonIcon}><AppIcon name="camera" size={32} /></View>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.captureRibbonText}>
                    Deschide camera
                  </Text>
                  <MiniGlyph name="next" size={22} color={colors.ink} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Alege o fotografie din galerie"
                  disabled={galleryBusy}
                  onPress={() => void openGallery()}
                  style={({ pressed }) => [styles.galleryButton, galleryBusy && styles.galleryButtonBusy, pressed && styles.actionPressed]}
                >
                  {galleryBusy ? <ActivityIndicator size="small" color={colors.violetDeep} /> : <AppIcon name="gallery" size={30} />}
                  <Text style={styles.galleryButtonText}>{galleryBusy ? 'Deschid…' : 'Galerie'}</Text>
                </Pressable>
              </View>

              <Animated.View pointerEvents="none" style={[styles.mascotWrap, {
                width: mascotWidth,
                height: mascotWidth * 1.08,
                transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [3, -5] }) }, { rotate: '3deg' }],
              }]}>
                <Image accessible={false} source={require('../../assets/profu-mascot-v2.png')} resizeMode="contain" style={styles.mascot} />
              </Animated.View>
            </View>
          </Animated.View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Deschide caietul cu lecții salvate"
            onPress={() => navigation.navigate('Notebook')}
            style={({ pressed }) => [styles.notebookShadow, pressed && styles.pressed]}
          >
            <View style={styles.notebookShelf}>
              <View style={styles.notebookSpine} />
              <View style={styles.notebookIcon}><AppIcon name="notebook" size={46} /></View>
              <View style={styles.notebookCopy}>
                <Text style={styles.notebookKicker}>LECȚII SALVATE</Text>
                <Text style={styles.notebookTitle}>Revezi ce ai lucrat</Text>
              </View>
              <View style={styles.notebookArrow}><MiniGlyph name="next" size={20} color={colors.paper} /></View>
            </View>
          </Pressable>

          <View accessible accessibilityLabel="Cum funcționează: fotografiezi, înțelegi și salvezi lecția" style={styles.processRail}>
            <Text style={styles.processKicker}>CUM FUNCȚIONEAZĂ</Text>
            <View style={styles.processRow}>
              <View style={styles.processStep}>
                <View style={[styles.processIcon, styles.processIconLime]}><AppIcon name="camera" size={25} /></View>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.processLabel}>Fotografiezi</Text>
              </View>
              <MiniGlyph name="next" size={16} color={colors.violetDeep} />
              <View style={styles.processStep}>
                <View style={[styles.processIcon, styles.processIconPeach]}><AppIcon name="explain" size={25} /></View>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.processLabel}>Înțelegi</Text>
              </View>
              <MiniGlyph name="next" size={16} color={colors.violetDeep} />
              <View style={styles.processStep}>
                <View style={[styles.processIcon, styles.processIconCyan]}><AppIcon name="notebook" size={25} /></View>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.processLabel}>Salvezi</Text>
              </View>
            </View>
          </View>

          <View style={styles.promise}>
            <Text style={styles.promiseSpark}>✦</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.promiseText}>Îți explic de ce, nu îți dau doar răspunsul.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  page: { flex: 1, maxWidth: 560, alignSelf: 'center' },
  pressed: { transform: [{ translateY: 2 }], opacity: 0.94 },
  header: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, position: 'relative' },
  brandCopy: { flex: 1, minWidth: 0 },
  logoShadow: { position: 'absolute', left: 3, top: 5, width: 46, height: 46, borderRadius: 15, backgroundColor: colors.ink },
  logo: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.lime, borderWidth: 2.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', transform: [{ rotate: '-3deg' }] },
  logoImage: { width: 43, height: 43 },
  brand: { fontFamily: fonts.display, color: colors.ink, fontSize: 20, lineHeight: 24 },
  brandNarrow: { fontSize: 18 },
  brandNote: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7.5, letterSpacing: 0.9, marginTop: -1 },
  settingsShadow: { width: 46, height: 49, borderRadius: 15, backgroundColor: colors.ink, marginLeft: 9 },
  settingsButton: { width: 46, height: 46, borderRadius: 15, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  intro: { marginTop: 8 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  kickerMark: { width: 24, height: 24, borderRadius: 8, backgroundColor: colors.peach, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }] },
  kickerMarkText: { fontFamily: fonts.display, color: colors.ink, fontSize: 14, lineHeight: 18 },
  kicker: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 9.5, letterSpacing: 1.45 },
  title: { minHeight: 40, maxWidth: 470, marginTop: 5, fontFamily: fonts.display, color: colors.ink, fontSize: 31, lineHeight: 34, letterSpacing: -0.4 },
  titleNarrow: { fontSize: 28, lineHeight: 31 },
  titleAccent: { color: colors.violet },
  modeRow: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 14 },
  modeCardShadow: { flex: 1, minWidth: 0, height: 82, borderRadius: 20, backgroundColor: colors.ink },
  modeCardShadowViolet: { backgroundColor: '#32126E' },
  modeCardShadowPeach: { backgroundColor: '#9B3D29' },
  modeCard: { height: 77, borderRadius: 19, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, gap: 6 },
  modeCardCompact: { paddingHorizontal: 6, gap: 3 },
  modeCardSolveActive: { backgroundColor: colors.violet },
  modeCardCheckActive: { backgroundColor: colors.peach },
  modeIcon: { width: 45, height: 45, borderRadius: 14, backgroundColor: colors.canvasDeep, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  modeIconActive: { backgroundColor: colors.paper },
  modeCopy: { flex: 1, minWidth: 0 },
  modeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modeTitle: { flexShrink: 1, fontFamily: fonts.display, color: colors.ink, fontSize: 17, lineHeight: 21 },
  modeTitleOnDark: { color: colors.paper },
  modeNote: { fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 9.5, marginTop: 1 },
  modeNoteOnDark: { color: '#EEE7FF' },
  selectedDot: { width: 17, height: 17, borderRadius: 7, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  selectedDotOnDark: { backgroundColor: colors.lime },
  selectedCheck: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 10, lineHeight: 13 },
  selectedCheckOnDark: { color: colors.ink },
  cameraStageShadow: { width: '100%', borderRadius: 28, backgroundColor: colors.ink, paddingBottom: 7 },
  cameraStage: { flex: 1, overflow: 'hidden', borderWidth: 3, borderColor: colors.ink, borderRadius: 27, backgroundColor: '#6F37E8' },
  cameraStageCheck: { backgroundColor: '#6A36D7' },
  stageSticker: { position: 'absolute', left: 15, top: 13, zIndex: 3, borderWidth: 2, borderColor: colors.ink, borderRadius: 9, backgroundColor: colors.lime, paddingHorizontal: 9, paddingVertical: 4, transform: [{ rotate: '-2deg' }] },
  stageStickerCheck: { backgroundColor: colors.peach },
  stageStickerText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 7.5, letterSpacing: 0.9 },
  stageContent: { position: 'relative', zIndex: 2, flex: 1, flexDirection: 'row', alignItems: 'center', paddingTop: 35, paddingBottom: 73, paddingHorizontal: 17, gap: 14 },
  focusFrame: { width: 104, height: 102, alignItems: 'center', justifyContent: 'center' },
  focusCorner: { position: 'absolute', width: 23, height: 23, borderColor: colors.lime },
  focusCornerTL: { left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 7 },
  focusCornerTR: { right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 7 },
  focusCornerBL: { left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 7 },
  focusCornerBR: { right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 7 },
  scanBeam: { position: 'absolute', left: 11, right: 11, height: 3, borderRadius: 2, backgroundColor: colors.lime },
  stageCopy: { flex: 1, minWidth: 0, paddingRight: 2 },
  stageEyebrow: { fontFamily: fonts.bodyBold, color: colors.lime, fontSize: 8, letterSpacing: 1.05 },
  stageTitle: { height: 49, maxWidth: 250, marginTop: 4, fontFamily: fonts.display, color: colors.paper, fontSize: 21, lineHeight: 24 },
  stageTitleNarrow: { fontSize: 18, lineHeight: 21 },
  stageNote: { height: 30, maxWidth: 230, marginTop: 2, fontFamily: fonts.body, color: '#E7E0FA', fontSize: 10.5, lineHeight: 14 },
  stageNoteError: { color: '#FFF0A9', fontFamily: fonts.bodyBold },
  stageActions: { position: 'absolute', zIndex: 3, left: 10, right: 10, bottom: 10, height: 54, flexDirection: 'row', gap: 8 },
  captureRibbon: { flex: 1, minWidth: 0, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 16, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, gap: 6 },
  captureRibbonCheck: { backgroundColor: colors.peach },
  captureRibbonIcon: { width: 35, height: 35, borderRadius: 11, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  captureRibbonText: { flex: 1, fontFamily: fonts.display, color: colors.ink, fontSize: 16 },
  galleryButton: { width: 76, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 16, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', gap: 0 },
  galleryButtonBusy: { opacity: 0.72 },
  galleryButtonText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9.5, lineHeight: 12 },
  actionPressed: { transform: [{ translateY: 2 }], opacity: 0.92 },
  mascotWrap: { position: 'absolute', zIndex: 0, right: -13, bottom: 45, opacity: 0.13 },
  mascot: { width: '100%', height: '100%' },
  notebookShadow: { height: 73, marginTop: 13, borderRadius: 20, backgroundColor: colors.ink },
  notebookShelf: { height: 68, overflow: 'hidden', borderRadius: 19, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', paddingRight: 10 },
  notebookSpine: { alignSelf: 'stretch', width: 8, backgroundColor: colors.cyan, borderRightWidth: 2, borderRightColor: colors.ink },
  notebookIcon: { width: 58, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  notebookCopy: { flex: 1, minWidth: 0 },
  notebookKicker: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7.5, letterSpacing: 1.05 },
  notebookTitle: { marginTop: 1, fontFamily: fonts.display, color: colors.ink, fontSize: 15, lineHeight: 18 },
  notebookArrow: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  processRail: { minHeight: 78, marginTop: 11, borderTopWidth: 2, borderBottomWidth: 2, borderColor: '#DCCEF5', paddingVertical: 7, paddingHorizontal: 4 },
  processKicker: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7.5, letterSpacing: 1.15, textAlign: 'center', marginBottom: 4 },
  processRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  processStep: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  processIcon: { width: 34, height: 34, borderRadius: 11, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-2deg' }] },
  processIconLime: { backgroundColor: colors.limeSoft },
  processIconPeach: { backgroundColor: '#FFE0D6' },
  processIconCyan: { backgroundColor: '#CFF7FA' },
  processLabel: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9.5 },
  promise: { minHeight: 37, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  promiseSpark: { fontFamily: fonts.display, color: colors.violet, fontSize: 15 },
  promiseText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 10.5 },
});
