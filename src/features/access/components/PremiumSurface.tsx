import { bundledImageSource } from '../../../shared/services/bundledImages';
import { StatusBar } from 'expo-status-bar';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PurchasesPackage } from 'react-native-purchases';
import { useDelayedBusy } from '../../../shared/hooks/useDelayedBusy';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { colors, fonts } from '../../../shared/theme';
import type { CommercialAccess } from '../../../shared/types';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { Text } from '../../../shared/ui/Typography';
import { GoogleAccountButton } from '../../account/components/GoogleAccountButton';
import type { PremiumOffer } from '../services/purchases';

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
      onPress={onSelect}
      style={({ pressed }) => [styles.plan, selected && styles.planSelected, pressed && styles.pressed]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <MiniGlyph name="check" size={13} color={colors.paper} /> : null}
      </View>
      <View style={styles.planCopy}>
        <Text style={styles.planTitle}>{annual ? 'Anual' : 'Lunar'}</Text>
        <Text style={styles.planNote}>{annual
          ? plan?.product.pricePerMonthString ? `${plan.product.pricePerMonthString} / lună, facturat anual` : 'Un an întreg de practică'
          : 'Se reînnoiește lunar'}</Text>
      </View>
      <View style={styles.priceCopy}>
        <Text style={[styles.price, !plan && styles.pricePending]}>{plan?.product.priceString ?? 'Preț în Google Play'}</Text>
        {plan ? <Text style={styles.planPeriod}>{annual ? '/ an' : '/ lună'}</Text> : null}
      </View>
    </Pressable>
  );
}

