import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { ComicBackdrop } from './ComicBackdrop';
import { ComicButton } from './ComicButton';
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
        <Text style={styles.brand}>Profu’ de mate</Text>
        <View style={styles.mascotWrap}>
          <Mascot pose={busy ? 'thinking' : 'oops'} size={136} active />
        </View>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>

        {busy ? (
          <View style={styles.loaderWrap}>
            <PlayfulLoader compact label="Pregătim accesul…" />
          </View>
        ) : null}

        <View style={styles.actions}>
          {onRetry ? (
            <ComicButton
              title="Reîncearcă"
              tone="violet"
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
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 26 },
  brand: { fontFamily: fonts.display, fontSize: 22, color: colors.violetDeep, marginBottom: 14 },
  mascotWrap: { marginBottom: 14 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 29, color: colors.ink, textAlign: 'center', maxWidth: 340 },
  message: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.inkSoft, textAlign: 'center', marginTop: 10, maxWidth: 340 },
  loaderWrap: { marginTop: 18 },
  actions: { width: '100%', maxWidth: 300, marginTop: 24, gap: 6 },
  secondaryWrap: { alignSelf: 'center' },
  secondary: { minHeight: 46, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.violetDeep },
});
