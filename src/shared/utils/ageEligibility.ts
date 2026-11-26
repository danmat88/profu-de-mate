export type AgeEligibilityGroup = '16_plus' | '13_15_parental' | 'parent';

export type AgeEligibilityConfirmation = {
  version: 1;
  group: AgeEligibilityGroup;
  confirmedAt: number;
};

const VALID_GROUPS = new Set<string>(['16_plus', '13_15_parental', 'parent']);

export function canConfirmAgeEligibility(
  group: AgeEligibilityGroup | null,
  parentalConfirmed: boolean,
): boolean {
  if (!group) return false;
  if (group === '13_15_parental') return parentalConfirmed;
  return true;
}

export function createAgeEligibilityConfirmation(
  group: AgeEligibilityGroup,
  now = Date.now(),
): AgeEligibilityConfirmation {
  return {
    version: 1,
    group,
    confirmedAt: Math.trunc(now),
  };
}

export function parseAgeEligibilityConfirmation(raw: string): AgeEligibilityConfirmation | null {
  try {
    const parsed = JSON.parse(raw) as Partial<AgeEligibilityConfirmation> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== 1) return null;
    if (typeof parsed.group !== 'string' || !VALID_GROUPS.has(parsed.group)) return null;
    if (typeof parsed.confirmedAt !== 'number' || !Number.isFinite(parsed.confirmedAt) || parsed.confirmedAt <= 0) {
      return null;
    }
    return {
      version: 1,
      group: parsed.group as AgeEligibilityGroup,
      confirmedAt: Math.trunc(parsed.confirmedAt),
    };
  } catch {
    return null;
  }
}
