import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { assertNoDebugTokens, assertReleaseCertificate, assertReleaseManifest, readArchive } from './release-artifact.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const artifact = process.argv[2] && path.resolve(process.argv[2]);
const extension = artifact && path.extname(artifact).toLowerCase();
const exe = (name) => process.platform === 'win32' ? `${name}.exe` : name;
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', exe('java')) : exe('java');
function command(program, args) {
  const result = spawnSync(program, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 120_000 });
  if (result.error || result.status !== 0) throw new Error(`Verificarea ${path.basename(program)} a eșuat. ${result.error?.message ?? 'Cod: ' + result.status}`);
  return result.stdout + result.stderr;
}

try {
  if (!artifact || !['.apk', '.aab'].includes(extension)) throw new Error('Utilizare: node scripts/release/verify-release-artifact.mjs <fișier.apk|fișier.aab>');
  const tokens = [process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN];
  for (const filename of ['.env', '.env.local']) {
    const envPath = path.join(root, filename);
    if (fs.existsSync(envPath)) tokens.push(parseEnv(fs.readFileSync(envPath, 'utf8')).EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN);
  }
  assertNoDebugTokens(readArchive(artifact), tokens);
  let certificate;
  let manifest;
  if (extension === '.apk') {
    const sdk = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME
      || (process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'));
    if (!sdk) throw new Error('Lipsește Android SDK pentru verificarea APK.');
    const buildTools = path.join(sdk, 'build-tools', '36.0.0');
    certificate = command(java, ['-jar', path.join(buildTools, 'lib', 'apksigner.jar'), 'verify', '--print-certs', artifact]);
    manifest = command(path.join(buildTools, exe('aapt2')), ['dump', 'xmltree', artifact, '--file', 'AndroidManifest.xml']);
  } else {
    const bundletool = process.env.BUNDLETOOL_JAR;
    if (!bundletool || !fs.existsSync(bundletool)) throw new Error('Lipsește BUNDLETOOL_JAR: AAB nu poate fi acceptat fără inspecția manifestului real.');
    const javaTool = (name) => process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', exe(name)) : exe(name);
    const signature = command(javaTool('jarsigner'), ['-J-Duser.language=en', '-verify', artifact]);
    if (!/jar verified\./i.test(signature) || /unsigned entries|jar is unsigned/i.test(signature)) throw new Error('Semnătura AAB nu acoperă integral artefactul.');
    certificate = command(javaTool('keytool'), ['-J-Duser.language=en', '-printcert', '-jarfile', artifact]);
    manifest = command(java, ['-jar', bundletool, 'dump', 'manifest', '--bundle', artifact, '--module', 'base']);
  }
  assertReleaseCertificate(certificate, process.env.PROFU_RELEASE_CERT_SHA256);
  assertReleaseManifest(manifest);
  const hash = createHash('sha256').update(fs.readFileSync(artifact)).digest('hex');
  console.log(`Artefact verificat static: ${path.basename(artifact)}; SHA-256 ${hash}. Semnătură, manifest și tokenuri locale verificate. Testarea pe dispozitiv și aprobarea Play sunt verificări separate.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
