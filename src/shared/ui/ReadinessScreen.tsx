import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { borders, colors, fonts } from '../theme';
import { Chip } from './Chip';
import { ComicBackdrop } from './ComicBackdrop';
import { ComicButton } from './ComicButton';
import { ComicCard } from './ComicCard';
import { Enter } from './Enter';
import { Mascot } from './Mascot';
import { PlayfulLoader } from './PlayfulLoader';
import { PressableScale } from './PressableScale';
import { Text } from './Typography';

type Props = {
  busy: boolean;
  title: string;
  message: string;
  onRetry?: () => void;
  onNotebook?: () => void;
};

/** An explicit preparation/error boundary, never a partially populated Home. */
export function ReadinessScreen({ busy, title, message, onRetry, onNotebook }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <ComicBackdrop />
      <View style={styles.content}>
        <Enter delay={0} distance={10}>
          <Text style={styles.brand}>Profu’ de mate</Text>
        </Enter>

        <Enter delay={50} distance={16} scaleFrom={0.86} style={styles.mascotWrap}>
          <View style={[styles.halo, !busy && styles.haloError]} />
          <Mascot pose={busy ? 'thinking' : 'oops'} size={138} active interactive />
        </Enter>

        <Enter delay={100} distance={14} style={styles.cardWrap}>
          <ComicCard tone="paper" depth={5} radius={24} borderWidth={borders.thick} shine contentStyle={styles.card}>
            <Chip
              label={busy ? 'PREGĂTIM TOTUL' : 'O MICĂ PAUZĂ'}
              tone={busy ? 'lime' : 'peach'}
              tilt={-2}
            />
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>
            {busy ? (
              <View style={styles.loaderWrap}>
                <PlayfulLoader compact label="Pregătim accesul…" />
              </View>
            ) : null}
          </ComicCard>
        </Enter>

        <Enter delay={150} distance={12} style={styles.actions}>
          {onRetry ? (
            <ComicButton
              title="Reîncearcă"
              icon="scan"
              tone="lime"
              compact
              disabled={busy}
              onPress={onRetry}
            />
          ) : null}
          {onNotebook ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Citește Caietul offline"
              disabled={busy}
              haptic="selection"
              onPress={onNotebook}
              style={styles.secondaryWrap}
              contentStyle={styles.secondary}
            >
              <Text style={styles.secondaryText}>Citește Caietul offline →</Text>
            </PressableScale>
          ) : null}
        </Enter>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  brand: { fontFamily: fonts.display, fontSize: 22, color: colors.violetDeep, marginBottom: 10 },
  mascotWrap: { width: 158, height: 148, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  halo: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.violetSoft,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderColor: colors.violet,
  },
  haloError: {
    backgroundColor: colors.peachSoft,
    borderColor: colors.peach,
  },
  cardWrap: { width: '100%', maxWidth: 356 },
  card: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18 },
  title: { fontFamily: fonts.display, fontSize: 23, lineHeight: 28, color: colors.ink, textAlign: 'center', marginTop: 10 },
  message: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.inkSoft, textAlign: 'center', marginTop: 8 },
  loaderWrap: { marginTop: 14 },
  actions: { width: '100%', maxWidth: 330, marginTop: 18, gap: 6 },
  secondaryWrap: { alignSelf: 'center' },
  secondary: { minHeight: 46, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.violetDeep },
});
