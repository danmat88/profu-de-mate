import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
// A demo project has no billable cloud resources. Never use the selected CLI project.
const result = spawnSync(process.execPath, [
  'node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:exec',
  '--project', 'demo-profu-de-mate', '--only', 'auth,firestore',
  'node --test tests/firestore.rules.test.mjs functions/integration/*.test.mjs',
], { cwd: root, stdio: 'inherit', env: { ...process.env, DEBUG: '', CI: 'true', FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true' }, windowsHide: true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
