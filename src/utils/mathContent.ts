import type { ContentBlock, MathAnalysis, MathContentBlock, RichContent, StructuredVisual, VisualColor } from '../types';

function isRenderedMath(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const rendered = value as Record<string, unknown>;
  return typeof rendered.svg === 'string'
    && rendered.svg.startsWith('<svg')
    && typeof rendered.viewBox === 'string'
    && typeof rendered.widthEx === 'number'
    && rendered.widthEx > 0
    && typeof rendered.heightEx === 'number'
    && rendered.heightEx > 0
    && (rendered.depthEx === undefined
      || (typeof rendered.depthEx === 'number' && rendered.depthEx >= 0));
}

const visualColors = new Set<VisualColor>(['violet', 'cyan', 'lime', 'peach', 'rose']);
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object';
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isVisualColor = (value: unknown): value is VisualColor => typeof value === 'string' && visualColors.has(value as VisualColor);
const isBoundedArray = (value: unknown, maximum: number): value is unknown[] => Array.isArray(value) && value.length <= maximum;

function isStructuredVisual(value: unknown): value is StructuredVisual {
  if (!isRecord(value) || typeof value.title !== 'string' || !value.title) return false;

  if (value.kind === 'geometry') {
    if (!Array.isArray(value.points) || value.points.length < 2 || value.points.length > 16
      || !isBoundedArray(value.segments, 24) || !isBoundedArray(value.circles, 6) || !isBoundedArray(value.polygons, 6)) return false;
    const ids = new Set<string>();
    for (const point of value.points) {
      if (!isRecord(point) || typeof point.id !== 'string' || ids.has(point.id) || typeof point.label !== 'string'
        || !isFiniteNumber(point.x) || point.x < 0 || point.x > 100 || !isFiniteNumber(point.y) || point.y < 0 || point.y > 100) return false;
      ids.add(point.id);
    }
    return value.segments.every((segment) => isRecord(segment) && typeof segment.from === 'string' && typeof segment.to === 'string'
      && ids.has(segment.from) && ids.has(segment.to) && segment.from !== segment.to
      && (segment.style === 'solid' || segment.style === 'dashed') && isVisualColor(segment.color))
      && value.circles.every((circle) => isRecord(circle) && typeof circle.center === 'string' && ids.has(circle.center)
        && isFiniteNumber(circle.radius) && circle.radius >= 2 && circle.radius <= 50 && isVisualColor(circle.color))
      && value.polygons.every((polygon) => isRecord(polygon) && Array.isArray(polygon.points) && polygon.points.length >= 3
        && polygon.points.length <= 10 && polygon.points.every((id) => typeof id === 'string' && ids.has(id)) && isVisualColor(polygon.color));
  }

  if (value.kind === 'graph') {
    if (!isFiniteNumber(value.xMin) || !isFiniteNumber(value.xMax) || value.xMin >= value.xMax
      || !isFiniteNumber(value.yMin) || !isFiniteNumber(value.yMax) || value.yMin >= value.yMax
      || !isFiniteNumber(value.xStep) || value.xStep <= 0 || !isFiniteNumber(value.yStep) || value.yStep <= 0
      || !Array.isArray(value.series) || value.series.length < 1 || value.series.length > 3) return false;
    return value.series.every((series) => isRecord(series) && typeof series.label === 'string' && isVisualColor(series.color)
      && Array.isArray(series.points) && series.points.length >= 2 && series.points.length <= 60
      && series.points.every((point) => isRecord(point) && isFiniteNumber(point.x) && isFiniteNumber(point.y)
        && point.x >= (value.xMin as number) && point.x <= (value.xMax as number)
        && point.y >= (value.yMin as number) && point.y <= (value.yMax as number)));
  }

  if (value.kind === 'table') {
    const headers = value.headers;
    const rows = value.rows;
    if (!Array.isArray(headers) || headers.length < 1 || headers.length > 6 || !headers.every((header) => typeof header === 'string' && header.length > 0)
      || !Array.isArray(rows) || rows.length < 1 || rows.length > 10) return false;
    return rows.every((row) => isRecord(row) && Array.isArray(row.cells) && row.cells.length === headers.length
      && row.cells.every((cell) => isRecord(cell) && (
        (typeof cell.text === 'string' && cell.text.length > 0 && cell.latex === '' && cell.spoken === '')
        || (cell.text === '' && typeof cell.latex === 'string' && cell.latex.length > 0 && typeof cell.spoken === 'string' && cell.spoken.length > 0 && isRenderedMath(cell.rendered))
      )));
  }

  if (value.kind === 'number_line') {
    if (!isFiniteNumber(value.min) || !isFiniteNumber(value.max) || value.min >= value.max || !isFiniteNumber(value.step) || value.step <= 0
      || !isBoundedArray(value.markers, 12) || !isBoundedArray(value.intervals, 6)) return false;
    return value.markers.every((marker) => isRecord(marker) && isFiniteNumber(marker.value) && marker.value >= (value.min as number) && marker.value <= (value.max as number)
      && typeof marker.label === 'string' && marker.label.length > 0 && typeof marker.closed === 'boolean' && isVisualColor(marker.color))
      && value.intervals.every((interval) => isRecord(interval) && isFiniteNumber(interval.start) && isFiniteNumber(interval.end)
        && interval.start < interval.end && interval.start >= (value.min as number) && interval.end <= (value.max as number)
        && typeof interval.startClosed === 'boolean' && typeof interval.endClosed === 'boolean' && isVisualColor(interval.color));
  }

  return false;
}

