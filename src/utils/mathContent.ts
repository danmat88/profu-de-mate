import type { ContentBlock, MathAnalysis, MathContentBlock, RichContent } from '../types';

function isRenderedMath(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const rendered = value as Record<string, unknown>;
  return typeof rendered.svg === 'string'
    && rendered.svg.startsWith('<svg')
    && typeof rendered.viewBox === 'string'
    && typeof rendered.widthEx === 'number'
    && rendered.widthEx > 0
    && typeof rendered.heightEx === 'number'
    && rendered.heightEx > 0;
}

export function isContentBlock(value: unknown): value is ContentBlock {
  if (!value || typeof value !== 'object') return false;
  const block = value as Record<string, unknown>;
  if (block.type === 'text') return typeof block.text === 'string' && block.text.length > 0;
  return block.type === 'math'
    && typeof block.latex === 'string'
    && block.latex.length > 0
    && typeof block.spoken === 'string'
    && block.spoken.length > 0
    && isRenderedMath(block.rendered);
}

export function isRichContent(value: unknown, allowEmpty = true): value is RichContent {
  return Array.isArray(value)
    && (allowEmpty || value.length > 0)
    && value.every(isContentBlock);
}

export function isMathAnalysis(value: unknown): value is MathAnalysis {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<MathAnalysis>;
  return data.schemaVersion === 3
    && (data.status === 'ready' || data.status === 'not_math' || data.status === 'unclear')
    && (data.mode === 'solve' || data.mode === 'check')
    && typeof data.title === 'string'
    && typeof data.topic === 'string'
    && typeof data.headline === 'string'
    && isRichContent(data.problem)
    && isRichContent(data.summary)
    && isRichContent(data.finalAnswer)
    && Array.isArray(data.steps)
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

export function firstMathBlock(content: RichContent): MathContentBlock | undefined {
  return content.find((block): block is MathContentBlock => block.type === 'math');
}

export function firstTextBlock(content: RichContent): string | undefined {
  return content.find((block) => block.type === 'text')?.text;
}
