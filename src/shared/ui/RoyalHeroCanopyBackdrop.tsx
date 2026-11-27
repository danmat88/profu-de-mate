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
  /** Render the fine architectural math coordinate grid and subtle optical star glints. */
  showGrid?: boolean;
};

function diamondSpark(cx: number, cy: number, r: number): string {
  const inner = r * 0.34;
  return `M${cx} ${cy - r} Q${cx + inner * 0.4} ${cy - inner * 0.4} ${cx + r} ${cy} Q${cx + inner * 0.4} ${cy + inner * 0.4} ${cx} ${cy + r} Q${cx - inner * 0.4} ${cy + inner * 0.4} ${cx - r} ${cy} Q${cx - inner * 0.4} ${cy - inner * 0.4} ${cx} ${cy - r}Z`;
}

/**
 * Unified Royal-Violet Hero Canopy backdrop shared identically across
 * LaunchSplash's retracting curtain, WelcomeOnboardingScreen, HomeSurface,
 * and every hero canopy across the app — pure static SVG optical
 * RadialGradients + whisper-soft optical glints with zero flat CSS circles.
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
}: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const responsive = width === undefined || height === undefined;
  const safeWidth = Math.max(1, Math.round(width ?? 360));
  const safeHeight = Math.max(1, Math.round(height ?? 220));

  const { gridPath, sparklePath } = useMemo(() => {
    if (!showGrid) return { gridPath: '', sparklePath: '' };
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

    const sparks = safeHeight > 420
      ? [
        diamondSpark(Math.round(safeWidth * 0.22), Math.round(safeHeight * 0.28), 5.5),
        diamondSpark(Math.round(safeWidth * 0.79), Math.round(safeHeight * 0.32), 6),
        diamondSpark(Math.round(safeWidth * 0.72), Math.round(safeHeight * 0.66), 4.5),
      ].join('')
      : [
        diamondSpark(Math.round(safeWidth * 0.52), Math.round(safeHeight * 0.46), 4.4),
        diamondSpark(Math.round(safeWidth * 0.9), Math.round(safeHeight * 0.58), 3.8),
      ].join('');

    return { gridPath: lines.join(''), sparklePath: sparks };
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
            <Stop offset="0%" stopColor={topLeftAccent} stopOpacity="0.3" />
            <Stop offset="55%" stopColor={topLeftAccent} stopOpacity="0.085" />
            <Stop offset="100%" stopColor={topLeftAccent} stopOpacity="0" />
          </RadialGradient>

          <RadialGradient id={bottomId} cx="92%" cy="92%" rx="56%" ry="62%">
            <Stop offset="0%" stopColor={bottomRightAccent} stopOpacity="0.24" />
            <Stop offset="52%" stopColor={bottomRightAccent} stopOpacity="0.065" />
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
            <Path d={gridPath} stroke="#FFFFFF" strokeWidth={0.75} strokeOpacity={0.05} fill="none" />
            <Path d={sparklePath} fill="#FFFFFF" fillOpacity={0.4} />
          </>
        ) : null}
        {spotlightCenterY !== undefined ? (
          <>
            <Rect x={0} y={0} width={safeWidth} height={safeHeight} fill={`url(#${spotId})`} />
            <Rect x={0} y={0} width={safeWidth} height={safeHeight} fill={`url(#${floorId})`} />
          </>
        ) : null}
      </Svg>
    </View>
  );
});

/**
 * Pure velvety Ceramic Studio backdrop for Home's Photo Studio card:
 * porcelain-white depth kissed by soft multi-tone Cyan + Violet + Electric-Lime
 * optical radial light washes — zero drawn lines, grids, or strokes.
 */
