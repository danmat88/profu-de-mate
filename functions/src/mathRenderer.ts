import { createHash } from 'node:crypto';
import type { ContentBlock, MathAnalysis, RichContent } from './analysisSchema.js';

type MathJaxNode = unknown;
type MathJaxApi = {
  config: { loader: { paths: Record<string, string> } };
  init: (configuration: Record<string, unknown>) => Promise<MathJaxApi>;
  tex2svgPromise: (latex: string, options: Record<string, unknown>) => Promise<MathJaxNode>;
  startup: { adaptor: { serializeXML: (node: MathJaxNode) => string } };
};

export type RenderedMath = {
  svg: string;
  viewBox: string;
  widthEx: number;
  heightEx: number;
};

export type RenderedContentBlock = ContentBlock & {
  rendered?: RenderedMath;
};

export type RenderedRichContent = RenderedContentBlock[];

export type RenderedMathAnalysis = Omit<MathAnalysis, 'problem' | 'summary' | 'finalAnswer' | 'steps' | 'takeaways'> & {
  schemaVersion: 3;
  problem: RenderedRichContent;
  summary: RenderedRichContent;
  finalAnswer: RenderedRichContent;
  steps: Array<Omit<MathAnalysis['steps'][number], 'explanation' | 'note' | 'alternative'> & {
    explanation: RenderedRichContent;
    note: RenderedRichContent;
    alternative: RenderedRichContent;
  }>;
  takeaways: Array<{ content: RenderedRichContent }>;
};

let mathJaxReady: Promise<MathJaxApi> | null = null;
const renderCache = new Map<string, RenderedMath>();

function initializeMathJax(): Promise<MathJaxApi> {
  if (mathJaxReady) return mathJaxReady;

  mathJaxReady = import('mathjax').then(async ({ default: module }) => {
    const mathJax = module as MathJaxApi;
    const packageDirectory = new URL('.', import.meta.resolve('mathjax')).href.replace(/\/$/, '');
    mathJax.config.loader.paths.mathjax = packageDirectory;
    return mathJax.init({
      loader: { load: ['input/tex', 'output/svg'] },
      tex: {
        formatError: (_jax: unknown, error: { message?: string }) => {
          throw new Error(error.message ?? 'Invalid mathematical notation.');
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
        blacker: 8,
      },
    });
  });
  return mathJaxReady;
}

function prefixSvgIds(svg: string, prefix: string): string {
  return svg
    .replace(/\bid="([^"]+)"/g, (_match, id: string) => `id="${prefix}-${id}"`)
    .replace(/\bhref="#([^"]+)"/g, (_match, id: string) => `href="#${prefix}-${id}"`)
    .replace(/\bxlink:href="#([^"]+)"/g, (_match, id: string) => `xlink:href="#${prefix}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_match, id: string) => `url(#${prefix}-${id})`);
}

export async function renderLatex(latex: string): Promise<RenderedMath> {
  const normalized = latex.trim();
  const cacheKey = createHash('sha256').update(`mathjax-4.1.3-fira-v2\u0000${normalized}`).digest('hex');
  const cached = renderCache.get(cacheKey);
  if (cached) return cached;

  const mathJax = await initializeMathJax();
  const node = await mathJax.tex2svgPromise(normalized, { display: true });
  const serialized = mathJax.startup.adaptor.serializeXML(node);
  const svgMatch = serialized.match(/<svg\b[\s\S]*<\/svg>/);
  if (!svgMatch) throw new Error('MathJax did not produce SVG output.');

  const rawSvg = svgMatch[0];
  const viewBox = rawSvg.match(/\bviewBox="([^"]+)"/)?.[1];
  const widthEx = Number.parseFloat(rawSvg.match(/\bwidth="([\d.]+)ex"/)?.[1] ?? '0');
  const heightEx = Number.parseFloat(rawSvg.match(/\bheight="([\d.]+)ex"/)?.[1] ?? '0');
  if (!viewBox || !Number.isFinite(widthEx) || widthEx <= 0 || !Number.isFinite(heightEx) || heightEx <= 0) {
    throw new Error('MathJax produced invalid SVG dimensions.');
  }

  let svg = rawSvg
    .replace(/\swidth="[^"]+"/, ' width="100%"')
    .replace(/\sheight="[^"]+"/, ' height="100%"')
    .replace(/\sstyle="[^"]*"/, '')
    .replace(/\srole="[^"]*"/, '')
    .replace(/\sfocusable="[^"]*"/, '')
    .replace(/\s(?:data|aria)-[\w:-]+="[^"]*"/g, '')
    .replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" ');
  svg = prefixSvgIds(svg, `m${cacheKey.slice(0, 12)}`);

  const rendered = { svg, viewBox, widthEx, heightEx };
  renderCache.set(cacheKey, rendered);
  if (renderCache.size > 300) renderCache.delete(renderCache.keys().next().value as string);
  return rendered;
}

async function renderContent(content: RichContent): Promise<RenderedRichContent> {
  return Promise.all(content.map(async (block) => block.type === 'math'
    ? { ...block, rendered: await renderLatex(block.latex) }
    : block));
}

export async function renderMathAnalysis(value: MathAnalysis): Promise<RenderedMathAnalysis> {
  const [problem, summary, finalAnswer, steps, takeaways] = await Promise.all([
    renderContent(value.problem),
    renderContent(value.summary),
    renderContent(value.finalAnswer),
    Promise.all(value.steps.map(async (step) => ({
      ...step,
      explanation: await renderContent(step.explanation),
      note: await renderContent(step.note),
      alternative: await renderContent(step.alternative),
    }))),
    Promise.all(value.takeaways.map(async (takeaway) => ({ content: await renderContent(takeaway.content) }))),
  ]);

  return {
    ...value,
    schemaVersion: 3,
    problem,
    summary,
    finalAnswer,
    steps,
    takeaways,
  };
}
