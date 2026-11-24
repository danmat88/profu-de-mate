import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..', '..');
const functionsRequire = createRequire(path.join(rootDir, 'functions', 'package.json'));
const mathJaxEntry = functionsRequire.resolve('mathjax');

const INLINE_MATH_PATTERN = /\$([^$\n]+?)\$/g;

let mathJaxInstancePromise = null;

async function getMathJax() {
  if (mathJaxInstancePromise) return mathJaxInstancePromise;
  mathJaxInstancePromise = import(pathToFileURL(mathJaxEntry).href).then(async ({ default: mathJax }) => {
    const packageDir = pathToFileURL(path.dirname(mathJaxEntry)).href.replace(/\/$/, '');
    mathJax.config.loader.paths.mathjax = packageDir;
    return mathJax.init({
      loader: { load: ['input/tex', 'output/svg'] },
      tex: {
        formatError: (_jax, error) => {
          throw new Error(error?.message ?? 'Invalid LaTeX notation.');
        },
      },
      output: {
        font: 'mathjax-fira',
        displayOverflow: 'overflow',
        linebreaks: { inline: false },
      },
      svg: {
        fontCache: 'local',
        useXlink: false,
        blacker: 11,
      },
    });
  });
  return mathJaxInstancePromise;
}

/**
 * Deduplicates Fira Math glyph `<path d="..." />` definitions across every
 * compiled formula in the app so 400+ equations share one compact glyph table
 * (~25 KB total instead of >2 MB of repeated glyph paths).
 */
function deduplicateSvg(rawSvg, glyphIndexByPath, glyphs) {
  const localDefs = new Map();
  const defsMatch = rawSvg.match(/<defs>([\s\S]*?)<\/defs>/);
  if (defsMatch) {
    for (const match of defsMatch[1].matchAll(/<path\s+([^>]+?)\/?\s*>/g)) {
      const attrs = match[1];
      const id = attrs.match(/\bid="([^"]+)"/)?.[1];
      const d = attrs.match(/\bd="([^"]+)"/)?.[1];
      if (id && d) {
        let idx = glyphIndexByPath.get(d);
        if (idx === undefined) {
          idx = glyphs.length;
          glyphs.push(d);
          glyphIndexByPath.set(d, idx);
        }
        localDefs.set(id, idx);
      }
    }
  }

  let body = rawSvg
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<defs>[\s\S]*?<\/defs>/, '')
    .replace(/\s(?:data|aria)-[\w:-]+="[^"]*"/g, '');

  body = body.replace(/<use\s+([^>]+?)\/?\s*>/g, (full, attrs) => {
    const href = attrs.match(/\b(?:xlink:)?href="#([^"]+)"/)?.[1];
    if (!href) return full;
    const glyphIdx = localDefs.get(href);
    if (glyphIdx === undefined) return '';
    const rest = attrs.replace(/\b(?:xlink:)?href="#[^"]+"/, '').trim();
    return rest ? `<u i="${glyphIdx}" ${rest}/>` : `<u i="${glyphIdx}"/>`;
  });

  return body.trim();
}

async function renderLatex(latex, display, glyphIndexByPath, glyphs) {
  const normalized = latex.trim();
  const mathJax = await getMathJax();
  const node = await mathJax.tex2svgPromise(normalized, { display });
  const serialized = mathJax.startup.adaptor.serializeXML(node);
  const svgMatch = serialized.match(/<svg\b[\s\S]*<\/svg>/);
  if (!svgMatch) throw new Error(`MathJax produced no SVG for: ${normalized}`);

  const rawSvg = svgMatch[0];
  const viewBox = rawSvg.match(/\bviewBox="([^"]+)"/)?.[1];
  const widthEx = Number.parseFloat(rawSvg.match(/\bwidth="([\d.]+)ex"/)?.[1] ?? '0');
  const heightEx = Number.parseFloat(rawSvg.match(/\bheight="([\d.]+)ex"/)?.[1] ?? '0');
  const depthEx = Math.abs(Number.parseFloat(rawSvg.match(/vertical-align:\s*(-?[\d.]+)ex/)?.[1] ?? '0'));
  if (!viewBox || !Number.isFinite(widthEx) || widthEx <= 0 || !Number.isFinite(heightEx) || heightEx <= 0) {
    throw new Error(`Invalid SVG dimensions for: ${normalized}`);
  }

  const body = deduplicateSvg(rawSvg, glyphIndexByPath, glyphs);
  return {
    b: body,
    v: viewBox,
    w: Number(widthEx.toFixed(3)),
    h: Number(heightEx.toFixed(3)),
    d: Number(depthEx.toFixed(3)),
  };
}

