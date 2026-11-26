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
import { GoogleAccountButton } from '../../account/components/GoogleAccountButton';
import { packagesForTier, type PremiumOffer } from '../services/purchases';
import { QuotaResetTimer } from './QuotaResetTimer';

export type PremiumAction = 'google' | 'purchase' | 'restore' | 'manage' | null;
export type PremiumPlan = 'annual' | 'monthly';

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

function PlanOption({ period, plan, selected, disabled, onSelect }: {
  period: PremiumPlan;
  plan: PurchasesPackage | null;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const annual = period === 'annual';

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
      style={({ pressed }) => [styles.plan, selected && styles.planSelected, pressed && styles.pressed]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <MiniGlyph name="check" size={14} color={colors.ink} /> : null}
      </View>
      <View style={styles.planCopy}>
        <View style={styles.planTitleRow}>
          <Text style={styles.planTitle}>{annual ? 'Anual' : 'Lunar'}</Text>
          {annual ? <View collapsable={false} style={styles.bestBadge}><Text style={styles.bestBadgeText}>RECOMANDAT</Text></View> : null}
        </View>
        <Text style={styles.planNote}>
          {annual
            ? plan?.product.pricePerMonthString ? `${plan.product.pricePerMonthString} / lună, facturat anual` : 'Un an întreg de practică'
            : 'Se reînnoiește lunar'}
        </Text>
      </View>
      <View style={styles.priceCopy}>
        <Text style={[styles.price, !plan && styles.pricePending]}>
          {plan?.product.priceString ?? 'Preț în Google Play'}
        </Text>
        {plan ? <Text style={styles.planPeriod}>{annual ? '/ an' : '/ lună'}</Text> : null}
      </View>
    </Pressable>
  );
}

