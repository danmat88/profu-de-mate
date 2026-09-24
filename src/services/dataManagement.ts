import { getApp } from '@react-native-firebase/app';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { getCrashlytics, setCrashlyticsCollectionEnabled } from '@react-native-firebase/crashlytics';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { clearFavoriteLessonsCache } from './lessons';
import { clearCachedCommercialAccess } from './commercialAccessCache';
import { confirmGoogleIdentityForDeletion, pendingGoogleMergeTickets, removePendingGoogleMergesForUser } from './commercial';
import { initializeVerifiedFirebaseServices, markFirebaseUserDeleted, resetFirebaseInitialization } from './firebase';
import { recordDiagnosticError } from './diagnostics';
import { clearLocalPreferences } from './localPreferences';
import { clearPendingAnalysis } from './pendingAnalysis';
import { clearMathDrafts } from './mathDraft';
import { clearTemporaryCapturedImages } from './temporaryImages';
import { getInstallationToken } from './installationIdentity';
import { resetPurchasesForSignedOutUser } from './purchases';
import { assertSessionActive, captureSession, invalidateSessionOperations } from './sessionGuard';

type DeleteMyDataResponse = { deleted: boolean; revenueCatDeletionPending?: boolean };

export type DataDeletionResult = {
  externalBillingProfilePending: boolean;
  localSignOutPending?: boolean;
};

export class DataDeletionCancelledError extends Error {
  constructor() {
    super('Ștergerea a fost anulată.');
    this.name = 'DataDeletionCancelledError';
  }
}

export async function deleteAllUserData(): Promise<DataDeletionResult> {
  const user = await initializeVerifiedFirebaseServices();
  const session = captureSession(user.uid);
  if (!await confirmGoogleIdentityForDeletion()) throw new DataDeletionCancelledError();
  assertSessionActive(session);
  const app = getApp();
  const functions = getFunctions(app, 'europe-west1');
  const installationToken = await getInstallationToken();
  const pendingMergeTickets = await pendingGoogleMergeTickets(user.uid);
  assertSessionActive(session);
  const deleteData = httpsCallable<{ installationToken: string; pendingMergeTickets: string[] }, DeleteMyDataResponse>(functions, 'deleteMyData', { timeout: 120_000 });
  const response = await deleteData({ installationToken, pendingMergeTickets });
  if (response.data?.deleted !== true) throw new Error('Ștergerea nu a fost confirmată.');
  // A delayed deletion response may belong to an account the user already left.
  // Never clear a new account's local state or sign that account out.
  try { assertSessionActive(session); } catch {
    return { externalBillingProfilePending: response.data.revenueCatDeletionPending === true };
  }
  invalidateSessionOperations();
  markFirebaseUserDeleted(user.uid);

  clearTemporaryCapturedImages();
  clearPendingAnalysis();
  clearMathDrafts();
  clearLocalPreferences();
  clearFavoriteLessonsCache();
  let localSignOutPending = false;
  try { await signOut(getAuth(app)); } catch (error) {
    localSignOutPending = true;
    recordDiagnosticError('data_deletion', error);
  }
  void Promise.allSettled([
    clearCachedCommercialAccess(),
    removePendingGoogleMergesForUser(user.uid),
    setCrashlyticsCollectionEnabled(getCrashlytics(app), false),
    resetPurchasesForSignedOutUser(),
  ]);
  void Promise.allSettled([
    import('react-native-nitro-google-signin')
      .then(({ GoogleOneTapSignIn }) => GoogleOneTapSignIn.signOut()),
  ]);
  clearFavoriteLessonsCache();
  resetFirebaseInitialization();
  // Once the callable confirms deletion, a later offline bootstrap must never
  // turn the result into the false message "deletion failed". CommercialContext
  // owns the next authoritative access refresh.
  return {
    externalBillingProfilePending: response.data.revenueCatDeletionPending === true,
    localSignOutPending,
  };
}
