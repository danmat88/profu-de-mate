import { readFileSync } from 'node:fs';
import { evaluateMathResults } from '../functions/lib/mathEvaluation.js';
try {
  if (process.argv.length !== 4) throw new Error('Utilizare: node scripts/evaluate-math-results.mjs manifest.json rezultate-revizuite.json');
  const result = evaluateMathResults(JSON.parse(readFileSync(process.argv[2], 'utf8')), JSON.parse(readFileSync(process.argv[3], 'utf8')));
  console.log(JSON.stringify(result, null, 2));
  if (!result.accepted) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
