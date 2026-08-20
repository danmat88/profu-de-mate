import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { ComicButton } from '../components/ComicButton';
import { ConfettiBurst } from '../components/ConfettiBurst';
import { MiniGlyph } from '../components/MiniGlyph';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Summary'>;

export function SummaryScreen({ navigation, route }: Props) {
  const pop = useRef(new Animated.Value(0.65)).current;
  const details = useRef(new Animated.Value(0)).current;
  const isCheck = route.params.mode === 'check';
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 7, bounciness: 12 }).start();
    Animated.sequence([
      Animated.delay(260),
      Animated.timing(details, { toValue: 1, duration: 520, useNativeDriver: true }),
    ]).start();
  }, [details, pop]);
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topRow}><Text style={styles.brand}>Profu’ de mate</Text><Pressable onPress={() => navigation.popToTop()} style={styles.close}><MiniGlyph name="close" size={27} /></Pressable></View>
        <Animated.View style={[styles.burstStage, { transform: [{ scale: pop }] }]}>
          <ConfettiBurst />
          <View style={styles.burstOuter} /><View style={styles.burstInner} />
          <Image source={require('../../assets/profu-mascot-v2.png')} resizeMode="contain" style={styles.mascot} />
          <View style={styles.doneSticker}><Text style={styles.doneStickerText}>AHA!</Text></View>
        </Animated.View>
        <Text style={styles.eyebrow}>{isCheck ? 'VERIFICARE ÎNCHEIATĂ' : 'LECȚIE ÎNCHEIATĂ'}</Text>
        <Text style={styles.title}>{isCheck ? 'Ai reparat ideea.' : 'Ai prins ideea.'}</Text>
        <Text style={styles.subtitle}>{isCheck ? 'Metoda era bună. Un singur semn îți schimba rezultatul.' : 'Nu ai primit doar două soluții — acum știi și de unde vin.'}</Text>

        <Animated.View style={[styles.answerBand, { opacity: details, transform: [{ translateY: details.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
          <View><Text style={styles.answerLabel}>RĂSPUNS FINAL</Text><Text style={styles.answer}>x₁ = 3   ·   x₂ = −1/2</Text></View>
          <View style={styles.check}><MiniGlyph name="check" size={22} /></View>
        </Animated.View>

        <Text style={styles.sectionTitle}>Ce iei cu tine</Text>
        <View style={styles.takeawayRow}>
          {['Coeficienți', 'Discriminant', 'Două soluții'].map((item, index) => (
            <Animated.View key={item} style={[styles.takeaway, index === 1 && styles.takeawayMiddle, { opacity: details.interpolate({ inputRange: [index * 0.16, 0.55 + index * 0.14], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [{ translateY: details.interpolate({ inputRange: [index * 0.14, 0.7 + index * 0.08], outputRange: [18, 0], extrapolate: 'clamp' }) }, { rotate: index === 1 ? '1deg' : '-1deg' }] }]}>
              <Text style={styles.takeawayNumber}>0{index + 1}</Text><Text style={styles.takeawayText}>{item}</Text>
            </Animated.View>
          ))}
        </View>

        <ComicButton title="Încearcă una asemănătoare" subtitle="Profu’ îți pregătește un exercițiu nou." icon="practice" tone="violet" onPress={() => navigation.replace('Capture', { mode: 'solve' })} />
        <Pressable onPress={() => navigation.popToTop()} style={styles.homeLink}><MiniGlyph name="back" size={18} color={colors.inkSoft} /><Text style={styles.homeLinkText}>Gata pentru acum</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingBottom: 35 },
  topRow: { height: 65, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 18 },
  close: { width: 42, height: 42, borderRadius: 15, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  burstStage: { height: 276, alignItems: 'center', justifyContent: 'center' },
  burstOuter: { position: 'absolute', width: 235, height: 235, borderRadius: 118, backgroundColor: colors.violet, borderWidth: 4, borderColor: colors.ink, transform: [{ rotate: '-5deg' }] },
  burstInner: { position: 'absolute', width: 205, height: 205, borderRadius: 103, borderWidth: 4, borderStyle: 'dashed', borderColor: colors.lime },
  mascot: { width: 230, height: 241, zIndex: 6 },
  doneSticker: { position: 'absolute', zIndex: 7, right: 23, bottom: 28, backgroundColor: colors.lime, borderWidth: 3, borderColor: colors.ink, paddingHorizontal: 13, paddingVertical: 6, transform: [{ rotate: '9deg' }] },
  doneStickerText: { fontFamily: fonts.display, color: colors.ink, fontSize: 16 },
  eyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, textAlign: 'center', fontSize: 9, letterSpacing: 1.7 },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 36, lineHeight: 39, textAlign: 'center', marginTop: 3 },
  subtitle: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 14, lineHeight: 19, textAlign: 'center', marginTop: 4, paddingHorizontal: 14 },
  answerBand: { minHeight: 76, marginTop: 18, borderTopWidth: 3, borderBottomWidth: 3, borderColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 9 },
  answerLabel: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.3 },
  answer: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 19, marginTop: 1 },
  check: { width: 40, height: 40, borderRadius: 14, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  sectionTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 20, marginTop: 22 },
  takeawayRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 20 },
  takeaway: { flex: 1, minHeight: 75, padding: 9, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.cyan, transform: [{ rotate: '-1deg' }] },
  takeawayMiddle: { backgroundColor: colors.peach, transform: [{ rotate: '1deg' }] },
  takeawayNumber: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9 },
  takeawayText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11, lineHeight: 14, marginTop: 15 },
  homeLink: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14 },
  homeLinkText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 12 },
});
