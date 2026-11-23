import type { RichContent, StoredLesson } from '../../../shared/types';
import {
  contentToAccessibleText,
  prepareRichContentForPresentation,
} from '../../math/utils/mathContent.ts';

export type NotebookFilter = 'all' | 'solve' | 'check';

export type NotebookTopicCount = {
  topic: string;
  count: number;
};

export type NotebookProblemPresentation = {
  identity: string;
  title: string;
  snippet: string | null;
  prettySnippet: string | null;
  answerPreview: string | null;
  requestCount: number;
  takeawayCount: number;
};

export type NotebookVerdictPresentation = {
  label: string;
  tone: 'correct' | 'partial' | 'incorrect';
};

const REQUEST_LABEL_RE = /(?:^|\s)([a-zăâîșț]\))(?:\s+|$)/giu;

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  n: 'ⁿ', i: 'ⁱ',
};

const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  a: 'ₐ', e: 'ₑ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', m: 'ₘ',
  n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ',
  u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
};

const BLACKBOARD_MAP: Record<string, string> = {
  R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ',
};

const LATEX_SYMBOLS: readonly (readonly [RegExp, string])[] = [
  [/\\(?:d|t)?frac\b/g, '\\frac'],
  [/\\(?:left|right|middle|big|Big|bigg|Bigg|displaystyle|textstyle|scriptstyle|limits)\b/g, ''],
  [/\\(?:quad|qquad|;|,|:|!| )/g, ' '],
  [/\\(?:implies|Rightarrow)\b/g, ' ⇒ '],
  [/\\(?:iff|Leftrightarrow)\b/g, ' ⇔ '],
  [/\\Leftarrow\b/g, ' ⇐ '],
  [/\\(?:to|rightarrow)\b/g, ' → '],
  [/\\mapsto\b/g, ' ↦ '],
  [/\\(?:leqslant|leq|le)\b/g, ' ≤ '],
  [/\\(?:geqslant|geq|ge)\b/g, ' ≥ '],
  [/\\(?:neq|ne)\b/g, ' ≠ '],
  [/\\(?:approx|simeq)\b/g, ' ≈ '],
  [/\\equiv\b/g, ' ≡ '],
  [/\\pm\b/g, ' ± '],
  [/\\mp\b/g, ' ∓ '],
  [/\\times\b/g, ' × '],
  [/\\cdot\b/g, ' · '],
  [/\\div\b/g, ' ÷ '],
  [/\\infty\b/g, '∞'],
  [/\\pi\b/g, 'π'],
  [/\\alpha\b/g, 'α'],
  [/\\beta\b/g, 'β'],
  [/\\gamma\b/g, 'γ'],
  [/\\delta\b/g, 'δ'],
  [/\\Delta\b/g, 'Δ'],
  [/\\theta\b/g, 'θ'],
  [/\\lambda\b/g, 'λ'],
  [/\\mu\b/g, 'μ'],
  [/\\sigma\b/g, 'σ'],
  [/\\omega\b/g, 'ω'],
  [/\\Omega\b/g, 'Ω'],
  [/\\(?:varphi|phi)\b/g, 'φ'],
  [/\\notin\b/g, ' ∉ '],
  [/\\in\b/g, ' ∈ '],
  [/\\subseteq\b/g, ' ⊆ '],
  [/\\subset\b/g, ' ⊂ '],
  [/\\cup\b/g, ' ∪ '],
  [/\\cap\b/g, ' ∩ '],
  [/\\(?:varnothing|emptyset)\b/g, '∅'],
  [/\\forall\b/g, '∀'],
  [/\\exists\b/g, '∃'],
  [/\\(?:measuredangle|angle)\b\s*/g, '∠'],
  [/\\triangle\b\s*/g, '△'],
  [/\\perp\b/g, ' ⊥ '],
  [/\\parallel\b/g, ' ∥ '],
  [/\\cong\b/g, ' ≅ '],
  [/\\sim\b/g, ' ~ '],
  [/\\(?:degree|circ)\b/g, '°'],
  [/\\int\b/g, '∫'],
  [/\\sum\b/g, '∑'],
  [/\\prod\b/g, '∏'],
  [/\\lim\b/g, 'lim'],
  [/\\mid\b/g, ' | '],
  [/\\(sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|ln|log|lg|tg|ctg)\b/g, '$1'],
];

function toMappedScript(raw: string, map: Record<string, string>): string | null {
  const compact = raw.replace(/\s+/g, '');
  if (!compact) return null;
  let output = '';
  for (const ch of compact) {
    const mapped = map[ch];
    if (!mapped) return null;
    output += mapped;
  }
  return output;
}

function isSimpleToken(value: string): boolean {
  return /^[A-Za-z0-9α-ωΑ-Ωπ√⁰¹²³⁴⁵⁶⁷⁸⁹₀-₉._°]+$/u.test(value);
}

/**
 * Converts compact LaTeX expressions into crisp, human-readable Unicode math
 * suitable for lightweight native text rows in the Caiet list (zero WebViews).
 */
