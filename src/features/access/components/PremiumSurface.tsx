import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDelayedBusy } from '../../../shared/hooks/useDelayedBusy';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, radii, typography } from '../../../shared/theme';
import type { CommercialAccess, PaidPlanTier } from '../../../shared/types';
import { Chip } from '../../../shared/ui/Chip';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { IconButton } from '../../../shared/ui/IconButton';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { SpotlightAura } from '../../../shared/ui/SpotlightAura';
import { Text } from '../../../shared/ui/Typography';
import { formatRoCount } from '../../../shared/utils/romanianGrammar';
import { GoogleAccountButton } from '../../account/components/GoogleAccountButton';
import { packagesForTier, type PremiumOffer } from '../services/purchases';
import { QuotaResetTimer } from './QuotaResetTimer';

export type PremiumAction = 'google' | 'purchase' | 'restore' | 'manage' | null;
export type PremiumPlan = 'annual' | 'monthly';

type BenefitBadgeTone = 'lime' | 'gold' | 'violet';

type TierBenefit = {
  badge: string;
  tone: BenefitBadgeTone;
  title: string;
  detail: string;
};

type Props = {
  access: CommercialAccess | null;
  identity: CommercialAccess['identity'] | null;
  accessLoading: boolean;
  configured: boolean;
  canContinue: boolean;
  offer: PremiumOffer | null;
  offerLoading: boolean;
  offerError: string | null;
  selectedTier: PaidPlanTier;
  selected: PremiumPlan;
  busy: PremiumAction;
  error: string | null;
  success: boolean;
  successLimit: number;
  successTier?: PaidPlanTier;
  active?: boolean;
  onClose: () => void;
  onConnect: () => void;
  onBuy: () => void;
  onRestore: () => void;
  onManage: () => void;
  onRefresh: () => void;
  onRetryOffer: () => void;
  onLegal: () => void;
  onSelectTier: (tier: PaidPlanTier) => void;
  onSelect: (plan: PremiumPlan) => void;
};

