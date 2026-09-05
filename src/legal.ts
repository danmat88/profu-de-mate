export const legalDocument = {
  updatedAt: '5 septembrie 2026',
  minimumAge: 13,
  operatorName: 'Daniel Matei',
  contactEmail: 'privacy@danielmatei.dev',
  supportEmail: 'support@danielmatei.dev',
  billingEmail: 'billing@danielmatei.dev',
} as const;

export const legalIdentityIsComplete = Boolean(
  legalDocument.operatorName.trim() && legalDocument.contactEmail.trim(),
);
