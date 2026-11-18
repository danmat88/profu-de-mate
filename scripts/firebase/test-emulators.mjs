import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectFirebaseLogs } from '../lib/local-output.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
// A demo project has no billable cloud resources. Never use the selected CLI project.
try {
  const result = spawnSync(process.execPath, [
    'node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:exec',
    '--project', 'demo-profu-de-mate', '--only', 'auth,firestore',
    'node --test tests/firestore/firestore.rules.test.mjs functions/tests/integration/*.test.mjs',
  ], { cwd: root, stdio: 'inherit', env: { ...process.env, DEBUG: '', CI: 'true', FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true' }, windowsHide: true });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  collectFirebaseLogs();
}
