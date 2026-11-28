import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { cosinePulseRange, createNativeLoop, SILKY_EASE_OUT, WAVE_INPUT_17 } from '../../../shared/motion/nativeMotion';
import { colors, fonts, radii, typography } from '../../../shared/theme';
import {
  CachedInsetRelief,
  CachedOutsetShadow,
  LIQUID_SHADOWS,
} from '../../../shared/ui/CachedRelief';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { Text } from '../../../shared/ui/Typography';
import { formatRoCount } from '../../../shared/utils/romanianGrammar';
import { useQuotaResetCountdown } from '../hooks/useQuotaResetCountdown';

export type QuotaResetTimerVariant = 'hero' | 'compact' | 'embedded' | 'canopy';

type Props = {
  resetAt: string | null | undefined;
  remaining: number;
  limit: number;
  premium?: boolean;
  planName?: 'Start' | 'Pro' | 'Max' | null;
  variant?: QuotaResetTimerVariant;
  /** Pass `useIsFocused()` from screens to pause ticks when offscreen. */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ComicClockIcon({
  size = 18,
  color = colors.ink,
  accent = colors.lime,
}: {
  size?: number;
  color?: string;
  accent?: string;
}) {
  return (
    <Svg accessible={false} width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M9.5 2.5h5M12 2.5v2.3"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={13} r={8.2} fill={accent} stroke={color} strokeWidth={2.1} />
      <Path
        d="M12 8.2v4.8l3.2 2"
        fill="none"
        stroke={color}
        strokeWidth={2.15}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const FlipDigitTile = memo(function FlipDigitTile({
  value,
  unit,
  accent = false,
  accentColor = colors.lime,
  reducedMotion,
}: {
  value: string;
  unit: string;
  accent?: boolean;
  accentColor?: string;
  reducedMotion: boolean;
}) {
  const prevValue = useRef(value);
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (prevValue.current === value) return undefined;
    prevValue.current = value;
    if (reducedMotion) return undefined;
    pop.stopAnimation();
    Animated.sequence([
      Animated.timing(pop, { toValue: 1.055, duration: 70, easing: SILKY_EASE_OUT, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, tension: 320, friction: 20, useNativeDriver: true }),
    ]).start();
    return () => {
      pop.stopAnimation();
    };
  }, [pop, reducedMotion, value]);

  return (
    <View style={styles.heroUnitCol}>
      <Animated.View style={[styles.flipWrap, { transform: [{ scale: pop }] }]}>
        <View pointerEvents="none" style={styles.flipShadow} />
        <View style={[styles.flipFace, accent && { borderColor: accentColor }]}>
          <View pointerEvents="none" style={styles.flipTopHalf} />
          <View pointerEvents="none" style={styles.flipShine} />
          <View pointerEvents="none" style={styles.flipSeam} />
          <View pointerEvents="none" style={[styles.flipNotch, styles.flipNotchLeft]} />
          <View pointerEvents="none" style={[styles.flipNotch, styles.flipNotchRight]} />
          <Text
            maxFontSizeMultiplier={1.15}
            numberOfLines={1}
            style={[styles.flipDigits, accent && { color: accentColor }]}
          >
            {value}
          </Text>
        </View>
      </Animated.View>
      <Text maxFontSizeMultiplier={1.15} style={styles.heroUnitLabel}>
        {unit}
      </Text>
    </View>
  );
});

const CompactDigitTile = memo(function CompactDigitTile({
  value,
  accent = false,
  accentBg = colors.lime,
}: {
  value: string;
  accent?: boolean;
  accentBg?: string;
}) {
  return (
    <View style={[styles.miniTile, accent && { backgroundColor: accentBg }]}>
      <Text
        maxFontSizeMultiplier={1.15}
        numberOfLines={1}
        style={[styles.miniDigits, accent && styles.miniDigitsAccent]}
      >
        {value}
      </Text>
    </View>
  );
});

/**
 * Isolated live reset note rendered inside the top-right Home allowance pill.
 * Keeping the 1s tick inside this leaf ensures `HomeSurface` never re-renders
 * on countdown ticks and preserves the fixed pill geometry.
 */
export function HomeResetPillNote({
  resetAt,
  exhausted,
  active,
  fallbackNote,
}: {
  resetAt: string | null | undefined;
  exhausted: boolean;
  active: boolean;
  fallbackNote: string;
}) {
  const snapshot = useQuotaResetCountdown(resetAt, active);
  const text = snapshot
    ? snapshot.expired
      ? 'SE REÎNCARCĂ'
      : `↻ ${snapshot.compactClock}`
    : fallbackNote;

  return (
    <Text
      maxFontSizeMultiplier={1.25}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.78}
      style={[
        styles.pillNote,
        snapshot && styles.tabularText,
        exhausted && styles.pillNoteExhausted,
      ]}
    >
      {text}
    </Text>
  );
}

