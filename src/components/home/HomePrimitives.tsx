import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export const homePalette = {
  background: '#101310',
  surface: '#1B201B',
  border: '#343D32',
  text: '#F4F6EF',
  muted: '#A5AFA1',
  lime: '#D4F77D',
  dark: '#17200D',
  display: 'SpaceGrotesk_700Bold',
  medium: 'SpaceGrotesk_500Medium',
} as const;

type IconName = 'camera' | 'gallery' | 'write' | 'book' | 'arrow' | 'settings' | 'spark' | 'check' | 'plus';

// Start the entrance after the launch overlay actually reveals Home.
export const HomeMotionReadyContext = createContext(true);

export function HomeIcon({ name, size = 22, color = homePalette.text }: { name: IconName; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
      {name === 'camera' && <><Path d="M8 5 9.5 3h5L16 5h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /><Circle cx="12" cy="12.5" r="4" /></>}
      {name === 'gallery' && <><Rect x="3" y="3" width="18" height="18" rx="4" /><Circle cx="8" cy="8" r="1.5" /><Path d="m3 16 5-5 5 5 3-3 5 5" /></>}
      {name === 'write' && <><Path d="m15 4 5 5M4 20l5-1L21 7a2.1 2.1 0 0 0-4-4L5 15Z" /><Path d="M13 21h8" /></>}
      {name === 'book' && <><Path d="M12 5v16M3 3h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z" /></>}
      {name === 'arrow' && <Path d="M4 12h15m-6-6 6 6-6 6" />}
      {name === 'settings' && <><Path d="M4 7h16M4 17h16" /><Circle cx="9" cy="7" r="3" fill={homePalette.background} /><Circle cx="16" cy="17" r="3" fill={homePalette.background} /></>}
      {name === 'spark' && <Path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z" />}
      {name === 'check' && <Path d="m5 12 4 4L19 6" />}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" />}
    </Svg>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** One tactile response for every Home action, including keyboard focus on web. */
export function HomeButton({ children, style, reducedMotion, ...props }: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  reducedMotion: boolean;
}) {
  const scale = useSharedValue(1);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const press = (value: number) => {
    scale.set(reducedMotion ? 1 : withSpring(value, { damping: 19, stiffness: 360, mass: 0.65 }));
  };
  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...props}
      onPressIn={(event) => { press(0.97); props.onPressIn?.(event); }}
      onPressOut={(event) => { press(1); props.onPressOut?.(event); }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[style, animatedStyle, hovered && !props.disabled && styles.hover, focused && styles.focus, props.disabled && styles.disabled]}
    >{children}</AnimatedPressable>
  );
}

export function HomeEntrance({ children, delay = 0, style, reducedMotion }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle>; reducedMotion: boolean }) {
  const ready = useContext(HomeMotionReadyContext);
  const progress = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    progress.set(reducedMotion ? 1 : ready ? withDelay(delay, withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) })) : 0);
    return () => cancelAnimation(progress);
  }, [delay, progress, ready, reducedMotion]);
  const entranceStyle = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ translateY: (1 - progress.get()) * 16 }] }));
  return <Animated.View style={[style, entranceStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  hover: { opacity: 0.86 },
  focus: { outlineColor: homePalette.lime, outlineWidth: 2, outlineOffset: 4, outlineStyle: 'solid' },
  disabled: { opacity: 0.55 },
});
