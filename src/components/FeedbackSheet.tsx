import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { submitLessonFeedback, type FeedbackCategory } from '../services/feedback';
import { colors, fonts } from '../theme';
import { MiniGlyph } from './MiniGlyph';

type Props = {
  visible: boolean;
  lessonId: string;
  onClose: () => void;
};

const options: Array<{ category: FeedbackCategory; label: string; description: string }> = [
  { category: 'wrong_answer', label: 'Răspuns greșit', description: 'Calculul sau rezultatul nu este corect.' },
  { category: 'unclear', label: 'Explicație neclară', description: 'Pașii sunt greu de urmărit sau lipsesc detalii.' },
  { category: 'unsafe', label: 'Conținut nepotrivit', description: 'Răspunsul conține ceva care nu ar trebui să apară.' },
  { category: 'other', label: 'Altă problemă', description: 'Este ceva în neregulă cu această lecție.' },
];

export function FeedbackSheet({ visible, lessonId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [sending, setSending] = useState<FeedbackCategory | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSending(null);
    setSent(false);
    setError(false);
  }, [visible]);

  const submit = async (category: FeedbackCategory) => {
    if (sending || sent) return;
    setSending(category);
    setError(false);
    try {
      await submitLessonFeedback(lessonId, category);
      setSent(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSending(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={sending ? undefined : onClose}
    >
      <StatusBar style="light" />
      <SafeAreaView style={styles.layer} edges={[]}>
        <Pressable accessible={false} disabled={Boolean(sending)} onPress={onClose} style={styles.scrim} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) + 8 }]}>
          <View style={styles.handle} />
          {sent ? (
            <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.sentState}>
              <View style={styles.sentIcon}><MiniGlyph name="check" size={30} color={colors.ink} /></View>
              <Text style={styles.sentTitle}>Mulțumesc. Am notat.</Text>
              <Text style={styles.sentText}>Raportarea ajută la verificarea și îmbunătățirea răspunsurilor.</Text>
              <Pressable accessibilityRole="button" onPress={onClose} style={styles.doneButton}><Text style={styles.doneText}>Închide</Text></Pressable>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <View style={styles.headerCopy}>
                  <Text style={styles.eyebrow}>AJUTĂ-NE SĂ-L CORECTĂM</Text>
                  <Text style={styles.title}>Ce nu pare în regulă?</Text>
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
                        ? <ActivityIndicator size="small" color={colors.ink} />
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
              {error ? <Text accessibilityRole="alert" style={styles.error}>Raportarea nu s-a trimis. Verifică internetul și încearcă din nou.</Text> : null}
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16, 12, 38, 0.66)' },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 3, borderBottomWidth: 0, borderColor: colors.ink, backgroundColor: colors.canvas, paddingHorizontal: 18, paddingTop: 9 },
  handle: { alignSelf: 'center', width: 48, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 9 },
  headerCopy: { flex: 1 },
  eyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.2 },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 25, lineHeight: 28, marginTop: 2 },
  close: { width: 40, height: 40, borderRadius: 14, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  options: { borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.line },
  option: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 7 },
  optionPressed: { opacity: 0.68 },
  optionNumber: { width: 38, height: 38, borderRadius: 13, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  optionNumberText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9 },
  optionCopy: { flex: 1 },
  optionTitle: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 13 },
  optionText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 10.5, lineHeight: 14, marginTop: 1 },
  error: { fontFamily: fonts.bodyBold, color: colors.rose, fontSize: 10.5, lineHeight: 14, textAlign: 'center', marginTop: 8 },
  sentState: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 5, paddingBottom: 7 },
  sentIcon: { width: 60, height: 60, borderRadius: 21, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  sentTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 27, marginTop: 10 },
  sentText: { maxWidth: 310, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12.5, lineHeight: 17, textAlign: 'center', marginTop: 3 },
  doneButton: { minWidth: 150, height: 48, borderRadius: 16, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  doneText: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 16 },
});
