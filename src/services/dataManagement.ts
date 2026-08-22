import { getApp } from '@react-native-firebase/app';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { clearFavoriteLessonsCache } from './lessons';
import { initializeVerifiedFirebaseServices, resetFirebaseInitialization } from './firebase';

type DeleteMyDataResponse = { deleted: boolean };

export async function deleteAllUserData(): Promise<void> {
  await initializeVerifiedFirebaseServices();
  const app = getApp();
  const functions = getFunctions(app, 'europe-west1');
  const deleteData = httpsCallable<Record<string, never>, DeleteMyDataResponse>(functions, 'deleteMyData', { timeout: 120_000 });
  const response = await deleteData({});
  if (response.data?.deleted !== true) throw new Error('Ștergerea nu a fost confirmată.');

  await signOut(getAuth(app)).catch(() => undefined);
  clearFavoriteLessonsCache();
  resetFirebaseInitialization();
}
