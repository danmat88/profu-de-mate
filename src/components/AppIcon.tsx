import { Image, ImageStyle, StyleProp } from 'react-native';

export const iconAssets = {
  bookmark: require('../../assets/icons/bookmark-ui.png'),
  camera: require('../../assets/icons/camera-ui.png'),
  class: require('../../assets/icons/class-ui.png'),
  crop: require('../../assets/icons/crop-ui.png'),
  explain: require('../../assets/icons/explain-ui.png'),
  flash: require('../../assets/icons/flash-ui.png'),
  gallery: require('../../assets/icons/gallery-ui.png'),
  help: require('../../assets/icons/help-ui.png'),
  hint: require('../../assets/icons/hint-ui.png'),
  notebook: require('../../assets/icons/notebook-ui.png'),
  practice: require('../../assets/icons/practice-ui.png'),
  privacy: require('../../assets/icons/privacy-ui.png'),
  profile: require('../../assets/icons/profile-ui.png'),
  retake: require('../../assets/icons/retake-ui.png'),
  scan: require('../../assets/icons/scan-ui.png'),
  search: require('../../assets/icons/search-ui.png'),
  settings: require('../../assets/icons/settings-ui.png'),
  streak: require('../../assets/icons/streak-ui.png'),
  trophy: require('../../assets/icons/trophy-ui.png'),
  verify: require('../../assets/icons/verify-ui.png'),
} as const;

export type AppIconName = keyof typeof iconAssets;

export function AppIcon({ name, size = 48, style }: { name: AppIconName; size?: number; style?: StyleProp<ImageStyle> }) {
  return <Image accessibilityIgnoresInvertColors fadeDuration={0} source={iconAssets[name]} resizeMode="contain" style={[{ width: size, height: size }, style]} />;
}
