import assert from 'node:assert/strict';
import test from 'node:test';
import type { CommercialAccess } from '../../src/shared/types/index.ts';
import { allowancePresentation } from '../../src/features/access/utils/commercialPresentation.ts';

function access(overrides: Partial<CommercialAccess> = {}): CommercialAccess {
  return {
    identity: 'anonymous',
    tier: 'guest',
    limit: 5,
    used: 1,
    remaining: 4,
    canAnalyze: true,
    reason: 'available',
    resetAt: '2026-09-20T21:00:00.000Z',
    purchaseUserId: `i_${'a'.repeat(64)}`,
    allowances: { welcome: 5, freeDaily: 5, premiumDaily: 30 },
    premium: { active: false, productId: null, expiresAt: null },
    deviceRecall: { shouldVerify: false, verified: false },
    ...overrides,
  };
}

test('presents unified daily free and Premium access cleanly without guest/account ambiguity', () => {
  assert.deepEqual(allowancePresentation(access()), {
    label: '4 din 5 azi',
    note: 'VEZI PREMIUM',
    accessibilityLabel: '4 din 5 azi. Descoperă Profu’ Premium.',
  });

  assert.equal(allowancePresentation(access({ identity: 'google', tier: 'free' })).label, '4 din 5 azi');
  assert.deepEqual(
    allowancePresentation(access({ canAnalyze: false, reason: 'daily_exhausted', remaining: 0, used: 5 })),
    {
      label: '0 din 5 azi',
      note: 'VEZI PREMIUM',
      accessibilityLabel: '0 din 5 azi. Descoperă Profu’ Premium.',
    },
  );
  assert.equal(allowancePresentation(access({ identity: 'google', tier: 'premium', premium: { active: true, productId: 'profu_premium', expiresAt: null } })).note, 'PREMIUM');
});
