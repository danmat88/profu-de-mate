import { getApp } from '@react-native-firebase/app';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { getCrashlytics, setCrashlyticsCollectionEnabled } from '@react-native-firebase/crashlytics';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { clearFavoriteLessonsCache } from './lessons';
import { clearCachedCommercialAccess } from './commercialAccessCache';
import { confirmGoogleIdentityForDeletion, pendingGoogleMergeTickets, removePendingGoogleMergesForUser } from './commercial';
import { initializeVerifiedFirebaseServices, resetFirebaseInitialization } from './firebase';
import { clearLocalPreferences } from './localPreferences';
import { clearPendingAnalysis } from './pendingAnalysis';
import { clearTemporaryCapturedImages } from './temporaryImages';
import { getInstallationToken } from './installationIdentity';
import { resetPurchasesForSignedOutUser } from './purchases';

type DeleteMyDataResponse = { deleted: boolean; revenueCatDeletionPending?: boolean };

export type DataDeletionResult = {
  externalBillingProfilePending: boolean;
};

export class DataDeletionCancelledError extends Error {
  constructor() {
    super('Ștergerea a fost anulată.');
    this.name = 'DataDeletionCancelledError';
  }
}

export async function deleteAllUserData(): Promise<DataDeletionResult> {
  const user = await initializeVerifiedFirebaseServices();
  if (!await confirmGoogleIdentityForDeletion()) throw new DataDeletionCancelledError();
  const app = getApp();
  const functions = getFunctions(app, 'europe-west1');
  const installationToken = await getInstallationToken();
  const pendingMergeTickets = await pendingGoogleMergeTickets(user.uid);
  const deleteData = httpsCallable<{ installationToken: string; pendingMergeTickets: string[] }, DeleteMyDataResponse>(functions, 'deleteMyData', { timeout: 120_000 });
  const response = await deleteData({ installationToken, pendingMergeTickets });
  if (response.data?.deleted !== true) throw new Error('Ștergerea nu a fost confirmată.');

  clearTemporaryCapturedImages();
  clearPendingAnalysis();
  clearLocalPreferences();
  await Promise.allSettled([
    clearCachedCommercialAccess(),
    removePendingGoogleMergesForUser(user.uid),
    setCrashlyticsCollectionEnabled(getCrashlytics(app), false),
    resetPurchasesForSignedOutUser(),
  ]);
  await signOut(getAuth(app)).catch(() => undefined);
  await Promise.allSettled([
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
  };
}
