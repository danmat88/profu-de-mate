import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { ComicButton } from '../components/ComicButton';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { colors, fonts } from '../theme';
import type { FlowMode, RootStackParamList } from '../types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const { width, height, gutter, isNarrow, isShort, isCompact } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [mode, setMode] = useState<FlowMode>('solve');
  const entrance = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const beam = useRef(new Animated.Value(0)).current;
  const modeMotion = useRef(new Animated.Value(0)).current;
  const modePop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) {
      entrance.setValue(1);
      float.setValue(0.45);
      pulse.setValue(0);
      beam.setValue(0);
      return;
    }
    Animated.spring(entrance, { toValue: 1, useNativeDriver: true, speed: 7, bounciness: 7 }).start();
    const floating = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1650, useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1650, useNativeDriver: true }),
    ]), { iterations: 2 });
    const breathing = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1250, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1250, useNativeDriver: true }),
    ]), { iterations: 2 });
    const scanning = Animated.loop(Animated.sequence([
      Animated.timing(beam, { toValue: 1, duration: 1800, useNativeDriver: true }),
      Animated.delay(350),
      Animated.timing(beam, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]), { iterations: 2 });
    floating.start();
    breathing.start();
    scanning.start();
    return () => { floating.stop(); breathing.stop(); scanning.stop(); };
  }, [beam, entrance, float, pulse, reducedMotion]);

  const chooseMode = (next: FlowMode) => {
    if (next === mode) return;
    Haptics.selectionAsync();
    setMode(next);
    if (reducedMotion) {
      modeMotion.setValue(next === 'solve' ? 0 : 1);
      modePop.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.spring(modeMotion, { toValue: next === 'solve' ? 0 : 1, useNativeDriver: false, speed: 18, bounciness: 7 }),
      Animated.sequence([
        Animated.timing(modePop, { toValue: 0.82, duration: 90, useNativeDriver: true }),
        Animated.spring(modePop, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 12 }),
      ]),
    ]).start();
  };

  const openCapture = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Capture', { mode });
  };

  const isSolve = mode === 'solve';
  const segmentWidth = (width - gutter * 2 - 8) / 2;
  const portalSize = isCompact ? 188 : 220;
  const portalStageHeight = isShort ? 224 : Math.min(320, height * 0.39);
  const mascotSize = isCompact ? 92 : 112;
  const bottomSpace = Math.max(insets.bottom, 10);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <View style={[styles.content, { paddingHorizontal: gutter }]}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logoShadow} />
            <View style={styles.logo}>
              <Image accessible={false} source={require('../../assets/brand/profu-mark-v2.png')} resizeMode="contain" style={styles.logoImage} />
            </View>
            <View>
              <Text style={styles.brand}>Profu’ de mate</Text>
              <Text style={styles.brandNote}>ÎȚI ARATĂ CUM GÂNDEȘTI</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Deschide caietul" hitSlop={4} onPress={() => navigation.navigate('Notebook')} style={styles.notebookButton}>
              <AppIcon name="notebook" size={38} />
              <Text style={styles.notebookLabel}>Caiet</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Deschide setările" hitSlop={4} onPress={() => navigation.navigate('Settings')} style={styles.settingsButton}>
              <AppIcon name="settings" size={39} />
            </Pressable>
          </View>
        </View>

        <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
          <View style={styles.kickerRow}>
            <View style={styles.kickerLine} />
            <Text style={styles.kicker}>POZĂ. LOGICĂ. AHA!</Text>
          </View>
          <Text style={[styles.title, isNarrow && styles.titleNarrow]}>Matematica intră{`\n`}în <Text style={styles.titleAccent}>focus.</Text></Text>
          <Text style={styles.subtitle}>Prinde problema în cadru. Profu’ o citește și ți-o explică pe limba ta.</Text>
        </Animated.View>

        <Animated.View style={[styles.modeSwitch, isShort && styles.modeSwitchCompact, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]} accessibilityRole="tablist">
          <Animated.View style={[styles.modeIndicator, { width: segmentWidth, backgroundColor: modeMotion.interpolate({ inputRange: [0, 1], outputRange: [colors.violet, colors.peach] }), transform: [{ translateX: modeMotion.interpolate({ inputRange: [0, 1], outputRange: [0, segmentWidth] }) }] }]} />
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: isSolve }} onPress={() => chooseMode('solve')} style={styles.mode}>
            <AppIcon name="camera" size={37} />
            <Text style={[styles.modeText, isSolve && styles.modeTextActive]}>Rezolvă</Text>
          </Pressable>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: !isSolve }} onPress={() => chooseMode('check')} style={styles.mode}>
            <AppIcon name="verify" size={37} />
            <Text style={[styles.modeText, !isSolve && styles.modeTextCheck]}>Verifică</Text>
          </Pressable>
        </Animated.View>

        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={isSolve ? 'Fotografiază o problemă de rezolvat' : 'Fotografiază o rezolvare de verificat'}
          onPress={openCapture}
          style={[styles.portalStage, { height: portalStageHeight, opacity: entrance, transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}
        >
          <Animated.View style={[styles.portalEcho, { width: portalSize + 8, height: portalSize + 8, borderRadius: (portalSize + 8) / 2, transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.055] }) }], opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.2] }) }]} />
          <View style={[styles.portalShadow, { width: portalSize, height: portalSize, borderRadius: portalSize / 2 }]} />
          <View style={[styles.portal, { width: portalSize, height: portalSize, borderRadius: portalSize / 2 }, !isSolve && styles.portalCheck]}>
            <Animated.View style={[styles.portalBeam, { opacity: beam.interpolate({ inputRange: [0, 0.12, 0.88, 1], outputRange: [0, 0.65, 0.65, 0] }), transform: [{ translateY: beam.interpolate({ inputRange: [0, 1], outputRange: [-portalSize * 0.39, portalSize * 0.4] }) }] }]} />
            <Animated.View style={[styles.scanCorners, isCompact && styles.scanCornersCompact, { transform: [{ scale: modePop }] }]}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              <AppIcon name={isSolve ? 'scan' : 'verify'} size={isCompact ? 65 : 76} />
              <Text style={styles.portalTitle}>{isSolve ? 'Arată-mi problema' : 'Arată-mi rezolvarea'}</Text>
              <Text style={styles.portalHint}>o poză clară e suficientă</Text>
            </Animated.View>
          </View>
          <Animated.View style={[styles.mascotWrap, { width: mascotSize, height: mascotSize * 1.06, transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [4, -7] }) }, { rotate: '4deg' }] }]}>
            <Image accessible={false} source={require('../../assets/profu-mascot-v2.png')} resizeMode="contain" style={styles.mascot} />
          </Animated.View>
          <View style={[styles.sticker, !isSolve && styles.stickerCheck]}>
            <Text style={styles.stickerText}>{isSolve ? 'PAS CU PAS' : 'FĂRĂ JUDECATĂ'}</Text>
          </View>
        </AnimatedPressable>

      </View>
      <View style={[styles.actionDock, { paddingHorizontal: gutter, paddingBottom: bottomSpace }]}>
        <ComicButton
          compact
          title={isSolve ? 'Deschide camera' : 'Verifică-mi lucrarea'}
          subtitle={isSolve ? 'Profu’ explică, tu înțelegi.' : 'Vedem ce e bun și ce reparăm.'}
          icon={isSolve ? 'camera' : 'verify'}
          tone={isSolve ? 'lime' : 'peach'}
          onPress={openCapture}
          style={styles.primary}
        />

        <View style={styles.promise}>
          <View style={styles.promiseSpark}><Text style={styles.promiseSparkText}>✦</Text></View>
          <Text style={styles.promiseText}>Nu aruncă răspunsul. Îți arată de ce.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { flex: 1, minHeight: 0, paddingHorizontal: 18 },
  header: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, position: 'relative' },
  logoShadow: { position: 'absolute', left: 3, top: 5, width: 46, height: 46, borderRadius: 15, backgroundColor: colors.ink },
  logo: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.lime, borderWidth: 2.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', transform: [{ rotate: '-3deg' }] },
  logoImage: { width: 43, height: 43 },
  brand: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 19, lineHeight: 20 },
  brandNote: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7.5, letterSpacing: 0.9, marginTop: 2 },
  notebookButton: { height: 45, borderRadius: 15, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  settingsButton: { width: 45, height: 45, borderRadius: 15, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  notebookLabel: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12 },
  kickerRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  kickerLine: { width: 27, height: 5, borderRadius: 4, backgroundColor: colors.peach, transform: [{ rotate: '-4deg' }] },
  kicker: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 10, letterSpacing: 1.6 },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 39, lineHeight: 39, marginTop: 5, letterSpacing: -0.6 },
  titleNarrow: { fontSize: 34, lineHeight: 35 },
  titleAccent: { color: colors.violet },
  subtitle: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 14, lineHeight: 19, marginTop: 7, maxWidth: 350 },
  modeSwitch: { height: 62, marginTop: 17, padding: 4, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 2.5, borderColor: colors.ink, flexDirection: 'row' },
  modeSwitchCompact: { height: 56, marginTop: 13 },
  modeIndicator: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 14 },
  mode: { flex: 1, zIndex: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  modeText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 14 },
  modeTextActive: { color: colors.paper },
  modeTextCheck: { color: colors.ink },
  portalStage: { height: 282, alignItems: 'center', justifyContent: 'center', marginTop: 7 },
  portalEcho: { position: 'absolute', width: 228, height: 228, borderRadius: 114, backgroundColor: colors.violetSoft, borderWidth: 3, borderColor: colors.violet },
  portalShadow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: colors.ink, transform: [{ translateX: 8 }, { translateY: 10 }] },
  portal: { width: 220, height: 220, borderRadius: 110, backgroundColor: colors.violet, borderWidth: 4, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  portalCheck: { backgroundColor: '#5C35C7' },
  portalBeam: { position: 'absolute', left: 22, right: 22, height: 4, borderRadius: 3, backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: 0.9, shadowRadius: 8, elevation: 4 },
  scanCorners: { width: 154, height: 132, alignItems: 'center', justifyContent: 'center' },
  scanCornersCompact: { width: 138, height: 117 },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: colors.lime },
  cornerTL: { left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 8 },
  cornerTR: { right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 8 },
  cornerBL: { left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 8 },
  cornerBR: { right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 8 },
  portalTitle: { fontFamily: fonts.displaySemi, color: colors.paper, fontSize: 16, marginTop: 3 },
  portalHint: { fontFamily: fonts.body, color: '#DDD4FF', fontSize: 10, marginTop: 1 },
  mascotWrap: { position: 'absolute', width: 112, height: 119, right: 0, bottom: -9 },
  mascot: { width: '100%', height: '100%' },
  sticker: { position: 'absolute', left: 3, top: 35, backgroundColor: colors.lime, borderWidth: 2.5, borderColor: colors.ink, paddingHorizontal: 10, paddingVertical: 5, transform: [{ rotate: '-8deg' }] },
  stickerCheck: { backgroundColor: colors.peach },
  stickerText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9, letterSpacing: 1 },
  primary: { marginTop: 2 },
  actionDock: { backgroundColor: colors.canvas, borderTopWidth: 1.5, borderTopColor: colors.line, paddingTop: 10 },
  promise: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 4 },
  promiseSpark: { width: 20, height: 20, borderRadius: 7, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] },
  promiseSparkText: { fontFamily: fonts.display, color: colors.lime, fontSize: 12, lineHeight: 16 },
  promiseText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 11.5 },
});
