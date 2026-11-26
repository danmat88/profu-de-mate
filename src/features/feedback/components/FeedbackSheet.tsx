import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { recordDiagnosticError } from '../../../shared/services/diagnostics';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, typography } from '../../../shared/theme';
import { ComicBottomSheet } from '../../../shared/ui/ComicBottomSheet';
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

const badgeColors = [colors.cyanSoft, colors.peachSoft, colors.roseSoft, colors.violetSoft] as const;

export function FeedbackSheet({ visible, lessonId, requestId, onClose }: Props) {
  const [sending, setSending] = useState<FeedbackCategory | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

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

  return (
    <ComicBottomSheet
      visible={visible}
      dismissible={!sending}
      onClose={onClose}
      maxHeight="92%"
      sheetStyle={styles.sheet}
    >
      <ScrollView
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        style={styles.sheetScroll}
        contentContainerStyle={styles.sheetContent}
      >
        {sent ? (
          <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.sentState}>
            <Mascot pose="cheer" size={114} active={visible} />
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
                  pressedScale={0.975}
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
                  <View style={styles.optionArrow}>
                    <MiniGlyph name="next" size={14} color={colors.violetDeep} />
                  </View>
                </PressableScale>
              ))}
            </View>
            {error ? <Text accessibilityRole="alert" style={styles.error}>Nu am putut trimite mesajul. Verifică internetul și încearcă din nou.</Text> : null}
          </>
        )}
      </ScrollView>
    </ComicBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    minHeight: 386,
    paddingHorizontal: 18,
  },
  sheetScroll: { flexShrink: 1 },
  sheetContent: { paddingBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  headerCopy: { flex: 1 },
  eyebrow: { ...typography.kicker, color: colors.violetDeep },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 25, lineHeight: 29, marginTop: 2 },
  options: { gap: 9 },
  option: {
    minHeight: 68,
    borderRadius: 20,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  optionNumber: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionNumberText: { fontFamily: fonts.display, color: colors.ink, fontSize: 13 },
  optionCopy: { flex: 1 },
  optionTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 15, lineHeight: 18 },
  optionText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12.5, lineHeight: 16.5, marginTop: 2 },
  optionArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.2,
    borderBottomWidth: 2.5,
    borderColor: '#E2D6FF',
    borderBottomColor: '#C8B5FA',
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  error: { fontFamily: fonts.bodyBold, color: colors.rose, fontSize: 12.5, lineHeight: 17, textAlign: 'center', marginTop: 10 },
  sentState: { minHeight: 310, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingTop: 8 },
  sentCopy: { alignItems: 'center', marginTop: 10 },
  sentEyebrow: { ...typography.kicker, color: colors.violetDeep },
  sentTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 25, lineHeight: 29, textAlign: 'center', marginTop: 3 },
  sentText: { maxWidth: 330, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 18.5, textAlign: 'center', marginTop: 5 },
  doneWrap: { width: '100%', marginTop: 20 },
});
