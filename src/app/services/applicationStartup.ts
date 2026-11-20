import { getCommercialAccess } from '../../features/access/services/commercial';
import { preparePendingAnalysisOnStartup } from '../../features/analysis/services/pendingAnalysis';
import { prewarmFavoriteLessonsCache } from '../../features/lessons/services/lessons';
import { recordDiagnosticError } from '../../shared/services/diagnostics';
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
  initializeSession: async () => {
    const user = await initializeFirebaseServices();
    void prewarmFavoriteLessonsCache().catch((error) => recordDiagnosticError('notebook_prewarm', error));
    return user;
  },
  loadAccess: getCommercialAccess,
  loadPendingAnalysis: preparePendingAnalysisOnStartup,
  currentSession: currentStartupSession,
});
