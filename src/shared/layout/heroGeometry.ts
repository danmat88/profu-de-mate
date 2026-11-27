import { layout } from '../theme';

export type HeroGeometryInput = {
  width: number;
  height: number;
  topInset: number;
  fontScale: number;
};

export type HeroGeometry = {
  width: number;
  height: number;
  topInset: number;
  gutter: number;
  contentWidth: number;
  compact: boolean;
  isVeryNarrow: boolean;
  canopyRadius: number;
  headerTopPad: number;
  headerHeight: number;
  logoBadgeSize: number;
  logoImageSize: number;
  logoCenterX: number;
  logoCenterY: number;
  homeMascotSize: number;
  homeSpotlightSize: number;
  homeCanopyHeight: number;
  onboardingMascotSize: number;
  onboardingSpotlightSize: number;
  onboardingCanopyHeight: number;
  splashOwlSize: number;
  splashOwlCenterX: number;
  splashOwlCenterY: number;
};

/**
 * Single source of truth for the curved Royal-Violet hero canopy and top-left
 * brand badge shared across LaunchSplash, WelcomeOnboardingScreen, and
 * HomeSurface so the retracting curtain and flying owl logo dock with exact
 * sub-pixel continuity on every Android screen size and font scale.
 */
export function computeHeroGeometry({
  width,
  height,
  topInset,
  fontScale,
}: HeroGeometryInput): HeroGeometry {
  const isVeryNarrow = width < 350;
  const isNarrow = width < 390;
  const baseGutter = isVeryNarrow ? 13 : isNarrow ? layout.gutterNarrow : layout.gutter;
  const maxContentWidth = 560;
  const gutter = Math.max(baseGutter, (width - maxContentWidth) / 2);
  const contentWidth = Math.max(0, width - gutter * 2);

  const compact = height - topInset < 690 || fontScale >= 1.3;
  const canopyRadius = compact ? 28 : 32;
  const headerTopPad = compact ? 2 : 4;
  const headerHeight = compact ? 44 : 58;
  const logoBadgeSize = compact || isVeryNarrow ? 35 : 44;
  const logoImageSize = compact || isVeryNarrow ? 28 : 35;

  const logoCenterX = gutter + logoBadgeSize / 2;
  const logoCenterY = topInset + headerTopPad + headerHeight / 2;

  const homeMascotSize = compact ? 68 : isVeryNarrow ? 94 : 106;
  const homeSpotlightSize = compact ? 66 : isVeryNarrow ? 92 : 104;
  const homeCanopyHeight = Math.round(topInset + (compact ? 83 : 110) + homeMascotSize);

  const onboardingMascotSize = compact ? 74 : 92;
  const onboardingSpotlightSize = compact ? 72 : 90;
  const onboardingCanopyHeight = Math.round(
    topInset + headerTopPad + headerHeight + (compact ? 4 : 8) + (onboardingMascotSize + 6) + (compact ? 14 : 18),
  );

  const splashOwlSize = height < 720 ? 182 : Math.min(224, Math.round(width * 0.55));
  const splashOwlCenterX = width / 2;
  const splashOwlCenterY = Math.round(height * 0.395);

  return {
    width,
    height,
    topInset,
    gutter,
    contentWidth,
    compact,
    isVeryNarrow,
    canopyRadius,
    headerTopPad,
    headerHeight,
    logoBadgeSize,
    logoImageSize,
    logoCenterX,
    logoCenterY,
    homeMascotSize,
    homeSpotlightSize,
    homeCanopyHeight,
    onboardingMascotSize,
    onboardingSpotlightSize,
    onboardingCanopyHeight,
    splashOwlSize,
    splashOwlCenterX,
    splashOwlCenterY,
  };
}
