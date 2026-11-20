import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import { useCommercial } from '../context/CommercialContext';
import { PremiumSurface, type PremiumAction } from '../components/PremiumSurface';
import {
  getCachedPremiumOffer,
  getPremiumOffer,
  getSubscriptionManagementUrl,
  isPurchaseCancellation,
  isPurchasesConfigured,
  purchaseErrorCopy,
  purchasePremium,
  restorePremium,
  type PremiumOffer,
} from '../services/purchases';
import type { RootStackParamList } from '../../../shared/types';
import { createLatestTask, type TaskState } from '../../../shared/utils/latestTask';
import { assertSessionActive, captureSession } from '../../../shared/services/sessionGuard';
import { isCommercialAccessExpired } from '../services/commercialRefreshPolicy';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;
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
  const { access: contextAccess, identity: sessionIdentity, loading: accessLoading, refresh, connectGoogle, applyServerAccess } = useCommercial();
  const [allowRouteAccessFallback, setAllowRouteAccessFallback] = useState(true);
  // Route data makes the first paint immediate, but it belongs to the identity
  // that opened this screen. Never reuse it after a Google identity operation.
  const candidateAccess = contextAccess ?? (allowRouteAccessFallback ? route.params.access : null) ?? null;
  // The provider triggers expiry renders. Read the clock here as a conservative
  // display guard: deferring this check to an effect would flash yesterday's quota.
  // eslint-disable-next-line react-hooks/purity
  const access = isCommercialAccessExpired(candidateAccess, Date.now()) ? null : candidateAccess;
  const canContinue = route.params.source === 'quota' && access === contextAccess && access?.canAnalyze === true;
  const [offerState, setOfferState] = useState<TaskState<PremiumOffer> | null>(() => {
    const cached = getCachedPremiumOffer();
    return cached ? { status: 'ready', value: cached } : null;
  });
  const offer = offerState?.status === 'ready' ? offerState.value : getCachedPremiumOffer();
  const [selected, setSelected] = useState<'annual' | 'monthly'>('annual');
  const selectedPlan = offer && !offer[selected] ? offer.annual ? 'annual' : 'monthly' : selected;
  const [busy, setBusy] = useState<PremiumAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successLimit, setSuccessLimit] = useState(30);
  const identity = sessionIdentity ?? access?.identity ?? null;
  const googleLinked = identity === 'google';
  const premium = access?.premium.active === true;
  const purchaseUserId = access?.purchaseUserId;

  const offerTask = useMemo(() => createLatestTask(
    async () => {
      const session = captureSession();
      const result = await getPremiumOffer({ purchaseUserId });
      assertSessionActive(session);
      return result;
    },
    setOfferState,
    15_000,
    'Google Play nu este disponibil momentan. Verifică internetul și încearcă din nou.',
  ), [purchaseUserId]);

  useEffect(() => {
    const cached = getCachedPremiumOffer();
    setOfferState(cached ? { status: 'ready', value: cached } : null);
    if (access?.purchaseUserId && googleLinked && !premium && isPurchasesConfigured()) void offerTask.run();
    return () => offerTask.cancel();
  }, [googleLinked, premium, access?.purchaseUserId, offerTask]);

  const connect = async () => {
    if (busy) return;
    setAllowRouteAccessFallback(false);
    setBusy('google');
    setError(null);
    try {
      await connectGoogle();
    } catch (connectError) {
      setError(friendlyPurchaseError(connectError));
    } finally {
      setBusy(null);
    }
  };

  const buy = async () => {
    const plan = offer?.[selectedPlan];
    if (busy || !plan || !access || !googleLinked) return;
    setBusy('purchase');
    setError(null);
    try {
      const session = captureSession();
      const next = await purchasePremium(plan);
      assertSessionActive(session);
      setSuccessLimit(next.limit);
      applyServerAccess(next);
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
      const session = captureSession();
      const next = await restorePremium();
      assertSessionActive(session);
      applyServerAccess(next);
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
      const url = isPurchasesConfigured() ? await getSubscriptionManagementUrl() : 'https://play.google.com/store/account/subscriptions';
      if (!url) throw new Error('Pagina abonamentului nu este disponibilă.');
      await Linking.openURL(url);
    } catch (manageError) {
      setError(friendlyPurchaseError(manageError));
    } finally {
      setBusy(null);
    }
  };

  return (
    <PremiumSurface
      access={access}
      identity={identity}
      accessLoading={accessLoading}
      configured={isPurchasesConfigured()}
      canContinue={canContinue}
      offer={offer}
      offerLoading={offerState?.status === 'loading'}
      offerError={offerState?.status === 'error' ? friendlyPurchaseError(offerState.error) : null}
      selected={selectedPlan}
      busy={busy}
      error={error}
      success={success}
      successLimit={successLimit}
      onClose={() => navigation.goBack()}
      onConnect={() => void connect()}
      onBuy={() => void buy()}
      onRestore={() => void restore()}
      onManage={() => void manage()}
      onRefresh={() => void refresh()}
      onRetryOffer={() => void offerTask.run()}
      onLegal={() => navigation.navigate('Legal')}
      onSelect={setSelected}
    />
  );
}
