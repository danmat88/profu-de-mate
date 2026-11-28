import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, radii } from '../../../shared/theme';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { CachedInsetRelief, CachedOutsetShadow, LIQUID_SHADOWS } from '../../../shared/ui/CachedRelief';
import { ComicBottomSheet } from '../../../shared/ui/ComicBottomSheet';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { Text } from '../../../shared/ui/Typography';
import { NativeMathFormula } from '../../math/components/NativeMathFormula';
import { StudyInlineText } from '../../study/components/StudyInlineText';
import { StudyBlocksView } from '../../study/components/StudyRichContent';
import { getRenderedStudyMath } from '../../study/data/renderedMath.generated';
import { getFormulaCategoryMeta } from '../../study/types';
import { getFormulaById } from '../../study/utils/studyDocumentBuilder';
import type { PracticeQuestion } from '../types';

const DIFFICULTY_META: Record<
  PracticeQuestion['difficulty'],
  { label: string; bg: string; fg: string }
> = {
  easy: { label: 'Ușor', bg: '#ECFFD8', fg: colors.limeDeep },
  medium: { label: 'Mediu', bg: colors.goldSoft, fg: '#8B5A00' },
  exam: { label: 'Nivel examen', bg: colors.peachSoft, fg: colors.peachDeep },
};

function extractMistakePreview(item: PracticeQuestion): {
  previewText?: string;
  previewMath?: { latex: string; spoken: string };
} {
  let previewText: string | undefined;
  let previewMath: { latex: string; spoken: string } | undefined;

  for (const block of item.prompt) {
    if (!previewText) {
      if (block.type === 'text') previewText = block.text;
      else if (block.type === 'subpoint' || block.type === 'step') previewText = block.text;
    }
    if (!previewMath) {
      if (block.type === 'math') {
        previewMath = { latex: block.latex, spoken: block.spoken };
      } else if ((block.type === 'subpoint' || block.type === 'step') && block.math) {
        previewMath = { latex: block.math, spoken: block.spoken ?? item.title };
      }
    }
    if (previewText && previewMath) break;
  }

  return { previewText, previewMath };
}

type MistakeCardProps = {
  item: PracticeQuestion;
  isNarrow: boolean;
  previewMathWidth: number;
  onRetry: (item: PracticeQuestion) => void;
  onExplain: (item: PracticeQuestion) => void;
  onOpenFormula: (formulaId: string) => void;
  onRemove: (questionId: string) => void;
};

