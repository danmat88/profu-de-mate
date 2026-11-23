import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bundledImageSource } from '../../shared/services/bundledImages';
import { borders, colors, fonts, radii, shadows, typography } from '../../shared/theme';
import { ComicBackdrop } from '../../shared/ui/ComicBackdrop';
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
          <View style={styles.mascotShadow} />
          <View style={styles.mascotHalo}>
            <View pointerEvents="none" style={styles.haloShine} />
            <Image
              accessible={false}
              source={bundledImageSource(require('../../../assets/mascot/owl_oops.png'))}
              resizeMode="contain"
              style={styles.mascot}
            />
          </View>
          <View style={styles.oopsTag}>
            <Text style={styles.oopsTagText}>HOPA!</Text>
          </View>
        </View>

        <View style={styles.cardWrap}>
          <View pointerEvents="none" style={styles.cardShadow} />
          <View style={styles.card}>
            <View pointerEvents="none" style={styles.cardShine} />
            <Text style={styles.eyebrow}>APLICAȚIA A ÎNTÂMPINAT O PROBLEMĂ</Text>
            <Text style={styles.title}>Ceva nu a mers.</Text>
            <Text style={styles.message}>
              Încearcă să încarci din nou ecranul. Dacă problema apare iar, închide complet aplicația și deschide-o din nou.
            </Text>
          </View>
        </View>

        <View style={styles.buttonWrap}>
          <View pointerEvents="none" style={styles.buttonShadow} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Încarcă din nou ecranul"
            onPress={onRetry}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <View pointerEvents="none" style={styles.buttonShine} />
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
  mascotShadow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    top: 19,
    backgroundColor: colors.ink,
  },
  mascotHalo: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: borders.thick,
    borderColor: colors.ink,
    backgroundColor: colors.peachSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    transform: [{ rotate: '-3deg' }],
  },
  haloShine: {
    position: 'absolute',
    top: 8,
    left: 24,
    right: 24,
    height: 10,
    borderRadius: 6,
    backgroundColor: colors.shine,
  },
  mascot: { width: 136, height: 136 },
  oopsTag: {
    position: 'absolute',
    right: 4,
    bottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.gold,
    transform: [{ rotate: '8deg' }],
  },
  oopsTagText: { ...typography.kicker, color: colors.ink },
  cardWrap: { width: '100%', maxWidth: 356, marginTop: 18, paddingBottom: shadows.md, position: 'relative' },
  cardShadow: {
    position: 'absolute',
    top: shadows.md,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.xl - 4,
    backgroundColor: colors.ink,
  },
  card: {
    borderRadius: radii.xl - 4,
    borderWidth: borders.thick,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardShine: {
    position: 'absolute',
    top: 3,
    left: 14,
    right: 14,
    height: 5,
    borderRadius: 4,
    backgroundColor: colors.shine,
  },
  eyebrow: { ...typography.kicker, color: colors.violetDeep, textAlign: 'center' },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 27, lineHeight: 31, textAlign: 'center', marginTop: 5 },
  message: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  buttonWrap: { width: '100%', maxWidth: 260, minHeight: 62, position: 'relative', marginTop: 22, paddingBottom: shadows.md },
  buttonShadow: { position: 'absolute', top: shadows.md, right: 0, bottom: 0, left: 0, borderRadius: 19, backgroundColor: colors.ink },
  button: {
    minHeight: 56,
    borderRadius: 19,
    borderWidth: borders.thick,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonPressed: { transform: [{ translateY: 3 }] },
  buttonShine: {
    position: 'absolute',
    top: 3,
    left: 14,
    right: 14,
    height: 6,
    borderRadius: 4,
    backgroundColor: colors.shine,
  },
  buttonText: { fontFamily: fonts.display, color: colors.ink, fontSize: 17.5 },
});
