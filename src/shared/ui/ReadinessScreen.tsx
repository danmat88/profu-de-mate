import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
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
      <View style={styles.content}>
        <Text style={styles.brand}>Profu’ de mate</Text>
        <View style={styles.mark}><Text style={styles.markText}>{busy ? '…' : '!'}</Text></View>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>
        {onRetry ? <Pressable accessibilityRole="button" disabled={busy} onPress={onRetry} style={[styles.retry, busy && styles.disabled]}><Text style={styles.retryText}>Reîncearcă</Text></Pressable> : null}
        {onNotebook ? <Pressable accessibilityRole="button" disabled={busy} onPress={onNotebook} style={styles.secondary}><Text style={styles.secondaryText}>Citește Caietul offline</Text></Pressable> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  brand: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, marginBottom: 30 },
  mark: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  markText: { fontFamily: fonts.display, fontSize: 35, color: colors.violetDeep },
  title: { fontFamily: fonts.display, fontSize: 25, lineHeight: 30, color: colors.ink, textAlign: 'center' },
  message: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.inkSoft, textAlign: 'center', marginTop: 10, maxWidth: 360 },
  retry: { minHeight: 50, minWidth: 180, borderRadius: 16, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, marginTop: 25 },
  retryText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.paper },
  secondary: { minHeight: 48, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondaryText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.violetDeep },
  disabled: { opacity: 0.6 },
});
