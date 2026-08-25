import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

type ExpoConfig = {
  expo?: {
    platforms?: string[];
    android?: {
      allowBackup?: boolean;
      blockedPermissions?: string[];
      permissions?: string[];
    };
  };
};

async function loadConfig(): Promise<ExpoConfig> {
  return JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8')) as ExpoConfig;
}

test('keeps Android backup disabled for private local data', async () => {
  const config = await loadConfig();
  assert.equal(config.expo?.android?.allowBackup, false);
});

test('allows only Camera and Google Play Billing and explicitly removes sensitive inherited permissions', async () => {
  const config = await loadConfig();
  const android = config.expo?.android;

  assert.deepEqual(android?.permissions, ['android.permission.CAMERA', 'com.android.vending.BILLING']);
  [
    'android.permission.SYSTEM_ALERT_WINDOW',
    'com.google.android.gms.permission.AD_ID',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.RECORD_AUDIO',
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
  ].forEach((permission) => assert.ok(android?.blockedPermissions?.includes(permission), `${permission} trebuie blocată explicit.`));
});

test('keeps the supported release surface Android-only', async () => {
  const config = await loadConfig();
  assert.deepEqual(config.expo?.platforms, ['android']);
});

test('uses modern Android Credential Manager instead of legacy Google Sign-In', async () => {
  const [appConfig, packageJson] = await Promise.all([
    readFile(new URL('../app.config.js', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ]);
  const dependencies = (JSON.parse(packageJson) as { dependencies?: Record<string, string> }).dependencies ?? {};

  assert.match(appConfig, /react-native-nitro-google-signin/);
  assert.equal(dependencies['react-native-nitro-google-signin'], '^2.1.0');
  assert.equal(dependencies['react-native-nitro-modules'], '^0.37.0');
  assert.equal(dependencies['@react-native-google-signin/google-signin'], undefined);
});

test('loads and validates the EAS development environment before Metro starts', async () => {
  const [packageJson, easJson, appConfig, validator] = await Promise.all([
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../eas.json', import.meta.url), 'utf8'),
    readFile(new URL('../app.config.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/validate-client-env.cjs', import.meta.url), 'utf8'),
  ]);
  const scripts = (JSON.parse(packageJson) as { scripts?: Record<string, string> }).scripts ?? {};
  const eas = JSON.parse(easJson) as {
    build?: Record<string, { environment?: string; env?: Record<string, string> }>;
  };

  assert.match(scripts.start ?? '', /dev:phone/);
  assert.match(scripts['dev:phone'] ?? '', /env:sync:development/);
  assert.match(scripts['env:sync:development'] ?? '', /npx --yes eas-cli@22\.2\.0 env:pull development/);
  assert.match(scripts['env:check:development'] ?? '', /npx --yes eas-cli@22\.2\.0 env:exec development/);
  assert.match(scripts['dev:phone:local'] ?? '', /validate-client-env\.cjs development/);
  assert.equal(eas.build?.development?.environment, 'development');
  assert.equal(eas.build?.preview?.environment, 'preview');
  assert.equal(eas.build?.production?.environment, 'production');
  assert.equal(eas.build?.development?.env?.EXPO_PUBLIC_APP_CHECK_PROVIDER, 'debug');
  assert.equal(eas.build?.preview?.env?.EXPO_PUBLIC_APP_CHECK_PROVIDER, 'debug');
  assert.equal(eas.build?.production?.env?.EXPO_PUBLIC_APP_CHECK_PROVIDER, undefined);
  assert.match(appConfig, /EAS_BUILD_PROFILE/);
  assert.match(appConfig, /validateClientEnvironment/);
  assert.match(validator, /EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID/);
  assert.match(validator, /EXPO_PUBLIC_PLAY_INTEGRITY_PROJECT_NUMBER/);
  assert.match(validator, /EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN/);
});
