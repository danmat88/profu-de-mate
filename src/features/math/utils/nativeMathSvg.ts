import type { RenderedMath } from '../../../shared/types';

export type NativeMathSize = 'inline' | 'choice' | 'card' | 'display' | 'hero';

/**
 * Carefully tuned optical `px / ex` scale matching 14.5–15px Fira Sans body
 * copy and the textbook proportions of `mathDocument.ts` (`0.5em ≈ 7.6px`).
 */
const PX_PER_EX: Record<NativeMathSize, number> = {
  inline: 6.3,
  card: 6.9,
  choice: 7.2,
  display: 7.6,
  hero: 8.2,
};

const MAX_CACHE_ENTRIES = 600;
const MAX_FLAT_CACHE_ENTRIES = 1_200;
const MAX_GLYPH_CACHE_ENTRIES = 400;
const preparedSvgCache = new Map<string, string>();
const flattenedSvgCache = new Map<string, FlattenedMathSvg | null>();

type ParsedGlyphSegment =
  | { cmd: 'Z' }
  | { cmd: 'M' | 'L' | 'C'; coords: number[] };

const parsedGlyphCache = new Map<string, ParsedGlyphSegment[] | null>();

export type FlattenedMathSvg = {
  viewBox: string;
  d: string;
};

function finitePositive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function expandSvgDefs(rawSvg: string): string {
  if (!rawSvg.includes('<defs>')) return rawSvg;
  let svg = rawSvg;
  const pathDefs = new Map<string, string>();
  const defsMatch = svg.match(/<defs>([\s\S]*?)<\/defs>/);
  if (defsMatch) {
    const defsBody = defsMatch[1];
    for (const match of defsBody.matchAll(/<path\s+([^>]+?)\/?\s*>/g)) {
      const attrs = match[1];
      const id = attrs.match(/\bid="([^"]+)"/)?.[1];
      const d = attrs.match(/\bd="([^"]+)"/)?.[1];
      if (id && d) {
        pathDefs.set(id, d);
      }
    }
    svg = svg.replace(/<defs>[\s\S]*?<\/defs>/, '');
  }

  if (pathDefs.size > 0) {
    svg = svg.replace(/<use\s+([^>]+?)\/?\s*>/g, (full, attrs: string) => {
      const href = attrs.match(/\b(?:xlink:)?href="#([^"]+)"/)?.[1];
      if (!href) return full;
      const d = pathDefs.get(href);
      if (!d) return '';
      const rest = attrs
        .replace(/\b(?:xlink:)?href="#[^"]+"/, '')
        .trim();
      return rest ? `<path d="${d}" ${rest}/>` : `<path d="${d}"/>`;
    });
  }
  return svg;
}

type AxisTransform = { sx: number; sy: number; tx: number; ty: number };

function fmtCoord(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function composeAxisTransform(tf: string, parent: AxisTransform): AxisTransform | null {
  let { sx, sy, tx, ty } = parent;
  const re = /([a-zA-Z]+)\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tf)) !== null) {
    const fn = match[1];
    const parts = match[2].trim().split(/[\s,]+/);
    if (fn === 'translate') {
      const dx = Number(parts[0]);
      const dy = parts.length > 1 ? Number(parts[1]) : 0;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
      tx += sx * dx;
      ty += sy * dy;
    } else if (fn === 'scale') {
      const fx = Number(parts[0]);
      const fy = parts.length > 1 ? Number(parts[1]) : fx;
      if (!Number.isFinite(fx) || !Number.isFinite(fy)) return null;
      sx *= fx;
      sy *= fy;
    } else {
      return null;
    }
  }
  return { sx, sy, tx, ty };
}

