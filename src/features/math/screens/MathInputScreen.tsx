import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import * as Haptics from '../../../shared/services/haptics';
import { assertSessionActive, captureSession, type ActiveSession } from '../../../shared/services/sessionGuard';
import { borders, colors, fonts, shadows, typography } from '../../../shared/theme';
import type { RootStackParamList } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { IconButton } from '../../../shared/ui/IconButton';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { Text } from '../../../shared/ui/Typography';
import { commercialGateFromError, preflightAnalysisAccess } from '../../access/services/commercial';
import { createAnalysisRequestId } from '../../analysis/services/mathAnalysis';
import { getPreparedPendingAnalysis, savePendingWrittenMath } from '../../analysis/services/pendingAnalysis';
import { MathEditor } from '../components/MathEditor';
import { readMathDraft, writeMathDraft, type MathDraft } from '../services/mathDraft';
import { createEmptyMathDocument, serializeMathDocument, validateMathDocument, type MathDocument } from '../utils/mathEditor';

type Props = NativeStackScreenProps<RootStackParamList, 'MathInput'>;
type Field = keyof MathDraft;
type SaveState = 'saved' | 'saving' | 'error';

const SAVE_DELAY_MS = 420;

export function MathInputScreen({ navigation, route }: Props) {
  const { mode } = route.params;
  const { gutter, isVeryShort, isNarrow } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const session = useRef<ActiveSession | null>(null);
  const [draft, setDraft] = useState<MathDraft>(() => {
    try { session.current = captureSession(); } catch { /* The editor stays usable while authentication recovers. */ }
    return (session.current && readMathDraft(mode, session.current))
      || { problem: createEmptyMathDocument(), solution: createEmptyMathDocument() };
  });
  const draftRef = useRef(draft);
  const [field, setField] = useState<Field>('problem');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const focused = useRef(true);
  const mounted = useRef(true);

  const persistDraft = useCallback((publish = true) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      if (!session.current) session.current = captureSession();
      const saved = writeMathDraft(mode, draftRef.current, session.current);
      if (publish && mounted.current) setSaveState(saved ? 'saved' : 'error');
      return saved;
    } catch {
      if (publish && mounted.current) setSaveState('error');
      return false;
    }
  }, [mode]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    inFlight.current = false;
    setBusy(false);
    return () => {
      focused.current = false;
      persistDraft(false);
    };
  }, [persistDraft]));

  useEffect(() => {
    draftRef.current = draft;
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistDraft(), SAVE_DELAY_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draft, persistDraft]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') persistDraft();
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      persistDraft(false);
    };
  }, [persistDraft]);

  const updateDocument = (document: MathDocument) => {
    setDraft((current) => {
      const next = { ...current, [field]: document };
      draftRef.current = next;
      return next;
    });
    setError(null);
  };

  const selectField = (next: Field) => {
    if (next === field || busy) return;
    Haptics.selection();
    setField(next);
    setError(null);
  };

  const submit = async () => {
    if (inFlight.current) return;
    const problemError = validateMathDocument(draftRef.current.problem);
    const solutionError = mode === 'check' ? validateMathDocument(draftRef.current.solution) : null;
    if (problemError || solutionError) {
      setField(problemError ? 'problem' : 'solution');
      setError(problemError ? `Problema: ${problemError}` : `Rezolvarea ta: ${solutionError}`);
      Haptics.notification(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    const pending = getPreparedPendingAnalysis();
    if (pending) {
      if (pending.schemaVersion === 3) navigation.navigate('MathProcessing', { ...pending, origin: 'home' });
      else navigation.navigate('Processing', { ...pending, origin: 'home' });
      return;
    }

    persistDraft();
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const requestId = createAnalysisRequestId();
    try {
      const activeSession = captureSession();
      await preflightAnalysisAccess(requestId);
      assertSessionActive(activeSession);
      if (!focused.current) return;
      const currentDraft = draftRef.current;
      const math = {
        problemLatex: serializeMathDocument(currentDraft.problem),
        ...(mode === 'check' ? { solutionLatex: serializeMathDocument(currentDraft.solution) } : {}),
      };
      if (!savePendingWrittenMath(mode, math, requestId, activeSession.userId)) throw new Error('pending-write');
      navigation.navigate('MathProcessing', { mode, math, requestId, userId: activeSession.userId, origin: 'editor' });
    } catch (cause) {
      if (!focused.current) return;
      const gate = commercialGateFromError(cause);
      if (gate) navigation.navigate('Paywall', { source: 'quota', ...(gate.access ? { access: gate.access } : {}) });
      else setError(cause instanceof Error && cause.message === 'pending-write'
        ? 'Nu am putut păstra problema pe telefon. Verifică spațiul disponibil și încearcă din nou.'
        : 'Nu am putut porni analiza. Verifică internetul și încearcă din nou.');
    } finally {
      inFlight.current = false;
      if (focused.current) setBusy(false);
    }
  };

  const isCheck = mode === 'check';
  const saveLabel = saveState === 'saving' ? 'Salvez ciorna…' : saveState === 'error' ? 'Ciorna nu este salvată' : 'Ciornă salvată';
  const fieldLabel = field === 'problem' ? 'Problema matematică' : 'Rezolvarea mea';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />

      <View style={[styles.header, { paddingHorizontal: gutter }, isVeryShort && styles.headerCompact]}>
        <IconButton label="Înapoi" onPress={() => navigation.goBack()} size={44}>
          <MiniGlyph name="back" size={24} color={colors.ink} />
        </IconButton>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{isCheck ? 'VERIFICĂ REZOLVAREA' : 'REZOLVĂ PAS CU PAS'}</Text>
          <Text numberOfLines={1} style={[styles.title, isNarrow && styles.titleNarrow]}>Scrie problema</Text>
        </View>
        <View accessibilityLabel={saveLabel} style={[styles.savePill, saveState === 'error' && styles.savePillError]}>
          <MiniGlyph name={saveState === 'error' ? 'wrong' : saveState === 'saved' ? 'check' : 'dot'} size={13} color={colors.ink} />
          {!isNarrow ? <Text numberOfLines={1} style={styles.saveText}>{saveState === 'saving' ? 'SALVEZ' : saveState === 'error' ? 'NESALVATĂ' : 'SALVATĂ'}</Text> : null}
        </View>
      </View>

      <View style={[styles.workspace, { paddingHorizontal: gutter }]}>
        {isCheck ? (
          <View style={styles.tabs} accessibilityRole="tablist">
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: field === 'problem', disabled: busy }}
              disabled={busy}
              onPress={() => selectField('problem')}
              style={[styles.tab, field === 'problem' && styles.tabActive]}
            >
              <View style={[styles.step, field === 'problem' && styles.stepActive]}><Text style={styles.stepText}>1</Text></View>
              <Text numberOfLines={1} style={[styles.tabText, field === 'problem' && styles.tabTextActive]}>Problema</Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: field === 'solution', disabled: busy }}
              disabled={busy}
              onPress={() => selectField('solution')}
              style={[styles.tab, field === 'solution' && styles.tabActiveCheck]}
            >
              <View style={[styles.step, field === 'solution' && styles.stepActiveCheck]}><Text style={styles.stepText}>2</Text></View>
              <Text numberOfLines={1} style={[styles.tabText, field === 'solution' && styles.tabTextActive]}>Rezolvarea mea</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.contextLine}>
            <View style={styles.contextIcon}><AppIcon name="practice" size={26} /></View>
            <Text numberOfLines={2} style={styles.contextText}>Construiește formula exact cum apare în problemă.</Text>
          </View>
        )}

        <View style={styles.editor}>
          <MathEditor
            key={field}
            document={draft[field]}
            accessibilityLabel={fieldLabel}
            disabled={busy}
            onChange={updateDocument}
          />
        </View>

        {error ? (
          <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorBanner}>
            <MiniGlyph name="wrong" size={16} color="#9B2638" />
            <Text numberOfLines={2} style={styles.error}>{error}</Text>
          </View>
        ) : saveState === 'error' ? (
          <Pressable accessibilityRole="button" onPress={() => persistDraft()} style={styles.saveWarning}>
            <Text numberOfLines={1} style={styles.saveWarningText}>Ciorna nu s-a salvat. Atinge pentru reîncercare.</Text>
          </Pressable>
        ) : null}

        <View testID="math-submit-dock" style={[styles.submitDock, { paddingBottom: Math.max(insets.bottom, 7) }]}>
          <PressableScale
            testID="math-submit-button"
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            depth={shadows.md}
            radius={18}
            shadowColor={colors.ink}
            haptic="medium"
            onPress={() => { void submit(); }}
            contentStyle={[styles.submit, isCheck && styles.submitCheck]}
          >
            <View pointerEvents="none" style={styles.submitShine} />
            {busy
              ? <PlayfulLoader micro />
              : <View style={styles.submitIcon}><AppIcon name={isCheck ? 'verify' : 'explain'} size={28} /></View>}
            <View style={styles.submitCopy}>
              <Text numberOfLines={1} style={styles.submitText}>
                {busy ? 'Pregătesc analiza…' : isCheck ? 'Verifică rezolvarea' : 'Explică problema'}
              </Text>
              {!busy && !isVeryShort ? (
                <Text numberOfLines={1} style={styles.submitNote}>Primești explicația completă, pas cu pas.</Text>
              ) : null}
            </View>
            {!busy ? (
              <View style={styles.submitArrow}>
                <MiniGlyph name="next" size={19} color={colors.paper} />
              </View>
            ) : null}
          </PressableScale>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas, overflow: 'hidden' },
  header: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerCompact: { minHeight: 56 },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { ...typography.kicker, fontSize: 10.5, color: colors.violetDeep },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 22, lineHeight: 26 },
  titleNarrow: { fontSize: 19 },
  savePill: {
    minHeight: 32,
    paddingHorizontal: 9,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.limeSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savePillError: { backgroundColor: colors.roseSoft },
  saveText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 10, letterSpacing: 0.6 },
  workspace: { flex: 1, minHeight: 0, maxWidth: 560, width: '100%', alignSelf: 'center' },
  tabs: { height: 46, flexDirection: 'row', gap: 8, marginBottom: 7 },
  tab: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 9,
    borderWidth: borders.thin,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.paper,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  tabActive: { borderColor: colors.ink, backgroundColor: colors.violetSoft },
  tabActiveCheck: { borderColor: colors.ink, backgroundColor: colors.peachSoft },
  step: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepActive: { backgroundColor: colors.lime },
  stepActiveCheck: { backgroundColor: colors.peach },
  stepText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11 },
  tabText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 12.5 },
  tabTextActive: { color: colors.ink },
  contextLine: { minHeight: 40, marginBottom: 6, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 9 },
  contextIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  contextText: { flex: 1, fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 12.5, lineHeight: 16.5 },
  editor: { flex: 1, minHeight: 0 },
  errorBanner: {
    minHeight: 38,
    marginTop: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.rose,
    backgroundColor: colors.roseSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  error: { flex: 1, color: '#8C2031', fontSize: 12, lineHeight: 16, fontFamily: fonts.bodyBold },
  saveWarning: { minHeight: 34, marginTop: 4, alignItems: 'center', justifyContent: 'center' },
  saveWarningText: { color: '#8C2031', fontFamily: fonts.bodyBold, fontSize: 11.5 },
  submitDock: { flexShrink: 0, paddingTop: 7 },
  submit: {
    minHeight: 58,
    paddingHorizontal: 10,
    borderWidth: borders.thick,
    borderColor: colors.ink,
    borderRadius: 18,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    overflow: 'hidden',
  },
  submitCheck: { backgroundColor: '#FFB86B' },
  submitShine: {
    position: 'absolute',
    top: 3,
    left: 12,
    right: 12,
    height: 5,
    borderRadius: 4,
    backgroundColor: colors.shine,
  },
  submitIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitCopy: { flex: 1, minWidth: 0 },
  submitText: { color: colors.ink, fontSize: 17, lineHeight: 20, fontFamily: fonts.display },
  submitNote: { color: colors.inkSoft, fontSize: 11, lineHeight: 14, fontFamily: fonts.bodyMedium },
  submitArrow: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
