import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const firebaseCli = require.resolve('firebase-tools/lib/bin/firebase');
const projectId = 'profu-de-mate-danmat88';

const result = spawnSync(process.execPath, [
  firebaseCli,
  'deploy',
  '--only',
  'functions,firestore:rules,firestore:indexes,hosting',
  '--project',
  projectId,
], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT ?? '60',
  },
  stdio: 'inherit',
});

if (result.error) {
  console.error('Firebase CLI nu a putut porni.', result.error);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
