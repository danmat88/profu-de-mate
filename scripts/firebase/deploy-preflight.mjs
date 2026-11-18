import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseStrict } = require('firebase-tools/lib/functions/env');
const STAGE_KEY = 'PROFU_RELEASE_SECURITY_STAGE';

/**
 * Mirrors the env files selected by our deploy wrapper's explicit --project ID:
 * functions/.env then functions/.env.<projectId>. Shell variables, root .env,
 * alias .env.default and emulator .env.local are not deployed user envs.
 * Firebase CLI's strict parser is shared so invalid dotenv cannot pass here.
 */
export function assertDeployConfiguration({
  projectDirectory,
  projectId,
  shellEnvironment = process.env,
  read = (filename) => fs.readFileSync(filename, 'utf8'),
  exists = (filename) => fs.existsSync(filename),
}) {
  const root = path.resolve(projectDirectory);
  let firebase;
  try { firebase = JSON.parse(read(path.join(root, 'firebase.json'))); }
  catch { throw new Error('Preflight: firebase.json lipsește sau nu este valid.'); }
  const config = firebase.functions;
  if (!config || Array.isArray(config) || typeof config.source !== 'string' || config.configDir) {
    throw new Error('Preflight: configurația Functions a fost schimbată; verificatorul trebuie adaptat înainte de deploy.');
  }
  const directory = path.resolve(root, config.source);
  if (!directory.startsWith(root + path.sep)) throw new Error('Preflight: sursa Functions nu este în workspace.');
  const files = ['.env', `.env.${projectId}`];
  let environment = {};
  const loadedFiles = [];
  for (const filename of files) {
    const target = path.join(directory, filename);
    if (!exists(target)) continue;
    try { environment = { ...environment, ...parseStrict(read(target)) }; }
    catch { throw new Error(`Preflight: ${config.source}/${filename} este invalid. Valorile nu sunt afișate.`); }
    loadedFiles.push(`${config.source}/${filename}`);
  }
  const stage = environment[STAGE_KEY];
  if (stage !== 'play' && stage !== 'pre-play-public') {
    throw new Error(`Preflight: declară explicit ${STAGE_KEY}=play sau pre-play-public în ${config.source}/.env.${projectId} (sau .env). Variabila din shell ori .env.local nu este suficientă pentru deploy.`);
  }
  if (shellEnvironment[STAGE_KEY] !== undefined && shellEnvironment[STAGE_KEY] !== stage) {
    throw new Error(`Preflight: ${STAGE_KEY} din shell diferă de configurația Functions care va fi publicată. Valorile trebuie aliniate înainte de discovery.`);
  }
  return { projectId, stage, loadedFiles };
}
