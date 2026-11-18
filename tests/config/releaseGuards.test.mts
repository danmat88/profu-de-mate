import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { deflateRawSync } from 'node:zlib';
// @ts-expect-error Release tooling intentionally runs as dependency-free JavaScript.
import { archiveEntries, assertNoDebugTokens, assertReleaseCertificate, assertReleaseManifest } from '../../scripts/release/release-artifact.mjs';

const require = createRequire(import.meta.url);
const webClient = '123456789-valid.apps.googleusercontent.com';
function validator(environment: Record<string, string>) {
  const module = { exports: {} as { validateClientEnvironment: (mode: string) => unknown } };
  const source = fs.readFileSync(new URL('../../scripts/env/validate-client-env.cjs', import.meta.url), 'utf8');
  vm.runInNewContext(source, {
    module,
    require: (name: string) => name === 'node:fs' ? {
      existsSync: () => true,
      readFileSync: () => JSON.stringify({ client: [{ client_info: { android_client_info: { package_name: 'ro.profudemate.app' } }, oauth_client: [{ client_type: 3, client_id: webClient }] }] }),
    } : require(name),
    process: { cwd: () => process.cwd(), env: {
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: webClient,
      EXPO_PUBLIC_PLAY_INTEGRITY_PROJECT_NUMBER: '123456789', ...environment,
    } },
  });
  return module.exports.validateClientEnvironment;
}

test('actual environment validator refuses debug, missing attestation and debug secrets in production', () => {
  for (const provider of ['debug', 'none', 'typo']) {
    assert.throws(() => validator({ EXPO_PUBLIC_APP_CHECK_PROVIDER: provider })('production'));
  }
  assert.throws(() => validator({ EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN: 'private-test-token' })('production'));
  assert.throws(() => validator({ PROFU_RELEASE_SECURITY_STAGE: 'pre-play-public' })('production'));
  assert.doesNotThrow(() => validator({})('production'));
  assert.doesNotThrow(() => validator({ EXPO_PUBLIC_APP_CHECK_PROVIDER: 'playIntegrity' })('production'));
});

test('development uses an explicitly configured debug token', () => {
  assert.throws(() => validator({})('development'));
  assert.doesNotThrow(() => validator({ EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN: 'private-test-token' })('development'));
});

test('the explicit pre-Play APK keeps its existing none provider without reusable debug credentials', () => {
  assert.doesNotThrow(() => validator({})('production-apk'));
  assert.doesNotThrow(() => validator({ EXPO_PUBLIC_APP_CHECK_PROVIDER: 'none', PROFU_RELEASE_SECURITY_STAGE: 'pre-play-public' })('production-apk'));
  assert.throws(() => validator({ EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN: 'private-test-token' })('production-apk'));
  assert.throws(() => validator({ EXPO_PUBLIC_APP_CHECK_PROVIDER: 'debug' })('production-apk'));
  assert.throws(() => validator({ PROFU_RELEASE_SECURITY_STAGE: 'play' })('production-apk'));
});

test('all actual EAS profiles resolve their own validation mode even with NODE_ENV=production', () => {
  const eas = JSON.parse(fs.readFileSync(new URL('../../eas.json', import.meta.url), 'utf8'));
  const source = fs.readFileSync(new URL('../../app.config.js', import.meta.url), 'utf8');
  const expected = { development: 'debug', preview: 'debug', 'production-apk': 'none', production: 'playIntegrity' };
  for (const [profile, provider] of Object.entries(expected)) {
    const calls: { mode: string; provider: string }[] = [];
    const module = { exports: null as any };
    vm.runInNewContext(source, {
      module, process: { env: { NODE_ENV: 'production', EAS_BUILD_PROFILE: profile, ...eas.build[profile].env } },
      require: () => ({ validateClientEnvironment: (mode: string, options: any) => calls.push({ mode, provider: options.expectedAppCheckProvider }) }),
    });
    const config = module.exports({ config: { plugins: [], android: {} } });
    assert.deepEqual(calls, [{ mode: profile, provider }]);
    const properties = config.plugins.find((p: any) => Array.isArray(p) && p[0] === 'expo-build-properties')[1];
    assert.equal(properties.android.cmakeVersion, undefined);
    assert.equal(eas.build[profile].android.buildType, profile === 'production' ? 'app-bundle' : 'apk');
  }
});

test('release signatures reject debug identities and require the expected upload certificate', () => {
  const sha = 'ab'.repeat(32);
  assert.throws(() => assertReleaseCertificate(`CN=Android Debug\nSHA-256 digest: ${sha}`, sha));
  assert.throws(() => assertReleaseCertificate(`SHA-256 digest: ${sha}`, undefined));
  assert.throws(() => assertReleaseCertificate(`SHA-256 digest: ${sha}`, 'cd'.repeat(32)));
  assert.doesNotThrow(() => assertReleaseCertificate(`Signer #1 certificate SHA-256 digest: ${sha}`, sha));
  assert.doesNotThrow(() => assertReleaseCertificate(`SHA256: ${sha.match(/../g)?.join(':')}`, sha));
});

test('actual manifest output must be non-debuggable, correct package and API 36+', () => {
  const xml = '<manifest package="ro.profudemate.app"><uses-sdk android:targetSdkVersion="36"/><application android:debuggable="false"/></manifest>';
  assert.doesNotThrow(() => assertReleaseManifest(xml));
  assert.throws(() => assertReleaseManifest(xml.replace('debuggable="false"', 'debuggable="true"')));
  assert.throws(() => assertReleaseManifest(xml.replace('targetSdkVersion="36"', 'targetSdkVersion="35"')));
  assert.throws(() => assertReleaseManifest(xml.replace('ro.profudemate.app', 'another.package')));
  assert.doesNotThrow(() => assertReleaseManifest('package="ro.profudemate.app"\nandroid:targetSdkVersion(0x01010270)=(type 0x10)0x24'));
  const aapt36 = 'package="ro.profudemate.app"\nA: http://schemas.android.com/apk/res/android:targetSdkVersion(0x01010270)=36';
  assert.doesNotThrow(() => assertReleaseManifest(aapt36));
  assert.throws(() => assertReleaseManifest(aapt36.replace('=36', '=35')));
  assert.throws(() => assertReleaseManifest(aapt36 + '\nA: android:debuggable(0x0101000f)=true'));
  assert.throws(() => assertReleaseManifest('package="ro.profudemate.app"\nandroid:targetSdkVersion(0x01010270)=(type 0x10)0x24\nandroid:debuggable(0x0101000f)=(type 0x12)0xffffffff'));
});

test('archive scanner finds a debug token inside a compressed Hermes bundle without revealing it', () => {
  const name = Buffer.from('assets/index.android.bundle');
  const plain = Buffer.from('Hermes bytes private-test-token ending');
  const data = deflateRawSync(plain);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(plain.length, 22); local.writeUInt16LE(name.length, 26);
  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(8, 10); directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(plain.length, 24); directory.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 10); end.writeUInt32LE(local.length + name.length + data.length, 16);
  const entries = archiveEntries(Buffer.concat([local, name, data, directory, name, end]));
  assert.equal(entries[0].data.toString(), plain.toString());
  assert.throws(() => assertNoDebugTokens(entries, ['private-test-token']), (error: Error) => {
    assert.match(error.message, /assets\/index.android.bundle/);
    assert.doesNotMatch(error.message, /private-test-token/);
    return true;
  });
  assert.doesNotThrow(() => assertNoDebugTokens(entries, ['different-token']));
});
