import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme';
import { CachedInsetRelief, CachedOutsetShadow, LIQUID_SHADOWS } from './CachedRelief';
import { Chip } from './Chip';
import { ComicBackdrop } from './ComicBackdrop';
import { ComicButton } from './ComicButton';
import { Enter } from './Enter';
import { Mascot } from './Mascot';
import { PlayfulLoader } from './PlayfulLoader';
import { PressableScale } from './PressableScale';
import { SpotlightAura } from './SpotlightAura';
import { Text } from './Typography';

type Props = {
  busy: boolean;
  title: string;
  message: string;
  onRetry?: () => void;
  onNotebook?: () => void;
  /** Set `false` when embedded inside a parent host that manages the StatusBar. */
  manageStatusBar?: boolean;
};

/** An explicit preparation/error boundary matching LaunchSplash studio craft. */
export function ReadinessScreen({
  busy,
  title,
  message,
  onRetry,
  onNotebook,
  manageStatusBar = true,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.safe, { paddingTop: insets.top ?? 0, paddingBottom: insets.bottom ?? 0 }]}>
      {manageStatusBar ? <StatusBar style="dark" /> : null}
      <ComicBackdrop />
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Enter delay={0} distance={10}>
          <View style={styles.brandWrap}>
            <View pointerEvents="none" style={styles.brandHighlight} />
            <Text style={styles.brand}>Profu’ <Text style={styles.brandAccent}>de mate</Text></Text>
          </View>
        </Enter>

        <Enter delay={50} distance={16} scaleFrom={0.9} style={styles.mascotWrap}>
          <SpotlightAura size={150} tone={busy ? 'violet' : 'peach'} active />
          <Mascot pose={busy ? 'thinking' : 'oops'} size={136} active interactive />
        </Enter>

        <Enter delay={100} distance={14} style={styles.cardWrap}>
          <CachedOutsetShadow
            borderRadius={28}
            shadow={LIQUID_SHADOWS.cardOutset}
            padTop={14}
            padX={18}
            padBottom={24}
          />
          <View style={styles.card}>
            <LinearGradient
              pointerEvents="none"
              colors={['#FFFFFF', '#FBF8FF']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <CachedInsetRelief borderRadius={27} shadow={LIQUID_SHADOWS.cardInset} zIndex={1} />
            <Chip
              label={busy ? 'PREGĂTIM TOTUL' : 'O MICĂ PAUZĂ'}
              tone={busy ? 'lime' : 'peach'}
              style={styles.frontLayer}
            />
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>
            {busy ? (
              <View style={styles.loaderWrap}>
                <PlayfulLoader compact label="Verificăm accesul…" />
              </View>
            ) : null}
          </View>
        </Enter>

        <Enter delay={150} distance={12} style={styles.actions}>
          {onRetry ? (
            <ComicButton
              title="Reîncearcă"
              trailingIcon="retry"
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
              haptic="selection"
              onPress={onNotebook}
              backdrop={(
                <CachedOutsetShadow
                  borderRadius={radii.pill}
                  shadow={LIQUID_SHADOWS.cardOutsetSoft}
                  padTop={10}
                  padX={14}
                  padBottom={18}
                />
              )}
              style={styles.secondaryWrap}
              contentStyle={styles.secondary}
            >
              <LinearGradient
                pointerEvents="none"
                colors={['#FFFFFF', '#F6F0FF']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <CachedInsetRelief borderRadius={radii.pill} shadow={LIQUID_SHADOWS.cardInsetSoft} zIndex={1} />
              <Text style={styles.secondaryText}>Citește Caietul offline →</Text>
            </PressableScale>
          ) : null}
        </Enter>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  brandWrap: { position: 'relative', alignItems: 'center', marginBottom: 12 },
  brandHighlight: {
    position: 'absolute',
    bottom: 1,
    width: 96,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 212, 71, 0.72)',
  },
  brand: { fontFamily: fonts.display, fontSize: 23, color: colors.ink },
  brandAccent: { color: colors.violet },
  mascotWrap: { width: 162, height: 152, alignItems: 'center', justifyContent: 'center', marginBottom: 10, position: 'relative' },
  cardWrap: { width: '100%', maxWidth: 356, position: 'relative' },
  frontLayer: { zIndex: 2 },
  card: {
    borderRadius: 28,
    borderWidth: 1.4,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  title: { fontFamily: fonts.display, fontSize: 23, lineHeight: 28, color: colors.ink, textAlign: 'center', marginTop: 10, zIndex: 2 },
  message: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.inkSoft, textAlign: 'center', marginTop: 8, zIndex: 2 },
  loaderWrap: { marginTop: 14, zIndex: 2 },
  actions: { width: '100%', maxWidth: 330, marginTop: 18, gap: 10 },
  secondaryWrap: { alignSelf: 'stretch', position: 'relative' },
  secondary: {
    minHeight: 48,
    borderRadius: radii.pill,
    borderWidth: 1.25,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  secondaryText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.violetDeep, zIndex: 2 },
});
