import type {
  GeometryVisual,
  GraphVisual,
  MathContentBlock,
  NumberLineVisual,
  RichContent,
  StructuredVisual,
  TableCell,
  TableVisual,
  VisualColor,
} from '../../../shared/types';
import { prepareRichContentForPresentation } from './mathContent.ts';

export type MathDocumentTone = 'violet' | 'cyan' | 'lime' | 'peach' | 'rose';
export type MathDocumentVariant = 'lesson' | 'problem' | 'alternate' | 'summary';

export type MathDocumentSection =
  | { kind: 'heading'; eyebrow: string; title: string; tone?: MathDocumentTone }
  | { kind: 'content'; content: RichContent }
  | { kind: 'note'; label: string; content: RichContent; tone?: MathDocumentTone }
  | { kind: 'section_title'; title: string; eyebrow?: string }
  | { kind: 'answer'; label?: string; caption?: string; content: RichContent }
  | { kind: 'takeaway'; index: number; content: RichContent; tone?: MathDocumentTone };

export type MathDocumentDefinition = {
  accessibilityLabel: string;
  variant: MathDocumentVariant;
  sections: MathDocumentSection[];
};

export type MathDocumentFonts = {
  bodyRegular?: string;
  bodySemibold?: string;
  display?: string;
};

const palette: Record<VisualColor, string> = {
  violet: '#7C3CFF',
  cyan: '#48D9E8',
  lime: '#A9CF1F',
  peach: '#FF9273',
  rose: '#FF5F72',
};

const visualLabels: Record<StructuredVisual['kind'], string> = {
  geometry: 'DESEN GEOMETRIC',
  graph: 'GRAFIC',
  table: 'TABEL',
  number_line: 'AXĂ NUMERICĂ',
};

type RenderContext = { formula: number; visual: number };

export function escapeDocumentHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeCssUrl(value: string | undefined): string | undefined {
  if (!value || !/^(?:file|https?):\/\//i.test(value)) return undefined;
  return value.replace(/\\/g, '/').replace(/["'()\r\n]/g, (character) => encodeURIComponent(character));
}

function finite(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function compactNumber(value: number) {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(2))).replace('.', ',');
}

function finiteTicks(minimum: number, maximum: number, requestedStep: number, limit = 12) {
  const range = maximum - minimum;
  if (!Number.isFinite(range) || range <= 0 || !Number.isFinite(requestedStep) || requestedStep <= 0) return [];
  const multiplier = Math.max(1, Math.ceil(range / requestedStep / limit));
  const step = requestedStep * multiplier;
  const first = Math.ceil(minimum / step) * step;
  const values: number[] = [];
  for (let value = first; value <= maximum + step * 0.001 && values.length <= limit; value += step) {
    values.push(Math.abs(value) < step * 0.0001 ? 0 : Number(value.toFixed(8)));
  }
  return values;
}

function namespaceSvgIds(svg: string, namespace: string) {
  return svg
    .replace(/\bid="([^"]+)"/g, (_match, id: string) => `id="${namespace}-${id}"`)
    .replace(/\bhref="#([^"]+)"/g, (_match, id: string) => `href="#${namespace}-${id}"`)
    .replace(/\bxlink:href="#([^"]+)"/g, (_match, id: string) => `xlink:href="#${namespace}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_match, id: string) => `url(#${namespace}-${id})`);
}

