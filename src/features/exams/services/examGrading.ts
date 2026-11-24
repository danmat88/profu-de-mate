import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { initializeVerifiedFirebaseServices } from '../../../shared/services/firebase';
import { getInstallationToken } from '../../../shared/services/installationIdentity';
import { assertSessionActive, captureSession } from '../../../shared/services/sessionGuard';
import { createAnalysisRequestId } from '../../analysis/services/mathAnalysis';
import type { ExamGuideId } from '../../study/types';
import type { AiRubricGradingResult, ExamSimulationItem } from '../types';

type GradeExamSolutionWireRequest = {
  examId: ExamGuideId;
  itemTitle: string;
  maxPoints: number;
  problemText: string;
  rubricCriteria: { step: string; points: number }[];
  imageBase64: string;
  mimeType: 'image/jpeg';
  requestId: string;
  installationToken: string;
};

type GradeExamSolutionWireResponse = {
  grading?: AiRubricGradingResult;
};

async function preparePhotoBase64(uri: string): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1600 } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
  );
  const file = new File(manipulated.uri);
  const base64 = await file.base64();
  try {
    if (file.exists) file.delete();
  } catch {
    // Non-critical temporary file cleanup.
  }
  return base64;
}

export function friendlyExamGradingError(error: unknown): string {
  const code = error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : '';
  if (code.includes('not-found') || code.includes('unimplemented')) {
    return 'Corectarea foto pe barem cu AI este în curs de activare pe server. Între timp poți folosi baremul oficial pas cu pas de mai jos!';
  }
  if (code.includes('unavailable') || code.includes('deadline-exceeded') || code.includes('network')) {
    return 'Conexiunea nu răspunde acum. Poți verifica rezolvarea folosind baremul oficial offline.';
  }
  if (error instanceof Error && error.message.trim().length > 0 && error.message.length < 180) {
    return error.message;
  }
  return 'Nu am putut analiza fotografia acum. Încearcă o poză mai clară sau folosește baremul oficial.';
}

export async function gradeExamSolutionPhoto(params: {
  examId: ExamGuideId;
  item: ExamSimulationItem;
  imageUri: string;
}): Promise<AiRubricGradingResult> {
  const user = await initializeVerifiedFirebaseServices();
  const session = captureSession(user.uid);
  const installationToken = await getInstallationToken();
  assertSessionActive(session);

  const imageBase64 = await preparePhotoBase64(params.imageUri);
  assertSessionActive(session);

  const functions = getFunctions(getApp(), 'europe-west1');
  const callable = httpsCallable<GradeExamSolutionWireRequest, GradeExamSolutionWireResponse>(
    functions,
    'gradeExamSolution',
    { timeout: 110_000 },
  );

  const rubricCriteria = (params.item.rubric ?? []).map((criterion) => ({
    step: criterion.step,
    points: criterion.points,
  }));

  const response = await callable({
    examId: params.examId,
    itemTitle: `${params.item.numberLabel} — ${params.item.title}`,
    maxPoints: params.item.maxPoints,
    problemText: params.item.plainStatement,
    rubricCriteria: rubricCriteria.length > 0
      ? rubricCriteria
      : [{ step: `Rezolvare completă (${params.item.answerDisplay})`, points: params.item.maxPoints }],
    imageBase64,
    mimeType: 'image/jpeg',
    requestId: createAnalysisRequestId(),
    installationToken,
  });
  assertSessionActive(session);

  const grading = response.data?.grading;
  if (!grading || typeof grading.awardedPoints !== 'number' || typeof grading.summary !== 'string') {
    throw new Error('Rezultatul corectării nu a putut fi validat. Încearcă din nou.');
  }
  return grading;
}
