import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  type PurchasesPackage,
} from 'react-native-purchases';
import type { CommercialAccess } from '../../../shared/types';
import { writeCachedCommercialAccess } from './commercialAccessCache';
import { initializeVerifiedFirebaseServices } from '../../../shared/services/firebase';
import { assertSessionActive, captureSession, type ActiveSession } from '../../../shared/services/sessionGuard';
import { withDeadline } from '../../../shared/utils/latestTask';

let configuredUserId: string | null = null;
let purchasesSdkConfigured = false;
let configuredSessionKey: string | null = null;
let sdkQueue: Promise<unknown> = Promise.resolve();
let billingOperationActive = false;

// Identity changes and transactions share a queue: a login cannot switch the
// native customer underneath a purchase already presented by Google Play.
function withSdk<T>(operation: () => Promise<T>, options: {
  timeoutMs?: number;
  timeoutMessage?: string;
  finishCleanup?: boolean;
  onSettled?: () => void;
} = {}): Promise<T> {
  let expired = false;
  const timeout = Object.assign(new Error(options.timeoutMessage
    ?? 'Google Play nu a răspuns la timp. Încearcă din nou peste câteva momente.'), { code: 'purchases/timeout' });
  const result = sdkQueue.then(() => {
    // A button action which timed out while queued must never start later.
    // Logout cleanup is the exception: it still detaches the old customer.
    if (expired && !options.finishCleanup) throw timeout;
    return operation();
  }).finally(options.onSettled);
  // A timeout does not cancel a native SDK mutation. Keep its lock until the
  // real operation settles; otherwise a late logIn/logOut can change the
  // customer underneath a newer purchase.
  sdkQueue = result.catch(() => undefined);
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      expired = true;
      reject(timeout);
    }, options.timeoutMs ?? 20_000);
    result.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function beginBillingOperation(): void {
  if (billingOperationActive) {
    throw Object.assign(new Error('Google Play finalizează deja o acțiune. Așteaptă confirmarea înainte să încerci din nou.'), {
      code: 'purchases/operation-in-progress',
    });
  }
  billingOperationActive = true;
}

export type PremiumOffer = {
  monthly: PurchasesPackage;
  annual: PurchasesPackage;
};

function publicApiKey(): string | null {
  const value = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim();
  return value && !value.startsWith('replace_') ? value : null;
}

export function isPurchasesConfigured(): boolean {
  return Boolean(publicApiKey());
}

export async function initializePurchases(userId: string, session = captureSession()): Promise<boolean> {
  const apiKey = publicApiKey();
  if (!apiKey) return false;
  // Premium belongs to an account that can be recovered across devices. Guest
  // allowance IDs must never become RevenueCat customer aliases.
  if (!/^g_[a-f0-9]{64}$/.test(userId)) throw new Error('Contul comercial pentru Google Play nu este valid.');
  return withSdk(async () => {
    assertSessionActive(session);
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    if (!purchasesSdkConfigured) {
      Purchases.configure({ apiKey, appUserID: userId });
      purchasesSdkConfigured = true;
    } else if (configuredUserId !== userId || configuredSessionKey !== session.sessionKey) {
      configuredUserId = null;
      configuredSessionKey = null;
      await Purchases.logIn(userId);
      assertSessionActive(session);
    }
    configuredUserId = userId;
    configuredSessionKey = session.sessionKey;
    return true;
  });
}

/**
 * Detaches the native billing SDK from the identified account. RevenueCat
 * creates its own anonymous SDK identity after logout; the app never uses that
 * identity for quota, notebook ownership or server entitlements.
 */
export async function resetPurchasesForSignedOutUser(): Promise<void> {
  configuredUserId = null;
  configuredSessionKey = null;
  await withSdk(async () => {
    if (purchasesSdkConfigured && !await Purchases.isAnonymous()) await Purchases.logOut();
  }, { finishCleanup: true });
}

async function requirePurchases(session: ActiveSession): Promise<void> {
  assertSessionActive(session);
  await withDeadline(initializeVerifiedFirebaseServices(), 12_000, 'Verificarea contului durează prea mult. Încearcă din nou.');
  assertSessionActive(session);
  if (!publicApiKey()) throw new Error('Abonamentele nu sunt configurate în acest build.');
  if (!purchasesSdkConfigured || !configuredUserId || configuredSessionKey !== session.sessionKey) {
    throw new Error('Contul comercial nu este încă verificat. Redeschide ecranul Premium.');
  }
}

