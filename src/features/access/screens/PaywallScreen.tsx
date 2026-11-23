import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Linking } from 'react-native';
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
import { useTransitionMotion } from '../../../shared/context/TransitionMotionContext';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useTransitionSettled } from '../../../shared/hooks/useTransitionSettled';
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
  const { authSessionKey, access: contextAccess, identity: sessionIdentity, loading: accessLoading, identityTransitionBusy, refresh, connectGoogle, applyServerAccess } = useCommercial();
  const [initialSessionKey] = useState(() => authSessionKey);
  const [allowRouteAccessFallback, setAllowRouteAccessFallback] = useState(true);
  // Route data makes the first paint immediate, but it belongs to the identity
  // that opened this screen. Never reuse it after a Google identity operation.
  const allowRouteAccess = allowRouteAccessFallback && authSessionKey === initialSessionKey;
  const candidateAccess = contextAccess ?? (allowRouteAccess ? route.params.access : null) ?? null;
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
  const activeBusy: PremiumAction = busy ?? (identityTransitionBusy ? 'google' : null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successLimit, setSuccessLimit] = useState(30);
  const [screenFocused, setScreenFocused] = useState(() => navigation.isFocused?.() ?? true);
  const reducedMotion = useReducedMotion();
  const { isTransitioning } = useTransitionMotion(screenFocused && !reducedMotion);
  const transitionSettled = useTransitionSettled(navigation, reducedMotion);
  const ambientActive = screenFocused && transitionSettled && !isTransitioning;
  const identity = sessionIdentity ?? access?.identity ?? null;
  const googleLinked = identity === 'google';
  const premium = access?.premium.active === true;
  const purchaseUserId = access?.purchaseUserId;

  useEffect(() => {
    const onFocus = navigation.addListener?.('focus', () => setScreenFocused(true));
    const onBlur = navigation.addListener?.('blur', () => setScreenFocused(false));
    return () => {
      onFocus?.();
      onBlur?.();
    };
  }, [navigation]);

  useEffect(() => {
    navigation.setOptions?.({ gestureEnabled: !activeBusy });
  }, [activeBusy, navigation]);

  useEffect(() => {
    if (!activeBusy) return undefined;
    const subscription = BackHandler?.addEventListener?.('hardwareBackPress', () => true);
    const removeUnsubscribe = navigation.addListener?.('beforeRemove', (event) => {
      if (event.data.action.type !== 'RESET') {
        event.preventDefault();
      }
    });
    return () => {
      subscription?.remove();
      removeUnsubscribe?.();
    };
  }, [activeBusy, navigation]);

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
    if (!ambientActive) return undefined;
    if (access?.purchaseUserId && googleLinked && !premium && isPurchasesConfigured()) void offerTask.run();
    return () => offerTask.cancel();
  }, [ambientActive, googleLinked, premium, access?.purchaseUserId, offerTask]);

  const connect = async () => {
    if (activeBusy) return;
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
    if (activeBusy || !plan || !access || !googleLinked) return;
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
    if (activeBusy) return;
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
    if (activeBusy) return;
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
      busy={activeBusy}
      error={error}
      success={success}
      successLimit={successLimit}
      active={ambientActive}
      onClose={() => { if (!activeBusy) navigation.goBack(); }}
      onConnect={() => void connect()}
      onBuy={() => void buy()}
      onRestore={() => void restore()}
      onManage={() => void manage()}
      onRefresh={() => { if (!activeBusy) void refresh(); }}
      onRetryOffer={() => { if (!activeBusy) void offerTask.run(); }}
      onLegal={() => { if (!activeBusy) navigation.navigate('Legal'); }}
      onSelect={(plan) => { if (!activeBusy) setSelected(plan); }}
    />
  );
}
