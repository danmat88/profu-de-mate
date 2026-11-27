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
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { IconButton } from '../../../shared/ui/IconButton';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { RoyalHeroCanopyBackdrop } from '../../../shared/ui/RoyalHeroCanopyBackdrop';
import { Text } from '../../../shared/ui/Typography';
import { formatRoCount } from '../../../shared/utils/romanianGrammar';
import { packagesForTier, type PremiumOffer } from '../services/purchases';
import { QuotaResetTimer } from './QuotaResetTimer';

export type PremiumAction = 'google' | 'purchase' | 'restore' | 'manage' | null;
export type PremiumPlan = 'annual' | 'monthly';
export type PlanTabId = 'start' | PaidPlanTier;

type BenefitBadgeTone = 'lime' | 'gold' | 'violet' | 'limeSoft';

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
  selectedTab: PlanTabId;
  selected: PremiumPlan;
  busy: PremiumAction;
  error: string | null;
  success: boolean;
  successLimit: number;
  successTier?: PaidPlanTier;
  active?: boolean;
  timerActive?: boolean;
  onClose: () => void;
  onBuy: () => void;
  onRestore: () => void;
  onManage: () => void;
  onRefresh: () => void;
  onRetryOffer: () => void;
  onLegal: () => void;
  onSelectTab: (tab: PlanTabId) => void;
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
  const priceText = plan?.product.priceString ?? '—';
  const subNote = annual
    ? plan?.product.pricePerMonthString
      ? `${plan.product.pricePerMonthString} / lună`
      : 'Facturat o dată pe an'
    : 'Plată lunară · flexibil';

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
          <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.periodTitle}>
            {annual ? 'Anual' : 'Lunar'}
          </Text>
          <View collapsable={false} style={[styles.saveBadge, !annual && styles.saveBadgeGhost]}>
            <Text maxFontSizeMultiplier={1.05} style={[styles.saveBadgeText, !annual && styles.saveBadgeTextGhost]}>
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
          maxFontSizeMultiplier={1.2}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          style={[styles.periodPrice, !plan && styles.periodPricePending]}
        >
          {priceText}
        </Text>
        {plan ? <Text maxFontSizeMultiplier={1.1} style={styles.periodUnit}>{annual ? '/ an' : '/ lună'}</Text> : null}
      </View>

      <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.periodNote}>
        {subNote}
      </Text>
    </Pressable>
  );
}

/**
 * Single-screen 3-tier Plans surface (Start · Pro · Max) with a locked-height
 * canopy integrating the live countdown timer, zero layout jumps across tabs,
 * transparent metric badges, and a seamless 1-tap checkout flow.
 */