function collectInlineFromText(text, inlineSet) {
  if (typeof text !== 'string' || !text.includes('$')) return;
  for (const match of text.matchAll(INLINE_MATH_PATTERN)) {
    const latex = match[1].trim();
    if (latex) inlineSet.add(latex);
  }
}

function collectFromVisual(visual, displaySet, inlineSet) {
  if (!visual) return;
  collectInlineFromText(visual.title, inlineSet);
  if (visual.kind === 'table') {
    for (const header of visual.headers ?? []) {
      collectInlineFromText(header, inlineSet);
    }
    for (const row of visual.rows ?? []) {
      for (const cell of row.cells ?? []) {
        if (cell.text) collectInlineFromText(cell.text, inlineSet);
        if (cell.latex && cell.latex.trim()) {
          inlineSet.add(cell.latex.trim());
          displaySet.add(cell.latex.trim());
        }
      }
    }
  }
}

function collectFromBlocks(blocks, displaySet, inlineSet) {
  if (!Array.isArray(blocks)) return;
  for (const block of blocks) {
    if (!block) continue;
    if (block.type === 'text') {
      collectInlineFromText(block.text, inlineSet);
    } else if (block.type === 'math') {
      if (block.latex?.trim()) displaySet.add(block.latex.trim());
      if (block.caption) collectInlineFromText(block.caption, inlineSet);
    } else if (block.type === 'subpoint' || block.type === 'step') {
      if (block.title) collectInlineFromText(block.title, inlineSet);
      collectInlineFromText(block.text, inlineSet);
      if (block.math?.trim()) displaySet.add(block.math.trim());
    } else if (block.type === 'note') {
      collectInlineFromText(block.text, inlineSet);
    } else if (block.type === 'visual') {
      collectFromVisual(block.visual, displaySet, inlineSet);
    }
  }
}

