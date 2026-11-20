import type { CommercialAccess } from '../../../shared/types';

export type AllowancePresentation = {
  label: string;
  note: 'PREMIUM' | 'VEZI PREMIUM';
  accessibilityLabel: string;
};

/**
 * Maps canonical commercial state to a fixed-shape Home presentation. This
 * function never invents a quota while the server is unresolved and never
 * exposes internal implementation language such as "verific" to the user.
 */
export function allowancePresentation(
  access: CommercialAccess,
): AllowancePresentation {
  const label = access.tier === 'guest'
    ? `${access.remaining} din ${access.limit} cadou`
    : `${access.remaining} din ${access.limit} azi`;
  const note = access.premium.active ? 'PREMIUM' : 'VEZI PREMIUM';
  return {
    label,
    note,
    accessibilityLabel: `${label}. ${access.premium.active ? 'Administrează Premium.' : 'Descoperă Profu’ Premium.'}`,
  };
}
