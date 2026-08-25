export const legalDocument = {
  updatedAt: '25 august 2026',
  minimumAge: 13,
  // Se completează numai după confirmarea numelui legal exact al publisherului.
  operatorName: '',
  contactEmail: 'info@danielmatei.dev',
} as const;

export const legalIdentityIsComplete = Boolean(
  legalDocument.operatorName.trim() && legalDocument.contactEmail.trim(),
);
