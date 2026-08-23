import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

type Props = { children: ReactNode; onError?: () => void };
type State = { error: Error | null; resetKey: number };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.();
    if (__DEV__) console.error('App render error', error, info.componentStack);
  }

  private retry = () => {
    this.setState((state) => ({ error: null, resetKey: state.resetKey + 1 }));
  };

  render() {
    if (!this.state.error) {
      return <View key={this.state.resetKey} style={styles.app}>{this.props.children}</View>;
    }

    return (
      <SafeAreaView style={styles.safe}>
        <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.content}>
          <View style={styles.mascotHalo}>
            <Image
              accessible={false}
              source={require('../../assets/profu-mascot-v2.png')}
              resizeMode="contain"
              style={styles.mascot}
            />
          </View>
          <Text style={styles.eyebrow}>APLICAȚIA A ÎNTÂMPINAT O PROBLEMĂ</Text>
          <Text style={styles.title}>Ceva nu a mers.</Text>
          <Text style={styles.message}>
            Încearcă să încarci din nou ecranul. Dacă problema apare iar, închide complet aplicația și deschide-o din nou.
          </Text>
          <View style={styles.buttonWrap}>
            <View style={styles.buttonShadow} />
            <Pressable accessibilityRole="button" accessibilityLabel="Încarcă din nou ecranul" onPress={this.retry} style={styles.button}>
              <Text style={styles.buttonText}>Încarcă din nou</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  mascotHalo: { width: 176, height: 176, borderRadius: 88, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  mascot: { width: 164, height: 172 },
  eyebrow: { color: colors.violetDeep, fontWeight: '800', fontSize: 10, letterSpacing: 1.4, marginTop: 24 },
  title: { maxWidth: 320, color: colors.ink, fontWeight: '900', fontSize: 30, lineHeight: 34, textAlign: 'center', marginTop: 6 },
  message: { maxWidth: 340, color: colors.inkSoft, fontWeight: '500', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10 },
  buttonWrap: { width: 220, minHeight: 60, position: 'relative', marginTop: 26 },
  buttonShadow: { position: 'absolute', top: 6, right: 0, bottom: 0, left: 0, borderRadius: 18, backgroundColor: colors.ink },
  button: { minHeight: 54, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.ink, fontWeight: '900', fontSize: 17 },
});
