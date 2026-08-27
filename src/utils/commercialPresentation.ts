import type { CommercialAccess, CommercialStatus } from '../types';

export type AllowancePresentation = {
  label: string;
  note: 'PREMIUM' | 'CONT' | 'PROBLEME';
  accessibilityLabel: string;
  canOpenAccess: boolean;
  canRetry: boolean;
};

/**
 * Maps canonical commercial state to a fixed-shape Home presentation. This
 * function never invents a quota while the server is unresolved and never
 * exposes internal implementation language such as "verific" to the user.
 */
export function allowancePresentation(
  access: CommercialAccess | null,
  status: CommercialStatus,
): AllowancePresentation {
  if (access) {
    const label = access.reason === 'account_required'
      ? 'Conectează-te'
      : access.tier === 'guest'
        ? `${access.remaining} din ${access.limit} cadou`
        : `${access.remaining} din ${access.limit} azi`;
    const note = access.premium.active
      ? 'PREMIUM'
      : access.reason === 'account_required'
        ? 'CONT'
        : 'PROBLEME';
    return {
      label,
      note,
      accessibilityLabel: `${label}. Deschide opțiunile de acces.`,
      canOpenAccess: true,
      canRetry: false,
    };
  }

  if (status === 'unavailable') {
    return {
      label: 'Reîncearcă',
      note: 'PROBLEME',
      accessibilityLabel: 'Accesul nu a putut fi încărcat. Încearcă din nou.',
      canOpenAccess: false,
      canRetry: true,
    };
  }

  return {
    label: '— din —',
    note: 'PROBLEME',
    accessibilityLabel: 'Pregătim numărul de probleme disponibile.',
    canOpenAccess: false,
    canRetry: false,
  };
}
