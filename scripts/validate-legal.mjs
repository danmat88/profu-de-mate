import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const legalSource = await readFile(resolve(root, 'src/legal.ts'), 'utf8');
const publicDir = resolve(root, 'hosting/public');
const publicFiles = (await readdir(publicDir)).filter((name) => name.endsWith('.html'));
const publicContent = await Promise.all(publicFiles.map(async (name) => ({
  name,
  content: await readFile(resolve(publicDir, name), 'utf8'),
})));

const problems = [];
if (/operatorName:\s*''/.test(legalSource)) problems.push('src/legal.ts: operatorName este gol');
if (/contactEmail:\s*''/.test(legalSource)) problems.push('src/legal.ts: contactEmail este gol');

for (const file of publicContent) {
  if (file.content.includes('__OPERATOR_NAME__')) problems.push(`${file.name}: lipsește numele operatorului`);
  if (file.content.includes('__CONTACT_EMAIL__')) problems.push(`${file.name}: lipsește e-mailul public`);
}

if (problems.length > 0) {
  console.error('Hosting legal nu poate fi publicat încă:');
  problems.forEach((problem) => console.error(`- ${problem}`));
  process.exitCode = 1;
} else {
  console.log('Identitatea legală este completă în aplicație și pe web.');
}