export const MistakeCard = memo(function MistakeCard({
  item,
  isNarrow,
  previewMathWidth,
  onRetry,
  onExplain,
  onOpenFormula,
  onRemove,
}: MistakeCardProps) {
  const cat = getFormulaCategoryMeta(item.category);
  const diff = DIFFICULTY_META[item.difficulty];
  const linkedFormula = item.formulaId ? getFormulaById(item.formulaId) : undefined;
  const { previewText, previewMath } = useMemo(() => extractMistakePreview(item), [item]);
  const renderedMath = useMemo(
    () => (previewMath ? getRenderedStudyMath(previewMath.latex, 'display') : undefined),
    [previewMath],
  );

  return (
    <View style={styles.cardWrap}>
      <CachedOutsetShadow
        borderRadius={24}
        shadow={LIQUID_SHADOWS.peachSoftOutset}
        padTop={10}
        padX={14}
        padBottom={18}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Reia exercițiul ${item.title}`}
        onPress={() => onRetry(item)}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={['#FFFFFF', '#FFF8F6']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.fill}
        />
        <CachedInsetRelief borderRadius={23} shadow={LIQUID_SHADOWS.peachSoftInset} zIndex={1} />
        <View style={[styles.rail, { backgroundColor: cat.accent }]} />
        <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <View style={[styles.metaDot, { backgroundColor: cat.accent }]} />
            <Text numberOfLines={1} style={styles.metaCategory}>{cat.shortLabel}</Text>
            <View style={styles.formatTag}>
              <Text style={styles.formatTagText}>
                {item.kind === 'choice' ? 'Grilă' : 'Răspuns scurt'}
              </Text>
            </View>
          </View>
          <View style={[styles.diffPill, { backgroundColor: diff.bg }]}>
            <Text style={[styles.diffText, { color: diff.fg }]}>{diff.label}</Text>
          </View>
        </View>

        <Text numberOfLines={2} style={styles.title}>{item.title}</Text>

        {(previewText || renderedMath) ? (
          <View style={styles.previewBox}>
            {previewText ? (
              <StudyInlineText
                text={previewText}
                scale={0.86}
                maxMathWidth={previewMathWidth}
                textStyle={styles.previewText}
              />
            ) : null}
            {renderedMath ? (
              <View style={styles.previewMath}>
                <NativeMathFormula
                  rendered={renderedMath}
                  size="card"
                  scale={0.92}
                  align="left"
                  maxWidth={previewMathWidth}
                  accessibilityLabel={previewMath?.spoken ?? item.title}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.footer}>
          <View style={styles.playCue}>
            <Text style={styles.playCueText}>Reia acum</Text>
            <MiniGlyph name="next" size={12} color={colors.berryDeep} />
          </View>

          <View style={styles.quickActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Vezi explicația pentru ${item.title}`}
              hitSlop={6}
              onPress={(event) => {
                event.stopPropagation();
                onExplain(item);
              }}
              style={({ pressed }) => [
                styles.explainAction,
                isNarrow && styles.actionNarrow,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.explainActionText}>Explicație</Text>
            </Pressable>

            {linkedFormula ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Vezi formula ${linkedFormula.title}`}
                hitSlop={6}
                onPress={(event) => {
                  event.stopPropagation();
                  onOpenFormula(linkedFormula.id);
                }}
                style={({ pressed }) => [
                  styles.formulaAction,
                  isNarrow && styles.actionNarrow,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.formulaActionText}>Formulă</Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Elimină ${item.title} din De repetat`}
              hitSlop={6}
              onPress={(event) => {
                event.stopPropagation();
                onRemove(item.id);
              }}
              style={({ pressed }) => [
                styles.removeAction,
                pressed && styles.pressed,
              ]}
            >
              <MiniGlyph name="close" size={12} color={colors.berryDeep} />
            </Pressable>
          </View>
        </View>
      </View>
      </Pressable>
    </View>
  );
});

type MistakeExplanationSheetProps = {
  question: PracticeQuestion | null;
  visible: boolean;
  mathWidth: number;
  onClose: () => void;
  onAfterClose: () => void;
  onRetry: (item: PracticeQuestion) => void;
  onOpenFormula: (formulaId: string) => void;
};

