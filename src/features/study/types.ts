import type { StructuredVisual } from '../../shared/types';

export type StudyTrackId = 'gimnaziu' | 'en' | 'liceu' | 'bac_m1' | 'bac_m2' | 'bac_m3';

export type StudyTrackMeta = {
  id: StudyTrackId;
  label: string;
  shortLabel: string;
  eyebrow: string;
  description: string;
  examGuideId: ExamGuideId;
  accent: 'violet' | 'cyan' | 'lime' | 'peach' | 'gold';
};

export type FormulaCategoryId =
  | 'algebra'
  | 'geometry'
  | 'trigonometry'
  | 'matrices'
  | 'analysis'
  | 'combinatorics';

export type FormulaCategoryMeta = {
  id: FormulaCategoryId;
  label: string;
  shortLabel: string;
  accent: string;
};

/**
 * Authoring-time rich content block. Text blocks support inline `$...$` LaTeX
 * compiled to crisp native Fira Math SVG at build time (`compile-study-content.mjs`)
 * so every screen paints synchronously on Frame 0 with zero WebView overhead.
 */
export type StudyContentBlock =
  | { type: 'text'; text: string }
  | { type: 'math'; latex: string; spoken: string; caption?: string }
  | {
      type: 'subpoint';
      label: string;
      points?: string;
      text: string;
      math?: string;
      spoken?: string;
    }
  | {
      type: 'step';
      title?: string;
      text: string;
      math?: string;
      spoken?: string;
    }
  | {
      type: 'note';
      label: string;
      text: string;
      tone?: 'violet' | 'cyan' | 'lime' | 'peach';
    }
  | { type: 'visual'; spoken: string; visual: StructuredVisual };

export type FormulaExpression = {
  label?: string;
  latex: string;
  spoken: string;
};

export type FormulaEntry = {
  id: string;
  title: string;
  category: FormulaCategoryId;
  tracks: readonly StudyTrackId[];
  examTag?: string;
  /** Short clean formula summary used for search and fallback accessibility. */
  preview: string;
  /** Primary LaTeX formula rendered cleanly on list cards (compact SVG preview). */
  formulaLatex: string;
  formulaSpoken: string;
  /**
   * Optional structured list of key formulas displayed on separate airy rows on
   * the detail sheet (prevents cramming 3-4 formulas onto one tiny line).
   */
  formulas?: readonly FormulaExpression[];
  /** Concise explanation of when and why to use the formula (supports inline `$...$`). */
  whenToUse: string;
  /** Worked example in Romanian using StudyContentBlock (text, steps, math). */
  example: readonly StudyContentBlock[];
  /** Common exam trap or condition students often miss (supports inline `$...$`). */
  pitfall: string;
  /** Optional geometry/graph/table/number-line diagram. */
  visual?: { spoken: string; visual: StructuredVisual };
  /** Keywords used by instant Romanian search. */
  keywords: readonly string[];
};

export type ExamGuideId = 'en' | 'bac_m1' | 'bac_m2' | 'bac_m3';

export type ExamSubjectGuide = {
  id: 's1' | 's2' | 's3';
  label: string;
  shortLabel: string;
  points: number;
  recommendedMinutes: number;
  formatLabel: string;
  summary: string;
  frequentTopics: readonly string[];
  gradingTips: readonly string[];
  modelTitle: string;
  modelProblem: readonly StudyContentBlock[];
  modelSolution: readonly StudyContentBlock[];
  rubricBreakdown: readonly { step: string; points: string }[];
  relatedFormulaIds: readonly string[];
};

export type ExamGuide = {
  id: ExamGuideId;
  title: string;
  shortTitle: string;
  eyebrow: string;
  subtitle: string;
  durationMinutes: number;
  totalPoints: number;
  officePoints: number;
  accent: 'violet' | 'peach' | 'cyan' | 'gold';
  overviewNote: string;
  timeStrategy: readonly string[];
  subjects: readonly [ExamSubjectGuide, ExamSubjectGuide, ExamSubjectGuide];
};

export const STUDY_TRACKS: readonly StudyTrackMeta[] = [
  {
    id: 'en',
    label: 'Evaluarea Națională (VIII)',
    shortLabel: 'EN · Clasa VIII',
    eyebrow: 'GIMNAZIU · EXAMEN',
    description: 'Algebră, geometrie plană și în spațiu + structura reală EN.',
    examGuideId: 'en',
    accent: 'cyan',
  },
  {
    id: 'bac_m1',
    label: 'BAC · M1 Mate-Info',
    shortLabel: 'BAC · M1',
    eyebrow: 'LICEU · PROFIL REAL',
    description: 'Programă completă M1: algebră, matrice, analiză și modele pe barem.',
    examGuideId: 'bac_m1',
    accent: 'violet',
  },
  {
    id: 'bac_m2',
    label: 'BAC · M2 Științe',
    shortLabel: 'BAC · M2',
    eyebrow: 'LICEU · ȘTIINȚE',
    description: 'Formule esențiale M2, funcții, matrice, derivate și integrale.',
    examGuideId: 'bac_m2',
    accent: 'lime',
  },
  {
    id: 'bac_m3',
    label: 'BAC · M3 Tehnologic',
    shortLabel: 'BAC · M3',
    eyebrow: 'LICEU · TEHNOLOGIC',
    description: 'Baze solide, ecuații, matrice 2×2, analiză clară pas cu pas.',
    examGuideId: 'bac_m3',
    accent: 'peach',
  },
  {
    id: 'gimnaziu',
    label: 'Gimnaziu (V–VII)',
    shortLabel: 'Clasele V–VII',
    eyebrow: 'BAZE GIMNAZIU',
    description: 'Fracții, puteri, radicali, calcul algebric și geometrie plană.',
    examGuideId: 'en',
    accent: 'gold',
  },
  {
    id: 'liceu',
    label: 'Liceu (IX–XI)',
    shortLabel: 'Clasele IX–XI',
    eyebrow: 'BAZE LICEU',
    description: 'Funcții, logaritmi, trigonometrie, vectori, matrice și limite.',
    examGuideId: 'bac_m1',
    accent: 'violet',
  },
] as const;

export const FORMULA_CATEGORIES: readonly FormulaCategoryMeta[] = [
  { id: 'algebra', label: 'Algebră & Ecuații', shortLabel: 'Algebră', accent: '#7C3CFF' },
  { id: 'geometry', label: 'Geometrie', shortLabel: 'Geometrie', accent: '#43D6E6' },
  { id: 'trigonometry', label: 'Trigonometrie', shortLabel: 'Trigo', accent: '#FF8D6B' },
  { id: 'combinatorics', label: 'Probabilități & Numărare', shortLabel: 'Numărare', accent: '#FFD447' },
  { id: 'matrices', label: 'Matrice & Polinoame', shortLabel: 'Matrice', accent: '#D63D73' },
  { id: 'analysis', label: 'Analiză (Limite, Derivate, Integrale)', shortLabel: 'Analiză', accent: '#4ED686' },
] as const;

export function getStudyTrackMeta(id: StudyTrackId): StudyTrackMeta {
  return STUDY_TRACKS.find((track) => track.id === id) ?? STUDY_TRACKS[0];
}

export function getFormulaCategoryMeta(id: FormulaCategoryId): FormulaCategoryMeta {
  return FORMULA_CATEGORIES.find((cat) => cat.id === id) ?? FORMULA_CATEGORIES[0];
}
