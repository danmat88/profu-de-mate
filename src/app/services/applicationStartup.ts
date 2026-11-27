import { getCommercialAccess, resetCommercialAccessRequest } from '../../features/access/services/commercial';
import { preparePendingAnalysisOnStartup } from '../../features/analysis/services/pendingAnalysis';
import {
  firebaseUserSessionKey,
  getRestoredFirebaseUser,
  initializeVerifiedFirebaseServices,
  resetFirebaseInitialization,
} from '../../shared/services/firebase';
import { preloadCriticalAppAssets } from './startupAssets';
import { createStartupLoader } from './startupBootstrap';

export function currentStartupSession() {
  const user = getRestoredFirebaseUser();
  const key = firebaseUserSessionKey(user);
  return user && key ? { key, userId: user.uid } : null;
}

export const prepareApplication = createStartupLoader({
  prepareVisuals: preloadCriticalAppAssets,
  // Verify or rotate any deleted/revoked session before capturing the launch
  // session owner, while overlapping App Check attestation with asset preload.
  initializeSession: initializeVerifiedFirebaseServices,
  loadAccess: getCommercialAccess,
  loadPendingAnalysis: preparePendingAnalysisOnStartup,
  currentSession: currentStartupSession,
  onTimeout: () => {
    resetFirebaseInitialization();
    resetCommercialAccessRequest();
  },
});
