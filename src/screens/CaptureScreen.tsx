import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { MiniGlyph } from '../components/MiniGlyph';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Capture'>;

export function CaptureScreen({ navigation, route }: Props) {
  const [flash, setFlash] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const scan = useRef(new Animated.Value(0)).current;
  const shutterPulse = useRef(new Animated.Value(0)).current;
  const captureFlash = useRef(new Animated.Value(0)).current;
  const helpPop = useRef(new Animated.Value(0)).current;
  const capturing = useRef(false);
  const isCheck = route.params.mode === 'check';

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(scan, { toValue: 1, duration: 1850, useNativeDriver: true }),
      Animated.timing(scan, { toValue: 0, duration: 1850, useNativeDriver: true }),
    ]));
    const breathing = Animated.loop(Animated.sequence([
      Animated.timing(shutterPulse, { toValue: 1, duration: 1050, useNativeDriver: true }),
      Animated.timing(shutterPulse, { toValue: 0, duration: 1050, useNativeDriver: true }),
    ]));
    animation.start();
    breathing.start();
    return () => { animation.stop(); breathing.stop(); };
  }, [scan, shutterPulse]);

  const capture = () => {
    if (capturing.current) return;
    capturing.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.timing(captureFlash, { toValue: 1, duration: 70, useNativeDriver: true }),
      Animated.timing(captureFlash, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => navigation.navigate('Review', { mode: route.params.mode }));
  };

  const toggleHelp = () => {
    Haptics.selectionAsync();
    if (showHelp) {
      Animated.timing(helpPop, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => setShowHelp(false));
      return;
    }
    setShowHelp(true);
    Animated.spring(helpPop, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 9 }).start();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ComicBackdrop dark />
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide camera" onPress={() => navigation.goBack()} style={styles.roundButton}>
          <MiniGlyph name="close" size={29} color={colors.paper} />
        </Pressable>
        <View style={styles.modeChip}>
          <Animated.View style={[styles.liveDot, isCheck && styles.liveDotCheck, { opacity: scan.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }), transform: [{ scale: scan.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.08] }) }] }]} />
          <Text style={styles.modeChipText}>{isCheck ? 'VERIFICĂ REZOLVAREA' : 'REZOLVĂ PROBLEMA'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Bliț" onPress={() => { Haptics.selectionAsync(); setFlash((value) => !value); }} style={[styles.roundButton, flash && styles.roundButtonActive]}>
          <AppIcon name="flash" size={43} style={{ opacity: flash ? 1 : 0.5 }} />
        </Pressable>
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>{isCheck ? 'Prinde toată rezolvarea.' : 'Prinde problema în cadru.'}</Text>
        <Text style={styles.hint}>Ține telefonul drept. Marginile se detectează automat.</Text>
      </View>

      <View style={styles.finderShadow} />
      <View style={styles.finder}>
        <View style={styles.cameraNoiseA} />
        <View style={styles.cameraNoiseB} />
        <View style={styles.paperSheet}>
          <View style={styles.paperLine} />
          <View style={styles.paperLine} />
          <Text style={styles.paperLabel}>{isCheck ? 'Rezolvare:' : 'Rezolvați ecuația:'}</Text>
          <Text style={styles.equation}>2x² − 5x − 3 = 0</Text>
          {isCheck ? (
            <>
              <Text style={styles.handwriting}>Δ = 25 − 24 = 1</Text>
              <Text style={styles.handwriting}>x = (5 ± 1) / 4</Text>
            </>
          ) : <View style={styles.pencilDash} />}
        </View>
        <Animated.View style={[styles.scanLine, { transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [-128, 128] }) }] }]} />
        <Animated.View style={[styles.corner, styles.cornerTL, { opacity: scan.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) }]} />
        <Animated.View style={[styles.corner, styles.cornerTR, { opacity: scan.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) }]} />
        <Animated.View style={[styles.corner, styles.cornerBL, { opacity: scan.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) }]} />
        <Animated.View style={[styles.corner, styles.cornerBR, { opacity: scan.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) }]} />
        <View style={styles.detected}><MiniGlyph name="check" size={16} /><Text style={styles.detectedText}>Text detectat</Text></View>
      </View>

      <View style={styles.controls}>
        <Pressable accessibilityRole="button" onPress={capture} style={styles.sideControl}>
          <AppIcon name="gallery" size={49} />
          <Text style={styles.sideLabel}>Galerie</Text>
        </Pressable>
        <Animated.View style={{ transform: [{ scale: shutterPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) }] }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fă fotografia" onPress={capture} style={styles.shutterOuter}>
            <View style={styles.shutterMiddle}><AppIcon name="camera" size={68} /></View>
          </Pressable>
        </Animated.View>
        <Pressable accessibilityRole="button" onPress={toggleHelp} style={styles.sideControl}>
          <AppIcon name="help" size={49} />
          <Text style={styles.sideLabel}>Ajutor</Text>
        </Pressable>
      </View>
      {showHelp ? (
        <Animated.View style={[styles.helpBubble, { opacity: helpPop, transform: [{ translateY: helpPop.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }, { scale: helpPop.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}>
          <AppIcon name="hint" size={44} />
          <Text style={styles.helpText}>Lumină bună, foaia întreagă și telefonul paralel cu ea. Profu’ se ocupă de restul.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Închide ajutorul" onPress={toggleHelp} style={styles.helpClose}><MiniGlyph name="close" size={18} /></Pressable>
        </Animated.View>
      ) : null}
      <View style={styles.privacy}><AppIcon name="privacy" size={25} /><Text style={styles.privacyText}>Imaginea rămâne privată</Text></View>
      <Animated.View pointerEvents="none" style={[styles.captureFlash, { opacity: captureFlash }]} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  topBar: { height: 65, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundButton: { width: 43, height: 43, borderRadius: 15, backgroundColor: '#2A2351', borderWidth: 2, borderColor: '#8177A7', alignItems: 'center', justifyContent: 'center' },
  roundButtonActive: { backgroundColor: colors.lime, borderColor: colors.ink },
  modeChip: { height: 34, borderRadius: 13, backgroundColor: '#2A2351', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime },
  liveDotCheck: { backgroundColor: colors.peach },
  modeChipText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 9, letterSpacing: 0.7 },
  copy: { paddingHorizontal: 25, marginTop: 9, marginBottom: 19 },
  title: { fontFamily: fonts.display, color: colors.paper, fontSize: 29, lineHeight: 32, textAlign: 'center' },
  hint: { fontFamily: fonts.body, color: '#BDB5D6', fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 4 },
  finderShadow: { position: 'absolute', top: 185, left: 22, right: 13, height: 452, borderRadius: 31, backgroundColor: colors.violetDeep },
  finder: { height: 452, marginHorizontal: 21, borderRadius: 31, borderWidth: 3, borderColor: colors.paper, backgroundColor: '#393258', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  cameraNoiseA: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: '#50496B', top: -55, right: -45, opacity: 0.45 },
  cameraNoiseB: { position: 'absolute', width: 140, height: 70, borderRadius: 35, backgroundColor: '#282241', bottom: 20, left: -31, transform: [{ rotate: '25deg' }] },
  paperSheet: { width: '79%', minHeight: 235, backgroundColor: colors.canvas, borderWidth: 2.5, borderColor: colors.ink, paddingHorizontal: 20, paddingVertical: 28, transform: [{ rotate: '-2deg' }] },
  paperLine: { position: 'absolute', left: 0, right: 0, height: 1, top: 68, backgroundColor: '#DCD2C1' },
  paperLabel: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13 },
  equation: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 24, marginTop: 16 },
  handwriting: { fontFamily: fonts.body, color: colors.violetDeep, fontSize: 17, marginTop: 15, transform: [{ rotate: '-1deg' }] },
  pencilDash: { width: 147, height: 5, borderRadius: 3, backgroundColor: colors.peach, marginTop: 21, transform: [{ rotate: '-2deg' }] },
  scanLine: { position: 'absolute', left: 39, right: 39, height: 4, borderRadius: 2, backgroundColor: colors.lime, shadowColor: colors.lime, shadowOpacity: 0.8, shadowRadius: 10, elevation: 5 },
  corner: { position: 'absolute', width: 38, height: 38, borderColor: colors.lime },
  cornerTL: { left: 17, top: 17, borderLeftWidth: 5, borderTopWidth: 5, borderTopLeftRadius: 10 },
  cornerTR: { right: 17, top: 17, borderRightWidth: 5, borderTopWidth: 5, borderTopRightRadius: 10 },
  cornerBL: { left: 17, bottom: 17, borderLeftWidth: 5, borderBottomWidth: 5, borderBottomLeftRadius: 10 },
  cornerBR: { right: 17, bottom: 17, borderRightWidth: 5, borderBottomWidth: 5, borderBottomRightRadius: 10 },
  detected: { position: 'absolute', bottom: 16, backgroundColor: colors.lime, borderWidth: 2, borderColor: colors.ink, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  detectedText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 10 },
  controls: { flex: 1, minHeight: 126, paddingHorizontal: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideControl: { width: 60, alignItems: 'center', gap: 5 },
  sideLabel: { fontFamily: fonts.body, color: colors.paper, fontSize: 10 },
  shutterOuter: { width: 86, height: 86, borderRadius: 43, borderWidth: 3, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  shutterMiddle: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.lime, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  helpBubble: { position: 'absolute', left: 24, right: 24, bottom: 118, zIndex: 10, minHeight: 82, borderRadius: 20, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 0, shadowOffset: { width: 6, height: 7 }, elevation: 10 },
  helpText: { flex: 1, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11, lineHeight: 15 },
  helpClose: { width: 29, height: 29, borderRadius: 10, backgroundColor: colors.limeSoft, alignItems: 'center', justifyContent: 'center' },
  privacy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, marginBottom: 8 },
  privacyText: { fontFamily: fonts.body, color: '#B6AECF', fontSize: 10 },
  captureFlash: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, backgroundColor: colors.paper },
});
