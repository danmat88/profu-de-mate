import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { colors, fonts } from '../theme';
import { AppIcon, AppIconName } from './AppIcon';
import { MiniGlyph } from './MiniGlyph';

type Props = { title: string; eyebrow?: string; onBack: () => void; rightIcon?: AppIconName; rightLabel?: string; onRight?: () => void; rightActive?: boolean; dark?: boolean };

function HeaderButton({ label, onPress, dark, active, children }: { label: string; onPress?: () => void; dark?: boolean; active?: boolean; children: ReactNode }) {
  const press = useRef(new Animated.Value(0)).current;
  const move = (value: number) => Animated.spring(press, { toValue: value, useNativeDriver: true, speed: 32, bounciness: 3 }).start();
  return (
    <Animated.View style={{ opacity: onPress ? 1 : 0.66, transform: [{ translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, 3] }) }, { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) }] }}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        disabled={!onPress}
        onPressIn={() => move(1)}
        onPressOut={() => move(0)}
        onPress={() => { Haptics.selectionAsync(); onPress?.(); }}
        style={[styles.button, dark && styles.buttonDark, active && styles.buttonActive]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function ScreenHeader({ title, eyebrow, onBack, rightIcon, rightLabel = 'Acțiune', onRight, rightActive = false, dark = false }: Props) {
  const color = dark ? colors.paper : colors.ink;
  const { gutter, isNarrow } = useResponsiveLayout();
  return (
    <View style={[styles.row, { paddingHorizontal: gutter }, isNarrow && styles.rowNarrow]}>
      <HeaderButton label="Înapoi" onPress={onBack} dark={dark}>
        <MiniGlyph name="back" size={27} color={color} />
      </HeaderButton>
      <View style={styles.copy}>
        {eyebrow ? <Text style={[styles.eyebrow, dark && styles.eyebrowDark]}>{eyebrow}</Text> : null}
        <Text numberOfLines={1} style={[styles.title, isNarrow && styles.titleNarrow, dark && styles.titleDark]}>{title}</Text>
      </View>
      {rightIcon ? (
        <HeaderButton label={rightLabel} onPress={onRight} dark={dark} active={rightActive}>
          <AppIcon name={rightIcon} size={43} />
        </HeaderButton>
      ) : <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 13 },
  rowNarrow: { height: 62, gap: 9 },
  button: { width: 43, height: 43, borderRadius: 15, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  buttonDark: { backgroundColor: '#292052', borderColor: colors.paper },
  buttonActive: { backgroundColor: colors.lime, transform: [{ rotate: '3deg' }] },
  copy: { flex: 1 },
  eyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 9, letterSpacing: 1.5 },
  eyebrowDark: { color: colors.lime },
  title: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 19, lineHeight: 22 },
  titleNarrow: { fontSize: 17, lineHeight: 20 },
  titleDark: { color: colors.paper },
  spacer: { width: 43 },
});