export function MistakeExplanationSheet({
  question,
  visible,
  mathWidth,
  onClose,
  onAfterClose,
  onRetry,
  onOpenFormula,
}: MistakeExplanationSheetProps) {
  const linkedFormula = useMemo(
    () => (question?.formulaId ? getFormulaById(question.formulaId) : undefined),
    [question],
  );

  if (!question) return null;

  return (
    <ComicBottomSheet
      visible={visible}
      onClose={onClose}
      onAfterClose={onAfterClose}
      maxHeight="88%"
      sheetStyle={styles.sheet}
    >
      <View style={styles.sheetHeader}>
        <View style={styles.sheetHeaderCopy}>
          <Text style={styles.sheetEyebrow}>EXPLICAȚIE PAS CU PAS</Text>
          <Text numberOfLines={2} style={styles.sheetTitle}>
            {question.title}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Închide explicația"
          hitSlop={8}
          onPress={() => {
            Haptics.selection();
            onClose();
          }}
          style={({ pressed }) => [styles.sheetCloseBtn, pressed && styles.pressed]}
        >
          <MiniGlyph name="close" size={16} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.sheetBody}
      >
        <View style={styles.sheetAnswerCard}>
          <Text style={styles.sheetAnswerEyebrow}>RĂSPUNS CORECT</Text>
          <StudyInlineText
            text={question.answerDisplay}
            scale={1.04}
            textStyle={styles.sheetAnswerText}
            maxMathWidth={mathWidth - 20}
          />
        </View>

        <View style={styles.sheetSection}>
          <Text style={styles.sheetSectionEyebrow}>ENUNȚ</Text>
          <StudyBlocksView
            key={`mistake-prompt-${question.id}`}
            blocks={question.prompt}
            scale={0.96}
            maxWidth={mathWidth}
          />
        </View>

        <View style={styles.sheetSection}>
          <Text style={styles.sheetSectionEyebrow}>REZOLVARE</Text>
          <StudyBlocksView
            key={`mistake-exp-${question.id}`}
            blocks={question.explanation}
            scale={0.96}
            maxWidth={mathWidth}
          />
        </View>

        {linkedFormula ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Vezi fișa formulei: ${linkedFormula.title}`}
            onPress={() => onOpenFormula(linkedFormula.id)}
            style={({ pressed }) => [styles.sheetFormulaBtn, pressed && styles.pressed]}
          >
            <AppIcon name="bookmark" size={19} />
            <Text numberOfLines={2} style={styles.sheetFormulaText}>
              Fișa formulei: {linkedFormula.title}
            </Text>
            <MiniGlyph name="next" size={14} color={colors.violetDeep} />
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={styles.sheetFooter}>
        <ComicButton
          compact
          title="Reia exercițiul acum"
          icon="retake"
          tone="lime"
          onPress={() => onRetry(question)}
        />
      </View>
    </ComicBottomSheet>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1.3,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  rail: {
    width: 4.5,
    alignSelf: 'stretch',
    zIndex: 2,
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingTop: 12,
    paddingBottom: 11,
    paddingHorizontal: 13,
    zIndex: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  topLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaDot: {
    width: 7.5,
    height: 7.5,
    borderRadius: 4,
    flexShrink: 0,
  },
  metaCategory: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.inkSoft,
    fontSize: 11.5,
    lineHeight: 15,
    includeFontPadding: false,
  },
  formatTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
  },
  formatTagText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 10,
    lineHeight: 13,
    includeFontPadding: false,
  },
  diffPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    flexShrink: 0,
  },
  diffText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 13,
    includeFontPadding: false,
  },
  title: {
    marginTop: 6,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17.5,
    lineHeight: 22,
  },
  previewBox: {
    marginTop: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#EFE4FA',
    backgroundColor: '#FAF7FF',
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 6,
  },
  previewText: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 12.8,
    lineHeight: 18,
  },
  previewMath: {
    alignItems: 'flex-start',
  },
  footer: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 60, 255, 0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  playCue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  playCueText: {
    fontFamily: fonts.bodyBold,
    color: colors.berryDeep,
    fontSize: 12,
    lineHeight: 15,
    includeFontPadding: false,
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  explainAction: {
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionNarrow: {
    paddingHorizontal: 9,
  },
  explainActionText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 11.5,
    lineHeight: 15,
    includeFontPadding: false,
  },
  formulaAction: {
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formulaActionText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 11.5,
    lineHeight: 15,
    includeFontPadding: false,
  },
  removeAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sheet: {
    height: '86%',
    paddingHorizontal: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sheetHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  sheetEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.75,
    color: colors.berryDeep,
  },
  sheetTitle: {
    marginTop: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 18.5,
    lineHeight: 22.5,
  },
  sheetCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E8DFFA',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sheetBody: {
    paddingTop: 4,
    paddingBottom: 16,
    gap: 14,
  },
  sheetAnswerCard: {
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#D6F08A',
    backgroundColor: '#F5FFD6',
    padding: 13,
    gap: 4,
  },
  sheetAnswerEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.8,
    color: colors.limeDeep,
  },
  sheetAnswerText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
  },
  sheetSection: {
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#EAE0FA',
    backgroundColor: '#FFFFFF',
    padding: 13,
    gap: 8,
  },
  sheetSectionEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.8,
    color: colors.violetDeep,
  },
  sheetFormulaBtn: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: '#DFD2FA',
    backgroundColor: colors.violetSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetFormulaText: {
    flex: 1,
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 13,
    lineHeight: 17,
  },
  sheetFooter: {
    paddingTop: 10,
  },
  pressed: { opacity: 0.72 },
});
