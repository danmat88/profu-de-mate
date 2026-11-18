import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const outputRoot = path.join(root, '.local');

export function localOutputDirectory(name) {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Invalid local output directory.');
  const directory = path.join(outputRoot, name);
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

export function collectFirebaseLogs() {
  const filenames = fs.readdirSync(root).filter((name) =>
    /^(firebase-debug(?:\..+)?|firestore-debug|ui-debug|database-debug|pubsub-debug|storage-debug|extensions-debug)\.log$/.test(name),
  );
  if (!filenames.length) return;
  const directory = localOutputDirectory('logs');
  for (const name of filenames) {
    const source = path.join(root, name);
    if (fs.lstatSync(source).isFile()) fs.renameSync(source, path.join(directory, name));
  }
}
