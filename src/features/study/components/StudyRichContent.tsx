import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, fonts, radii } from '../../../shared/theme';
import type { RichContent } from '../../../shared/types';
import { Text } from '../../../shared/ui/Typography';
import { NativeMathFormula } from '../../math/components/NativeMathFormula';
import { getRenderedStudyMath } from '../data/renderedMath.generated';
import type { StudyContentBlock } from '../types';
import { NativeMathVisual } from './NativeMathVisual';
import { StudyInlineText } from './StudyInlineText';

type StudyBlocksProps = {
  blocks: readonly StudyContentBlock[];
  scale?: number;
  maxWidth?: number;
  accent?: 'violet' | 'cyan' | 'peach' | 'lime';
};

const NOTE_PALETTE = {
  violet: { bg: '#F4EEFF', border: '#D9C8FF', label: colors.violetDeep },
  cyan: { bg: '#EAFBFF', border: '#BDECF3', label: colors.cyanDeep },
  lime: { bg: '#F5FFD6', border: '#D7F28B', label: colors.limeDeep },
  peach: { bg: '#FFF4EE', border: '#FFD4C2', label: colors.peachDeep },
} as const;

const ACCENT_PALETTE = {
  violet: { rail: colors.violet, badgeBg: '#EFE8FF', badgeText: colors.violetDeep },
  cyan: { rail: colors.cyan, badgeBg: '#E3F8FB', badgeText: colors.cyanDeep },
  peach: { rail: colors.peach, badgeBg: '#FFF0E8', badgeText: colors.peachDeep },
  lime: { rail: colors.limeDeep, badgeBg: '#F1FFCC', badgeText: colors.limeDeep },
} as const;

/**
 * Renders structured Romanian textbook & exam content blocks (`text` with
 * inline `$...$`, full-width display `math` bands with accent rails, exam
 * `subpoint` cards with point pills, full-width editorial `step` cards,
 * callout `note`s, and native `visual` diagrams) synchronously on Frame 0
 * with zero WebView overhead.
 */
