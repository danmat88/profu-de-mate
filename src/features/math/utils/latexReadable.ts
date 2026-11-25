/**
 * Converts uncompiled LaTeX snippets into crisp, human-readable mathematical
 * Unicode as a last-resort safety net so raw TeX backslashes (`\frac`,
 * `\begin{pmatrix}`, `\mathbb{R}`, `\det`) can NEVER leak onto screen if a
 * live AI payload includes inline LaTeX outside a pre-rendered MathJax block.
 */

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  'n': 'ⁿ',
  'i': 'ⁱ',
};

const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
};

function toSuperscript(raw: string): string {
  const chars = [...raw.trim()];
  if (chars.length > 0 && chars.every((ch) => ch in SUPERSCRIPT_MAP)) {
    return chars.map((ch) => SUPERSCRIPT_MAP[ch]).join('');
  }
  return `^(${raw.trim()})`;
}

function toSubscript(raw: string): string {
  const chars = [...raw.trim()];
  if (chars.length > 0 && chars.every((ch) => ch in SUBSCRIPT_MAP)) {
    return chars.map((ch) => SUBSCRIPT_MAP[ch]).join('');
  }
  return `_${raw.trim()}`;
}

function replaceMatrixEnvironments(input: string): string {
  return input.replace(
    /\\begin\{(pmatrix|bmatrix|vmatrix|matrix|cases)\}([\s\S]*?)\\end\{\1\}/g,
    (_m, env: string, body: string) => {
      const rows = body
        .split(/\\\\/)
        .map((row) => row.split('&').map((cell) => cell.trim()).filter(Boolean).join(', '))
        .filter(Boolean);
      if (env === 'cases') return `{ ${rows.join(' ; ')} }`;
      if (env === 'vmatrix') return `| ${rows.join(' ; ')} |`;
      if (env === 'bmatrix') return `[ ${rows.join(' ; ')} ]`;
      return `( ${rows.join(' ; ')} )`;
    },
  );
}

function replaceBalancedMacro(
  input: string,
  macro: string,
  argCount: 1 | 2,
  formatter: (...args: string[]) => string,
): string {
  let text = input;
  const token = `\\${macro}`;
  let guard = 0;

  while (guard < 24) {
    guard += 1;
    const idx = text.indexOf(token);
    if (idx < 0) break;

    const afterMacro = idx + token.length;
    if (/[A-Za-z]/.test(text[afterMacro] ?? '')) break;

    let cursor = afterMacro;
    const args: string[] = [];
    let valid = true;

    for (let a = 0; a < argCount; a += 1) {
      while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1;
      if (text[cursor] !== '{') {
        valid = false;
        break;
      }
      let depth = 0;
      const start = cursor + 1;
      while (cursor < text.length) {
        if (text[cursor] === '{') depth += 1;
        else if (text[cursor] === '}') {
          depth -= 1;
          if (depth === 0) break;
        }
        cursor += 1;
      }
      if (depth !== 0) {
        valid = false;
        break;
      }
      args.push(text.slice(start, cursor));
      cursor += 1;
    }

    if (!valid) break;
    text = `${text.slice(0, idx)}${formatter(...args)}${text.slice(cursor)}`;
  }

  return text;
}

