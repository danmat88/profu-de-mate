import type {
  ContentBlock,
  RichContent,
  StructuredVisual,
  TableCell,
  TableVisual,
} from '../../../shared/types';
import type {
  MathDocumentDefinition,
  MathDocumentSection,
  MathDocumentTone,
} from '../../math/utils/mathDocument.ts';
import { FORMULAS_CATALOG } from '../data/formulasCatalog.ts';
import { getRenderedStudyMath } from '../data/renderedMath.generated.ts';
import {
  getFormulaCategoryMeta,
  type ExamGuide,
  type ExamSubjectGuide,
  type FormulaCategoryId,
  type FormulaEntry,
  type StudyContentBlock,
  type StudyTrackId,
} from '../types.ts';
import { parseInlineMathSegments } from './inlineMath.ts';

export type FormulaFilterOptions = {
  track?: StudyTrackId | null;
  category?: FormulaCategoryId | 'all';
  query?: string;
  favoritesOnly?: boolean;
  favoriteIds?: readonly string[];
};

const CATEGORY_DOCUMENT_TONE: Record<FormulaCategoryId, MathDocumentTone> = {
  algebra: 'violet',
  geometry: 'cyan',
  trigonometry: 'peach',
  combinatorics: 'lime',
  matrices: 'violet',
  analysis: 'cyan',
};

