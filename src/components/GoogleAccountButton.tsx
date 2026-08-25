import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../theme';
import { MiniGlyph } from './MiniGlyph';
import { PlayfulLoader } from './PlayfulLoader';
import { Text } from './Typography';

type Props = {
  busy?: boolean;
  disabled?: boolean;
  note?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

function GoogleGlyph() {
  return (
    <Svg accessible={false} width={25} height={25} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M21.35 12.21c0-.71-.06-1.4-.18-2.06H12v3.9h5.24a4.48 4.48 0 0 1-1.94 2.86v2.53h3.15c1.84-1.7 2.9-4.2 2.9-7.23Z" />
      <Path fill="#34A853" d="M12 21.72c2.63 0 4.84-.87 6.45-2.36l-3.15-2.53c-.88.59-2 .94-3.3.94-2.54 0-4.69-1.72-5.46-4.02H3.29v2.61A9.74 9.74 0 0 0 12 21.72Z" />
      <Path fill="#FBBC05" d="M6.54 13.75a5.87 5.87 0 0 1 0-3.5V7.64H3.29a9.75 9.75 0 0 0 0 8.72l3.25-2.61Z" />
      <Path fill="#EA4335" d="M12 6.23c1.43 0 2.72.49 3.73 1.45l2.79-2.79A9.36 9.36 0 0 0 12 2.28a9.74 9.74 0 0 0-8.71 5.36l3.25 2.61c.77-2.3 2.92-4.02 5.46-4.02Z" />
    </Svg>
  );
}

export function GoogleAccountButton({ busy = false, disabled = false, note, onPress, style }: Props) {
  const unavailable = busy || disabled;
  return (
    <View style={[styles.shadow, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={busy ? 'Se conectează contul Google' : 'Continuă cu Google'}
        accessibilityState={{ busy, disabled: unavailable }}
        disabled={unavailable}
        onPress={onPress}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, unavailable && styles.disabled]}
      >
        <View style={styles.googleMark}><GoogleGlyph /></View>
        <View style={styles.copy}>
          <Text style={styles.title}>{busy ? 'Conectez contul…' : 'Continuă cu Google'}</Text>
          {note ? <Text numberOfLines={2} style={styles.note}>{note}</Text> : null}
        </View>
        {busy
          ? <PlayfulLoader micro />
          : <View style={styles.arrow}><MiniGlyph name="next" size={18} color={colors.paper} /></View>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { minHeight: 68, borderRadius: 20, backgroundColor: colors.ink, paddingBottom: 5 },
  button: { minHeight: 63, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 19, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 11, paddingVertical: 8 },
  pressed: { transform: [{ translateY: 3 }], opacity: 0.94 },
  disabled: { opacity: 0.68 },
  googleMark: { width: 42, height: 42, borderRadius: 14, borderWidth: 1.5, borderColor: '#D8D4E2', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-2deg' }] },
  copy: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 16, lineHeight: 19 },
  note: { marginTop: 1, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 10.5, lineHeight: 14 },
  arrow: { width: 35, height: 35, borderRadius: 12, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
});
