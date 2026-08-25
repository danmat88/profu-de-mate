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

test('allows only Camera and explicitly removes sensitive inherited permissions', async () => {
  const config = await loadConfig();
  const android = config.expo?.android;

  assert.deepEqual(android?.permissions, ['android.permission.CAMERA']);
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
