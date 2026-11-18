import type { RichContent } from '../../../shared/types';
import type { MathDocumentDefinition } from './mathDocument';

function contentText(content: RichContent): string {
  return content.map((block) => {
    if (block.type === 'text') return block.text;
    if (block.type === 'math') return [block.spoken, block.latex].filter(Boolean).join(' — ');
    const visual = block.visual;
    const description = [visual.title, block.spoken].filter(Boolean).join(': ');
    if (visual.kind === 'table') {
      return [description, visual.headers.join(' | '), ...visual.rows.map((row) => row.cells
        .map((cell) => cell.text || cell.spoken || cell.latex).join(' | '))].join('\n');
    }
    return description;
  }).join(' ');
}

/** Keeps explanations and formula source accessible if the native renderer fails. */
export function mathDocumentFallbackText(definition: MathDocumentDefinition): string {
  return definition.sections.map((section) => {
    if (section.kind === 'heading' || section.kind === 'section_title') {
      return [section.eyebrow, section.title].filter(Boolean).join('\n');
    }
    const label = section.kind === 'note' || section.kind === 'answer' ? section.label : undefined;
    const caption = section.kind === 'answer' ? section.caption : undefined;
    return [label, caption, contentText(section.content)].filter(Boolean).join('\n');
  }).join('\n\n');
}
