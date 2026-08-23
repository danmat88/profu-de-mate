import { useWindowDimensions } from 'react-native';
import { layout } from '../theme';

export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const isVeryNarrow = width < 350;
  const isNarrow = width < 390;
  const isVeryShort = height < 700;
  const isShort = height < 800 || fontScale > 1.1;
  const isCompact = isNarrow || isShort;
  const baseGutter = isVeryNarrow ? 13 : isNarrow ? layout.gutterNarrow : layout.gutter;
  const maxContentWidth = 560;
  const gutter = Math.max(baseGutter, (width - maxContentWidth) / 2);
  const contentWidth = Math.max(0, width - gutter * 2);

  return {
    width,
    height,
    fontScale,
    usableHeight: height,
    contentWidth,
    maxContentWidth,
    isVeryNarrow,
    isNarrow,
    isVeryShort,
    isShort,
    isCompact,
    isTablet: width >= 600,
    gutter,
  };
}
