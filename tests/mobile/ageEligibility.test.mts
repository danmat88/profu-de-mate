import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  canConfirmAgeEligibility,
  createAgeEligibilityConfirmation,
  parseAgeEligibilityConfirmation,
} from '../../src/shared/utils/ageEligibility.ts';

test('canConfirmAgeEligibility enforces parental confirmation for 13-15 and allows 16+ or parent directly', () => {
  assert.equal(canConfirmAgeEligibility(null, false), false);
  assert.equal(canConfirmAgeEligibility(null, true), false);
  assert.equal(canConfirmAgeEligibility('13_15_parental', false), false);
  assert.equal(canConfirmAgeEligibility('13_15_parental', true), true);
  assert.equal(canConfirmAgeEligibility('16_plus', false), true);
  assert.equal(canConfirmAgeEligibility('parent', false), true);
});

test('age eligibility serialization stores only privacy-minimized group and rejects malformed payloads', () => {
  const confirmation = createAgeEligibilityConfirmation('13_15_parental', 1_760_000_000_123.9);
  assert.deepEqual(confirmation, {
    version: 1,
    group: '13_15_parental',
    confirmedAt: 1_760_000_000_123,
  });

  const parsed = parseAgeEligibilityConfirmation(JSON.stringify(confirmation));
  assert.deepEqual(parsed, confirmation);

  assert.equal(parseAgeEligibilityConfirmation(''), null);
  assert.equal(parseAgeEligibilityConfirmation('{invalid'), null);
  assert.equal(parseAgeEligibilityConfirmation(JSON.stringify({ version: 2, group: '16_plus', confirmedAt: 100 })), null);
  assert.equal(parseAgeEligibilityConfirmation(JSON.stringify({ version: 1, group: 'under_13', confirmedAt: 100 })), null);
  assert.equal(parseAgeEligibilityConfirmation(JSON.stringify({ version: 1, group: '16_plus', confirmedAt: 0 })), null);
});

test('AgeConsentSheet uses unified ComicBottomSheet, links to Legal, clears on data deletion, and stays free of Reanimated', async () => {
  const [sheetSource, studioSource, prefsSource] = await Promise.all([
    readFile(new URL('../../src/features/account/components/AgeConsentSheet.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/app/screens/StudioScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/shared/storage/localPreferences.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(sheetSource, /<ComicBottomSheet/);
  assert.match(sheetSource, /dismissible=\{false\}/);
  assert.doesNotMatch(sheetSource, /react-native-reanimated/);
  assert.doesNotMatch(sheetSource, /<SafeAreaView/);
  assert.match(sheetSource, /13–15/);
  assert.match(sheetSource, /16\+/);
  assert.match(sheetSource, /părintelui sau tutorelui/);
  assert.match(sheetSource, /onOpenLegal/);

  assert.match(studioSource, /<AgeConsentSheet/);
  assert.match(studioSource, /navigation\.navigate\('Legal'\)/);
  assert.match(studioSource, /hasConfirmedAgeEligibility\(\)/);
  assert.match(studioSource, /saveAgeEligibilityConfirmation\(group\)/);

  assert.match(prefsSource, /age-eligibility-v1\.json/);
  assert.match(prefsSource, /if \(ageEligibilityFile\.exists\) ageEligibilityFile\.delete\(\);/);
});
