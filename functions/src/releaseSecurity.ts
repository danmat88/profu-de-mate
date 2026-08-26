export type ReleaseSecurityStage = 'pre-play-public' | 'play';

// The public APK predates Play Console. During this stage Firebase Auth,
// transactional commercial quotas, burst limits, a global provider cap and
// the runtime kill switch remain mandatory, while no reusable App Check debug
// credential is shipped. Move to `play` together with the client provider and
// Firebase enforcement rollout.
export const RELEASE_SECURITY_STAGE: ReleaseSecurityStage = 'pre-play-public';

export function enforceAppCheckForStage(stage: ReleaseSecurityStage): boolean {
  return stage === 'play';
}

export const ENFORCE_APP_CHECK = enforceAppCheckForStage(RELEASE_SECURITY_STAGE);
