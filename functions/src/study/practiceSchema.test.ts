import assert from 'node:assert/strict';
import test from 'node:test';
import type OpenAI from 'openai';
import { buildPracticePrompt } from './practicePrompt.js';
import {
  aiPracticeExerciseSchema,
  extractJsonPayload,
  normalizeRawPracticeExercise,
  parseGeneratePracticeRequest,
  sanitizePracticeLatex,
} from './practiceSchema.js';
import {
  generateRenderedPracticeExercise,
  renderAiPracticeExercise,
} from './practiceService.js';

const validToken = 'a'.repeat(64);
const validRequestId = 'analysis-1234abcd-5678efgh';

test('parseGeneratePracticeRequest validates track, category, difficulty, and optional context', () => {
  const parsed = parseGeneratePracticeRequest({
    track: 'bac_m1',
    category: 'analysis',
    difficulty: 'exam',
    formulaTitle: 'Reguli de derivare',
    seedProblemText: 'Derivați f(x) = x e^x',
    requestId: validRequestId,
    installationToken: validToken,
  });
  assert.equal(parsed.track, 'bac_m1');
  assert.equal(parsed.category, 'analysis');
  assert.equal(parsed.difficulty, 'exam');
  assert.equal(parsed.formulaTitle, 'Reguli de derivare');

  assert.throws(() => parseGeneratePracticeRequest({
    track: 'invalid_track',
    category: 'algebra',
    difficulty: 'easy',
    requestId: validRequestId,
    installationToken: validToken,
  }));

  assert.throws(() => parseGeneratePracticeRequest({
    track: 'en',
    category: 'algebra',
    difficulty: 'easy',
    requestId: 'bad-id',
    installationToken: validToken,
  }));
});

test('aiPracticeExerciseSchema rejects duplicate choices and renders valid MathJax SVG blocks', async () => {
  const duplicateChoices = aiPracticeExerciseSchema.safeParse({
    title: 'Ecuație de gradul I',
    prompt: [{ type: 'text', text: 'Rezolvă 2x = 6', latex: '', spoken: '' }],
    choices: ['3', '3', '2', '4'],
    correctIndex: 0,
    hint: 'Împarte la 2.',
    explanation: [{ type: 'text', text: 'x = 6 / 2 = 3', latex: '', spoken: '' }],
  });
  assert.equal(duplicateChoices.success, false);

  const valid = aiPracticeExerciseSchema.parse({
    title: 'Calcul cu radicali',
    prompt: [
      { type: 'text', text: 'Calculează valoarea expresiei:', latex: '', spoken: '' },
      { type: 'math', text: '', latex: '\\sqrt{9} + \\sqrt{16}', spoken: 'radical din 9 plus radical din 16' },
    ],
    choices: ['7', '5', '12', '25'],
    correctIndex: 0,
    hint: 'Extrage pe rând fiecare radical, apoi adună rezultatele.',
    explanation: [
      { type: 'text', text: 'Calculăm separat radicalii:', latex: '', spoken: '' },
      { type: 'math', text: '', latex: '\\sqrt{9} + \\sqrt{16} = 3 + 4 = 7', spoken: '3 plus 4 egal 7' },
    ],
  });

  const rendered = await renderAiPracticeExercise(valid, {
    id: 'ai-test-1',
    category: 'algebra',
    difficulty: 'easy',
  });
  assert.equal(rendered.id, 'ai-test-1');
  assert.equal(rendered.prompt[1].type, 'math');
  if (rendered.prompt[1].type === 'math') {
    assert.match(rendered.prompt[1].rendered.svg, /^<svg\b[\s\S]*<\/svg>$/);
    assert.ok(rendered.prompt[1].rendered.widthEx > 0);
  }

  const prompt = buildPracticePrompt({
    track: 'en',
    category: 'geometry',
    difficulty: 'medium',
    requestId: validRequestId,
    installationToken: validToken,
  });
  assert.match(prompt, /Evaluarea Națională/);
  assert.match(prompt, /4 variante distincte/);
});

