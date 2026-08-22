export const legalDocument = {
  updatedAt: '22 august 2026',
  minimumAge: 13,
  operatorName: '',
  contactEmail: '',
} as const;

export const legalIdentityIsComplete = Boolean(
  legalDocument.operatorName.trim() && legalDocument.contactEmail.trim(),
);
