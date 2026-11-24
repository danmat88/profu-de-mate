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
const preparedSvgCache = new Map<string, string>();

function finitePositive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
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

  let svg = trimmed;

  // 1. Collect path definitions from <defs>...</defs> (present in server-rendered AI SVGs).
  if (svg.includes('<defs>')) {
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
  }

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

  // Display / hero equations fit cleanly inside margins up to 26% shrink; only genuinely
  // long derivation chains scroll horizontally with crisp, readable typography.
  const fitRatio = maxWidth / rawWidth;
  if (fitRatio >= 0.74) {
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

  const scrollScale = 0.86;
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
