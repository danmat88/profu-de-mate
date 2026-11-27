import { LinearGradient } from 'expo-linear-gradient';
import { memo, useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

export const ROYAL_HERO_GRADIENT = ['#9B58FF', '#732CF4', '#5218D2', '#3B0EA4'] as const;

type Props = {
  /** Optional explicit width/height for pixel-locked canopies (Splash, Onboarding, Home). Omit to auto-fill any dynamic canopy. */
  width?: number;
  height?: number;
  /** Optional custom gradient stops when a screen has its own signature mood (StudyHub, Notebook, Paywall Max, etc.). */
  colors?: readonly [string, string, ...string[]];
  /** Render the gradient layer (set false when parent animates its own cross-fading gradients). */
  showGradient?: boolean;
  /** Subtle corner atmospheric light tint matching the studio lighting palette. */
  topLeftAccent?: string;
  bottomRightAccent?: string;
  /** Optional center spotlight coordinates (used by LaunchSplash behind the owl). */
  spotlightCenterY?: number;
  /** Render the fine architectural math coordinate grid + crosshairs. */
  showGrid?: boolean;
  /** Show subtle luminous bottom highlight rim along the curved canopy arch. */
  showBottomRim?: boolean;
};

/**
 * Unified Royal-Violet Hero Canopy backdrop shared identically across
 * LaunchSplash's retracting curtain, WelcomeOnboardingScreen, HomeSurface,
 * and every hero canopy across the app — pure static SVG optical
 * RadialGradients + fine architectural math grid with zero flat CSS circles
 * and zero per-frame animation overhead.
 */
export const RoyalHeroCanopyBackdrop = memo(function RoyalHeroCanopyBackdrop({
  width,
  height,
  colors = ROYAL_HERO_GRADIENT,
  showGradient = true,
  topLeftAccent = '#43D6E6',
  bottomRightAccent = '#D8FF3E',
  spotlightCenterY,
  showGrid = true,
  showBottomRim = true,
}: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const responsive = width === undefined || height === undefined;
  const safeWidth = Math.max(1, Math.round(width ?? 360));
  const safeHeight = Math.max(1, Math.round(height ?? 220));

  const { gridPath, crosshairPath } = useMemo(() => {
    if (!showGrid) return { gridPath: '', crosshairPath: '' };
    const step = 36;
    const cols = Math.ceil(safeWidth / step);
    const rows = Math.ceil(safeHeight / step);
    const offsetX = Math.round((safeWidth - cols * step) / 2);
    const lines: string[] = [];
    for (let c = 0; c <= cols; c += 1) {
      const x = offsetX + c * step;
      lines.push(`M${x} 0V${safeHeight}`);
    }
    for (let r = 0; r <= rows; r += 1) {
      const y = r * step;
      lines.push(`M0 ${y}H${safeWidth}`);
    }

    const marks: string[] = [];
    const points = safeHeight > 420
      ? [
        [Math.round(safeWidth * 0.16), Math.round(safeHeight * 0.2)],
        [Math.round(safeWidth * 0.84), Math.round(safeHeight * 0.24)],
        [Math.round(safeWidth * 0.14), Math.round(safeHeight * 0.72)],
        [Math.round(safeWidth * 0.86), Math.round(safeHeight * 0.68)],
      ]
      : [
        [Math.round(safeWidth * 0.16), Math.round(safeHeight * 0.78)],
        [Math.round(safeWidth * 0.62), Math.round(safeHeight * 0.34)],
      ];
    for (const [px, py] of points) {
      marks.push(`M${px - 4.5} ${py}H${px + 4.5}M${px} ${py - 4.5}V${py + 4.5}`);
    }

    return { gridPath: lines.join(''), crosshairPath: marks.join('') };
  }, [safeHeight, safeWidth, showGrid]);

  const topId = `rhTop_${uid}`;
  const bottomId = `rhBot_${uid}`;
  const spotId = `rhSpot_${uid}`;
  const floorId = `rhFloor_${uid}`;
  const spotCyPercent = spotlightCenterY !== undefined
    ? `${Math.round((spotlightCenterY / safeHeight) * 100)}%`
    : '50%';
  const floorCyPercent = spotlightCenterY !== undefined
    ? `${Math.round(((spotlightCenterY + 94) / safeHeight) * 100)}%`
    : '60%';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {showGradient ? (
        <LinearGradient
          colors={colors}
          start={{ x: 0.08, y: 0 }}
          end={{ x: 0.92, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <Svg
        pointerEvents="none"
        width={responsive ? '100%' : safeWidth}
        height={responsive ? '100%' : safeHeight}
        viewBox={`0 0 ${safeWidth} ${safeHeight}`}
        preserveAspectRatio={responsive ? 'xMidYMid slice' : undefined}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient id={topId} cx="8%" cy="8%" rx="58%" ry="64%">
            <Stop offset="0%" stopColor={topLeftAccent} stopOpacity="0.24" />
            <Stop offset="55%" stopColor={topLeftAccent} stopOpacity="0.065" />
            <Stop offset="100%" stopColor={topLeftAccent} stopOpacity="0" />
          </RadialGradient>

          <RadialGradient id={bottomId} cx="92%" cy="92%" rx="56%" ry="62%">
            <Stop offset="0%" stopColor={bottomRightAccent} stopOpacity="0.2" />
            <Stop offset="52%" stopColor={bottomRightAccent} stopOpacity="0.055" />
            <Stop offset="100%" stopColor={bottomRightAccent} stopOpacity="0" />
          </RadialGradient>

          {spotlightCenterY !== undefined ? (
            <>
              <RadialGradient id={spotId} cx="50%" cy={spotCyPercent} rx="54%" ry="34%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.28" />
                <Stop offset="34%" stopColor="#D8FF3E" stopOpacity="0.15" />
                <Stop offset="68%" stopColor="#9B58FF" stopOpacity="0.06" />
                <Stop offset="100%" stopColor="#5218D2" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id={floorId} cx="50%" cy={floorCyPercent} rx="22%" ry="2.2%">
                <Stop offset="0%" stopColor="#1B064F" stopOpacity="0.34" />
                <Stop offset="65%" stopColor="#1B064F" stopOpacity="0.1" />
                <Stop offset="100%" stopColor="#1B064F" stopOpacity="0" />
              </RadialGradient>
            </>
          ) : null}
        </Defs>

        <Rect x={0} y={0} width={safeWidth} height={safeHeight} fill={`url(#${topId})`} />
        <Rect x={0} y={0} width={safeWidth} height={safeHeight} fill={`url(#${bottomId})`} />
        {showGrid ? (
          <>
            <Path d={gridPath} stroke="#FFFFFF" strokeWidth={0.75} strokeOpacity={0.055} fill="none" />
            <Path d={crosshairPath} stroke="#D8FF3E" strokeWidth={1.15} strokeOpacity={0.3} fill="none" />
          </>
        ) : null}
        {spotlightCenterY !== undefined ? (
          <>
            <Rect x={0} y={0} width={safeWidth} height={safeHeight} fill={`url(#${spotId})`} />
            <Rect x={0} y={0} width={safeWidth} height={safeHeight} fill={`url(#${floorId})`} />
          </>
        ) : null}
      </Svg>

      {showBottomRim ? <View style={styles.bottomRim} /> : null}
    </View>
  );
});

/**
 * Whisper-delicate pearl studio backdrop for Home's main scanner stage card:
 * smooth optical SVG radial glow + faint notebook math grid echoing the Hero
 * Canopy above with zero flat CSS circles and zero visual clutter.
 */
export const StudioCardBackdrop = memo(function StudioCardBackdrop({
  checkTheme = false,
}: {
  checkTheme?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const cornerId = `scCor_${uid}`;
  const bottomId = `scBot_${uid}`;
  const primary = checkTheme ? '#FF8D6B' : '#7C3CFF';
  const secondary = checkTheme ? '#FFD447' : '#D8FF3E';
  const gridStroke = checkTheme ? '#C42064' : '#6A2CEB';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={checkTheme ? ['#FFFFFF', '#FFF9FA', '#FFF1F5'] : ['#FFFFFF', '#FCF9FF', '#F5EFFF']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg
        pointerEvents="none"
        width="100%"
        height="100%"
        viewBox="0 0 360 220"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient id={cornerId} cx="94%" cy="10%" rx="52%" ry="56%">
            <Stop offset="0%" stopColor={primary} stopOpacity="0.11" />
            <Stop offset="58%" stopColor={primary} stopOpacity="0.03" />
            <Stop offset="100%" stopColor={primary} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={bottomId} cx="8%" cy="94%" rx="48%" ry="52%">
            <Stop offset="0%" stopColor={secondary} stopOpacity={checkTheme ? '0.18' : '0.24'} />
            <Stop offset="55%" stopColor={secondary} stopOpacity="0.05" />
            <Stop offset="100%" stopColor={secondary} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="360" height="220" fill={`url(#${cornerId})`} />
        <Rect x="0" y="0" width="360" height="220" fill={`url(#${bottomId})`} />
        <Path
          d="M36 0V220M72 0V220M108 0V220M144 0V220M180 0V220M216 0V220M252 0V220M288 0V220M324 0V220M0 36H360M0 72H360M0 108H360M0 144H360M0 180H360"
          stroke={gridStroke}
          strokeWidth={0.75}
          strokeOpacity={0.042}
          fill="none"
        />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  bottomRim: {
    position: 'absolute',
    left: 28,
    right: 28,
    bottom: 1.5,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
});
