import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { memo, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { beginAppTransition } from '../../../shared/context/TransitionMotionContext';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, radii, typography } from '../../../shared/theme';
import type {
  AiPracticeExercisePayload,
  PracticeDifficultyParam,
  RootStackParamList,
  StudyFormulaCategoryParam,
} from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBottomSheet } from '../../../shared/ui/ComicBottomSheet';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { SpotlightAura } from '../../../shared/ui/SpotlightAura';
import { Text } from '../../../shared/ui/Typography';
import { useCommercial } from '../../access/context/CommercialContext';
import { commercialGateFromError } from '../../access/services/commercial';
import {
  FORMULA_CATEGORIES,
  getFormulaCategoryMeta,
  getStudyTrackMeta,
  type StudyTrackId,
} from '../../study/types';
import { friendlyAiPracticeError, generateAiPracticeExercise } from '../services/aiPractice';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  visible: boolean;
  track: StudyTrackId;
  initialCategory?: StudyFormulaCategoryParam;
  /** Optional formula focus (e.g. launched directly from FormulaDetailScreen). */
  formulaTitle?: string;
  formulaId?: string;
  onGenerated: (exercise: AiPracticeExercisePayload) => void;
  onClose: () => void;
};

const DIFFICULTIES: readonly { id: PracticeDifficultyParam; label: string; hint: string }[] = [
  { id: 'easy', label: 'Ușor', hint: 'încălzire' },
  { id: 'medium', label: 'Mediu', hint: 'antrenament' },
  { id: 'exam', label: 'Examen', hint: 'stil EN/BAC' },
] as const;

const GENERATING_STAGES: readonly string[] = [
  'Compunem un enunț original pe programa ta...',
  'Construim variantele de răspuns și indiciul...',
  'Verificăm calculele și rezolvarea pas cu pas...',
];

