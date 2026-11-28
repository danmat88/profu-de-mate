import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, typography } from '../../../shared/theme';
import type { MathAnalysis } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import {
  CachedInsetRelief,
  CachedOutsetShadow,
  CachedSurface,
  LIQUID_SHADOWS,
} from '../../../shared/ui/CachedRelief';
import { ComicBottomSheet } from '../../../shared/ui/ComicBottomSheet';
import { IconButton } from '../../../shared/ui/IconButton';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { Text } from '../../../shared/ui/Typography';

type Props = {
  lesson: MathAnalysis;
  currentStep: number;
  bottomSpace: number;
  reducedMotion: boolean;
  onSelectStep: (index: number) => void;
  onOpenSummary: () => void;
  onClosed: () => void;
};

/**
 * Lazily mounted comic roadmap sheet showing every step of the problem plus
 * direct access to the final answer and takeaways. Built on ComicBottomSheet.
 */
export function LessonRoadmapModal({
  lesson,
  currentStep,
  bottomSpace,
  onSelectStep,
  onOpenSummary,
  onClosed,
}: Props) {
  const [open, setOpen] = useState(true);
  const pendingActionRef = useRef<(() => void) | undefined>(undefined);

  const closeAndRun = useCallback((after?: () => void) => {
    if (!open) return;
    pendingActionRef.current = after;
    setOpen(false);
  }, [open]);

  const handleAfterClose = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = undefined;
    onClosed();
    action?.();
  }, [onClosed]);

  const completedCount = currentStep + 1;

  return (
    <ComicBottomSheet
      visible={open}
      onClose={() => closeAndRun()}
      onAfterClose={handleAfterClose}
      maxHeight="84%"
      sheetStyle={[styles.sheet, { paddingBottom: bottomSpace + 14 }]}
    >
      <View style={styles.banner}>
            <View style={styles.bannerIcon}>
              <AppIcon name="explain" size={30} />
            </View>
            <View style={styles.bannerCopy}>
              <View style={styles.bannerMetaRow}>
                <View collapsable={false} style={styles.bannerTag}>
                  <Text style={styles.bannerTagText}>HARTA PAȘILOR</Text>
                </View>
                <View collapsable={false} style={styles.progressChip}>
                  <Text style={styles.progressChipText}>{completedCount} / {lesson.steps.length}</Text>
                </View>
              </View>
              <Text numberOfLines={1} style={styles.bannerTitle}>{lesson.title}</Text>
            </View>
            <IconButton label="Închide harta pașilor" onPress={() => closeAndRun()} size={40}>
              <MiniGlyph name="close" size={19} color={colors.ink} />
            </IconButton>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          >
            {lesson.steps.map((item, index) => {
              const active = index === currentStep;
              const completed = index < currentStep;
              const hasNote = item.note.length > 0;
              return (
                <View key={`${index}-${item.title}`} style={styles.stepCardWrap}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Pasul ${index + 1}: ${item.title}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      Haptics.selection();
                      closeAndRun(() => {
                        if (!active) onSelectStep(index);
                      });
                    }}
                    style={({ pressed }) => [
                      styles.stepCard,
                      pressed && styles.stepCardPressed,
                    ]}
                  >
                    <CachedSurface
                      borderRadius={20}
                      backgroundColor={active ? '#FBF8FF' : completed ? '#F7FFF9' : '#FFFFFF'}
                      shadow={active ? LIQUID_SHADOWS.cardOutsetSoft : LIQUID_SHADOWS.chipSurface}
                      borderWidth={1.1}
                      borderColor={active ? 'rgba(124, 60, 255, 0.5)' : completed ? 'rgba(14, 166, 127, 0.32)' : 'rgba(255, 255, 255, 0.94)'}
                      padTop={3}
                      padX={5}
                      padBottom={8}
                    />
                    <View
                      collapsable={false}
                      style={[
                        styles.stepIndex,
                        active && styles.stepIndexActive,
                        completed && styles.stepIndexDone,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepIndexText,
                          active && styles.stepIndexTextActive,
                        ]}
                      >
                        {completed ? '✓' : String(index + 1).padStart(2, '0')}
                      </Text>
                    </View>

                    <View style={styles.stepCopy}>
                      <View style={styles.stepTopRow}>
                        <Text numberOfLines={1} style={styles.stepKicker}>
                          {item.kicker || `PASUL ${index + 1}`}
                        </Text>
                        {active ? (
                          <View collapsable={false} style={styles.hereBadge}>
                            <Text style={styles.hereBadgeText}>AICI EȘTI</Text>
                          </View>
                        ) : hasNote ? (
                          <View collapsable={false} style={styles.tipBadge}>
                            <Text style={styles.tipBadgeText}>✦ De reținut</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text numberOfLines={2} style={styles.stepTitle}>{item.title}</Text>
                    </View>

                    <MiniGlyph
                      name={active ? 'check' : 'next'}
                      size={16}
                      color={active ? colors.violet : colors.inkSoft}
                    />
                  </Pressable>
                </View>
              );
            })}

            <View style={styles.finaleWrap}>
              <CachedOutsetShadow borderRadius={22} shadow={LIQUID_SHADOWS.goldSoftOutset} padTop={3} padX={6} padBottom={10} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Deschide răspunsul final și ideile cheie"
                onPress={() => {
                  Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
                  closeAndRun(onOpenSummary);
                }}
                style={({ pressed }) => [styles.finaleCard, pressed && styles.stepCardPressed]}
              >
                <LinearGradient
                  colors={['#FFFDF0', '#FFF1BC']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.fill}
                />
                <CachedInsetRelief borderRadius={22} shadow={LIQUID_SHADOWS.goldSoftInset} />
                <View style={styles.finaleIcon}>
                  <AppIcon name="trophy" size={30} />
                </View>
                <View style={styles.stepCopy}>
                  <Text style={styles.finaleKicker}>FINALUL LECȚIEI</Text>
                  <Text style={styles.finaleTitle}>Răspuns final și idei cheie</Text>
                  <Text numberOfLines={1} style={styles.finaleNote}>
                    {lesson.takeaways.length > 0
                      ? `Include ${lesson.takeaways.length} ${lesson.takeaways.length === 1 ? 'idee' : 'idei'} de reținut`
                      : 'Vezi concluzia și rezultatul verificat'}
                  </Text>
                </View>
                <View collapsable={false} style={styles.finaleArrow}>
                  <MiniGlyph name="next" size={16} color={colors.ink} />
                </View>
              </Pressable>
            </View>
          </ScrollView>
    </ComicBottomSheet>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: {
    paddingHorizontal: 16,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 12,
    padding: 12,
    borderRadius: 22,
    borderWidth: 1.1,
    borderColor: 'rgba(124, 60, 255, 0.14)',
    backgroundColor: '#FFFFFF',
  },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1.1,
    borderColor: 'rgba(124, 60, 255, 0.16)',
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerCopy: { flex: 1, minWidth: 0, gap: 3 },
  bannerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bannerTag: {
    paddingHorizontal: 9,
    paddingVertical: 2.5,
    borderRadius: 999,
    backgroundColor: colors.lime,
  },
  bannerTagText: {
    ...typography.kicker,
    fontSize: 9.5,
    color: colors.ink,
    includeFontPadding: false,
  },
  progressChip: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 999,
    backgroundColor: colors.violetSoft,
  },
  progressChipText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 13,
    color: colors.violetDeep,
    includeFontPadding: false,
  },
  bannerTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 17, lineHeight: 21 },

  listContent: { gap: 10, paddingBottom: 12, paddingTop: 2 },
  stepCardWrap: { position: 'relative' },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 20,
    position: 'relative',
  },
  stepCardPressed: {
    transform: [{ scale: 0.985 }],
  },
  stepIndex: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.paperTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndexActive: { backgroundColor: colors.violet },
  stepIndexDone: { backgroundColor: colors.mintSoft },
  stepIndexText: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 16,
    includeFontPadding: false,
  },
  stepIndexTextActive: { color: colors.paper },
  stepCopy: { flex: 1, minWidth: 0, gap: 2 },
  stepTopRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  stepKicker: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
  hereBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.lime,
  },
  hereBadgeText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.4,
    includeFontPadding: false,
  },
  tipBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.limeSoft,
  },
  tipBadgeText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 9.5,
    lineHeight: 12,
    includeFontPadding: false,
  },
  stepTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 15, lineHeight: 19 },

  finaleWrap: { position: 'relative', marginTop: 4 },
  finaleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 22,
    borderWidth: 1.1,
    borderColor: 'rgba(255, 224, 130, 0.9)',
    backgroundColor: '#FFF6C8',
    overflow: 'hidden',
    position: 'relative',
  },
  finaleIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1.1,
    borderColor: 'rgba(255, 224, 130, 0.72)',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finaleKicker: {
    ...typography.kicker,
    fontSize: 9.5,
    color: colors.goldDeep,
    includeFontPadding: false,
  },
  finaleTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 16, lineHeight: 19 },
  finaleNote: { fontFamily: fonts.bodyMedium, color: '#4A3F68', fontSize: 11.5, lineHeight: 15 },
  finaleArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
