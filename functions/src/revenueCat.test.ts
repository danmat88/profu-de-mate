import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  parseRevenueCatEntitlement,
  parseRevenueCatWebhook,
  secureSecretEquals,
  verifyRevenueCatSignature,
} from './revenueCat.js';

test('accepts an active RevenueCat entitlement and honors a grace period', () => {
  const now = Date.parse('2026-08-25T10:00:00.000Z');
  assert.deepEqual(parseRevenueCatEntitlement({ subscriber: { entitlements: { premium: {
    expires_date: '2026-08-25T09:00:00.000Z',
    grace_period_expires_date: '2026-08-26T09:00:00.000Z',
    product_identifier: 'premium_monthly',
  } } } }, 'premium', now), {
    active: true,
    productId: 'premium_monthly',
    expiresAtMs: Date.parse('2026-08-26T09:00:00.000Z'),
  });
});

test('treats missing and expired entitlements as inactive', () => {
  const now = Date.parse('2026-08-25T10:00:00.000Z');
  assert.deepEqual(parseRevenueCatEntitlement({}, 'premium', now), { active: false, productId: null, expiresAtMs: null });
  assert.equal(parseRevenueCatEntitlement({ subscriber: { entitlements: { premium: {
    expires_date: '2026-08-25T09:00:00.000Z',
    product_identifier: 'premium_monthly',
  } } } }, 'premium', now).active, false);
});

test('verifies the raw RevenueCat webhook body with timestamp tolerance', () => {
  const secret = 'signing-secret';
  const timestamp = '1787652000';
  const body = Buffer.from('{"event":{"id":"evt_1"}}');
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body.toString('utf8')}`).digest('hex');
  const header = `t=${timestamp},v1=${signature}`;
  assert.equal(verifyRevenueCatSignature(body, header, secret, Number(timestamp)), true);
  assert.equal(verifyRevenueCatSignature(Buffer.from('{}'), header, secret, Number(timestamp)), false);
  assert.equal(verifyRevenueCatSignature(body, header, secret, Number(timestamp) + 301), false);
});

test('extracts stable commercial ids and rejects RevenueCat anonymous aliases', () => {
  const account = `g_${'a'.repeat(64)}`;
  const target = `g_${'b'.repeat(64)}`;
  assert.deepEqual(parseRevenueCatWebhook({ event: {
    id: 'evt_123',
    type: 'RENEWAL',
    app_user_id: account,
    aliases: ['$RCAnonymousID:abc', account],
    transferred_to: [target],
  } }), {
    eventId: 'evt_123',
    appUserIds: [account, target],
    eventType: 'RENEWAL',
  });
  assert.equal(parseRevenueCatWebhook({ event: { id: '../bad', app_user_id: 'user' } }), null);
});

test('compares webhook authorization without partial matches', () => {
  assert.equal(secureSecretEquals('Bearer exact', 'Bearer exact'), true);
  assert.equal(secureSecretEquals('Bearer exac', 'Bearer exact'), false);
  assert.equal(secureSecretEquals(undefined, 'Bearer exact'), false);
});
