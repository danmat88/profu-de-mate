import { HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';

export const examIdSchema = z.enum(['en', 'bac_m1', 'bac_m2', 'bac_m3']);
export type ExamId = z.infer<typeof examIdSchema>;

const REQUEST_ID_PATTERN = /^analysis-[a-z0-9]{6,16}-[a-z0-9]{6,16}$/;
const INSTALLATION_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const MAX_BASE64_LENGTH = 7_000_000;
const MAX_IMAGE_BYTES = 5_000_000;

export type RubricCriterionInput = {
  step: string;
  points: number;
};

export type GradeExamSolutionRequest = {
  examId: ExamId;
  itemTitle: string;
  maxPoints: number;
  problemText: string;
  rubricCriteria: RubricCriterionInput[];
  imageBase64: string;
  mimeType: 'image/jpeg' | 'image/png';
  requestId: string;
  installationToken: string;
};

const criterionResultSchema = z.object({
  step: z.string().trim().min(1).max(260),
  awardedPoints: z.number().int().min(0).max(30),
  maxPoints: z.number().int().min(1).max(30),
  comment: z.string().trim().min(1).max(400),
});

export const examGradingResultSchema = z.object({
  status: z.enum(['graded', 'unclear', 'not_math']),
  awardedPoints: z.number().int().min(0).max(30),
  verdict: z.enum(['complete', 'partial', 'needs_work']),
  summary: z.string().trim().min(4).max(600),
  criteriaScores: z.array(criterionResultSchema).max(12),
  improvementTip: z.string().trim().min(4).max(400),
});

export type ExamGradingResult = z.infer<typeof examGradingResultSchema> & {
  maxPoints: number;
};

export const examGradingResultJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: {
      type: 'string',
      enum: ['graded', 'unclear', 'not_math'],
      description: '"graded" pentru o rezolvare lizibilă, "unclear" pentru poză neclară, "not_math" dacă nu corespunde enunțului.',
    },
    awardedPoints: {
      type: 'integer',
      description: 'Punctajul total acordat (întreg între 0 și 30), suma punctelor din criteriaScores.',
    },
    verdict: {
      type: 'string',
      enum: ['complete', 'partial', 'needs_work'],
      description: '"complete" pentru punctaj maxim, "partial" pentru parțial, "needs_work" altfel.',
    },
    summary: {
      type: 'string',
      description: 'Rezumat clar în română despre ce este corect și ce lipsește.',
    },
    criteriaScores: {
      type: 'array',
      description: 'Evaluare pe fiecare etapă din barem în ordine.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          step: { type: 'string', description: 'Etapa din barem.' },
          awardedPoints: { type: 'integer', description: 'Punctaj întreg acordat pe etapă (între 0 și maxPoints).' },
          maxPoints: { type: 'integer', description: 'Punctaj întreg maxim al etapei (între 1 și 30).' },
          comment: { type: 'string', description: 'Explicație scurtă în română pentru punctajul acordat.' },
        },
        required: ['step', 'awardedPoints', 'maxPoints', 'comment'],
      },
    },
    improvementTip: {
      type: 'string',
      description: 'Recomandare concretă de îmbunătățire în română.',
    },
  },
  required: ['status', 'awardedPoints', 'verdict', 'summary', 'criteriaScores', 'improvementTip'],
} as const;

function clampGradingString(value: unknown, maxLength: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function coerceBoundedInt(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value.trim().replace(',', '.'))
      : Number.NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

/**
 * Normalizes minor AI output variances (e.g. fractional points like 2.5,
 * slightly overlong comments, or missing fallback text) before Zod validation.
 */
export function normalizeRawExamGrading(
  raw: unknown,
  request: Pick<GradeExamSolutionRequest, 'maxPoints' | 'rubricCriteria'>,
): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const record = raw as Record<string, unknown>;
  const rawStatus = typeof record.status === 'string' ? record.status.trim().toLowerCase() : undefined;
  // Never default a missing or unknown status to 'graded' (which would charge
  // quota on malformed model outputs); let strict Zod validation reject it.
  const status = rawStatus === 'graded' || rawStatus === 'unclear' || rawStatus === 'not_math'
    ? rawStatus
    : record.status;
  const rawVerdict = typeof record.verdict === 'string' ? record.verdict.trim().toLowerCase() : 'partial';
  const verdict = rawVerdict === 'complete' || rawVerdict === 'partial' || rawVerdict === 'needs_work'
    ? rawVerdict
    : 'partial';

  const criteriaLimit = request.rubricCriteria.length > 0
    ? Math.min(12, request.rubricCriteria.length)
    : 12;
  const criteriaScores = Array.isArray(record.criteriaScores)
    ? record.criteriaScores.slice(0, criteriaLimit).map((item, idx) => {
      const entry = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const expected = request.rubricCriteria[idx];
      // Use the request's authoritative rubric maxPoints before clamping
      // awardedPoints so AI understating a step max never truncates the score.
      const maxPoints = expected?.points ?? coerceBoundedInt(entry.maxPoints, 1, 30, 5);
      const awardedPoints = coerceBoundedInt(entry.awardedPoints, 0, maxPoints, 0);
      return {
        step: clampGradingString(entry.step, 260, expected?.step ?? `Etapa ${idx + 1}`),
        awardedPoints,
        maxPoints,
        comment: clampGradingString(entry.comment, 400, 'Evaluat conform baremului oficial.'),
      };
    })
    : [];

  return {
    status,
    awardedPoints: coerceBoundedInt(record.awardedPoints, 0, Math.min(30, request.maxPoints), 0),
    verdict,
    summary: clampGradingString(
      record.summary,
      600,
      status === 'graded'
        ? 'Rezolvarea a fost verificată pe etape conform baremului.'
        : 'Fotografia nu a putut fi evaluată clar. Încearcă o poză mai luminoasă.',
    ),
    criteriaScores,
    improvementTip: clampGradingString(
      record.improvementTip,
      400,
      'Scrie explicit fiecare pas intermediar și concluzia finală.',
    ),
  };
}

