import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, '..');
const localEnvironmentPath = path.join(projectDirectory, '.env.local');
const temporaryPrefix = 'profu-de-mate-production-check-';

function loadLocalEnvironment() {
  if (!fs.existsSync(localEnvironmentPath)) return {};
  return parseEnv(fs.readFileSync(localEnvironmentPath, 'utf8'));
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolutePath) : [absolutePath];
  });
}

function removeOwnedTemporaryDirectory(directory) {
  const resolvedDirectory = path.resolve(directory);
  const resolvedTemporaryRoot = path.resolve(os.tmpdir());
  const isDirectChild = path.dirname(resolvedDirectory) === resolvedTemporaryRoot;
  const hasExpectedName = path.basename(resolvedDirectory).startsWith(temporaryPrefix);

  if (!isDirectChild || !hasExpectedName) {
    throw new Error(`Refuz ștergerea directorului temporar neverificat: ${resolvedDirectory}`);
  }

  fs.rmSync(resolvedDirectory, { recursive: true, force: true });
}

const localEnvironment = loadLocalEnvironment();
const debugToken = localEnvironment.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN?.trim() ?? '';
// Metro normally shares its caches through the OS temporary directory. A
// production export running beside Metro can otherwise read or overwrite the
// development server's cache. Keep every release check inside its own owned
// temporary root, including Metro's transform and file-map caches.
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), temporaryPrefix));
const outputDirectory = path.join(temporaryDirectory, 'export');
fs.mkdirSync(outputDirectory);
const buildEnvironment = {
  ...process.env,
  ...localEnvironment,
  EAS_BUILD_PROFILE: 'production',
  EXPO_NO_DOTENV: '1',
  TEMP: temporaryDirectory,
  TMP: temporaryDirectory,
  TMPDIR: temporaryDirectory,
};

delete buildEnvironment.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN;
delete buildEnvironment.EXPO_PUBLIC_APP_CHECK_PROVIDER;

try {
  const expoCli = path.join(projectDirectory, 'node_modules', 'expo', 'bin', 'cli');
  if (!fs.existsSync(expoCli)) {
    throw new Error('Expo CLI nu există în node_modules. Rulează mai întâi instalarea din lockfile.');
  }

  const result = spawnSync(
    process.execPath,
    [expoCli, 'export', '--platform', 'android', '--output-dir', outputDirectory],
    {
      cwd: projectDirectory,
      env: buildEnvironment,
      stdio: 'inherit',
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);

  const files = listFiles(outputDirectory);
  const totalBytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);

  if (debugToken) {
    const leakedIn = files.find((file) => fs.readFileSync(file).includes(Buffer.from(debugToken)));
    if (leakedIn) {
      throw new Error(`Tokenul App Check debug a ajuns în exportul production: ${path.basename(leakedIn)}`);
    }
  }

  console.log(`Export production verificat: ${files.length} fișiere, ${totalBytes} bytes, fără token App Check debug.`);
} finally {
  removeOwnedTemporaryDirectory(temporaryDirectory);
}
