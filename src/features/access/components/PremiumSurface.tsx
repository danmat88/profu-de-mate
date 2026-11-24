import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDelayedBusy } from '../../../shared/hooks/useDelayedBusy';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, radii, typography } from '../../../shared/theme';
import type { CommercialAccess } from '../../../shared/types';
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
import type { PremiumOffer } from '../services/purchases';
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
  selected: PremiumPlan;
  busy: PremiumAction;
  error: string | null;
  success: boolean;
  successLimit: number;
  active?: boolean;
  onClose: () => void;
  onConnect: () => void;
  onBuy: () => void;
  onRestore: () => void;
  onManage: () => void;
  onRefresh: () => void;
  onRetryOffer: () => void;
  onLegal: () => void;
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
 * Flagship Premium upgrade surface with LaunchSplash studio spotlight hero,
 * pure native UI (zero Reanimated worklet mount cost), and instant modal open.
 */
export const PremiumSurface = memo(function PremiumSurface(props: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, isVeryShort } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const { access, identity, accessLoading, configured, offer, selected, busy, success, successLimit, active = true } = props;
  const premium = access?.premium.active === true;
  const quotaExhausted = Boolean(access && !access.canAnalyze);
  const googleLinked = identity === 'google';
  const busyPrices = useDelayedBusy(props.offerLoading);
  const selectedPackage = offer?.[selected] ?? null;
  const dailyLimit = access?.allowances.premiumDaily;
  const canBuy = googleLinked && Boolean(access && selectedPackage && configured);
  const waitingForAccess = !access && accessLoading;
  const showPlans = !premium && !success;
  const busyLabel = busy === 'google'
    ? 'Conectez contul Google…'
    : busy === 'purchase'
      ? 'Confirmăm în Google Play…'
      : busy === 'restore'
        ? 'Caut abonamentul tău…'
        : 'Deschid Google Play…';

  return (
    <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
      <ComicBackdrop />
      <View style={[styles.header, { paddingHorizontal: gutter }]}>
        <Text style={styles.brand}>
          Profu’ de mate<Text style={styles.brandAccent}> / Premium</Text>
        </Text>
        <IconButton
          label="Închide Premium"
          disabled={Boolean(busy)}
          dimWhenDisabled={false}
          onPress={props.onClose}
          size={42}
        >
          <MiniGlyph name="close" size={19} color={colors.ink} />
        </IconButton>
      </View>

      <ScrollView
        scrollEnabled={!busy}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View collapsable={false} pointerEvents={busy ? 'none' : 'auto'}>
          <View style={{ paddingHorizontal: gutter }}>
            <View style={styles.heroShadow}>
              <LinearGradient
                colors={['#8D50FF', '#6222E6', '#4212B0']}
                start={{ x: 0.08, y: 0 }}
                end={{ x: 0.92, y: 1 }}
                style={[styles.hero, isVeryShort && styles.heroCompact]}
              >
                <View pointerEvents="none" style={styles.heroGlow} />
                <View pointerEvents="none" style={styles.heroShine} />
                <View style={styles.heroCopy}>
                  <Chip
                    label={success || premium ? 'PREMIUM ACTIV' : 'MAI MULTĂ PRACTICĂ'}
                    tone="lime"
                  />
                  <Text style={styles.heroTitle}>
                    {success ? 'Gata. Continuăm!' : premium ? 'Ai loc pentru\nmai multe idei.' : 'Mai mult loc\npentru „aha!”'}
                  </Text>
                  <Text style={styles.heroNote}>
                    {success
                      ? `Ai până la ${successLimit} de probleme pe zi.`
                      : dailyLimit
                        ? `Până la ${dailyLimit} de probleme pe zi, explicate pas cu pas.`
                        : 'Mai multă practică, cu explicații pas cu pas.'}
                  </Text>
                </View>
                <View pointerEvents="none" style={styles.art}>
                  <SpotlightAura size={126} tone="onViolet" active={active} />
                  <Mascot pose={success || premium ? 'cheer' : 'wave'} size={122} active={active} />
                </View>
              </LinearGradient>
            </View>
          </View>

          <View style={{ paddingHorizontal: gutter }}>
            <View style={styles.benefits}>
              {['Rezolvi', 'Verifici', 'Păstrezi în Caiet'].map((label) => (
                <View key={label} style={styles.benefit}>
                  <View style={styles.benefitCheck}>
                    <MiniGlyph name="check" size={11} color={colors.ink} />
                  </View>
                  <Text style={styles.benefitText}>{label}</Text>
                </View>
              ))}
            </View>

            {success ? (
              <View style={styles.activeSection}>
                <View style={styles.activeMark}><MiniGlyph name="check" size={28} color={colors.ink} /></View>
                <Text style={styles.sectionTitle}>Premium este activ.</Text>
                <Text style={styles.body}>Abonamentul este legat de contul tău. Revino la problemă când ești pregătit.</Text>
              </View>
            ) : premium ? (
              <View style={styles.activeSection}>
                <Chip label="SPAȚIUL TĂU DE AZI" tone="violetSoft" outlined={false} />
                <Text style={styles.quota}>{access.remaining}<Text style={styles.quotaTotal}> / {access.limit}</Text></Text>
                <Text style={styles.sectionTitle}>probleme disponibile</Text>
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

            {showPlans ? (
              <View style={styles.plansSection}>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>Alege ritmul tău.</Text>
                  <Chip label="PREMIUM" tone="violetSoft" outlined={false} />
                </View>
                <View accessibilityRole="radiogroup" accessibilityLabel="Planuri Premium" style={styles.plans}>
                  {(!offer || offer.annual) ? <PlanOption period="annual" plan={offer?.annual ?? null} selected={selected === 'annual'} disabled={Boolean(busy)} onSelect={() => props.onSelect('annual')} /> : null}
                  {(!offer || offer.monthly) ? <PlanOption period="monthly" plan={offer?.monthly ?? null} selected={selected === 'monthly'} disabled={Boolean(busy)} onSelect={() => props.onSelect('monthly')} /> : null}
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
                  ) : (
                    <Text style={styles.bodySmall}>Prețul și perioada sunt confirmate în Google Play înainte de plată.</Text>
                  )}
                </View>
              </View>
            ) : null}

            {!access && !success ? (
              <View style={styles.accountStatus}>
                <Text style={styles.bodySmall}>
                  {waitingForAccess ? 'Contul se actualizează în fundal. Poți explora Premium între timp.' : 'Limita de azi nu a putut fi verificată. Poți continua să explorezi aplicația.'}
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
              {!premium && !success ? (
                <Text style={styles.legalText}>
                  Abonamentul se reînnoiește automat. Îl poți anula din Google Play înainte de următoarea reînnoire. Prețul și perioada de facturare sunt confirmate înainte de plată.
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
        ) : premium ? (
          <ComicButton title={busy === 'manage' ? 'Deschid Google Play…' : 'Administrează abonamentul'} icon="settings" disabled={Boolean(busy)} onPress={props.onManage} compact />
        ) : identity === 'anonymous' ? (
          <GoogleAccountButton busy={busy === 'google'} disabled={Boolean(busy) && busy !== 'google'} note="Un cont pentru Caiet și abonament" onPress={props.onConnect} />
        ) : (
          <ComicButton
            title={
              busy === 'purchase'
                ? 'Confirmă în Google Play…'
                : canBuy && selectedPackage
                  ? `Alege Premium · ${selectedPackage.product.priceString}`
                  : !configured
                    ? 'Abonamente indisponibile'
                    : waitingForAccess
                      ? 'Actualizarea contului continuă…'
                      : 'Alege Premium'
            }
            icon="trophy"
            tone={!configured ? 'paper' : 'lime'}
            disabled={Boolean(busy) || !canBuy}
            onPress={props.onBuy}
            compact
          />
        )}
        {googleLinked && configured && !success ? (
          <Pressable accessibilityRole="button" disabled={Boolean(busy) || !access} onPress={props.onRestore} style={styles.restore}>
            <Text style={styles.restoreText}>{busy === 'restore' ? 'Caut achiziția…' : 'Restaurează achizițiile'}</Text>
          </Pressable>
        ) : !success && !premium ? (
          <Text style={styles.footerNote}>Continui gratuit oricând. Fără obligații.</Text>
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
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  brand: { flex: 1, fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  brandAccent: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.violetDeep },
  content: { paddingTop: 4, paddingBottom: 14 },

  heroShadow: {
    borderRadius: 30,
    elevation: 6,
    shadowColor: '#4B1FB8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  hero: {
    minHeight: 190,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroCompact: { minHeight: 168, paddingVertical: 14 },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -100,
    right: -45,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  heroShine: {
    position: 'absolute',
    top: 0,
    left: 26,
    right: 26,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
  },
  heroCopy: { flex: 1, minWidth: 0, zIndex: 1 },
  heroTitle: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.paper, marginTop: 10 },
  heroNote: { maxWidth: 230, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: 'rgba(244, 238, 255, 0.92)', marginTop: 7 },
  art: { width: 120, height: 136, justifyContent: 'center', alignItems: 'center', marginLeft: 4, position: 'relative' },

  benefits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124, 60, 255, 0.08)',
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6.5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  benefitCheck: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12 },
  resetTimerWrap: { marginTop: 14 },
  activeTimer: { width: '100%', marginTop: 6 },

  plansSection: { paddingTop: 16 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 23, lineHeight: 27, color: colors.ink },
  plans: { gap: 10 },
  plan: {
    minHeight: 78,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.11)',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  planSelected: {
    backgroundColor: '#F4EEFF',
    borderWidth: 1.75,
    borderColor: colors.violet,
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

  activeSection: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  activeMark: {
    width: 60,
    height: 60,
    borderRadius: 22,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quota: { fontFamily: fonts.display, fontSize: 60, color: colors.violetDeep },
  quotaTotal: { fontSize: 29, color: colors.inkSoft },
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
