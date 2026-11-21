import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { recordDiagnosticError } from '../../../shared/services/diagnostics';
import * as Haptics from '../../../shared/services/haptics';
import { borders, colors, fonts, shadows, springs, typography } from '../../../shared/theme';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { IconButton } from '../../../shared/ui/IconButton';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { Text } from '../../../shared/ui/Typography';
import { submitLessonFeedback, type FeedbackCategory } from '../services/feedback';

type Props = {
  visible: boolean;
  lessonId?: string;
  requestId?: string;
  onClose: () => void;
};

const options: { category: FeedbackCategory; label: string; description: string }[] = [
  { category: 'wrong_answer', label: 'Răspuns greșit', description: 'Un calcul sau rezultatul final nu este corect.' },
  { category: 'unclear', label: 'Explicație neclară', description: 'Pașii sunt greu de urmărit ori lipsesc detalii.' },
  { category: 'unsafe', label: 'Conținut nepotrivit', description: 'A apărut un text care nu ar trebui să fie aici.' },
  { category: 'other', label: 'Altă problemă', description: 'Ai observat altceva în neregulă cu răspunsul.' },
];

const badgeColors = [colors.cyanSoft, colors.peachSoft, colors.limeSoft, colors.violetSoft] as const;

export function FeedbackSheet({ visible, lessonId, requestId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [present, setPresent] = useState(visible);
  const [sending, setSending] = useState<FeedbackCategory | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  const reveal = useSharedValue(visible ? 1 : 0);
  const mounted = useRef(visible);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submissionLocked = useRef(false);
  const submissionRevision = useRef(0);

  useEffect(() => {
    submissionRevision.current += 1;
    if (!visible) return;
    setSending(null);
    setSent(false);
    setError(false);
    submissionLocked.current = false;
    return () => { submissionRevision.current += 1; };
  }, [visible, lessonId, requestId]);

  useEffect(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }

    if (visible) {
      mounted.current = true;
      setPresent(true);
      reveal.set(reducedMotion ? 1 : 0);
      if (!reducedMotion) {
        reveal.set(withSpring(1, springs.snappy));
      }
      return;
    }

    if (!mounted.current) return;
    if (reducedMotion) {
      mounted.current = false;
      setPresent(false);
      reveal.set(0);
      return;
    }

    reveal.set(withTiming(0, { duration: 170, easing: Easing.in(Easing.quad) }));
    closeTimer.current = setTimeout(() => {
      mounted.current = false;
      setPresent(false);
    }, 175);
  }, [reducedMotion, reveal, visible]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const submit = async (category: FeedbackCategory) => {
    if (submissionLocked.current || sent) return;
    submissionLocked.current = true;
    const revision = submissionRevision.current;
    setSending(category);
    setError(false);
    try {
      if (!lessonId && !requestId) throw new Error('Răspunsul nu mai este disponibil.');
      await submitLessonFeedback(lessonId ? { lessonId } : { requestId: requestId! }, category);
      if (revision !== submissionRevision.current) return;
      setSent(true);
      Haptics.notification(Haptics.NotificationFeedbackType.Success);
    } catch (submitError) {
      if (revision !== submissionRevision.current) return;
      recordDiagnosticError('feedback_submission', submitError);
      setError(true);
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    } finally {
      if (revision === submissionRevision.current) {
        submissionLocked.current = false;
        setSending(null);
      }
    }
  };

  const scrimAnimated = useAnimatedStyle(() => ({
    opacity: reveal.get(),
  }));

  const sheetAnimated = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - reveal.get()) * 420 }],
  }));

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
        <Animated.View pointerEvents="none" style={[styles.scrim, scrimAnimated]} />
        <Pressable accessible={false} disabled={Boolean(sending)} onPress={onClose} style={StyleSheet.absoluteFill} />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 14) + 10 },
            sheetAnimated,
          ]}
        >
          <View style={styles.handle} />
          <ScrollView bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false} style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
            {sent ? (
              <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.sentState}>
                <Mascot pose="cheer" size={114} active />
                <View style={styles.sentCopy}>
                  <Text style={styles.sentEyebrow}>MESAJ TRIMIS</Text>
                  <Text style={styles.sentTitle}>Mulțumim că ne-ai spus!</Text>
                  <Text style={styles.sentText}>Vom verifica răspunsul. Raportarea ta ne ajută să facem explicațiile mai clare și mai bune.</Text>
                </View>
                <View style={styles.doneWrap}>
                  <ComicButton
                    compact
                    title={lessonId ? 'Înapoi la lecție' : 'Înapoi la răspuns'}
                    tone="lime"
                    onPress={onClose}
                  />
                </View>
              </View>
            ) : (
              <>
                <View style={styles.header}>
                  <View style={styles.headerCopy}>
                    <Text style={styles.eyebrow}>SPUNE-NE CE AI OBSERVAT</Text>
                    <Text style={styles.title}>Ce nu este în regulă?</Text>
                  </View>
                  <IconButton label="Închide" disabled={Boolean(sending)} onPress={onClose} size={42}>
                    <MiniGlyph name="close" size={19} color={colors.ink} />
                  </IconButton>
                </View>
                <View style={styles.options}>
                  {options.map((option, index) => (
                    <PressableScale
                      key={option.category}
                      accessibilityRole="button"
                      disabled={Boolean(sending)}
                      depth={shadows.sm}
                      radius={16}
                      shadowColor={colors.ink}
                      haptic="selection"
                      onPress={() => void submit(option.category)}
                      contentStyle={styles.option}
                    >
                      <View style={[styles.optionNumber, { backgroundColor: badgeColors[index] }]}>
                        {sending === option.category
                          ? <PlayfulLoader micro />
                          : <Text style={styles.optionNumberText}>0{index + 1}</Text>}
                      </View>
                      <View style={styles.optionCopy}>
                        <Text style={styles.optionTitle}>{option.label}</Text>
                        <Text style={styles.optionText}>{option.description}</Text>
                      </View>
                      <MiniGlyph name="next" size={17} color={colors.violetDeep} />
                    </PressableScale>
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
  sheet: {
    width: '100%',
    minHeight: 386,
    maxWidth: 640,
    maxHeight: '92%',
    alignSelf: 'center',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: borders.thick,
    borderBottomWidth: 0,
    borderColor: colors.ink,
    backgroundColor: colors.canvas,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  sheetScroll: { flexShrink: 1 },
  sheetContent: { paddingBottom: 4 },
  handle: { alignSelf: 'center', width: 48, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  headerCopy: { flex: 1 },
  eyebrow: { ...typography.kicker, color: colors.violetDeep },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 25, lineHeight: 29, marginTop: 2 },
  options: { gap: 9 },
  option: {
    minHeight: 66,
    borderRadius: 16,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  optionNumber: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  optionNumberText: { fontFamily: fonts.display, color: colors.ink, fontSize: 13 },
  optionCopy: { flex: 1 },
  optionTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 15, lineHeight: 18 },
  optionText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12.5, lineHeight: 16.5, marginTop: 2 },
  error: { fontFamily: fonts.bodyBold, color: colors.rose, fontSize: 12.5, lineHeight: 17, textAlign: 'center', marginTop: 10 },
  sentState: { minHeight: 310, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingTop: 8 },
  sentCopy: { alignItems: 'center', marginTop: 10 },
  sentEyebrow: { ...typography.kicker, color: colors.violetDeep },
  sentTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 25, lineHeight: 29, textAlign: 'center', marginTop: 3 },
  sentText: { maxWidth: 330, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 18.5, textAlign: 'center', marginTop: 5 },
  doneWrap: { width: '100%', marginTop: 20 },
});