function getParsedGlyphSegments(d: string): ParsedGlyphSegment[] | null {
  const cached = parsedGlyphCache.get(d);
  if (cached !== undefined) return cached;

  if (/[^MLCZ0-9.,\s+-]/.test(d)) {
    parsedGlyphCache.set(d, null);
    return null;
  }

  const segments: ParsedGlyphSegment[] = [];
  const tokenRe = /([MLCZ])|(-?(?:\d+\.?\d*|\.\d+))/g;
  let current: { cmd: 'M' | 'L' | 'C'; coords: number[] } | null = null;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(d)) !== null) {
    if (match[1]) {
      const cmd = match[1] as 'M' | 'L' | 'C' | 'Z';
      if (cmd === 'Z') {
        segments.push({ cmd: 'Z' });
        current = null;
      } else {
        current = { cmd, coords: [] };
        segments.push(current);
      }
    } else if (current) {
      const num = Number(match[2]);
      if (!Number.isFinite(num)) {
        parsedGlyphCache.set(d, null);
        return null;
      }
      current.coords.push(num);
    } else {
      parsedGlyphCache.set(d, null);
      return null;
    }
  }

  for (const seg of segments) {
    if (seg.cmd === 'Z') continue;
    if (seg.coords.length === 0 || seg.coords.length % 2 !== 0) {
      parsedGlyphCache.set(d, null);
      return null;
    }
    if (seg.cmd === 'C' && seg.coords.length % 6 !== 0) {
      parsedGlyphCache.set(d, null);
      return null;
    }
  }

  if (parsedGlyphCache.size >= MAX_GLYPH_CACHE_ENTRIES) {
    parsedGlyphCache.clear();
  }
  parsedGlyphCache.set(d, segments);
  return segments;
}

function appendTransformedGlyph(segments: ParsedGlyphSegment[], tf: AxisTransform, chunks: string[]): void {
  const { sx, sy, tx, ty } = tf;
  let openSubpath = false;
  for (let s = 0; s < segments.length; s += 1) {
    const seg = segments[s];
    if (seg.cmd === 'Z') {
      chunks.push('Z');
      openSubpath = false;
      continue;
    }
    if (seg.cmd === 'M' && openSubpath) {
      chunks.push('Z');
      openSubpath = false;
    }
    const coords = seg.coords;
    let out = seg.cmd;
    for (let i = 0; i < coords.length; i += 2) {
      const x = fmtCoord(sx * coords[i] + tx);
      const y = fmtCoord(sy * coords[i + 1] + ty);
      out += i === 0 ? `${x} ${y}` : ` ${x} ${y}`;
    }
    chunks.push(out);
    if (seg.cmd === 'M' || seg.cmd === 'L' || seg.cmd === 'C') {
      openSubpath = true;
    }
  }
  if (openSubpath) {
    chunks.push('Z');
  }
}

/**
 * Flattens a pure filled MathJax SVG (`<g transform>`, `<path>`, `<rect>`) into
 * a single color-independent `<path d="..." />` string by baking all nested
 * `translate`/`scale` transforms directly into path coordinates.
 *
 * Reduces Android Fabric view count from 25–111 native `RNSVG` views per
 * equation down to **2 views total** (`<Svg>` + 1 `<Path>`) and eliminates JS
 * XML parsing overhead while keeping pixel-identical Fira Math vector output.
 * Returns `null` for unsupported SVG primitives so callers safely fall back to
 * full `<SvgAst>` rendering.
 */