export const StudioCardBackdrop = memo(function StudioCardBackdrop({
  checkTheme = false,
}: {
  checkTheme?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const leftId = `scLft_${uid}`;
  const centerId = `scCtr_${uid}`;
  const rightId = `scRgt_${uid}`;
  const leftTint = checkTheme ? '#FFB84D' : '#2ED6EA';
  const centerTint = checkTheme ? '#FF5C8D' : '#7C3CFF';
  const rightTint = checkTheme ? '#FFD84D' : '#C8FF2E';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={checkTheme ? ['#FFFFFF', '#FFFCFD', '#FFF4F7'] : ['#FFFFFF', '#FDFDFF', '#F5F0FF']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg
        pointerEvents="none"
        width="100%"
        height="100%"
        viewBox="0 0 360 320"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient id={leftId} cx="10%" cy="14%" rx="52%" ry="46%">
            <Stop offset="0%" stopColor={leftTint} stopOpacity={checkTheme ? '0.24' : '0.22'} />
            <Stop offset="58%" stopColor={leftTint} stopOpacity="0.06" />
            <Stop offset="100%" stopColor={leftTint} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={centerId} cx="46%" cy="32%" rx="48%" ry="38%">
            <Stop offset="0%" stopColor={centerTint} stopOpacity="0.16" />
            <Stop offset="58%" stopColor={centerTint} stopOpacity="0.045" />
            <Stop offset="100%" stopColor={centerTint} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={rightId} cx="92%" cy="16%" rx="50%" ry="42%">
            <Stop offset="0%" stopColor={rightTint} stopOpacity={checkTheme ? '0.22' : '0.26'} />
            <Stop offset="60%" stopColor={rightTint} stopOpacity="0.06" />
            <Stop offset="100%" stopColor={rightTint} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="360" height="320" fill={`url(#${leftId})`} />
        <Rect x="0" y="0" width="360" height="320" fill={`url(#${centerId})`} />
        <Rect x="0" y="0" width="360" height="320" fill={`url(#${rightId})`} />
      </Svg>
    </View>
  );
});

export type MissionCardTone = 'quiz' | 'setup' | 'mistakes';

const MISSION_PALETTES: Record<MissionCardTone, {
  gradient: readonly [string, string, string];
  leftGlow: string;
  rightGlow: string;
}> = {
  quiz: {
    gradient: ['#FFFFFF', '#EFFCF7', '#D6F6EB'],
    leftGlow: '#2EE5B2',
    rightGlow: '#D8FF3E',
  },
  setup: {
    gradient: ['#FFFFFF', '#FFFAF0', '#FFEBB0'],
    leftGlow: '#FFD55A',
    rightGlow: '#FF9E68',
  },
  mistakes: {
    gradient: ['#FFFFFF', '#FFF3F6', '#FFDDE8'],
    leftGlow: '#FF7598',
    rightGlow: '#FFB46E',
  },
};

/**
 * Velvety luminous pastel Quest backdrop for Home's featured Antrenament /
 * Alege clasa / Repetă greșelile card: soft pearl-to-pastel gradient and
 * diffuse SVG radial light — zero drawn lines or grids.
 */
export const MissionCardBackdrop = memo(function MissionCardBackdrop({
  tone = 'quiz',
}: {
  tone?: MissionCardTone;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const leftId = `mcLft_${uid}`;
  const rightId = `mcRgt_${uid}`;
  const palette = MISSION_PALETTES[tone];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={palette.gradient}
        start={{ x: 0.04, y: 0 }}
        end={{ x: 0.96, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg
        pointerEvents="none"
        width="100%"
        height="100%"
        viewBox="0 0 360 116"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient id={leftId} cx="12%" cy="14%" rx="52%" ry="82%">
            <Stop offset="0%" stopColor={palette.leftGlow} stopOpacity="0.26" />
            <Stop offset="58%" stopColor={palette.leftGlow} stopOpacity="0.065" />
            <Stop offset="100%" stopColor={palette.leftGlow} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={rightId} cx="90%" cy="88%" rx="50%" ry="80%">
            <Stop offset="0%" stopColor={palette.rightGlow} stopOpacity="0.28" />
            <Stop offset="60%" stopColor={palette.rightGlow} stopOpacity="0.065" />
            <Stop offset="100%" stopColor={palette.rightGlow} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="360" height="116" fill={`url(#${leftId})`} />
        <Rect x="0" y="0" width="360" height="116" fill={`url(#${rightId})`} />
      </Svg>
    </View>
  );
});
