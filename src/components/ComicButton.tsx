import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { colors, fonts } from '../theme';
import { AppIcon, AppIconName } from './AppIcon';
import { MiniGlyph } from './MiniGlyph';

type Tone = 'lime' | 'violet' | 'ink' | 'paper' | 'peach';

type Props = {
  title: string;
  subtitle?: string;
  icon?: AppIconName;
  trailingIcon?: 'next' | 'check' | 'close' | false;
  tone?: Tone;
  compact?: boolean;
  onPress: () => void;
  style?: ViewStyle;
};

const fills: Record<Tone, string> = {
  lime: colors.lime,
  violet: colors.violet,
  ink: colors.ink,
  paper: colors.paper,
  peach: colors.peach,
};

export function ComicButton({ title, subtitle, icon, trailingIcon = 'next', tone = 'lime', compact = false, onPress, style }: Props) {
  const { isNarrow } = useResponsiveLayout();
  const press = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const light = tone === 'violet' || tone === 'ink';
  const condensed = compact || isNarrow;

  useEffect(() => {
    if (tone === 'paper') return;
    const animation = Animated.sequence([
      Animated.delay(420),
      Animated.timing(shine, { toValue: 1, duration: 720, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [shine, tone]);

  const move = (value: number) => {
    Animated.spring(press, { toValue: value, useNativeDriver: true, speed: 34, bounciness: 2 }).start();
  };

  return (
    <View style={[styles.wrap, condensed && styles.wrapCompact, style]}>
      <View style={styles.shadow} />
      <Animated.View style={[styles.motion, { transform: [{ translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) }, { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) }] }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          onPressIn={() => move(1)}
          onPressOut={() => move(0)}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress(); }}
          style={[styles.face, condensed && styles.faceCompact, { backgroundColor: fills[tone] }]}
        >
          {tone !== 'paper' ? <Animated.View pointerEvents="none" style={[styles.shine, { transform: [
            { translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-90, 430] }) },
            { rotate: '18deg' },
          ] }]} /> : null}
          {icon ? (
            <View style={[styles.icon, condensed && styles.iconCompact]}><AppIcon name={icon} size={condensed ? 46 : 58} /></View>
          ) : null}
          <View style={styles.copy}>
            <Text style={[styles.title, condensed && styles.titleCompact, light && styles.light]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, light && styles.lightSoft]}>{subtitle}</Text> : null}
          </View>
          {trailingIcon ? <MiniGlyph name={trailingIcon} size={condensed ? 21 : 27} color={light ? colors.paper : colors.ink} /> : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 0, minHeight: 82, position: 'relative', alignSelf: 'stretch', marginBottom: 7 },
  wrapCompact: { minHeight: 64 },
  motion: { width: '100%', minWidth: 0 },
  shadow: { position: 'absolute', top: 7, left: 0, right: 0, bottom: 0, borderRadius: 22, backgroundColor: colors.ink },
  face: { width: '100%', minWidth: 0, minHeight: 75, borderRadius: 22, borderWidth: 3, borderColor: colors.ink, paddingHorizontal: 13, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, overflow: 'hidden' },
  faceCompact: { minHeight: 57, borderRadius: 18, paddingVertical: 5 },
  shine: { position: 'absolute', top: -42, left: 0, width: 43, height: 150, backgroundColor: 'rgba(255,255,255,0.28)' },
  icon: { width: 57, height: 57, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  iconCompact: { width: 47, height: 47 },
  copy: { flex: 1, minWidth: 0, zIndex: 1 },
  title: { color: colors.ink, fontFamily: fonts.displaySemi, fontSize: 19, lineHeight: 22 },
  titleCompact: { fontSize: 17, lineHeight: 20 },
  subtitle: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12, lineHeight: 16, marginTop: 1 },
  light: { color: colors.paper },
  lightSoft: { color: '#E9E2FF' },
});