export function prettyLatexText(latex: string): string {
  let out = latex.trim();
  if (!out) return '';

  // Preserve literal set braces and matrix/system delimiters before stripping LaTeX grouping braces.
  out = out
    .replace(/\\\{/g, '\uE001')
    .replace(/\\\}/g, '\uE002')
    .replace(/\\\|/g, '‖')
    .replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (_m, body: string) => (
      `\uE001 ${body.replace(/\\\\/g, '; ').replace(/&/g, ' ')} \uE002`
    ))
    .replace(/\\begin\{[pbvBV]?matrix\}([\s\S]*?)\\end\{[pbvBV]?matrix\}/g, (_m, body: string) => (
      `[${body.replace(/\\\\/g, '; ').replace(/&/g, ', ')}]`
    ))
    .replace(/\\mathbb\{([RNZQC])\}/g, (_m, letter: string) => BLACKBOARD_MAP[letter] ?? letter)
    .replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\{([^{}]*)\}/g, '$1')
    .replace(/\^\{\s*\\circ\s*\}|\^\\circ/g, '°')
    .replace(/\\\\/g, '; ');

  for (const [pattern, replacement] of LATEX_SYMBOLS) {
    out = out.replace(pattern, replacement);
  }

  // Iteratively simplify fractions and square/n-th roots from innermost outward.
  for (let pass = 0; pass < 4; pass += 1) {
    const before = out;
    out = out.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_m, num: string, den: string) => {
      const cleanNum = num.trim();
      const cleanDen = den.trim();
      const left = isSimpleToken(cleanNum) ? cleanNum : `(${cleanNum})`;
      const right = isSimpleToken(cleanDen) ? cleanDen : `(${cleanDen})`;
      return `${left}/${right}`;
    });
    out = out.replace(/\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g, (_m, idx: string, body: string) => {
      const cleanIdx = toMappedScript(idx.trim(), SUPERSCRIPT_MAP) ?? `${idx.trim()}`;
      const cleanBody = body.trim();
      return isSimpleToken(cleanBody) ? `${cleanIdx}√${cleanBody}` : `${cleanIdx}√(${cleanBody})`;
    });
    out = out.replace(/\\sqrt\{([^{}]+)\}/g, (_m, body: string) => {
      const cleanBody = body.trim();
      return isSimpleToken(cleanBody) ? `√${cleanBody}` : `√(${cleanBody})`;
    });
    if (out === before) break;
  }

  out = out
    .replace(/\^\{([^{}]+)\}/g, (_m, exp: string) => {
      const trimmed = exp.trim();
      if (trimmed === '°') return '°';
      return toMappedScript(trimmed, SUPERSCRIPT_MAP) ?? `^(${trimmed})`;
    })
    .replace(/\^([A-Za-z0-9])/g, (_m, ch: string) => SUPERSCRIPT_MAP[ch] ?? `^${ch}`)
    .replace(/_\{([^{}]+)\}/g, (_m, sub: string) => {
      const trimmed = sub.trim();
      return toMappedScript(trimmed, SUBSCRIPT_MAP) ?? `_${trimmed}`;
    })
    .replace(/_([A-Za-z0-9])/g, (_m, ch: string) => SUBSCRIPT_MAP[ch] ?? `_${ch}`)
    // Drop any leftover LaTeX control commands gracefully and strip grouping braces.
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\uE001/g, '{')
    .replace(/\uE002/g, '}')
    // Tidy binary minus/equals spacing for comfortable mobile scanning.
    .replace(/\s*=\s*/g, ' = ')
    .replace(/\s*\+\s*/g, ' + ')
    .replace(/([^\s(\[{,;=<>≤≥≠±∓⇒⇔→])\s*-\s*([^\s)\]},;])/g, '$1 − $2')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();

  return out;
}