export function formatReadableMathFallback(rawLatex: string): string {
  let text = rawLatex.trim();
  if (!text) return '';

  text = text
    .replace(/^\$\$|\$\$$/g, '')
    .replace(/^\$|\$$/g, '')
    .replace(/^\\\(|\\\)$/g, '')
    .replace(/^\\\[|\\\]$/g, '')
    .trim();

  text = replaceMatrixEnvironments(text);
  text = replaceBalancedMacro(text, 'dfrac', 2, (num, den) => `(${num})/(${den})`);
  text = replaceBalancedMacro(text, 'tfrac', 2, (num, den) => `(${num})/(${den})`);
  text = replaceBalancedMacro(text, 'frac', 2, (num, den) => {
    const simpleNum = /^[A-Za-z0-9\\]+$/.test(num.trim()) ? num.trim() : `(${num.trim()})`;
    const simpleDen = /^[A-Za-z0-9\\]+$/.test(den.trim()) ? den.trim() : `(${den.trim()})`;
    return `${simpleNum}/${simpleDen}`;
  });
  text = replaceBalancedMacro(text, 'sqrt', 1, (inner) => (
    /^[A-Za-z0-9]+$/.test(inner.trim()) ? `√${inner.trim()}` : `√(${inner.trim()})`
  ));
  text = replaceBalancedMacro(text, 'text', 1, (inner) => inner);
  text = replaceBalancedMacro(text, 'mathrm', 1, (inner) => inner);
  text = replaceBalancedMacro(text, 'mathcal', 1, (inner) => inner);
  text = replaceBalancedMacro(text, 'operatorname', 1, (inner) => inner);
  text = replaceBalancedMacro(text, 'widehat', 1, (inner) => `∡${inner}`);
  text = replaceBalancedMacro(text, 'overrightarrow', 1, (inner) => `${inner}⃗`);
  text = replaceBalancedMacro(text, 'vec', 1, (inner) => `${inner}⃗`);
  text = replaceBalancedMacro(text, 'overline', 1, (inner) => inner);
  text = replaceBalancedMacro(text, 'bar', 1, (inner) => inner);

  text = text
    .replace(/\\mathbb\{R\}/g, 'ℝ')
    .replace(/\\mathbb\{N\}/g, 'ℕ')
    .replace(/\\mathbb\{Z\}/g, 'ℤ')
    .replace(/\\mathbb\{Q\}/g, 'ℚ')
    .replace(/\\mathbb\{C\}/g, 'ℂ')
    .replace(/\\left\s*/g, '')
    .replace(/\\right\s*/g, '')
    .replace(/\\(?:big|Big|bigg|Bigg)[lr]?\s*/g, '')
    .replace(/\\(?:qquad|quad|,|;|!)\s*/g, ' ')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\times\b/g, '×')
    .replace(/\\div\b/g, '÷')
    .replace(/\\pm\b/g, '±')
    .replace(/\\mp\b/g, '∓')
    .replace(/\\le(?:q)?\b/g, '≤')
    .replace(/\\ge(?:q)?\b/g, '≥')
    .replace(/\\ne(?:q)?\b/g, '≠')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\iff\b/g, '⇔')
    .replace(/\\implies\b/g, '⇒')
    .replace(/\\Rightarrow\b/g, '⇒')
    .replace(/\\to\b/g, '→')
    .replace(/\\in\b/g, '∈')
    .replace(/\\notin\b/g, '∉')
    .replace(/\\subset\b/g, '⊂')
    .replace(/\\cup\b/g, '∪')
    .replace(/\\cap\b/g, '∩')
    .replace(/\\varnothing\b/g, '∅')
    .replace(/\\forall\b/g, '∀')
    .replace(/\\exists\b/g, '∃')
    .replace(/\\infty\b/g, '∞')
    .replace(/\\pi\b/g, 'π')
    .replace(/\\Delta\b/g, 'Δ')
    .replace(/\\triangle\b/g, 'Δ')
    .replace(/\\alpha\b/g, 'α')
    .replace(/\\beta\b/g, 'β')
    .replace(/\\gamma\b/g, 'γ')
    .replace(/\\angle\b/g, '∡')
    .replace(/\\perp\b/g, '⊥')
    .replace(/\\parallel\b/g, '∥')
    .replace(/\\circ\b/g, '∘')
    .replace(/\\ast\b/g, '*')
    .replace(/\\backslash\b/g, '\\')
    .replace(/\\setminus\b/g, '\\')
    .replace(/\\dots\b|\\cdots\b/g, '…')
    .replace(/\\int\b/g, '∫')
    .replace(/\\sum\b/g, '∑')
    .replace(/\\(det|lim|ln|log|sin|cos|tan|cot|tg|ctg|arctg|arcsin|arccos|min|max|deg|mod)\b/g, '$1')
    .replace(/\^\{\s*\\circ\s*\}/g, '°')
    .replace(/\^\\circ\b/g, '°')
    .replace(/\^\{([^}]+)\}/g, (_m, inner: string) => toSuperscript(inner))
    .replace(/\^([0-9ni])/g, (_m, inner: string) => toSuperscript(inner))
    .replace(/_\{([^}]+)\}/g, (_m, inner: string) => toSubscript(inner))
    .replace(/_([0-9])/g, (_m, inner: string) => toSubscript(inner))
    .replace(/\\([{}])/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}
