import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { borders, colors, fonts, radii, shadows, springs, typography } from '../../../shared/theme';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { Text } from '../../../shared/ui/Typography';
import { useQuotaResetCountdown } from '../hooks/useQuotaResetCountdown';

export type QuotaResetTimerVariant = 'hero' | 'compact' | 'embedded';

type Props = {
  resetAt: string | null | undefined;
  remaining: number;
  limit: number;
  premium?: boolean;
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
  const pop = useSharedValue(1);

  useEffect(() => {
    if (prevValue.current === value) return;
    prevValue.current = value;
    if (reducedMotion) return;
    pop.set(withSequence(
      withTiming(1.055, { duration: 70, easing: Easing.out(Easing.quad) }),
      withSpring(1, springs.snappy),
    ));
  }, [pop, reducedMotion, value]);

  const tileAnimated = useAnimatedStyle(() => ({
    transform: [{ scale: pop.get() }],
  }));

  return (
    <View style={styles.heroUnitCol}>
      <Animated.View style={[styles.flipWrap, tileAnimated]}>
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
      ? 'REÎNCARC…'
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
  variant = 'compact',
  active = true,
  style,
}: Props) {
  const reducedMotion = useReducedMotion();
  const snapshot = useQuotaResetCountdown(resetAt, active);
  const pulse = useSharedValue(1);
  const isHero = variant === 'hero';
  const isEmbedded = variant === 'embedded';
  const isExhausted = remaining <= 0;
  const heroAccent = premium ? colors.lime : colors.peach;

  const hasLiveCountdown = Boolean(snapshot && !snapshot.expired);

  useEffect(() => {
    if (!active || reducedMotion || !hasLiveCountdown) {
      cancelAnimation(pulse);
      pulse.set(1);
      return;
    }
    pulse.set(withRepeat(
      withSequence(
        withTiming(0.38, { duration: 500, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 500, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    ));
    return () => cancelAnimation(pulse);
  }, [active, hasLiveCountdown, pulse, reducedMotion]);

  const colonStyle = useAnimatedStyle(() => ({
    opacity: pulse.get(),
  }));

  const liveDotStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + pulse.get() * 0.55,
    transform: [{ scale: 0.86 + pulse.get() * 0.22 }],
  }));

  if (!snapshot) return null;

  const progressPercent = `${Math.round(snapshot.dayProgress * 100)}%` as `${number}%`;
  const rechargeSummary = snapshot.expired
    ? 'Se actualizează problemele tale…'
    : `Revin ${limit} probleme ${premium ? 'Premium' : 'gratuite'} la 00:00`;
  const accessibleLabel = snapshot.expired
    ? 'Problemele se reîncarcă acum.'
    : `Problemele se reîncarcă în ${snapshot.accessibleDuration}. Revin ${limit} probleme ${premium ? 'Premium' : 'gratuite'} la miezul nopții.`;

  if (isHero) {
    return (
      <View
        accessible
        accessibilityLabel={accessibleLabel}
        style={[styles.heroOuter, style]}
      >
        <View pointerEvents="none" style={styles.heroShadow} />
        <View style={[styles.heroCard, !premium && styles.heroCardFree]}>
          <View pointerEvents="none" style={styles.heroGlow} />
          <View pointerEvents="none" style={styles.heroShine} />

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
                +{limit} {limit === 1 ? 'problemă' : 'probleme'}
              </Text>
            </View>
          </View>

          {snapshot.expired ? (
            <View style={styles.heroRefreshingRow}>
              <PlayfulLoader micro inverse />
              <Text style={styles.heroRefreshingText}>E miezul nopții! Actualizez problemele…</Text>
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
              : `${rechargeSummary} (ora României).`}
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
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.84} style={styles.compactNote}>
            {rechargeSummary}
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
      <View pointerEvents="none" style={styles.compactShadow} />
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
    paddingBottom: shadows.md,
  },
  heroShadow: {
    position: 'absolute',
    top: shadows.md,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.xl,
    backgroundColor: '#09061B',
  },
  heroCard: {
    borderRadius: radii.xl - 1,
    borderWidth: borders.thick,
    borderColor: colors.ink,
    backgroundColor: '#1E1547',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    overflow: 'hidden',
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
    backgroundColor: 'rgba(139, 92, 246, 0.28)',
  },
  heroShine: {
    position: 'absolute',
    top: 4,
    left: 18,
    right: 18,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.shineSoft,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    transform: [{ rotate: '-1.5deg' }],
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
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(198, 184, 255, 0.35)',
    backgroundColor: 'rgba(12, 8, 34, 0.58)',
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
    paddingBottom: 4,
  },
  flipShadow: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    backgroundColor: '#0A061C',
  },
  flipFace: {
    height: 58,
    borderRadius: 15,
    borderWidth: borders.regular,
    borderColor: '#6F5AC8',
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  flipShine: {
    position: 'absolute',
    top: 3,
    left: 10,
    right: 10,
    height: 3.5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  flipSeam: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1.25,
    backgroundColor: 'rgba(10, 6, 28, 0.65)',
  },
  flipNotch: {
    position: 'absolute',
    top: '50%',
    marginTop: -3.5,
    width: 4,
    height: 7,
    backgroundColor: '#0E0925',
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
    borderWidth: 1.5,
    borderColor: 'rgba(201, 255, 59, 0.45)',
    backgroundColor: 'rgba(12, 8, 34, 0.55)',
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
    height: 9,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: '#0B0720',
    backgroundColor: '#120C30',
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
    top: 1,
    left: 4,
    right: 6,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  barTipDot: {
    position: 'absolute',
    right: 2,
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
    paddingBottom: shadows.sm,
  },
  compactShadow: {
    position: 'absolute',
    top: shadows.sm,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 19,
    backgroundColor: colors.ink,
  },
  compactCard: {
    borderRadius: 18,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    overflow: 'hidden',
  },
  compactCardExhausted: {
    backgroundColor: '#FFF5E8',
  },
  compactInner: {
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 10,
    gap: 9,
    position: 'relative',
  },
  compactShine: {
    position: 'absolute',
    top: 3,
    left: 12,
    right: 12,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.shine,
  },
  embeddedHost: {
    width: '100%',
  },
  embeddedDivider: {
    height: 1.5,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    marginBottom: 10,
  },
  embeddedWrap: {
    gap: 8,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  compactClockBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
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
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.ink,
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
    color: colors.ink,
    width: 6,
    textAlign: 'center',
  },
  compactTrack: {
    height: 6,
    borderRadius: radii.pill,
    borderWidth: 1.25,
    borderColor: colors.ink,
    backgroundColor: colors.canvasDeep,
    overflow: 'hidden',
  },
  compactFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
});
