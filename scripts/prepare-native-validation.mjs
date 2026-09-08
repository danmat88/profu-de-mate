import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = path.join(root, 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const directory = fs.mkdtempSync(path.join(artifacts, 'native-check-'));
for (const entry of ['assets', 'src', 'scripts', 'vendor', 'package.json', 'package-lock.json', 'App.tsx', 'index.ts', 'app.json', 'app.config.js', 'babel.config.js', 'metro.config.js', 'tsconfig.json', 'firebase.json']) {
  if (fs.existsSync(path.join(root, entry))) fs.cpSync(path.join(root, entry), path.join(directory, entry), { recursive: true });
}
fs.symlinkSync(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
// A synthetic Firebase project prevents this diagnostic APK from touching product data.
const projectNumber = '123456789';
const clientId = `${projectNumber}-nativefixture.apps.googleusercontent.com`;
fs.writeFileSync(path.join(directory, 'google-services.json'), JSON.stringify({
  project_info: { project_number: projectNumber, project_id: 'demo-profu-native', storage_bucket: 'demo-profu-native.invalid' },
  client: [{ client_info: { mobilesdk_app_id: `1:${projectNumber}:android:abcdef0123456789`, android_client_info: { package_name: 'ro.profudemate.app' } },
    oauth_client: [{ client_type: 3, client_id: clientId }], api_key: [{ current_key: 'fixture-not-a-real-api-key' }] }], configuration_version: '1',
}));
const env = { ...process.env, CI: '1', EXPO_NO_DOTENV: '1', EXPO_NO_GIT_STATUS: '1',
  GOOGLE_SERVICES_JSON: path.join(directory, 'google-services.json'),
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: clientId, EXPO_PUBLIC_PLAY_INTEGRITY_PROJECT_NUMBER: projectNumber,
  EXPO_PUBLIC_APP_CHECK_PROVIDER: 'playIntegrity' };
delete env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN;
delete env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
delete env.EAS_BUILD_PROFILE;
const hashes = {};
function fingerprint(dir, prefix = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) fingerprint(path.join(dir, entry.name), relative);
    else hashes[relative] = createHash('sha256').update(fs.readFileSync(path.join(dir, entry.name))).digest('hex');
  }
}
fingerprint(directory);
fs.writeFileSync(path.join(directory, 'source-hashes.json'), JSON.stringify(hashes, null, 2));
console.log(`Native validation workspace: ${directory}`);
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/expo/bin/cli'), 'prebuild', '--platform', 'android', '--no-install', '--skip-dependency-update', 'react-native,react'],
  { cwd: directory, env, stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
if (result.status === 0 && process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `native_directory=${path.join(directory, 'android')}\n`);
}
process.exitCode = result.status ?? 1;
