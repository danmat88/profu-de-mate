import { getApp } from '@react-native-firebase/app';
import {
  getAuth,
  getIdToken,
  GoogleAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  signOut,
  signInWithCredential,
  type User,
} from '@react-native-firebase/auth';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import type { CommercialAccess } from '../types';
import { createWelcomeIntegrityProof, preparePlayIntegrity } from './deviceIntegrity';
import { initializeVerifiedFirebaseServices, resetFirebaseInitialization } from './firebase';
import { getInstallationToken } from './installationIdentity';
import { clearFavoriteLessonsCache } from './lessons';
import { initializePurchases } from './purchases';

type PrepareMergeResponse = { ticket: string };
type CompleteMergeResponse = { merged: true; copiedLessons: number };
type PendingMerge = { ticket: string; sourceUserId: string; createdAt: number };

let googleConfigured = false;
let mergeResume: Promise<void> | null = null;
const PENDING_MERGE_KEY = 'commercial.pending-google-merge.v1';
const MERGE_TICKET_CLIENT_LIFETIME_MS = 12 * 60 * 1000;

export class CommercialGateError extends Error {
  readonly reason: string;
  readonly access: CommercialAccess | null;

  constructor(message: string, reason: string, access: CommercialAccess | null = null) {
    super(message);
    this.name = 'CommercialGateError';
    this.reason = reason;
    this.access = access;
  }
}

function functionsInstance() {
  return getFunctions(getApp(), 'europe-west1');
}

async function googleSigninModule() {
  return import('react-native-nitro-google-signin');
}

async function secureStoreModule() {
  return import('expo-secure-store');
}

function validPendingMerge(value: unknown): value is PendingMerge {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<PendingMerge>;
  return typeof data.ticket === 'string'
    && /^[a-f0-9-]{36}$/i.test(data.ticket)
    && typeof data.sourceUserId === 'string'
    && data.sourceUserId.length >= 1
    && data.sourceUserId.length <= 128
    && !data.sourceUserId.includes('/')
    && typeof data.createdAt === 'number'
    && Number.isSafeInteger(data.createdAt);
}