async function main() {
  const formulasModule = await import(pathToFileURL(path.join(rootDir, 'src', 'features', 'study', 'data', 'formulasCatalog.ts')).href);
  const examsModule = await import(pathToFileURL(path.join(rootDir, 'src', 'features', 'exams', 'data', 'examGuidesCatalog.ts')).href);
  const examSimsModule = await import(pathToFileURL(path.join(rootDir, 'src', 'features', 'exams', 'data', 'examSimulationsCatalog.ts')).href);
  const practiceModule = await import(pathToFileURL(path.join(rootDir, 'src', 'features', 'practice', 'data', 'practiceBank.ts')).href);

  const displayLatex = new Set();
  const inlineLatex = new Set();

  for (const formula of formulasModule.FORMULAS_CATALOG) {
    if (formula.formulaLatex?.trim()) displayLatex.add(formula.formulaLatex.trim());
    if (Array.isArray(formula.formulas)) {
      for (const expr of formula.formulas) {
        if (expr.latex?.trim()) displayLatex.add(expr.latex.trim());
        if (expr.label) collectInlineFromText(expr.label, inlineLatex);
      }
    }
    collectInlineFromText(formula.whenToUse, inlineLatex);
    collectInlineFromText(formula.pitfall, inlineLatex);
    collectFromBlocks(formula.example, displayLatex, inlineLatex);
    if (formula.visual?.visual) {
      collectFromVisual(formula.visual.visual, displayLatex, inlineLatex);
    }
  }

  for (const guide of examsModule.EXAM_GUIDES) {
    collectInlineFromText(guide.overviewNote, inlineLatex);
    for (const tip of guide.timeStrategy ?? []) collectInlineFromText(tip, inlineLatex);
    for (const subject of guide.subjects) {
      collectInlineFromText(subject.summary, inlineLatex);
      for (const tip of subject.gradingTips ?? []) collectInlineFromText(tip, inlineLatex);
      collectFromBlocks(subject.modelProblem, displayLatex, inlineLatex);
      collectFromBlocks(subject.modelSolution, displayLatex, inlineLatex);
      for (const item of subject.rubricBreakdown ?? []) {
        collectInlineFromText(item.step, inlineLatex);
      }
    }
  }

  for (const sim of examSimsModule.EXAM_SIMULATIONS) {
    for (const item of sim.items) {
      collectFromBlocks(item.prompt, displayLatex, inlineLatex);
      collectFromBlocks(item.solution, displayLatex, inlineLatex);
      collectInlineFromText(item.answerDisplay, inlineLatex);
      for (const choice of item.choices ?? []) {
        collectInlineFromText(choice, inlineLatex);
      }
      for (const crit of item.rubric ?? []) {
        collectInlineFromText(crit.step, inlineLatex);
      }
    }
  }

  for (const question of practiceModule.PRACTICE_BANK) {
    collectFromBlocks(question.prompt, displayLatex, inlineLatex);
    collectFromBlocks(question.explanation, displayLatex, inlineLatex);
    collectInlineFromText(question.answerDisplay, inlineLatex);
    collectInlineFromText(question.hint, inlineLatex);
    for (const choice of question.choices ?? []) {
      collectInlineFromText(choice.label, inlineLatex);
    }
  }

  const glyphs = [];
  const glyphIndexByPath = new Map();
  const displayEntries = {};
  const inlineEntries = {};

  for (const latex of [...displayLatex].sort()) {
    displayEntries[latex] = await renderLatex(latex, true, glyphIndexByPath, glyphs);
  }
  for (const latex of [...inlineLatex].sort()) {
    inlineEntries[latex] = await renderLatex(latex, false, glyphIndexByPath, glyphs);
  }

  const outPath = path.join(rootDir, 'src', 'features', 'study', 'data', 'renderedMath.generated.ts');
  const fileContent = [
    '// Auto-generated by scripts/content/compile-study-content.mjs — do not edit manually.',
    "import type { RenderedMath } from '../../../shared/types';",
    '',
    'type CompactMathEntry = { b: string; v: string; w: number; h: number; d: number };',
    '',
    `const STUDY_MATH_GLYPHS: readonly string[] = ${JSON.stringify(glyphs)};`,
    '',
    `const DISPLAY_ENTRIES: Readonly<Record<string, CompactMathEntry>> = ${JSON.stringify(displayEntries)};`,
    '',
    `const INLINE_ENTRIES: Readonly<Record<string, CompactMathEntry>> = ${JSON.stringify(inlineEntries)};`,
    '',
    'const expandedCache = new Map<string, RenderedMath>();',
    '',
    'function expandEntry(cacheKey: string, entry: CompactMathEntry): RenderedMath {',
    '  const cached = expandedCache.get(cacheKey);',
    '  if (cached) return cached;',
    '  const expandedBody = entry.b.replace(/<u i="(\\d+)"([^>]*)\\/>/g, (_m, idxStr: string, rest: string) => {',
    '    const d = STUDY_MATH_GLYPHS[Number(idxStr)] ?? \'\';',
    '    return rest ? `<path d="${d}"${rest}/>` : `<path d="${d}"/>`;',
    '  });',
    '  const svg = `<svg preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="${entry.v}">${expandedBody}</svg>`;',
    '  const resolved: RenderedMath = {',
    '    svg,',
    '    viewBox: entry.v,',
    '    widthEx: entry.w,',
    '    heightEx: entry.h,',
    '    depthEx: entry.d,',
    '  };',
    '  expandedCache.set(cacheKey, resolved);',
    '  return resolved;',
    '}',
    '',
    "export function getRenderedStudyMath(latex: string, mode: 'display' | 'inline' = 'display'): RenderedMath | undefined {",
    '  const key = latex.trim();',
    '  if (!key) return undefined;',
    "  if (mode === 'inline') {",
    '    const inlineEntry = INLINE_ENTRIES[key];',
    '    if (inlineEntry) return expandEntry(`i\\u0000${key}`, inlineEntry);',
    '    const fallback = DISPLAY_ENTRIES[key];',
    '    return fallback ? expandEntry(`d\\u0000${key}`, fallback) : undefined;',
    '  }',
    '  const displayEntry = DISPLAY_ENTRIES[key];',
    '  if (displayEntry) return expandEntry(`d\\u0000${key}`, displayEntry);',
    '  const fallback = INLINE_ENTRIES[key];',
    '  return fallback ? expandEntry(`i\\u0000${key}`, fallback) : undefined;',
    '}',
    '',
    'export const RENDERED_STUDY_MATH: Readonly<Record<string, RenderedMath>> = new Proxy(',
    '  {} as Record<string, RenderedMath>,',
    '  {',
    '    get(_target, prop) {',
    "      if (typeof prop !== 'string') return undefined;",
    "      return getRenderedStudyMath(prop, 'display');",
    '    },',
    '    has(_target, prop) {',
    "      return typeof prop === 'string' && (prop in DISPLAY_ENTRIES || prop in INLINE_ENTRIES);",
    '    },',
    '    ownKeys() {',
    '      return Array.from(new Set([...Object.keys(DISPLAY_ENTRIES), ...Object.keys(INLINE_ENTRIES)]));',
    '    },',
    '    getOwnPropertyDescriptor(_target, prop) {',
    "      if (typeof prop !== 'string') return undefined;",
    "      const value = getRenderedStudyMath(prop, 'display');",
    '      if (!value) return undefined;',
    '      return { configurable: true, enumerable: true, value };',
    '    },',
    '  },',
    ');',
    '',
  ].join('\n');

  await writeFile(outPath, fileContent, 'utf8');
  console.log(
    `Compiled ${displayLatex.size} display + ${inlineLatex.size} inline formulas (${glyphs.length} shared Fira glyphs) -> ${path.relative(rootDir, outPath)}`,
  );
}

await main();
