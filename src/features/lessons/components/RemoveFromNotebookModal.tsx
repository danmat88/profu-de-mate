import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { borders, colors, fonts, shadows, springs } from '../../../shared/theme';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { Chip } from '../../../shared/ui/Chip';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { Text } from '../../../shared/ui/Typography';

type Props = {
  visible: boolean;
  lessonTitle: string;
  description?: string;
  removing: boolean;
  error: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onAfterClose?: () => void;
};

/**
 * Playful comic confirmation bottom sheet shown whenever the user removes a
 * saved problem from their Notebook (from Lesson, Summary, or Notebook list).
 * Keeps the sheet mounted through its close transition and notifies
 * `onAfterClose` only after it glides completely off screen.
 */
export function RemoveFromNotebookModal({
  visible,
  lessonTitle,
  description = 'Lecția va dispărea din Caietul tău. O poți salva din nou oricând.',
  removing,
  error,
  onConfirm,
  onCancel,
  onAfterClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [rendered, setRendered] = useState(visible);
  const progress = useSharedValue(visible && reducedMotion ? 1 : 0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const afterCloseRef = useRef(onAfterClose);
  afterCloseRef.current = onAfterClose;

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    cancelAnimation(progress);
  }, [progress]);

  useEffect(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }

    if (visible) {
      setRendered(true);
      cancelAnimation(progress);
      if (reducedMotion) {
        progress.set(1);
        return;
      }
      progress.set(0);
      const frame = requestAnimationFrame(() => {
        progress.set(withSpring(1, springs.snappy));
      });
      return () => cancelAnimationFrame(frame);
    }

    if (!rendered) return undefined;

    cancelAnimation(progress);
    if (reducedMotion) {
      progress.set(0);
      setRendered(false);
      afterCloseRef.current?.();
      return undefined;
    }
    progress.set(withTiming(0, { duration: 185, easing: Easing.in(Easing.cubic) }));
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setRendered(false);
      afterCloseRef.current?.();
    }, 195);
    return undefined;
  }, [progress, reducedMotion, rendered, visible]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
  }));

  const sheetStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: Math.min(1, p * 1.35),
      transform: [{ translateY: (1 - p) * 260 }],
    };
  });

  if (!rendered) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={removing ? undefined : onCancel}
    >
      <View style={styles.layer}>
        <Animated.View pointerEvents="none" style={[styles.scrim, scrimStyle]} />
        <Pressable
          accessible={false}
          disabled={removing}
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) + 10 },
            sheetStyle,
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.mascotStage}>
            <View style={styles.mascotHalo} />
            <Mascot pose="oops" size={92} active />
            <View pointerEvents="none" style={styles.cornerBadge}>
              <MiniGlyph name="wrong" size={13} color={colors.paper} />
            </View>
          </View>

          <Chip label="GESTIONEAZĂ CAIETUL" tone="roseSoft" tilt={-2} />
          <Text style={styles.title}>Scoți problema din Caiet?</Text>

          {lessonTitle ? (
            <View style={styles.lessonPreview}>
              <View style={styles.lessonPreviewIcon}>
                <AppIcon name="notebook" size={24} />
              </View>
              <Text numberOfLines={2} style={styles.lessonTitle}>
                {lessonTitle}
              </Text>
            </View>
          ) : null}

          <Text style={styles.description}>{description}</Text>

          {error ? (
            <View accessibilityRole="alert" style={styles.errorBox}>
              <MiniGlyph name="wrong" size={14} color={colors.berryDeep} />
              <Text style={styles.errorText}>
                Nu am putut actualiza Caietul. Verifică internetul și încearcă din nou.
              </Text>
            </View>
          ) : null}

          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ disabled: removing, busy: removing }}
            disabled={removing}
            dimWhenDisabled={false}
            depth={shadows.sm + 1}
            radius={17}
            shadowColor={colors.ink}
            haptic="medium"
            onPress={onConfirm}
            style={styles.confirmWrap}
            contentStyle={styles.confirmButton}
          >
            <View pointerEvents="none" style={styles.buttonShine} />
            {removing ? <PlayfulLoader micro inverse /> : <MiniGlyph name="wrong" size={17} color={colors.paper} />}
            <Text style={styles.confirmText}>
              {removing ? 'Actualizez Caietul…' : 'Da, scoate problema'}
            </Text>
          </PressableScale>

          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ disabled: removing }}
            disabled={removing}
            dimWhenDisabled={false}
            depth={shadows.sm}
            radius={16}
            shadowColor={colors.ink}
            haptic="selection"
            onPress={onCancel}
            style={styles.keepWrap}
            contentStyle={styles.keepButton}
          >
            <Text style={styles.keepText}>Păstreaz-o în Caiet</Text>
          </PressableScale>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(16, 12, 38, 0.66)',
  },
  sheet: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: borders.thick,
    borderBottomWidth: 0,
    borderColor: colors.ink,
    backgroundColor: colors.canvas,
    paddingHorizontal: 22,
    paddingTop: 12,
    alignItems: 'center',
  },
  handle: {
    width: 46,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.line,
    marginBottom: 12,
  },
  mascotStage: {
    width: 108,
    height: 98,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  mascotHalo: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.rose,
    backgroundColor: colors.roseSoft,
  },
  cornerBadge: {
    position: 'absolute',
    right: 6,
    bottom: 4,
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '8deg' }],
  },
  title: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 24,
    lineHeight: 28,
    textAlign: 'center',
    marginTop: 10,
  },
  lessonPreview: {
    width: '100%',
    marginTop: 12,
    borderRadius: 16,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  lessonPreviewIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
    flexShrink: 0,
  },
  lessonTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 13.5,
    lineHeight: 18.5,
  },
  description: {
    maxWidth: 330,
    marginTop: 10,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18.5,
    textAlign: 'center',
  },
  errorBox: {
    width: '100%',
    marginTop: 10,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.rose,
    backgroundColor: colors.roseSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    color: colors.berryDeep,
    fontSize: 12,
    lineHeight: 16.5,
  },
  confirmWrap: { width: '100%', marginTop: 16 },
  confirmButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 17,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.rose,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  buttonShine: {
    position: 'absolute',
    top: 3,
    left: 12,
    right: 12,
    height: 5,
    borderRadius: 4,
    backgroundColor: colors.shine,
  },
  confirmText: {
    fontFamily: fonts.displaySemi,
    color: colors.paper,
    fontSize: 16.5,
  },
  keepWrap: { width: '100%', marginTop: 8 },
  keepButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 16,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  keepText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 14,
  },
});