export const PremiumSurface = memo(function PremiumSurface(props: Props) {
  const frame = useSafeAreaFrame();
  const { gutter } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const {
    access,
    identity,
    accessLoading,
    configured,
    offer,
    selectedTab,
    selected,
    busy,
    success,
    successLimit,
    successTier = 'pro',
    active = true,
    timerActive = active,
  } = props;

  const activePaidTier: PaidPlanTier | null = access?.premium.active ? (access.premium.tier ?? 'pro') : null;
  const activePlanTab: PlanTabId = activePaidTier ?? 'start';
  const premium = activePaidTier !== null;
  const maxActive = activePaidTier === 'max';
  const proActive = activePaidTier === 'pro';
  const googleLinked = identity === 'google';
  const busyPrices = useDelayedBusy(props.offerLoading);

  const freeLimit = access?.allowances.freeDaily ?? 5;
  const proLimit = access?.allowances.premiumDaily ?? 50;
  const maxLimit = access?.allowances.maxDaily ?? 150;

  const viewingStart = selectedTab === 'start';
  const viewingPro = selectedTab === 'pro';
  const viewingMax = selectedTab === 'max';
  const selectedPaidTier: PaidPlanTier = viewingMax ? 'max' : 'pro';
  const selectedTierLabel = viewingMax ? 'Max' : viewingPro ? 'Pro' : 'Start';
  const tierOffer = viewingStart ? { monthly: null, annual: null } : packagesForTier(offer, selectedPaidTier);
  const hasTierOffer = Boolean(tierOffer.annual || tierOffer.monthly);
  const selectedPackage = tierOffer[selected] ?? null;

  const viewingOwnActivePaidPlan = (proActive && viewingPro) || (maxActive && viewingMax);
  const viewingLowerThanActive = maxActive && viewingPro;
  const canUpgradeOrBuyTab = !success && !viewingStart && !viewingOwnActivePaidPlan && !viewingLowerThanActive;
  const canBuy = canUpgradeOrBuyTab && configured && Boolean(selectedPackage) && Boolean(access || !googleLinked);
  const waitingForAccess = !access && accessLoading;

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
  const freeCountLabel = formatRoCount(freeLimit, 'acțiune AI', 'acțiuni AI');
  const proCountLabel = formatRoCount(proLimit, 'acțiune AI', 'acțiuni AI');
  const maxCountLabel = formatRoCount(maxLimit, 'acțiune AI', 'acțiuni AI');
  const successCountLabel = formatRoCount(successLimit, 'acțiune AI', 'acțiuni AI');

  // Every plan has the exact same 3-row structure so switching Start <-> Pro <-> Max never jumps height.
  const tierBenefits: readonly TierBenefit[] = viewingStart
    ? [
      {
        badge: `${freeLimit}/zi`,
        tone: 'violet',
        title: `${freeCountLabel} pe zi`,
        detail: 'Rezolvări din poză, editor, verificare teme, exerciții AI și barem EN/BAC.',
      },
      {
        badge: 'AI',
        tone: 'violet',
        title: 'Explicații pas cu pas',
        detail: 'Reîncărcare automată în fiecare noapte la 00:00 (ora României).',
      },
      {
        badge: '∞',
        tone: 'limeSoft',
        title: 'Tot materialul de studiu, offline',
        detail: '58 de fișe de formule, 92 de exerciții, 12 simulări EN/BAC și calculator.',
      },
    ]
    : viewingMax
      ? [
        {
          badge: `${maxLimit}/zi`,
          tone: 'gold',
          title: `${maxCountLabel} pe zi`,
          detail: `De ${maxOverPro}× mai mult decât Pro — ritm intens pentru teze, EN & BAC.`,
        },
        {
          badge: '✦',
          tone: 'gold',
          title: 'Raționament matematic extins',
          detail: 'Analiză aprofundată pe demonstrații lungi, probleme grele și barem.',
        },
        {
          badge: '∞',
          tone: 'limeSoft',
          title: 'Toate funcțiile AI + studiu offline',
          detail: 'Reset zilnic la 00:00 · 58 de fișe, 92 de exerciții și 12 simulări.',
        },
      ]
      : [
        {
          badge: `${proLimit}/zi`,
          tone: 'lime',
          title: `${proCountLabel} pe zi`,
          detail: `De ${proMultiplier}× mai mult decât Start — pentru teme și exersare zilnică.`,
        },
        {
          badge: 'AI',
          tone: 'violet',
          title: 'Toate funcțiile AI incluse',
          detail: 'Poză pas cu pas, editor, verificare teme, exerciții AI și barem EN/BAC.',
        },
        {
          badge: '∞',
          tone: 'limeSoft',
          title: 'Reset la 00:00 + studiu offline',
          detail: '58 de fișe de formule, 92 de exerciții, 12 simulări EN/BAC și calculator.',
        },
      ];

  const canopyColors: readonly [string, string, string] = viewingMax || maxActive
    ? ['#591CE6', '#3710A4', '#1F0766']
    : viewingStart
      ? ['#6A3BF5', '#4B1EC9', '#311094']
      : ['#883CFF', '#5D1CE6', '#3A10AA'];

  const specStatusTag = selectedTab === activePlanTab
    ? 'PLANUL TĂU'
    : viewingStart
      ? 'GRATUIT · 0 RON'
      : viewingMax
        ? proActive
          ? `DE ${maxOverPro}× FAȚĂ DE PRO`
          : `DE ${maxMultiplier}× FAȚĂ DE START`
        : `DE ${proMultiplier}× FAȚĂ DE START`;

  const statusText = !canUpgradeOrBuyTab
    ? null
    : !configured
      ? 'Abonamentele Google Play se activează în curând. Planul Start rămâne disponibil gratuit.'
      : props.offerError
        ? props.offerError
        : busyPrices
          ? 'Actualizez prețurile din Google Play…'
          : offer && !hasTierOffer
            ? `Planul Profu’ ${selectedTierLabel} nu este publicat încă în Google Play.`
            : null;

  const activePlanLabel = maxActive ? 'Max' : proActive ? 'Pro' : 'Start';
  const showManageProLink = proActive && viewingMax && !success;
  const showRestoreLink = configured && !success && !maxActive && !showManageProLink;

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      <ComicBackdrop />

      {/* Fixed-height Royal-Violet / Midnight-Max canopy — NEVER changes height between tabs */}
      <View style={[styles.canopy, { paddingTop: insets.top ?? 0 }]}>
        <LinearGradient
          colors={canopyColors}
          start={{ x: 0.06, y: 0 }}
          end={{ x: 0.94, y: 1 }}
          style={styles.fill}
        />
        <RoyalHeroCanopyBackdrop
          showGradient={false}
          topLeftAccent={viewingMax || maxActive ? '#FFD447' : '#43D6E6'}
          bottomRightAccent={viewingMax || maxActive ? '#FFE57F' : '#D8FF3E'}
        />

        <View style={[styles.header, { paddingHorizontal: gutter }]}>
          <View style={styles.brandRow}>
            <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.brand}>
              Planuri Profu’
            </Text>
            <View style={[styles.brandBadge, (maxActive || viewingMax) && styles.brandBadgeMax]}>
              <Text
                maxFontSizeMultiplier={1.05}
                numberOfLines={1}
                style={[styles.brandBadgeText, (maxActive || viewingMax) && styles.brandBadgeTextMax]}
              >
                {maxActive ? 'MAX ACTIV' : proActive ? 'PRO ACTIV' : 'START ACTIV'}
              </Text>
            </View>
          </View>
          <IconButton
            label="Închide planurile"
            disabled={Boolean(busy)}
            dimWhenDisabled={false}
            onPress={props.onClose}
            size={36}
            style={styles.closeBtn}
          >
            <MiniGlyph name="close" size={15} color={colors.violetDeep} />
          </IconButton>
        </View>

        <View style={[styles.canopyStatusSlot, { paddingHorizontal: gutter }]}>
          {access?.resetAt ? (
            <QuotaResetTimer
              resetAt={access.resetAt}
              remaining={access.remaining}
              limit={access.limit}
              premium={premium}
              planName={activePlanLabel}
              variant="canopy"
              active={timerActive}
            />
          ) : (
            <View style={styles.canopyFallbackStrip}>
              <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.canopyFallbackTitle}>
                {success
                  ? `Profu’ ${successTier === 'max' ? 'Max' : 'Pro'} este activ`
                  : access
                    ? `${access.remaining} / ${access.limit} acțiuni AI rămase azi`
                    : waitingForAccess
                      ? 'Verific contul și limita de azi…'
                      : 'Explorează planurile Profu’ de mate'}
              </Text>
              <Text maxFontSizeMultiplier={1.1} numberOfLines={1} style={styles.canopyFallbackSub}>
                {success
                  ? `Ai până la ${successCountLabel} pe zi.`
                  : 'Reîncărcare zilnică automată la 00:00 (ora României).'}
              </Text>
            </View>
          )}
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
            <View style={styles.successCard}>
              <View style={styles.activeMark}>
                <MiniGlyph name="check" size={28} color={colors.ink} />
              </View>
              <Text style={styles.successTitle}>
                {successTier === 'max' ? 'Profu’ Max este activ!' : 'Profu’ Pro este activ!'}
              </Text>
              <Text style={styles.successBody}>
                Ai până la {successCountLabel} pe zi. Abonamentul este salvat în contul tău Google și se administrează din Google Play.
              </Text>
            </View>
          ) : (
            <>
              {props.canContinue ? (
                <View style={styles.continueRow}>
                  <View style={styles.continueCopy}>
                    <Text style={styles.continueTitle}>Ai acțiuni AI disponibile.</Text>
                    <Text style={styles.bodySmall}>Poți reveni la problema ta.</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={Boolean(busy)}
                    onPress={props.onClose}
                    style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.continueLabel}>Continuă</Text>
                  </Pressable>
                </View>
              ) : null}

              {/* Balanced 3-plan segmented selector: Start | Pro | Max */}
              <View accessibilityRole="tablist" accessibilityLabel="Alege planul Profu’" style={styles.tierTrack}>
                {(
                  [
                    { id: 'start', name: 'Start', quota: `${freeLimit} / zi`, tag: activePlanTab === 'start' ? 'ACTIV' : 'GRATUIT' },
                    { id: 'pro', name: 'Pro', quota: `${proLimit} / zi`, tag: activePlanTab === 'pro' ? 'ACTIV' : 'POPULAR' },
                    { id: 'max', name: 'Max', quota: `${maxLimit} / zi`, tag: activePlanTab === 'max' ? 'ACTIV' : 'EXTINS' },
                  ] as const
                ).map((tab) => {
                  const isSelected = selectedTab === tab.id;
                  const isActivePlan = activePlanTab === tab.id;
                  return (
                    <Pressable
                      key={tab.id}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`Planul Profu’ ${tab.name}, ${tab.quota}`}
                      disabled={Boolean(busy)}
                      onPress={() => {
                        Haptics.selection();
                        props.onSelectTab(tab.id);
                      }}
                      style={({ pressed }) => [
                        styles.tierTab,
                        isSelected && (
                          tab.id === 'max'
                            ? styles.tierTabActiveMax
                            : tab.id === 'start'
                              ? styles.tierTabActiveStart
                              : styles.tierTabActivePro
                        ),
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.tierTabTop}>
                        <Text
                          maxFontSizeMultiplier={1.12}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.82}
                          style={[styles.tierTabName, isSelected && styles.tierTabNameActive]}
                        >
                          {tab.name}
                        </Text>
                        <View
                          style={[
                            styles.tierTag,
                            isSelected && tab.id === 'pro' && styles.tierTagPro,
                            isSelected && tab.id === 'max' && styles.tierTagMax,
                            isSelected && tab.id === 'start' && styles.tierTagStart,
                            !isSelected && isActivePlan && styles.tierTagCurrent,
                          ]}
                        >
                          <Text
                            maxFontSizeMultiplier={1.0}
                            numberOfLines={1}
                            style={[
                              styles.tierTagText,
                              isSelected && styles.tierTagTextActive,
                            ]}
                          >
                            {tab.tag}
                          </Text>
                        </View>
                      </View>
                      <Text
                        maxFontSizeMultiplier={1.12}
                        numberOfLines={1}
                        style={[styles.tierTabMeta, isSelected && styles.tierTabMetaActive]}
                      >
                        {tab.quota}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Fixed-structure 3-row spec card — identical height on Start, Pro, and Max */}
              <View style={[styles.benefitsCard, viewingMax && styles.benefitsCardMax]}>
                <View style={styles.benefitsHeader}>
                  <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.benefitsHeading}>
                    Profu’ {selectedTierLabel}
                  </Text>
                  <View style={[styles.specTag, selectedTab === activePlanTab && styles.specTagActive, viewingMax && selectedTab !== activePlanTab && styles.specTagMax]}>
                    <Text
                      maxFontSizeMultiplier={1.05}
                      numberOfLines={1}
                      style={[styles.specTagText, selectedTab === activePlanTab && styles.specTagTextActive]}
                    >
                      {specStatusTag}
                    </Text>
                  </View>
                </View>

                <View style={styles.benefitsList}>
                  {tierBenefits.map((item) => (
                    <View key={`${selectedTab}-${item.badge}-${item.title}`} style={styles.benefitRow}>
                      <View
                        style={[
                          styles.benefitBadge,
                          item.tone === 'lime'
                            ? styles.benefitBadgeLime
                            : item.tone === 'gold'
                              ? styles.benefitBadgeGold
                              : item.tone === 'limeSoft'
                                ? styles.benefitBadgeLimeSoft
                                : styles.benefitBadgeViolet,
                        ]}
                      >
                        <Text
                          maxFontSizeMultiplier={1.05}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.78}
                          style={[
                            styles.benefitBadgeText,
                            item.tone === 'violet' && styles.benefitBadgeTextViolet,
                            item.tone === 'limeSoft' && styles.benefitBadgeTextLimeSoft,
                          ]}
                        >
                          {item.badge}
                        </Text>
                      </View>
                      <View style={styles.benefitCopy}>
                        <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.benefitTitle}>
                          {item.title}
                        </Text>
                        <Text maxFontSizeMultiplier={1.15} numberOfLines={2} style={styles.benefitDetail}>
                          {item.detail}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Fixed-height pricing / active-plan slot */}
              {canUpgradeOrBuyTab ? (
                <View style={styles.plansSection}>
                  <View accessibilityRole="radiogroup" accessibilityLabel={`Perioadă Profu’ ${selectedTierLabel}`} style={styles.periodRow}>
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

                  {proActive && viewingMax ? (
                    <View style={styles.prorationPill}>
                      <Text style={styles.prorationText}>
                        Google Play creditează automat zilele rămase din Pro către Max.
                      </Text>
                    </View>
                  ) : null}

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
              ) : (
                <View style={[styles.planSummaryCard, viewingOwnActivePaidPlan && styles.planSummaryCardPaid]}>
                  <View style={styles.planSummaryTop}>
                    <Text maxFontSizeMultiplier={1.15} style={styles.planSummaryPrice}>
                      {viewingStart
                        ? '0 RON · Gratuit mereu'
                        : viewingLowerThanActive
                          ? 'Ai deja Profu’ Max activ'
                          : `Profu’ ${selectedTierLabel} este activ`}
                    </Text>
                    <View style={styles.planSummaryPill}>
                      <Text style={styles.planSummaryPillText}>
                        {viewingStart ? (activePlanTab === 'start' ? 'ACTIV' : 'BAZĂ') : 'GOOGLE PLAY'}
                      </Text>
                    </View>
                  </View>
                  <Text maxFontSizeMultiplier={1.15} style={styles.planSummaryNote}>
                    {viewingStart
                      ? 'Fără card bancar și fără abonament. Poți trece oricând la Pro sau Max când ai nevoie de mai multe acțiuni AI.'
                      : viewingLowerThanActive
                        ? `Planul tău Max include deja ${maxCountLabel}/zi și raționament matematic extins. Modificările se fac din Google Play.`
                        : 'Abonamentul este legat de contul tău Google și se administrează direct din Google Play.'}
                  </Text>
                </View>
              )}

              {!access ? (
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

              {canUpgradeOrBuyTab ? (
                <Text style={styles.legalCompact}>
                  {!googleLinked && configured
                    ? 'La pasul următor alegi contul Google, apoi confirmi în Google Play · Anulezi oricând.'
                    : 'Reînnoire automată prin Google Play · Anulezi oricând din cont.'}
                </Text>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 10) }]}>
        {success ? (
          <ComicButton title="Înapoi la matematică" icon="scan" onPress={props.onClose} compact />
        ) : viewingStart ? (
          !premium && access && !access.canAnalyze ? (
            <ComicButton
              title="Treci la Profu’ Pro"
              icon="trophy"
              tone="lime"
              disabled={Boolean(busy)}
              onPress={() => props.onSelectTab('pro')}
              compact
            />
          ) : (
            <ComicButton
              title={!premium ? 'Continuă cu Start (Gratuit)' : 'Înapoi la matematică'}
              icon="scan"
              tone="lime"
              disabled={Boolean(busy)}
              onPress={props.onClose}
              compact
            />
          )
        ) : viewingOwnActivePaidPlan || viewingLowerThanActive ? (
          <ComicButton
            title={busy === 'manage' ? 'Deschid Google Play…' : 'Administrează în Google Play'}
            icon="settings"
            disabled={Boolean(busy)}
            onPress={props.onManage}
            compact
          />
        ) : (
          <ComicButton
            title={
              busy === 'google'
                ? 'Conectez contul Google…'
                : busy === 'purchase'
                  ? 'Confirm în Google Play…'
                  : canBuy && selectedPackage
                    ? `${proActive && viewingMax ? 'Treci la Max' : `Alege ${selectedTierLabel}`} · ${selectedPackage.product.priceString}`
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
              <Pressable accessibilityRole="button" disabled={Boolean(busy) || (!access && googleLinked)} onPress={props.onRestore} style={styles.footerLinkBtn}>
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

  // Locked-height top canopy
  canopy: {
    width: '100%',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    paddingBottom: 12,
    position: 'relative',
    zIndex: 4,
  },
  canopyGlowCyan: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -100,
    left: -55,
    backgroundColor: 'rgba(67, 214, 230, 0.2)',
  },
  canopyGlowLime: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    bottom: -95,
    right: 10,
    backgroundColor: 'rgba(216, 255, 62, 0.14)',
  },
  canopyOrbitArc: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    top: -125,
    right: -75,
  },
  header: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  brandRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  brand: { fontFamily: fonts.display, fontSize: 19, lineHeight: 23, color: colors.paper },
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
  brandBadgeText: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 0.65, color: colors.lime, includeFontPadding: false },
  brandBadgeTextMax: { color: colors.gold },
  closeBtn: {
    borderRadius: 18,
    borderBottomWidth: 3,
    borderBottomColor: '#C5B8FA',
    backgroundColor: '#FFFFFF',
  },
  canopyStatusSlot: {
    marginTop: 4,
  },
  canopyFallbackStrip: {
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(18, 8, 54, 0.42)',
    paddingHorizontal: 13,
    justifyContent: 'center',
    gap: 2,
  },
  canopyFallbackTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    lineHeight: 17,
    color: colors.paper,
  },
  canopyFallbackSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11.2,
    lineHeight: 15,
    color: 'rgba(236, 228, 255, 0.85)',
  },

  content: { paddingTop: 10, paddingBottom: 10 },
  bodyStack: { gap: 9 },

  // 3-tier segmented selector (Start | Pro | Max)
  tierTrack: {
    flexDirection: 'row',
    gap: 5,
    padding: 4,
    borderRadius: 20,
    backgroundColor: '#ECE4FF',
    borderWidth: 1,
    borderColor: '#DDD2FA',
  },
  tierTab: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 8,
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tierTabActiveStart: {
    backgroundColor: '#5B31DC',
    borderColor: '#7F5AF8',
    borderBottomWidth: 3,
    borderBottomColor: '#3714A3',
  },
  tierTabActivePro: {
    backgroundColor: colors.violet,
    borderColor: '#8B52FF',
    borderBottomWidth: 3,
    borderBottomColor: '#4514BE',
  },
  tierTabActiveMax: {
    backgroundColor: '#2B0E8C',
    borderColor: '#6D3DFF',
    borderBottomWidth: 3,
    borderBottomColor: '#190657',
  },
  tierTabTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 3,
  },
  tierTabName: {
    fontFamily: fonts.display,
    fontSize: 15,
    lineHeight: 18,
    color: colors.ink,
    flexShrink: 1,
  },
  tierTabNameActive: { color: colors.paper },
  tierTag: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    flexShrink: 0,
  },
  tierTagStart: { backgroundColor: '#D6F7FF' },
  tierTagPro: { backgroundColor: colors.lime },
  tierTagMax: { backgroundColor: colors.gold },
  tierTagCurrent: { backgroundColor: colors.limeSoft },
  tierTagText: {
    fontFamily: fonts.bodyBold,
    fontSize: 7.5,
    letterSpacing: 0.35,
    color: colors.violetDeep,
    includeFontPadding: false,
  },
  tierTagTextActive: { color: colors.ink },
  tierTabMeta: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    color: colors.inkSoft,
  },
  tierTabMetaActive: { color: 'rgba(244, 238, 255, 0.92)' },

  // Fixed 3-row spec card
  benefitsCard: {
    borderRadius: 22,
    borderWidth: 1.3,
    borderBottomWidth: 3,
    borderColor: '#E8E0FC',
    borderBottomColor: '#D4C7F7',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 11,
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
    height: 22,
  },
  benefitsHeading: {
    fontFamily: fonts.display,
    fontSize: 16,
    lineHeight: 20,
    color: colors.ink,
  },
  specTag: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
  },
  specTagActive: {
    backgroundColor: colors.lime,
  },
  specTagMax: {
    backgroundColor: colors.goldSoft,
  },
  specTagText: {
    ...typography.kicker,
    fontSize: 8.5,
    lineHeight: 11,
    color: colors.violetDeep,
  },
  specTagTextActive: {
    color: colors.ink,
  },
  benefitsList: { gap: 8 },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  benefitBadge: {
    width: 48,
    height: 30,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  benefitBadgeLime: { backgroundColor: colors.lime },
  benefitBadgeLimeSoft: { backgroundColor: colors.limeSoft },
  benefitBadgeGold: { backgroundColor: colors.gold },
  benefitBadgeViolet: { backgroundColor: colors.violetSoft },
  benefitBadgeText: {
    fontFamily: fonts.display,
    fontSize: 12,
    lineHeight: 15,
    color: colors.ink,
    includeFontPadding: false,
  },
  benefitBadgeTextViolet: { color: colors.violetDeep },
  benefitBadgeTextLimeSoft: { color: colors.limeDeep },
  benefitCopy: { flex: 1, minWidth: 0, gap: 1 },
  benefitTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13.2,
    lineHeight: 16.5,
    color: colors.ink,
  },
  benefitDetail: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 15,
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
    height: 100,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.4,
    borderBottomWidth: 3.2,
    borderColor: '#E5DCFF',
    borderBottomColor: '#D0C2F7',
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
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
    fontSize: 16,
    lineHeight: 19,
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
  },
  periodPrice: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 22,
    color: colors.ink,
    flexShrink: 1,
  },
  periodPricePending: {
    color: colors.inkMuted,
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

  // Matching fixed-height summary card for Start or active plan
  planSummaryCard: {
    minHeight: 100,
    borderRadius: 20,
    borderWidth: 1.4,
    borderBottomWidth: 3.2,
    borderColor: '#E5DCFF',
    borderBottomColor: '#D0C2F7',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    gap: 6,
  },
  planSummaryCardPaid: {
    backgroundColor: '#F5FFD2',
    borderColor: '#DDF68E',
    borderBottomColor: '#B1D63D',
  },
  planSummaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  planSummaryPrice: {
    fontFamily: fonts.display,
    fontSize: 17,
    lineHeight: 21,
    color: colors.ink,
    flexShrink: 1,
  },
  planSummaryPill: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
  },
  planSummaryPillText: {
    ...typography.kicker,
    fontSize: 8.5,
    lineHeight: 11,
    color: colors.violetDeep,
  },
  planSummaryNote: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16.5,
    color: colors.inkSoft,
  },

  prorationPill: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDF68E',
    backgroundColor: '#F5FFD2',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  prorationText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11.5,
    lineHeight: 15.5,
    color: colors.limeDeep,
    textAlign: 'center',
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
    minHeight: 32,
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

  successCard: {
    borderRadius: 24,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#DDF68E',
    borderBottomColor: '#B1D63D',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 24,
    gap: 10,
  },
  activeMark: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontFamily: fonts.display, fontSize: 21, lineHeight: 25, color: colors.ink, textAlign: 'center' },
  successBody: { fontFamily: fonts.bodyMedium, fontSize: 13.5, lineHeight: 19, color: colors.inkSoft, textAlign: 'center' },

  continueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(86, 120, 0, 0.2)',
    backgroundColor: '#F3FFE0',
  },
  continueCopy: { flex: 1 },
  continueTitle: { fontFamily: fonts.displaySemi, fontSize: 14.5, color: colors.ink },
  continueButton: {
    minHeight: 36,
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