test('normalizeRawPracticeExercise cleans realistic AI quirks, sanitizes Romanian LaTeX, and repairs invalid first attempts', async () => {
  const dirtyRaw = {
    title: '  "Calcul cu tangentă și pătrat"  ',
    prompt: [
      { type: 'text', text: 'Calculează valoarea expresiei:', latex: 'ignored', spoken: 'Calculează valoarea expresiei' },
      { type: 'math', text: 'tg(45°) + 2²', latex: '$\\tg 45^\\circ + 2² − 1$', spoken: '' },
    ],
    choices: ['A) 4', 'B) 5', 'C) 3', 'D) 2'],
    correctIndex: 'A',
    hint: 'Indiciu: Amintește-ți cât face tg 45°.',
    explanation: [
      { type: 'text', text: 'Avem tg 45° = 1', latex: 'x', spoken: 'y' },
      { type: 'text', text: 'și 2² = 4.', latex: '', spoken: '' },
      { type: 'math', text: '', latex: '\\[\\tg 45^\\circ + 4 - 1 = 4\\]', spoken: '1 plus 4 minus 1 egal 4' },
    ],
  };

  assert.equal(sanitizePracticeLatex('$\\tg x + \\ctg x$'), '\\operatorname{tg} x + \\operatorname{ctg} x');
  assert.equal(extractJsonPayload('```json\n{"a":1}\n```'), '{"a":1}');

  const normalized = normalizeRawPracticeExercise(dirtyRaw);
  const parsed = aiPracticeExerciseSchema.parse(normalized);
  assert.equal(parsed.title, 'Calcul cu tangentă și pătrat');
  assert.deepEqual(parsed.choices, ['4', '5', '3', '2']);
  assert.equal(parsed.correctIndex, 0);
  assert.equal(parsed.prompt[0].latex, '');
  assert.equal(parsed.prompt[0].spoken, '');
  assert.equal(parsed.prompt[1].type, 'math');
  assert.equal(parsed.explanation.length, 2); // adjacent text blocks merged cleanly

  const rendered = await renderAiPracticeExercise(parsed, {
    id: 'ai-dirty-1',
    category: 'trigonometry',
    difficulty: 'easy',
  });
  assert.equal(rendered.prompt[1].type, 'math');
  if (rendered.prompt[1].type === 'math') {
    assert.match(rendered.prompt[1].rendered.svg, /^<svg\b[\s\S]*<\/svg>$/);
  }

  // Test graceful fallback if one math block still has invalid LaTeX syntax
  const fallbackExercise = await renderAiPracticeExercise({
    ...parsed,
    prompt: [
      { type: 'text', text: 'Test:', latex: '', spoken: '' },
      { type: 'math', text: '', latex: '\\frac{1', spoken: 'expresie de rezervă' },
    ],
  }, { id: 'ai-fb-1', category: 'algebra', difficulty: 'easy' });
  assert.equal(fallbackExercise.prompt[1].type, 'text');

  // Test automatic 1-time repair retry when attempt 1 returns duplicate choices
  let calls = 0;
  const mockClient = {
    responses: {
      create: async (request: any, options: any) => {
        calls += 1;
        assert.equal(request.store, false);
        assert.equal(request.text.format.type, 'json_schema');
        assert.equal(request.text.format.strict, true);
        assert.equal(options.maxRetries, 0);
        if (calls === 1) {
          return {
            output_text: JSON.stringify({
              title: 'Ecuație simplă',
              prompt: [{ type: 'text', text: 'Rezolvă 2x = 8', latex: '', spoken: '' }],
              choices: ['4', '4', '2', '6'],
              correctIndex: 0,
              hint: 'Împarte la 2.',
              explanation: [{ type: 'text', text: 'x = 4', latex: '', spoken: '' }],
            }),
          };
        }
        return {
          output_text: JSON.stringify({
            title: 'Ecuație simplă',
            prompt: [{ type: 'text', text: 'Rezolvă 2x = 8', latex: '', spoken: '' }],
            choices: ['4', '3', '2', '6'],
            correctIndex: 0,
            hint: 'Împarte la 2.',
            explanation: [{ type: 'text', text: 'x = 8 / 2 = 4', latex: '', spoken: '' }],
          }),
        };
      },
    },
  } as unknown as OpenAI;

  const repaired = await generateRenderedPracticeExercise({
    apiKey: 'test-key',
    request: {
      track: 'en',
      category: 'algebra',
      difficulty: 'easy',
      requestId: validRequestId,
      installationToken: validToken,
    },
    beforeGenerate: async () => undefined,
    client: mockClient,
  });

  assert.equal(calls, 2);
  assert.deepEqual(repaired.choices, ['4', '3', '2', '6']);
});

