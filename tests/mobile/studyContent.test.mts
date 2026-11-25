import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { navigationStateAfterIdentityChange } from '../../src/app/navigation/sessionNavigation.ts';
import { EXAM_GUIDES, getExamGuide } from '../../src/features/exams/data/examGuidesCatalog.ts';
import {
  EXAM_SIMULATIONS,
  getExamSimulationsForExam,
} from '../../src/features/exams/data/examSimulationsCatalog.ts';
import {
  buildExamItemDocument,
  buildExamRubricDocument,
  computeExamScore,
  evaluateAutoExamItem,
  formatRomanianGrade,
  getScopeItems,
} from '../../src/features/exams/utils/examEngine.ts';
import { buildMathDocumentMarkup } from '../../src/features/math/utils/mathDocument.ts';
import {
  computeNativeMathDimensions,
  flattenNativeMathSvg,
  prepareNativeMathSvg,
} from '../../src/features/math/utils/nativeMathSvg.ts';
import { PRACTICE_BANK } from '../../src/features/practice/data/practiceBank.ts';
import {
  buildPracticeExplanationDocument,
  buildPracticePromptDocument,
  computeCategoryStats,
  computeNextStreak,
  evaluatePracticeAnswer,
  normalizeShortAnswer,
  selectPracticeQuestions,
  shuffleQuestionChoices,
} from '../../src/features/practice/utils/practiceEngine.ts';
import { FORMULAS_CATALOG } from '../../src/features/study/data/formulasCatalog.ts';
import { getRenderedStudyMath, RENDERED_STUDY_MATH } from '../../src/features/study/data/renderedMath.generated.ts';
import { FORMULA_CATEGORIES, STUDY_TRACKS, type StudyContentBlock } from '../../src/features/study/types.ts';
import {
  extractInlineMathExpressions,
  tokenizeInlineMathText,
} from '../../src/features/study/utils/inlineMath.ts';
import {
  buildExamSubjectModelDocument,
  buildFormulaDocument,
  filterFormulas,
  getFormulaById,
  getFormulasForTrack,
  normalizeStudySearch,
} from '../../src/features/study/utils/studyDocumentBuilder.ts';

function assertValidRenderedMath(latex: string, context: string, mode: 'display' | 'inline' = 'display') {
  const rendered = getRenderedStudyMath(latex, mode) ?? RENDERED_STUDY_MATH[latex];
  assert.ok(rendered, `Lipsește SVG pre-compilat (${mode}) pentru ${context}: ${latex}`);
  assert.match(rendered.svg, /^<svg\b[\s\S]*<\/svg>$/, `SVG invalid pentru ${context}`);
  assert.equal(rendered.svg.includes('<use'), false, `SVG pentru ${context} trebuie să aibă <use> expandat`);
  assert.equal(rendered.svg.includes('<text'), false, `SVG pentru ${context} nu trebuie să cadă pe <text>`);
  assert.ok(rendered.viewBox.trim().length > 0, `viewBox lipsă pentru ${context}`);
  assert.ok(Number.isFinite(rendered.widthEx) && rendered.widthEx > 0, `widthEx invalid pentru ${context}`);
  assert.ok(Number.isFinite(rendered.heightEx) && rendered.heightEx > 0, `heightEx invalid pentru ${context}`);
}

function assertAllInlineMathInText(text: string | undefined, context: string) {
  if (!text) return;
  for (const expr of extractInlineMathExpressions(text)) {
    assertValidRenderedMath(expr, `${context}:inline`, 'inline');
  }
}

function assertAllMathInBlocks(blocks: readonly StudyContentBlock[], context: string) {
  for (const block of blocks) {
    if (block.type === 'text') {
      assertAllInlineMathInText(block.text, context);
    } else if (block.type === 'math') {
      assertValidRenderedMath(block.latex, context, 'display');
      assertAllInlineMathInText(block.caption, context);
    } else if (block.type === 'subpoint' || block.type === 'step') {
      assertAllInlineMathInText(block.text, context);
      if (block.type === 'step') assertAllInlineMathInText(block.title, context);
      if (block.math) assertValidRenderedMath(block.math, context, 'display');
    } else if (block.type === 'note') {
      assertAllInlineMathInText(block.text, context);
    }
  }
}

