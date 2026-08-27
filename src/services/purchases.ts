import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  type PurchasesPackage,
} from 'react-native-purchases';
import type { CommercialAccess } from '../types';
import { writeCachedCommercialAccess } from './commercialAccessCache';
import { initializeVerifiedFirebaseServices } from './firebase';

let configuredUserId: string | null = null;
let purchasesSdkConfigured = false;

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

export async function initializePurchases(userId: string): Promise<boolean> {
  const apiKey = publicApiKey();
  if (!apiKey) return false;
  if (!/^[gi]_[a-f0-9]{64}$/.test(userId)) throw new Error('Identitatea comercială pentru Google Play nu este validă.');
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  if (!purchasesSdkConfigured) {
    Purchases.configure({ apiKey, appUserID: userId });
    purchasesSdkConfigured = true;
    configuredUserId = userId;
    return true;
  }
  if (configuredUserId !== userId) {
    await Purchases.logIn(userId);
    configuredUserId = userId;
  }
  return true;
}

async function requirePurchases(): Promise<void> {
  await initializeVerifiedFirebaseServices();
  if (!publicApiKey()) throw new Error('Abonamentele nu sunt configurate în acest build.');
  if (!purchasesSdkConfigured || !configuredUserId) {
    throw new Error('Contul comercial nu este încă verificat. Redeschide ecranul Premium.');
  }
}

export async function getPremiumOffer(): Promise<PremiumOffer> {
  await requirePurchases();
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  const monthly = current?.monthly
    ?? current?.availablePackages.find((item) => item.packageType === PACKAGE_TYPE.MONTHLY)
    ?? null;
  const annual = current?.annual
    ?? current?.availablePackages.find((item) => item.packageType === PACKAGE_TYPE.ANNUAL)
    ?? null;
  if (!monthly || !annual) throw new Error('Oferta Premium nu este disponibilă momentan.');
  return { monthly, annual };
}

async function syncServerPremium(): Promise<CommercialAccess> {
  const functions = getFunctions(getApp(), 'europe-west1');
  const sync = httpsCallable<Record<string, never>, CommercialAccess>(functions, 'syncPremiumAccess', { timeout: 30_000 });
  const access = (await sync({})).data;
  await writeCachedCommercialAccess(access);
  return access;
}

export async function purchasePremium(plan: PurchasesPackage): Promise<CommercialAccess> {
  await requirePurchases();
  await Purchases.purchasePackage(plan);
  try {
    const access = await syncServerPremium();
    if (access.premium.active) return access;
  } catch {
    throw new Error('Google Play a înregistrat plata, dar confirmarea Premium nu a ajuns încă. Folosește „Restaurează achizițiile” peste câteva momente.');
  }
  throw new Error('Plata a fost înregistrată, dar accesul Premium nu este încă activ. Folosește „Restaurează achizițiile”.');
}

export async function restorePremium(): Promise<CommercialAccess> {
  await requirePurchases();
  await Purchases.restorePurchases();
  return syncServerPremium();
}

export async function getSubscriptionManagementUrl(): Promise<string | null> {
  await requirePurchases();
  return (await Purchases.getCustomerInfo()).managementURL;
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