function PeriodCard({
  period,
  plan,
  selected,
  disabled,
  viewingMax,
  onSelect,
}: {
  period: PremiumPlan;
  plan: PurchasesPackage | null;
  selected: boolean;
  disabled: boolean;
  viewingMax: boolean;
  onSelect: () => void;
}) {
  const annual = period === 'annual';
  const priceText = plan?.product.priceString ?? 'Preț în Play';
  const subNote = annual
    ? plan?.product.pricePerMonthString
      ? `${plan.product.pricePerMonthString} / lună`
      : 'Facturat anual'
    : 'Anulezi oricând';

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${annual ? 'Plan anual' : 'Plan lunar'}. ${plan?.product.priceString ?? 'Preț indisponibil momentan'}`}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={() => {
        Haptics.selection();
        onSelect();
      }}
      style={({ pressed }) => [
        styles.periodCard,
        selected && (viewingMax ? styles.periodCardSelectedMax : styles.periodCardSelected),
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.periodTopRow}>
        <View style={styles.periodTitleWrap}>
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.periodTitle}>
            {annual ? 'Anual' : 'Lunar'}
          </Text>
          <View collapsable={false} style={[styles.saveBadge, !annual && styles.saveBadgeGhost]}>
            <Text maxFontSizeMultiplier={1.1} style={[styles.saveBadgeText, !annual && styles.saveBadgeTextGhost]}>
              {annual ? 'ECONOMISEȘTI' : 'FLEXIBIL'}
            </Text>
          </View>
        </View>
        <View style={[styles.radio, selected && (viewingMax ? styles.radioSelectedMax : styles.radioSelected)]}>
          {selected ? <MiniGlyph name="check" size={12} color={colors.ink} /> : null}
        </View>
      </View>

      <View style={styles.periodPriceRow}>
        <Text
          maxFontSizeMultiplier={1.25}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          style={[styles.periodPrice, !plan && styles.periodPricePending]}
        >
          {priceText}
        </Text>
        {plan ? <Text maxFontSizeMultiplier={1.15} style={styles.periodUnit}>{annual ? '/ an' : '/ lună'}</Text> : null}
      </View>

      <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.periodNote}>
        {subNote}
      </Text>
    </Pressable>
  );
}

/**
 * Single-screen flagship Pro & Max upgrade surface designed to fit cleanly
 * above the fold on standard Android phones with zero visual clutter, clear
 * metric badges (no ambiguous checkmarks), and instant Pro ↔ Max switching.
 */
export const PremiumSurface = memo(function PremiumSurface(props: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, isVeryShort } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const {
    access,
    identity,
    accessLoading,
    configured,
    offer,
    selectedTier,
    selected,
    busy,
    success,
    successLimit,
    successTier = 'pro',
    active = true,
  } = props;
  const activePaidTier: PaidPlanTier | null = access?.premium.active ? (access.premium.tier ?? 'pro') : null;
  const premium = activePaidTier !== null;
  const maxActive = activePaidTier === 'max';
  const proActive = activePaidTier === 'pro';
  const quotaExhausted = Boolean(access && !access.canAnalyze);
  const googleLinked = identity === 'google';
  const busyPrices = useDelayedBusy(props.offerLoading);

  const freeLimit = access?.allowances.freeDaily ?? 5;
  const proLimit = access?.allowances.premiumDaily ?? 50;
  const maxLimit = access?.allowances.maxDaily ?? 150;
  const viewingMax = selectedTier === 'max';
  const showMaxTheme = maxActive || (!proActive && viewingMax);
  const selectedTierLabel = viewingMax ? 'Max' : 'Pro';
  const tierOffer = packagesForTier(offer, selectedTier);
  const hasTierOffer = Boolean(tierOffer.annual || tierOffer.monthly);
  const selectedPackage = tierOffer[selected] ?? null;
  const canBuy = googleLinked && Boolean(access && selectedPackage && configured) && !maxActive && !(proActive && selectedTier === 'pro');
  const waitingForAccess = !access && accessLoading;
  const showPlans = !maxActive && !success && (!proActive || selectedTier === 'max');
  const showTierTabs = !maxActive && !success && !proActive;
  const showUpgradeFromPro = proActive && !success;

  const busyLabel = busy === 'google'
    ? 'Conectez contul Google…'
    : busy === 'purchase'
      ? 'Confirm în Google Play…'
      : busy === 'restore'
        ? 'Caut abonamentul tău…'
        : 'Deschid Google Play…';

  const proMultiplier = Math.max(2, Math.round(proLimit / Math.max(1, freeLimit)));
  const maxOverPro = Math.max(2, Math.round(maxLimit / Math.max(1, proLimit)));
  const maxMultiplier = Math.max(3, Math.round(maxLimit / Math.max(1, freeLimit)));
  const proCountLabel = formatRoCount(proLimit, 'acțiune AI', 'acțiuni AI');
  const maxCountLabel = formatRoCount(maxLimit, 'acțiune AI', 'acțiuni AI');
  const successCountLabel = formatRoCount(successLimit, 'acțiune AI', 'acțiuni AI');

  const tierBenefits: readonly TierBenefit[] = viewingMax
    ? [
      {
        badge: `${maxMultiplier}×`,
        tone: 'gold',
        title: `${maxCountLabel} zilnic`,
        detail: `De ${maxOverPro}× mai mult decât Pro — ritm intens pentru EN & BAC.`,
      },
      {
        badge: '✦',
        tone: 'lime',
        title: 'Raționament matematic extins',
        detail: 'Analiză mai profundă pe demonstrații lungi, probleme grele și barem.',
      },
      {
        badge: 'AI',
        tone: 'violet',
        title: 'Pentru toate funcțiile AI',
        detail: 'Poză, editor, verificare teme, exerciții AI și barem EN/BAC · reset la 00:00.',
      },
    ]
    : [
      {
        badge: `${proMultiplier}×`,
        tone: 'lime',
        title: `${proCountLabel} zilnic`,
        detail: `Față de ${freeLimit}/zi gratuit · reîncărcare automată la 00:00.`,
      },
      {
        badge: 'AI',
        tone: 'violet',
        title: 'Pentru toate funcțiile AI',
        detail: 'Poză pas cu pas, editor, verificare teme, exerciții AI și barem EN/BAC.',
      },
    ];

  const statusText = !configured
    ? 'Abonamentele nu sunt disponibile momentan. Varianta gratuită rămâne disponibilă.'
    : props.offerError
      ? props.offerError
      : busyPrices
        ? 'Actualizez prețurile din Google Play…'
        : !googleLinked
          ? 'Conectează contul Google ca să vezi prețurile din Google Play.'
          : offer && !hasTierOffer
            ? `Planul Profu’ ${selectedTierLabel} nu este publicat încă în Google Play.`
            : null;

  const showRestoreLink = googleLinked && configured && !success && !(proActive && canBuy);
  const showManageProLink = proActive && canBuy && !success;

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      <ComicBackdrop />

      {/* Sleek compact Royal-Violet / Midnight-Max canopy */}
      <View style={[styles.canopy, { paddingTop: insets.top ?? 0 }]}>
        <LinearGradient
          colors={showMaxTheme ? ['#5D1EEB', '#3B11AD', '#22096E'] : ['#8A3DFF', '#5F1EE8', '#3B10AD']}
          start={{ x: 0.06, y: 0 }}
          end={{ x: 0.94, y: 1 }}
          style={styles.fill}
        />
        <View pointerEvents="none" style={styles.canopyGlowCyan} />
        <View pointerEvents="none" style={styles.canopyGlowLime} />
        <View pointerEvents="none" style={styles.canopyOrbitArc} />

        <View style={[styles.header, { paddingHorizontal: gutter }]}>
          <View style={styles.brandRow}>
            <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.brand}>Profu’ de mate</Text>
            <View style={[styles.brandBadge, showMaxTheme && styles.brandBadgeMax]}>
              <Text maxFontSizeMultiplier={1.1} style={[styles.brandBadgeText, showMaxTheme && styles.brandBadgeTextMax]}>
                {maxActive ? 'MAX ACTIV' : proActive ? 'PRO ACTIV' : viewingMax ? 'PROFU’ MAX' : 'PROFU’ PRO'}
              </Text>
            </View>
          </View>
          <IconButton
            label="Închide abonamentele"
            disabled={Boolean(busy)}
            dimWhenDisabled={false}
            onPress={props.onClose}
            size={38}
            style={styles.closeBtn}
          >
            <MiniGlyph name="close" size={16} color={colors.violetDeep} />
          </IconButton>
        </View>

        <View style={[styles.hero, isVeryShort && styles.heroCompact, { paddingHorizontal: gutter }]}>
          <View style={styles.heroCopy}>
            <Text maxFontSizeMultiplier={1.25} style={styles.heroTitle}>
              {success
                ? 'Gata. Hai la treabă!'
                : maxActive
                  ? 'Profu’ Max este activ.'
                  : proActive
                    ? 'Profu’ Pro este activ.'
                    : viewingMax
                      ? 'Putere maximă la examene.'
                      : 'Învață în ritmul tău.'}
            </Text>
            <Text maxFontSizeMultiplier={1.2} style={styles.heroNote}>
              {success
                ? `Ai până la ${successCountLabel} pe zi.`
                : premium && access
                  ? `Până la ${formatRoCount(access.limit, 'acțiune AI', 'acțiuni AI')} pe zi, explicate pas cu pas.`
                  : viewingMax
                    ? `${maxCountLabel} pe zi și raționament matematic extins.`
                    : `${proCountLabel} pe zi — de ${proMultiplier}× mai mult decât gratuit.`}
            </Text>
          </View>
          <View pointerEvents="none" style={styles.art}>
            <SpotlightAura size={68} tone="onViolet" active={active} />
            <Mascot pose={success || premium || showMaxTheme ? 'cheer' : 'wave'} size={64} active={active} />
          </View>
        </View>
      </View>

      <ScrollView
        scrollEnabled={!busy}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}
      >
        <View collapsable={false} pointerEvents={busy ? 'none' : 'auto'} style={styles.bodyStack}>
          {success ? (
            <View style={styles.activeSection}>
              <View style={styles.activeMark}><MiniGlyph name="check" size={28} color={colors.ink} /></View>
              <Text style={styles.sectionTitle}>
                {successTier === 'max' ? 'Profu’ Max este activ.' : 'Profu’ Pro este activ.'}
              </Text>
              <Text style={styles.body}>Abonamentul este legat de contul tău Google. Revino la matematică când ești pregătit.</Text>
            </View>
          ) : premium && access ? (
            <View style={styles.activeSection}>
              <Chip label={maxActive ? 'SPAȚIUL TĂU MAX DE AZI' : 'SPAȚIUL TĂU PRO DE AZI'} tone="violetSoft" outlined={false} />
              <Text style={styles.quota}>{access.remaining}<Text style={styles.quotaTotal}> / {access.limit}</Text></Text>
              <Text style={styles.activeQuotaLabel}>acțiuni AI disponibile</Text>
              {access.resetAt ? (
                <QuotaResetTimer
                  resetAt={access.resetAt}
                  remaining={access.remaining}
                  limit={access.limit}
                  premium
                  planName={maxActive ? 'Max' : 'Pro'}
                  variant={quotaExhausted ? 'hero' : 'compact'}
                  active={active}
                  style={styles.activeTimer}
                />
              ) : null}
              <Text style={styles.body}>Abonamentul se administrează din Google Play.</Text>
            </View>
          ) : null}

          {!success && !premium && access?.resetAt ? (
            <QuotaResetTimer
              resetAt={access.resetAt}
              remaining={access.remaining}
              limit={access.limit}
              premium={false}
              variant="compact"
              active={active}
            />
          ) : null}

          {props.canContinue && !success ? (
            <View style={styles.continueRow}>
              <View style={styles.continueCopy}>
                <Text style={styles.continueTitle}>Ai acțiuni AI disponibile.</Text>
                <Text style={styles.bodySmall}>Poți reveni la problema ta.</Text>
              </View>
              <Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={props.onClose} style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}>
                <Text style={styles.continueLabel}>Continuă</Text>
              </Pressable>
            </View>
          ) : null}

          {showTierTabs ? (
            <View accessibilityRole="tablist" accessibilityLabel="Alege planul" style={styles.tierTrack}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: selectedTier === 'pro' }}
                disabled={Boolean(busy)}
                onPress={() => {
                  Haptics.selection();
                  props.onSelectTier('pro');
                }}
                style={({ pressed }) => [
                  styles.tierTab,
                  selectedTier === 'pro' && styles.tierTabActivePro,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.tierTabTop}>
                  <Text maxFontSizeMultiplier={1.15} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.tierTabName, selectedTier === 'pro' && styles.tierTabNameActive]}>
                    Profu’ Pro
                  </Text>
                  <View style={[styles.tierTag, selectedTier === 'pro' && styles.tierTagPro]}>
                    <Text maxFontSizeMultiplier={1.05} style={[styles.tierTagText, selectedTier === 'pro' && styles.tierTagTextActive]}>
                      POPULAR
                    </Text>
                  </View>
                </View>
                <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={[styles.tierTabMeta, selectedTier === 'pro' && styles.tierTabMetaActive]}>
                  {proLimit} / zi · standard
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: selectedTier === 'max' }}
                disabled={Boolean(busy)}
                onPress={() => {
                  Haptics.selection();
                  props.onSelectTier('max');
                }}
                style={({ pressed }) => [
                  styles.tierTab,
                  selectedTier === 'max' && styles.tierTabActiveMax,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.tierTabTop}>
                  <Text maxFontSizeMultiplier={1.15} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.tierTabName, selectedTier === 'max' && styles.tierTabNameActive]}>
                    Profu’ Max
                  </Text>
                  <View style={[styles.tierTag, selectedTier === 'max' && styles.tierTagMax]}>
                    <Text maxFontSizeMultiplier={1.05} style={[styles.tierTagText, selectedTier === 'max' && styles.tierTagTextActive]}>
                      EXTINS
                    </Text>
                  </View>
                </View>
                <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={[styles.tierTabMeta, selectedTier === 'max' && styles.tierTabMetaActive]}>
                  {maxLimit} / zi · extins
                </Text>
              </Pressable>
            </View>
          ) : null}

          {showUpgradeFromPro ? (
            <View style={styles.upgradeBanner}>
              <View style={styles.upgradeBannerTop}>
                <Chip label="TRECI LA PROFU’ MAX" tone="lime" outlined={false} />
                <Text style={styles.upgradeQuotaTag}>{maxLimit} / zi</Text>
              </View>
              <Text style={styles.upgradeTitle}>Vrei de {maxOverPro}× mai mult + raționament extins?</Text>
              <Text style={styles.bodySmall}>
                Google Play înlocuiește automat Pro și creditează zilele rămase către Max.
              </Text>
            </View>
          ) : null}

          {!success && !maxActive ? (
            <View style={[styles.benefitsCard, viewingMax && styles.benefitsCardMax]}>
              <View style={styles.benefitsHeader}>
                <Text maxFontSizeMultiplier={1.2} style={styles.benefitsHeading}>
                  Inclus în Profu’ {selectedTierLabel}
                </Text>
                <Text maxFontSizeMultiplier={1.15} style={styles.freeCompareTag}>
                  vs. {freeLimit}/zi gratuit
                </Text>
              </View>
              <View style={styles.benefitsList}>
                {tierBenefits.map((item) => (
                  <View key={item.title} style={styles.benefitRow}>
                    <View
                      style={[
                        styles.benefitBadge,
                        item.tone === 'lime'
                          ? styles.benefitBadgeLime
                          : item.tone === 'gold'
                            ? styles.benefitBadgeGold
                            : styles.benefitBadgeViolet,
                      ]}
                    >
                      <Text
                        maxFontSizeMultiplier={1.1}
                        style={[
                          styles.benefitBadgeText,
                          item.tone === 'violet' && styles.benefitBadgeTextViolet,
                        ]}
                      >
                        {item.badge}
                      </Text>
                    </View>
                    <View style={styles.benefitCopy}>
                      <Text maxFontSizeMultiplier={1.25} style={styles.benefitTitle}>{item.title}</Text>
                      <Text maxFontSizeMultiplier={1.25} style={styles.benefitDetail}>{item.detail}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {showPlans ? (
            <View style={styles.plansSection}>
              <View accessibilityRole="radiogroup" accessibilityLabel={`Planuri Profu’ ${selectedTierLabel}`} style={styles.periodRow}>
                {(!hasTierOffer || tierOffer.annual) ? (
                  <PeriodCard
                    period="annual"
                    plan={tierOffer.annual}
                    selected={selected === 'annual'}
                    disabled={Boolean(busy)}
                    viewingMax={viewingMax}
                    onSelect={() => props.onSelect('annual')}
                  />
                ) : null}
                {(!hasTierOffer || tierOffer.monthly) ? (
                  <PeriodCard
                    period="monthly"
                    plan={tierOffer.monthly}
                    selected={selected === 'monthly'}
                    disabled={Boolean(busy)}
                    viewingMax={viewingMax}
                    onSelect={() => props.onSelect('monthly')}
                  />
                ) : null}
              </View>

              {statusText ? (
                <View style={styles.offerStatus} accessibilityLiveRegion="polite">
                  <View style={styles.noticePill}>
                    <Text style={styles.noticeText}>{statusText}</Text>
                    {props.offerError ? (
                      <Pressable accessibilityRole="button" onPress={props.onRetryOffer} disabled={Boolean(busy)} style={styles.inlineRetry}>
                        <Text style={styles.link}>Reîncearcă</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {!access && !success ? (
            <View style={styles.accountStatus}>
              <Text style={styles.bodySmall}>
                {waitingForAccess
                  ? 'Contul se actualizează în fundal. Poți explora planurile între timp.'
                  : 'Limita de azi nu a putut fi verificată. Poți continua să explorezi aplicația.'}
              </Text>
              {!waitingForAccess ? (
                <Pressable accessibilityRole="button" onPress={props.onRefresh} disabled={Boolean(busy)} style={styles.inlineRetry}>
                  <Text style={styles.link}>Reîncearcă verificarea</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {props.error ? <Text accessibilityRole="alert" style={styles.error}>{props.error}</Text> : null}

          {!maxActive && !success ? (
            <Text style={styles.legalCompact}>
              Reînnoire automată prin Google Play · Anulezi oricând din cont.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 10) }]}>
        {success ? (
          <ComicButton title="Înapoi la matematică" icon="scan" onPress={props.onClose} compact />
        ) : maxActive ? (
          <ComicButton title={busy === 'manage' ? 'Deschid Google Play…' : 'Administrează abonamentul'} icon="settings" disabled={Boolean(busy)} onPress={props.onManage} compact />
        ) : proActive && (!configured || (!selectedPackage && !props.offerLoading)) ? (
          <ComicButton title={busy === 'manage' ? 'Deschid Google Play…' : 'Administrează abonamentul'} icon="settings" disabled={Boolean(busy)} onPress={props.onManage} compact />
        ) : identity === 'anonymous' ? (
          <GoogleAccountButton busy={busy === 'google'} disabled={Boolean(busy) && busy !== 'google'} note="Un cont pentru Caiet și abonament" onPress={props.onConnect} />
        ) : (
          <ComicButton
            title={
              busy === 'purchase'
                ? 'Confirm în Google Play…'
                : canBuy && selectedPackage
                  ? `Alege ${selectedTierLabel} · ${selectedPackage.product.priceString}`
                  : !configured
                    ? 'Abonamente indisponibile'
                    : props.offerLoading
                      ? 'Încarc prețurile…'
                      : waitingForAccess
                        ? 'Actualizarea contului continuă…'
                        : `Alege ${selectedTierLabel}`
            }
            icon="trophy"
            tone={!configured ? 'paper' : 'lime'}
            disabled={Boolean(busy) || !canBuy}
            onPress={props.onBuy}
            compact
          />
        )}

        <View style={styles.footerLinksRow}>
          {showManageProLink ? (
            <>
              <Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={props.onManage} style={styles.footerLinkBtn}>
                <Text style={styles.footerLinkText}>{busy === 'manage' ? 'Deschid Google Play…' : 'Administrează Pro'}</Text>
              </Pressable>
              <Text accessible={false} style={styles.footerDot}>•</Text>
            </>
          ) : showRestoreLink ? (
            <>
              <Pressable accessibilityRole="button" disabled={Boolean(busy) || !access} onPress={props.onRestore} style={styles.footerLinkBtn}>
                <Text style={styles.footerLinkText}>{busy === 'restore' ? 'Caut achiziția…' : 'Restaurează achizițiile'}</Text>
              </Pressable>
              <Text accessible={false} style={styles.footerDot}>•</Text>
            </>
          ) : null}
          <Pressable accessibilityRole="link" disabled={Boolean(busy)} onPress={props.onLegal} style={styles.footerLinkBtn}>
            <Text style={styles.footerLinkText}>Termeni și confidențialitate</Text>
          </Pressable>
        </View>
      </View>

      {busy ? (
        <View pointerEvents="auto" style={styles.lockOverlay}>
          <View
            accessibilityLiveRegion="polite"
            style={[styles.busyDock, { bottom: Math.max(insets.bottom, 14) + 14 }]}
          >
            <View style={styles.busyPill}>
              <PlayfulLoader micro inverse />
              <Text style={styles.busyPillText}>{busyLabel}</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  scroll: { flex: 1 },
  lockOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 40 },
  busyDock: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 45,
  },
  busyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(216, 255, 62, 0.35)',
    backgroundColor: colors.ink,
    elevation: 6,
  },
  busyPillText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 13.5, lineHeight: 18 },

  canopy: {
    width: '100%',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: 'hidden',
    paddingBottom: 14,
    position: 'relative',
    zIndex: 4,
  },
  canopyGlowCyan: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -95,
    left: -55,
    backgroundColor: 'rgba(67, 214, 230, 0.2)',
  },
  canopyGlowLime: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: -90,
    right: 10,
    backgroundColor: 'rgba(216, 255, 62, 0.16)',
  },
  canopyOrbitArc: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.11)',
    top: -120,
    right: -80,
  },
  header: {
    minHeight: 44,
    paddingTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  brandRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  brand: { fontFamily: fonts.display, fontSize: 17.5, color: colors.paper },
  brandBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(216, 255, 62, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(216, 255, 62, 0.55)',
  },
  brandBadgeMax: {
    backgroundColor: 'rgba(255, 212, 71, 0.22)',
    borderColor: 'rgba(255, 212, 71, 0.65)',
  },
  brandBadgeText: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 0.7, color: colors.lime, includeFontPadding: false },
  brandBadgeTextMax: { color: colors.gold },
  closeBtn: {
    borderRadius: 19,
    borderBottomWidth: 3,
    borderBottomColor: '#C5B8FA',
    backgroundColor: '#FFFFFF',
  },

  hero: {
    paddingTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroCompact: { paddingTop: 0 },
  heroCopy: { flex: 1, minWidth: 0, zIndex: 1 },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 26,
    color: colors.paper,
    textShadowColor: 'rgba(18, 6, 62, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heroNote: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.2,
    lineHeight: 16.5,
    color: 'rgba(244, 238, 255, 0.92)',
    marginTop: 3,
  },
  art: { width: 70, height: 70, justifyContent: 'center', alignItems: 'center', position: 'relative' },

  content: { paddingTop: 8, paddingBottom: 8 },
  bodyStack: { gap: 8 },

  // Unified segmented Pro / Max switcher
  tierTrack: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 22,
    backgroundColor: '#ECE4FF',
    borderWidth: 1,
    borderColor: '#DDD2FA',
  },
  tierTab: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tierTabActivePro: {
    backgroundColor: colors.violet,
    borderColor: '#8B52FF',
    borderBottomWidth: 3,
    borderBottomColor: '#4514BE',
  },
  tierTabActiveMax: {
    backgroundColor: '#2E0F96',
    borderColor: '#6D3DFF',
    borderBottomWidth: 3,
    borderBottomColor: '#1B075D',
  },
  tierTabTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  tierTabName: {
    fontFamily: fonts.display,
    fontSize: 15.5,
    lineHeight: 19,
    color: colors.ink,
    flexShrink: 1,
  },
  tierTabNameActive: { color: colors.paper },
  tierTag: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
  },
  tierTagPro: { backgroundColor: colors.lime },
  tierTagMax: { backgroundColor: colors.gold },
  tierTagText: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 0.45,
    color: colors.violetDeep,
    includeFontPadding: false,
  },
  tierTagTextActive: { color: colors.ink },
  tierTabMeta: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    lineHeight: 15,
    color: colors.inkSoft,
  },
  tierTabMetaActive: { color: 'rgba(244, 238, 255, 0.92)' },

  upgradeBanner: {
    borderRadius: 20,
    borderWidth: 1.4,
    borderBottomWidth: 3,
    borderColor: '#DDF68E',
    borderBottomColor: '#B1D63D',
    backgroundColor: '#F5FFD2',
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 4,
  },
  upgradeBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  upgradeQuotaTag: { fontFamily: fonts.display, fontSize: 14.5, color: colors.violetDeep },
  upgradeTitle: { fontFamily: fonts.displaySemi, fontSize: 15.5, lineHeight: 19.5, color: colors.ink },

  // Clean benefit card with meaningful metric/icon badges (no ambiguous checks)
  benefitsCard: {
    borderRadius: 22,
    borderWidth: 1.3,
    borderBottomWidth: 3,
    borderColor: '#E8E0FC',
    borderBottomColor: '#D4C7F7',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 12,
    gap: 9,
  },
  benefitsCardMax: {
    borderColor: '#D8C8FF',
    borderBottomColor: '#B99CF7',
  },
  benefitsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  benefitsHeading: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    lineHeight: 19,
    color: colors.ink,
  },
  freeCompareTag: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: colors.violetDeep,
    backgroundColor: colors.violetSoft,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radii.pill,
  },
  benefitsList: { gap: 8 },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitBadge: {
    width: 36,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  benefitBadgeLime: {
    backgroundColor: colors.lime,
  },
  benefitBadgeGold: {
    backgroundColor: colors.gold,
  },
  benefitBadgeViolet: {
    backgroundColor: colors.violetSoft,
  },
  benefitBadgeText: {
    fontFamily: fonts.display,
    fontSize: 12.5,
    lineHeight: 15,
    color: colors.ink,
    includeFontPadding: false,
  },
  benefitBadgeTextViolet: {
    color: colors.violetDeep,
  },
  benefitCopy: { flex: 1, minWidth: 0, gap: 1 },
  benefitTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.2,
    lineHeight: 17,
    color: colors.ink,
  },
  benefitDetail: {
    fontFamily: fonts.body,
    fontSize: 11.6,
    lineHeight: 15.5,
    color: colors.inkSoft,
  },

  // Side-by-side Annual & Monthly period selector
  plansSection: { gap: 8 },
  periodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  periodCard: {
    flex: 1,
    minHeight: 96,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 20,
    borderWidth: 1.4,
    borderBottomWidth: 3.2,
    borderColor: '#E5DCFF',
    borderBottomColor: '#D0C2F7',
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
    gap: 5,
  },
  periodCardSelected: {
    backgroundColor: '#F5EEFF',
    borderWidth: 1.75,
    borderBottomWidth: 3.8,
    borderColor: colors.violet,
    borderBottomColor: '#4E16CE',
  },
  periodCardSelectedMax: {
    backgroundColor: '#F2ECFF',
    borderWidth: 1.75,
    borderBottomWidth: 3.8,
    borderColor: '#3B11AD',
    borderBottomColor: '#22096E',
  },
  periodTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  periodTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  periodTitle: {
    fontFamily: fonts.display,
    fontSize: 16.5,
    lineHeight: 20,
    color: colors.ink,
  },
  saveBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6.5,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.gold,
  },
  saveBadgeGhost: {
    backgroundColor: colors.violetSoft,
  },
  saveBadgeText: {
    ...typography.kicker,
    fontSize: 8,
    lineHeight: 10.5,
    color: colors.ink,
    includeFontPadding: false,
  },
  saveBadgeTextGhost: {
    color: colors.violetDeep,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  radioSelected: { backgroundColor: colors.lime, borderColor: 'rgba(86, 120, 0, 0.35)' },
  radioSelectedMax: { backgroundColor: colors.gold, borderColor: 'rgba(138, 86, 0, 0.35)' },
  periodPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    marginTop: 2,
  },
  periodPrice: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 22,
    color: colors.ink,
    flexShrink: 1,
  },
  periodPricePending: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
    color: colors.violetDeep,
  },
  periodUnit: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.inkSoft,
  },
  periodNote: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.inkSoft,
  },

  offerStatus: {},
  noticePill: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.12)',
    backgroundColor: colors.paperTint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  noticeText: { flex: 1, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 11.8, lineHeight: 16 },
  inlineRetry: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 4 },
  link: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 12.5 },

  accountStatus: {
    borderRadius: 14,
    backgroundColor: colors.paperTint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  body: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 18.5, textAlign: 'center' },
  bodySmall: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12, lineHeight: 16.5 },
  legalCompact: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    paddingHorizontal: 4,
  },

  footer: {
    paddingTop: 9,
    backgroundColor: colors.canvas,
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 60, 255, 0.08)',
  },
  footerLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  footerLinkBtn: {
    minHeight: 34,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLinkText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 12,
  },
  footerDot: {
    color: colors.inkSoft,
    fontSize: 12,
  },

  activeSection: { alignItems: 'center', gap: 8, paddingVertical: 14 },
  activeMark: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, color: colors.ink },
  activeQuotaLabel: { fontFamily: fonts.displaySemi, fontSize: 16, lineHeight: 20, color: colors.ink },
  activeTimer: { width: '100%', marginTop: 4 },
  quota: { fontFamily: fonts.display, fontSize: 48, lineHeight: 54, color: colors.violetDeep },
  quotaTotal: { fontSize: 24, color: colors.inkSoft },

  continueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(86, 120, 0, 0.2)',
    backgroundColor: '#F3FFE0',
  },
  continueCopy: { flex: 1 },
  continueTitle: { fontFamily: fonts.displaySemi, fontSize: 14.5, color: colors.ink },
  continueButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueLabel: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.ink },
  error: { fontFamily: fonts.bodyBold, fontSize: 12.2, lineHeight: 17, color: '#A92D46', textAlign: 'center' },
  pressed: { opacity: 0.94, transform: [{ scale: 0.985 }] },
});