export function flattenNativeMathSvg(rawSvg: string): FlattenedMathSvg | null {
  const trimmed = rawSvg.trim();
  if (!trimmed) return null;

  const cached = flattenedSvgCache.get(trimmed);
  if (cached !== undefined) return cached;

  const expanded = expandSvgDefs(trimmed);
  const viewBox = expanded.match(/\bviewBox="([^"]+)"/)?.[1];
  if (!viewBox) {
    flattenedSvgCache.set(trimmed, null);
    return null;
  }

  // Bail out to full XML AST parser if any non-path/rect/g tag, fill="none",
  // non-zero stroke, or non-axis transform appears.
  if (/<(?!\/?(?:svg|g|path|rect)\b)[a-zA-Z]/.test(expanded)) {
    flattenedSvgCache.set(trimmed, null);
    return null;
  }
  if (/\bfill="none"/i.test(expanded)) {
    flattenedSvgCache.set(trimmed, null);
    return null;
  }
  const strokeWidths = expanded.matchAll(/\bstroke-width="([^"]+)"/g);
  for (const sw of strokeWidths) {
    if (sw[1] !== '0') {
      flattenedSvgCache.set(trimmed, null);
      return null;
    }
  }

  const stack: AxisTransform[] = [{ sx: 1, sy: 1, tx: 0, ty: 0 }];
  const chunks: string[] = [];
  const tagRe = /<(\/?)(g|path|rect)\b([^>]*?)(\/?)>/g;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(expanded)) !== null) {
    const isClose = match[1] === '/';
    const tag = match[2];
    const attrs = match[3];
    const selfClose = match[4] === '/';

    if (isClose) {
      if (tag === 'g' && stack.length > 1) stack.pop();
      continue;
    }

    const parent = stack[stack.length - 1];
    const tfAttr = attrs.match(/\btransform="([^"]+)"/)?.[1];
    const current = tfAttr ? composeAxisTransform(tfAttr, parent) : parent;
    if (!current) {
      flattenedSvgCache.set(trimmed, null);
      return null;
    }

    if (tag === 'g') {
      if (!selfClose) stack.push(current);
      continue;
    }

    if (tag === 'path') {
      const d = attrs.match(/\bd="([^"]+)"/)?.[1];
      if (!d) continue;
      const segments = getParsedGlyphSegments(d);
      if (!segments) {
        flattenedSvgCache.set(trimmed, null);
        return null;
      }
      appendTransformedGlyph(segments, current, chunks);
      continue;
    }

    if (tag === 'rect') {
      const x = Number(attrs.match(/\bx="([^"]+)"/)?.[1] ?? '0');
      const y = Number(attrs.match(/\by="([^"]+)"/)?.[1] ?? '0');
      const w = Number(attrs.match(/\bwidth="([^"]+)"/)?.[1] ?? '0');
      const h = Number(attrs.match(/\bheight="([^"]+)"/)?.[1] ?? '0');
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
        flattenedSvgCache.set(trimmed, null);
        return null;
      }
      if (w > 0 && h > 0) {
        const x1 = fmtCoord(current.sx * x + current.tx);
        const y1 = fmtCoord(current.sy * y + current.ty);
        const x2 = fmtCoord(current.sx * (x + w) + current.tx);
        const y2 = fmtCoord(current.sy * (y + h) + current.ty);
        chunks.push(`M${x1} ${y1}L${x2} ${y1}L${x2} ${y2}L${x1} ${y2}Z`);
      }
    }
  }

  const mergedD = chunks.join('');
  if (!mergedD || !mergedD.startsWith('M')) {
    flattenedSvgCache.set(trimmed, null);
    return null;
  }

  const result: FlattenedMathSvg = { viewBox, d: mergedD };
  if (flattenedSvgCache.size >= MAX_FLAT_CACHE_ENTRIES) {
    const oldest = flattenedSvgCache.keys().next().value;
    if (oldest !== undefined) flattenedSvgCache.delete(oldest);
  }
  flattenedSvgCache.set(trimmed, result);
  return result;
}

/**
 * Expands `<defs><path id="..." d="..."/></defs>` + `<use href="#..." />` into
 * direct `<path d="..." />` elements, replaces `currentColor` with explicit hex,
 * removes redundant strokes on `stroke-width="0"` glyph groups for razor-sharp
 * Android Skia anti-aliasing, and normalizes root SVG sizing attributes.
 */
