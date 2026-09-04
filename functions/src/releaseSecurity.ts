export type ReleaseSecurityStage = 'pre-play-public' | 'play';

// The public APK predates Play Console. During this stage Firebase Auth,
// transactional commercial quotas, burst limits, a global provider cap and
// the runtime kill switch remain mandatory, while no reusable App Check debug
// credential is shipped. Production Play deployments must explicitly set
// PROFU_RELEASE_SECURITY_STAGE=play together with Play Integrity rollout.
export function releaseSecurityStageFromEnvironment(value: string | undefined): ReleaseSecurityStage {
  if (!value) return 'pre-play-public';
  if (value === 'pre-play-public' || value === 'play') return value;
  throw new Error(`Stadiu de securitate necunoscut: ${value}`);
}

export const RELEASE_SECURITY_STAGE = releaseSecurityStageFromEnvironment(
  process.env.PROFU_RELEASE_SECURITY_STAGE,
);

export function enforceAppCheckForStage(stage: ReleaseSecurityStage): boolean {
  return stage === 'play';
}

export const ENFORCE_APP_CHECK = enforceAppCheckForStage(RELEASE_SECURITY_STAGE);