/**
 * Flagship Pro & Max upgrade surface with LaunchSplash studio spotlight hero,
 * pure native UI (zero Reanimated worklet mount cost), and instant modal open.
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
  const selectedTierLabel = viewingMax ? 'Max' : 'Pro';
  const selectedTierLimit = viewingMax ? maxLimit : proLimit;
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
      ? 'Confirmăm în Google Play…'
      : busy === 'restore'
        ? 'Caut abonamentul tău…'
        : 'Deschid Google Play…';

  const tierBenefits = viewingMax
    ? [
      {
        title: `${maxLimit} acțiuni AI pe zi`,
        detail: `Față de ${freeLimit}/zi gratuit — ideal pentru pregătire intensivă EN, BAC și meditații.`,
        highlight: true,
      },
      {
        title: 'Raționament matematic extins',
        detail: 'Analiză mai profundă pe demonstrații, probleme grele de BAC și corectări pe barem.',
        highlight: true,
      },
      {
        title: 'Foto, editor, exerciții AI & barem EN/BAC',
        detail: 'Rezolvări pas cu pas, verificare teme, exerciții adaptive și punctaj oficial pe etape.',
        highlight: false,
      },
      {
        title: 'Fără reclame · Caiet sincronizat în cloud',
        detail: 'Toate cele 58 fișe offline, 92 exerciții și 12 simulări rămân incluse.',
        highlight: false,
      },
    ]
    : [
      {
        title: `${proLimit} acțiuni AI pe zi`,
        detail: `De ${Math.max(2, Math.round(proLimit / Math.max(1, freeLimit)))}× mai mult decât varianta gratuită (${freeLimit}/zi).`,
        highlight: true,
      },
      {
        title: 'Corectare foto pe barem EN & BAC',
        detail: 'Fotografiezi rezolvarea la Subiectul II/III și primești punctajul pe fiecare etapă.',
        highlight: false,
      },
      {
        title: 'Exerciții AI pe orice formulă & capitol',
        detail: 'Generezi exerciții noi (Ușor · Mediu · Examen) exact unde ai nevoie de practică.',
        highlight: false,
      },
      {
        title: 'Fără reclame · Caiet sincronizat în cloud',
        detail: 'Toate cele 58 fișe offline, 92 exerciții și 12 simulări rămân 100% gratuite.',
        highlight: false,
      },
    ];

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      <ComicBackdrop />

      {/* Full-bleed curved Royal-Violet canopy unifying top bar and hero spotlight */}
      <View style={[styles.canopy, { paddingTop: insets.top ?? 0 }]}>
        <LinearGradient
          colors={viewingMax || maxActive ? ['#6A24F5', '#4915C7', '#2E0D8A', '#1C0759'] : ['#924BFF', '#6822EE', '#4713C2', '#310C92']}
          start={{ x: 0.06, y: 0 }}
          end={{ x: 0.94, y: 1 }}
          style={styles.fill}
        />
        <View pointerEvents="none" style={styles.canopyGlowCyan} />
        <View pointerEvents="none" style={styles.canopyGlowLime} />
        <View pointerEvents="none" style={styles.canopyOrbitArc} />
        <Text accessible={false} style={styles.canopyStar}>✦</Text>

        <View style={[styles.header, { paddingHorizontal: gutter }]}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>Profu’ de mate</Text>
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>
                {maxActive ? 'MAX' : proActive ? 'PRO' : 'PRO & MAX'}
              </Text>
            </View>
          </View>
          <IconButton
            label="Închide abonamentele"
            disabled={Boolean(busy)}
            dimWhenDisabled={false}
            onPress={props.onClose}
            size={42}
            style={styles.closeBtn}
          >
            <MiniGlyph name="close" size={18} color={colors.violetDeep} />
          </IconButton>
        </View>

        <View style={[styles.hero, isVeryShort && styles.heroCompact, { paddingHorizontal: gutter }]}>
          <View style={styles.heroCopy}>
            <Chip
              label={
                success
                  ? `PROFU’ ${successTier === 'max' ? 'MAX' : 'PRO'} ACTIV`
                  : maxActive
                    ? 'PROFU’ MAX ACTIV'
                    : proActive
                      ? 'PROFU’ PRO ACTIV'
                      : viewingMax
                        ? 'PUTERE MAXIMĂ'
                        : 'MAI MULTĂ PRACTICĂ'
              }
              tone="lime"
            />
            <Text style={styles.heroTitle}>
              {success
                ? 'Gata. Continuăm!'
                : maxActive
                  ? 'Ai Profu’ Max\nla putere maximă.'
                  : proActive
                    ? 'Ai Profu’ Pro\nactiv pe cont.'
                    : viewingMax
                      ? 'Putere maximă\npentru examene.'
                      : 'Mai mult loc\npentru „aha!”'}
            </Text>
            <Text style={styles.heroNote}>
              {success
                ? `Ai până la ${successLimit} de acțiuni AI pe zi.`
                : premium
                  ? `Până la ${access.limit} de acțiuni AI pe zi, explicate pas cu pas.`
                  : viewingMax
                    ? `Până la ${maxLimit} acțiuni AI / zi + raționament matematic extins.`
                    : `Până la ${proLimit} acțiuni AI / zi — foto, editor, exerciții și barem EN/BAC.`}
            </Text>
          </View>
          <View pointerEvents="none" style={styles.art}>
            <SpotlightAura size={118} tone="onViolet" active={active} />
            <Mascot pose={success || premium ? 'cheer' : 'wave'} size={114} active={active} />
          </View>
        </View>
      </View>

      <ScrollView
        scrollEnabled={!busy}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <View collapsable={false} pointerEvents={busy ? 'none' : 'auto'}>
          <View style={{ paddingHorizontal: gutter }}>
            {success ? (
              <View style={styles.activeSection}>
                <View style={styles.activeMark}><MiniGlyph name="check" size={28} color={colors.ink} /></View>
                <Text style={styles.sectionTitle}>
                  {successTier === 'max' ? 'Profu’ Max este activ.' : 'Profu’ Pro este activ.'}
                </Text>
                <Text style={styles.body}>Abonamentul este legat de contul tău. Revino la matematică când ești pregătit.</Text>
              </View>
            ) : premium ? (
              <View style={styles.activeSection}>
                <Chip label={maxActive ? 'SPAȚIUL TĂU MAX DE AZI' : 'SPAȚIUL TĂU PRO DE AZI'} tone="violetSoft" outlined={false} />
                <Text style={styles.quota}>{access.remaining}<Text style={styles.quotaTotal}> / {access.limit}</Text></Text>
                <Text style={styles.sectionTitle}>acțiuni AI disponibile</Text>
                {access.resetAt ? (
                  <QuotaResetTimer
                    resetAt={access.resetAt}
                    remaining={access.remaining}
                    limit={access.limit}
                    premium
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
                variant={quotaExhausted ? 'hero' : 'compact'}
                active={active}
                style={styles.resetTimerWrap}
              />
            ) : null}

            {props.canContinue && !success ? (
              <View style={styles.continueRow}>
                <View style={styles.continueCopy}>
                  <Text style={styles.continueTitle}>Ai probleme disponibile.</Text>
                  <Text style={styles.bodySmall}>Poți reveni la problema ta.</Text>
                </View>
                <Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={props.onClose} style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}>
                  <Text style={styles.continueLabel}>Continuă</Text>
                </Pressable>
              </View>
            ) : null}

            {showTierTabs ? (
              <View style={styles.tierSelectorWrap}>
                <View accessibilityRole="tablist" accessibilityLabel="Alege nivelul de abonament" style={styles.tierTabs}>
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
                      selectedTier === 'pro' && styles.tierTabActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.tierTabHead}>
                      <Text style={[styles.tierTabName, selectedTier === 'pro' && styles.tierTabNameActive]}>Profu’ Pro</Text>
                      <View style={[styles.tierMiniBadge, selectedTier === 'pro' && styles.tierMiniBadgeActive]}>
                        <Text style={[styles.tierMiniBadgeText, selectedTier === 'pro' && styles.tierMiniBadgeTextActive]}>POPULAR</Text>
                      </View>
                    </View>
                    <Text style={[styles.tierTabQuota, selectedTier === 'pro' && styles.tierTabQuotaActive]}>
                      {proLimit} acțiuni AI / zi
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
                    <View style={styles.tierTabHead}>
                      <Text style={[styles.tierTabName, selectedTier === 'max' && styles.tierTabNameActive]}>Profu’ Max</Text>
                      <View style={[styles.tierMiniBadge, selectedTier === 'max' && styles.tierMiniBadgeMax]}>
                        <Text style={[styles.tierMiniBadgeText, selectedTier === 'max' && styles.tierMiniBadgeTextMax]}>3× + EXTINS</Text>
                      </View>
                    </View>
                    <Text style={[styles.tierTabQuota, selectedTier === 'max' && styles.tierTabQuotaActive]}>
                      {maxLimit} / zi · extins
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {showUpgradeFromPro ? (
              <View style={styles.upgradeBanner}>
                <View style={styles.upgradeBannerTop}>
                  <Chip label="TRECI LA PROFU’ MAX" tone="lime" outlined={false} />
                  <Text style={styles.upgradeQuotaTag}>{maxLimit} / zi</Text>
                </View>
                <Text style={styles.upgradeTitle}>Vrei 3× mai mult + raționament extins?</Text>
                <Text style={styles.bodySmall}>
                  Profu’ Max urcă limita de la {proLimit} la {maxLimit} acțiuni AI pe zi și activează raționamentul matematic extins pentru EN și BAC.
                </Text>
              </View>
            ) : null}

            {!success && !maxActive ? (
              <View style={styles.benefitsCard}>
                <View style={styles.benefitsHeader}>
                  <Text style={styles.benefitsHeading}>
                    Ce primești în Profu’ {selectedTierLabel}
                  </Text>
                  <Text style={styles.freeCompareTag}>Gratuit: {freeLimit}/zi</Text>
                </View>
                <View style={styles.benefitsList}>
                  {tierBenefits.map((item) => (
                    <View key={item.title} style={styles.benefitRow}>
                      <View style={[styles.benefitCheck, item.highlight && styles.benefitCheckHighlight]}>
                        <MiniGlyph name="check" size={12} color={colors.ink} />
                      </View>
                      <View style={styles.benefitCopy}>
                        <Text style={styles.benefitTitle}>{item.title}</Text>
                        <Text style={styles.benefitDetail}>{item.detail}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {showPlans ? (
              <View style={styles.plansSection}>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>Alege perioada</Text>
                  <Chip label={`PROFU’ ${selectedTierLabel.toUpperCase()} · ${selectedTierLimit}/ZI`} tone="violetSoft" outlined={false} />
                </View>
                <View accessibilityRole="radiogroup" accessibilityLabel={`Planuri Profu’ ${selectedTierLabel}`} style={styles.plans}>
                  {(!hasTierOffer || tierOffer.annual) ? <PlanOption period="annual" plan={tierOffer.annual} selected={selected === 'annual'} disabled={Boolean(busy)} onSelect={() => props.onSelect('annual')} /> : null}
                  {(!hasTierOffer || tierOffer.monthly) ? <PlanOption period="monthly" plan={tierOffer.monthly} selected={selected === 'monthly'} disabled={Boolean(busy)} onSelect={() => props.onSelect('monthly')} /> : null}
                </View>
                <View style={styles.offerStatus} accessibilityLiveRegion="polite">
                  {!configured ? (
                    <View style={styles.noticePill}>
                      <Text style={styles.bodySmall}>Abonamentele nu sunt disponibile momentan. Varianta gratuită rămâne disponibilă.</Text>
                    </View>
                  ) : props.offerError ? (
                    <>
                      <Text style={styles.bodySmall}>{props.offerError}</Text>
                      <Pressable accessibilityRole="button" onPress={props.onRetryOffer} disabled={Boolean(busy)} style={styles.textAction}>
                        <Text style={styles.link}>Reîncearcă încărcarea prețurilor</Text>
                      </Pressable>
                    </>
                  ) : busyPrices ? (
                    <Text style={styles.bodySmall}>Actualizez prețurile din Google Play…</Text>
                  ) : !googleLinked ? (
                    <Text style={styles.bodySmall}>Conectează contul pentru prețurile disponibile în Google Play.</Text>
                  ) : offer && !hasTierOffer ? (
                    <Text style={styles.bodySmall}>Planul Profu’ {selectedTierLabel} nu este publicat încă în Google Play.</Text>
                  ) : (
                    <Text style={styles.bodySmall}>Prețul și perioada sunt confirmate în Google Play înainte de plată.</Text>
                  )}
                </View>
              </View>
            ) : null}

            {!access && !success ? (
              <View style={styles.accountStatus}>
                <Text style={styles.bodySmall}>
                  {waitingForAccess ? 'Contul se actualizează în fundal. Poți explora planurile între timp.' : 'Limita de azi nu a putut fi verificată. Poți continua să explorezi aplicația.'}
                </Text>
                {!waitingForAccess ? (
                  <Pressable accessibilityRole="button" onPress={props.onRefresh} disabled={Boolean(busy)} style={styles.textAction}>
                    <Text style={styles.link}>Reîncearcă verificarea</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {props.error ? <Text accessibilityRole="alert" style={styles.error}>{props.error}</Text> : null}

            <View style={styles.legal}>
              {!maxActive && !success ? (
                <Text style={styles.legalText}>
                  Abonamentul se reînnoiește automat. Îl poți anula oricând din Google Play înainte de următoarea reînnoire. Prețul și perioada de facturare sunt confirmate înainte de plată.
                </Text>
              ) : null}
              <Pressable accessibilityRole="link" disabled={Boolean(busy)} onPress={props.onLegal} style={styles.textAction}>
                <Text style={styles.legalLink}>Termeni și confidențialitate</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 12) }]}>
        {success ? (
          <ComicButton title="Înapoi la matematică" icon="scan" onPress={props.onClose} compact />
        ) : maxActive ? (
          <ComicButton title={busy === 'manage' ? 'Deschid Google Play…' : 'Administrează abonamentul'} icon="settings" disabled={Boolean(busy)} onPress={props.onManage} compact />
        ) : proActive && (!configured || !selectedPackage) ? (
          <ComicButton title={busy === 'manage' ? 'Deschid Google Play…' : 'Administrează abonamentul'} icon="settings" disabled={Boolean(busy)} onPress={props.onManage} compact />
        ) : identity === 'anonymous' ? (
          <GoogleAccountButton busy={busy === 'google'} disabled={Boolean(busy) && busy !== 'google'} note="Un cont pentru Caiet și abonament" onPress={props.onConnect} />
        ) : (
          <ComicButton
            title={
              busy === 'purchase'
                ? 'Confirmă în Google Play…'
                : canBuy && selectedPackage
                  ? `Alege ${selectedTierLabel} · ${selectedPackage.product.priceString}`
                  : !configured
                    ? 'Abonamente indisponibile'
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
        {proActive && canBuy && !success ? (
          <Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={props.onManage} style={styles.restore}>
            <Text style={styles.restoreText}>{busy === 'manage' ? 'Deschid Google Play…' : 'Administrează abonamentul Pro'}</Text>
          </Pressable>
        ) : googleLinked && configured && !success ? (
          <Pressable accessibilityRole="button" disabled={Boolean(busy) || !access} onPress={props.onRestore} style={styles.restore}>
            <Text style={styles.restoreText}>{busy === 'restore' ? 'Caut achiziția…' : 'Restaurează achizițiile'}</Text>
          </Pressable>
        ) : !success && !premium ? (
          <Text style={styles.footerNote}>Continui gratuit oricând ({freeLimit}/zi + offline complet). Fără obligații.</Text>
        ) : null}
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
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    paddingBottom: 18,
    position: 'relative',
    zIndex: 4,
  },
  canopyGlowCyan: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    top: -85,
    left: -55,
    backgroundColor: 'rgba(67, 214, 230, 0.22)',
  },
  canopyGlowLime: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    bottom: -85,
    right: 16,
    backgroundColor: 'rgba(216, 255, 62, 0.16)',
  },
  canopyOrbitArc: {
    position: 'absolute',
    width: 290,
    height: 290,
    borderRadius: 145,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    top: -120,
    right: -85,
  },
  canopyStar: {
    position: 'absolute',
    left: 22,
    bottom: 20,
    fontFamily: fonts.display,
    fontSize: 14,
    color: 'rgba(216, 255, 62, 0.38)',
  },
  header: { minHeight: 54, paddingTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  brandRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  brand: { fontFamily: fonts.display, fontSize: 19, color: colors.paper },
  brandBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(216, 255, 62, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(216, 255, 62, 0.55)',
  },
  brandBadgeText: { fontFamily: fonts.bodyBold, fontSize: 9.5, letterSpacing: 0.7, color: colors.lime, includeFontPadding: false },
  closeBtn: {
    borderRadius: 21,
    borderBottomWidth: 3.5,
    borderBottomColor: '#C5B8FA',
    backgroundColor: '#FFFFFF',
  },
  content: { paddingTop: 12, paddingBottom: 14 },

  hero: {
    paddingTop: 6,
    paddingBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroCompact: { paddingTop: 2 },
  heroCopy: { flex: 1, minWidth: 0, zIndex: 1 },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 30,
    color: colors.paper,
    marginTop: 9,
    textShadowColor: 'rgba(18, 6, 62, 0.28)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },
  heroNote: { maxWidth: 235, fontFamily: fonts.bodyMedium, fontSize: 12.8, lineHeight: 17.8, color: 'rgba(244, 238, 255, 0.92)', marginTop: 6 },
  art: { width: 116, height: 126, justifyContent: 'center', alignItems: 'center', marginLeft: 4, position: 'relative' },

  tierSelectorWrap: { marginTop: 12 },
  tierTabs: {
    flexDirection: 'row',
    gap: 10,
  },
  tierTab: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1.5,
    borderBottomWidth: 3.8,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 4,
  },
  tierTabActive: {
    borderColor: '#8B52FF',
    borderBottomColor: '#4514BE',
    backgroundColor: colors.violet,
  },
  tierTabActiveMax: {
    borderColor: '#6D3DFF',
    borderBottomColor: '#230A6E',
    backgroundColor: '#3712A8',
  },
  tierTabHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    flexWrap: 'wrap',
  },
  tierTabName: {
    fontFamily: fonts.display,
    fontSize: 16,
    lineHeight: 20,
    color: colors.ink,
  },
  tierTabNameActive: {
    color: colors.paper,
  },
  tierMiniBadge: {
    paddingHorizontal: 6.5,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
  },
  tierMiniBadgeActive: {
    backgroundColor: colors.lime,
  },
  tierMiniBadgeMax: {
    backgroundColor: colors.gold,
  },
  tierMiniBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 8.5,
    letterSpacing: 0.5,
    color: colors.violetDeep,
    includeFontPadding: false,
  },
  tierMiniBadgeTextActive: {
    color: colors.ink,
  },
  tierMiniBadgeTextMax: {
    color: colors.ink,
  },
  tierTabQuota: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.inkSoft,
  },
  tierTabQuotaActive: {
    color: 'rgba(244, 238, 255, 0.94)',
  },

  upgradeBanner: {
    marginTop: 12,
    borderRadius: 22,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: '#DDF68E',
    borderBottomColor: '#B1D63D',
    backgroundColor: '#F5FFD2',
    padding: 14,
    gap: 5,
  },
  upgradeBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  upgradeQuotaTag: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.violetDeep,
  },
  upgradeTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 17,
    lineHeight: 21,
    color: colors.ink,
  },

  benefitsCard: {
    marginTop: 12,
    borderRadius: 24,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E8E0FC',
    borderBottomColor: '#D4C7F7',
    backgroundColor: '#FFFFFF',
    padding: 15,
    gap: 11,
  },
  benefitsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  benefitsHeading: {
    fontFamily: fonts.displaySemi,
    fontSize: 16.5,
    lineHeight: 21,
    color: colors.ink,
  },
  freeCompareTag: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.violetDeep,
    backgroundColor: colors.violetSoft,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  benefitsList: {
    gap: 10,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  benefitCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  benefitCheckHighlight: {
    backgroundColor: colors.lime,
  },
  benefitCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1.5,
  },
  benefitTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
    color: colors.ink,
  },
  benefitDetail: {
    fontFamily: fonts.body,
    fontSize: 12.2,
    lineHeight: 16.8,
    color: colors.inkSoft,
  },

  resetTimerWrap: { marginTop: 12 },
  activeTimer: { width: '100%', marginTop: 6 },

  plansSection: { paddingTop: 16 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.ink },
  plans: { gap: 10 },
  plan: {
    minHeight: 80,
    padding: 15,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E8E0FC',
    borderBottomColor: '#D4C7F7',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  planSelected: {
    backgroundColor: '#F5EEFF',
    borderWidth: 1.75,
    borderBottomWidth: 4,
    borderColor: colors.violet,
    borderBottomColor: '#4E16CE',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { backgroundColor: colors.lime, borderColor: 'rgba(86, 120, 0, 0.35)' },
  planCopy: { flex: 1, minWidth: 0 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  planTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  bestBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.gold,
  },
  bestBadgeText: { ...typography.kicker, fontSize: 9.5, lineHeight: 13, paddingHorizontal: 1, color: colors.ink, includeFontPadding: false },
  planNote: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, color: colors.inkSoft, marginTop: 2 },
  priceCopy: { maxWidth: '42%', alignItems: 'flex-end' },
  price: { fontFamily: fonts.displaySemi, fontSize: 18, color: colors.ink, textAlign: 'right' },
  pricePending: { fontFamily: fonts.bodyBold, fontSize: 11.5, lineHeight: 15, color: colors.inkSoft, maxWidth: 88 },
  planPeriod: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 14, color: colors.inkSoft, marginTop: 2 },

  offerStatus: { minHeight: 46, paddingTop: 12 },
  noticePill: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.1)',
    backgroundColor: colors.paperTint,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  body: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  bodySmall: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12.5, lineHeight: 17.5 },
  accountStatus: { paddingTop: 12 },
  textAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 13 },
  legal: { paddingTop: 14 },
  legalText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 11.5, lineHeight: 16.5 },
  legalLink: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 12 },

  footer: { paddingTop: 10, backgroundColor: colors.canvas, borderTopWidth: 1, borderTopColor: 'rgba(124, 60, 255, 0.08)' },
  footerNote: { fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 12, textAlign: 'center', marginTop: 6 },
  restore: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  restoreText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 13 },

  activeSection: { alignItems: 'center', gap: 10, paddingVertical: 18 },
  activeMark: {
    width: 60,
    height: 60,
    borderRadius: 22,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quota: { fontFamily: fonts.display, fontSize: 56, color: colors.violetDeep },
  quotaTotal: { fontSize: 28, color: colors.inkSoft },
  continueRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 13,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(86, 120, 0, 0.2)',
    backgroundColor: '#F3FFE0',
  },
  continueCopy: { flex: 1 },
  continueTitle: { fontFamily: fonts.displaySemi, fontSize: 15, color: colors.ink },
  continueButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  error: { fontFamily: fonts.bodyBold, fontSize: 12.5, lineHeight: 18, color: '#A92D46', paddingTop: 12 },
  pressed: { opacity: 0.94, transform: [{ scale: 0.985 }] },
});
