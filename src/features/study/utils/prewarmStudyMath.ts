import { colors } from '../../../shared/theme';
import type { RichContent } from '../../../shared/types';
import { prewarmNativeMathSvg } from '../../math/components/NativeMathFormula';
import { getRenderedStudyMath } from '../data/renderedMath.generated';
import type { StudyContentBlock } from '../types';
import { tokenizeInlineMathText } from './inlineMath';

function prewarmInlineMath(text: string | undefined, color: string = colors.ink): void {
  if (!text || !text.includes('$')) return;
  const atoms = tokenizeInlineMathText(text);
  for (const atom of atoms) {
    if (atom.kind !== 'math') continue;
    const inlineRendered = getRenderedStudyMath(atom.latex, 'inline');
    if (inlineRendered) prewarmNativeMathSvg(inlineRendered.svg, color);
    if (atoms.length === 1 && !atom.prefix && !atom.suffix) {
      const displayRendered = getRenderedStudyMath(atom.latex, 'display');
      if (displayRendered) prewarmNativeMathSvg(displayRendered.svg, color);
    }
  }
}

function prewarmDisplayLatex(latex: string | undefined, color: string = colors.ink): void {
  if (!latex) return;
  const rendered = getRenderedStudyMath(latex, 'display');
  if (rendered) prewarmNativeMathSvg(rendered.svg, color);
}

/**
 * Quietly pre-parses the SVG ASTs for upcoming questions, exam items, or
 * formula sheets so tapping Next renders in 0ms on the very first frame.
 */
export function prewarmStudyMath(options: {
  blocks?: readonly StudyContentBlock[];
  liveContent?: RichContent;
  displayLatex?: readonly (string | undefined)[];
  inlineTexts?: readonly (string | undefined)[];
  color?: string;
}): void {
  const color = options.color ?? colors.ink;

  if (options.displayLatex) {
    for (const latex of options.displayLatex) {
      prewarmDisplayLatex(latex, color);
    }
  }

  if (options.inlineTexts) {
    for (const text of options.inlineTexts) {
      prewarmInlineMath(text, color);
    }
  }

  if (options.blocks) {
    for (const block of options.blocks) {
      if (block.type === 'text') {
        prewarmInlineMath(block.text, color);
      } else if (block.type === 'math') {
        prewarmDisplayLatex(block.latex, color);
        prewarmInlineMath(block.caption, colors.violetDeep);
      } else if (block.type === 'subpoint') {
        prewarmInlineMath(block.text, color);
        prewarmDisplayLatex(block.math, color);
      } else if (block.type === 'step') {
        prewarmInlineMath(block.text, color);
        prewarmDisplayLatex(block.math, color);
      } else if (block.type === 'note') {
        prewarmInlineMath(block.text, color);
      }
    }
  }

  if (options.liveContent) {
    for (const block of options.liveContent) {
      if (block.type === 'math' && block.rendered) {
        prewarmNativeMathSvg(block.rendered.svg, color);
      }
    }
  }
}
