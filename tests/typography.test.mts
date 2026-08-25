import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return entry.name.endsWith('.tsx') ? [absolute] : [];
  }));
  return nested.flat();
}

test('design system disables system font scaling for every app text component', async () => {
  const typographyPath = path.resolve('src/components/Typography.tsx');
  const typography = await readFile(typographyPath, 'utf8');
  assert.equal((typography.match(/allowFontScaling=\{false\}/g) ?? []).length, 2);
  const mathFormula = await readFile(path.resolve('src/components/MathFormula.tsx'), 'utf8');
  assert.equal(mathFormula.includes('.fontScale'), false, 'math rendering must use the in-app zoom, not system font scale');

  for (const file of await sourceFiles(path.resolve('src'))) {
    if (file === typographyPath) continue;
    const source = await readFile(file, 'utf8');
    const imports = source.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*['"]react-native['"]/g);
    for (const match of imports) {
      const importedNames = match[1].split(',').map((name) => name.trim().replace(/^type\s+/, ''));
      assert.equal(importedNames.includes('Text'), false, `${path.relative(process.cwd(), file)} imports native Text`);
      assert.equal(importedNames.includes('TextInput'), false, `${path.relative(process.cwd(), file)} imports native TextInput`);
    }
  }
});
