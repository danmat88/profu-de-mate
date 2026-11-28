import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bundledImageSource } from '../../shared/services/bundledImages';
import { colors, fonts, radii, typography } from '../../shared/theme';
import { CachedInsetRelief, CachedOutsetShadow, LIQUID_SHADOWS } from '../../shared/ui/CachedRelief';
import { ComicBackdrop } from '../../shared/ui/ComicBackdrop';
import { SpotlightAura } from '../../shared/ui/SpotlightAura';
import { Text } from '../../shared/ui/Typography';

type Props = { children: ReactNode; onError?: (error: Error, info: ErrorInfo) => void };
type State = { error: Error | null; resetKey: number };

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.safe, { paddingTop: insets.top ?? 0, paddingBottom: insets.bottom ?? 0 }]}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.content}>
        <View style={styles.mascotWrap}>
          <SpotlightAura size={160} tone="peach" active />
          <Image
            accessible={false}
            source={bundledImageSource(require('../../../assets/mascot/owl_oops.png'))}
            resizeMode="contain"
            style={styles.mascot}
          />
        </View>

        <View style={styles.cardWrap}>
          <CachedOutsetShadow borderRadius={28} shadow={LIQUID_SHADOWS.cardOutset} />
          <View style={styles.card}>
            <LinearGradient
              colors={['#FFFFFF', '#FBF8FF']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.fill}
            />
            <CachedInsetRelief borderRadius={28} shadow={LIQUID_SHADOWS.cardInset} zIndex={1} />
            <Text style={styles.eyebrow}>APLICAȚIA A ÎNTÂMPINAT O PROBLEMĂ</Text>
            <Text style={styles.title}>Ceva nu a mers.</Text>
            <Text style={styles.message}>
              Încearcă să încarci din nou ecranul. Dacă problema apare iar, închide complet aplicația și deschide-o din nou.
            </Text>
          </View>
        </View>

        <View style={styles.buttonWrap}>
          <CachedOutsetShadow borderRadius={radii.pill} shadow={LIQUID_SHADOWS.limeOutset} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Încarcă din nou ecranul"
            onPress={onRetry}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <LinearGradient
              colors={['#EDFF7A', '#D8FF3E', '#BCEF12']}
              start={{ x: 0.08, y: 0 }}
              end={{ x: 0.92, y: 1 }}
              style={styles.fill}
            />
            <CachedInsetRelief borderRadius={radii.pill} shadow={LIQUID_SHADOWS.limeInset} zIndex={1} />
            <Text style={styles.buttonText}>Încarcă din nou</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
    if (__DEV__) console.error('App render error', error, info.componentStack);
  }

  private retry = () => {
    this.setState((state) => ({ error: null, resetKey: state.resetKey + 1 }));
  };

  render() {
    if (!this.state.error) {
      return <View key={this.state.resetKey} style={styles.app}>{this.props.children}</View>;
    }

    return <ErrorFallback onRetry={this.retry} />;
  }
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  mascotWrap: { width: 176, height: 176, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  mascot: { width: 136, height: 136 },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  cardWrap: { width: '100%', maxWidth: 356, marginTop: 18, position: 'relative' },
  card: {
    borderRadius: 28,
    borderWidth: 1.35,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingVertical: 20,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  eyebrow: { ...typography.kicker, color: colors.violetDeep, textAlign: 'center', zIndex: 2 },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 27, lineHeight: 31, textAlign: 'center', marginTop: 5, zIndex: 2 },
  message: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginTop: 8, zIndex: 2 },
  buttonWrap: { width: '100%', maxWidth: 260, minHeight: 56, marginTop: 22, position: 'relative' },
  button: {
    minHeight: 54,
    borderRadius: radii.pill,
    borderWidth: 1.25,
    borderColor: '#F4FFA6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  buttonPressed: { transform: [{ scale: 0.97 }] },
  buttonText: { fontFamily: fonts.display, color: colors.ink, fontSize: 17.5, zIndex: 2 },
});
