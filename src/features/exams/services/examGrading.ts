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
    ? (error as { code: string }).code.toLocaleLowerCase('en-US')
    : '';
  const message = error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message.toLocaleLowerCase('ro-RO')
    : '';
  if (message.includes('pauză tehnică')) {
    return 'Profu’ AI este într-o scurtă pauză tehnică. Poți folosi baremul oficial offline de mai jos.';
  }
  if (code.includes('not-found') || code.includes('unimplemented')) {
    return 'Corectarea foto pe barem cu AI este în curs de activare pe server. Între timp poți folosi baremul oficial pas cu pas de mai jos!';
  }
  if (code.includes('app-check') || code.includes('permission-denied') || code.includes('unauthorized') || code.includes('failed-precondition')) {
    return 'Nu am putut verifica această instalare. Repornește aplicația și încearcă din nou.';
  }
  if (code.includes('unauthenticated')) {
    return 'Sesiunea aplicației nu a pornit. Închide aplicația, apoi deschide-o din nou.';
  }
  if (code.includes('resource-exhausted')) {
    return 'Ai atins limita temporară pentru corectarea foto AI. Încearcă din nou peste puțin timp sau folosește baremul oficial.';
  }
  if (code.includes('aborted') || code.includes('already-exists')) {
    return 'Fotografia este încă analizată. Așteaptă câteva secunde și încearcă din nou.';
  }
  if (code.includes('invalid-argument')) {
    return 'Nu am putut citi fotografia rezolvării. Fotografiază din nou pagina completă, într-o lumină bună.';
  }
  if (code.includes('deadline-exceeded') || message.includes('timed out') || message.includes('timeout')) {
    return 'Corectarea a durat prea mult. Încearcă din nou sau folosește baremul oficial offline.';
  }
  if (
    code.includes('unavailable')
    || code.includes('network')
    || message.includes('network request failed')
    || message.includes('failed to fetch')
  ) {
    return 'Conexiunea nu răspunde acum. Poți verifica rezolvarea folosind baremul oficial offline.';
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
