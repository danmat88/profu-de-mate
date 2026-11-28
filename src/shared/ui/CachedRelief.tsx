import { memo, useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

/**
 * Curated flagship 3D Liquid-Glass shadow & pillow-relief tokens shared across
 * Splash, Home, TabBar, and every screen in the app so surfaces share identical
 * optical light direction (warm top specular rim + soft tinted bottom cushion).
 */
export const LIQUID_SHADOWS = {
  // Primary light porcelain cards & panels
  cardOutset: '0 6px 12px -3px rgba(58, 18, 168, 0.13), 0 2px 5px -1px rgba(58, 18, 168, 0.08)',
  cardInset: 'inset 0 2.5px 5px rgba(255, 255, 255, 0.98), inset 0 -5px 10px rgba(108, 66, 216, 0.12)',
  cardOutsetSoft: '0 4px 9px -2px rgba(58, 18, 168, 0.10), 0 1.5px 3px rgba(58, 18, 168, 0.06)',
  cardInsetSoft: 'inset 0 2px 4px rgba(255, 255, 255, 0.98), inset 0 -3.5px 7px rgba(108, 66, 216, 0.10)',

  // Tinted pastel cards
  violetOutset: '0 6px 12px -3px rgba(68, 18, 192, 0.26), 0 2px 5px rgba(40, 8, 126, 0.15)',
  violetInset: 'inset 0 2.5px 5px rgba(255, 255, 255, 0.42), inset 0 -5px 10px rgba(22, 4, 76, 0.34)',
  limeOutset: '0 5px 10px -2px rgba(108, 152, 0, 0.30), 0 2px 4px rgba(82, 118, 0, 0.16)',
  limeInset: 'inset 0 3px 5.5px rgba(255, 255, 236, 0.86), inset 0 -5px 9px rgba(80, 116, 0, 0.32)',
  goldOutset: '0 5px 10px -2px rgba(186, 118, 0, 0.28), 0 2px 4px rgba(154, 92, 0, 0.15)',
  goldInset: 'inset 0 3px 5px rgba(255, 252, 232, 0.88), inset 0 -5px 9px rgba(162, 92, 0, 0.28)',
  goldSoftOutset: '0 5px 10px -2px rgba(180, 114, 0, 0.15), 0 2px 4px rgba(180, 114, 0, 0.08)',
  goldSoftInset: 'inset 0 2.5px 4.5px rgba(255, 255, 255, 0.98), inset 0 -4.5px 8px rgba(212, 144, 0, 0.18)',
  cyanOutset: '0 5px 10px -2px rgba(11, 130, 158, 0.24), 0 2px 4px rgba(11, 130, 158, 0.14)',
  cyanInset: 'inset 0 2.5px 5px rgba(255, 255, 255, 0.68), inset 0 -4.5px 8px rgba(10, 122, 152, 0.26)',
  cyanSoftOutset: '0 4px 8px -2px rgba(11, 130, 158, 0.15), 0 1px 3px rgba(11, 130, 158, 0.08)',
  cyanSoftInset: 'inset 0 2.5px 4px rgba(255, 255, 255, 0.98), inset 0 -4px 7px rgba(14, 146, 178, 0.17)',
  mintOutset: '0 5px 10px -2px rgba(12, 126, 96, 0.22), 0 2px 4px rgba(12, 126, 96, 0.12)',
  mintSoftOutset: '0 5px 10px -2px rgba(12, 126, 96, 0.14), 0 1.5px 4px rgba(12, 126, 96, 0.08)',
  mintSoftInset: 'inset 0 2.5px 4.5px rgba(255, 255, 255, 0.98), inset 0 -4.5px 8px rgba(14, 166, 127, 0.16)',
  peachOutset: '0 5px 10px -2px rgba(186, 62, 34, 0.24), 0 2px 4px rgba(146, 42, 22, 0.14)',
  peachInset: 'inset 0 2.5px 5px rgba(255, 248, 242, 0.56), inset 0 -4.5px 8px rgba(154, 42, 18, 0.28)',
  peachSoftOutset: '0 5px 10px -2px rgba(186, 72, 46, 0.14), 0 1.5px 4px rgba(186, 72, 46, 0.08)',
  peachSoftInset: 'inset 0 2.5px 4.5px rgba(255, 255, 255, 0.98), inset 0 -4.5px 8px rgba(212, 96, 68, 0.16)',
  roseSoftOutset: '0 5px 10px -2px rgba(192, 28, 86, 0.15), 0 1.5px 4px rgba(192, 28, 86, 0.08)',
  roseSoftInset: 'inset 0 2.5px 4.5px rgba(255, 255, 255, 0.98), inset 0 -4.5px 8px rgba(214, 34, 92, 0.16)',
  darkOutset: '0 6px 12px -2px rgba(12, 5, 38, 0.34), 0 2px 5px rgba(12, 5, 38, 0.22)',
  darkInset: 'inset 0 2px 4px rgba(255, 255, 255, 0.22), inset 0 -4px 8px rgba(6, 2, 24, 0.42)',

  // Interactive pills, icon orbs, canopy glass badges, recessed tracks
  canopyGlassOutset: '0 4px 8px -1px rgba(20, 4, 66, 0.24), 0 1px 3px rgba(20, 4, 66, 0.16)',
  canopyGlassInset: 'inset 0 2px 4px rgba(255, 255, 255, 0.46), inset 0 -3px 5px rgba(22, 5, 72, 0.26)',
  orbSurface: '0 3px 6px -1px rgba(58, 18, 168, 0.14), inset 0 2px 3px rgba(255, 255, 255, 1), inset 0 -3px 5px rgba(108, 66, 216, 0.13)',
  orbGoldSurface: '0 3px 6px -1px rgba(181, 116, 0, 0.16), inset 0 2px 3px rgba(255, 255, 255, 1), inset 0 -3px 5px rgba(212, 144, 0, 0.16)',
  orbCyanSurface: '0 3px 6px -1px rgba(11, 128, 156, 0.14), inset 0 2px 3px rgba(255, 255, 255, 1), inset 0 -3px 5px rgba(14, 146, 178, 0.14)',
  orbMintSurface: '0 3px 6px -1px rgba(12, 125, 96, 0.15), inset 0 2px 3px rgba(255, 255, 255, 1), inset 0 -3px 5px rgba(14, 166, 127, 0.14)',
  orbRoseSurface: '0 3px 6px -1px rgba(196, 31, 88, 0.15), inset 0 2px 3px rgba(255, 255, 255, 1), inset 0 -3px 5px rgba(214, 34, 92, 0.15)',
  chipSurface: '0 2px 5px -1px rgba(72, 26, 184, 0.11), inset 0 1.5px 2.5px rgba(255, 255, 255, 0.98), inset 0 -2px 3.5px rgba(114, 62, 232, 0.11)',
  trackOutset: '0 5px 10px -2px rgba(56, 18, 160, 0.13), 0 2px 4px rgba(56, 18, 160, 0.08)',
  trackRecess: 'inset 0 2.5px 6px rgba(66, 22, 178, 0.13), inset 0 -2px 4px rgba(255, 255, 255, 0.94)',
  sheetInset: 'inset 0 3px 6px rgba(255, 255, 255, 0.96), inset 0 -2px 4px rgba(82, 24, 210, 0.06)',
} as const;

type OutsetProps = {
  borderRadius: number;
  shadow: string;
  padTop?: number;
  padX?: number;
  padBottom?: number;
  zIndex?: number;
};

type InsetProps = {
  borderRadius: number;
  shadow: string;
  zIndex?: number;
};

type SurfaceProps = {
  borderRadius: number;
  backgroundColor: string;
  shadow: string;
  padTop?: number;
  padX?: number;
  padBottom?: number;
  borderWidth?: number;
  borderColor?: string;
  zIndex?: number;
};

/**
 * Static, zero-child GPU-cached outset boxShadow layer.
 *
 * On Android HWUI, OutsetBoxShadowDrawable runs a Gaussian BlurMaskFilter on
 * every composite frame unless rasterized into a hardware texture layer. Because
 * this leaf expands outside the target bounds by padTop/padX/padBottom and holds
 * zero animated children, Android bakes the soft blur ONCE on mount and draws a
 * single 0.01ms textured quad at 60/120fps thereafter — obeying parent opacity
 * cleanly with zero elevation X-ray artifacts.
 */
export const CachedOutsetShadow = memo(function CachedOutsetShadow({
  borderRadius,
  shadow,
  padTop = 8,
  padX = 12,
  padBottom = 16,
  zIndex = 0,
}: OutsetProps) {
  const outerStyle = useMemo<ViewStyle>(() => ({
    position: 'absolute',
    top: -padTop,
    left: -padX,
    right: -padX,
    bottom: -padBottom,
    paddingTop: padTop,
    paddingHorizontal: padX,
    paddingBottom: padBottom,
    zIndex,
  }), [padBottom, padTop, padX, zIndex]);

  const innerStyle = useMemo<ViewStyle>(() => ({
    flex: 1,
    borderRadius,
    boxShadow: shadow,
  }), [borderRadius, shadow]);

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      renderToHardwareTextureAndroid
      style={outerStyle}
    >
      <View style={innerStyle} />
    </View>
  );
});

