import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { File } from 'expo-file-system';
import type { CapturedImage, FlowMode, MathAnalysis } from '../types';
import { isMathAnalysis } from '../utils/mathContent';
import { initializeVerifiedFirebaseServices } from './firebase';

type AnalyzeMathRequest = {
  mode: FlowMode;
  imageBase64: string;
  mimeType: 'image/jpeg';
  requestId: string;
};

type AnalyzeMathResponse = {
  lessonId: string | null;
  result: MathAnalysis;
};

export function createAnalysisRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 12);
  return `analysis-${timestamp}-${random}`;
}

export async function analyzeMathImage(mode: FlowMode, image: CapturedImage, requestId: string): Promise<AnalyzeMathResponse> {
  await initializeVerifiedFirebaseServices();

  const imageFile = new File(image.uri);
  const imageBase64 = await imageFile.base64();
  const functions = getFunctions(getApp(), 'europe-west1');
  const analyze = httpsCallable<AnalyzeMathRequest, AnalyzeMathResponse>(functions, 'analyzeMathImage', { timeout: 120_000 });
  const response = await analyze({ mode, imageBase64, mimeType: 'image/jpeg', requestId });

  if (!isMathAnalysis(response.data?.result) || response.data.result.mode !== mode) {
    throw new Error('Răspunsul primit nu este valid.');
  }

  return response.data;
}

export function friendlyAnalysisError(error: unknown): string {
  const value = error as { code?: string; message?: string };
  const code = (value.code ?? '').toLocaleLowerCase('en-US');
  const message = (value.message ?? '').toLocaleLowerCase('en-US');

  if (code.includes('app-check')) return 'Telefonul nu a putut porni conexiunea verificată. Închide complet aplicația și încearcă din nou.';
  if (code.includes('resource-exhausted')) return 'Ai ajuns la limita temporară de analize. Mai încearcă puțin mai târziu.';
  if (code.includes('unauthenticated')) return 'Conexiunea sigură nu a pornit. Redeschide aplicația și încearcă din nou.';
  if (code.includes('permission-denied') || code.includes('unauthorized') || code.includes('failed-precondition')) return 'Telefonul nu a putut fi verificat. Repornește aplicația și încearcă din nou.';
  if (code.includes('invalid-argument')) return 'Fotografia nu a putut fi citită corect. Repetă poza, cu problema completă și bine luminată.';
  if (code.includes('aborted') || code.includes('already-exists')) return 'Analiza acestei fotografii este încă în curs. Mai așteaptă câteva secunde și încearcă din nou.';
  if (
    code.includes('unavailable')
    || code.includes('deadline-exceeded')
    || code.includes('network-request-failed')
    || message.includes('network request failed')
    || message.includes('failed to fetch')
  ) return 'Nu pot ajunge la Profu’ acum. Verifică internetul și încearcă din nou; fotografia rămâne pe telefon.';
  if (code.includes('internal') || code.includes('unknown')) return 'Serviciul a întâmpinat o problemă temporară. Încearcă din nou peste câteva momente.';
  if (message.includes('file') || message.includes('no such')) return 'Fotografia nu mai poate fi citită de pe telefon. Repetă captura sau alege din nou imaginea.';
  return 'Nu am putut analiza fotografia acum. Ea nu a fost adăugată în Caiet sau în Firebase Storage. Încearcă din nou.';
}