export function PremiumSurface(props: Props) {
  const { gutter, isVeryShort } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { access, identity, accessLoading, configured, offer, selected, busy, success, successLimit } = props;
  const premium = access?.premium.active === true;
  const googleLinked = identity === 'google';
  const busyPrices = useDelayedBusy(props.offerLoading);
  const selectedPackage = offer?.[selected] ?? null;
  const dailyLimit = access?.allowances.premiumDaily;
  const canBuy = googleLinked && Boolean(access && selectedPackage && configured);
  const waitingForAccess = !access && accessLoading;
  const showPlans = !premium && !success;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingHorizontal: gutter }]}>
        <Text style={styles.brand}>Profu’ de mate<Text style={styles.brandAccent}> / Premium</Text></Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide Premium" disabled={Boolean(busy)} onPress={props.onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <MiniGlyph name="close" size={21} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.hero, { paddingHorizontal: gutter }, isVeryShort && styles.heroCompact]}>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>{success || premium ? 'PROFU’ PREMIUM · ACTIV' : 'MAI MULTĂ PRACTICĂ. MAI MULTE IDEI.'}</Text>
            <Text style={styles.heroTitle}>{success ? 'Gata. Continuăm!' : premium ? 'Ai loc pentru\nmai multe idei.' : 'Mai mult loc\npentru „aha!”'}</Text>
            <Text style={styles.heroNote}>{success ? `Ai până la ${successLimit} de probleme pe zi.` : dailyLimit ? `Până la ${dailyLimit} de probleme pe zi, explicate pas cu pas.` : 'Mai multă practică, cu explicații pas cu pas.'}</Text>
          </View>
          <View pointerEvents="none" style={styles.art}>
            <View style={styles.artHalo} />
            <Image accessible={false} source={bundledImageSource(require('../../../../assets/profu_mascot_v2.png'))} style={styles.mascot} resizeMode="contain" />
            <View style={styles.artSpark}><MiniGlyph name="spark" size={19} color={colors.ink} /></View>
          </View>
        </View>

        <View style={{ paddingHorizontal: gutter }}>
          <View style={styles.benefits}>
            {['Rezolvi', 'Verifici', 'Păstrezi în Caiet'].map((label) => (
              <View key={label} style={styles.benefit}><MiniGlyph name="check" size={14} color={colors.violetDeep} /><Text style={styles.benefitText}>{label}</Text></View>
            ))}
          </View>

          {success ? (
            <View style={styles.activeSection}>
              <View style={styles.activeMark}><MiniGlyph name="check" size={28} color={colors.violetDeep} /></View>
              <Text style={styles.sectionTitle}>Premium este activ.</Text>
              <Text style={styles.body}>Abonamentul este legat de contul tău. Revino la problemă când ești pregătit.</Text>
            </View>
          ) : premium ? (
            <View style={styles.activeSection}>
              <Text style={styles.sectionEyebrow}>SPAȚIUL TĂU DE AZI</Text>
              <Text style={styles.quota}>{access.remaining}<Text style={styles.quotaTotal}> / {access.limit}</Text></Text>
              <Text style={styles.sectionTitle}>probleme disponibile</Text>
              <Text style={styles.body}>Limita se reînnoiește la miezul nopții. Abonamentul se administrează din Google Play.</Text>
            </View>
          ) : null}

          {props.canContinue && !success ? (
            <View style={styles.continueRow}>
              <View style={styles.continueCopy}><Text style={styles.continueTitle}>Ai probleme disponibile.</Text><Text style={styles.bodySmall}>Poți reveni la problema ta.</Text></View>
              <Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={props.onClose} style={styles.continueButton}><Text style={styles.continueLabel}>Continuă</Text></Pressable>
            </View>
          ) : null}

          {showPlans ? (
            <View style={styles.plansSection}>
              <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Alege ritmul tău.</Text><Text style={styles.sectionEyebrow}>PREMIUM</Text></View>
              <View accessibilityRole="radiogroup" accessibilityLabel="Planuri Premium" style={styles.plans}>
                {(!offer || offer.annual) ? <PlanOption period="annual" plan={offer?.annual ?? null} selected={selected === 'annual'} disabled={Boolean(busy)} onSelect={() => props.onSelect('annual')} /> : null}
                {(!offer || offer.monthly) ? <PlanOption period="monthly" plan={offer?.monthly ?? null} selected={selected === 'monthly'} disabled={Boolean(busy)} onSelect={() => props.onSelect('monthly')} /> : null}
              </View>
              <View style={styles.offerStatus} accessibilityLiveRegion="polite">
                {!configured ? <Text style={styles.bodySmall}>Abonamentele nu sunt disponibile momentan. Varianta gratuită rămâne disponibilă.</Text>
                  : props.offerError ? <><Text style={styles.bodySmall}>{props.offerError}</Text><Pressable accessibilityRole="button" onPress={props.onRetryOffer} disabled={Boolean(busy)} style={styles.textAction}><Text style={styles.link}>Reîncearcă încărcarea prețurilor</Text></Pressable></>
                    : busyPrices ? <Text style={styles.bodySmall}>Actualizez prețurile din Google Play…</Text>
                      : !googleLinked ? <Text style={styles.bodySmall}>Conectează contul pentru prețurile disponibile în Google Play.</Text>
                        : <Text style={styles.bodySmall}>Prețul și perioada sunt confirmate în Google Play înainte de plată.</Text>}
              </View>
            </View>
          ) : null}

          {!access && !success ? (
            <View style={styles.accountStatus}>
              <Text style={styles.bodySmall}>{waitingForAccess ? 'Contul se actualizează în fundal. Poți explora Premium între timp.' : 'Limita de azi nu a putut fi verificată. Poți continua să explorezi aplicația.'}</Text>
              {!waitingForAccess ? <Pressable accessibilityRole="button" onPress={props.onRefresh} disabled={Boolean(busy)} style={styles.textAction}><Text style={styles.link}>Reîncearcă verificarea</Text></Pressable> : null}
            </View>
          ) : null}

          {props.error ? <Text accessibilityRole="alert" style={styles.error}>{props.error}</Text> : null}
          <View style={styles.legal}>
            {!premium && !success ? <Text style={styles.legalText}>Abonamentul se reînnoiește automat. Îl poți anula din Google Play înainte de următoarea reînnoire. Prețul și perioada de facturare sunt confirmate înainte de plată.</Text> : null}
            <Pressable accessibilityRole="link" onPress={props.onLegal} style={styles.textAction}><Text style={styles.legalLink}>Termeni și confidențialitate</Text></Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 12) }]}>
        {success ? <ComicButton title="Înapoi la matematică" icon="scan" onPress={props.onClose} compact />
          : premium ? <ComicButton title={busy === 'manage' ? 'Deschid Google Play…' : 'Administrează abonamentul'} icon="settings" disabled={Boolean(busy)} onPress={props.onManage} compact />
            : identity === 'anonymous' ? <GoogleAccountButton busy={busy === 'google'} disabled={Boolean(busy) && busy !== 'google'} note="Un cont pentru Caiet și abonament" onPress={props.onConnect} />
              : <ComicButton title={busy === 'purchase' ? 'Confirmă în Google Play…' : canBuy && selectedPackage ? `Alege Premium · ${selectedPackage.product.priceString}` : !configured ? 'Abonamente indisponibile' : waitingForAccess ? 'Actualizarea contului continuă…' : 'Alege Premium'} icon="trophy" disabled={Boolean(busy) || !canBuy} onPress={props.onBuy} compact />}
        {googleLinked && configured && !success ? <Pressable accessibilityRole="button" disabled={Boolean(busy) || !access} onPress={props.onRestore} style={styles.restore}><Text style={styles.restoreText}>{busy === 'restore' ? 'Caut achiziția…' : 'Restaurează achizițiile'}</Text></Pressable> : !success && !premium ? <Text style={styles.footerNote}>Continui gratuit oricând. Fără obligații.</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  brand: { flex: 1, fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  brandAccent: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.violetDeep },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.violetSoft },
  content: { paddingBottom: 10 },
  hero: { minHeight: 193, backgroundColor: colors.violetDeep, paddingVertical: 23, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  heroCompact: { minHeight: 174, paddingVertical: 18 },
  heroCopy: { flex: 1, minWidth: 0, zIndex: 1 },
  kicker: { maxWidth: 230, fontFamily: fonts.bodyBold, fontSize: 8, letterSpacing: 1, lineHeight: 12, color: colors.lime },
  heroTitle: { fontFamily: fonts.display, fontSize: 32, lineHeight: 35, color: colors.paper, marginTop: 9 },
  heroNote: { maxWidth: 230, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: '#EEE7FF', marginTop: 9 },
  art: { width: 100, height: 150, justifyContent: 'center', alignItems: 'center', marginLeft: 2 },
  artHalo: { position: 'absolute', width: 112, height: 112, borderRadius: 56, backgroundColor: '#6635CC' },
  mascot: { width: 132, height: 152, transform: [{ rotate: '5deg' }] },
  artSpark: { position: 'absolute', bottom: 0, right: -2, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  benefits: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 9, paddingVertical: 19, borderBottomWidth: 1, borderBottomColor: colors.line },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  benefitText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 10.5 },
  plansSection: { paddingTop: 19 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 13 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 23, lineHeight: 28, color: colors.ink },
  sectionEyebrow: { fontFamily: fonts.bodyBold, fontSize: 8, letterSpacing: 1, color: colors.violetDeep },
  plans: { gap: 9 },
  plan: { minHeight: 76, padding: 12, borderWidth: 1.5, borderColor: colors.line, borderRadius: 17, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: 10 },
  planSelected: { backgroundColor: '#F1EAFF', borderColor: colors.violetDeep },
  radio: { width: 21, height: 21, borderRadius: 11, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.violetDeep, backgroundColor: colors.violetDeep },
  planCopy: { flex: 1, minWidth: 0 },
  planTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  planNote: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: colors.inkSoft, marginTop: 2 },
  priceCopy: { maxWidth: '42%', alignItems: 'flex-end' },
  price: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink, textAlign: 'right' },
  pricePending: { fontSize: 10.5, lineHeight: 15, color: colors.inkSoft, maxWidth: 79 },
  planPeriod: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: colors.inkSoft, marginTop: 2 },
  offerStatus: { minHeight: 46, paddingTop: 11 },
  body: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  bodySmall: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 11.5, lineHeight: 16 },
  accountStatus: { paddingTop: 12 },
  textAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 12 },
  legal: { paddingTop: 15 },
  legalText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 10, lineHeight: 15 },
  legalLink: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 11 },
  footer: { paddingTop: 11, backgroundColor: colors.canvas, borderTopWidth: 1, borderTopColor: colors.line },
  footerNote: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 10.5, textAlign: 'center', marginTop: 5 },
  restore: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  restoreText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 12 },
  activeSection: { alignItems: 'center', gap: 10, paddingVertical: 25 },
  activeMark: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.limeSoft, alignItems: 'center', justifyContent: 'center' },
  quota: { fontFamily: fonts.display, fontSize: 60, color: colors.violetDeep },
  quotaTotal: { fontSize: 29, color: colors.inkSoft },
  continueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.line },
  continueCopy: { flex: 1 },
  continueTitle: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  continueButton: { minHeight: 44, paddingHorizontal: 15, borderRadius: 14, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  continueLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  error: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: '#A92D46', paddingTop: 14 },
  pressed: { opacity: 0.85 },
});