export function parseGradeExamSolutionRequest(value: unknown): GradeExamSolutionRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'Cererea de corectare nu este validă.');
  }
  const data = value as Record<string, unknown>;
  const examId = examIdSchema.safeParse(data.examId);
  if (!examId.success) {
    throw new HttpsError('invalid-argument', 'Tipul examenului nu este valid.');
  }
  if (typeof data.requestId !== 'string' || !REQUEST_ID_PATTERN.test(data.requestId)) {
    throw new HttpsError('invalid-argument', 'Identificatorul cererii nu este valid.');
  }
  if (typeof data.installationToken !== 'string' || !INSTALLATION_TOKEN_PATTERN.test(data.installationToken)) {
    throw new HttpsError('invalid-argument', 'Identitatea instalării nu este validă.');
  }
  if (typeof data.itemTitle !== 'string' || data.itemTitle.trim().length < 2 || data.itemTitle.length > 140) {
    throw new HttpsError('invalid-argument', 'Titlul subiectului nu este valid.');
  }
  if (typeof data.problemText !== 'string' || data.problemText.trim().length < 8 || data.problemText.length > 1400) {
    throw new HttpsError('invalid-argument', 'Enunțul subiectului nu este valid.');
  }
  if (typeof data.maxPoints !== 'number' || !Number.isInteger(data.maxPoints) || data.maxPoints < 1 || data.maxPoints > 30) {
    throw new HttpsError('invalid-argument', 'Punctajul maxim nu este valid.');
  }
  if (!Array.isArray(data.rubricCriteria) || data.rubricCriteria.length < 1 || data.rubricCriteria.length > 8) {
    throw new HttpsError('invalid-argument', 'Baremul subiectului nu este valid.');
  }

  const rubricCriteria: RubricCriterionInput[] = [];
  for (const item of data.rubricCriteria) {
    if (!item || typeof item !== 'object') {
      throw new HttpsError('invalid-argument', 'Criteriu invalid în barem.');
    }
    const step = (item as { step?: unknown }).step;
    const points = (item as { points?: unknown }).points;
    if (typeof step !== 'string' || step.trim().length < 2 || step.length > 220
      || typeof points !== 'number' || !Number.isInteger(points) || points < 1 || points > 30) {
      throw new HttpsError('invalid-argument', 'Criteriu invalid în barem.');
    }
    rubricCriteria.push({ step: step.trim(), points });
  }

  if (data.mimeType !== 'image/jpeg' && data.mimeType !== 'image/png') {
    throw new HttpsError('invalid-argument', 'Formatul imaginii nu este acceptat.');
  }
  if (typeof data.imageBase64 !== 'string' || data.imageBase64.length === 0 || data.imageBase64.length > MAX_BASE64_LENGTH) {
    throw new HttpsError('invalid-argument', 'Fotografia este goală sau prea mare.');
  }
  if (!BASE64_PATTERN.test(data.imageBase64) || Buffer.byteLength(data.imageBase64, 'base64') > MAX_IMAGE_BYTES) {
    throw new HttpsError('invalid-argument', 'Datele fotografiei nu sunt valide.');
  }

  return {
    examId: examId.data,
    itemTitle: data.itemTitle.trim(),
    maxPoints: data.maxPoints,
    problemText: data.problemText.trim(),
    rubricCriteria,
    imageBase64: data.imageBase64,
    mimeType: data.mimeType,
    requestId: data.requestId,
    installationToken: data.installationToken,
  };
}

export function normalizeExamGradingResult(
  raw: z.infer<typeof examGradingResultSchema>,
  request: Pick<GradeExamSolutionRequest, 'maxPoints' | 'rubricCriteria'>,
): ExamGradingResult {
  if (raw.status !== 'graded') {
    return {
      ...raw,
      awardedPoints: 0,
      maxPoints: request.maxPoints,
      verdict: 'needs_work',
      criteriaScores: [],
    };
  }

  const criteriaLimit = request.rubricCriteria.length > 0
    ? Math.min(12, request.rubricCriteria.length)
    : raw.criteriaScores.length;
  const clampedCriteria = raw.criteriaScores.slice(0, criteriaLimit).map((item, idx) => {
    const expectedMax = request.rubricCriteria[idx]?.points ?? item.maxPoints;
    const safeMax = Math.max(1, Math.min(request.maxPoints, expectedMax));
    const safeAwarded = Math.max(0, Math.min(safeMax, item.awardedPoints));
    return {
      step: item.step,
      awardedPoints: safeAwarded,
      maxPoints: safeMax,
      comment: item.comment,
    };
  });

  const criteriaSum = clampedCriteria.reduce((sum, item) => sum + item.awardedPoints, 0);
  const finalPoints = clampedCriteria.length > 0
    ? Math.max(0, Math.min(request.maxPoints, criteriaSum))
    : Math.max(0, Math.min(request.maxPoints, raw.awardedPoints));

  const verdict: ExamGradingResult['verdict'] = finalPoints >= request.maxPoints
    ? 'complete'
    : finalPoints > 0
      ? 'partial'
      : 'needs_work';

  return {
    status: 'graded',
    awardedPoints: finalPoints,
    maxPoints: request.maxPoints,
    verdict,
    summary: raw.summary,
    criteriaScores: clampedCriteria,
    improvementTip: raw.improvementTip,
  };
}