export const StudyBlocksView = memo(function StudyBlocksView({
  blocks,
  scale = 1,
  maxWidth = 310,
  accent = 'violet',
}: StudyBlocksProps) {
  let stepCounter = 0;
  const tone = ACCENT_PALETTE[accent];

  return (
    <View style={styles.stack}>
      {blocks.map((block, index) => {
        if (block.type === 'text') {
          return (
            <StudyInlineText
              key={`txt-${index}`}
              text={block.text}
              scale={scale}
              maxMathWidth={maxWidth}
              textStyle={styles.bodyText}
            />
          );
        }

        if (block.type === 'math') {
          const rendered = getRenderedStudyMath(block.latex, 'display');
          if (!rendered) {
            return (
              <Text key={`math-fb-${index}`} style={styles.bodyText}>
                {block.spoken}
              </Text>
            );
          }
          return (
            <View
              key={`math-${index}-${block.latex}`}
              style={[styles.mathBand, { borderLeftColor: tone.rail }]}
            >
              {block.caption ? (
                <StudyInlineText
                  text={block.caption}
                  scale={scale * 0.9}
                  color={colors.violetDeep}
                  textStyle={styles.mathCaption}
                  maxMathWidth={maxWidth - 22}
                />
              ) : null}
              <NativeMathFormula
                rendered={rendered}
                size="display"
                scale={scale}
                maxWidth={maxWidth - 22}
                fadeColor="#FAF8FF"
                accessibilityLabel={block.spoken}
              />
            </View>
          );
        }

        if (block.type === 'subpoint') {
          const mathRendered = block.math
            ? getRenderedStudyMath(block.math, 'display')
            : undefined;
          return (
            <View key={`sub-${index}`} style={styles.subpointCard}>
              <View style={styles.subpointHeader}>
                <View style={[styles.subpointBadge, { backgroundColor: tone.badgeBg }]}>
                  <Text style={[styles.subpointBadgeText, { color: tone.badgeText }]}>
                    {block.label}
                  </Text>
                </View>
                <View style={styles.subpointBody}>
                  <StudyInlineText
                    text={block.text}
                    scale={scale}
                    maxMathWidth={maxWidth - 88}
                    textStyle={styles.subpointText}
                  />
                </View>
                {block.points ? (
                  <View style={styles.pointsPill}>
                    <Text style={styles.pointsPillText}>{block.points}</Text>
                  </View>
                ) : null}
              </View>
              {mathRendered ? (
                <View style={styles.subpointMath}>
                  <NativeMathFormula
                    rendered={mathRendered}
                    size="display"
                    scale={scale * 0.96}
                    maxWidth={maxWidth - 28}
                    fadeColor="#FFFFFF"
                    accessibilityLabel={block.spoken}
                  />
                </View>
              ) : null}
            </View>
          );
        }

        if (block.type === 'step') {
          stepCounter += 1;
          const mathRendered = block.math
            ? getRenderedStudyMath(block.math, 'display')
            : undefined;
          return (
            <View
              key={`step-${index}`}
              style={[styles.stepCard, { borderLeftColor: tone.rail }]}
            >
              <View style={styles.stepHeaderRow}>
                <View style={[styles.stepIndexPill, { backgroundColor: tone.badgeBg }]}>
                  <Text style={[styles.stepIndexText, { color: tone.badgeText }]}>
                    Pasul {stepCounter}
                  </Text>
                </View>
                {block.title ? (
                  <View style={styles.stepTitleWrap}>
                    <StudyInlineText
                      text={block.title}
                      scale={scale * 0.92}
                      color={colors.violetDeep}
                      maxMathWidth={maxWidth - 96}
                      textStyle={styles.stepTitle}
                    />
                  </View>
                ) : null}
              </View>
              <StudyInlineText
                text={block.text}
                scale={scale}
                maxMathWidth={maxWidth - 24}
                textStyle={styles.stepText}
              />
              {mathRendered ? (
                <View style={styles.stepMathBand}>
                  <NativeMathFormula
                    rendered={mathRendered}
                    size="display"
                    scale={scale * 0.96}
                    maxWidth={maxWidth - 34}
                    fadeColor="#FAF8FF"
                    accessibilityLabel={block.spoken}
                  />
                </View>
              ) : null}
            </View>
          );
        }

        if (block.type === 'note') {
          const palette = NOTE_PALETTE[block.tone ?? 'peach'];
          return (
            <View
              key={`note-${index}`}
              style={[
                styles.noteBox,
                { backgroundColor: palette.bg, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.noteLabel, { color: palette.label }]}>{block.label}</Text>
              <StudyInlineText
                text={block.text}
                scale={scale * 0.96}
                color={colors.ink}
                maxMathWidth={maxWidth - 26}
                textStyle={styles.noteText}
              />
            </View>
          );
        }

        if (block.type === 'visual') {
          return (
            <NativeMathVisual
              key={`vis-${index}`}
              visual={block.visual}
              spoken={block.spoken}
              scale={scale}
            />
          );
        }

        return null;
      })}
    </View>
  );
});

type LiveRichProps = {
  content: RichContent;
  scale?: number;
  maxWidth?: number;
};

/**
 * Renders live server-generated `RichContent` (from `generatePracticeExercise`)
 * natively using the exact same Skia SVG pipeline — zero WebView flash even for
 * AI-generated exercises!
 */
export const LiveRichContentView = memo(function LiveRichContentView({
  content,
  scale = 1,
  maxWidth = 310,
}: LiveRichProps) {
  return (
    <View style={styles.stack}>
      {content.map((block, index) => {
        if (block.type === 'text') {
          return (
            <StudyInlineText
              key={`lt-${index}`}
              text={block.text}
              scale={scale}
              maxMathWidth={maxWidth}
              textStyle={styles.bodyText}
            />
          );
        }
        if (block.type === 'math') {
          return (
            <View key={`lm-${index}`} style={[styles.mathBand, { borderLeftColor: colors.violet }]}>
              <NativeMathFormula
                rendered={block.rendered}
                size="display"
                scale={scale}
                maxWidth={maxWidth - 22}
                fadeColor="#FAF8FF"
                accessibilityLabel={block.spoken}
              />
            </View>
          );
        }
        if (block.type === 'visual') {
          return (
            <NativeMathVisual
              key={`lv-${index}`}
              visual={block.visual}
              spoken={block.spoken}
              scale={scale}
            />
          );
        }
        return null;
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  stack: {
    gap: 11,
  },
  bodyText: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22.5,
    color: colors.ink,
  },
  mathBand: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 3.5,
    borderColor: '#E5DCFA',
    backgroundColor: '#FAF8FF',
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 6,
    alignItems: 'center',
    overflow: 'hidden',
  },
  mathCaption: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  subpointCard: {
    width: '100%',
    borderRadius: 17,
    borderWidth: 1.1,
    borderColor: '#E8DFF9',
    backgroundColor: '#FCF9FF',
    paddingVertical: 11,
    paddingHorizontal: 11,
    gap: 9,
    overflow: 'hidden',
  },
  subpointHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  subpointBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginTop: 1,
    flexShrink: 0,
  },
  subpointBadgeText: {
    fontFamily: fonts.display,
    fontSize: 13.5,
  },
  subpointBody: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
  },
  subpointText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14.5,
    lineHeight: 21.5,
    color: colors.ink,
  },
  pointsPill: {
    borderRadius: radii.pill,
    backgroundColor: colors.limeSoft,
    borderWidth: 1,
    borderColor: '#D6F08A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
    flexShrink: 0,
  },
  pointsPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.limeDeep,
  },
  subpointMath: {
    width: '100%',
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE5FC',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    overflow: 'hidden',
  },
  stepCard: {
    width: '100%',
    borderRadius: 17,
    borderWidth: 1.1,
    borderLeftWidth: 3.5,
    borderColor: '#EAE2FA',
    backgroundColor: '#FFFFFF',
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 7,
    overflow: 'hidden',
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  stepIndexPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepIndexText: {
    fontFamily: fonts.display,
    fontSize: 11,
    letterSpacing: 0.3,
    includeFontPadding: false,
  },
  stepTitleWrap: {
    flex: 1,
    minWidth: 120,
  },
  stepTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.violetDeep,
  },
  stepText: {
    fontFamily: fonts.body,
    fontSize: 14.5,
    lineHeight: 21.5,
    color: colors.ink,
  },
  stepMathBand: {
    width: '100%',
    marginTop: 1,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#EAE2FA',
    backgroundColor: '#FAF8FF',
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
    overflow: 'hidden',
  },
  noteBox: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 13,
    gap: 4,
  },
  noteLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.7,
  },
  noteText: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.ink,
  },
});
