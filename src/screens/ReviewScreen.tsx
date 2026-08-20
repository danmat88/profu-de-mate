import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { ComicButton } from '../components/ComicButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;

export function ReviewScreen({ navigation, route }: Props) {
  const isCheck = route.params.mode === 'check';
  const [cropMode, setCropMode] = useState(false);
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(reveal, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 8 }).start();
  }, [reveal]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <ScreenHeader title="Confirmă captura" eyebrow="PASUL 2 DIN 4" onBack={() => navigation.goBack()} rightIcon="crop" rightActive={cropMode} onRight={() => setCropMode((value) => !value)} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Am citit bine?</Text>
        <Text style={styles.subtitle}>Verifică o secundă acum și primești o explicație corectă din prima.</Text>

        <Animated.View style={[styles.photoWrap, { opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }, { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] }]}>
          <View style={styles.photoShadow} />
          <View style={[styles.photo, cropMode && styles.photoCrop]}>
            <View style={styles.tape}><Text style={styles.tapeText}>CAPTURĂ</Text></View>
            <View style={[styles.sheet, cropMode && styles.sheetCrop]}>
              <Text style={styles.sheetSmall}>{isCheck ? 'Rezolvare:' : 'Rezolvați ecuația:'}</Text>
              <Text style={styles.sheetEquation}>2x² − 5x − 3 = 0</Text>
              {isCheck ? <><Text style={styles.sheetHand}>Δ = 25 − 24 = 1</Text><Text style={styles.sheetHand}>x = (5 ± 1) / 4</Text></> : null}
            </View>
            <View style={[styles.cropCorner, styles.cropTL, cropMode && styles.cropCornerActive]} /><View style={[styles.cropCorner, styles.cropTR, cropMode && styles.cropCornerActive]} />
            <View style={[styles.cropCorner, styles.cropBL, cropMode && styles.cropCornerActive]} /><View style={[styles.cropCorner, styles.cropBR, cropMode && styles.cropCornerActive]} />
            {cropMode ? <View style={styles.cropBadge}><AppIcon name="crop" size={29} /><Text style={styles.cropBadgeText}>ÎNCADRARE OPTIMĂ</Text></View> : null}
          </View>
        </Animated.View>

        <Animated.View style={[styles.ocrRow, { opacity: reveal, transform: [{ translateX: reveal.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }] }]}>
          <View style={styles.ocrIcon}><AppIcon name="scan" size={56} /></View>
          <View style={styles.ocrCopy}>
            <Text style={styles.ocrLabel}>PROFU’ A CITIT</Text>
            <Text style={styles.ocrText}>2x² − 5x − 3 = 0</Text>
          </View>
          <View style={styles.confidence}><Text style={styles.confidenceText}>99%</Text></View>
        </Animated.View>

        <View style={styles.tip}>
          <AppIcon name="hint" size={31} />
          <Text style={styles.tipText}>{isCheck ? 'Voi compara fiecare rând, nu doar răspunsul final.' : 'Poți corecta textul dacă poza a fost neclară.'}</Text>
        </View>

        <ComicButton title="Da, continuă" subtitle={isCheck ? 'Verificăm fiecare pas.' : 'Construim explicația.'} icon="scan" tone="lime" onPress={() => navigation.navigate('Processing', { mode: route.params.mode })} />
        <ComicButton title="Repetă fotografia" icon="retake" trailingIcon={false} tone="paper" compact onPress={() => navigation.goBack()} style={styles.retake} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 19, paddingBottom: 34 },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 34, lineHeight: 37, marginTop: 8 },
  subtitle: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 14, lineHeight: 19, maxWidth: 344, marginTop: 3 },
  photoWrap: { marginTop: 20, position: 'relative' },
  photoShadow: { position: 'absolute', top: 8, left: 7, right: -7, bottom: -9, borderRadius: 27, backgroundColor: colors.ink },
  photo: { height: 296, borderRadius: 27, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#BBB4C6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoCrop: { borderColor: colors.lime },
  tape: { position: 'absolute', zIndex: 3, top: 12, left: -12, backgroundColor: colors.lime, paddingHorizontal: 22, paddingVertical: 5, borderWidth: 2, borderColor: colors.ink, transform: [{ rotate: '-8deg' }] },
  tapeText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9, letterSpacing: 1.2 },
  sheet: { width: '80%', minHeight: 194, backgroundColor: colors.canvas, borderWidth: 2, borderColor: colors.ink, padding: 21, transform: [{ rotate: '-1.5deg' }] },
  sheetCrop: { transform: [{ rotate: '0deg' }, { scale: 0.96 }] },
  sheetSmall: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13 },
  sheetEquation: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 24, marginTop: 14 },
  sheetHand: { fontFamily: fonts.body, color: colors.violetDeep, fontSize: 17, marginTop: 11 },
  cropCorner: { position: 'absolute', width: 28, height: 28, borderColor: colors.lime },
  cropCornerActive: { width: 38, height: 38 },
  cropTL: { top: 20, left: 20, borderTopWidth: 4, borderLeftWidth: 4 },
  cropTR: { top: 20, right: 20, borderTopWidth: 4, borderRightWidth: 4 },
  cropBL: { bottom: 20, left: 20, borderBottomWidth: 4, borderLeftWidth: 4 },
  cropBR: { bottom: 20, right: 20, borderBottomWidth: 4, borderRightWidth: 4 },
  cropBadge: { position: 'absolute', bottom: 13, borderRadius: 12, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 3 },
  cropBadgeText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 8, letterSpacing: 0.8 },
  ocrRow: { minHeight: 78, marginTop: 21, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 2, borderColor: colors.line, paddingBottom: 12 },
  ocrIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  ocrCopy: { flex: 1 },
  ocrLabel: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 9, letterSpacing: 1.2 },
  ocrText: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 19, marginTop: 2 },
  confidence: { backgroundColor: colors.lime, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4 },
  confidenceText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 10 },
  tip: { flexDirection: 'row', gap: 8, marginVertical: 15, paddingHorizontal: 5 },
  tipText: { flex: 1, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12, lineHeight: 16 },
  retake: { marginTop: 8 },
});
