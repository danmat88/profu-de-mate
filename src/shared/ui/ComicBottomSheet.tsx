import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { SILKY_EASE_IN, SILKY_EASE_OUT } from '../motion/nativeMotion';
import { colors } from '../theme';
import { CachedInsetRelief, LIQUID_SHADOWS } from './CachedRelief';

type Props = {
  visible: boolean;
  /** Whether tapping the scrim or pressing Android back closes the sheet. */
  dismissible?: boolean;
  /** Optional accessibility role for urgent/confirm alert sheets. */
  accessibilityRole?: 'alert';
  /** Surface tone matching the app warm cream canvas or crisp paper cards. */
  tone?: 'canvas' | 'paper';
  onClose: () => void;
  /** Called only after the exit glide has completely finished off-screen. */
  onAfterClose?: () => void;
  /** Optional max height constraint for scrollable sheets. */
  maxHeight?: DimensionValue;
  /** Optional override for the sheet container style. */
  sheetStyle?: StyleProp<ViewStyle>;
  /** Hide the default top drag handle pill when the child provides custom chrome. */
  showHandle?: boolean;
  children: ReactNode;
};

/**
 * Unified bottom sheet modal shared across the entire app (Notebook removal,
 * Feedback, Settings confirmations, Lesson roadmap). Powered 100% by pure
 * native-driver Animated (zero Reanimated worklets), lazily mounts only on
 * first open, and stays mounted through its calm exit glide.
 */
export function ComicBottomSheet({
  visible,
  dismissible = true,
  accessibilityRole,
  tone = 'canvas',
  onClose,
  onAfterClose,
  maxHeight = '90%',
  sheetStyle,
  showHandle = true,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [rendered, setRendered] = useState(visible);
  const progress = useRef(new Animated.Value(visible && reducedMotion ? 1 : 0)).current;
  const activeAnim = useRef<Animated.CompositeAnimation | null>(null);
  const afterCloseRef = useRef(onAfterClose);
  afterCloseRef.current = onAfterClose;

  useEffect(() => () => {
    activeAnim.current?.stop();
    progress.stopAnimation();
  }, [progress]);

  useEffect(() => {
    activeAnim.current?.stop();
    activeAnim.current = null;

    if (visible) {
      setRendered(true);
      if (reducedMotion) {
        progress.setValue(1);
        return undefined;
      }
      progress.setValue(0);
      const frame = requestAnimationFrame(() => {
        const anim = Animated.timing(progress, {
          toValue: 1,
          duration: 280,
          easing: SILKY_EASE_OUT,
          useNativeDriver: true,
        });
        activeAnim.current = anim;
        anim.start();
      });
      return () => cancelAnimationFrame(frame);
    }

    if (!rendered) return undefined;

    if (reducedMotion) {
      progress.setValue(0);
      setRendered(false);
      afterCloseRef.current?.();
      return undefined;
    }

    const anim = Animated.timing(progress, {
      toValue: 0,
      duration: 210,
      easing: SILKY_EASE_IN,
      useNativeDriver: true,
    });
    activeAnim.current = anim;
    anim.start(({ finished }) => {
      if (!finished) return;
      setRendered(false);
      afterCloseRef.current?.();
    });
    return undefined;
  }, [progress, reducedMotion, rendered, visible]);

  const scrimAnimated = useMemo(() => ({
    opacity: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
  }), [progress]);

  const sheetAnimated = useMemo(() => ({
    opacity: progress.interpolate({
      inputRange: [0, 0.35, 1],
      outputRange: [0.4, 1, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [300, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  }), [progress]);

  if (!rendered) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => {
        if (dismissible) onClose();
      }}
    >
      <View style={styles.root}>
        <Animated.View style={[styles.scrim, scrimAnimated]}>
          <Pressable
            accessible={false}
            disabled={!dismissible}
            onPress={() => {
              if (dismissible) onClose();
            }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          accessibilityRole={accessibilityRole}
          style={[
            styles.sheet,
            tone === 'paper' && styles.sheetPaper,
            { maxHeight, paddingBottom: Math.max(insets.bottom, 16) + 8 },
            sheetStyle,
            sheetAnimated,
          ]}
        >
          <LinearGradient
            pointerEvents="none"
            colors={tone === 'paper' ? ['#FFFFFF', '#FAF6FF'] : ['#FFFDF8', '#FFF7E8']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <CachedInsetRelief borderRadius={32} shadow={LIQUID_SHADOWS.sheetInset} zIndex={0} />
          {showHandle ? <View pointerEvents="none" style={styles.handle} /> : null}
          <View style={styles.sheetBody}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(18, 11, 48, 0.54)',
  },
  sheet: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    backgroundColor: colors.canvas,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1.4,
    borderLeftWidth: 1.2,
    borderRightWidth: 1.2,
    borderColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  sheetPaper: {
    backgroundColor: '#FFFFFF',
  },
  sheetBody: {
    zIndex: 2,
    flexShrink: 1,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(115, 78, 198, 0.28)',
    alignSelf: 'center',
    marginBottom: 14,
    zIndex: 2,
  },
});
