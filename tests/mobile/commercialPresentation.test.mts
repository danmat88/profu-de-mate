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
    allowances: { welcome: 5, freeDaily: 5, premiumDaily: 50, maxDaily: 150 },
    premium: { active: false, tier: null, productId: null, expiresAt: null },
    deviceRecall: { shouldVerify: false, verified: false },
    ...overrides,
  };
}

test('presents unified daily free, Pro, and Max access cleanly without guest/account ambiguity', () => {
  assert.deepEqual(allowancePresentation(access()), {
    label: '4 din 5 azi',
    note: 'VEZI PRO',
    accessibilityLabel: '4 din 5 azi. Descoperă Profu’ Pro și Max.',
  });

  assert.equal(allowancePresentation(access({ identity: 'google', tier: 'free' })).label, '4 din 5 azi');
  assert.deepEqual(
    allowancePresentation(access({ canAnalyze: false, reason: 'daily_exhausted', remaining: 0, used: 5 })),
    {
      label: '0 din 5 azi',
      note: 'VEZI PRO',
      accessibilityLabel: '0 din 5 azi. Descoperă Profu’ Pro și Max.',
    },
  );
  assert.equal(
    allowancePresentation(access({ identity: 'google', tier: 'premium', limit: 50, remaining: 42, premium: { active: true, tier: 'pro', productId: 'profu_pro', expiresAt: null } })).note,
    'PRO',
  );
  assert.equal(
    allowancePresentation(access({ identity: 'google', tier: 'premium', limit: 150, remaining: 140, premium: { active: true, tier: 'max', productId: 'profu_max', expiresAt: null } })).note,
    'MAX',
  );
});