export function sanitizeDocumentSvg(svg: string, namespace: string) {
  if (!/^<svg\b[\s\S]*<\/svg>$/i.test(svg.trim())) return '';
  const cleaned = svg
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<(?:iframe|object|embed)\b[\s\S]*?<\/(?:iframe|object|embed)>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
    .replace(/\s(?:href|xlink:href)\s*=\s*(?:"(?!#)[^"]*"|'(?!#)[^']*')/gi, '')
    .replace(/\s(?:data|aria)-[\w:-]+="[^"]*"/g, '')
    .replace(/<svg\b/i, '<svg aria-hidden="true" focusable="false"');
  return namespaceSvgIds(cleaned, namespace);
}

function mathDimensions(math: MathContentBlock) {
  const width = Math.max(0.7, finite(math.rendered.widthEx, 1) * 0.5);
  const height = Math.max(0.9, finite(math.rendered.heightEx, 1.8) * 0.5);
  const depth = Math.max(0, finite(math.rendered.depthEx ?? 0) * 0.5);
  return { width, height, depth };
}

function formulaSvg(math: MathContentBlock, context: RenderContext) {
  context.formula += 1;
  return sanitizeDocumentSvg(math.rendered.svg, `doc-${context.formula}`);
}

function inlineFormula(math: MathContentBlock, context: RenderContext, className = 'math-inline') {
  const svg = formulaSvg(math, context);
  if (!svg) return `<span class="math-missing">[formulă indisponibilă]</span>`;
  const size = mathDimensions(math);
  return `<span class="${className}" role="img" aria-label="${escapeDocumentHtml(math.spoken)}" style="--math-w:${size.width.toFixed(3)}em;--math-h:${size.height.toFixed(3)}em;--math-d:${size.depth.toFixed(3)}em">${svg}</span>`;
}

function displayFormula(math: MathContentBlock, context: RenderContext) {
  const svg = formulaSvg(math, context);
  if (!svg) return `<div class="math-missing">Formula nu a putut fi afișată.</div>`;
  const size = mathDimensions(math);
  const width = Math.max(2.4, size.width);
  const height = Math.max(1.1, size.height);
  const wide = width > 42 ? ' is-wide' : '';
  return `<div class="math-display${wide}" role="img" aria-label="${escapeDocumentHtml(math.spoken)}"><span class="math-canvas" style="--math-w:${width.toFixed(3)}em;--math-h:${height.toFixed(3)}em;--math-ratio:${(width / height).toFixed(4)}">${svg}</span></div>`;
}

function isInlineFormula(math: MathContentBlock, hasTextNeighbor: boolean) {
  if (!hasTextNeighbor) return false;
  if (/\\begin\{|\\(?:aligned|cases|matrix|pmatrix|bmatrix|array|gathered|split)\b/.test(math.latex)) return false;
  return math.rendered.widthEx <= 18 && math.rendered.heightEx <= 4.2;
}

type SubproblemGroup = { label?: string; content: RichContent };

function splitSubproblems(content: RichContent): SubproblemGroup[] {
  const groups: SubproblemGroup[] = [];
  let current: SubproblemGroup = { content: [] };
  const labelPattern = /(?:^|\s)((?:[a-zăâîșț]|[ivxlcdm]+|\d+)\))(?:\s+|$)/giu;
  const documentLabelCount = content.reduce((count, block) => block.type === 'text'
    ? count + [...block.text.trim().matchAll(labelPattern)].length
    : count, 0);
  content.forEach((block) => {
    if (block.type !== 'text') {
      current.content.push(block);
      return;
    }
    const source = block.text.trim();
    const matches = [...source.matchAll(labelPattern)];
    const labels = matches.map((match) => {
      const matchStart = match.index ?? 0;
      const labelOffset = match[0].indexOf(match[1]);
      return { label: match[1], start: matchStart + labelOffset };
    });
    const beginsWithLabel = labels[0]?.start === 0;
    if (labels.length > 0 && (documentLabelCount > 1 || beginsWithLabel)) {
      let cursor = 0;
      labels.forEach((match, index) => {
        const before = source.slice(cursor, match.start).trim();
        if (before) current.content.push({ ...block, text: before });
        if (current.label || current.content.length > 0) groups.push(current);
        current = { label: match.label, content: [] };
        const nextStart = index + 1 < labels.length ? labels[index + 1].start : source.length;
        const after = source.slice(match.start + match.label.length, nextStart).trim();
        if (after) current.content.push({ ...block, text: after });
        cursor = nextStart;
      });
      return;
    }

    const startMatch = source.match(/^((?:[a-zăâîșț]|[ivxlcdm]+|\d+)[.:])(?:\s+|$)(.*)$/iu);
    if (startMatch) {
      if (current.label || current.content.length > 0) groups.push(current);
      current = { label: startMatch[1], content: [] };
      if (startMatch[2]) current.content.push({ ...block, text: startMatch[2] });
      return;
    }

    current.content.push(block);
  });
  if (current.label || current.content.length > 0) groups.push(current);
  return groups;
}

function renderCoreContent(content: RichContent, context: RenderContext) {
  const prepared = prepareRichContentForPresentation(content);
  const output: string[] = [];
  let paragraph: string[] = [];
  let displays: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) output.push(`<p>${paragraph.join(' ').replace(/\s+([,.;:!?…])/g, '$1')}</p>`);
    paragraph = [];
  };
  const flushDisplays = () => {
    if (displays.length > 0) output.push(`<div class="derivation">${displays.join('')}</div>`);
    displays = [];
  };

  prepared.forEach((block, index) => {
    if (block.type === 'visual') {
      flushParagraph();
      flushDisplays();
      output.push(renderVisual(block.visual, block.spoken, context));
      return;
    }
    if (block.type === 'text') {
      flushDisplays();
      const text = block.text.trim();
      if (text) paragraph.push(escapeDocumentHtml(text));
      return;
    }

    const previous = prepared[index - 1];
    const next = prepared[index + 1];
    const hasTextNeighbor = previous?.type === 'text' || next?.type === 'text';
    // A run of formulas represents successive calculations, not two words in
    // one sentence. Keep a single compact expression inline with prose, but
    // render adjacent formulas as a readable, vertically separated derivation.
    const belongsToFormulaRun = previous?.type === 'math' || next?.type === 'math';
    if (!belongsToFormulaRun && isInlineFormula(block, hasTextNeighbor)) {
      flushDisplays();
      paragraph.push(inlineFormula(block, context));
      return;
    }
    flushParagraph();
    displays.push(displayFormula(block, context));
  });
  flushParagraph();
  flushDisplays();
  return output.join('');
}