test('every curated formula has unique IDs, valid metadata, pre-compiled MathJax SVG, and crisp rendered markup', () => {
  assert.ok(FORMULAS_CATALOG.length >= 16, 'catalogul trebuie să includă cel puțin 16 fișe esențiale');
  const seenIds = new Set<string>();
  const validCategories = new Set(FORMULA_CATEGORIES.map((item) => item.id));
  const validTracks = new Set(STUDY_TRACKS.map((item) => item.id));

  for (const formula of FORMULAS_CATALOG) {
    assert.equal(seenIds.has(formula.id), false, `ID duplicat: ${formula.id}`);
    seenIds.add(formula.id);
    assert.ok(validCategories.has(formula.category), `Categorie invalidă: ${formula.category}`);
    assert.ok(formula.tracks.length > 0, `Formula ${formula.id} trebuie asociată cu cel puțin un nivel`);
    for (const track of formula.tracks) {
      assert.ok(validTracks.has(track), `Track invalid ${track} pe ${formula.id}`);
    }

    assertValidRenderedMath(formula.formulaLatex, `${formula.id}.formulaLatex`);
    for (const block of formula.example) {
      if (block.type === 'math') {
        assertValidRenderedMath(block.latex, `${formula.id}.example`);
      }
    }
    if (formula.visual?.visual.kind === 'table') {
      for (const row of formula.visual.visual.rows) {
        for (const cell of row.cells) {
          if ('latex' in cell && cell.latex) {
            assertValidRenderedMath(cell.latex, `${formula.id}.table`);
          }
        }
      }
    }

    const doc = buildFormulaDocument(formula);
    const html = buildMathDocumentMarkup(doc);
    assert.equal(html.includes('formulă indisponibilă'), false, `Formulă inline lipsă în ${formula.id}`);
    assert.equal(html.includes('nu a putut fi afișată'), false, `Formulă display lipsă în ${formula.id}`);
    assert.match(html, /<svg\b/, `HTML generat pentru ${formula.id} trebuie să conțină SVG`);
  }

  for (const track of STUDY_TRACKS) {
    assert.ok(getFormulasForTrack(track.id).length >= 5, `Track-ul ${track.id} trebuie să aibă cel puțin 5 fișe`);
  }
});

test('EN VIII and BAC M1/M2/M3 exam guides sum to 100 points, reference valid formulas, and render rubric models cleanly', () => {
  assert.deepEqual(EXAM_GUIDES.map((g) => g.id), ['en', 'bac_m1', 'bac_m2', 'bac_m3']);

  for (const guide of EXAM_GUIDES) {
    const subjectsPoints = guide.subjects.reduce((sum, subject) => sum + subject.points, 0);
    assert.equal(guide.officePoints + subjectsPoints, guide.totalPoints, `${guide.id} trebuie să însumeze 100p`);
    assert.equal(guide.totalPoints, 100);
    assert.ok(guide.durationMinutes === 120 || guide.durationMinutes === 180);
    assert.ok(guide.timeStrategy.length >= 3);

    for (const subject of guide.subjects) {
      assert.ok(subject.frequentTopics.length >= 3, `${guide.id}.${subject.id} necesită teme frecvente`);
      assert.ok(subject.gradingTips.length >= 2, `${guide.id}.${subject.id} necesită sfaturi de barem`);
      assert.ok(subject.rubricBreakdown.length >= 1, `${guide.id}.${subject.id} necesită criterii pe barem`);

      for (const formulaId of subject.relatedFormulaIds) {
        assert.ok(getFormulaById(formulaId), `${guide.id}.${subject.id} referențiază formulă inexistentă: ${formulaId}`);
      }

      for (const block of [...subject.modelProblem, ...subject.modelSolution]) {
        if (block.type === 'math') {
          assertValidRenderedMath(block.latex, `${guide.id}.${subject.id}`);
        }
      }

      const doc = buildExamSubjectModelDocument(guide, subject);
      const html = buildMathDocumentMarkup(doc);
      assert.equal(html.includes('formulă indisponibilă'), false, `Formulă lipsă în ${guide.id}.${subject.id}`);
      assert.equal(html.includes('nu a putut fi afișată'), false, `Formulă display lipsă în ${guide.id}.${subject.id}`);
    }
  }

  assert.equal(getExamGuide('en').durationMinutes, 120);
  assert.equal(getExamGuide('bac_m1').durationMinutes, 180);
});

test('diacritic-insensitive Romanian search, category, track, and favorite filtering work accurately', () => {
  assert.equal(normalizeStudySearch('Ecuația de gradul al II-lea — Viète'), 'ecuatia de gradul al ii-lea — viete');

  const pitagoraResults = filterFormulas(FORMULAS_CATALOG, { query: 'pitagora' });
  assert.ok(pitagoraResults.some((item) => item.id === 'geo-pitagora-metrice'));

  const rationalizareResults = filterFormulas(FORMULAS_CATALOG, { query: 'rationalizare' });
  assert.ok(rationalizareResults.some((item) => item.id === 'alg-radicali-modul'));

  const enOnly = filterFormulas(FORMULAS_CATALOG, { track: 'en' });
  assert.equal(enOnly.every((item) => item.tracks.includes('en')), true);
  assert.equal(enOnly.some((item) => item.category === 'analysis'), false, 'EN VIII nu include analiză de liceu');

  const favOnly = filterFormulas(FORMULAS_CATALOG, {
    favoritesOnly: true,
    favoriteIds: ['alg-ecuatie-gr2', 'ana-integrale-leibniz'],
  });
  assert.deepEqual(favOnly.map((item) => item.id), ['alg-ecuatie-gr2', 'ana-integrale-leibniz']);
});

