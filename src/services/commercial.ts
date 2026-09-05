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
import { clearCachedCommercialAccess, writeCachedCommercialAccess } from './commercialAccessCache';
import { createWelcomeIntegrityProof, preparePlayIntegrity } from './deviceIntegrity';
import {
  firebaseUserSessionKey,
  initializeVerifiedFirebaseServices,
  recoverFirebaseSessionAfterCallableFailure,
  resetFirebaseInitialization,
} from './firebase';
import { getInstallationToken } from './installationIdentity';
import { clearFavoriteLessonsCache } from './lessons';
import { initializePurchases, resetPurchasesForSignedOutUser } from './purchases';
import { recordDiagnosticError } from './diagnostics';

type PrepareMergeResponse = { ticket: string };
type CompleteMergeResponse = { merged: true; copiedLessons: number };
type PendingMerge = { ticket: string; sourceUserId: string; targetUserId?: string; createdAt: number };

let googleConfigured = false;
let mergeResume: Promise<void> | null = null;
const PENDING_MERGES_KEY = 'commercial.pending-google-merges.v2';
const LEGACY_PENDING_MERGE_KEY = 'commercial.pending-google-merge.v1';
const MERGE_TICKET_CLIENT_LIFETIME_MS = 6 * 24 * 60 * 60 * 1000;
const MAX_PENDING_MERGES = 5;

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

export class StaleCommercialSessionError extends Error {
  readonly code = 'commercial/stale-session';