export function renderRichMathDocument(content: RichContent, context: RenderContext = { formula: 0, visual: 0 }) {
  const groups = splitSubproblems(content);
  if (!groups.some((group) => group.label)) return renderCoreContent(content, context);
  return groups.map((group) => group.label
    ? `<div class="subproblem"><span class="subproblem-label">${escapeDocumentHtml(group.label)}</span><div class="subproblem-content">${renderCoreContent(group.content, context)}</div></div>`
    : renderCoreContent(group.content, context)).join('');
}

function renderGeometry(visual: GeometryVisual) {
  const width = 320;
  const height = 220;
  const padding = 28;
  const points = new Map(visual.points.map((point) => [point.id, {
    ...point,
    px: padding + finite(point.x) / 100 * (width - padding * 2),
    py: padding + finite(point.y) / 100 * (height - padding * 2),
  }]));
  const polygons = visual.polygons.map((polygon) => {
    const coordinates = polygon.points.map((id) => points.get(id)).filter(Boolean).map((point) => `${point!.px.toFixed(2)},${point!.py.toFixed(2)}`).join(' ');
    return `<polygon points="${coordinates}" fill="${palette[polygon.color]}" fill-opacity=".14" stroke="${palette[polygon.color]}" stroke-width="1.5"/>`;
  }).join('');
  const circles = visual.circles.map((circle) => {
    const center = points.get(circle.center);
    if (!center) return '';
    const radius = finite(circle.radius) / 100 * (width - padding * 2);
    return `<circle cx="${center.px}" cy="${center.py}" r="${radius}" fill="none" stroke="${palette[circle.color]}" stroke-width="2.5"/>`;
  }).join('');
  const segments = visual.segments.map((segment) => {
    const from = points.get(segment.from);
    const to = points.get(segment.to);
    if (!from || !to) return '';
    return `<line x1="${from.px}" y1="${from.py}" x2="${to.px}" y2="${to.py}" stroke="${palette[segment.color]}" stroke-width="3" ${segment.style === 'dashed' ? 'stroke-dasharray="8 6"' : ''} stroke-linecap="round"/>`;
  }).join('');
  const pointNodes = visual.points.map((point) => {
    const resolved = points.get(point.id)!;
    return `<g><circle cx="${resolved.px}" cy="${resolved.py}" r="5" fill="#FFFEFA" stroke="#171337" stroke-width="2.5"/>${point.label ? `<text x="${resolved.px + 8}" y="${resolved.py - 8}" class="visual-svg-label">${escapeDocumentHtml(point.label)}</text>` : ''}</g>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true"><rect width="${width}" height="${height}" rx="16" fill="#FCFAFF"/>${polygons}${circles}${segments}${pointNodes}</svg>`;
}

function renderGraph(visual: GraphVisual) {
  const width = 320;
  const height = 230;
  const plot = { left: 38, right: 14, top: 15, bottom: 32 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const mapX = (value: number) => plot.left + (value - visual.xMin) / (visual.xMax - visual.xMin) * plotWidth;
  const mapY = (value: number) => plot.top + (visual.yMax - value) / (visual.yMax - visual.yMin) * plotHeight;
  const xTicks = finiteTicks(visual.xMin, visual.xMax, visual.xStep);
  const yTicks = finiteTicks(visual.yMin, visual.yMax, visual.yStep);
  const axisX = visual.yMin <= 0 && visual.yMax >= 0 ? mapY(0) : height - plot.bottom;
  const axisY = visual.xMin <= 0 && visual.xMax >= 0 ? mapX(0) : plot.left;
  const gridX = xTicks.map((tick) => `<line x1="${mapX(tick)}" y1="${plot.top}" x2="${mapX(tick)}" y2="${height - plot.bottom}" class="visual-grid"/><text x="${mapX(tick)}" y="${height - 10}" text-anchor="middle" class="visual-tick">${escapeDocumentHtml(compactNumber(tick))}</text>`).join('');
  const gridY = yTicks.map((tick) => `<line x1="${plot.left}" y1="${mapY(tick)}" x2="${width - plot.right}" y2="${mapY(tick)}" class="visual-grid"/>${tick === 0 ? '' : `<text x="${plot.left - 7}" y="${mapY(tick) + 4}" text-anchor="end" class="visual-tick">${escapeDocumentHtml(compactNumber(tick))}</text>`}`).join('');
  const series = visual.series.map((item) => `<polyline points="${item.points.map((point) => `${mapX(point.x)},${mapY(point.y)}`).join(' ')}" fill="none" stroke="${palette[item.color]}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true"><rect width="${width}" height="${height}" rx="16" fill="#FCFAFF"/>${gridX}${gridY}<line x1="${plot.left}" y1="${axisX}" x2="${width - plot.right}" y2="${axisX}" class="visual-axis"/><line x1="${axisY}" y1="${plot.top}" x2="${axisY}" y2="${height - plot.bottom}" class="visual-axis"/>${series}<text x="${width - plot.right}" y="${axisX - 7}" text-anchor="end" class="visual-svg-label">x</text><text x="${axisY + 7}" y="${plot.top + 11}" class="visual-svg-label">y</text></svg>`;
}

function renderNumberLine(visual: NumberLineVisual) {
  const width = 320;
  const height = 132;
  const left = 22;
  const right = width - 22;
  const axisY = 62;
  const mapX = (value: number) => left + (value - visual.min) / (visual.max - visual.min) * (right - left);
  const ticks = finiteTicks(visual.min, visual.max, visual.step, 14);
  const intervals = visual.intervals.map((interval) => {
    const color = palette[interval.color];
    return `<g><line x1="${mapX(interval.start)}" y1="${axisY - 16}" x2="${mapX(interval.end)}" y2="${axisY - 16}" stroke="${color}" stroke-width="7" stroke-linecap="round"/><circle cx="${mapX(interval.start)}" cy="${axisY - 16}" r="5.5" fill="${interval.startClosed ? color : '#FFFEFA'}" stroke="${color}" stroke-width="2.5"/><circle cx="${mapX(interval.end)}" cy="${axisY - 16}" r="5.5" fill="${interval.endClosed ? color : '#FFFEFA'}" stroke="${color}" stroke-width="2.5"/></g>`;
  }).join('');
  const tickNodes = ticks.map((tick) => `<g><line x1="${mapX(tick)}" y1="${axisY - 6}" x2="${mapX(tick)}" y2="${axisY + 7}" stroke="#171337" stroke-width="1.5"/><text x="${mapX(tick)}" y="${axisY + 25}" text-anchor="middle" class="visual-tick">${escapeDocumentHtml(compactNumber(tick))}</text></g>`).join('');
  const markers = visual.markers.map((marker) => {
    const color = palette[marker.color];
    return `<g><circle cx="${mapX(marker.value)}" cy="${axisY}" r="6.5" fill="${marker.closed ? color : '#FFFEFA'}" stroke="${color}" stroke-width="3"/><text x="${mapX(marker.value)}" y="${axisY + 47}" text-anchor="middle" class="visual-svg-label">${escapeDocumentHtml(marker.label)}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true"><rect width="${width}" height="${height}" rx="16" fill="#FCFAFF"/><line x1="${left}" y1="${axisY}" x2="${right}" y2="${axisY}" class="visual-axis"/><polygon points="${right},${axisY} ${right - 10},${axisY - 6} ${right - 10},${axisY + 6}" fill="#171337"/>${intervals}${tickNodes}${markers}</svg>`;
}

function renderTableCell(cell: TableCell, context: RenderContext) {
  if ('rendered' in cell) {
    const math: MathContentBlock = { type: 'math', text: '', latex: cell.latex, spoken: cell.spoken, rendered: cell.rendered };
    return inlineFormula(math, context, 'table-math');
  }
  return escapeDocumentHtml(cell.text);
}

function renderTable(visual: TableVisual, context: RenderContext) {
  const head = visual.headers.map((header) => `<th scope="col">${escapeDocumentHtml(header)}</th>`).join('');
  const rows = visual.rows.map((row) => `<tr>${row.cells.map((cell) => `<td>${renderTableCell(cell, context)}</td>`).join('')}</tr>`).join('');
  return `<div class="table-scroll"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderVisual(visual: StructuredVisual, spoken: string, context: RenderContext) {
  context.visual += 1;
  const canvas = visual.kind === 'geometry' ? renderGeometry(visual)
    : visual.kind === 'graph' ? renderGraph(visual)
      : visual.kind === 'number_line' ? renderNumberLine(visual)
        : renderTable(visual, context);
  return `<figure class="structured-visual" role="img" aria-label="${escapeDocumentHtml(spoken)}"><figcaption><span>${visualLabels[visual.kind]}</span><strong>${escapeDocumentHtml(visual.title)}</strong></figcaption><div class="visual-canvas">${canvas}</div></figure>`;
}

function renderSection(section: MathDocumentSection, context: RenderContext) {
  if (section.kind === 'heading') {
    return `<header class="document-heading tone-${section.tone ?? 'cyan'}"><span>${escapeDocumentHtml(section.eyebrow)}</span><h1>${escapeDocumentHtml(section.title)}</h1></header>`;
  }
  if (section.kind === 'content') return `<section class="document-content">${renderRichMathDocument(section.content, context)}</section>`;
  if (section.kind === 'note') return `<aside class="document-note tone-${section.tone ?? 'lime'}"><i>✦</i><div><strong>${escapeDocumentHtml(section.label)}</strong>${renderRichMathDocument(section.content, context)}</div></aside>`;
  if (section.kind === 'section_title') return `<header class="section-heading">${section.eyebrow ? `<span>${escapeDocumentHtml(section.eyebrow)}</span>` : ''}<h2>${escapeDocumentHtml(section.title)}</h2></header>`;
  if (section.kind === 'answer') return `<section class="answer-section">${section.label ? `<span class="answer-label">${escapeDocumentHtml(section.label)}</span>` : ''}<div>${section.caption ? `<small>${escapeDocumentHtml(section.caption)}</small>` : ''}${renderRichMathDocument(section.content, context)}</div></section>`;
  return `<section class="takeaway tone-${section.tone ?? (section.index % 2 === 0 ? 'peach' : 'cyan')}"><span>${String(section.index).padStart(2, '0')}</span><div>${renderRichMathDocument(section.content, context)}</div></section>`;
}

export function buildMathDocumentMarkup(definition: MathDocumentDefinition) {
  const context: RenderContext = { formula: 0, visual: 0 };
  return definition.sections.map((section) => renderSection(section, context)).join('');
}

function fontFace(name: string, url: string | undefined, weight: number) {
  const safeUrl = escapeCssUrl(url);
  return safeUrl ? `@font-face{font-family:${name};src:url("${safeUrl}") format("truetype");font-weight:${weight};font-style:normal;font-display:block}` : '';
}

function documentCss(fonts: MathDocumentFonts) {
  return `${fontFace('DocumentBody', fonts.bodyRegular, 400)}${fontFace('DocumentBody', fonts.bodySemibold, 600)}${fontFace('DocumentDisplay', fonts.display, 700)}
:root{color-scheme:light;--ink:#171337;--ink-soft:#5A5372;--paper:#FFFFFF;--canvas:#FFF8EC;--violet:#7C3CFF;--violet-deep:#4B1FB8;--violet-soft:#ECE2FF;--lime:#D8FF3E;--cyan:#43D6E6;--peach:#FF8D6B;--gold:#FFD447;--rose:#FF576D;--line:#DACFE8;--body:DocumentBody,system-ui,-apple-system,sans-serif;--display:DocumentDisplay,DocumentBody,system-ui,sans-serif}
*{box-sizing:border-box}
html,body{width:100%;max-width:100%;margin:0;min-height:100%;overflow-x:hidden;background:transparent;color:var(--ink);font-family:var(--body);-webkit-text-size-adjust:100%;text-rendering:optimizeLegibility}
body{padding:0}button,a{display:none}
#document{width:100%;max-width:100%;overflow-x:hidden;padding:12px 14px 16px;opacity:1;transform:none}
.document-heading{margin:0 0 9px}
.document-heading>span,.section-heading>span{display:inline-block;padding:2.5px 9px;border-radius:8px;border:2px solid var(--ink);font-size:10.5px;font-weight:600;letter-spacing:.08em;color:var(--ink);transform:rotate(-1.5deg)}
.document-heading.tone-violet>span{background:var(--violet-soft)}.document-heading.tone-cyan>span{background:#D2F7FA}.document-heading.tone-lime>span{background:#EEFFAD}.document-heading.tone-peach>span{background:#FFE4DA}
.section-heading>span{background:var(--violet-soft);color:var(--violet-deep);border-color:var(--violet-deep);transform:none}
.document-heading h1{margin:6px 0 0;max-width:32ch;font-family:var(--display);font-size:19.5px;line-height:1.18;letter-spacing:-.012em;color:var(--ink)}
.document-content{min-width:0;max-width:100%;font-size:14.5px;line-height:1.48;color:#272042}
.document-content p,.document-note p,.takeaway p,.answer-section p{margin:0 0 8px}
.document-content p:last-child,.document-note p:last-child,.takeaway p:last-child,.answer-section p:last-child{margin-bottom:0}
.math-inline,.table-math{display:inline-block;width:var(--math-w);height:var(--math-h);max-width:100%;vertical-align:calc(-1 * var(--math-d));margin:0 .06em;white-space:nowrap}
.math-inline svg,.table-math svg,.math-canvas svg{display:block;width:100%;height:100%;color:var(--ink)}
.derivation{margin:7px 0;padding:7px 10px;border-radius:13px;border:2px solid #DDD0F7;background:#F9F5FF}
.math-display{width:100%;max-width:100%;overflow:hidden;padding:3px 0;text-align:center}
.math-canvas{display:inline-block;width:min(var(--math-w),100%);max-width:100%;height:auto;aspect-ratio:var(--math-ratio);vertical-align:middle}
.math-display.is-wide{overflow-x:auto;overflow-y:hidden;overscroll-behavior-inline:contain;scrollbar-width:thin;text-align:left}
.math-display.is-wide .math-canvas{width:var(--math-w);max-width:none;min-width:var(--math-w)}
.math-display.is-wide:after{content:'Glisează formula ↔';display:block;position:sticky;left:0;width:max-content;margin:3px 0 0 auto;padding:2.5px 8px;border-radius:7px;background:var(--violet-soft);color:var(--violet-deep);font-size:10px;font-weight:600;letter-spacing:.03em}
.math-missing{color:var(--rose);font-weight:600}
.subproblem{display:grid;grid-template-columns:30px minmax(0,1fr);gap:8px;align-items:start;padding:7px 0}
.subproblem+.subproblem{border-top:1.5px dashed #E5DCF5}
.subproblem-label{width:28px;min-height:28px;display:grid;place-items:center;border-radius:9px;border:2px solid var(--ink);background:var(--violet-soft);font-family:var(--display);font-size:13.5px;color:var(--ink)}
.subproblem-content{min-width:0;max-width:100%;padding-top:1px}
.subproblem-content>.derivation{margin:0;padding:5px 8px}
.subproblem-content .math-display{text-align:left;padding-top:0}
.document-note{display:grid;grid-template-columns:24px minmax(0,1fr);gap:8px;margin:10px 0 2px;padding:9px 11px;border:2px solid var(--ink);border-radius:14px;box-shadow:0 3px 0 var(--ink);background:#F3FFCA;color:#272042}
.document-note.tone-cyan{background:#DEF9FC}.document-note.tone-peach{background:#FFE7DF}
.document-note>i{width:22px;height:22px;display:grid;place-items:center;border-radius:7px;border:1.5px solid var(--ink);background:var(--lime);font-style:normal;color:var(--ink);font-size:12px;line-height:1;transform:rotate(-5deg)}
.document-note strong{display:block;margin-bottom:2px;font-size:10.5px;letter-spacing:.08em;color:var(--violet-deep)}
.document-note .document-content,.document-note p{font-size:13px;line-height:1.42}
.section-heading{margin:10px 0 7px;padding-bottom:5px;border-bottom:2px dashed #E1D6F3}
.section-heading:first-child{margin-top:0}
.section-heading h2{margin:0;font-family:var(--display);font-size:17.5px;line-height:1.18;color:var(--ink)}
.section-heading>span+ h2{margin-top:4px}
.answer-section{padding:11px 13px 10px;margin:0 0 11px;border:2.5px solid var(--ink);border-radius:17px;box-shadow:0 4px 0 #4B1FB8;background:linear-gradient(180deg,#F3ECFF 0%,#FFFFFF 100%)}
.answer-label{display:inline-block;margin-bottom:5px;padding:2.5px 9px;border-radius:8px;border:2px solid var(--ink);background:var(--lime);color:var(--ink);font-size:10.5px;font-weight:600;letter-spacing:.08em;transform:rotate(-1.2deg)}
.answer-section small{display:block;margin-bottom:6px;color:var(--ink-soft);font-size:11.5px;line-height:1.35}
.answer-section .derivation{margin:0;padding:7px 10px;background:#FFFFFF;border-color:#D5C5F6}
.answer-section .math-display{text-align:left;padding:2px 0}
.takeaway{display:grid;grid-template-columns:30px minmax(0,1fr);gap:10px;align-items:start;padding:10px 11px;margin-bottom:9px;border:2px solid var(--ink);border-radius:15px;box-shadow:0 3px 0 var(--ink);background:#FFFFFF}
.takeaway.tone-cyan{background:#F4FEFF}.takeaway.tone-peach{background:#FFF8F4}.takeaway.tone-lime{background:#FAFFEC}
.takeaway:last-child{margin-bottom:0}
.takeaway>span{width:28px;height:28px;display:grid;place-items:center;border-radius:9px;border:2px solid var(--ink);background:#D2F7FA;color:var(--ink);font-family:var(--display);font-size:12px;font-weight:700;transform:rotate(-4deg)}
.takeaway.tone-peach>span{background:#FFE4DA}.takeaway.tone-lime>span{background:#EEFFAD}
.takeaway>div{font-size:13.5px;line-height:1.45;color:#272042}
.structured-visual{width:100%;min-width:0;max-width:100%;margin:10px 0;padding:0;overflow:hidden}
.structured-visual figcaption{display:flex;align-items:center;gap:7px;margin-bottom:5px}
.structured-visual figcaption span{padding:2.5px 7px;border-radius:7px;border:1.5px solid var(--ink);background:#EEFFAD;color:var(--ink);font-size:10px;font-weight:600;letter-spacing:.06em}
.structured-visual figcaption strong{font-size:12.5px;color:var(--ink)}
.visual-canvas{overflow:hidden;border-radius:15px;border:2px solid var(--ink);background:#FCFAFF}
.visual-canvas>svg{display:block;width:100%;height:auto}
.visual-grid{stroke:#E1DAEE;stroke-width:1}.visual-axis{stroke:var(--ink);stroke-width:2}.visual-svg-label{fill:var(--ink);font:600 13px var(--body)}.visual-tick{fill:var(--ink-soft);font:400 11px var(--body)}
.table-scroll{width:100%;min-width:0;max-width:100%;overflow-x:auto;overscroll-behavior-inline:contain;border-radius:12px;border:2px solid var(--ink);background:#FCFAFF}
.table-scroll table{width:100%;min-width:max-content;border-collapse:collapse}
.table-scroll th,.table-scroll td{min-width:84px;padding:7px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);text-align:center}
.table-scroll th{background:var(--violet-soft);color:var(--violet-deep);font-size:12px}.table-scroll td{font-size:13px}.table-math{font-size:14px}
.problem #document,.alternate #document{padding:6px 4px 18px}
.problem .document-content,.alternate .document-content{font-size:14.5px;line-height:1.52}
.summary #document{padding:11px 13px 14px}.summary .document-content{font-size:14px;line-height:1.48}
@media(max-width:350px){#document{padding-left:11px;padding-right:11px}.document-heading h1{font-size:18.5px}.document-content{font-size:14px}}
@media(prefers-reduced-motion:reduce){#document{transition:none;transform:none}}`;
}

function safeScriptJson(value: string) {
  return JSON.stringify(value).replace(/<\//g, '<\\/');
}

export function buildMathDocumentHtml(
  definition: MathDocumentDefinition,
  fonts: MathDocumentFonts = {},
  preparedMarkup = buildMathDocumentMarkup(definition),
) {
  const markup = preparedMarkup;
  const label = escapeDocumentHtml(definition.accessibilityLabel);
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src file: data: http: https:; img-src file: data:; connect-src 'none'; media-src 'none'; frame-src 'none';"><style>${documentCss(fonts)}</style></head><body class="${definition.variant}"><main id="document" role="document" aria-label="${label}">${markup}</main><script>(function(){var root=document.getElementById('document');function ready(revision){root.classList.add('visible');if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify({type:'document-ready',revision:revision||'initial'}));}}function afterPaint(callback){var done=false;var timer=0;function finish(){if(done)return;done=true;clearTimeout(timer);callback();}requestAnimationFrame(finish);if(!done){timer=setTimeout(finish,36);}}function afterFonts(callback){var finished=false;var timer;function finish(){if(finished)return;finished=true;clearTimeout(timer);callback();}timer=setTimeout(finish,1500);if(document.fonts&&document.fonts.ready){document.fonts.ready.then(finish,finish);}else{finish();}}window.__setDocument=function(markup,label,variant,revision){root.innerHTML=markup;root.setAttribute('aria-label',label);document.body.className=variant;window.scrollTo(0,0);afterFonts(function(){afterPaint(function(){ready(revision);});});};afterFonts(function(){afterPaint(function(){ready('initial');});});})();</script></body></html>`;
}

export function buildMathDocumentUpdateScript(definition: MathDocumentDefinition, revision: string) {
  const markup = buildMathDocumentMarkup(definition);
  return `window.__setDocument(${safeScriptJson(markup)},${safeScriptJson(definition.accessibilityLabel)},${safeScriptJson(definition.variant)},${safeScriptJson(revision)});true;`;
}