export const AiPracticeSheet = memo(function AiPracticeSheet({
  visible,
  track,
  initialCategory,
  formulaTitle,
  formulaId,
  onGenerated,
  onClose,
}: Props) {
  const navigation = useNavigation<Navigation>();
  const reducedMotion = useReducedMotion();
  const { access, refresh: refreshAccess } = useCommercial();
  const trackMeta = getStudyTrackMeta(track);
  const [category, setCategory] = useState<StudyFormulaCategoryParam>(initialCategory ?? 'algebra');
  const [difficulty, setDifficulty] = useState<PracticeDifficultyParam>('medium');
  const [busy, setBusy] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [errorText, setErrorText] = useState<string | null>(null);

  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    if (visible) {
      Keyboard.dismiss();
      setErrorText(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!busy) {
      setStageIndex(0);
      return undefined;
    }
    const timer = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % GENERATING_STAGES.length);
    }, 2_600);
    return () => clearInterval(timer);
  }, [busy]);

  const handleGenerate = async () => {
    if (busyRef.current || busy) return;
    Keyboard.dismiss();
    if (access && !access.canAnalyze) {
      onClose();
      beginAppTransition();
      navigation.navigate('Paywall', { source: 'quota', access });
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setErrorText(null);
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    try {
      const exercise = await generateAiPracticeExercise({
        track,
        category,
        difficulty,
        ...(formulaTitle ? { formulaTitle } : {}),
      });
      if (!mountedRef.current) return;
      void refreshAccess();
      const enriched: AiPracticeExercisePayload = formulaId && !exercise.formulaId
        ? { ...exercise, formulaId }
        : exercise;
      busyRef.current = false;
      setBusy(false);
      onClose();
      onGenerated(enriched);
    } catch (error) {
      if (!mountedRef.current) return;
      busyRef.current = false;
      setBusy(false);
      const gate = commercialGateFromError(error);
      if (gate) {
        onClose();
        beginAppTransition();
        navigation.navigate('Paywall', { source: 'quota', ...(access ? { access } : {}) });
        return;
      }
      setErrorText(friendlyAiPracticeError(error));
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    }
  };

  const categoryMeta = getFormulaCategoryMeta(category);
  const diffMeta = DIFFICULTIES.find((item) => item.id === difficulty) ?? DIFFICULTIES[1];

  return (
    <ComicBottomSheet
      visible={visible}
      dismissible={!busy}
      onClose={() => {
        if (!busyRef.current && !busy) {
          setErrorText(null);
          onClose();
        }
      }}
      maxHeight="88%"
    >
      {busy ? (
        <View
          accessible
          accessibilityLiveRegion="polite"
          style={styles.busyStage}
        >
          <View style={styles.busyMascotStage}>
            <SpotlightAura size={116} tone="violet" active={!reducedMotion} />
            <Mascot pose="thinking" size={100} active={!reducedMotion} />
          </View>

          <View style={styles.busyMetaPill}>
            <Text numberOfLines={2} style={styles.busyMetaPillText}>
              {formulaTitle
                ? `${categoryMeta.shortLabel.toUpperCase()} · ${diffMeta.label.toUpperCase()}`
                : `${trackMeta.shortLabel.toUpperCase()} · ${categoryMeta.shortLabel.toUpperCase()} · ${diffMeta.label.toUpperCase()}`}
            </Text>
          </View>

          <Text style={styles.busyTitle}>Profu’ AI compune exercițiul</Text>
          <Text style={styles.busyStageText}>
            {GENERATING_STAGES[stageIndex % GENERATING_STAGES.length]}
          </Text>

          <View style={styles.loaderBox}>
            <PlayfulLoader compact />
          </View>

          <Text style={styles.busyLockNote}>
            Nu închide fereastra — exercițiul se deschide automat în câteva secunde.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <AppIcon name="hint" size={28} />
            </View>
            <View style={styles.headerCopy}>
              <Text numberOfLines={1} style={styles.eyebrow}>
                PROFU’ AI · {trackMeta.shortLabel.toUpperCase()}
              </Text>
              <Text numberOfLines={2} style={styles.title}>
                {formulaTitle ? 'Exercițiu AI pe formulă' : 'Generează exercițiu nou'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Închide generatorul AI"
              hitSlop={8}
              onPress={() => {
                Haptics.selection();
                setErrorText(null);
                onClose();
              }}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <MiniGlyph name="close" size={16} color={colors.ink} />
            </Pressable>
          </View>

          <Text style={styles.subtitle}>
            {formulaTitle
              ? `Profu’ AI compune un exercițiu original care aplică direct „${formulaTitle}”, cu 4 variante, indiciu și rezolvare pas cu pas.`
              : 'Profu’ AI compune pe loc un exercițiu original cu 4 variante, indiciu și rezolvare pas cu pas. Folosește 1 problemă din cota zilnică.'}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            {!formulaTitle ? (
              <>
                <Text style={styles.sectionLabel}>1. Alege capitolul</Text>
                <View style={styles.chipsWrap}>
                  {FORMULA_CATEGORIES.map((item) => {
                    const active = item.id === category;
                    return (
                      <Pressable
                        key={item.id}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        onPress={() => {
                          Haptics.selection();
                          setCategory(item.id);
                        }}
                        style={({ pressed }) => [
                          styles.chip,
                          active && styles.chipActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={[styles.chipDot, { backgroundColor: active ? colors.lime : item.accent }]} />
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {item.shortLabel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Text style={styles.sectionLabel}>
              {formulaTitle ? 'Alege dificultatea' : '2. Alege dificultatea'}
            </Text>
            <View style={styles.diffRow}>
              {DIFFICULTIES.map((level) => {
                const active = level.id === difficulty;
                return (
                  <Pressable
                    key={level.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    onPress={() => {
                      Haptics.selection();
                      setDifficulty(level.id);
                    }}
                    style={({ pressed }) => [
                      styles.diffPill,
                      active && styles.diffPillActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                      style={[styles.diffPillText, active && styles.diffPillTextActive]}
                    >
                      {level.label}
                    </Text>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      style={[styles.diffHintText, active && styles.diffHintTextActive]}
                    >
                      {level.hint}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {errorText ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorText}</Text>
              </View>
            ) : null}

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Generează exercițiul cu Profu AI"
              pressedScale={0.97}
              haptic="medium"
              onPress={() => void handleGenerate()}
              contentStyle={styles.generateBtn}
            >
              <MiniGlyph name="spark" size={16} color={colors.ink} />
              <Text numberOfLines={2} style={styles.generateBtnText}>
                Generează exercițiul acum
              </Text>
              <View style={styles.generateArrow}>
                <MiniGlyph name="next" size={15} color={colors.paper} />
              </View>
            </PressableScale>

            {access ? (
              <Text style={styles.quotaNote}>
                Disponibil azi: {access.remaining} din {access.limit} {access.limit === 1 ? 'problemă AI' : 'probleme AI'}
              </Text>
            ) : null}
          </ScrollView>
        </>
      )}
    </ComicBottomSheet>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    ...typography.kicker,
    fontSize: 10,
    color: colors.violetDeep,
  },
  title: {
    marginTop: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 20,
    lineHeight: 24,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(124, 60, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 14,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18.5,
  },
  body: {
    gap: 12,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 12.5,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 38,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  chipActive: {
    borderColor: colors.violet,
    backgroundColor: colors.violet,
  },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: {
    fontFamily: fonts.bodyBold,
    color: colors.inkSoft,
    fontSize: 12.5,
    includeFontPadding: false,
  },
  chipTextActive: {
    color: colors.paper,
  },
  diffRow: {
    flexDirection: 'row',
    gap: 8,
  },
  diffPill: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1.25,
    borderColor: 'rgba(124, 60, 255, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 2,
  },
  diffPillActive: {
    borderColor: colors.violet,
    backgroundColor: colors.violetSoft,
  },
  diffPillText: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 14,
    includeFontPadding: false,
  },
  diffPillTextActive: {
    color: colors.violetDeep,
  },
  diffHintText: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkMuted,
    fontSize: 10.5,
    includeFontPadding: false,
  },
  diffHintTextActive: {
    color: colors.violetDeep,
  },
  errorBox: {
    borderRadius: 16,
    backgroundColor: colors.roseSoft,
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 109, 0.25)',
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  errorText: {
    fontFamily: fonts.bodyMedium,
    color: colors.berryDeep,
    fontSize: 12.5,
    lineHeight: 17.5,
  },
  busyStage: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  busyMascotStage: {
    width: 124,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  busyMetaPill: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
  },
  busyMetaPillText: {
    ...typography.kicker,
    fontSize: 10,
    color: colors.violetDeep,
    textAlign: 'center',
  },
  busyTitle: {
    marginTop: 10,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 21,
    lineHeight: 26,
    textAlign: 'center',
  },
  busyStageText: {
    marginTop: 6,
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
  },
  loaderBox: {
    marginTop: 14,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busyLockNote: {
    marginTop: 10,
    fontFamily: fonts.bodyMedium,
    color: colors.inkMuted,
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
  },
  generateBtn: {
    marginTop: 4,
    minHeight: 54,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 10,
  },
  generateBtnText: {
    flex: 1,
    flexShrink: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 16.5,
    lineHeight: 20,
  },
  generateArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  quotaNote: {
    textAlign: 'center',
    fontFamily: fonts.bodyMedium,
    color: colors.inkMuted,
    fontSize: 11.5,
  },
  pressed: { opacity: 0.78 },
});
