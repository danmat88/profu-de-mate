import { useWindowDimensions } from 'react-native';
import { layout } from '../theme';

export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const isNarrow = width < 380;
  const isShort = height < 850 || fontScale > 1.1;

  return {
    width,
    height,
    fontScale,
    usableHeight: height,
    isNarrow,
    isShort,
    isCompact: isNarrow || isShort,
    gutter: isNarrow ? layout.gutterNarrow : layout.gutter,
  };
}
