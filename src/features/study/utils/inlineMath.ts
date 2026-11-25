export type InlineMathSegment =
  | { kind: 'text'; text: string }
  | { kind: 'math'; latex: string };

export type InlineMathAtom =
  | { kind: 'word'; text: string }
  | { kind: 'math'; latex: string; prefix: string; suffix: string };

const INLINE_MATH_PATTERN = /\$\$([^$]+?)\$\$|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;
const MULTI_ROW_LATEX_PATTERN = /\\begin\{(?:pmatrix|bmatrix|vmatrix|matrix|cases|aligned|array|gathered|split)\}/;

export function hasInlineMathDelimiters(input: string): boolean {
  return input.includes('$') || input.includes('\\(') || input.includes('\\[');
}

export function isMultiRowLatex(latex: string): boolean {
  return MULTI_ROW_LATEX_PATTERN.test(latex);
}

/**
 * Splits a Romanian sentence into raw text and inline `$...$` / `\(...\)` LaTeX segments.
 */
export function parseInlineMathSegments(input: string): InlineMathSegment[] {
  if (!hasInlineMathDelimiters(input)) {
    return input ? [{ kind: 'text', text: input }] : [];
  }
  const segments: InlineMathSegment[] = [];
  let lastIndex = 0;
  for (const match of input.matchAll(INLINE_MATH_PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ kind: 'text', text: input.slice(lastIndex, start) });
    }
    const latex = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? '').trim();
    if (latex) {
      segments.push({ kind: 'math', latex });
    }
    lastIndex = start + match[0].length;
  }
  if (lastIndex < input.length) {
    segments.push({ kind: 'text', text: input.slice(lastIndex) });
  }
  return segments;
}

/**
 * Extracts every unique inline `$...$` / `\(...\)` LaTeX expression from a string.
 */
export function extractInlineMathExpressions(input: string): string[] {
  if (!input || !hasInlineMathDelimiters(input)) return [];
  const results: string[] = [];
  for (const match of input.matchAll(INLINE_MATH_PATTERN)) {
    const latex = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? '').trim();
    if (latex) results.push(latex);
  }
  return results;
}

/**
 * Tokenizes a mixed prose + inline-math string into flex-wrappable atoms,
 * gluing opening/closing punctuation (`(`, `)`, `.`, `,`, `;`, `:`, `?`, `!`)
 * directly onto adjacent math chips so punctuation never orphans onto a new line.
 */
export function tokenizeInlineMathText(input: string): InlineMathAtom[] {
  const segments = parseInlineMathSegments(input);
  const atoms: InlineMathAtom[] = [];
  let pendingPrefix = '';

  for (const seg of segments) {
    if (seg.kind === 'math') {
      atoms.push({
        kind: 'math',
        latex: seg.latex,
        prefix: pendingPrefix,
        suffix: '',
      });
      pendingPrefix = '';
      continue;
    }

    let text = seg.text;

    // Glue immediate leading punctuation onto the preceding math atom (e.g. "$x = 2$." or "$E(x)$:").
    const prev = atoms[atoms.length - 1];
    if (prev && prev.kind === 'math') {
      const leadPunct = /^([.,;:!?)\]}”»]+)/.exec(text);
      if (leadPunct) {
        prev.suffix += leadPunct[1];
        text = text.slice(leadPunct[1].length);
      }
    }

    // Peel off trailing opening punctuation right before the next math chip (e.g. "($x > 0$)").
    const trailOpen = /([([{„«]+)$/.exec(text);
    let nextPrefix = '';
    if (trailOpen) {
      nextPrefix = trailOpen[1];
      text = text.slice(0, -trailOpen[1].length);
    }

    const words = text.split(/\s+/).filter(Boolean);
    for (const word of words) {
      if (pendingPrefix) {
        atoms.push({ kind: 'word', text: `${pendingPrefix}${word}` });
        pendingPrefix = '';
      } else {
        atoms.push({ kind: 'word', text: word });
      }
    }

    pendingPrefix += nextPrefix;
  }

  if (pendingPrefix) {
    atoms.push({ kind: 'word', text: pendingPrefix });
  }

  return atoms;
}

/**
 * Strips `$...$` delimiters for clean screen-reader accessibility labels.
 */
export function stripInlineMathDelimiters(input: string): string {
  return input.replace(
    INLINE_MATH_PATTERN,
    (_m, g1?: string, g2?: string, g3?: string, g4?: string) => (g1 ?? g2 ?? g3 ?? g4 ?? '').trim(),
  );
}