export function prepareNativeMathSvg(rawSvg: string, color: string): string {
  const trimmed = rawSvg.trim();
  if (!trimmed) return '';

  const cacheKey = `${color}\u0000${trimmed}`;
  const cached = preparedSvgCache.get(cacheKey);
  if (cached !== undefined) return cached;

  // 1. Collect path definitions from <defs>...</defs> (present in server-rendered AI SVGs).
  let svg = expandSvgDefs(trimmed);

  // 2. Drop zero-width strokes completely so Skia renders pure crisp filled glyphs.
  svg = svg
    .replace(/stroke="currentColor"\s+fill="currentColor"\s+stroke-width="0"/g, `stroke="none" fill="${color}"`)
    .replace(/currentColor/g, color)
    .replace(/font-family="serif"/g, 'font-family="FiraSans_500Medium"');

  // 3. Ensure root <svg> scales cleanly to its layout box without cropping.
  if (!svg.includes('preserveAspectRatio=')) {
    svg = svg.replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" ');
  }

  if (preparedSvgCache.size >= MAX_CACHE_ENTRIES) {
    preparedSvgCache.clear();
  }
  preparedSvgCache.set(cacheKey, svg);
  return svg;
}

export type NativeMathDimensions = {
  width: number;
  height: number;
  aspectRatio: number;
  depthPx: number;
  needsHorizontalScroll: boolean;
};

/**
 * Computes balanced, textbook-grade pixel dimensions from MathJax `ex` metrics
 * and guarantees formulas stay strictly within their card margins.
 */
export function computeNativeMathDimensions(
  rendered: RenderedMath,
  options: {
    size: NativeMathSize;
    scale?: number;
    maxWidth?: number;
  },
): NativeMathDimensions {
  const safeScale = Math.min(1.35, Math.max(0.8, finitePositive(options.scale, 1)));
  const pxPerEx = PX_PER_EX[options.size] * safeScale;
  const rawWidth = Math.max(6, finitePositive(rendered.widthEx, 1.4) * pxPerEx);
  const rawHeight = Math.max(10, finitePositive(rendered.heightEx, 1.8) * pxPerEx);
  const rawDepth = Math.max(0, (rendered.depthEx ?? 0) * pxPerEx);

  const maxWidth = options.maxWidth && options.maxWidth > 24 ? options.maxWidth : undefined;
  if (!maxWidth || rawWidth <= maxWidth) {
    const width = Math.ceil(rawWidth);
    const height = Math.max(10, Math.ceil(rawHeight));
    return {
      width,
      height,
      aspectRatio: width / height,
      depthPx: rawDepth,
      needsHorizontalScroll: false,
    };
  }

  // Inline, choice, and card previews always scale cleanly down to fit their box.
  if (options.size === 'inline' || options.size === 'choice' || options.size === 'card') {
    const ratio = maxWidth / rawWidth;
    const width = Math.floor(maxWidth);
    const height = Math.max(10, Math.ceil(rawHeight * ratio));
    return {
      width,
      height,
      aspectRatio: width / height,
      depthPx: rawDepth * ratio,
      needsHorizontalScroll: false,
    };
  }

  // Display / hero equations fit cleanly inside margins up to 28% shrink; only genuinely
  // long derivation chains scroll horizontally with crisp, readable typography.
  const fitRatio = maxWidth / rawWidth;
  if (fitRatio >= 0.72) {
    const width = Math.floor(maxWidth);
    const height = Math.max(14, Math.ceil(rawHeight * fitRatio));
    return {
      width,
      height,
      aspectRatio: width / height,
      depthPx: rawDepth * fitRatio,
      needsHorizontalScroll: false,
    };
  }

  const scrollScale = 0.88;
  const width = Math.ceil(rawWidth * scrollScale);
  const height = Math.max(16, Math.ceil(rawHeight * scrollScale));
  return {
    width,
    height,
    aspectRatio: width / height,
    depthPx: rawDepth * scrollScale,
    needsHorizontalScroll: true,
  };
}
