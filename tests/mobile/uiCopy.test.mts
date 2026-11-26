import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

const sourceRoot = join(process.cwd(), 'src');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const uiFiles = () => sourceFiles(sourceRoot).filter((path) => path.endsWith('.tsx'));

function stringLiterals(source: string): string[] {
  const literals: string[] = [];
  const pattern = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g;
  for (const match of source.matchAll(pattern)) literals.push(match[1] ?? match[2] ?? match[3] ?? '');
  return literals;
}

test('Romanian source copy contains no broken UTF-8 sequences', () => {
  for (const path of sourceFiles(sourceRoot)) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /(?:Ã®|Ã¢|Äƒ|È™|È›|â€”|â€ž|â€™|ðŸ|�)/, `Text corupt în ${relative(process.cwd(), path)}`);
  }
});

test('visible UI literals do not regress to common English labels', () => {
  const englishUi = /\b(?:Cancel|Delete|Save|Retry|Continue|Settings|Gallery|Loading|Back|Close|Search|Report|Welcome|Try again)\b/;
  const technicalRouteNames = new Set(['Home', 'Settings', 'Capture', 'Review', 'Processing', 'Lesson', 'Summary', 'Notebook', 'Legal']);
  for (const path of uiFiles()) {
    for (const literal of stringLiterals(readFileSync(path, 'utf8'))) {
      if (technicalRouteNames.has(literal)) continue;
      assert.doesNotMatch(literal, englishUi, `Text englezesc în ${relative(process.cwd(), path)}: ${literal}`);
    }
  }
});

test('common Romanian action labels keep their diacritics', () => {
  const missingDiacritics = /\b(?:Inapoi|Sterge|Salveaza|Fotografiaza|Verifica|Rezolva|Incearca|Setari|Lectii|Explicatie|Greseala|Multumim|Continua|Asteapta)\b/;
  for (const path of uiFiles()) {
    for (const literal of stringLiterals(readFileSync(path, 'utf8'))) {
      assert.doesNotMatch(literal, missingDiacritics, `Diacritice lipsă în ${relative(process.cwd(), path)}: ${literal}`);
    }
  }
});

test('Pro and Max subscription screens never pitch free-included traits as paid perks or regress to stale Premium copy', () => {
  const paywall = readFileSync(join(sourceRoot, 'features', 'access', 'components', 'PremiumSurface.tsx'), 'utf8');
  const settings = readFileSync(join(sourceRoot, 'features', 'account', 'screens', 'SettingsScreen.tsx'), 'utf8');
  const home = readFileSync(join(sourceRoot, 'features', 'home', 'components', 'HomeSurface.tsx'), 'utf8');
  const timer = readFileSync(join(sourceRoot, 'features', 'access', 'components', 'QuotaResetTimer.tsx'), 'utf8');
  const purchases = readFileSync(join(sourceRoot, 'features', 'access', 'services', 'purchases.ts'), 'utf8');
  const legal = readFileSync(join(sourceRoot, 'features', 'account', 'screens', 'LegalScreen.tsx'), 'utf8');
  const processing = readFileSync(join(sourceRoot, 'features', 'analysis', 'screens', 'ProcessingScreen.tsx'), 'utf8');

  const benefitsBlock = paywall.slice(paywall.indexOf('const tierBenefits'), paywall.indexOf('return ('));
  assert.doesNotMatch(benefitsBlock, /reclam/i, 'Ad-free is true for free users too and must not appear as a paid perk');
  assert.doesNotMatch(benefitsBlock, /Caiet sincronizat/i, 'Cloud-synced Caiet is free with Google and must not appear as a paid perk');

  for (const [label, source] of [
    ['PremiumSurface', paywall],
    ['SettingsScreen', settings],
    ['HomeSurface', home],
    ['QuotaResetTimer', timer],
    ['purchases', purchases],
    ['LegalScreen', legal],
    ['ProcessingScreen', processing],
  ] as const) {
    for (const literal of stringLiterals(source)) {
      assert.doesNotMatch(literal, /\bPremium\b/, `Text vechi „Premium” în ${label}: ${literal}`);
    }
  }
});
