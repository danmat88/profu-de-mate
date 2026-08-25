import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PurchasesPackage } from 'react-native-purchases';
import { AppIcon } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { ComicButton } from '../components/ComicButton';
import { GoogleAccountButton } from '../components/GoogleAccountButton';
import { MiniGlyph } from '../components/MiniGlyph';
import { PlayfulLoader } from '../components/PlayfulLoader';
import { Text } from '../components/Typography';
import { useCommercial } from '../context/CommercialContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import {
  getPremiumOffer,
  getSubscriptionManagementUrl,
  isPurchaseCancellation,
  isPurchasesConfigured,
  purchaseErrorCopy,
  purchasePremium,
  restorePremium,
  type PremiumOffer,
} from '../services/purchases';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;
type BusyAction = 'google' | 'purchase' | 'restore' | 'manage' | null;

function friendlyPurchaseError(error: unknown): string {
  const mapped = purchaseErrorCopy(error);
  if (mapped) return mapped;
  const message = error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : '';
  if (message.includes('configurat')
    || message.includes('disponibilă')
    || message.includes('a înregistrat plata')
    || message.includes('Plata a fost înregistrată')) return message;
  return 'Nu am putut finaliza acțiunea. Verifică internetul și încearcă din nou.';
}

export function PaywallScreen({ navigation, route }: Props) {
  const { gutter } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { access: contextAccess, loading: accessLoading, connectGoogle, refresh } = useCommercial();
  const access = contextAccess ?? route.params.access ?? null;
  const [offer, setOffer] = useState<PremiumOffer | null>(null);
  const [selected, setSelected] = useState<'annual' | 'monthly'>('annual');
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successLimit, setSuccessLimit] = useState(30);
  const [freeUnlocked, setFreeUnlocked] = useState(false);
  const googleLinked = access?.identity === 'google';
  const premium = access?.premium.active === true;
  const freeDailyLimit = access?.allowances.freeDaily ?? 5;
  const premiumDailyLimit = access?.allowances.premiumDaily ?? 30;

  const loadOffer = useCallback(async () => {
    if (!googleLinked || premium || !isPurchasesConfigured()) return;
    try {
      setOffer(await getPremiumOffer());
    } catch (offerError) {
      setError(friendlyPurchaseError(offerError));
    }
  }, [googleLinked, premium]);

  useEffect(() => { void loadOffer(); }, [loadOffer]);

  const connect = async () => {
    if (busy) return;
    setBusy('google');
    setError(null);
    try {
      const connected = await connectGoogle();
      if (connected) {
        const next = await refresh();
        setFreeUnlocked(Boolean(next?.canAnalyze && route.params.source === 'quota'));
      }
    } catch (connectError) {
      setError(friendlyPurchaseError(connectError));
    } finally {
      setBusy(null);
    }
  };

  const buy = async () => {
    if (busy || !offer) return;
    setBusy('purchase');
    setError(null);
    const plan: PurchasesPackage = selected === 'annual' ? offer.annual : offer.monthly;
    try {
      const next = await purchasePremium(plan);
      setSuccessLimit(next.limit);
      await refresh();
      setSuccess(true);
    } catch (purchaseError) {
      if (!isPurchaseCancellation(purchaseError)) setError(friendlyPurchaseError(purchaseError));
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    if (busy) return;
    setBusy('restore');
    setError(null);
    try {
      const next = await restorePremium();
      await refresh();
      if (next.premium.active) {
        setSuccessLimit(next.limit);
        setSuccess(true);
      }
      else setError('Nu am găsit un abonament Premium activ pentru acest cont Google Play.');
    } catch (restoreError) {
      setError(friendlyPurchaseError(restoreError));
    } finally {
      setBusy(null);
    }
  };

  const manage = async () => {
    if (busy) return;
    setBusy('manage');
    setError(null);
    try {
      const url = await getSubscriptionManagementUrl();
      if (!url) throw new Error('Pagina abonamentului nu este disponibilă.');
      await Linking.openURL(url);
    } catch (manageError) {
      setError(friendlyPurchaseError(manageError));
    } finally {
      setBusy(null);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ComicBackdrop />
        <View style={[styles.successPage, { paddingHorizontal: gutter }]}>
          <View style={styles.successIcon}><AppIcon name="trophy" size={92} /></View>
          <Text style={styles.successKicker}>PREMIUM ESTE ACTIV</Text>
          <Text style={styles.successTitle}>Ai mai mult loc pentru idei.</Text>
          <Text style={styles.successText}>Poți continua cu până la {successLimit} de probleme pe zi. Caietul și abonamentul rămân legate de contul tău.</Text>
          <ComicButton title="Continuă cu Profu’" subtitle="Înapoi la matematică." icon="scan" tone="lime" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <View style={[styles.top, { paddingHorizontal: gutter }]}>
        <View>
          <Text style={styles.brand}>Profu’ de mate</Text>
          <Text style={styles.brandNote}>{premium ? 'ABONAMENTUL TĂU' : 'MAI MULT TIMP PENTRU EXERSAT'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide" onPress={() => navigation.goBack()} style={styles.close}>
          <MiniGlyph name="close" size={20} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 14) + 18 }]}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><AppIcon name={premium ? 'trophy' : 'streak'} size={78} /></View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>{premium ? 'PROFU’ PREMIUM' : 'ÎNVAȚĂ ÎN RITMUL TĂU'}</Text>
            <Text style={styles.heroTitle}>{premium ? 'Premium este activ.' : 'Mai multe probleme. Aceeași explicație atentă.'}</Text>
            <Text style={styles.heroText}>{premium ? 'Abonamentul tău este legat de contul Google și poate fi administrat în Google Play.' : 'Varianta gratuită rămâne disponibilă. Premium îți oferă o limită zilnică mai mare, fără reclame și fără pachete de credite.'}</Text>
          </View>
        </View>

        {accessLoading && !access ? (
          <View style={styles.accessLoading}>
            <View style={styles.accessLoadingIcon}><AppIcon name="profile" size={48} /></View>
            <PlayfulLoader label="Verific accesul tău" note="Caietul rămâne pe loc cât verificăm contul și limita de azi." />
          </View>
        ) : premium ? (
          <>
            <View style={styles.allowanceLine}>
              <Text style={styles.allowanceValue}>{access?.remaining ?? 0}</Text>
              <View style={styles.allowanceCopy}><Text style={styles.allowanceTitle}>probleme disponibile azi</Text><Text style={styles.allowanceText}>Limita se reînnoiește automat la miezul nopții.</Text></View>
            </View>
            <ComicButton title={busy === 'manage' ? 'Deschid Google Play…' : 'Administrează abonamentul'} subtitle="Schimbi planul sau oprești reînnoirea din Google Play." icon="settings" tone="paper" disabled={Boolean(busy)} onPress={() => void manage()} />
          </>
        ) : !googleLinked ? (
          <View style={styles.googleStep}>
            <View style={styles.stepHeading}>
              <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
              <View style={styles.stepHeadingCopy}>
                <Text style={styles.stepKicker}>ÎNAINTE DE PREMIUM</Text>
                <Text style={styles.stepTitle}>Păstrează ce ai lucrat.</Text>
              </View>
            </View>
            <Text style={styles.stepText}>Conectarea leagă lecțiile și abonamentul de contul tău. Primești {freeDailyLimit} probleme gratuite în fiecare zi, inclusiv după reinstalare.</Text>
            <View style={styles.accountPath}>
              <View style={styles.accountPathItem}><AppIcon name="notebook" size={34} /><Text style={styles.accountPathText}>Caietul tău</Text></View>
              <View style={styles.accountPathLine}><MiniGlyph name="next" size={14} color={colors.violetDeep} /></View>
              <View style={styles.accountPathItem}><AppIcon name="streak" size={34} /><Text style={styles.accountPathText}>Limita zilnică</Text></View>
              <View style={styles.accountPathLine}><MiniGlyph name="next" size={14} color={colors.violetDeep} /></View>
              <View style={styles.accountPathItem}><AppIcon name="trophy" size={34} /><Text style={styles.accountPathText}>Premium</Text></View>
            </View>
            <GoogleAccountButton
              busy={busy === 'google'}
              disabled={Boolean(busy) && busy !== 'google'}
              note="Un singur cont pentru Caiet, limită și abonament"
              onPress={() => void connect()}
              style={styles.googleButton}
            />
            <Text style={styles.googleNote}>Nu publicăm nimic și nu cerem acces la fișierele tale Google.</Text>
          </View>
        ) : (
          <>
            {freeUnlocked ? (
              <View style={styles.freeUnlocked}>
                <View style={styles.freeCheck}><MiniGlyph name="check" size={20} color={colors.ink} /></View>
                <View style={styles.freeCopy}><Text style={styles.freeTitle}>Ai deblocat problemele gratuite de azi.</Text><Text style={styles.freeText}>Poți continua acum fără să cumperi Premium.</Text></View>
                <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.freeButton}><Text style={styles.freeButtonText}>Continuă</Text></Pressable>
              </View>
            ) : null}

            <View style={styles.benefits}>
              {[
                [`Până la ${premiumDailyLimit} probleme pe zi`, 'O limită mare și cinstită, protejată împotriva folosirii automate.'],
                ['Rezolvare și verificare', 'Aceeași matematică atentă pentru ambele moduri.'],
                ['Caiet legat de cont', 'Lecțiile tale pot fi recuperate după reinstalare.'],
              ].map(([title, note], index) => (
                <View key={title} style={styles.benefit}>
                  <View style={[styles.benefitMark, index === 1 && styles.benefitPeach, index === 2 && styles.benefitCyan]}><MiniGlyph name="check" size={16} color={colors.ink} /></View>
                  <View style={styles.benefitCopy}><Text style={styles.benefitTitle}>{title}</Text><Text style={styles.benefitText}>{note}</Text></View>
                </View>
              ))}
            </View>

            {offer ? (
              <View style={styles.plans}>
                <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected === 'annual' }} onPress={() => setSelected('annual')} style={[styles.plan, selected === 'annual' && styles.planSelected]}>
                  <View style={styles.bestBadge}><Text style={styles.bestBadgeText}>RECOMANDAT</Text></View>
                  <View style={styles.radio}>{selected === 'annual' ? <View style={styles.radioDot} /> : null}</View>
                  <View style={styles.planCopy}><Text style={styles.planTitle}>Anual</Text><Text style={styles.planNote}>{offer.annual.product.pricePerMonthString ? `Aproximativ ${offer.annual.product.pricePerMonthString} pe lună` : 'Un singur abonament pentru tot anul'}</Text></View>
                  <Text style={styles.planPrice}>{offer.annual.product.priceString}<Text style={styles.planPeriod}> / an</Text></Text>
                </Pressable>
                <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected === 'monthly' }} onPress={() => setSelected('monthly')} style={[styles.plan, selected === 'monthly' && styles.planSelected]}>
                  <View style={styles.radio}>{selected === 'monthly' ? <View style={styles.radioDot} /> : null}</View>
                  <View style={styles.planCopy}><Text style={styles.planTitle}>Lunar</Text><Text style={styles.planNote}>Flexibil, se reînnoiește lunar</Text></View>
                  <Text style={styles.planPrice}>{offer.monthly.product.priceString}<Text style={styles.planPeriod}> / lună</Text></Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.offerLoading}>
                {isPurchasesConfigured()
                  ? <PlayfulLoader compact label="Aduc prețurile din Google Play" />
                  : <><MiniGlyph name="spark" size={20} color={colors.violetDeep} /><Text style={styles.offerLoadingText}>Plățile vor deveni disponibile în buildul conectat la Google Play.</Text></>}
              </View>
            )}

            <ComicButton title={busy === 'purchase' ? 'Finalizez în Google Play…' : 'Alege Premium'} subtitle={selected === 'annual' ? 'Plan anual. Plata este procesată de Google Play.' : 'Plan lunar. Plata este procesată de Google Play.'} icon="trophy" tone="lime" disabled={Boolean(busy) || !offer} onPress={() => void buy()} />
            <Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={() => void restore()} style={styles.restore}>
              {busy === 'restore' ? <PlayfulLoader compact /> : null}
              <Text style={styles.restoreText}>{busy === 'restore' ? 'Caut achiziția…' : 'Restaurează achizițiile'}</Text>
            </Pressable>
            <Text style={styles.renewal}>Abonamentul se reînnoiește automat dacă nu îl oprești din Google Play înainte de sfârșitul perioadei curente. Prețul final și perioada sunt afișate de Google Play înainte să confirmi plata.</Text>
            <Pressable accessibilityRole="link" onPress={() => navigation.navigate('Legal')}><Text style={styles.legalLink}>Confidențialitate, termeni și siguranță</Text></Pressable>
          </>
        )}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  top: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: fonts.display, color: colors.ink, fontSize: 19 },
  brandNote: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 7.5, letterSpacing: 1.05 },
  close: { width: 48, height: 48, borderRadius: 16, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  content: { gap: 14 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 2, borderBottomColor: colors.line, paddingVertical: 14 },
  heroIcon: { width: 88, height: 88, borderRadius: 28, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.limeSoft, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  heroCopy: { flex: 1, minWidth: 0 },
  heroKicker: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.1 },
  heroTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 24, lineHeight: 27, marginTop: 3 },
  heroText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  accessLoading: { minHeight: 190, alignItems: 'center', justifyContent: 'center', borderTopWidth: 2, borderBottomWidth: 2, borderColor: colors.line, paddingVertical: 20 },
  accessLoadingIcon: { width: 62, height: 62, marginBottom: 13, borderRadius: 21, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.cyan, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  googleStep: { marginTop: 3, borderTopWidth: 2, borderBottomWidth: 2, borderColor: colors.line, paddingVertical: 17 },
  stepHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  stepBadge: { width: 45, height: 45, borderRadius: 15, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  stepBadgeText: { fontFamily: fonts.display, color: colors.ink, fontSize: 23 },
  stepHeadingCopy: { flex: 1 },
  stepKicker: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.2 },
  stepTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 23, lineHeight: 27, marginTop: 1 },
  stepText: { maxWidth: 390, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 18, marginTop: 9 },
  accountPath: { minHeight: 69, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  accountPathItem: { flex: 1, minWidth: 0, alignItems: 'center', gap: 1 },
  accountPathText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 8.5, textAlign: 'center' },
  accountPathLine: { width: 22, alignItems: 'center', justifyContent: 'center', opacity: 0.7 },
  googleButton: { width: '100%', marginTop: 12 },
  googleNote: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 11, lineHeight: 15, textAlign: 'center', marginTop: 8 },
  pressed: { transform: [{ translateY: 2 }], opacity: 0.92 },
  disabled: { opacity: 0.6 },
  freeUnlocked: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 2, borderColor: colors.ink, borderRadius: 18, backgroundColor: colors.limeSoft, padding: 10 },
  freeCheck: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  freeCopy: { flex: 1 },
  freeTitle: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12.5 },
  freeText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 11.5, marginTop: 1 },
  freeButton: { minHeight: 42, borderRadius: 13, backgroundColor: colors.ink, justifyContent: 'center', paddingHorizontal: 12 },
  freeButtonText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 12 },
  benefits: { borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.line },
  benefit: { minHeight: 63, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 8 },
  benefitMark: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.lime, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  benefitPeach: { backgroundColor: colors.peach },
  benefitCyan: { backgroundColor: colors.cyan },
  benefitCopy: { flex: 1 },
  benefitTitle: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12.5 },
  benefitText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 11.5, lineHeight: 15, marginTop: 1 },
  plans: { gap: 8 },
  plan: { minHeight: 72, borderRadius: 20, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 11, paddingVertical: 9 },
  planSelected: { borderWidth: 3, borderColor: colors.violet, backgroundColor: colors.violetSoft },
  bestBadge: { position: 'absolute', right: 10, top: -8, borderRadius: 8, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.lime, paddingHorizontal: 7, paddingVertical: 2 },
  bestBadgeText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 7, letterSpacing: 0.7 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.violet },
  planCopy: { flex: 1, minWidth: 0 },
  planTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 16 },
  planNote: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 10.5, lineHeight: 14, marginTop: 1 },
  planPrice: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 13, textAlign: 'right' },
  planPeriod: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 9.5 },
  offerLoading: { minHeight: 64, borderRadius: 18, backgroundColor: colors.violetSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 15 },
  offerLoadingText: { flex: 1, fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  restore: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  restoreText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 12.5 },
  renewal: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 10.5, lineHeight: 15, textAlign: 'center' },
  legalLink: { minHeight: 42, fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 11.5, textAlign: 'center', textDecorationLine: 'underline', paddingTop: 8 },
  error: { borderRadius: 14, backgroundColor: '#FFE1E5', padding: 11, fontFamily: fonts.bodyBold, color: '#9E2135', fontSize: 12, lineHeight: 16, textAlign: 'center' },
  allowanceLine: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 2, borderBottomWidth: 2, borderColor: colors.line },
  allowanceValue: { fontFamily: fonts.display, color: colors.violet, fontSize: 42 },
  allowanceCopy: { flex: 1 },
  allowanceTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 17 },
  allowanceText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12, marginTop: 2 },
  successPage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  successIcon: { width: 116, height: 116, borderRadius: 38, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }], marginBottom: 18 },
  successKicker: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 9, letterSpacing: 1.3 },
  successTitle: { maxWidth: 350, fontFamily: fonts.display, color: colors.ink, fontSize: 31, lineHeight: 34, textAlign: 'center', marginTop: 4 },
  successText: { maxWidth: 340, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 8, marginBottom: 22 },
});