async function readPendingMerge(): Promise<PendingMerge | null> {
  try {
    const storage = await secureStoreModule();
    const raw = await storage.getItemAsync(PENDING_MERGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!validPendingMerge(parsed) || Date.now() - parsed.createdAt > MERGE_TICKET_CLIENT_LIFETIME_MS) {
      await storage.deleteItemAsync(PENDING_MERGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writePendingMerge(value: PendingMerge): Promise<void> {
  try {
    const storage = await secureStoreModule();
    await storage.setItemAsync(PENDING_MERGE_KEY, JSON.stringify(value));
  } catch {
    throw new Error('Conectarea sigură cu Google are nevoie de un development build nou.');
  }
}

async function clearPendingMerge(): Promise<void> {
  try {
    const storage = await secureStoreModule();
    await storage.deleteItemAsync(PENDING_MERGE_KEY);
  } catch {
    // A missing native module cannot leave a marker because writing it would also have failed.
  }
}

export async function clearPendingGoogleMerge(): Promise<void> {
  await clearPendingMerge();
}

function terminalMergeError(error: unknown): boolean {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  return code === 'functions/deadline-exceeded'
    || code === 'functions/permission-denied'
    || code === 'functions/failed-precondition'
    || code === 'functions/invalid-argument'
    || code === 'functions/not-found';
}

async function completePendingMerge(user: User): Promise<void> {
  if (mergeResume) return mergeResume;
  mergeResume = (async () => {
    const pending = await readPendingMerge();
    if (!pending) return;
    if (user.uid === pending.sourceUserId && user.isAnonymous) return;
    const hasGoogle = user.providerData.some((provider) => provider.providerId === 'google.com');
    if (!hasGoogle) {
      await clearPendingMerge();
      return;
    }
    const installationToken = await getInstallationToken();
    const complete = httpsCallable<{ ticket: string; installationToken: string }, CompleteMergeResponse>(functionsInstance(), 'completeAccountMergeWithGoogle', { timeout: 120_000 });
    try {
      await complete({ ticket: pending.ticket, installationToken });
      clearFavoriteLessonsCache();
      await clearPendingMerge();
    } catch (error) {
      if (terminalMergeError(error)) await clearPendingMerge();
      throw error;
    }
  })().finally(() => { mergeResume = null; });
  return mergeResume;
}

async function configureGoogle(): Promise<void> {
  if (googleConfigured) return;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  if (!webClientId) throw new Error('Google Sign-In nu este configurat în acest build.');
  const { GoogleOneTapSignIn } = await googleSigninModule();
  GoogleOneTapSignIn.configure({
    webClientId,
    offlineAccess: false,
    autoSelectOnSignIn: false,
  });
  googleConfigured = true;
}

export async function prepareCommercialServices(): Promise<void> {
  const user = await initializeVerifiedFirebaseServices();
  await completePendingMerge(user);
  await Promise.all([preparePlayIntegrity().catch(() => undefined), getInstallationToken()]);
}

export async function getCommercialAccess(): Promise<CommercialAccess> {
  const user = await initializeVerifiedFirebaseServices();
  await completePendingMerge(user);
  const installationToken = await getInstallationToken();
  const callable = httpsCallable<{ installationToken: string }, CommercialAccess>(functionsInstance(), 'getCommercialAccess', { timeout: 30_000 });
  const access = (await callable({ installationToken })).data;
  await initializePurchases(access.purchaseUserId).catch(() => false);
  return access;
}

function detailsFromError(error: unknown): { reason: string; access: CommercialAccess | null } | null {
  if (!error || typeof error !== 'object') return null;
  const details = (error as { details?: unknown }).details;
  if (!details || typeof details !== 'object') return null;
  const reason = (details as { commercialReason?: unknown }).commercialReason;
  const access = (details as { access?: unknown }).access;
  return typeof reason === 'string'
    ? { reason, access: access && typeof access === 'object' ? access as CommercialAccess : null }
    : null;
}

export function commercialGateFromError(error: unknown): CommercialGateError | null {
  if (error instanceof CommercialGateError) return error;
  const parsed = detailsFromError(error);
  if (!parsed) return null;
  const message = error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : 'Accesul pentru această problemă nu este disponibil.';
  return new CommercialGateError(message, parsed.reason, parsed.access);
}

export async function preflightAnalysisAccess(requestId: string): Promise<CommercialAccess> {
  let access = await getCommercialAccess();
  if (!access.canAnalyze) throw new CommercialGateError('Nu mai ai probleme disponibile momentan.', access.reason, access);
  if (access.deviceRecall.shouldVerify) {
    const user = await initializeVerifiedFirebaseServices();
    const installationToken = await getInstallationToken();
    let proof: Awaited<ReturnType<typeof createWelcomeIntegrityProof>>;
    try {
      proof = await createWelcomeIntegrityProof(user.uid, requestId);
    } catch {
      throw new CommercialGateError(
        'Nu am putut verifica în siguranță problemele de bun-venit. Conectează-te cu Google pentru accesul gratuit zilnic.',
        'device_verification_unavailable',
        access,
      );
    }
    const claim = httpsCallable<typeof proof & { requestId: string; installationToken: string }, { verified: boolean }>(functionsInstance(), 'claimGuestWelcome', { timeout: 30_000 });
    try {
      await claim({ requestId, installationToken, ...proof });
    } catch (error) {
      const gate = commercialGateFromError(error);
      if (gate) throw gate;
      throw error;
    }
    access = await getCommercialAccess();
  }
  return access;
}

function isCredentialCollision(error: unknown): boolean {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  return code === 'auth/credential-already-in-use' || code === 'auth/account-exists-with-different-credential';
}

export async function connectWithGoogle(): Promise<User | null> {
  await configureGoogle();
  const {
    GoogleOneTapSignIn,
    isCancelledResponse,
    isNoSavedCredentialFoundResponse,
    isSuccessResponse,
  } = await googleSigninModule();
  const sourceUser = await initializeVerifiedFirebaseServices();
  if (!sourceUser.isAnonymous && sourceUser.providerData.some((provider) => provider.providerId === 'google.com')) {
    await completePendingMerge(sourceUser);
    return sourceUser;
  }

  const existingPending = await readPendingMerge();
  let pending = existingPending?.sourceUserId === sourceUser.uid ? existingPending : null;
  if (!pending) {
    const installationToken = await getInstallationToken();
    const prepare = httpsCallable<{ installationToken: string }, PrepareMergeResponse>(functionsInstance(), 'prepareAccountMerge', { timeout: 30_000 });
    const { data: merge } = await prepare({ installationToken });
    pending = { ticket: merge.ticket, sourceUserId: sourceUser.uid, createdAt: Date.now() };
    await writePendingMerge(pending);
  }
  await GoogleOneTapSignIn.checkPlayServices(true);
  let response = await GoogleOneTapSignIn.signIn();
  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.createAccount();
  }
  if (isCancelledResponse(response)) {
    await clearPendingMerge();
    return null;
  }
  if (!isSuccessResponse(response) || !response.data.idToken) {
    throw new Error('Google nu a furnizat un token de conectare.');
  }
  const credential = GoogleAuthProvider.credential(response.data.idToken);
  const auth = getAuth(getApp());
  let targetUser: User;
  let needsMerge = false;
  try {
    targetUser = (await linkWithCredential(sourceUser, credential)).user;
    needsMerge = true;
  } catch (error) {
    if (!isCredentialCollision(error)) throw error;
    targetUser = (await signInWithCredential(auth, credential)).user;
    needsMerge = true;
  }

  resetFirebaseInitialization();
  await getIdToken(targetUser, true);
  if (needsMerge) {
    await completePendingMerge(targetUser);
  }
  await getCommercialAccess();
  return targetUser;
}

async function googleCredentialFromPrompt(): Promise<ReturnType<typeof GoogleAuthProvider.credential> | null> {
  await configureGoogle();
  const {
    GoogleOneTapSignIn,
    isCancelledResponse,
    isNoSavedCredentialFoundResponse,
    isSuccessResponse,
  } = await googleSigninModule();
  await GoogleOneTapSignIn.checkPlayServices(true);
  let response = await GoogleOneTapSignIn.signIn();
  if (isNoSavedCredentialFoundResponse(response)) response = await GoogleOneTapSignIn.createAccount();
  if (isCancelledResponse(response)) return null;
  if (!isSuccessResponse(response) || !response.data.idToken) {
    throw new Error('Google nu a furnizat un token de conectare.');
  }
  return GoogleAuthProvider.credential(response.data.idToken);
}

export async function confirmGoogleIdentityForDeletion(): Promise<boolean> {
  const user = await initializeVerifiedFirebaseServices();
  const hasGoogle = user.providerData.some((provider) => provider.providerId === 'google.com');
  if (user.isAnonymous || !hasGoogle) return true;
  const credential = await googleCredentialFromPrompt();
  if (!credential) return false;
  await reauthenticateWithCredential(user, credential);
  await getIdToken(user, true);
  return true;
}

export async function disconnectGoogleAccount(): Promise<User> {
  const app = getApp();
  const current = await initializeVerifiedFirebaseServices();
  if (current.isAnonymous) return current;

  const installationToken = await getInstallationToken();
  const prepareLogout = httpsCallable<{ installationToken: string }, { ready: true }>(
    functionsInstance(),
    'prepareAccountLogout',
    { timeout: 30_000 },
  );
  await prepareLogout({ installationToken });
  await clearPendingMerge();
  await signOut(getAuth(app));
  await googleSigninModule()
    .then(({ GoogleOneTapSignIn }) => GoogleOneTapSignIn.signOut())
    .catch(() => undefined);
  clearFavoriteLessonsCache();
  resetFirebaseInitialization();
  const guest = await initializeVerifiedFirebaseServices();
  await getCommercialAccess();
  return guest;
}