export function isContentBlock(value: unknown): value is ContentBlock {
  if (!value || typeof value !== 'object') return false;
  const block = value as Record<string, unknown>;
  if (block.type === 'text') return typeof block.text === 'string' && block.text.length > 0;
  if (block.type === 'math') return typeof block.latex === 'string'
    && block.latex.length > 0
    && typeof block.spoken === 'string'
    && block.spoken.length > 0
    && isRenderedMath(block.rendered);
  return block.type === 'visual'
    && typeof block.spoken === 'string'
    && block.spoken.length > 0
    && isStructuredVisual(block.visual);
}

export function isRichContent(value: unknown, allowEmpty = true): value is RichContent {
  return Array.isArray(value)
    && (allowEmpty || value.length > 0)
    && value.every(isContentBlock);
}

export function isMathAnalysis(value: unknown): value is MathAnalysis {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<MathAnalysis>;
  return (data.schemaVersion === 3 || data.schemaVersion === 4)
    && (data.status === 'ready' || data.status === 'not_math' || data.status === 'unclear')
    && (data.mode === 'solve' || data.mode === 'check')
    && typeof data.title === 'string'
    && typeof data.topic === 'string'
    && typeof data.headline === 'string'
    && isRichContent(data.problem)
    && isRichContent(data.summary)
    && isRichContent(data.finalAnswer)
    && Array.isArray(data.steps)
    && (data.status !== 'ready' || data.steps.length > 0)
    && data.steps.every((step) => Boolean(step)
      && typeof step.title === 'string'
      && typeof step.kicker === 'string'
      && isRichContent(step.explanation, false)
      && isRichContent(step.note, false)
      && isRichContent(step.alternative, false))
    && Array.isArray(data.takeaways)
    && data.takeaways.every((item) => Boolean(item) && isRichContent(item.content, false));
}

export function contentToAccessibleText(content: RichContent): string {
  return content
    .map((block) => block.type === 'text' ? block.text : block.spoken)
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const standalonePunctuationPattern = /^[,.;:!?…]+$/u;
const leadingPunctuationPattern = /^[,.;:!?…]+\s*/u;

export function prepareRichContentForPresentation(content: RichContent): RichContent {
  return content.reduce<RichContent>((prepared, block) => {
    if (block.type !== 'text') {
      prepared.push(block);
      return prepared;
    }

    const previous = prepared.at(-1);
    const text = (previous && previous.type !== 'text'
      ? block.text.trim().replace(leadingPunctuationPattern, '').trimStart()
      : block.text.trim());
    if (!text || standalonePunctuationPattern.test(text)) return prepared;

    if (previous?.type === 'text') {
      const separator = /^[,.;:!?…]/u.test(text) ? '' : ' ';
      prepared[prepared.length - 1] = { ...previous, text: `${previous.text.trimEnd()}${separator}${text}` };
      return prepared;
    }

    prepared.push({ ...block, text });
    return prepared;
  }, []);
}

export function firstMathBlock(content: RichContent): MathContentBlock | undefined {
  return content.find((block): block is MathContentBlock => block.type === 'math');
}

export function representativeMathBlock(content: RichContent): MathContentBlock | undefined {
  const mathBlocks = content.filter((block): block is MathContentBlock => block.type === 'math');
  return mathBlocks.reduce<MathContentBlock | undefined>((best, candidate) => {
    const score = (block: MathContentBlock) => {
      const relation = /(?:=|<|>|\\le|\\ge|\\approx|\\sim|\\perp|\\parallel)/.test(block.latex) ? 34 : 0;
      const structure = /\\(?:frac|sqrt|begin|angle|triangle|overline|vec|int|sum|lim)/.test(block.latex) ? 18 : 0;
      const values = /\d/.test(block.latex) ? 10 : 0;
      const bareSymbolPenalty = /^(?:[A-Za-z]|\\[A-Za-z]+)(?:_\{?\w+\}?)?$/.test(block.latex.trim()) ? 30 : 0;
      return relation + structure + values + Math.min(block.latex.length, 32) - bareSymbolPenalty;
    };
    return !best || score(candidate) > score(best) ? candidate : best;
  }, undefined);
}

export function compactProblemContent(content: RichContent): RichContent {
  const firstMathIndex = content.findIndex((block) => block.type === 'math');
  if (firstMathIndex < 0) return content.slice(0, 1);

  const start = Math.max(0, firstMathIndex - 1);
  const connector = content[firstMathIndex + 1];
  const followingMath = content[firstMathIndex + 2];
  const hasMathPair = connector?.type === 'text'
    && /^(?:și|sau|ori|respectiv)$/.test(connector.text.trim().toLocaleLowerCase('ro-RO'))
    && followingMath?.type === 'math';

  return content.slice(start, firstMathIndex + (hasMathPair ? 3 : 1));
}

export function firstTextBlock(content: RichContent): string | undefined {
  return content.find((block) => block.type === 'text')?.text;
}