export function normalizeStudySearch(value: string): string {
  return value
    .toLocaleLowerCase('ro-RO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveTableVisual(visual: TableVisual): TableVisual {
  return {
    ...visual,
    rows: visual.rows.map((row) => ({
      cells: row.cells.map((cell): TableCell => {
        if ('rendered' in cell) {
          const compiled = getRenderedStudyMath(cell.latex, 'inline');
          return compiled ? { ...cell, rendered: compiled } : cell;
        }
        return cell;
      }),
    })),
  };
}

function resolveVisual(visual: StructuredVisual): StructuredVisual {
  if (visual.kind === 'table') return resolveTableVisual(visual);
  return visual;
}

function appendRichTextBlocks(output: ContentBlock[], rawText: string) {
  const segments = parseInlineMathSegments(rawText);
  for (const seg of segments) {
    if (seg.kind === 'text') {
      output.push({ type: 'text', text: seg.text, latex: '', spoken: '' });
    } else {
      const rendered = getRenderedStudyMath(seg.latex, 'inline');
      if (rendered) {
        output.push({ type: 'math', text: '', latex: seg.latex, spoken: seg.latex, rendered });
      } else {
        output.push({ type: 'text', text: seg.latex, latex: '', spoken: '' });
      }
    }
  }
}

export function resolveStudyContentBlocks(blocks: readonly StudyContentBlock[]): RichContent {
  const output: ContentBlock[] = [];
  for (const block of blocks) {
    if (block.type === 'text') {
      appendRichTextBlocks(output, block.text);
      continue;
    }
    if (block.type === 'subpoint') {
      const pointsTag = block.points ? ` (${block.points})` : '';
      appendRichTextBlocks(output, `${block.label} ${block.text}${pointsTag}`);
      if (block.math) {
        const rendered = getRenderedStudyMath(block.math, 'display');
        if (rendered) {
          output.push({
            type: 'math',
            text: '',
            latex: block.math,
            spoken: block.spoken ?? block.math,
            rendered,
          });
        }
      }
      continue;
    }
    if (block.type === 'step') {
      const prefix = block.title ? `${block.title}: ` : '';
      appendRichTextBlocks(output, `${prefix}${block.text}`);
      if (block.math) {
        const rendered = getRenderedStudyMath(block.math, 'display');
        if (rendered) {
          output.push({
            type: 'math',
            text: '',
            latex: block.math,
            spoken: block.spoken ?? block.math,
            rendered,
          });
        }
      }
      continue;
    }
    if (block.type === 'note') {
      appendRichTextBlocks(output, `${block.label}: ${block.text}`);
      continue;
    }
    if (block.type === 'visual') {
      output.push({
        type: 'visual',
        text: '',
        latex: '',
        spoken: block.spoken,
        visual: resolveVisual(block.visual),
      });
      continue;
    }
    const rendered = getRenderedStudyMath(block.latex, 'display');
    if (rendered) {
      output.push({
        type: 'math',
        text: '',
        latex: block.latex,
        spoken: block.spoken,
        rendered,
      });
    } else {
      output.push({
        type: 'text',
        text: block.spoken,
        latex: '',
        spoken: '',
      });
    }
  }
  return output;
}

export function buildFormulaDocument(formula: FormulaEntry): MathDocumentDefinition {
  const categoryMeta = getFormulaCategoryMeta(formula.category);
  const formulaContent = resolveStudyContentBlocks([
    { type: 'math', latex: formula.formulaLatex, spoken: formula.formulaSpoken },
  ]);

  const sections: MathDocumentSection[] = [
    {
      kind: 'heading',
      eyebrow: formula.examTag ? `${categoryMeta.shortLabel.toUpperCase()} · ${formula.examTag}` : categoryMeta.label.toUpperCase(),
      title: formula.title,
      tone: CATEGORY_DOCUMENT_TONE[formula.category],
    },
    {
      kind: 'answer',
      label: 'FORMULA ESENȚIALĂ',
      caption: formula.preview,
      content: formulaContent,
    },
    {
      kind: 'section_title',
      eyebrow: 'APLICARE',
      title: 'Când o folosești',
    },
    {
      kind: 'content',
      content: [{ type: 'text', text: formula.whenToUse, latex: '', spoken: '' }],
    },
  ];

  if (formula.visual) {
    sections.push({
      kind: 'content',
      content: resolveStudyContentBlocks([
        { type: 'visual', spoken: formula.visual.spoken, visual: formula.visual.visual },
      ]),
    });
  }

  sections.push(
    {
      kind: 'section_title',
      eyebrow: 'PAS CU PAS',
      title: 'Exemplu rezolvat',
    },
    {
      kind: 'content',
      content: resolveStudyContentBlocks(formula.example),
    },
    {
      kind: 'note',
      label: 'ATENȚIE LA CAPCANĂ!',
      tone: 'peach',
      content: [{ type: 'text', text: formula.pitfall, latex: '', spoken: '' }],
    },
  );

  return {
    accessibilityLabel: `Fișă de formulă: ${formula.title}`,
    variant: 'lesson',
    sections,
  };
}

export function buildExamSubjectModelDocument(
  guide: ExamGuide,
  subject: ExamSubjectGuide,
): MathDocumentDefinition {
  const sections: MathDocumentSection[] = [
    {
      kind: 'heading',
      eyebrow: `${guide.shortTitle} · ${subject.shortLabel.toUpperCase()}`,
      title: subject.modelTitle,
      tone: guide.accent === 'gold' ? 'lime' : guide.accent,
    },
    {
      kind: 'section_title',
      eyebrow: subject.formatLabel.toUpperCase(),
      title: 'Enunț model',
    },
    {
      kind: 'content',
      content: resolveStudyContentBlocks(subject.modelProblem),
    },
    {
      kind: 'section_title',
      eyebrow: 'REDACTARE COMPLETĂ',
      title: 'Rezolvare pas cu pas',
    },
    {
      kind: 'content',
      content: resolveStudyContentBlocks(subject.modelSolution),
    },
    {
      kind: 'section_title',
      eyebrow: 'BAREM OFICIAL',
      title: 'Cum se acordă punctele',
    },
    ...subject.rubricBreakdown.map((item, index): MathDocumentSection => ({
      kind: 'takeaway',
      index: index + 1,
      tone: index % 2 === 0 ? 'lime' : 'cyan',
      content: [
        { type: 'text', text: `${item.points} — ${item.step}`, latex: '', spoken: '' },
      ],
    })),
  ];

  return {
    accessibilityLabel: `Model pe barem: ${subject.modelTitle}`,
    variant: 'summary',
    sections,
  };
}

export function getFormulaById(id: string): FormulaEntry | undefined {
  return FORMULAS_CATALOG.find((formula) => formula.id === id);
}

export function getFormulasForTrack(track: StudyTrackId): FormulaEntry[] {
  return FORMULAS_CATALOG.filter((formula) => formula.tracks.includes(track));
}

export function filterFormulas(
  formulas: readonly FormulaEntry[],
  options: FormulaFilterOptions,
): FormulaEntry[] {
  const favoriteSet = options.favoritesOnly ? new Set(options.favoriteIds ?? []) : null;
  const normalizedQuery = options.query ? normalizeStudySearch(options.query) : '';
  const tokens = normalizedQuery ? normalizedQuery.split(' ').filter(Boolean) : [];

  return formulas.filter((formula) => {
    if (options.track && !formula.tracks.includes(options.track)) return false;
    if (options.category && options.category !== 'all' && formula.category !== options.category) return false;
    if (favoriteSet && !favoriteSet.has(formula.id)) return false;
    if (tokens.length === 0) return true;

    const categoryMeta = getFormulaCategoryMeta(formula.category);
    const haystack = normalizeStudySearch([
      formula.title,
      formula.preview,
      formula.whenToUse,
      formula.examTag ?? '',
      categoryMeta.label,
      ...formula.keywords,
    ].join(' '));
    return tokens.every((token) => haystack.includes(token));
  });
}
