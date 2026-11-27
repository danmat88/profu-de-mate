import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Linking } from 'react-native';
import { useCommercial } from '../context/CommercialContext';
import { PremiumSurface, type PlanTabId, type PremiumAction } from '../components/PremiumSurface';
import {
  getCachedPremiumOffer,
  getPremiumOffer,
  getSubscriptionManagementUrl,
  isPurchaseCancellation,
  isPurchasesConfigured,
  packagesForTier,
  purchaseErrorCopy,
  purchasePremium,
  restorePremium,
  type PremiumOffer,
} from '../services/purchases';
import type { CommercialAccess, PaidPlanTier, RootStackParamList } from '../../../shared/types';
import { beginAppTransition, useTransitionMotion } from '../../../shared/context/TransitionMotionContext';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useTransitionSettled } from '../../../shared/hooks/useTransitionSettled';
import { createLatestTask, type TaskState } from '../../../shared/utils/latestTask';
import { assertSessionActive, captureSession } from '../../../shared/services/sessionGuard';
import { isCommercialAccessExpired } from '../services/commercialRefreshPolicy';
import { friendlyGoogleConnectError, isGoogleSignInCancelledError } from '../services/googleAuthErrors';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

function friendlyPurchaseError(error: unknown): string {
  const mapped = purchaseErrorCopy(error);
  if (mapped) return mapped;
  const message = error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : '';
  if (message.includes('configurat')
    || message.includes('disponibil')
    || message.includes('întârzie')
    || message.includes('finalizează deja')
    || message.includes('nu este încă verificat')
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
  const activePaidTier: PaidPlanTier | null = access?.premium.active ? (access.premium.tier ?? 'pro') : null;
  const [selectedTab, setSelectedTab] = useState<PlanTabId>(() => (activePaidTier === 'pro' || activePaidTier === 'max' ? 'max' : 'pro'));
  const selectedPaidTier: PaidPlanTier = selectedTab === 'max' ? 'max' : 'pro';
  const tierPackages = packagesForTier(offer, selectedPaidTier);
  const [selected, setSelected] = useState<'annual' | 'monthly'>('annual');
  const selectedPlan = (tierPackages.annual || tierPackages.monthly) && !tierPackages[selected]
    ? tierPackages.annual ? 'annual' : 'monthly'
    : selected;
  const [busy, setBusy] = useState<PremiumAction>(null);
  const activeBusy: PremiumAction = busy ?? (identityTransitionBusy ? 'google' : null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successLimit, setSuccessLimit] = useState(50);
  const [successTier, setSuccessTier] = useState<PaidPlanTier>('pro');
  const [screenFocused, setScreenFocused] = useState(() => navigation.isFocused?.() ?? true);
  const reducedMotion = useReducedMotion();
  const { isTransitioning } = useTransitionMotion(screenFocused && !reducedMotion);
  const transitionSettled = useTransitionSettled(navigation, reducedMotion);
  const ambientActive = screenFocused && transitionSettled && !isTransitioning;
  const identity = sessionIdentity ?? access?.identity ?? null;
  const googleLinked = identity === 'google';
  const maxActive = activePaidTier === 'max';
  const purchaseUserId = access?.purchaseUserId;

  useEffect(() => {
    setScreenFocused(navigation.isFocused?.() ?? true);
    const onFocus = navigation.addListener?.('focus', () => setScreenFocused(true));
    const onBlur = navigation.addListener?.('blur', () => setScreenFocused(false));
    const onTransitionEnd = navigation.addListener?.('transitionEnd', () => {
      setScreenFocused(navigation.isFocused?.() ?? true);
    });
    return () => {
      onFocus?.();
      onBlur?.();
      onTransitionEnd?.();
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

  // Load real Google Play prices for both signed-in users and guests (anonymous catalog).
  const offerTask = useMemo(() => createLatestTask(
    async () => {
      const session = captureSession();
      const result = await getPremiumOffer(
        googleLinked && purchaseUserId
          ? { purchaseUserId }
          : { allowAnonymousCatalog: true },
      );
      assertSessionActive(session);
      return result;
    },
    setOfferState,
    15_000,
    'Google Play nu este disponibil momentan. Verifică internetul și încearcă din nou.',
  ), [googleLinked, purchaseUserId]);

  useEffect(() => {
    const cached = getCachedPremiumOffer();
    setOfferState(cached ? { status: 'ready', value: cached } : null);
    if (!ambientActive) return undefined;
    if (!maxActive && isPurchasesConfigured() && (!googleLinked || Boolean(access?.purchaseUserId))) {
      void offerTask.run();
    }
    return () => offerTask.cancel();
  }, [ambientActive, googleLinked, maxActive, access?.purchaseUserId, offerTask]);

  // Seamless 1-tap purchase: if user is anonymous, connect Google first, then immediately launch Play billing.
  const buy = async () => {
    if (activeBusy || selectedTab === 'start' || !isPurchasesConfigured()) return;
    const targetTier: PaidPlanTier = selectedTab;
    setError(null);

    let effectiveAccess: CommercialAccess | null = access;
    let planToBuy = tierPackages[selectedPlan];

    if (!googleLinked) {
      setAllowRouteAccessFallback(false);
      setBusy('google');
      try {
        const connectedAccess = await connectGoogle();
        if (!connectedAccess || connectedAccess.identity !== 'google') {
          setBusy(null);
          return;
        }
        effectiveAccess = connectedAccess;
        // If this Google account already owns the chosen (or higher) tier, unlock immediately without charging again.
        const connectedTier = connectedAccess.premium.active ? (connectedAccess.premium.tier ?? 'pro') : null;
        if (connectedTier === 'max' || (connectedTier === 'pro' && targetTier === 'pro')) {
          setSuccessLimit(connectedAccess.limit);
          setSuccessTier(connectedTier);
          setSuccess(true);
          setBusy(null);
          return;
        }
      } catch (connectError) {
        if (!isGoogleSignInCancelledError(connectError)) {
          setError(friendlyGoogleConnectError(connectError));
        }
        setBusy(null);
        return;
      }

      setBusy('purchase');
      try {
        const identifiedOffer = await getPremiumOffer({ purchaseUserId: effectiveAccess.purchaseUserId, force: true });
        setOfferState({ status: 'ready', value: identifiedOffer });
        const identifiedTierOffer = packagesForTier(identifiedOffer, targetTier);
        planToBuy = identifiedTierOffer[selectedPlan] ?? identifiedTierOffer.annual ?? identifiedTierOffer.monthly;
      } catch (offerError) {
        setError(friendlyPurchaseError(offerError));
        setBusy(null);
        return;
      }
    }

    if (!planToBuy || !effectiveAccess) {
      setError(`Planul Profu’ ${targetTier === 'max' ? 'Max' : 'Pro'} nu este disponibil momentan în Google Play.`);
      setBusy(null);
      return;
    }

    setBusy('purchase');
    try {
      const session = captureSession();
      const next = await purchasePremium(planToBuy, {
        replaceProductId: effectiveAccess.premium.active ? effectiveAccess.premium.productId : null,
      });
      assertSessionActive(session);
      setSuccessLimit(next.limit);
      setSuccessTier(next.premium.tier ?? targetTier);
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
    setError(null);
    let effectivePurchaseUserId = purchaseUserId;
    if (!googleLinked) {
      setAllowRouteAccessFallback(false);
      setBusy('google');
      try {
        const connectedAccess = await connectGoogle();
        if (!connectedAccess || connectedAccess.identity !== 'google') return;
        effectivePurchaseUserId = connectedAccess.purchaseUserId;
        if (connectedAccess.premium.active) {
          setSuccessLimit(connectedAccess.limit);
          setSuccessTier(connectedAccess.premium.tier ?? 'pro');
          setSuccess(true);
          return;
        }
      } catch (connectError) {
        if (!isGoogleSignInCancelledError(connectError)) {
          setError(friendlyGoogleConnectError(connectError));
        }
        return;
      } finally {
        setBusy(null);
      }
    }

    setBusy('restore');
    try {
      const session = captureSession();
      const next = await restorePremium({ purchaseUserId: effectivePurchaseUserId });
      assertSessionActive(session);
      applyServerAccess(next);
      if (next.premium.active) {
        setSuccessLimit(next.limit);
        setSuccessTier(next.premium.tier ?? 'pro');
        setSuccess(true);
      } else {
        setError('Nu am găsit un abonament activ pentru acest cont Google Play.');
      }
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
    const playSubscriptionsUrl = 'https://play.google.com/store/account/subscriptions';
    try {
      const url = isPurchasesConfigured()
        ? (await getSubscriptionManagementUrl({ purchaseUserId }).catch(() => null)) || playSubscriptionsUrl
        : playSubscriptionsUrl;
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
      selectedTab={selectedTab}
      selected={selectedPlan}
      busy={activeBusy}
      error={error}
      success={success}
      successLimit={successLimit}
      successTier={successTier}
      active={ambientActive}
      timerActive={screenFocused}
      onClose={() => { if (!activeBusy) { beginAppTransition(); navigation.goBack(); } }}
      onBuy={() => void buy()}
      onRestore={() => void restore()}
      onManage={() => void manage()}
      onRefresh={() => { if (!activeBusy) void refresh(); }}
      onRetryOffer={() => { if (!activeBusy) void offerTask.run(); }}
      onLegal={() => { if (!activeBusy) { beginAppTransition(); navigation.navigate('Legal'); } }}
      onSelectTab={(tab) => { if (!activeBusy) { setSelectedTab(tab); setError(null); } }}
      onSelect={(plan) => { if (!activeBusy) setSelected(plan); }}
    />
  );
}
