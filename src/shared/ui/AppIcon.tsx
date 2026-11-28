import { Image, ImageStyle, StyleProp } from 'react-native';
import { bundledImageSource } from '../services/bundledImages';

export const iconAssets = {
  bookmark: require('../../../assets/icons/bookmark_ui.png'),
  calculator: require('../../../assets/icons/calculator_ui.png'),
  camera: require('../../../assets/icons/camera_ui.png'),
  class: require('../../../assets/icons/class_ui.png'),
  crop: require('../../../assets/icons/crop_ui.png'),
  examPapers: require('../../../assets/icons/exam_papers_ui.png'),
  explain: require('../../../assets/icons/explain_ui.png'),
  flash: require('../../../assets/icons/flash_ui.png'),
  formulas: require('../../../assets/icons/formulas_ui.png'),
  gallery: require('../../../assets/icons/gallery_ui.png'),
  help: require('../../../assets/icons/help_ui.png'),
  hint: require('../../../assets/icons/hint_ui.png'),
  notebook: require('../../../assets/icons/notebook_ui.png'),
  offline: require('../../../assets/icons/offline_ui.png'),
  practice: require('../../../assets/icons/practice_ui.png'),
  privacy: require('../../../assets/icons/privacy_ui.png'),
  profile: require('../../../assets/icons/profile_ui.png'),
  retake: require('../../../assets/icons/retake_ui.png'),
  scan: require('../../../assets/icons/scan_ui.png'),
  search: require('../../../assets/icons/search_ui.png'),
  settings: require('../../../assets/icons/settings_ui.png'),
  simulation: require('../../../assets/icons/simulation_ui.png'),
  streak: require('../../../assets/icons/streak_ui.png'),
  test: require('../../../assets/icons/test_ui.png'),
  trophy: require('../../../assets/icons/trophy_ui.png'),
  verify: require('../../../assets/icons/verify_ui.png'),
} as const;

export type AppIconName = keyof typeof iconAssets;

export function AppIcon({ name, size = 48, style }: { name: AppIconName; size?: number; style?: StyleProp<ImageStyle> }) {
  return <Image accessible={false} accessibilityIgnoresInvertColors fadeDuration={0} source={bundledImageSource(iconAssets[name])} resizeMode="contain" style={[{ width: size, height: size }, style]} />;
}
