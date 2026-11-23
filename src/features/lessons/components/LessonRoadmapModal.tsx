import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from '../../../shared/services/haptics';
import { borders, colors, fonts, shadows, typography } from '../../../shared/theme';
import type { MathAnalysis } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
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
 * direct access to the final answer and takeaways. Zero Reanimated worklets.
 */
export function LessonRoadmapModal({
  lesson,
  currentStep,
  bottomSpace,
  reducedMotion,
  onSelectStep,
  onOpenSummary,
  onClosed,
}: Props) {
  const reveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const closingRef = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reducedMotion) {
      reveal.setValue(1);
    } else {
      Animated.spring(reveal, {
        toValue: 1,
        tension: 250,
        friction: 24,
        useNativeDriver: true,
      }).start();
    }
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      reveal.stopAnimation();
    };
  }, [reducedMotion, reveal]);

  const closeAndRun = useCallback((after?: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    const finish = () => {
      onClosed();
      after?.();
    };
    if (reducedMotion) {
      reveal.setValue(0);
      finish();
      return;
    }
    Animated.timing(reveal, {
      toValue: 0,
      duration: 145,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
    closeTimer.current = setTimeout(finish, 150);
  }, [onClosed, reducedMotion, reveal]);

  const sheetOpacity = reveal.interpolate({ inputRange: [0, 0.78, 1], outputRange: [0, 1, 1] });
  const sheetTranslateY = reveal.interpolate({ inputRange: [0, 1], outputRange: [64, 0] });
  const completedCount = currentStep + 1;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => closeAndRun()}
    >
      <View style={styles.modalLayer}>
        <Animated.View pointerEvents="none" style={[styles.scrim, { opacity: reveal }]} />
        <Pressable accessible={false} onPress={() => closeAndRun()} style={StyleSheet.absoluteFill} />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { paddingBottom: bottomSpace + 14, opacity: sheetOpacity, transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <View style={styles.handle} />
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
                  <View
                    pointerEvents="none"
                    style={[styles.stepCardShadow, active && styles.stepCardShadowActive]}
                  />
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
                      active && styles.stepCardActive,
                      completed && styles.stepCardDone,
                      pressed && styles.stepCardPressed,
                    ]}
                  >
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
              <View pointerEvents="none" style={styles.finaleShadow} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Deschide răspunsul final și ideile cheie"
                onPress={() => {
                  Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
                  closeAndRun(onOpenSummary);
                }}
                style={({ pressed }) => [styles.finaleCard, pressed && styles.stepCardPressed]}
              >
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
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 35, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(23,19,55,0.52)' },
  sheet: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '84%',
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: borders.thick,
    borderBottomWidth: 0,
    borderColor: colors.ink,
    backgroundColor: colors.canvas,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: { width: 46, height: 5, borderRadius: 3, backgroundColor: '#CBBFE8', alignSelf: 'center', marginBottom: 10 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    padding: 10,
    borderRadius: 18,
    borderWidth: borders.thin,
    borderBottomWidth: 3.5,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
  },
  bannerIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.75,
    borderBottomWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  bannerCopy: { flex: 1, minWidth: 0, gap: 3 },
  bannerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bannerTag: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1.25,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
  },
  bannerTagText: {
    ...typography.kicker,
    fontSize: 9.5,
    color: colors.ink,
    includeFontPadding: false,
  },
  progressChip: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 7,
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

  listContent: { gap: 10, paddingBottom: 8 },
  stepCardWrap: { position: 'relative', paddingBottom: shadows.sm },
  stepCardShadow: {
    position: 'absolute',
    top: shadows.sm,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 17,
    backgroundColor: colors.ink,
  },
  stepCardShadowActive: { backgroundColor: colors.violetDeep },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 17,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
  },
  stepCardActive: {
    borderWidth: borders.regular,
    borderColor: colors.violet,
    backgroundColor: '#FBF8FF',
  },
  stepCardDone: {
    backgroundColor: '#F8FFF9',
  },
  stepCardPressed: {
    transform: [{ translateY: 2.5 }],
  },
  stepIndex: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1.75,
    borderBottomWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.paperTint,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  stepIndexActive: { backgroundColor: colors.violet },
  stepIndexDone: { backgroundColor: colors.mint },
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
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 7,
    borderWidth: 1.25,
    borderColor: colors.ink,
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
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
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

  finaleWrap: { position: 'relative', paddingBottom: shadows.md, marginTop: 4 },
  finaleShadow: {
    position: 'absolute',
    top: shadows.md,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 19,
    backgroundColor: colors.violetDeep,
  },
  finaleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 19,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.gold,
  },
  finaleIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1.75,
    borderBottomWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
  },
  finaleKicker: {
    ...typography.kicker,
    fontSize: 9.5,
    color: colors.violetDeep,
    includeFontPadding: false,
  },
  finaleTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 16, lineHeight: 19 },
  finaleNote: { fontFamily: fonts.bodyMedium, color: '#2F274B', fontSize: 11.5, lineHeight: 15 },
  finaleArrow: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
