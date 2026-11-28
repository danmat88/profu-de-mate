import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { borders, colors, radii } from '../theme';
import { CachedInsetRelief, CachedOutsetShadow, LIQUID_SHADOWS } from './CachedRelief';

export type ComicCardTone =
  | 'paper'
  | 'paperTint'
  | 'violet'
  | 'violetSoft'
  | 'lime'
  | 'limeSoft'
  | 'peachSoft'
  | 'cyanSoft'
  | 'goldSoft'
  | 'ink';

const gradients: Record<ComicCardTone, readonly [string, string]> = {
  paper: ['#FFFFFF', '#FBF8FF'],
  paperTint: ['#FDFBFF', '#F3ECFF'],
  violet: ['#8B46FF', '#581CE0'],
  violetSoft: ['#FAF7FF', '#EDE3FF'],
  lime: ['#ECFF74', '#CBF51E'],
  limeSoft: ['#FAFFE8', '#ECFFB9'],
  peachSoft: ['#FFF9F6', '#FFEBE3'],
  cyanSoft: ['#F7FEFF', '#E2F8FE'],
  goldSoft: ['#FFFDF4', '#FFF0C2'],
  ink: ['#292056', '#1B143D'],
};

const borderTones: Record<ComicCardTone, string> = {
  paper: '#FFFFFF',
  paperTint: '#FFFFFF',
  violet: 'rgba(255, 255, 255, 0.28)',
  violetSoft: '#FFFFFF',
  lime: '#F6FFB2',
  limeSoft: '#FFFFFF',
  peachSoft: '#FFFFFF',
  cyanSoft: '#FFFFFF',
  goldSoft: '#FFFFFF',
  ink: 'rgba(180, 156, 255, 0.24)',
};

const shadowTones: Record<ComicCardTone, { outset: string; inset: string }> = {
  paper: { outset: LIQUID_SHADOWS.cardOutset, inset: LIQUID_SHADOWS.cardInset },
  paperTint: { outset: LIQUID_SHADOWS.cardOutsetSoft, inset: LIQUID_SHADOWS.cardInsetSoft },
  violet: { outset: LIQUID_SHADOWS.violetOutset, inset: LIQUID_SHADOWS.violetInset },
  violetSoft: { outset: LIQUID_SHADOWS.cardOutsetSoft, inset: LIQUID_SHADOWS.cardInset },
  lime: { outset: LIQUID_SHADOWS.limeOutset, inset: LIQUID_SHADOWS.limeInset },
  limeSoft: { outset: LIQUID_SHADOWS.mintSoftOutset, inset: LIQUID_SHADOWS.mintSoftInset },
  peachSoft: { outset: LIQUID_SHADOWS.peachSoftOutset, inset: LIQUID_SHADOWS.peachSoftInset },
  cyanSoft: { outset: LIQUID_SHADOWS.cyanSoftOutset, inset: LIQUID_SHADOWS.cyanSoftInset },
  goldSoft: { outset: LIQUID_SHADOWS.goldSoftOutset, inset: LIQUID_SHADOWS.goldSoftInset },
  ink: { outset: LIQUID_SHADOWS.darkOutset, inset: LIQUID_SHADOWS.darkInset },
};

type Props = {
  children: ReactNode;
  tone?: ComicCardTone;
  depth?: number;
  radius?: number;
  borderWidth?: number;
  shadowColor?: string;
  shine?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * GPU-cached 3D Liquid-Glass studio card matching Home & Splash surfaces:
 * porcelain/pastel vertical light gradient, baked outset drop shadow, curved
 * inset dome specular relief, and zero Android elevation overdraw.
 */
export function ComicCard({
  children,
  tone = 'paper',
  radius = radii.lg,
  borderWidth = borders.regular,
  style,
  contentStyle,
}: Props) {
  const effectiveBorder = Math.min(borderWidth, 1.4);
  const relief = shadowTones[tone];
  const innerRadius = Math.max(4, radius - 1);

  return (
    <View style={[styles.wrap, style]}>
      <CachedOutsetShadow
        borderRadius={radius}
        shadow={relief.outset}
        padTop={14}
        padX={18}
        padBottom={24}
      />
      <View
        style={[
          styles.face,
          {
            borderRadius: radius,
            borderWidth: effectiveBorder,
            borderColor: borderTones[tone],
            backgroundColor: tone === 'ink' ? colors.surfaceDarkCard : colors.paper,
          },
          contentStyle,
        ]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={gradients[tone]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.fill}
        />
        <CachedInsetRelief borderRadius={innerRadius} shadow={relief.inset} zIndex={1} />
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', minWidth: 0 },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  face: {
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  content: {
    zIndex: 2,
    minWidth: 0,
  },
});