test('public curriculum routes survive identity changes and all new screens obey 60fps Android guardrails', async () => {
  for (const safeStack of [
    ['Home', 'Formulas'] as const,
    ['Home', 'Formulas', 'FormulaDetail'] as const,
    ['Home', 'ExamGuide'] as const,
    ['Home', 'ExamsHub'] as const,
    ['Home', 'ExamsHub', 'ExamSimulation'] as const,
    ['Home', 'ExamsHub', 'ExamResult'] as const,
    ['Home', 'PracticeHub'] as const,
    ['Home', 'PracticeHub', 'PracticeSession'] as const,
    ['Home', 'PracticeHub', 'PracticeSummary'] as const,
  ]) {
    assert.equal(
      navigationStateAfterIdentityChange(safeStack, safeStack[safeStack.length - 1]),
      null,
      `Stack-ul ${safeStack.join(' -> ')} trebuie păstrat la schimbarea sesiunii`,
    );
  }

  const newUiFiles = [
    'src/app/components/StudioTabBar.tsx',
    'src/app/screens/StudioScreen.tsx',
    'src/features/study/components/StudyTrackSheet.tsx',
    'src/features/study/components/FormulaCard.tsx',
    'src/features/study/screens/StudyHubScreen.tsx',
    'src/features/study/screens/FormulasScreen.tsx',
    'src/features/study/screens/FormulaDetailScreen.tsx',
    'src/features/exams/screens/ExamGuideScreen.tsx',
    'src/features/exams/screens/ExamsHubScreen.tsx',
    'src/features/exams/screens/ExamSimulationScreen.tsx',
    'src/features/exams/screens/ExamResultScreen.tsx',
    'src/features/practice/components/AiPracticeSheet.tsx',
    'src/features/practice/screens/PracticeHubScreen.tsx',
    'src/features/practice/screens/PracticeSessionScreen.tsx',
    'src/features/practice/screens/PracticeSummaryScreen.tsx',
  ];

  for (const rel of newUiFiles) {
    const source = await readFile(path.resolve(rel), 'utf8');
    assert.doesNotMatch(source, /react-native-reanimated/, `${rel} nu trebuie să folosească Reanimated`);
    assert.doesNotMatch(source, /<SafeAreaView/, `${rel} trebuie să aplice insets sincron fără SafeAreaView`);
    assert.doesNotMatch(source, /Animated\.loop\(\s*Animated\.sequence\(/, `${rel} nu trebuie să folosească sequence loops`);
  }
});

test('every curated practice question has valid MathJax SVG, valid formula link, distinct choices, and accurate grading', () => {
  assert.ok(PRACTICE_BANK.length >= 25, 'banca de practică trebuie să aibă cel puțin 25 de exerciții');
  const seenIds = new Set<string>();

  for (const question of PRACTICE_BANK) {
    assert.equal(seenIds.has(question.id), false, `ID duplicat în PRACTICE_BANK: ${question.id}`);
    seenIds.add(question.id);
    assert.ok(getFormulaById(question.formulaId), `${question.id} referențiază formula inexistentă ${question.formulaId}`);
    assert.ok(question.hint.trim().length >= 8, `${question.id} trebuie să aibă un indiciu clar`);
    assert.ok(question.tracks.length > 0, `${question.id} trebuie asociat cu cel puțin un nivel`);

    for (const block of [...question.prompt, ...question.explanation]) {
      if (block.type === 'math') {
        assertValidRenderedMath(block.latex, `practice:${question.id}`);
      }
    }

    if (question.kind === 'choice') {
      assert.ok(question.choices && question.choices.length === 4, `${question.id} necesită 4 variante`);
      assert.ok(question.correctIndex !== undefined && question.correctIndex >= 0 && question.correctIndex <= 3);
      const uniqueLabels = new Set(question.choices.map((c) => c.label.trim().toLowerCase()));
      assert.equal(uniqueLabels.size, 4, `${question.id} are variante duplicate`);

      // Shuffling must preserve the exact correct answer text.
      const originalAnswer = question.choices[question.correctIndex].label;
      const shuffled = shuffleQuestionChoices(question, 42_123);
      assert.equal(shuffled.choices![shuffled.correctIndex!].label, originalAnswer);
      assert.equal(evaluatePracticeAnswer(shuffled, { choiceIndex: shuffled.correctIndex }), true);
      assert.equal(evaluatePracticeAnswer(shuffled, { choiceIndex: (shuffled.correctIndex! + 1) % 4 }), false);
    } else {
      assert.ok(question.acceptedAnswers && question.acceptedAnswers.length > 0, `${question.id} necesită acceptedAnswers`);
      assert.equal(evaluatePracticeAnswer(question, { text: question.acceptedAnswers[0] }), true);
      assert.equal(evaluatePracticeAnswer(question, { text: '9999999' }), false);
    }

    const promptHtml = buildMathDocumentMarkup(buildPracticePromptDocument(question));
    const explainHtml = buildMathDocumentMarkup(buildPracticeExplanationDocument(question));
    assert.equal(promptHtml.includes('formulă indisponibilă'), false);
    assert.equal(explainHtml.includes('formulă indisponibilă'), false);
  }

  // Short-answer normalization handles Romanian decimals, units, minus signs, and fractions.
  assert.equal(normalizeShortAnswer(' 6 cm '), '6');
  assert.equal(normalizeShortAnswer('4,8'), '4.8');
  assert.equal(normalizeShortAnswer('−3'), '-3');
  assert.equal(normalizeShortAnswer('sqrt(7)'), '√7');

  const decimalCheck = evaluatePracticeAnswer(
    {
      ...PRACTICE_BANK[1],
      acceptedAnswers: ['1/2'],
    },
    { text: '0,5' },
  );
  assert.equal(decimalCheck, true);

  // Streak arithmetic and question selection prioritize mistakes & fresh items.
  assert.deepEqual(computeNextStreak(0, null, '2026-11-24'), { streakDays: 1, lastPracticeDateKey: '2026-11-24' });
  assert.deepEqual(computeNextStreak(3, '2026-11-24', '2026-11-24'), { streakDays: 3, lastPracticeDateKey: '2026-11-24' });
  assert.deepEqual(computeNextStreak(3, '2026-11-23', '2026-11-24'), { streakDays: 4, lastPracticeDateKey: '2026-11-24' });
  assert.deepEqual(computeNextStreak(3, '2026-11-20', '2026-11-24'), { streakDays: 1, lastPracticeDateKey: '2026-11-24' });

  const picked = selectPracticeQuestions(PRACTICE_BANK, {
    mode: 'quick',
    track: 'en',
    wrongIds: ['prac-geo-pitagora-2'],
    limit: 5,
    seed: 99,
  });
  assert.equal(picked.length, 5);
  assert.equal(picked[0].id, 'prac-geo-pitagora-2', 'întrebările greșite au prioritate în testul fulger');

  // Targeted single-mistake selection opens strictly that exact exercise.
  const sevenWrongIds = PRACTICE_BANK.slice(0, 7).map((q) => q.id);
  const targetedMistake = selectPracticeQuestions(PRACTICE_BANK, {
    mode: 'mistakes',
    track: 'en',
    questionId: sevenWrongIds[3],
    wrongIds: sevenWrongIds,
    seed: 42,
  });
  assert.equal(targetedMistake.length, 1, 'selectarea unei greșeli specifice trebuie să deschidă strict acel exercițiu');
  assert.equal(targetedMistake[0].id, sevenWrongIds[3]);

  // Batch mistakes review includes all saved mistakes (not silently capped at 5).
  const batchMistakes = selectPracticeQuestions(PRACTICE_BANK, {
    mode: 'mistakes',
    track: 'en',
    wrongIds: sevenWrongIds,
    seed: 42,
  });
  assert.equal(batchMistakes.length, 7, 'reluarea tuturor greșelilor nu trebuie tăiată tacit la 5');

  const enStats = computeCategoryStats(PRACTICE_BANK, 'en', ['prac-alg-prescurtat-1'], ['prac-geo-pitagora-2']);
  assert.ok(enStats.length >= 3);
  assert.equal(enStats.find((s) => s.categoryId === 'algebra')?.mastered, 1);
  assert.equal(enStats.find((s) => s.categoryId === 'geometry')?.wrong, 1);
});

test('all 4 timed exam simulations sum strictly to 100 points, have exact rubrics, compiled MathJax SVG, and accurate grading', () => {
  assert.equal(EXAM_SIMULATIONS.length, 4, 'trebuie să existe toate cele 4 variante oficiale (EN VIII + BAC M1/M2/M3)');
  for (const examId of ['en', 'bac_m1', 'bac_m2', 'bac_m3'] as const) {
    assert.ok(getExamSimulationsForExam(examId).length >= 1, `lipsește simularea pentru ${examId}`);
  }

  const seenVariantIds = new Set<string>();

  for (const variant of EXAM_SIMULATIONS) {
    assert.equal(seenVariantIds.has(variant.id), false, `variant ID duplicat: ${variant.id}`);
    seenVariantIds.add(variant.id);
    assert.equal(variant.officePoints, 10);
    assert.equal(variant.totalPoints, 100);
    assert.equal(variant.durationMinutes, variant.examId === 'en' ? 120 : 180);

    const seenItemIds = new Set<string>();
    const subjectTotals = { s1: 0, s2: 0, s3: 0 };

    for (const item of variant.items) {
      assert.equal(seenItemIds.has(item.id), false, `item ID duplicat în ${variant.id}: ${item.id}`);
      seenItemIds.add(item.id);
      subjectTotals[item.subject] += item.maxPoints;

      for (const block of [...item.prompt, ...item.solution]) {
        if (block.type === 'math') {
          assertValidRenderedMath(block.latex, `exam:${variant.id}:${item.id}`);
        }
      }

      if (item.kind === 'choice') {
        assert.ok(item.choices && item.choices.length === 4, `${item.id} necesită 4 variante`);
        assert.ok(item.correctIndex !== undefined && item.correctIndex >= 0 && item.correctIndex <= 3);
        const uniqueChoices = new Set(item.choices.map((c) => c.trim().toLowerCase()));
        assert.equal(uniqueChoices.size, 4, `${item.id} are variante duplicate`);
        assert.deepEqual(evaluateAutoExamItem(item, { choiceIndex: item.correctIndex }), {
          correct: true,
          awardedPoints: item.maxPoints,
        });
        assert.deepEqual(evaluateAutoExamItem(item, { choiceIndex: (item.correctIndex + 1) % 4 }), {
          correct: false,
          awardedPoints: 0,
        });
      } else if (item.kind === 'short_answer') {
        assert.ok(item.acceptedAnswers && item.acceptedAnswers.length > 0, `${item.id} necesită acceptedAnswers`);
        assert.deepEqual(evaluateAutoExamItem(item, { text: item.acceptedAnswers[0] }), {
          correct: true,
          awardedPoints: item.maxPoints,
        });
        assert.deepEqual(evaluateAutoExamItem(item, { text: '9999999' }), {
          correct: false,
          awardedPoints: 0,
        });
      } else {
        assert.ok(item.rubric && item.rubric.length >= 2, `${item.id} necesită criterii pe barem`);
        const rubricSum = item.rubric.reduce((sum, step) => sum + step.points, 0);
        assert.equal(rubricSum, item.maxPoints, `baremul pentru ${item.id} trebuie să însumeze ${item.maxPoints}p`);
      }

      const itemHtml = buildMathDocumentMarkup(buildExamItemDocument(item));
      const rubricHtml = buildMathDocumentMarkup(buildExamRubricDocument(item));
      assert.equal(itemHtml.includes('formulă indisponibilă'), false, `formulă lipsă în enunțul ${item.id}`);
      assert.equal(rubricHtml.includes('formulă indisponibilă'), false, `formulă lipsă în baremul ${item.id}`);
      assert.equal(itemHtml.includes('nu a putut fi afișată'), false, `formulă display lipsă în enunțul ${item.id}`);
      assert.equal(rubricHtml.includes('nu a putut fi afișată'), false, `formulă display lipsă în baremul ${item.id}`);
    }

    assert.equal(subjectTotals.s1, 30, `${variant.id} S.I trebuie să aibă exact 30p`);
    assert.equal(subjectTotals.s2, 30, `${variant.id} S.II trebuie să aibă exact 30p`);
    assert.equal(subjectTotals.s3, 30, `${variant.id} S.III trebuie să aibă exact 30p`);
    assert.equal(variant.officePoints + subjectTotals.s1 + subjectTotals.s2 + subjectTotals.s3, 100);

    // Scoring math checks: empty (10p oficiu -> 1,00), full perfect (100p -> 10,00), clamped, and single-subject 30p.
    const emptyScore = computeExamScore(variant, 'full', {});
    assert.equal(emptyScore.awardedPoints, 10);
    assert.equal(emptyScore.grade, 1);
    assert.equal(formatRomanianGrade(emptyScore.grade!), '1,00');

    const perfectMap = Object.fromEntries(variant.items.map((item) => [item.id, item.maxPoints + 50]));
    const perfectScore = computeExamScore(variant, 'full', perfectMap);
    assert.equal(perfectScore.awardedPoints, 100);
    assert.equal(perfectScore.grade, 10);
    assert.equal(formatRomanianGrade(perfectScore.grade!), '10,00');

    const s2Items = getScopeItems(variant, 's2');
    assert.ok(s2Items.length > 0);
    const s2Score = computeExamScore(variant, 's2', perfectMap);
    assert.equal(s2Score.officePoints, 0);
    assert.equal(s2Score.awardedPoints, 30);
    assert.equal(s2Score.maxPoints, 30);
    assert.equal(s2Score.grade, null);
    assert.equal(s2Score.percent, 100);
  }

  assert.equal(formatRomanianGrade(8.7), '8,70');
});

test('native Skia math engine compiles every inline $...$ expression, expands server SVGs cleanly, and Study/Practice/Exam screens use zero WebView', async () => {
  // 1. Verify every inline $...$ and structured block across all 4 catalogs is compiled.
  for (const formula of FORMULAS_CATALOG) {
    assertValidRenderedMath(formula.formulaLatex, `formula:${formula.id}`, 'display');
    for (const expr of formula.formulas ?? []) {
      assertValidRenderedMath(expr.latex, `formula:${formula.id}:row`, 'display');
      assertAllInlineMathInText(expr.label, `formula:${formula.id}:label`);
    }
    assertAllInlineMathInText(formula.whenToUse, `formula:${formula.id}:whenToUse`);
    assertAllInlineMathInText(formula.pitfall, `formula:${formula.id}:pitfall`);
    assertAllMathInBlocks(formula.example, `formula:${formula.id}:example`);
  }

  for (const guide of EXAM_GUIDES) {
    assertAllInlineMathInText(guide.overviewNote, `guide:${guide.id}:overview`);
    for (const subject of guide.subjects) {
      for (const tip of subject.gradingTips) assertAllInlineMathInText(tip, `guide:${guide.id}:${subject.id}:tip`);
      assertAllMathInBlocks(subject.modelProblem, `guide:${guide.id}:${subject.id}:problem`);
      assertAllMathInBlocks(subject.modelSolution, `guide:${guide.id}:${subject.id}:solution`);
      for (const crit of subject.rubricBreakdown) assertAllInlineMathInText(crit.step, `guide:${guide.id}:${subject.id}:rubric`);
    }
  }

  for (const q of PRACTICE_BANK) {
    assertAllMathInBlocks(q.prompt, `practice:${q.id}:prompt`);
    assertAllMathInBlocks(q.explanation, `practice:${q.id}:explanation`);
    assertAllInlineMathInText(q.answerDisplay, `practice:${q.id}:answer`);
    assertAllInlineMathInText(q.hint, `practice:${q.id}:hint`);
    for (const c of q.choices ?? []) assertAllInlineMathInText(c.label, `practice:${q.id}:choice`);
  }

  for (const variant of EXAM_SIMULATIONS) {
    for (const item of variant.items) {
      assertAllMathInBlocks(item.prompt, `sim:${variant.id}:${item.id}:prompt`);
      assertAllMathInBlocks(item.solution, `sim:${variant.id}:${item.id}:solution`);
      assertAllInlineMathInText(item.answerDisplay, `sim:${variant.id}:${item.id}:answer`);
      for (const c of item.choices ?? []) assertAllInlineMathInText(c, `sim:${variant.id}:${item.id}:choice`);
      for (const crit of item.rubric ?? []) assertAllInlineMathInText(crit.step, `sim:${variant.id}:${item.id}:rubric`);
    }
  }

  // 2. Verify server-style <defs>/<use> SVG expansion, currentColor replacement,
  // and lossless single-path flattening across compiled & server MathJax SVGs.
  const serverSvg = '<svg viewBox="0 -700 1000 900"><defs><path id="p1" d="M0 0L100 100"/></defs><g fill="currentColor" stroke="currentColor"><use href="#p1" transform="translate(10,0)"/></g></svg>';
  const expanded = prepareNativeMathSvg(serverSvg, '#1C1233');
  assert.equal(expanded.includes('<defs>'), false);
  assert.equal(expanded.includes('<use'), false);
  assert.equal(expanded.includes('currentColor'), false);
  assert.match(expanded, /<path d="M0 0L100 100" transform="translate\(10,0\)"\/>/);
  assert.match(expanded, /fill="#1C1233"/);

  const flatServer = flattenNativeMathSvg(serverSvg);
  assert.ok(flatServer, 'server MathJax SVG trebuie aplatizat într-un singur <Path>');
  assert.equal(flatServer.viewBox, '0 -700 1000 900');
  assert.equal(flatServer.d, 'M10 0L110 100');

  for (const formula of FORMULAS_CATALOG) {
    const rendered = getRenderedStudyMath(formula.formulaLatex, 'display');
    assert.ok(rendered);
    const flat = flattenNativeMathSvg(rendered.svg);
    assert.ok(flat && flat.d.startsWith('M'), `formula ${formula.id} trebuie aplatizată curat într-un singur Path`);
  }

  // 3. Verify pixel dimension scaling and overflow bounds.
  const wideFormula = { svg: expanded, viewBox: '0 -700 4000 900', widthEx: 48, heightEx: 2.2, depthEx: 0.4 };
  const cardDims = computeNativeMathDimensions(wideFormula, { size: 'card', maxWidth: 260 });
  assert.equal(cardDims.width, 260);
  assert.equal(cardDims.needsHorizontalScroll, false);
  const displayDims = computeNativeMathDimensions(wideFormula, { size: 'display', maxWidth: 260 });
  assert.equal(displayDims.needsHorizontalScroll, true);

  // 4. Verify punctuation gluing in inline math tokenizer.
  const atoms = tokenizeInlineMathText('Rezolvă ($x > 0$): ecuația $x^2 = 4$.');
  assert.deepEqual(atoms, [
    { kind: 'word', text: 'Rezolvă' },
    { kind: 'math', latex: 'x > 0', prefix: '(', suffix: '):' },
    { kind: 'word', text: 'ecuația' },
    { kind: 'math', latex: 'x^2 = 4', prefix: '', suffix: '.' },
  ]);

  // 5. Study/Practice/Exam screens must render natively without WebView MathDocumentView!
  const nativeStudyScreens = [
    'src/features/study/components/FormulaCard.tsx',
    'src/features/study/components/StudyInlineText.tsx',
    'src/features/study/components/NativeMathVisual.tsx',
    'src/features/study/components/StudyRichContent.tsx',
    'src/features/study/screens/FormulaDetailScreen.tsx',
    'src/features/exams/screens/ExamGuideScreen.tsx',
    'src/features/exams/screens/ExamSimulationScreen.tsx',
    'src/features/exams/screens/ExamResultScreen.tsx',
    'src/features/practice/screens/PracticeSessionScreen.tsx',
    'src/features/practice/screens/PracticeSummaryScreen.tsx',
    'src/features/math/components/NativeMathFormula.tsx',
  ];

  for (const rel of nativeStudyScreens) {
    const source = await readFile(path.resolve(rel), 'utf8');
    assert.doesNotMatch(source, /MathDocumentView/, `${rel} nu trebuie să folosească WebView MathDocumentView`);
    assert.doesNotMatch(source, /react-native-reanimated/, `${rel} nu trebuie să folosească Reanimated`);
    assert.doesNotMatch(source, /<SafeAreaView/, `${rel} nu trebuie să folosească SafeAreaView`);
  }
});

test('AI study actions lock all concurrent user interaction and soft-keyboard screens observe real Android keyboard height', async () => {
  // 1. Practice & Exam AI actions must mount AiBlockingOverlay, block Back/beforeRemove,
  // shrink outer flex viewport via keyboardInset, and pin a keyboardDock above Android keyboard.
  for (const rel of [
    'src/features/practice/screens/PracticeSessionScreen.tsx',
    'src/features/exams/screens/ExamSimulationScreen.tsx',
  ]) {
    const source = await readFile(path.resolve(rel), 'utf8');
    assert.match(source, /AiBlockingOverlay/, `${rel} trebuie să blocheze ecranul cu AiBlockingOverlay în timpul cererilor AI`);
    assert.match(source, /hardwareBackPress/, `${rel} trebuie să blocheze butonul Back în timpul cererilor AI`);
    assert.match(source, /beforeRemove/, `${rel} trebuie să protejeze navigarea în timpul cererilor AI`);
    assert.match(source, /useKeyboardHeight/, `${rel} trebuie să folosească useKeyboardHeight pentru tastatura Android`);
    assert.match(source, /keyboardInset/, `${rel} trebuie să ajusteze containerul extern cu keyboardInset`);
    assert.match(source, /keyboardDock/, `${rel} trebuie să ancoreze bara de acțiuni direct deasupra tastaturii`);
    assert.match(source, /keyboardDismissMode="on-drag"/, `${rel} trebuie să ascundă tastatura la scroll pe Android`);
    assert.doesNotMatch(source, /KeyboardAvoidingView/, `${rel} nu trebuie să depindă de KeyboardAvoidingView no-op pe Android`);
  }

  // 2. AiPracticeSheet must prevent dismissal and hide interactive controls while generating.
  const aiSheetSource = await readFile(path.resolve('src/features/practice/components/AiPracticeSheet.tsx'), 'utf8');
  assert.match(aiSheetSource, /dismissible=\{!busy\}/);
  assert.match(aiSheetSource, /busyRef\.current/);

  // 3. MathInputScreen must block Back/navigation during preflight busy state.
  const mathInputSource = await readFile(path.resolve('src/features/math/screens/MathInputScreen.tsx'), 'utf8');
  assert.match(mathInputSource, /hardwareBackPress/);
  assert.match(mathInputSource, /beforeRemove/);

  // 4. Studio, Caiet, Formulas, and ScreenHeader must adapt cleanly and auto-dismiss the Android keyboard.
  for (const rel of [
    'src/app/screens/StudioScreen.tsx',
    'src/features/study/screens/FormulasScreen.tsx',
    'src/features/lessons/screens/NotebookScreen.tsx',
  ]) {
    const source = await readFile(path.resolve(rel), 'utf8');
    assert.match(source, /useKeyboardHeight/, `${rel} trebuie să folosească useKeyboardHeight`);
    assert.match(source, /Keyboard\.dismiss\(\)/, `${rel} trebuie să ascundă tastatura la acțiuni din afara câmpului de text`);
    assert.doesNotMatch(source, /KeyboardAvoidingView/, `${rel} nu trebuie să depindă de KeyboardAvoidingView no-op pe Android`);
  }
  const screenHeaderSource = await readFile(path.resolve('src/shared/ui/ScreenHeader.tsx'), 'utf8');
  assert.match(screenHeaderSource, /Keyboard\.dismiss/);
  const nativeMathFormulaSource = await readFile(path.resolve('src/features/math/components/NativeMathFormula.tsx'), 'utf8');
  assert.match(nativeMathFormulaSource, /maxWidth:\s*'100%'/);
  assert.match(nativeMathFormulaSource, /aspectRatio/);
  assert.match(nativeMathFormulaSource, /SvgAst/);
  assert.match(nativeMathFormulaSource, /parsedAstCache/);

  // 4b. Step-by-step screens must mount keyed StepTransitionStage (never mutate opacity/scroll on the old step in onPress).
  for (const [rel, expectedKey] of [
    ['src/features/practice/screens/PracticeSessionScreen.tsx', /<StepTransitionStage[\s\S]*?key=\{currentQuestion\.id\}/],
    ['src/features/exams/screens/ExamSimulationScreen.tsx', /<StepTransitionStage[\s\S]*?key=\{currentItem\.id\}/],
    ['src/features/study/screens/FormulaDetailScreen.tsx', /<StepTransitionStage[\s\S]*?key=\{formula\.id\}/],
    ['src/features/exams/screens/ExamGuideScreen.tsx', /<StepTransitionStage[\s\S]*?key=\{`\$\{examId\}-\$\{subjectId\}`\}/],
  ] as const) {
    const source = await readFile(path.resolve(rel), 'utf8');
    assert.match(source, expectedKey, `${rel} trebuie să folosească StepTransitionStage cu key unic per pas`);
    assert.doesNotMatch(source, /stageOpacity\.setValue|cardOpacity\.setValue/, `${rel} nu trebuie să animeze opacitatea pasului vechi în onPress`);
  }
  const mathDocViewSource = await readFile(path.resolve('src/features/math/components/MathDocumentView.tsx'), 'utf8');
  assert.doesNotMatch(mathDocViewSource, /swapTimer/, 'MathDocumentView nu trebuie să întârzie swap-ul cu swapTimer peste antetul nou');

  // 5. Primary CTA pills in Study/Practice/Exam must not use fixed height clipping.
  for (const rel of [
    'src/features/study/screens/StudyHubScreen.tsx',
    'src/features/practice/screens/PracticeHubScreen.tsx',
    'src/features/exams/screens/ExamsHubScreen.tsx',
    'src/features/exams/screens/ExamGuideScreen.tsx',
    'src/features/practice/components/AiPracticeSheet.tsx',
  ]) {
    const source = await readFile(path.resolve(rel), 'utf8');
    assert.doesNotMatch(source, /(?:heroCta|heroSimCta|modelCta|generateBtn):\s*\{[^}]*\bheight:\s*\d+/, `${rel} nu trebuie să folosească height fix pe butoanele CTA principale`);
  }

  // 6. NativeMathFormula flattens every MathJax equation into a single <Path>
  // (2 Fabric views total) so Formulas & FormulaDetail paint final vector math
  // immediately on Frame 0 with zero text-to-SVG morphing, tests settle the
  // Android keyboard before revealing verdicts/steps, and inline math strips
  // container layout props from individual word atoms.
  assert.match(nativeMathFormulaSource, /flattenNativeMathSvg/);
  const formulasSource = await readFile(path.resolve('src/features/study/screens/FormulasScreen.tsx'), 'utf8');
  assert.doesNotMatch(formulasSource, /renderMath=\{transitionSettled\}/);
  const formulaDetailSource = await readFile(path.resolve('src/features/study/screens/FormulaDetailScreen.tsx'), 'utf8');
  assert.match(formulaDetailSource, /useTransitionSettled\(navigation, reducedMotion\)/);
  assert.doesNotMatch(formulaDetailSource, /formulaPreviewFallback/);

  const practiceSource = await readFile(path.resolve('src/features/practice/screens/PracticeSessionScreen.tsx'), 'utf8');
  assert.match(practiceSource, /useAfterKeyboardDismiss\(keyboardVisible\)/);
  assert.match(practiceSource, /runAfterKeyboardDismiss\(/);
  const examSimSource = await readFile(path.resolve('src/features/exams/screens/ExamSimulationScreen.tsx'), 'utf8');
  assert.match(examSimSource, /useAfterKeyboardDismiss\(keyboardVisible\)/);
  assert.match(examSimSource, /runAfterKeyboardDismiss\(/);

  const inlineTextSource = await readFile(path.resolve('src/features/study/components/StudyInlineText.tsx'), 'utf8');
  assert.match(inlineTextSource, /extractedContainerStyle/);
  assert.match(inlineTextSource, /inlineAtomStyle/);
  assert.match(inlineTextSource, /includeFontPadding:\s*false/);
  const richContentSource = await readFile(path.resolve('src/features/study/components/StudyRichContent.tsx'), 'utf8');
  assert.match(richContentSource, /<StudyInlineText[\s\S]*?text=\{block\.title\}/);

  // 7. Caiet -> De repetat opens a targeted single exercise on card tap, exposes
  // inline explanation + remove actions, guards batch CTA for >= 2 items, and
  // PracticeSummary never relaunches an empty mistakes session from "Încă un test rapid".
  const notebookSource = await readFile(path.resolve('src/features/lessons/screens/NotebookScreen.tsx'), 'utf8');
  assert.match(notebookSource, /navigation\.navigate\('PracticeSession',\s*\{\s*mode:\s*'mistakes',\s*questionId:\s*item\.id\s*\}\)/);
  assert.match(notebookSource, /removeWrongQuestion\(questionId\)/);
  assert.match(notebookSource, /wrongQuestions\.length >= 2/);
  assert.doesNotMatch(notebookSource, /Reia toate cele \$\{wrongQuestions\.length\} greșeli/);

  assert.match(practiceSource, /const isTargetedMistake = mode === 'mistakes' && Boolean\(questionId\)/);
  assert.match(practiceSource, /handleRetryCurrentQuestion/);
  assert.match(practiceSource, /handleNextRemainingMistake/);

  const practiceSummarySource = await readFile(path.resolve('src/features/practice/screens/PracticeSummaryScreen.tsx'), 'utf8');
  assert.match(practiceSummarySource, /mode:\s*mode === 'ai' \|\| mode === 'mistakes' \? 'quick' : mode/);
  assert.match(practiceSummarySource, /mode:\s*'mistakes',\s*questionId:\s*targetId/);
});
