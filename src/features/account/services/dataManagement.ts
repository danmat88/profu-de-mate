import { getApp } from '@react-native-firebase/app';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { getCrashlytics, setCrashlyticsCollectionEnabled } from '@react-native-firebase/crashlytics';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { clearFavoriteLessonsCache } from '../../lessons/services/lessons';
import { clearCachedCommercialAccess } from '../../access/services/commercialAccessCache';
import { confirmGoogleIdentityForDeletion, pendingGoogleMergeTickets, removePendingGoogleMergesForUser } from '../../access/services/commercial';
import { initializeVerifiedFirebaseServices, markFirebaseUserDeleted, resetFirebaseInitialization } from '../../../shared/services/firebase';
import { recordDiagnosticError } from '../../../shared/services/diagnostics';
import { clearLocalPreferences } from '../../../shared/storage/localPreferences';
import { clearExamLocalState } from '../../exams/services/examStorage';
import { clearPracticeLocalState } from '../../practice/services/practiceStorage';
import { clearStudyLocalState } from '../../study/services/studyStorage';
import { stopStudyProgressSync } from '../../study/services/studySync';
import { clearPendingAnalysis } from '../../analysis/services/pendingAnalysis';
import { clearMathDrafts } from '../../math/services/mathDraft';
import { clearTemporaryCapturedImages } from '../../capture/services/temporaryImages';
import { getInstallationToken } from '../../../shared/services/installationIdentity';
import { resetPurchasesForSignedOutUser } from '../../access/services/purchases';
import { assertSessionActive, captureSession, invalidateSessionOperations } from '../../../shared/services/sessionGuard';

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

  stopStudyProgressSync();
  clearTemporaryCapturedImages();
  clearPendingAnalysis();
  clearMathDrafts();
  clearLocalPreferences();
  clearExamLocalState();
  clearPracticeLocalState();
  clearStudyLocalState();
  clearFavoriteLessonsCache();
  let localSignOutPending = false;
  try { await signOut(getAuth(app)); } catch (error) {
    localSignOutPending = true;
    recordDiagnosticError('data_deletion', error);
  }
  // Await fast local SecureStore cleanup before CommercialContext refreshes the
  // replacement guest session, preventing a late delete from wiping the new cache.
  await Promise.allSettled([
    clearCachedCommercialAccess(),
    removePendingGoogleMergesForUser(user.uid),
  ]);
  void Promise.allSettled([
    setCrashlyticsCollectionEnabled(getCrashlytics(app), false),
    resetPurchasesForSignedOutUser(),
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
