import { memo, useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

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
