import { getApp } from '@react-native-firebase/app';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { getCrashlytics, setCrashlyticsCollectionEnabled } from '@react-native-firebase/crashlytics';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { clearFavoriteLessonsCache } from './lessons';
import { clearPendingGoogleMerge, confirmGoogleIdentityForDeletion, getCommercialAccess } from './commercial';
import { initializeVerifiedFirebaseServices, resetFirebaseInitialization } from './firebase';
import { clearLocalPreferences } from './localPreferences';
import { clearPendingAnalysis } from './pendingAnalysis';
import { clearTemporaryCapturedImages } from './temporaryImages';
import { getInstallationToken } from './installationIdentity';

type DeleteMyDataResponse = { deleted: boolean };

export class DataDeletionCancelledError extends Error {
  constructor() {
    super('Ștergerea a fost anulată.');
    this.name = 'DataDeletionCancelledError';
  }
}

export async function deleteAllUserData(): Promise<void> {
  await initializeVerifiedFirebaseServices();
  if (!await confirmGoogleIdentityForDeletion()) throw new DataDeletionCancelledError();
  const app = getApp();
  const functions = getFunctions(app, 'europe-west1');
  const installationToken = await getInstallationToken();
  const deleteData = httpsCallable<{ installationToken: string }, DeleteMyDataResponse>(functions, 'deleteMyData', { timeout: 120_000 });
  const response = await deleteData({ installationToken });
  if (response.data?.deleted !== true) throw new Error('Ștergerea nu a fost confirmată.');

  clearTemporaryCapturedImages();
  clearPendingAnalysis();
  clearLocalPreferences();
  await clearPendingGoogleMerge();
  await setCrashlyticsCollectionEnabled(getCrashlytics(app), false).catch(() => undefined);
  await signOut(getAuth(app)).catch(() => undefined);
  await import('react-native-nitro-google-signin')
    .then(({ GoogleOneTapSignIn }) => GoogleOneTapSignIn.signOut())
    .catch(() => undefined);
  clearFavoriteLessonsCache();
  resetFirebaseInitialization();
  await initializeVerifiedFirebaseServices();
  await getCommercialAccess();
}
