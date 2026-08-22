import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { File } from 'expo-file-system';
import type { CapturedImage, FlowMode, MathAnalysis } from '../types';
import { isMathAnalysis } from '../utils/mathContent';
import { initializeFirebaseServices } from './firebase';

type AnalyzeMathRequest = {
  mode: FlowMode;
  imageBase64: string;
  mimeType: 'image/jpeg';
};

type AnalyzeMathResponse = {
  lessonId: string | null;
  result: MathAnalysis;
};

export async function analyzeMathImage(mode: FlowMode, image: CapturedImage): Promise<AnalyzeMathResponse> {
  await initializeFirebaseServices();

  const imageFile = new File(image.uri);
  const imageBase64 = await imageFile.base64();
  const functions = getFunctions(getApp(), 'europe-west1');
  const analyze = httpsCallable<AnalyzeMathRequest, AnalyzeMathResponse>(functions, 'analyzeMathImage', { timeout: 120_000 });
  const response = await analyze({ mode, imageBase64, mimeType: 'image/jpeg' });

  if (!isMathAnalysis(response.data?.result) || response.data.result.mode !== mode) {
    throw new Error('Răspunsul primit nu este valid.');
  }

  return response.data;
}

export function friendlyAnalysisError(error: unknown): string {
  const value = error as { code?: string; message?: string };
  if (value.code?.includes('app-check')) return 'Telefonul nu a putut porni conexiunea verificată. Închide complet aplicația și încearcă din nou.';
  if (value.code?.includes('resource-exhausted')) return value.message || 'Ai trimis prea multe imagini. Încearcă puțin mai târziu.';
  if (value.code?.includes('unauthenticated')) return 'Conexiunea sigură nu a pornit. Redeschide aplicația și încearcă din nou.';
  if (value.code?.includes('unauthorized') || value.code?.includes('failed-precondition')) return 'Telefonul nu a putut fi verificat. Repornește aplicația și încearcă din nou.';
  if (value.code?.includes('unavailable') || value.code?.includes('deadline-exceeded')) return 'Conexiunea este prea lentă acum. Verifică internetul și încearcă din nou.';
  return 'Nu am putut analiza fotografia acum. Poza ta nu a fost salvată. Încearcă din nou.';
}
