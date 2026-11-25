import { memo, useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors, fonts, radii, typography } from '../theme';
import { Mascot } from './Mascot';
import { PlayfulLoader } from './PlayfulLoader';
import { SpotlightAura } from './SpotlightAura';
import { Text } from './Typography';

type Props = {
  visible: boolean;
  eyebrow?: string;
  title: string;
  /** Cycling reassuring status messages while the AI request is in flight. */
  stages?: readonly string[];
  subtitle?: string;
};

const DEFAULT_STAGES: readonly string[] = [
  'Profu’ AI pregătește conținutul tău...',
  'Verificăm pașii matematici și formulele...',
  'Aproape gata — nu închide ecranul...',
];

/**
 * Full-screen native Modal shield that completely locks all touches, gestures,
 * and Android hardware Back while an AI request is actively running, preventing
 * duplicate calls, accidental exits, or state drift.
 */
export const AiBlockingOverlay = memo(function AiBlockingOverlay({
  visible,
  eyebrow = 'PROFU’ AI LUCREAZĂ',
  title,
  stages = DEFAULT_STAGES,
  subtitle = 'Așteaptă câteva secunde — te ducem direct la rezultat.',
}: Props) {
  const reducedMotion = useReducedMotion();
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!visible) {
      setStageIndex(0);
      return undefined;
    }
    if (stages.length <= 1) return undefined;
    const timer = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % stages.length);
    }, 2_600);
    return () => clearInterval(timer);
  }, [stages.length, visible]);

  if (!visible) return null;

  const activeStage = stages[stageIndex % Math.max(1, stages.length)] ?? subtitle;

  return (
    <Modal
      visible
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => undefined}
    >
      <View
        accessible
        accessibilityViewIsModal
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${title}. ${activeStage}`}
        style={styles.scrim}
      >
        <View style={styles.card}>
          <View pointerEvents="none" style={styles.topShine} />

          <View style={styles.mascotStage}>
            <SpotlightAura size={118} tone="violet" active={!reducedMotion} />
            <Mascot pose="thinking" size={102} active={!reducedMotion} />
          </View>

          <View style={styles.eyebrowPill}>
            <Text numberOfLines={2} style={styles.eyebrowText}>{eyebrow}</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.stageText}>{activeStage}</Text>

          <View style={styles.loaderWrap}>
            <PlayfulLoader compact />
          </View>

          <Text style={styles.footerNote}>{subtitle}</Text>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(18, 11, 48, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 30,
    borderWidth: 1.5,
    borderBottomWidth: 4.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 22,
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 18,
    shadowColor: '#1B1142',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
  },
  topShine: {
    position: 'absolute',
    top: 0,
    left: 32,
    right: 32,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  mascotStage: {
    width: 126,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  eyebrowPill: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: radii.pill,
    borderWidth: 1.2,
    borderBottomWidth: 2.5,
    borderColor: '#DFD2FA',
    borderBottomColor: '#C2ADF4',
    backgroundColor: colors.violetSoft,
  },
  eyebrowText: {
    ...typography.kicker,
    fontSize: 10,
    color: colors.violetDeep,
    textAlign: 'center',
  },
  title: {
    marginTop: 10,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 21,
    lineHeight: 26,
    textAlign: 'center',
  },
  stageText: {
    marginTop: 6,
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
  },
  loaderWrap: {
    marginTop: 14,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerNote: {
    marginTop: 10,
    fontFamily: fonts.bodyMedium,
    color: colors.inkMuted,
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
  },
});