export async function getPremiumOffer(): Promise<PremiumOffer> {
  const session = captureSession();
  return withSdk(async () => {
    await requirePurchases(session);
    const offerings = await withDeadline(Purchases.getOfferings(), 12_000, 'Oferta nu a sosit. Încearcă din nou.');
    assertSessionActive(session);
    const current = offerings.current;
    const monthly = current?.monthly
      ?? current?.availablePackages.find((item) => item.packageType === PACKAGE_TYPE.MONTHLY)
      ?? null;
    const annual = current?.annual
      ?? current?.availablePackages.find((item) => item.packageType === PACKAGE_TYPE.ANNUAL)
      ?? null;
    if (!monthly || !annual) throw new Error('Oferta Premium nu este disponibilă momentan.');
    return { monthly, annual };
  });
}

async function syncServerPremium(session: ActiveSession): Promise<CommercialAccess> {
  assertSessionActive(session);
  const functions = getFunctions(getApp(), 'europe-west1');
  const sync = httpsCallable<Record<string, never>, CommercialAccess>(functions, 'syncPremiumAccess', { timeout: 30_000 });
  const access = (await sync({})).data;
  assertSessionActive(session);
  await writeCachedCommercialAccess(access, session.sessionKey);
  assertSessionActive(session);
  return access;
}

export async function purchasePremium(plan: PurchasesPackage): Promise<CommercialAccess> {
  const session = captureSession();
  beginBillingOperation();
  return withSdk(async () => {
    await requirePurchases(session);
    await Purchases.purchasePackage(plan);
    assertSessionActive(session);
    try {
      const access = await syncServerPremium(session);
      if (access.premium.active) return access;
    } catch {
      assertSessionActive(session);
      throw new Error('Google Play a înregistrat plata, dar confirmarea Premium nu a ajuns încă. Folosește „Restaurează achizițiile” peste câteva momente.');
    }
    throw new Error('Plata a fost înregistrată, dar accesul Premium nu este încă activ. Folosește „Restaurează achizițiile”.');
  }, {
    timeoutMs: 120_000,
    timeoutMessage: 'Confirmarea Google Play întârzie. Plata poate continua; nu cumpăra din nou. Verifică abonamentul în Google Play și apoi folosește „Restaurează achizițiile”.',
    onSettled: () => { billingOperationActive = false; },
  });
}

export async function restorePremium(): Promise<CommercialAccess> {
  const session = captureSession();
  beginBillingOperation();
  return withSdk(async () => {
    await requirePurchases(session);
    await Purchases.restorePurchases();
    assertSessionActive(session);
    return syncServerPremium(session);
  }, {
    timeoutMs: 60_000,
    timeoutMessage: 'Restaurarea Google Play întârzie. Verifică abonamentul în Google Play și încearcă din nou peste câteva momente.',
    onSettled: () => { billingOperationActive = false; },
  });
}

export async function getSubscriptionManagementUrl(): Promise<string | null> {
  const session = captureSession();
  return withSdk(async () => {
    await requirePurchases(session);
    const customerInfo = await withDeadline(Purchases.getCustomerInfo(), 12_000, 'Google Play nu răspunde. Încearcă din nou.');
    assertSessionActive(session);
    return customerInfo.managementURL;
  });
}

export function isPurchaseCancellation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: unknown; userCancelled?: unknown };
  return value.userCancelled === true || value.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}

export function purchaseErrorCopy(error: unknown): string | null {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  switch (code) {
    case PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR:
      return 'Plata este în așteptare în Google Play. Nu cumpăra din nou; Premium se activează după confirmarea plății.';
    case PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR:
      return 'Abonamentul pare deja cumpărat. Folosește „Restaurează achizițiile” pentru a activa Premium.';
    case PURCHASES_ERROR_CODE.NETWORK_ERROR:
    case PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR:
    case PURCHASES_ERROR_CODE.PRODUCT_REQUEST_TIMED_OUT_ERROR:
      return 'Google Play nu poate fi contactat momentan. Verifică internetul și încearcă din nou.';
    case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
    case PURCHASES_ERROR_CODE.INSUFFICIENT_PERMISSIONS_ERROR:
      return 'Google Play nu permite această achiziție pentru contul sau dispozitivul folosit.';
    case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
    case PURCHASES_ERROR_CODE.CONFIGURATION_ERROR:
      return 'Oferta Premium nu este disponibilă în acest build sau pentru acest cont Google Play.';
    case PURCHASES_ERROR_CODE.OPERATION_ALREADY_IN_PROGRESS_ERROR:
      return 'Google Play finalizează deja o acțiune. Așteaptă câteva secunde.';
    case PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR:
    case PURCHASES_ERROR_CODE.RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR:
      return 'Abonamentul este legat de alt cont Profu’. Conectează același cont Google folosit la cumpărare și restaurează achiziția.';
    default:
      return null;
  }
}