  constructor() {
    super('Commercial access was returned for an authentication state that is no longer active.');
    this.name = 'StaleCommercialSessionError';
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
    && (data.targetUserId === undefined || (
      typeof data.targetUserId === 'string'
      && data.targetUserId.length >= 1
      && data.targetUserId.length <= 128
      && !data.targetUserId.includes('/')
    ))
    && typeof data.createdAt === 'number'
    && Number.isSafeInteger(data.createdAt);
}

function uniquePendingMerges(values: readonly PendingMerge[]): PendingMerge[] {
  const tickets = new Set<string>();
  const sources = new Set<string>();
  return values.filter((value) => {
    if (tickets.has(value.ticket) || sources.has(value.sourceUserId)) return false;
    tickets.add(value.ticket);
    sources.add(value.sourceUserId);
    return true;
  }).slice(-MAX_PENDING_MERGES);
}

async function readPendingMerges(): Promise<PendingMerge[]> {
  try {
    const storage = await secureStoreModule();
    const [raw, legacyRaw] = await Promise.all([
      storage.getItemAsync(PENDING_MERGES_KEY),
      storage.getItemAsync(LEGACY_PENDING_MERGE_KEY),
    ]);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const legacy: unknown = legacyRaw ? JSON.parse(legacyRaw) : null;
    const candidates = [
      ...(Array.isArray(parsed) ? parsed : []),
      ...(validPendingMerge(legacy) ? [legacy] : []),
    ];
    const pending = uniquePendingMerges(candidates.filter((value): value is PendingMerge => (
      validPendingMerge(value)
      && value.createdAt <= Date.now() + 5 * 60 * 1000
      && Date.now() - value.createdAt <= MERGE_TICKET_CLIENT_LIFETIME_MS
    )));
    if (pending.length > 0) await storage.setItemAsync(PENDING_MERGES_KEY, JSON.stringify(pending));
    else await storage.deleteItemAsync(PENDING_MERGES_KEY);
    await storage.deleteItemAsync(LEGACY_PENDING_MERGE_KEY);
    return pending;
  } catch {
    return [];
  }
}

async function writePendingMerges(values: readonly PendingMerge[]): Promise<void> {
  try {
    const storage = await secureStoreModule();
    const pending = uniquePendingMerges(values);
    if (pending.length > 0) await storage.setItemAsync(PENDING_MERGES_KEY, JSON.stringify(pending));
    else await storage.deleteItemAsync(PENDING_MERGES_KEY);
    await storage.deleteItemAsync(LEGACY_PENDING_MERGE_KEY);
  } catch {
    throw new Error('Conectarea sigură cu Google are nevoie de un development build nou.');
  }
}

export async function removePendingGoogleMergesForUser(userId: string): Promise<void> {
  const pending = await readPendingMerges();
  await writePendingMerges(pending.filter((merge) => (
    merge.targetUserId !== undefined && merge.targetUserId !== userId
  )));
}

export async function pendingGoogleMergeTickets(userId: string): Promise<string[]> {
  return (await readPendingMerges())
    .filter((pending) => pending.targetUserId === undefined || pending.targetUserId === userId)
    .map((pending) => pending.ticket);
}

function terminalMergeError(error: unknown): boolean {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  return code === 'functions/permission-denied'
    || code === 'functions/failed-precondition'
    || code === 'functions/invalid-argument'
    || code === 'functions/not-found';
}

async function resumePendingMergeWithoutBlocking(user: User): Promise<void> {
  try {
    await completePendingMerges(user);
  } catch (error) {
    // Authentication already succeeded. Keep transient handoffs in secure
    // storage and retry them on the next access/foreground instead of making
    // the signed-in app unusable or claiming that sign-in failed.
    recordDiagnosticError('google_account_merge', error);
  }
}

async function completePendingMerges(user: User): Promise<void> {
  if (mergeResume) return mergeResume;
  mergeResume = (async () => {
    const pendingMerges = await readPendingMerges();
    if (pendingMerges.length === 0) return;
    const hasGoogle = user.providerData.some((provider) => provider.providerId === 'google.com');
    if (!hasGoogle) return;
    // Bind every legacy/unbound handoff to the first Google identity that can
    // actually complete it. On a shared device, a later account must never
    // inherit a previous person's pending notebook.
    const boundMerges = pendingMerges.map((pending) => pending.targetUserId
      ? pending
      : { ...pending, targetUserId: user.uid });
    await writePendingMerges(boundMerges);
    const installationToken = await getInstallationToken();
    const complete = httpsCallable<{ ticket: string; installationToken: string }, CompleteMergeResponse>(functionsInstance(), 'completeAccountMergeWithGoogle', { timeout: 120_000 });
    const remaining = [...boundMerges];
    let firstError: unknown;
    for (const pending of boundMerges.filter((merge) => merge.targetUserId === user.uid)) {
      try {
        await complete({ ticket: pending.ticket, installationToken });
        remaining.splice(remaining.findIndex((value) => value.ticket === pending.ticket), 1);
        clearFavoriteLessonsCache();
      } catch (error) {
        if (terminalMergeError(error)) {
          remaining.splice(remaining.findIndex((value) => value.ticket === pending.ticket), 1);
        } else if (firstError === undefined) {
          firstError = error;
        }
      }
    }
    await writePendingMerges(remaining);
    if (firstError !== undefined) throw firstError;
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
  await resumePendingMergeWithoutBlocking(user);
  await Promise.all([preparePlayIntegrity().catch(() => undefined), getInstallationToken()]);
}

async function requestCommercialAccess(allowSessionRecovery: boolean): Promise<CommercialAccess> {
  const user = await initializeVerifiedFirebaseServices();
  const requestedSessionKey = firebaseUserSessionKey(user);
  if (!requestedSessionKey) throw new StaleCommercialSessionError();
  await resumePendingMergeWithoutBlocking(user);
  const installationToken = await getInstallationToken();
  const callable = httpsCallable<{ installationToken: string }, CommercialAccess>(functionsInstance(), 'getCommercialAccess', { timeout: 30_000 });
  let access: CommercialAccess;
  try {
    access = (await callable({ installationToken })).data;
  } catch (error) {
    const replacement = allowSessionRecovery
      ? await recoverFirebaseSessionAfterCallableFailure(error, requestedSessionKey)
      : null;
    if (replacement) return requestCommercialAccess(false);
    throw error;
  }
  const activeSessionKey = firebaseUserSessionKey(getAuth(getApp()).currentUser);
  if (activeSessionKey !== requestedSessionKey) throw new StaleCommercialSessionError();
  await writeCachedCommercialAccess(access, requestedSessionKey);
  if (access.identity === 'google') {
    await initializePurchases(access.purchaseUserId).catch((error) => {
      recordDiagnosticError('purchases_identity', error);
      return false;
    });
  }
  return access;
}

export function getCommercialAccess(): Promise<CommercialAccess> {
  return requestCommercialAccess(true);
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
    await resumePendingMergeWithoutBlocking(sourceUser);
    return sourceUser;
  }

  const pendingMerges = await readPendingMerges();
  let pending = pendingMerges.find((value) => value.sourceUserId === sourceUser.uid) ?? null;
  if (!pending) {
    const installationToken = await getInstallationToken();
    const prepare = httpsCallable<{ installationToken: string }, PrepareMergeResponse>(functionsInstance(), 'prepareAccountMerge', { timeout: 30_000 });
    const { data: merge } = await prepare({ installationToken });
    pending = { ticket: merge.ticket, sourceUserId: sourceUser.uid, createdAt: Date.now() };
    await writePendingMerges([...pendingMerges, pending]);
  }
  await GoogleOneTapSignIn.checkPlayServices(true);
  let response = await GoogleOneTapSignIn.signIn();
  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.createAccount();
  }
  if (isCancelledResponse(response)) {
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
  clearFavoriteLessonsCache();
  await writePendingMerges((await readPendingMerges()).map((merge) => (
    merge.ticket === pending.ticket ? { ...merge, targetUserId: targetUser.uid } : merge
  ))).catch((error) => recordDiagnosticError('google_account_merge', error));
  await getIdToken(targetUser, true);
  if (needsMerge) await resumePendingMergeWithoutBlocking(targetUser);
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

export async function disconnectGoogleAccount(): Promise<User | null> {
  const app = getApp();
  const current = await initializeVerifiedFirebaseServices();
  if (current.isAnonymous) return current;

  await clearCachedCommercialAccess();
  // Firebase sign-out is the authoritative local boundary. It must not depend
  // on a callable, because users must be able to leave an account while the
  // backend is slow or unavailable.
  await signOut(getAuth(app));
  await Promise.allSettled([
    googleSigninModule().then(({ GoogleOneTapSignIn }) => GoogleOneTapSignIn.signOut()),
    resetPurchasesForSignedOutUser(),
  ]);
  clearFavoriteLessonsCache();
  resetFirebaseInitialization();
  // Guest creation may need a network connection, so the context performs it
  // as a recoverable refresh instead of keeping the logout button blocked.
  return null;
}
