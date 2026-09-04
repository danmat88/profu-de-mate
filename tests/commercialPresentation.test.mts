import assert from 'node:assert/strict';
import test from 'node:test';
import type { CommercialAccess } from '../src/types.ts';
import { allowancePresentation } from '../src/utils/commercialPresentation.ts';

function access(overrides: Partial<CommercialAccess> = {}): CommercialAccess {
  return {
    identity: 'anonymous',
    tier: 'guest',
    limit: 5,
    used: 1,
    remaining: 4,
    canAnalyze: true,
    reason: 'available',
    resetAt: null,
    purchaseUserId: `i_${'a'.repeat(64)}`,
    allowances: { welcome: 5, freeDaily: 5, premiumDaily: 30 },
    premium: { active: false, productId: null, expiresAt: null },
    deviceRecall: { shouldVerify: false, verified: false },
    ...overrides,
  };
}

test('presents guest, free, migrated legacy and Premium access without ambiguity', () => {
  assert.deepEqual(allowancePresentation(access(), 'ready'), {
    label: '4 din 5 cadou',
    note: 'PROBLEME',
    accessibilityLabel: '4 din 5 cadou. Deschide opțiunile de acces.',
    canOpenAccess: true,
    canRetry: false,
  });

  assert.equal(allowancePresentation(access({ identity: 'google', tier: 'free' }), 'ready').label, '4 din 5 azi');
  assert.deepEqual(
    allowancePresentation(access({ canAnalyze: false, reason: 'account_required', remaining: 0, used: 5 }), 'ready'),
    {
      label: '0 din 5 cadou',
      note: 'PROBLEME',
      accessibilityLabel: '0 din 5 cadou. Deschide opțiunile de acces.',
      canOpenAccess: true,
      canRetry: false,
    },
  );
  assert.equal(allowancePresentation(access({ identity: 'google', tier: 'premium', premium: { active: true, productId: 'profu_premium', expiresAt: null } }), 'ready').note, 'PREMIUM');
});

test('uses stable unresolved and actionable failure states without inventing a quota', () => {
  assert.deepEqual(allowancePresentation(null, 'resolving'), {
    label: '— din —',
    note: 'PROBLEME',
    accessibilityLabel: 'Pregătim numărul de probleme disponibile.',
    canOpenAccess: false,
    canRetry: false,
  });
  assert.deepEqual(allowancePresentation(null, 'unavailable'), {
    label: 'Reîncearcă',
    note: 'PROBLEME',
    accessibilityLabel: 'Accesul nu a putut fi încărcat. Încearcă din nou.',
    canOpenAccess: false,
    canRetry: true,
  });
});
