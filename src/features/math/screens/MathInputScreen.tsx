import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { beginAppTransition } from '../../../shared/context/TransitionMotionContext';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import * as Haptics from '../../../shared/services/haptics';
import { assertSessionActive, captureSession, type ActiveSession } from '../../../shared/services/sessionGuard';
import { colors, fonts, radii, typography } from '../../../shared/theme';
import type { FlowMode, RootStackParamList } from '../../../shared/types';
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
import { MathEditor, type MathEditorExample } from '../components/MathEditor';
import { getCachedMathDraft, readMathDraft, writeMathDraft, type MathDraft } from '../services/mathDraft';
import {
  createEmptyMathDocument,
  formatMathPreview,
  serializeMathDocument,
  validateMathDocument,
  type MathDocument,
  type MathSymbol,
} from '../utils/mathEditor';

type Props = NativeStackScreenProps<RootStackParamList, 'MathInput'>;
type Field = keyof MathDraft;
type SaveState = 'saved' | 'saving' | 'error';

const SAVE_DELAY_MS = 420;

const sym = (value: MathSymbol) => ({ type: 'symbol' as const, value });

const SOLVE_EXAMPLES: readonly MathEditorExample[] = [
  {
    label: '2x + 5 = 13',
    document: { version: 1, nodes: [sym('2'), sym('x'), sym('+'), sym('5'), sym('='), sym('1'), sym('3')] },
  },
  {
    label: 'x² − 9 = 0',
    document: {
      version: 1,
      nodes: [
        { type: 'power', base: [sym('x')], exponent: [sym('2')] },
        sym('-'),
        sym('9'),
        sym('='),
        sym('0'),
      ],
    },
  },
  {
    label: '3/4 + 1/2',
    document: {
      version: 1,
      nodes: [
        { type: 'fraction', numerator: [sym('3')], denominator: [sym('4')] },
        sym('+'),
        { type: 'fraction', numerator: [sym('1')], denominator: [sym('2')] },
      ],
    },
  },
];

const CHECK_PROBLEM_EXAMPLES: readonly MathEditorExample[] = [
  {
    label: '2x + 4 = 10',
    document: { version: 1, nodes: [sym('2'), sym('x'), sym('+'), sym('4'), sym('='), sym('1'), sym('0')] },
  },
  {
    label: '3x − 6 = 9',
    document: { version: 1, nodes: [sym('3'), sym('x'), sym('-'), sym('6'), sym('='), sym('9')] },
  },
];

const CHECK_SOLUTION_EXAMPLES: readonly MathEditorExample[] = [
  {
    label: 'x = 3',
    document: { version: 1, nodes: [sym('x'), sym('='), sym('3')] },
  },
  {
    label: 'x = 5',
    document: { version: 1, nodes: [sym('x'), sym('='), sym('5')] },
  },
];

function loadInitialDraft(mode: FlowMode, session: ActiveSession | null): MathDraft {
  if (session) {
    const cached = getCachedMathDraft(mode, session);
    if (cached !== undefined) {
      return cached ?? { problem: createEmptyMathDocument(), solution: createEmptyMathDocument() };
    }
    const stored = readMathDraft(mode, session);
    if (stored) return stored;
  }
  return { problem: createEmptyMathDocument(), solution: createEmptyMathDocument() };
}

