import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

const sourceRoot = join(process.cwd(), 'src');
const uiRoots = [join(sourceRoot, 'screens'), join(sourceRoot, 'components')];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

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
  for (const path of uiRoots.flatMap(sourceFiles)) {
    for (const literal of stringLiterals(readFileSync(path, 'utf8'))) {
      if (technicalRouteNames.has(literal)) continue;
      assert.doesNotMatch(literal, englishUi, `Text englezesc în ${relative(process.cwd(), path)}: ${literal}`);
    }
  }
});

test('common Romanian action labels keep their diacritics', () => {
  const missingDiacritics = /\b(?:Inapoi|Sterge|Salveaza|Fotografiaza|Verifica|Rezolva|Incearca|Setari|Lectii|Explicatie|Greseala|Multumim|Continua|Asteapta)\b/;
  for (const path of uiRoots.flatMap(sourceFiles)) {
    for (const literal of stringLiterals(readFileSync(path, 'utf8'))) {
      assert.doesNotMatch(literal, missingDiacritics, `Diacritice lipsă în ${relative(process.cwd(), path)}: ${literal}`);
    }
  }
});
