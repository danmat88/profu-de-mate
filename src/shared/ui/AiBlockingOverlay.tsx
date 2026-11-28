import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors, fonts, radii, typography } from '../theme';
import { CachedInsetRelief, CachedOutsetShadow, CachedSurface, LIQUID_SHADOWS } from './CachedRelief';
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
        <View style={styles.cardShadow}>
          <CachedOutsetShadow
            borderRadius={30}
            shadow={LIQUID_SHADOWS.darkOutset}
            padTop={16}
            padX={22}
            padBottom={28}
          />
          <View style={styles.card}>
            <LinearGradient
              pointerEvents="none"
              colors={['#FFFFFF', '#FDFBFF', '#F4EEFF']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <CachedInsetRelief borderRadius={29} shadow={LIQUID_SHADOWS.cardInset} zIndex={1} />

            <View style={styles.mascotStage}>
              <SpotlightAura size={118} tone="violet" active={!reducedMotion} />
              <Mascot pose="thinking" size={102} active={!reducedMotion} />
            </View>

            <View style={styles.eyebrowPill}>
              <CachedSurface
                borderRadius={radii.pill}
                backgroundColor={colors.violetSoft}
                shadow={LIQUID_SHADOWS.chipSurface}
                padTop={8}
                padX={10}
                padBottom={12}
              />
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
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(18, 11, 48, 0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  cardShadow: {
    width: '100%',
    maxWidth: 360,
    position: 'relative',
  },
  card: {
    borderRadius: 30,
    borderWidth: 1.4,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 22,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  mascotStage: {
    width: 126,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
  },
  eyebrowPill: {
    marginTop: 4,
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderRadius: radii.pill,
    position: 'relative',
    zIndex: 2,
  },
  eyebrowText: {
    ...typography.kicker,
    fontSize: 10,
    color: colors.violetDeep,
    textAlign: 'center',
    zIndex: 2,
  },
  title: {
    marginTop: 10,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 21,
    lineHeight: 26,
    textAlign: 'center',
    zIndex: 2,
  },
  stageText: {
    marginTop: 6,
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    zIndex: 2,
  },
  loaderWrap: {
    marginTop: 14,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  footerNote: {
    marginTop: 10,
    fontFamily: fonts.bodyMedium,
    color: colors.inkMuted,
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
    zIndex: 2,
  },
});