test('sanitizePracticeLatex and renderAiPracticeExercise compile inline math, matrix choices, and hints natively', async () => {
  assert.equal(
    sanitizePracticeLatex('$A \\in \\mathcal{M}_2(\\mathbb{R}) \\setminus \\{O_2\\}, \\triangle ABC, \\frown{AB}$'),
    'A \\in \\mathrm{M}_2(\\mathbb{R}) \\backslash \\{O_2\\}, \\Delta ABC, \\widehat{AB}',
  );

  const matrixExercise = aiPracticeExerciseSchema.parse({
    title: 'Determinantul unei matrice',
    prompt: [
      {
        type: 'text',
        text: 'Fie $A \\in \\mathcal{M}_2(\\mathbb{R})$ cu $\\det(A) = 3$. Alege matricea cu determinant $6$:',
        latex: '',
        spoken: '',
      },
    ],
    choices: [
      '$\\begin{pmatrix} 2 & 0 \\\\ 0 & 3 \\end{pmatrix}$',
      '$\\begin{pmatrix} 1 & 0 \\\\ 0 & 2 \\end{pmatrix}$',
      '$\\frac{3}{2}$',
      '5',
    ],
    correctIndex: 0,
    hint: 'Folosește formula $\\det\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} = ad - bc$.',
    explanation: [
      {
        type: 'text',
        text: 'Calculăm $\\det(A) = 2 \\cdot 3 - 0 = 6$.',
        latex: '',
        spoken: '',
      },
    ],
  });

  const rendered = await renderAiPracticeExercise(matrixExercise, {
    id: 'ai-mat-1',
    category: 'matrices',
    difficulty: 'medium',
  });

  // Inline $...$ in text blocks is split and compiled into native MathJax SVG math blocks.
  const promptMathBlocks = rendered.prompt.filter((b) => b.type === 'math');
  assert.ok(promptMathBlocks.length >= 2, 'inline math din textul enunțului trebuie compilat în blocuri math');
  for (const mb of promptMathBlocks) {
    if (mb.type === 'math') {
      assert.match(mb.rendered.svg, /^<svg\b[\s\S]*<\/svg>$/);
    }
  }

  // Matrix & fraction choices compile to RenderedMath SVGs while plain numeric choices remain null.
  assert.ok(rendered.renderedChoices && rendered.renderedChoices.length === 4);
  assert.match(rendered.renderedChoices[0]!.svg, /^<svg\b[\s\S]*<\/svg>$/);
  assert.match(rendered.renderedChoices[1]!.svg, /^<svg\b[\s\S]*<\/svg>$/);
  assert.match(rendered.renderedChoices[2]!.svg, /^<svg\b[\s\S]*<\/svg>$/);
  assert.equal(rendered.renderedChoices[3], null);

  // Hints with inline math compile into renderedHint RichContent blocks.
  assert.ok(rendered.renderedHint && rendered.renderedHint.some((b) => b.type === 'math'));
});