/**
 * Comic-styled live countdown showing the exact time until the server resets
 * the daily problem allowance at midnight (`Europe/Bucharest`).
 *
 * - `hero`: Dark indigo 3D split-flap recharge vault for quota-exhausted moments.
 * - `compact`: Crisp standalone comic card for Paywall / Premium overview.
 * - `embedded`: Seamless dashed-divider footer strip for the Account card.
 */
export function QuotaResetTimer({
  resetAt,
  remaining,
  limit,
  premium = false,
  planName = null,
  variant = 'compact',
  active = true,
  style,
}: Props) {
  const reducedMotion = useReducedMotion();
  const snapshot = useQuotaResetCountdown(resetAt, active);
  const pulsePhase = useRef(new Animated.Value(0)).current;
  const isHero = variant === 'hero';
  const isEmbedded = variant === 'embedded';
  const isCanopy = variant === 'canopy';
  const isExhausted = remaining <= 0;
  const heroAccent = premium ? colors.lime : colors.peach;

  const hasLiveCountdown = Boolean(snapshot && !snapshot.expired);

  useEffect(() => {
    if (!active || reducedMotion || !hasLiveCountdown) {
      pulsePhase.stopAnimation();
      pulsePhase.setValue(0);
      return undefined;
    }
    const loop = createNativeLoop(pulsePhase, 1_050);
    loop.start();
    return () => {
      loop.stop();
      pulsePhase.stopAnimation();
    };
  }, [active, hasLiveCountdown, pulsePhase, reducedMotion]);

  const colonStyle = useMemo(() => ({
    opacity: pulsePhase.interpolate({
      inputRange: WAVE_INPUT_17,
      outputRange: cosinePulseRange(1, 0.38),
    }),
  }), [pulsePhase]);

  const liveDotStyle = useMemo(() => ({
    opacity: pulsePhase.interpolate({
      inputRange: WAVE_INPUT_17,
      outputRange: cosinePulseRange(1, 0.66),
    }),
    transform: [
      {
        scale: pulsePhase.interpolate({
          inputRange: WAVE_INPUT_17,
          outputRange: cosinePulseRange(1.08, 0.94),
        }),
      },
    ],
  }), [pulsePhase]);

  if (!snapshot) return null;

  const progressPercent = `${Math.round(snapshot.dayProgress * 100)}%` as `${number}%`;
  const paidPlanLabel = premium ? (planName ?? 'Pro') : 'Start';
  const actionsCountText = formatRoCount(limit, 'acțiune AI', 'acțiuni AI');
  const compactSummary = snapshot.expired
    ? 'Se reîncarcă acțiunile AI…'
    : premium
      ? `Revin ${limit} ${paidPlanLabel} la 00:00`
      : `Revin ${limit} Start la 00:00`;
  const canopyQuotaText = snapshot.expired
    ? 'Se reîncarcă acțiunile AI…'
    : isExhausted
      ? `0 / ${limit} azi · revin la 00:00`
      : `${remaining} / ${limit} acțiuni AI rămase azi`;
  const heroSummary = snapshot.expired
    ? 'Se reîncarcă acțiunile AI…'
    : `Revin ${actionsCountText} ${premium ? `(${paidPlanLabel})` : 'Start'} la 00:00`;
  const accessibleLabel = snapshot.expired
    ? 'Acțiunile AI se reîncarcă acum.'
    : `Acțiunile AI se reîncarcă în ${snapshot.accessibleDuration}. Revin ${actionsCountText} din planul ${paidPlanLabel} la miezul nopții.`;

  if (isCanopy) {
    const canopyAccent = isExhausted ? colors.peach : colors.lime;
    return (
      <View
        accessible
        accessibilityLabel={accessibleLabel}
        style={[styles.canopyStrip, style]}
      >
        <View style={styles.canopyStripRow}>
          <View style={styles.canopyStripCopy}>
            <View style={styles.canopyKickerRow}>
              <Animated.View
                style={[
                  styles.canopyLiveDot,
                  { backgroundColor: canopyAccent },
                  liveDotStyle,
                ]}
              />
              <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.canopyStripKicker}>
                {snapshot.expired ? 'SE REÎNCARCĂ' : `PLAN ${paidPlanLabel.toUpperCase()} · RESET LA 00:00`}
              </Text>
            </View>
            <Text
              maxFontSizeMultiplier={1.15}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              style={styles.canopyStripSummary}
            >
              {canopyQuotaText}
            </Text>
          </View>

          {snapshot.expired ? (
            <View style={styles.compactRefreshing}>
              <PlayfulLoader micro inverse />
            </View>
          ) : (
            <View style={styles.canopyClockRow}>
              <View style={styles.canopyDigitTile}>
                <Text maxFontSizeMultiplier={1.1} numberOfLines={1} style={styles.canopyDigitText}>
                  {snapshot.hoursText}
                </Text>
              </View>
              <Animated.Text style={[styles.canopyColon, colonStyle]}>:</Animated.Text>
              <View style={styles.canopyDigitTile}>
                <Text maxFontSizeMultiplier={1.1} numberOfLines={1} style={styles.canopyDigitText}>
                  {snapshot.minutesText}
                </Text>
              </View>
              <Animated.Text style={[styles.canopyColon, colonStyle]}>:</Animated.Text>
              <View style={[styles.canopyDigitTile, { backgroundColor: canopyAccent, borderColor: canopyAccent }]}>
                <Text maxFontSizeMultiplier={1.1} numberOfLines={1} style={[styles.canopyDigitText, styles.canopyDigitAccent]}>
                  {snapshot.secondsText}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.canopyTrack}>
          <LinearGradient
            colors={isExhausted ? ['#A475FF', colors.peach] : ['#B68CFF', colors.cyan, colors.lime]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.canopyFill, { width: progressPercent }]}
          />
        </View>
      </View>
    );
  }

  if (isHero) {
    return (
      <View
        accessible
        accessibilityLabel={accessibleLabel}
        style={[styles.heroOuter, style]}
      >
        <CachedOutsetShadow borderRadius={radii.xl} shadow={LIQUID_SHADOWS.darkOutset} />
        <View style={[styles.heroCard, !premium && styles.heroCardFree]}>
          <CachedInsetRelief borderRadius={radii.xl} shadow={LIQUID_SHADOWS.darkInset} />
          <View pointerEvents="none" style={styles.heroGlow} />

          <View style={styles.heroHeader}>
            <View style={[styles.heroBadge, { backgroundColor: heroAccent }]}>
              <Animated.View style={[styles.heroBadgeDot, liveDotStyle]} />
              <Text maxFontSizeMultiplier={1.2} style={styles.heroBadgeText}>
                {snapshot.expired ? 'SE REÎNCARCĂ' : 'REÎNCĂRCARE LA 00:00'}
              </Text>
            </View>

            <View style={styles.heroBonusPill}>
              <ComicClockIcon size={14} color={colors.paper} accent="#32246C" />
              <Text maxFontSizeMultiplier={1.2} style={styles.heroBonusText}>
                +{formatRoCount(limit, 'acțiune AI', 'acțiuni AI')}
              </Text>
            </View>
          </View>

          {snapshot.expired ? (
            <View style={styles.heroRefreshingRow}>
              <PlayfulLoader micro inverse />
              <Text style={styles.heroRefreshingText}>E miezul nopții! Reîncarc acțiunile AI…</Text>
            </View>
          ) : (
            <View style={styles.heroClockRow}>
              <FlipDigitTile
                value={snapshot.hoursText}
                unit="ORE"
                reducedMotion={reducedMotion}
              />
              <Animated.View style={[styles.heroColon, colonStyle]}>
                <View style={[styles.colonDot, { backgroundColor: heroAccent }]} />
                <View style={[styles.colonDot, { backgroundColor: heroAccent }]} />
              </Animated.View>
              <FlipDigitTile
                value={snapshot.minutesText}
                unit="MIN"
                reducedMotion={reducedMotion}
              />
              <Animated.View style={[styles.heroColon, colonStyle]}>
                <View style={[styles.colonDot, { backgroundColor: heroAccent }]} />
                <View style={[styles.colonDot, { backgroundColor: heroAccent }]} />
              </Animated.View>
              <FlipDigitTile
                value={snapshot.secondsText}
                unit="SEC"
                accent
                accentColor={heroAccent}
                reducedMotion={reducedMotion}
              />
            </View>
          )}

          <View style={styles.heroProgressTrack}>
            <LinearGradient
              colors={premium ? ['#8E54FF', colors.lime] : ['#8E54FF', '#FF9F68', colors.gold]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.heroProgressFill, { width: progressPercent }]}
            >
              <View pointerEvents="none" style={styles.barShine} />
              <View pointerEvents="none" style={[styles.barTipDot, { backgroundColor: colors.paper }]} />
            </LinearGradient>
          </View>

          <Text maxFontSizeMultiplier={1.25} style={styles.heroFootnote}>
            {snapshot.expired
              ? 'Verificăm noua zi pe server — apare automat.'
              : `${heroSummary} (ora României).`}
          </Text>
        </View>
      </View>
    );
  }

  const compactInner = (
    <View style={isEmbedded ? styles.embeddedWrap : styles.compactInner}>
      {!isEmbedded ? <View pointerEvents="none" style={styles.compactShine} /> : null}
      <View style={styles.compactRow}>
        <View
          style={[
            styles.compactClockBadge,
            isExhausted
              ? styles.compactClockBadgeExhausted
              : premium
                ? styles.compactClockBadgePremium
                : styles.compactClockBadgeDefault,
          ]}
        >
          <ComicClockIcon
            size={20}
            color={colors.ink}
            accent={isExhausted ? colors.peach : premium ? colors.lime : colors.paper}
          />
        </View>

        <View style={styles.compactCopy}>
          <View style={styles.compactKickerRow}>
            <Animated.View
              style={[
                styles.compactLiveDot,
                { backgroundColor: isExhausted ? colors.peach : colors.violet },
                liveDotStyle,
              ]}
            />
            <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.compactKicker}>
              REÎNCĂRCARE ZILNICĂ
            </Text>
          </View>
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.compactNote}>
            {compactSummary}
          </Text>
        </View>

        {snapshot.expired ? (
          <View style={styles.compactRefreshing}>
            <PlayfulLoader micro />
          </View>
        ) : (
          <View style={styles.miniClockRow}>
            <CompactDigitTile value={snapshot.hoursText} />
            <Animated.Text style={[styles.miniColon, colonStyle]}>:</Animated.Text>
            <CompactDigitTile value={snapshot.minutesText} />
            <Animated.Text style={[styles.miniColon, colonStyle]}>:</Animated.Text>
            <CompactDigitTile
              value={snapshot.secondsText}
              accent
              accentBg={isExhausted ? colors.peach : colors.lime}
            />
          </View>
        )}
      </View>

      <View style={styles.compactTrack}>
        <LinearGradient
          colors={isExhausted ? ['#8E54FF', colors.peach] : ['#8E54FF', colors.cyan, colors.lime]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.compactFill, { width: progressPercent }]}
        />
      </View>
    </View>
  );

  if (isEmbedded) {
    return (
      <View accessible accessibilityLabel={accessibleLabel} style={[styles.embeddedHost, style]}>
        <View style={styles.embeddedDivider} />
        {compactInner}
      </View>
    );
  }

  return (
    <View accessible accessibilityLabel={accessibleLabel} style={[styles.compactOuter, style]}>
      <View style={[styles.compactCard, isExhausted && styles.compactCardExhausted]}>
        {compactInner}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabularText: { fontVariant: ['tabular-nums'] },
  pillNote: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 9.5,
    letterSpacing: 0.35,
    lineHeight: 11.5,
    includeFontPadding: false,
  },
  pillNoteExhausted: {
    color: colors.ink,
  },

  // Hero dark indigo split-flap vault
  heroOuter: {
    width: '100%',
    position: 'relative',
  },
  heroCard: {
    borderRadius: radii.xl,
    borderWidth: 1.1,
    borderColor: 'rgba(198, 184, 255, 0.24)',
    backgroundColor: '#1E1547',
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 15,
    overflow: 'hidden',
    position: 'relative',
  },
  heroCardFree: {
    backgroundColor: '#23164B',
  },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 180,
    borderRadius: 110,
    top: -96,
    right: -46,
    backgroundColor: 'rgba(139, 92, 246, 0.26)',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 4.5,
    borderRadius: 999,
  },
  heroBadgeDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 4,
    backgroundColor: colors.ink,
  },
  heroBadgeText: {
    ...typography.kicker,
    fontSize: 9.5,
    lineHeight: 12,
    color: colors.ink,
  },
  heroBonusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(198, 184, 255, 0.28)',
    backgroundColor: 'rgba(12, 8, 34, 0.45)',
  },
  heroBonusText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    color: colors.paper,
  },
  heroClockRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 8,
  },
  heroUnitCol: {
    flex: 1,
    maxWidth: 96,
    alignItems: 'center',
    gap: 5,
  },
  flipWrap: {
    width: '100%',
    position: 'relative',
  },
  flipShadow: {
    position: 'absolute',
    top: 2,
    left: 3,
    right: 3,
    bottom: -1,
    borderRadius: 16,
    backgroundColor: 'rgba(8, 5, 22, 0.35)',
  },
  flipFace: {
    height: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
    backgroundColor: '#2B1F60',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  flipTopHalf: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  flipShine: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  flipSeam: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: 'rgba(10, 6, 28, 0.35)',
  },
  flipNotch: {
    position: 'absolute',
    top: '50%',
    marginTop: -3,
    width: 3,
    height: 6,
    backgroundColor: 'rgba(14, 9, 37, 0.55)',
  },
  flipNotchLeft: { left: 0, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  flipNotchRight: { right: 0, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 },
  flipDigits: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
    color: colors.paper,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  heroUnitLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.1,
    color: '#B9AEE6',
  },
  heroColon: {
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 1,
  },
  colonDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroRefreshingRow: {
    marginTop: 14,
    height: 76,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(201, 255, 59, 0.35)',
    backgroundColor: 'rgba(12, 8, 34, 0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  heroRefreshingText: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    color: colors.paper,
  },
  heroProgressTrack: {
    marginTop: 12,
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: radii.pill,
    justifyContent: 'center',
    position: 'relative',
  },
  barShine: {
    position: 'absolute',
    top: 0,
    left: 4,
    right: 6,
    height: 1.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  barTipDot: {
    position: 'absolute',
    right: 1.5,
    width: 4.5,
    height: 4.5,
    borderRadius: 3,
  },
  heroFootnote: {
    marginTop: 8,
    fontFamily: fonts.bodyMedium,
    fontSize: 11.5,
    lineHeight: 16,
    color: '#CFC7EC',
    textAlign: 'center',
  },

  // Compact standalone card & embedded footer strip
  compactOuter: {
    width: '100%',
    position: 'relative',
  },
  compactCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.11)',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    overflow: 'hidden',
  },
  compactCardExhausted: {
    backgroundColor: '#FFF7F2',
    borderColor: '#FFD3C2',
  },
  compactInner: {
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 11,
    gap: 9,
    position: 'relative',
  },
  compactShine: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  embeddedHost: {
    width: '100%',
  },
  embeddedDivider: {
    height: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderHairline,
    marginBottom: 10,
  },
  embeddedWrap: {
    gap: 8,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactClockBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  compactClockBadgeDefault: { backgroundColor: colors.violetSoft },
  compactClockBadgePremium: { backgroundColor: colors.limeSoft },
  compactClockBadgeExhausted: { backgroundColor: colors.peachSoft },
  compactCopy: {
    flex: 1,
    minWidth: 0,
  },
  compactKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  compactLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  compactKicker: {
    ...typography.kicker,
    fontSize: 9.5,
    lineHeight: 12,
    color: colors.violetDeep,
  },
  compactNote: {
    marginTop: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    lineHeight: 15.5,
    color: colors.ink,
  },
  compactRefreshing: {
    minWidth: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniClockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    flexShrink: 0,
  },
  miniTile: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniDigits: {
    fontFamily: fonts.display,
    fontSize: 13.5,
    lineHeight: 16,
    color: colors.paper,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  miniDigitsAccent: {
    color: colors.ink,
  },
  miniColon: {
    fontFamily: fonts.display,
    fontSize: 13,
    lineHeight: 16,
    color: colors.inkMuted,
    width: 6,
    textAlign: 'center',
  },
  compactTrack: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: '#EDE5FC',
    overflow: 'hidden',
  },
  compactFill: {
    height: '100%',
    borderRadius: radii.pill,
  },

  // Sleek dark-glass live countdown strip integrated inside the Plans canopy
  canopyStrip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(18, 8, 54, 0.42)',
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 8,
    gap: 7,
  },
  canopyStripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  canopyStripCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  canopyKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  canopyLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  canopyStripKicker: {
    ...typography.kicker,
    fontSize: 9,
    lineHeight: 11.5,
    color: 'rgba(236, 228, 255, 0.86)',
  },
  canopyStripSummary: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    lineHeight: 16,
    color: colors.paper,
  },
  canopyClockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    flexShrink: 0,
  },
  canopyDigitTile: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(13, 6, 40, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canopyDigitText: {
    fontFamily: fonts.display,
    fontSize: 14,
    lineHeight: 17,
    color: colors.paper,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  canopyDigitAccent: {
    color: colors.ink,
  },
  canopyColon: {
    fontFamily: fonts.display,
    fontSize: 13.5,
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.72)',
    width: 6,
    textAlign: 'center',
  },
  canopyTrack: {
    height: 4.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    overflow: 'hidden',
  },
  canopyFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
});
