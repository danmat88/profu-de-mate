import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { submitLessonFeedback, type FeedbackCategory } from '../services/feedback';
import { recordDiagnosticError } from '../services/diagnostics';
import { colors, fonts } from '../theme';
import { MiniGlyph } from './MiniGlyph';
import { PlayfulLoader } from './PlayfulLoader';
import { Text } from './Typography';

type Props = {
  visible: boolean;
  lessonId: string;
  onClose: () => void;
};

const options: { category: FeedbackCategory; label: string; description: string }[] = [
  { category: 'wrong_answer', label: 'Răspuns greșit', description: 'Un calcul sau rezultatul final nu este corect.' },
  { category: 'unclear', label: 'Explicație neclară', description: 'Pașii sunt greu de urmărit ori lipsesc detalii.' },
  { category: 'unsafe', label: 'Conținut nepotrivit', description: 'A apărut un text care nu ar trebui să fie aici.' },
  { category: 'other', label: 'Altă problemă', description: 'Ai observat altceva în neregulă cu lecția.' },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function FeedbackSheet({ visible, lessonId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [present, setPresent] = useState(visible);
  const [sending, setSending] = useState<FeedbackCategory | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const backdropReveal = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const sheetReveal = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const mounted = useRef(visible);
  const transition = useRef<Animated.CompositeAnimation | null>(null);
  const submissionLocked = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setSending(null);
    setSent(false);
    setError(false);
    submissionLocked.current = false;
  }, [visible]);

  useEffect(() => {
    transition.current?.stop();

    if (visible) {
      mounted.current = true;
      setPresent(true);
      backdropReveal.setValue(0);
      sheetReveal.setValue(0);
      if (reducedMotion) {
        backdropReveal.setValue(1);
        sheetReveal.setValue(1);
        return;
      }
      const frame = requestAnimationFrame(() => {
        transition.current = Animated.sequence([
          Animated.timing(backdropReveal, { toValue: 1, duration: 140, useNativeDriver: true }),
          Animated.spring(sheetReveal, { toValue: 1, speed: 18, bounciness: 4, useNativeDriver: true }),
        ]);
        transition.current.start();
      });
      return () => cancelAnimationFrame(frame);
    }

    if (!mounted.current) return;
    if (reducedMotion) {
      mounted.current = false;
      setPresent(false);
      backdropReveal.setValue(0);
      sheetReveal.setValue(0);
      return;
    }
    transition.current = Animated.sequence([
      Animated.timing(sheetReveal, { toValue: 0, duration: 175, useNativeDriver: true }),
      Animated.timing(backdropReveal, { toValue: 0, duration: 110, useNativeDriver: true }),
    ]);
    transition.current.start(({ finished }) => {
      if (!finished) return;
      mounted.current = false;
      setPresent(false);
    });
  }, [backdropReveal, reducedMotion, sheetReveal, visible]);

  const submit = async (category: FeedbackCategory) => {
    if (submissionLocked.current || sent) return;
    submissionLocked.current = true;
    setSending(category);
    setError(false);
    try {
      await submitLessonFeedback(lessonId, category);
      setSent(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (submitError) {
      recordDiagnosticError('feedback_submission', submitError);
      setError(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      submissionLocked.current = false;
      setSending(null);
    }
  };

  return (
    <Modal
      visible={present}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={sending ? undefined : onClose}
    >
      <StatusBar style="light" />
      <SafeAreaView style={styles.layer} edges={[]}>
        <AnimatedPressable accessible={false} disabled={Boolean(sending)} onPress={onClose} style={[styles.scrim, { opacity: backdropReveal }]} />
        <Animated.View accessibilityViewIsModal style={[styles.sheet, {
          paddingBottom: Math.max(insets.bottom, 14) + 8,
          transform: [{ translateY: sheetReveal.interpolate({ inputRange: [0, 1], outputRange: [520, 0] }) }],
          }]}>
          <View style={styles.handle} />
          <ScrollView bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false} style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
            {sent ? (
              <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.sentState}>
                <View style={styles.sentVisual}>
                  <View style={styles.sentBlobCyan} />
                  <View style={styles.sentBlobPeach} />
                  <View style={styles.sentIcon}><MiniGlyph name="check" size={34} color={colors.ink} /></View>
                  <MiniGlyph name="spark" size={18} color={colors.violetDeep} style={styles.sentSparkLeft} />
                  <MiniGlyph name="spark" size={13} color={colors.violetDeep} style={styles.sentSparkRight} />
                </View>
                <View style={styles.sentCopy}>
                  <Text style={styles.sentEyebrow}>MESAJ TRIMIS</Text>
                  <Text style={styles.sentTitle}>Mulțumim că ne-ai spus!</Text>
                  <Text style={styles.sentText}>Vom verifica lecția. Raportarea ta ne ajută să facem explicațiile mai clare și mai bune.</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}>
                  <Text style={styles.doneText}>Înapoi la lecție</Text>
                  <MiniGlyph name="next" size={18} color={colors.ink} />
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.header}>
                  <View style={styles.headerCopy}>
                    <Text style={styles.eyebrow}>SPUNE-NE CE AI OBSERVAT</Text>
                    <Text style={styles.title}>Ce nu este în regulă?</Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel="Închide" disabled={Boolean(sending)} onPress={onClose} style={styles.close}>
                    <MiniGlyph name="close" size={20} color={colors.ink} />
                  </Pressable>
                </View>
                <View style={styles.options}>
                  {options.map((option, index) => (
                    <Pressable
                      key={option.category}
                      accessibilityRole="button"
                      disabled={Boolean(sending)}
                      onPress={() => void submit(option.category)}
                      style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                    >
                      <View style={[styles.optionNumber, { backgroundColor: [colors.cyan, colors.peach, colors.lime, colors.violetSoft][index] }]}>
                        {sending === option.category
                          ? <PlayfulLoader micro />
                          : <Text style={styles.optionNumberText}>0{index + 1}</Text>}
                      </View>
                      <View style={styles.optionCopy}>
                        <Text style={styles.optionTitle}>{option.label}</Text>
                        <Text style={styles.optionText}>{option.description}</Text>
                      </View>
                      <MiniGlyph name="next" size={17} color={colors.violetDeep} />
                    </Pressable>
                  ))}
                </View>
                {error ? <Text accessibilityRole="alert" style={styles.error}>Nu am putut trimite mesajul. Verifică internetul și încearcă din nou.</Text> : null}
              </>
            )}
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16, 12, 38, 0.66)' },
  sheet: { width: '100%', minHeight: 386, maxWidth: 640, maxHeight: '92%', alignSelf: 'center', borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 3, borderBottomWidth: 0, borderColor: colors.ink, backgroundColor: colors.canvas, paddingHorizontal: 18, paddingTop: 9 },
  sheetScroll: { flexShrink: 1 },
  sheetContent: { paddingBottom: 2 },
  handle: { alignSelf: 'center', width: 48, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 9 },
  headerCopy: { flex: 1 },
  eyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.2 },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 25, lineHeight: 28, marginTop: 2 },
  close: { width: 48, height: 48, borderRadius: 16, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  options: { borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.line },
  option: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 7 },
  optionPressed: { opacity: 0.68 },
  optionNumber: { width: 38, height: 38, borderRadius: 13, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  optionNumberText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9 },
  optionCopy: { flex: 1 },
  optionTitle: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 13 },
  optionText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12, lineHeight: 16, marginTop: 1 },
  error: { fontFamily: fonts.bodyBold, color: colors.rose, fontSize: 12, lineHeight: 16, textAlign: 'center', marginTop: 8 },
  sentState: { minHeight: 326, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingTop: 5, paddingBottom: 5 },
  sentVisual: { width: 118, height: 86, alignItems: 'center', justifyContent: 'center' },
  sentBlobCyan: { position: 'absolute', left: 3, top: 22, width: 58, height: 45, borderRadius: 22, backgroundColor: colors.cyan, transform: [{ rotate: '-9deg' }] },
  sentBlobPeach: { position: 'absolute', right: 5, top: 7, width: 55, height: 51, borderRadius: 20, backgroundColor: colors.peach, transform: [{ rotate: '11deg' }] },
  sentIcon: { width: 68, height: 68, borderRadius: 23, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  sentSparkLeft: { position: 'absolute', left: 0, top: 2 },
  sentSparkRight: { position: 'absolute', right: 1, bottom: 2 },
  sentCopy: { alignItems: 'center', marginTop: 9 },
  sentEyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.3 },
  sentTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 25, lineHeight: 29, textAlign: 'center', marginTop: 3 },
  sentText: { maxWidth: 340, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 5 },
  doneButton: { width: '100%', minHeight: 54, flexDirection: 'row', gap: 9, borderRadius: 17, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  doneButtonPressed: { opacity: 0.72, transform: [{ translateY: 1 }] },
  doneText: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 16 },
});
