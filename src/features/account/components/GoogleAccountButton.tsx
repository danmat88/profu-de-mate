import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radii } from '../../../shared/theme';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { Text } from '../../../shared/ui/Typography';

type Props = {
  busy?: boolean;
  disabled?: boolean;
  note?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

function GoogleGlyph() {
  return (
    <Svg accessible={false} width={24} height={24} viewBox="0 0 24 24">
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
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={busy ? 'Se conectează contul Google' : 'Continuă cu Google'}
      accessibilityState={{ busy, disabled: unavailable }}
      disabled={unavailable}
      dimWhenDisabled={!busy}
      pressedScale={0.97}
      haptic="medium"
      onPress={onPress}
      style={style}
      contentStyle={styles.button}
    >
      <View style={styles.googleMark}><GoogleGlyph /></View>
      <View style={styles.copy}>
        <Text style={styles.title}>{busy ? 'Conectez contul…' : 'Continuă cu Google'}</Text>
        {note ? <Text numberOfLines={2} style={styles.note}>{note}</Text> : null}
      </View>
      {busy
        ? <PlayfulLoader micro />
        : <View style={styles.arrow}><MiniGlyph name="next" size={17} color={colors.paper} /></View>}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 64,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  googleMark: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1.2,
    borderBottomWidth: 2.5,
    borderColor: '#EAE0FC',
    borderBottomColor: '#D4C2F8',
    backgroundColor: '#FAF7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 16.5, lineHeight: 20 },
  note: { marginTop: 2, fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 12, lineHeight: 16 },
  arrow: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    borderBottomWidth: 2.5,
    borderBottomColor: '#3C12A8',
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