export function richContentToPrettyText(content: RichContent): string {
  const prepared = prepareRichContentForPresentation(content);
  const parts: string[] = [];
  for (const block of prepared) {
    if (block.type === 'text') {
      const text = block.text.trim();
      if (text) parts.push(text);
    } else if (block.type === 'math') {
      const pretty = prettyLatexText(block.latex) || block.spoken.trim();
      if (pretty) parts.push(pretty);
    } else if (block.type === 'visual') {
      const spoken = block.spoken.trim();
      if (spoken) parts.push(spoken);
    }
  }
  return parts
    .join(' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedProblemText(content: RichContent) {
  return contentToAccessibleText(prepareRichContentForPresentation(content))
    .replace(/^problema\s*:\s*/iu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3).trimEnd()}…` : value;
}

function buildSnippet(identity: string, title: string, topic: string): string | null {
  const cleanIdentity = identity.trim();
  if (!cleanIdentity) return null;
  const normId = cleanIdentity.toLowerCase();
  const normTitle = title.trim().toLowerCase();
  const normTopic = topic.trim().toLowerCase();
  if (normId === normTitle || normId === normTopic) return null;
  if (normTitle.length >= 12 && normId.startsWith(normTitle) && normId.length - normTitle.length < 8) {
    return null;
  }
  return truncateText(cleanIdentity, 96);
}

function buildPrettySnippet(content: RichContent, title: string, topic: string): string | null {
  const clean = richContentToPrettyText(content).replace(/^problema\s*:\s*/iu, '').trim();
  return buildSnippet(clean, title, topic);
}

function buildAnswerPreview(content: RichContent): string | null {
  const clean = richContentToPrettyText(content)
    .replace(/^(?:răspuns(?:\s+final)?|rezultat(?:\s+final)?)\s*:\s*/iu, '')
    .trim();
  if (!clean) return null;
  return truncateText(clean, 56);
}

const presentationCache = new WeakMap<StoredLesson, NotebookProblemPresentation>();
const searchableCache = new WeakMap<StoredLesson, string>();

export function notebookProblemPresentation(lesson: StoredLesson): NotebookProblemPresentation {
  const cached = presentationCache.get(lesson);
  if (cached) return cached;

  const identity = normalizedProblemText(lesson.problem) || lesson.title.trim() || 'Problemă matematică';
  const labels = new Set<string>();
  for (const block of lesson.problem) {
    if (block.type !== 'text') continue;
    REQUEST_LABEL_RE.lastIndex = 0;
    let match = REQUEST_LABEL_RE.exec(block.text);
    while (match) {
      labels.add(match[1].toLowerCase());
      match = REQUEST_LABEL_RE.exec(block.text);
    }
  }

  const title = lesson.title.trim() || lesson.topic.trim() || 'Problemă matematică';
  const result: NotebookProblemPresentation = {
    identity,
    title,
    snippet: buildSnippet(identity, title, lesson.topic),
    prettySnippet: buildPrettySnippet(lesson.problem, title, lesson.topic),
    answerPreview: buildAnswerPreview(lesson.finalAnswer),
    requestCount: labels.size,
    takeawayCount: lesson.takeaways.length,
  };
  presentationCache.set(lesson, result);
  return result;
}

/** Pre-populates presentation cache off the navigation tap path. */
export function prewarmNotebookPresentations(lessons: readonly StoredLesson[] | undefined) {
  if (!lessons || lessons.length === 0) return;
  const limit = Math.min(lessons.length, 24);
  for (let index = 0; index < limit; index += 1) {
    notebookProblemPresentation(lessons[index]);
  }
}

export function notebookVerdictPresentation(lesson: StoredLesson): NotebookVerdictPresentation | undefined {
  if (lesson.mode !== 'check') return undefined;
  if (lesson.verdict === 'correct') return { label: 'CORECTĂ', tone: 'correct' };
  if (lesson.verdict === 'partially_correct') return { label: 'PARȚIAL CORECTĂ', tone: 'partial' };
  if (lesson.verdict === 'incorrect') return { label: 'DE CORECTAT', tone: 'incorrect' };
  return undefined;
}

export function notebookFilterCounts(lessons: StoredLesson[]) {
  return lessons.reduce((counts, lesson) => {
    counts.all += 1;
    counts[lesson.mode] += 1;
    return counts;
  }, { all: 0, solve: 0, check: 0 });
}

export function notebookTopicCounts(lessons: readonly StoredLesson[]): NotebookTopicCount[] {
  const buckets = new Map<string, NotebookTopicCount>();
  for (const lesson of lessons) {
    const label = lesson.topic.trim();
    if (!label) continue;
    const key = label.toLocaleLowerCase('ro-RO');
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      buckets.set(key, { topic: label, count: 1 });
    }
  }
  return Array.from(buckets.values()).sort((a, b) => (
    b.count - a.count || a.topic.localeCompare(b.topic, 'ro-RO')
  ));
}

function lessonSearchableText(lesson: StoredLesson): string {
  const cached = searchableCache.get(lesson);
  if (cached !== undefined) return cached;
  const presentation = notebookProblemPresentation(lesson);
  const searchable = [
    presentation.identity,
    presentation.prettySnippet ?? '',
    presentation.answerPreview ?? '',
    lesson.title,
    lesson.topic,
    ...lesson.problem.flatMap((block) => block.type === 'math' ? [block.latex, block.spoken] : []),
    ...lesson.finalAnswer.flatMap((block) => block.type === 'math' ? [block.latex, block.spoken] : []),
  ].join(' ').toLocaleLowerCase('ro-RO');
  searchableCache.set(lesson, searchable);
  return searchable;
}

export function filterNotebookLessons(
  lessons: StoredLesson[],
  filter: NotebookFilter,
  queryText: string,
  topicFilter?: string | null,
) {
  const query = queryText.trim().toLocaleLowerCase('ro-RO');
  const normalizedTopic = topicFilter?.trim().toLocaleLowerCase('ro-RO') ?? '';
  if (filter === 'all' && !query && !normalizedTopic) return lessons;
  return lessons.filter((lesson) => {
    if (filter !== 'all' && lesson.mode !== filter) return false;
    if (normalizedTopic && lesson.topic.trim().toLocaleLowerCase('ro-RO') !== normalizedTopic) return false;
    if (!query) return true;
    return lessonSearchableText(lesson).includes(query);
  });
}
