import type { CommercialAccess } from '../../../shared/types';

export type AllowancePresentation = {
  label: string;
  note: 'PRO' | 'MAX' | 'VEZI PRO';
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
  const label = `${access.remaining} din ${access.limit} azi`;
  const note = access.premium.active
    ? access.premium.tier === 'max' ? 'MAX' : 'PRO'
    : 'VEZI PRO';
  const actionLabel = access.premium.active
    ? access.premium.tier === 'max'
      ? 'Administrează Profu’ Max.'
      : 'Administrează Profu’ Pro.'
    : 'Descoperă Profu’ Pro și Max.';
  return {
    label,
    note,
    accessibilityLabel: `${label}. ${actionLabel}`,
  };
}
