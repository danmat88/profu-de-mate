import { getCommercialAccess } from '../../features/access/services/commercial';
import { preparePendingAnalysisOnStartup } from '../../features/analysis/services/pendingAnalysis';
import { firebaseUserSessionKey, getRestoredFirebaseUser, initializeFirebaseServices } from '../../shared/services/firebase';
import { preloadCriticalAppAssets } from './startupAssets';
import { createStartupLoader } from './startupBootstrap';

export function currentStartupSession() {
  const user = getRestoredFirebaseUser();
  const key = firebaseUserSessionKey(user);
  return user && key ? { key, userId: user.uid } : null;
}

export const prepareApplication = createStartupLoader({
  prepareVisuals: preloadCriticalAppAssets,
  // Notebook cache prewarming runs cleanly in CommercialContext right after
  // launch settles so Firestore document validation never blocks the splash bar.
  initializeSession: initializeFirebaseServices,
  loadAccess: getCommercialAccess,
  loadPendingAnalysis: preparePendingAnalysisOnStartup,
  currentSession: currentStartupSession,
});
