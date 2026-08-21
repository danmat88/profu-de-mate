import { useWindowDimensions } from 'react-native';
import { layout } from '../theme';

export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const isNarrow = width < 380;
  const isShort = height < 780;

  return {
    width,
    height,
    fontScale,
    isNarrow,
    isShort,
    isCompact: isNarrow || isShort,
    gutter: isNarrow ? layout.gutterNarrow : layout.gutter,
  };
}
