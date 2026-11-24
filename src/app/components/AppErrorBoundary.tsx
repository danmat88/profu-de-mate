import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bundledImageSource } from '../../shared/services/bundledImages';
import { colors, fonts, radii, typography } from '../../shared/theme';
import { ComicBackdrop } from '../../shared/ui/ComicBackdrop';
import { SpotlightAura } from '../../shared/ui/SpotlightAura';
import { Text } from '../../shared/ui/Typography';

type Props = { children: ReactNode; onError?: (error: Error, info: ErrorInfo) => void };
type State = { error: Error | null; resetKey: number };

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.safe, { paddingTop: insets.top ?? 0, paddingBottom: insets.bottom ?? 0 }]}>
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
          <View style={styles.card}>
            <Text style={styles.eyebrow}>APLICAȚIA A ÎNTÂMPINAT O PROBLEMĂ</Text>
            <Text style={styles.title}>Ceva nu a mers.</Text>
            <Text style={styles.message}>
              Încearcă să încarci din nou ecranul. Dacă problema apare iar, închide complet aplicația și deschide-o din nou.
            </Text>
          </View>
        </View>

        <View style={styles.buttonWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Încarcă din nou ecranul"
            onPress={onRetry}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
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
  cardWrap: { width: '100%', maxWidth: 356, marginTop: 18 },
  card: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 22,
    paddingVertical: 20,
    alignItems: 'center',
    overflow: 'hidden',
  },
  eyebrow: { ...typography.kicker, color: colors.violetDeep, textAlign: 'center' },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 27, lineHeight: 31, textAlign: 'center', marginTop: 5 },
  message: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  buttonWrap: { width: '100%', maxWidth: 260, minHeight: 56, marginTop: 22 },
  button: {
    minHeight: 54,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(86, 120, 0, 0.16)',
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonPressed: { transform: [{ scale: 0.97 }] },
  buttonText: { fontFamily: fonts.display, color: colors.ink, fontSize: 17.5 },
});
