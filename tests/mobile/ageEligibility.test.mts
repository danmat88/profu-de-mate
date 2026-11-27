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

test('WelcomeOnboardingScreen blocks Home exclusively until age eligibility is confirmed, links to Legal, clears on data deletion, and stays free of Reanimated', async () => {
  const [onboardingSource, studioSource, prefsSource] = await Promise.all([
    readFile(new URL('../../src/features/account/screens/WelcomeOnboardingScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/app/screens/StudioScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../src/shared/storage/localPreferences.ts', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(onboardingSource, /<ComicBottomSheet/);
  assert.doesNotMatch(onboardingSource, /react-native-reanimated/);
  assert.doesNotMatch(onboardingSource, /<SafeAreaView/);
  assert.match(onboardingSource, /13–15/);
  assert.match(onboardingSource, /16\+/);
  assert.match(onboardingSource, /părintelui sau tutorelui/);
  assert.match(onboardingSource, /onOpenLegal/);
  assert.match(onboardingSource, /canopyEnter/);
  assert.match(onboardingSource, /canopyExit/);
  assert.match(onboardingSource, /celebrateBurst/);

  assert.match(studioSource, /if \(!ageConsentConfirmed\) \{\s*return \(\s*<WelcomeOnboardingScreen/s);
  assert.match(studioSource, /postOnboardingReveal/);
  assert.match(studioSource, /HomeMotionReadyContext\.Provider value=\{effectiveHomeMotionReady\}/);
  assert.match(studioSource, /navigation\.navigate\('Legal'\)/);
  assert.match(studioSource, /hasConfirmedAgeEligibility\(\)/);
  assert.match(studioSource, /saveAgeEligibilityConfirmation\(group\)/);

  assert.match(prefsSource, /age-eligibility-v1\.json/);
  assert.match(prefsSource, /if \(ageEligibilityFile\.exists\) ageEligibilityFile\.delete\(\);/);

  const appSource = await readFile(new URL('../../src/app/App.tsx', import.meta.url), 'utf8');
  assert.match(appSource, /currentStartupSession\(\) && hasConfirmedAgeEligibility\(\)/);
  assert.match(appSource, /startup\.offline && hasConfirmedAgeEligibility\(\)/);
});

test('in-app LegalScreen and public web legal pages stay aligned on Romania 16+, GDPR rights, OpenAI transfers, and ANPC/ANSPDCP', async () => {
  const [legalScreenSource, privacyHtml, termsHtml, settingsSource] = await Promise.all([
    readFile(new URL('../../src/features/account/screens/LegalScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../hosting/public/confidentialitate.html', import.meta.url), 'utf8'),
    readFile(new URL('../../hosting/public/termeni.html', import.meta.url), 'utf8'),
    readFile(new URL('../../src/features/account/screens/SettingsScreen.tsx', import.meta.url), 'utf8'),
  ]);

  for (const doc of [legalScreenSource, privacyHtml]) {
    assert.match(doc, /OpenAI/);
    assert.match(doc, /190\/2018/);
    assert.match(doc, /16 ani/);
    assert.match(doc, /ANSPDCP/);
    assert.match(doc, /dataprotection\.ro/);
    assert.match(doc, /Clauze(?:le)? Contractuale Standard/);
    assert.match(doc, /Art\. 6/);
  }

  for (const doc of [legalScreenSource, termsHtml]) {
    assert.match(doc, /34\/2014/);
    assert.match(doc, /ANPC/);
    assert.match(doc, /anpc\.ro/);
    assert.match(doc, /legea română/i);
  }

  assert.match(settingsSource, /Ajutor și suport/);
  assert.match(settingsSource, /legalDocument\.supportEmail/);
});
