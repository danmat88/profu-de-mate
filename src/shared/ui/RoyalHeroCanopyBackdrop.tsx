import { LinearGradient } from 'expo-linear-gradient';
import { memo, useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

export const ROYAL_HERO_GRADIENT = ['#9B58FF', '#732CF4', '#5218D2', '#3B0EA4'] as const;

type Props = {
  width: number;
  height: number;
  /** Render the base 4-stop Royal-Violet gradient (can be omitted when parent animates its own gradient blend). */
  showGradient?: boolean;
  /** Subtle corner atmospheric light tint matching the studio lighting palette. */
  topLeftAccent?: string;
  bottomRightAccent?: string;
  /** Optional center spotlight coordinates (used by LaunchSplash behind the owl). */
  spotlightCenterY?: number;
  /** Show subtle luminous bottom highlight rim along the curved canopy arch. */
  showBottomRim?: boolean;
};

/**
 * Unified Royal-Violet Hero Canopy backdrop shared identically across
 * LaunchSplash's retracting curtain, WelcomeOnboardingScreen's hero canopy,
 * and HomeSurface's sky dome — pure static SVG optical RadialGradients + fine
 * architectural math grid with zero flat CSS circles and zero per-frame work.
 */
export const RoyalHeroCanopyBackdrop = memo(function RoyalHeroCanopyBackdrop({
  width,
  height,
  showGradient = true,
  topLeftAccent = '#43D6E6',
  bottomRightAccent = '#D8FF3E',
  spotlightCenterY,
  showBottomRim = true,
}: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));

  const { gridPath, crosshairPath } = useMemo(() => {
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
  }, [safeHeight, safeWidth]);

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
          colors={ROYAL_HERO_GRADIENT}
          start={{ x: 0.08, y: 0 }}
          end={{ x: 0.92, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <Svg
        pointerEvents="none"
        width={safeWidth}
        height={safeHeight}
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
        <Path d={gridPath} stroke="#FFFFFF" strokeWidth={0.75} strokeOpacity={0.055} fill="none" />
        <Path d={crosshairPath} stroke="#D8FF3E" strokeWidth={1.15} strokeOpacity={0.3} fill="none" />
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
