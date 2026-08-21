import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { ComicButton } from '../components/ComicButton';
import { ConfettiBurst } from '../components/ConfettiBurst';
import { MiniGlyph } from '../components/MiniGlyph';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Summary'>;

export function SummaryScreen({ navigation, route }: Props) {
  const { gutter, isNarrow, isShort } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const pop = useRef(new Animated.Value(0.72)).current;
  const details = useRef(new Animated.Value(0)).current;
  const isCheck = route.params.mode === 'check';
  const takeaways = isCheck
    ? ['Metoda era bună', 'Semnul este reparat', 'Rezultatul e corect']
    : ['Coeficienții', 'Discriminantul', 'Cele două soluții'];
  const bottomSpace = Math.max(insets.bottom, 10);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 10 }),
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(details, { toValue: 1, duration: 420, useNativeDriver: true }),
      ]),
    ]).start();
  }, [details, pop]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />

      <View style={[styles.main, { paddingHorizontal: gutter }]}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.brand}>Profu’ de mate</Text>
            <Text style={styles.topEyebrow}>{isCheck ? 'VERIFICARE GATA' : 'LECȚIE GATA'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Închide recapitularea" onPress={() => navigation.popToTop()} style={styles.close}>
            <MiniGlyph name="close" size={25} />
          </Pressable>
        </View>

        <View style={[styles.resultBody, isShort && styles.resultBodyShort]}>
          <View style={[styles.hero, isShort && styles.heroShort]}>
            <Animated.View style={[styles.celebration, isNarrow && styles.celebrationNarrow, { transform: [{ scale: pop }] }]}>
              <ConfettiBurst />
              <View style={styles.burstOuter} />
              <View style={styles.burstInner} />
              <Image source={require('../../assets/profu-mascot-v2.png')} resizeMode="contain" style={styles.mascot} />
              <View style={styles.doneSticker}><Text style={styles.doneStickerText}>AHA!</Text></View>
            </Animated.View>
            <Animated.View style={[styles.heroCopy, { opacity: details, transform: [{ translateX: details.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
              <Text style={styles.eyebrow}>{isCheck ? 'AI REPARAT PASUL' : 'AI PRINS IDEEA'}</Text>
              <Text style={[styles.title, isNarrow && styles.titleNarrow]}>{isCheck ? 'Bravo, ai găsit semnul.' : 'Acum știi de ce.'}</Text>
              <Text style={styles.subtitle}>{isCheck ? 'Metoda rămâne. Corectăm doar ce contează.' : 'Trei pași clari, nu un răspuns aruncat.'}</Text>
            </Animated.View>
          </View>

          <Animated.View style={[styles.answerBand, { opacity: details }]}>
            <View style={styles.answerCopy}>
              <Text style={styles.answerLabel}>RĂSPUNS FINAL</Text>
              <Text style={[styles.answer, isNarrow && styles.answerNarrow]}>x₁ = 3   ·   x₂ = −1/2</Text>
            </View>
            <View style={styles.check}><MiniGlyph name="check" size={20} /></View>
          </Animated.View>

          <View style={styles.takeawayBlock}>
            <Text style={styles.sectionTitle}>Ce rămâne cu tine</Text>
            <View style={styles.takeawayList}>
              {takeaways.map((item, index) => (
                <Animated.View key={item} style={[styles.takeaway, index === takeaways.length - 1 && styles.takeawayLast, { opacity: details.interpolate({ inputRange: [index * 0.14, 0.52 + index * 0.12], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
                  <View style={[styles.takeawayNumber, { backgroundColor: [colors.cyan, colors.peach, colors.lime][index] }]}><Text style={styles.takeawayNumberText}>0{index + 1}</Text></View>
                  <Text numberOfLines={1} style={styles.takeawayText}>{item}</Text>
                  <MiniGlyph name="check" size={16} color={colors.violetDeep} />
                </Animated.View>
              ))}
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.actionDock, { paddingHorizontal: gutter, paddingBottom: bottomSpace }]}>
        <ComicButton
          compact
          title={isCheck ? 'Verifică altă rezolvare' : 'Rezolvă una asemănătoare'}
          icon={isCheck ? 'verify' : 'practice'}
          tone="violet"
          onPress={() => navigation.replace('Capture', { mode: route.params.mode })}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Înapoi la început" onPress={() => navigation.popToTop()} style={styles.homeLink}>
          <MiniGlyph name="back" size={17} color={colors.inkSoft} />
          <Text style={styles.homeLinkText}>Gata pentru acum</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  main: { flex: 1 },
  topRow: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 18, lineHeight: 20 },
  topEyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7.5, letterSpacing: 1.2, marginTop: 1 },
  close: { width: 40, height: 40, borderRadius: 14, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  resultBody: { flex: 1, justifyContent: 'space-evenly', paddingBottom: 4 },
  resultBodyShort: { justifyContent: 'space-between' },
  hero: { minHeight: 178, flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroShort: { minHeight: 152 },
  celebration: { width: 154, height: 162, alignItems: 'center', justifyContent: 'center' },
  celebrationNarrow: { width: 142 },
  burstOuter: { position: 'absolute', width: 139, height: 139, borderRadius: 70, backgroundColor: colors.violet, borderWidth: 3, borderColor: colors.ink, transform: [{ rotate: '-5deg' }] },
  burstInner: { position: 'absolute', width: 119, height: 119, borderRadius: 60, borderWidth: 3, borderStyle: 'dashed', borderColor: colors.lime },
  mascot: { width: 146, height: 153, zIndex: 6 },
  doneSticker: { position: 'absolute', zIndex: 7, right: -1, bottom: 10, backgroundColor: colors.lime, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 8, paddingVertical: 3, transform: [{ rotate: '8deg' }] },
  doneStickerText: { fontFamily: fonts.display, color: colors.ink, fontSize: 11 },
  heroCopy: { flex: 1 },
  eyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.25 },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 29, lineHeight: 31, marginTop: 3 },
  titleNarrow: { fontSize: 26, lineHeight: 28 },
  subtitle: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 11.5, lineHeight: 15.5, marginTop: 4 },
  answerBand: { minHeight: 62, borderTopWidth: 2.5, borderBottomWidth: 2.5, borderColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 9 },
  answerCopy: { flex: 1 },
  answerLabel: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7.5, letterSpacing: 1.2 },
  answer: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 18, marginTop: 1 },
  answerNarrow: { fontSize: 15.5 },
  check: { width: 36, height: 36, borderRadius: 12, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  takeawayBlock: { minHeight: 158 },
  sectionTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 18, lineHeight: 21, marginBottom: 6 },
  takeawayList: { borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.line },
  takeaway: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: colors.line },
  takeawayLast: { borderBottomWidth: 0 },
  takeawayNumber: { width: 29, height: 29, borderRadius: 10, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  takeawayNumberText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 8 },
  takeawayText: { flex: 1, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11.5 },
  actionDock: { backgroundColor: colors.canvas, borderTopWidth: 1.5, borderTopColor: colors.line, paddingTop: 9 },
  homeLink: { alignSelf: 'center', minHeight: 31, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12 },
  homeLinkText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 11 },
});
