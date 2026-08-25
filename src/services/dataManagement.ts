import { getApp } from '@react-native-firebase/app';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { getCrashlytics, setCrashlyticsCollectionEnabled } from '@react-native-firebase/crashlytics';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { clearFavoriteLessonsCache } from './lessons';
import { initializeVerifiedFirebaseServices, resetFirebaseInitialization } from './firebase';
import { clearLocalPreferences } from './localPreferences';
import { clearPendingAnalysis } from './pendingAnalysis';
import { clearTemporaryCapturedImages } from './temporaryImages';

type DeleteMyDataResponse = { deleted: boolean };

export async function deleteAllUserData(): Promise<void> {
  // Local photos and preferences do not depend on network availability. Clear
  // them even when the remote deletion needs to be retried later.
  clearTemporaryCapturedImages();
  clearPendingAnalysis();
  clearLocalPreferences();

  await initializeVerifiedFirebaseServices();
  const app = getApp();
  const functions = getFunctions(app, 'europe-west1');
  const deleteData = httpsCallable<Record<string, never>, DeleteMyDataResponse>(functions, 'deleteMyData', { timeout: 120_000 });
  const response = await deleteData({});
  if (response.data?.deleted !== true) throw new Error('Ștergerea nu a fost confirmată.');

  await setCrashlyticsCollectionEnabled(getCrashlytics(app), false).catch(() => undefined);
  await signOut(getAuth(app)).catch(() => undefined);
  clearFavoriteLessonsCache();
  resetFirebaseInitialization();
}
