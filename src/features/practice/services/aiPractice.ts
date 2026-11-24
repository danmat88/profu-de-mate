import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { initializeVerifiedFirebaseServices } from '../../../shared/services/firebase';
import { getInstallationToken } from '../../../shared/services/installationIdentity';
import { assertSessionActive, captureSession } from '../../../shared/services/sessionGuard';
import type {
  AiPracticeExercisePayload,
  PracticeDifficultyParam,
  RichContent,
  StudyFormulaCategoryParam,
} from '../../../shared/types';
import { createAnalysisRequestId } from '../../analysis/services/mathAnalysis';
import type { StudyTrackId } from '../../study/types';
import type { PracticeQuestion } from '../types';

export type GenerateAiExerciseRequest = {
  track: StudyTrackId;
  category: StudyFormulaCategoryParam;
  difficulty: PracticeDifficultyParam;
  formulaTitle?: string;
  seedProblemText?: string;
};

type WireRequest = GenerateAiExerciseRequest & {
  requestId: string;
  installationToken: string;
};

type WireResponse = {
  exercise?: {
    id?: unknown;
    title?: unknown;
    category?: unknown;
    difficulty?: unknown;
    prompt?: unknown;
    choices?: unknown;
    correctIndex?: unknown;
    hint?: unknown;
    explanation?: unknown;
  };
};

function isValidRichContent(value: unknown): value is RichContent {
  return Array.isArray(value) && value.length > 0 && value.every(
    (item) => Boolean(item) && typeof item === 'object' && typeof (item as { type?: unknown }).type === 'string',
  );
}

function isValidExercisePayload(value: WireResponse['exercise']): value is AiPracticeExercisePayload {
  if (!value || typeof value !== 'object') return false;
  if (typeof value.id !== 'string' || typeof value.title !== 'string') return false;
  if (typeof value.hint !== 'string') return false;
  if (!Array.isArray(value.choices) || value.choices.length !== 4 || !value.choices.every((c) => typeof c === 'string' && c.trim().length > 0)) {
    return false;
  }
  if (typeof value.correctIndex !== 'number' || ![0, 1, 2, 3].includes(value.correctIndex)) {
    return false;
  }
  return isValidRichContent(value.prompt) && isValidRichContent(value.explanation);
}

export function aiPayloadToPracticeQuestion(
  payload: AiPracticeExercisePayload,
  track: StudyTrackId,
): PracticeQuestion {
  return {
    id: payload.id,
    title: payload.title,
    category: payload.category,
    tracks: [track],
    difficulty: payload.difficulty,
    formulaId: payload.formulaId ?? '',
    kind: 'choice',
    prompt: [],
    renderedPrompt: payload.prompt,
    choices: [
      { label: payload.choices[0] },
      { label: payload.choices[1] },
      { label: payload.choices[2] },
      { label: payload.choices[3] },
    ],
    correctIndex: payload.correctIndex,
    answerDisplay: payload.choices[payload.correctIndex],
    hint: payload.hint,
    explanation: [],
    renderedExplanation: payload.explanation,
    aiGenerated: true,
  };
}

export function friendlyAiPracticeError(error: unknown): string {
  const code = error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : '';
  if (code.includes('not-found') || code.includes('unimplemented')) {
    return 'Generatorul AI este în pregătire pe server. Între timp poți exersa nelimitat testele rapide offline!';
  }
  if (code.includes('unavailable') || code.includes('deadline-exceeded') || code.includes('network')) {
    return 'Conexiunea nu răspunde acum. Verifică internetul sau încearcă un test rapid offline.';
  }
  if (error instanceof Error && error.message.trim().length > 0 && error.message.length < 180) {
    return error.message;
  }
  return 'Nu am putut genera exercițiul AI acum. Încearcă din nou sau folosește testele rapide.';
}

export async function generateAiPracticeExercise(
  params: GenerateAiExerciseRequest,
): Promise<AiPracticeExercisePayload> {
  const user = await initializeVerifiedFirebaseServices();
  const session = captureSession(user.uid);
  const installationToken = await getInstallationToken();
  assertSessionActive(session);

  const functions = getFunctions(getApp(), 'europe-west1');
  const callable = httpsCallable<WireRequest, WireResponse>(
    functions,
    'generatePracticeExercise',
    { timeout: 65_000 },
  );

  const response = await callable({
    track: params.track,
    category: params.category,
    difficulty: params.difficulty,
    ...(params.formulaTitle ? { formulaTitle: params.formulaTitle } : {}),
    ...(params.seedProblemText ? { seedProblemText: params.seedProblemText } : {}),
    requestId: createAnalysisRequestId(),
    installationToken,
  });
  assertSessionActive(session);

  if (!isValidExercisePayload(response.data?.exercise)) {
    throw new Error('Exercițiul primit nu a putut fi verificat. Încearcă din nou.');
  }

  return response.data.exercise;
}
