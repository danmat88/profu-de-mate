import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { File } from 'expo-file-system';
import type { CapturedImage, FlowMode, MathAnalysis } from '../types';
export { friendlyAnalysisError } from '../utils/analysisErrors';
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

// The callable itself can run for 120 seconds. The client must leave enough
// room for the platform to deliver the function's terminal response.
const ANALYSIS_CLIENT_TIMEOUT_MS = 135_000;

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
  const analyze = httpsCallable<AnalyzeMathRequest, AnalyzeMathResponse>(functions, 'analyzeMathImage', { timeout: ANALYSIS_CLIENT_TIMEOUT_MS });
  const response = await analyze({ mode, imageBase64, mimeType: 'image/jpeg', requestId });

  if (!isMathAnalysis(response.data?.result) || response.data.result.mode !== mode) {
    throw new Error('Răspunsul primit nu este valid.');
  }

  return response.data;
}