/**
 * Static, zero-child GPU-cached inset boxShadow overlay for curved 3D pillow
 * dome lighting and cushion shading over LinearGradient or backdrop cards.
 */
export const CachedInsetRelief = memo(function CachedInsetRelief({
  borderRadius,
  shadow,
  zIndex = 1,
}: InsetProps) {
  const style = useMemo<ViewStyle>(() => ({
    borderRadius,
    boxShadow: shadow,
    zIndex,
  }), [borderRadius, shadow, zIndex]);

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      renderToHardwareTextureAndroid
      style={[StyleSheet.absoluteFill, style]}
    />
  );
});

/**
 * Static, zero-child GPU-cached 3D sculpted surface combining solid background,
 * soft outset drop shadow, and curved inset pillow relief in a single texture
 * baked once on mount — ideal for chips, micro-pills, and icon plates.
 */
export const CachedSurface = memo(function CachedSurface({
  borderRadius,
  backgroundColor,
  shadow,
  padTop = 6,
  padX = 8,
  padBottom = 12,
  borderWidth,
  borderColor,
  zIndex = 0,
}: SurfaceProps) {
  const outerStyle = useMemo<ViewStyle>(() => ({
    position: 'absolute',
    top: -padTop,
    left: -padX,
    right: -padX,
    bottom: -padBottom,
    paddingTop: padTop,
    paddingHorizontal: padX,
    paddingBottom: padBottom,
    zIndex,
  }), [padBottom, padTop, padX, zIndex]);

  const innerStyle = useMemo<ViewStyle>(() => ({
    flex: 1,
    borderRadius,
    backgroundColor,
    borderWidth,
    borderColor,
    boxShadow: shadow,
  }), [backgroundColor, borderColor, borderRadius, borderWidth, shadow]);

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      renderToHardwareTextureAndroid
      style={outerStyle}
    >
      <View style={innerStyle} />
    </View>
  );
});
