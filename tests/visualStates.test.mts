import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

async function tsxSources(directory: string): Promise<Array<{ file: string; source: string }>> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return tsxSources(absolute);
    if (!entry.name.endsWith('.tsx')) return [];
    return [{ file: absolute, source: await readFile(absolute, 'utf8') }];
  }));
  return nested.flat();
}

test('visible asynchronous states use the branded loader instead of platform spinners or fake content', async () => {
  const sources = await tsxSources(path.resolve('src'));
  const combined = sources.map(({ source }) => source).join('\n');

  assert.equal(combined.includes('ActivityIndicator'), false, 'platform spinners must not re-enter the product UI');
  assert.equal(combined.toLocaleLowerCase('ro-RO').includes('skeleton'), false, 'loading must not pretend that fake lessons or formulas exist');
  assert.match(combined, /PlayfulLoader/);
});

test('Google account entry uses the app-owned accessible button in every screen', async () => {
  const [settings, paywall, button] = await Promise.all([
    readFile(path.resolve('src/screens/SettingsScreen.tsx'), 'utf8'),
    readFile(path.resolve('src/screens/PaywallScreen.tsx'), 'utf8'),
    readFile(path.resolve('src/components/GoogleAccountButton.tsx'), 'utf8'),
  ]);

  assert.match(settings, /<GoogleAccountButton/);
  assert.match(paywall, /<GoogleAccountButton/);
  assert.match(button, /accessibilityLabel=/);
  assert.match(button, /Continuă cu Google/);
});
