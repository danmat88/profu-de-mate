export const legalDocument = {
  updatedAt: '26 noiembrie 2026',
  minimumAge: 13,
  operatorName: 'Daniel Matei',
  contactEmail: 'privacy@profudemate.app',
  supportEmail: 'support@profudemate.app',
  billingEmail: 'billing@profudemate.app',
} as const;

export const legalIdentityIsComplete = Boolean(
  legalDocument.operatorName.trim() && legalDocument.contactEmail.trim(),
);
