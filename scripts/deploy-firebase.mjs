import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDeployConfiguration } from './deploy-preflight.mjs';

const require = createRequire(import.meta.url);
const firebaseCli = require.resolve('firebase-tools/lib/bin/firebase');
const projectId = 'profu-de-mate-danmat88';
const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let preflight;
try {
  if (process.argv.slice(2).some((argument) => argument !== '--preflight-only')) {
    throw new Error('Argument necunoscut. Folosește --preflight-only pentru verificarea locală fără deploy.');
  }
  preflight = assertDeployConfiguration({ projectDirectory, projectId });
  console.log(`Preflight local valid: ${preflight.projectId}, stage=${preflight.stage}; ${preflight.loadedFiles.join(', ')}. Configurația cloud nu a fost verificată de această comandă.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
if (process.argv.includes('--preflight-only')) process.exit(0);

const result = spawnSync(process.execPath, [
  firebaseCli,
  'deploy',
  '--only',
  'functions,firestore:rules,firestore:indexes,hosting',
  '--project',
  projectId,
], {
  cwd: projectDirectory,
  env: {
    ...process.env,
    PROFU_RELEASE_SECURITY_STAGE: preflight.stage,
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