export function MathInputScreen({ navigation, route }: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, isVeryShort, isShort, isNarrow } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const compact = isVeryShort || isShort;
  const session = useRef<ActiveSession | null>(null);
  const userEdited = useRef(false);
  const [activeMode, setActiveMode] = useState<FlowMode>(route.params.mode);
  const [draft, setDraft] = useState<MathDraft>(() => {
    try { session.current = captureSession(); } catch { /* The editor stays usable while authentication recovers. */ }
    return loadInitialDraft(route.params.mode, session.current);
  });
  const draftRef = useRef(draft);
  const modeRef = useRef(activeMode);
  const [field, setField] = useState<Field>('problem');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorSignal, setErrorSignal] = useState(0);
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
      const saved = writeMathDraft(modeRef.current, draftRef.current, session.current);
      if (publish && mounted.current) setSaveState(saved ? 'saved' : 'error');
      return saved;
    } catch {
      if (publish && mounted.current) setSaveState('error');
      return false;
    }
  }, []);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    inFlight.current = false;
    setBusy(false);
    let activeSession = session.current;
    try { activeSession = captureSession(); } catch { /* Keep previous session fallback. */ }
    const sessionChanged = activeSession?.sessionKey !== session.current?.sessionKey;
    const modeChanged = !userEdited.current && route.params.mode !== modeRef.current;
    if (sessionChanged || modeChanged) {
      session.current = activeSession;
      const targetMode = route.params.mode;
      const nextDraft = loadInitialDraft(targetMode, activeSession);
      modeRef.current = targetMode;
      draftRef.current = nextDraft;
      userEdited.current = false;
      setActiveMode(targetMode);
      setDraft(nextDraft);
      setField('problem');
      setError(null);
      setErrorSignal(0);
      setSaveState('saved');
    }
    return () => {
      focused.current = false;
      if (userEdited.current) persistDraft(false);
    };
  }, [persistDraft, route.params.mode]));

  useEffect(() => {
    draftRef.current = draft;
    if (!userEdited.current) return undefined;
    setSaveState((prev) => (prev === 'saving' ? prev : 'saving'));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistDraft(), SAVE_DELAY_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draft, persistDraft]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && userEdited.current) persistDraft();
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      if (userEdited.current) persistDraft(false);
    };
  }, [persistDraft]);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !busy });
  }, [busy, navigation]);

  useEffect(() => {
    if (!busy) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    const removeUnsub = navigation.addListener('beforeRemove', (event) => {
      if (event.data.action.type !== 'RESET' && event.data.action.type !== 'NAVIGATE') {
        event.preventDefault();
      }
    });
    return () => {
      sub.remove();
      removeUnsub();
    };
  }, [busy, navigation]);

  const toggleMode = useCallback(() => {
    if (busy) return;
    Haptics.selection();
    if (userEdited.current) persistDraft(false);
    const nextMode: FlowMode = modeRef.current === 'solve' ? 'check' : 'solve';
    const currentProblem = draftRef.current.problem;
    let nextDraft = loadInitialDraft(nextMode, session.current);
    // Carry over the typed problem if the destination mode doesn't have one yet.
    const carriedOver = nextDraft.problem.nodes.length === 0 && currentProblem.nodes.length > 0;
    if (carriedOver) {
      nextDraft = { ...nextDraft, problem: currentProblem };
    }
    modeRef.current = nextMode;
    draftRef.current = nextDraft;
    userEdited.current = carriedOver;
    const jumpToSolution = carriedOver
      && nextMode === 'check'
      && validateMathDocument(nextDraft.problem) === null
      && nextDraft.solution.nodes.length === 0;
    setActiveMode(nextMode);
    setDraft(nextDraft);
    setField(jumpToSolution ? 'solution' : 'problem');
    setError(null);
    setErrorSignal(0);
    setSaveState('saved');
  }, [busy, persistDraft]);

  const updateDocument = useCallback((document: MathDocument) => {
    userEdited.current = true;
    setDraft((current) => {
      const next = { ...current, [field]: document };
      draftRef.current = next;
      return next;
    });
    setError(null);
    setErrorSignal(0);
  }, [field]);

  const selectField = useCallback((next: Field) => {
    if (next === field || busy) return;
    Haptics.selection();
    setField(next);
    setError(null);
    setErrorSignal(0);
  }, [busy, field]);

  const isCheck = activeMode === 'check';
  const problemValid = useMemo(() => validateMathDocument(draft.problem) === null, [draft.problem]);
  const solutionValid = useMemo(() => validateMathDocument(draft.solution) === null, [draft.solution]);
  const problemPreview = useMemo(
    () => (isCheck && field === 'solution' ? formatMathPreview(draft.problem) : ''),
    [draft.problem, field, isCheck],
  );
  const shouldAdvanceToSolution = isCheck && field === 'problem' && problemValid && draft.solution.nodes.length === 0;

  const submit = async () => {
    if (inFlight.current) return;
    if (shouldAdvanceToSolution) {
      selectField('solution');
      return;
    }

    const problemError = validateMathDocument(draftRef.current.problem);
    const solutionError = isCheck ? validateMathDocument(draftRef.current.solution) : null;
    if (problemError || solutionError) {
      const targetField: Field = problemError ? 'problem' : 'solution';
      if (targetField !== field) setField(targetField);
      setError(problemError ? `Problema: ${problemError}` : `Rezolvarea ta: ${solutionError}`);
      setErrorSignal((value) => value + 1);
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
        ...(isCheck ? { solutionLatex: serializeMathDocument(currentDraft.solution) } : {}),
      };
      if (!savePendingWrittenMath(activeMode, math, requestId, activeSession.userId)) throw new Error('pending-write');
      navigation.navigate('MathProcessing', { mode: activeMode, math, requestId, userId: activeSession.userId, origin: 'editor' });
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

  const saveLabel = saveState === 'saving' ? 'Salvez ciorna…' : saveState === 'error' ? 'Ciorna nu este salvată' : 'Ciornă salvată';
  const fieldLabel = field === 'problem' ? 'Problema matematică' : 'Rezolvarea mea';
  const currentExamples = isCheck
    ? (field === 'problem' ? CHECK_PROBLEM_EXAMPLES : CHECK_SOLUTION_EXAMPLES)
    : SOLVE_EXAMPLES;
  const currentPlaceholder = isCheck
    ? (field === 'problem' ? 'Scrie mai întâi enunțul problemei' : 'Scrie rezolvarea sau rezultatul tău')
    : 'Construiește formula cu tastele de mai jos';

  const ctaTitle = busy
    ? 'Pregătesc analiza…'
    : shouldAdvanceToSolution
      ? 'Scrie rezolvarea ta'
      : isCheck
        ? 'Verifică rezolvarea'
        : 'Explică problema';

  const ctaNote = shouldAdvanceToSolution
    ? 'Pasul 2: adaugă rezolvarea pe care o verificăm.'
    : isCheck
      ? 'Verificăm fiecare pas și îți arătăm rezultatul.'
      : 'Primești explicația completă, pas cu pas.';

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      <ComicBackdrop />

      {/* Ultra-compact curved mode-aware Math Input Canopy */}
      <View style={[styles.canopy, compact && styles.canopyCompact, { paddingTop: insets.top ?? 0 }]}>
        <LinearGradient
          colors={isCheck
            ? ['#C83B67', '#7F23A8', '#44138F']
            : ['#7A38FF', '#581EE0', '#380E9F']}
          start={{ x: 0.06, y: 0 }}
          end={{ x: 0.94, y: 1 }}
          style={styles.fill}
        />
        <View pointerEvents="none" style={styles.canopyGlow} />
        <View pointerEvents="none" style={styles.canopyOrbitArc} />

        <View style={[styles.header, { paddingHorizontal: gutter }, compact && styles.headerCompact]}>
          <IconButton
            label="Înapoi"
            disabled={busy}
            onPress={() => {
              if (busy) return;
              beginAppTransition();
              navigation.goBack();
            }}
            size={compact ? 38 : 42}
            style={styles.canopyActionBtn}
          >
            <MiniGlyph name="back" size={compact ? 18 : 19} color={colors.violetDeep} />
          </IconButton>

          <View style={styles.headerCopy}>
            <View style={styles.headerMetaRow}>
              <View accessibilityLabel={saveLabel} style={[styles.saveDot, saveState === 'error' && styles.saveDotError]} />
              <Text style={styles.eyebrow}>{isCheck ? 'MOD VERIFICARE' : 'MOD REZOLVARE'}</Text>
            </View>
            <Text numberOfLines={1} style={[styles.title, (isNarrow || compact) && styles.titleNarrow]}>
              Scrie <Text style={styles.titleAccent}>problema</Text>
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isCheck ? 'Schimbă în modul Rezolvă' : 'Schimbă în modul Verifică'}
            disabled={busy}
            onPress={toggleMode}
            style={({ pressed }) => [
              styles.modeSwitchPill,
              isCheck && styles.modeSwitchPillCheck,
              pressed && styles.pillPressed,
            ]}
          >
            <View style={[styles.modeSwitchDot, isCheck && styles.modeSwitchDotCheck]} />
            <Text numberOfLines={1} style={styles.modeSwitchText}>
              {isCheck ? 'Verifică ⇄' : 'Rezolvă ⇄'}
            </Text>
          </Pressable>
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
              style={({ pressed }) => [
                styles.tab,
                field === 'problem' && styles.tabActive,
                pressed && styles.tabPressed,
              ]}
            >
              <View style={[styles.step, problemValid ? styles.stepDone : field === 'problem' && styles.stepActive]}>
                {problemValid
                  ? <MiniGlyph name="check" size={12} color={colors.ink} />
                  : <Text style={styles.stepText}>1</Text>}
              </View>
              <Text numberOfLines={1} style={[styles.tabText, field === 'problem' && styles.tabTextActive]}>Problema</Text>
            </Pressable>

            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: field === 'solution', disabled: busy }}
              disabled={busy}
              onPress={() => selectField('solution')}
              style={({ pressed }) => [
                styles.tab,
                field === 'solution' && styles.tabActiveCheck,
                pressed && styles.tabPressed,
              ]}
            >
              <View style={[styles.step, solutionValid ? styles.stepDone : field === 'solution' && styles.stepActiveCheck]}>
                {solutionValid
                  ? <MiniGlyph name="check" size={12} color={colors.ink} />
                  : <Text style={styles.stepText}>2</Text>}
              </View>
              <Text numberOfLines={1} style={[styles.tabText, field === 'solution' && styles.tabTextActive]}>Rezolvarea mea</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.editor}>
          <MathEditor
            documentKey={`${activeMode}:${field}`}
            document={draft[field]}
            accessibilityLabel={fieldLabel}
            disabled={busy}
            accent={isCheck && field === 'solution' ? 'check' : 'solve'}
            examples={currentExamples}
            placeholder={currentPlaceholder}
            referenceText={problemPreview || undefined}
            onPressReference={problemPreview ? () => selectField('problem') : undefined}
            errorSignal={errorSignal}
            onChange={updateDocument}
          />
        </View>

        {error ? (
          <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorBanner}>
            <MiniGlyph name="wrong" size={15} color="#9B2638" />
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
            dimWhenDisabled={false}
            pressedScale={0.97}
            haptic="medium"
            onPress={() => { void submit(); }}
            contentStyle={[
              styles.submit,
              compact && styles.submitCompact,
              isCheck && !shouldAdvanceToSolution && styles.submitCheck,
            ]}
          >
            <LinearGradient
              colors={isCheck && !shouldAdvanceToSolution
                ? ['#FFE17A', '#FFBE52', '#FF9F38']
                : ['#EDFF7A', '#D8FF3E', '#BCEF12']}
              start={{ x: 0.08, y: 0 }}
              end={{ x: 0.92, y: 1 }}
              style={styles.fill}
            />
            <View pointerEvents="none" style={styles.submitShine} />
            {busy
              ? <PlayfulLoader micro />
              : (
                <View style={[styles.submitIcon, compact && styles.submitIconCompact]}>
                  <AppIcon name={shouldAdvanceToSolution ? 'practice' : isCheck ? 'verify' : 'explain'} size={compact ? 24 : 28} />
                </View>
              )}
            <View style={styles.submitCopy}>
              <Text numberOfLines={1} style={[styles.submitText, compact && styles.submitTextCompact]}>
                {ctaTitle}
              </Text>
              {!busy && !compact ? (
                <Text numberOfLines={1} style={styles.submitNote}>{ctaNote}</Text>
              ) : null}
            </View>
            {!busy ? (
              <View style={[styles.submitArrow, compact && styles.submitArrowCompact]}>
                <MiniGlyph name="next" size={compact ? 17 : 19} color={colors.paper} />
              </View>
            ) : null}
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },

  canopy: {
    width: '100%',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
    paddingBottom: 6,
    position: 'relative',
    zIndex: 4,
    flexShrink: 0,
  },
  canopyCompact: {
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    paddingBottom: 4,
  },
  canopyGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    top: -90,
    right: -35,
    backgroundColor: 'rgba(216, 255, 62, 0.14)',
  },
  canopyOrbitArc: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    top: -120,
    left: -65,
  },
  header: { flexShrink: 0, minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  headerCompact: { minHeight: 44, paddingVertical: 2 },
  canopyActionBtn: {
    borderRadius: 21,
    borderBottomWidth: 3.2,
    borderBottomColor: '#C5B8FA',
    backgroundColor: '#FFFFFF',
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eyebrow: { ...typography.kicker, fontSize: 10, color: 'rgba(242, 240, 255, 0.92)', includeFontPadding: false },
  saveDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
    backgroundColor: colors.lime,
  },
  saveDotError: { backgroundColor: '#FF8EA0' },
  title: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 20.5,
    lineHeight: 24,
    textShadowColor: 'rgba(18, 6, 62, 0.28)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },
  titleAccent: { color: colors.lime },
  titleNarrow: { fontSize: 18.5, lineHeight: 21.5 },
  modeSwitchPill: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    borderWidth: 1.3,
    borderBottomWidth: 3.2,
    borderColor: '#FFFFFF',
    borderBottomColor: '#C5B8FA',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeSwitchPillCheck: {
    borderBottomColor: '#F2B8A2',
  },
  modeSwitchDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.violet,
  },
  modeSwitchDotCheck: { backgroundColor: colors.peach },
  modeSwitchText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 11.5 },
  pillPressed: { transform: [{ scale: 0.96 }] },
  workspace: { flex: 1, minHeight: 0, overflow: 'hidden', maxWidth: 560, width: '100%', alignSelf: 'center', paddingTop: 7 },

  tabs: { flexShrink: 0, flexDirection: 'row', gap: 8, marginBottom: 7 },
  tab: {
    flex: 1,
    minWidth: 0,
    height: 40,
    paddingHorizontal: 10,
    borderWidth: 1.4,
    borderBottomWidth: 3.2,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  tabActive: { borderColor: colors.violet, borderBottomColor: '#4715B8', backgroundColor: '#F4EEFF' },
  tabActiveCheck: { borderColor: colors.peach, borderBottomColor: '#C45A38', backgroundColor: '#FFF2EC' },
  tabPressed: { transform: [{ scale: 0.97 }] },
  step: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: colors.paperTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepActive: { backgroundColor: colors.lime },
  stepActiveCheck: { backgroundColor: colors.peach },
  stepDone: { backgroundColor: colors.mintSoft },
  stepText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11 },
  tabText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 12.5 },
  tabTextActive: { color: colors.ink },

  editor: { flex: 1, minHeight: 0, overflow: 'hidden' },

  errorBanner: {
    flexShrink: 0,
    minHeight: 34,
    marginTop: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.3,
    borderBottomWidth: 2.8,
    borderColor: '#FBC4CE',
    borderBottomColor: '#E595A4',
    backgroundColor: colors.roseSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  error: { flex: 1, color: '#8C2031', fontSize: 11.5, lineHeight: 15, fontFamily: fonts.bodyBold },
  saveWarning: { flexShrink: 0, minHeight: 30, marginTop: 4, alignItems: 'center', justifyContent: 'center' },
  saveWarningText: { color: '#8C2031', fontFamily: fonts.bodyBold, fontSize: 11.5 },

  submitDock: { flexShrink: 0, paddingTop: 7 },
  submit: {
    minHeight: 54,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderBottomWidth: 4.5,
    borderColor: '#E8FF78',
    borderBottomColor: '#7EA508',
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  submitCompact: { minHeight: 46, gap: 8 },
  submitCheck: { borderColor: '#FFEB9C', borderBottomColor: '#C46C0E' },
  submitShine: {
    position: 'absolute',
    top: 2,
    left: 22,
    right: 22,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  submitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitIconCompact: { width: 30, height: 30, borderRadius: 15 },
  submitCopy: { flex: 1, minWidth: 0 },
  submitText: { color: colors.ink, fontSize: 17, lineHeight: 20, fontFamily: fonts.display },
  submitTextCompact: { fontSize: 16, lineHeight: 19 },
  submitNote: { color: colors.inkSoft, fontSize: 11, lineHeight: 14, fontFamily: fonts.bodyMedium },
  submitArrow: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitArrowCompact: { width: 30, height: 30 },
});
