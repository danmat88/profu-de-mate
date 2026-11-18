export type ReleaseSecurityStage = 'pre-play-public' | 'play';

// Missing deployment configuration must retain attestation. The legacy
// pre-Play exception is explicit and must never be inferred from an unset env.
export function releaseSecurityStageFromEnvironment(value: string | undefined): ReleaseSecurityStage {
  if (!value) return 'play';
  if (value === 'pre-play-public' || value === 'play') return value;
  throw new Error(`Stadiu de securitate necunoscut: ${value}`);
}

export const RELEASE_SECURITY_STAGE = releaseSecurityStageFromEnvironment(
  process.env.PROFU_RELEASE_SECURITY_STAGE,
);

export function enforceAppCheckForStage(stage: ReleaseSecurityStage): boolean {
  return stage === 'play';
}

export function defaultDeviceRecallForStage(stage: ReleaseSecurityStage): 'off' | 'enforce' {
  return stage === 'play' ? 'enforce' : 'off';
}

export const ENFORCE_APP_CHECK = enforceAppCheckForStage(RELEASE_SECURITY_STAGE);
