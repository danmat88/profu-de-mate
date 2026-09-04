import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { File } from 'expo-file-system';
import type { CapturedImage, FlowMode, MathAnalysis } from '../types';
import { isMathAnalysis } from '../utils/mathContent';
import { initializeVerifiedFirebaseServices } from './firebase';
import { getInstallationToken } from './installationIdentity';

export { friendlyAnalysisError } from '../utils/analysisErrors';

type AnalyzeMathRequest = {
  mode: FlowMode;
  imageBase64: string;
  mimeType: 'image/jpeg';
  requestId: string;
  installationToken: string;
};

type AnalyzeMathResponse = {
  lessonId: string | null;
  result: MathAnalysis;
};

type AnalysisStatusResponse =
  | { state: 'missing' | 'processing' | 'failed' }
  | { state: 'completed'; response: AnalyzeMathResponse };

// The callable itself can run for 120 seconds. The client must leave enough
// room for the platform to deliver the function's terminal response.
const ANALYSIS_CLIENT_TIMEOUT_MS = 135_000;
const ANALYSIS_POLL_INTERVAL_MS = 1_250;

function validAnalyzeMathResponse(value: unknown, mode: FlowMode): value is AnalyzeMathResponse {
  if (!value || typeof value !== 'object') return false;
  const response = value as Partial<AnalyzeMathResponse>;
  return (typeof response.lessonId === 'string' || response.lessonId === null)
    && isMathAnalysis(response.result)
    && response.result.mode === mode;
}

function callableCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createAnalysisRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 12);
  return `analysis-${timestamp}-${random}`;
}

export async function analyzeMathImage(mode: FlowMode, image: CapturedImage, requestId: string): Promise<AnalyzeMathResponse> {
  await initializeVerifiedFirebaseServices();
  const installationToken = await getInstallationToken();

  const imageFile = new File(image.uri);
  const imageBase64 = await imageFile.base64();
  const functions = getFunctions(getApp(), 'europe-west1');
  const analyze = httpsCallable<AnalyzeMathRequest, AnalyzeMathResponse>(functions, 'analyzeMathImage', { timeout: ANALYSIS_CLIENT_TIMEOUT_MS });
  const response = await analyze({ mode, imageBase64, mimeType: 'image/jpeg', requestId, installationToken });

  if (!validAnalyzeMathResponse(response.data, mode)) {
    throw new Error('Răspunsul primit nu este valid.');
  }

  return response.data;
}

async function getAnalysisStatus(requestId: string, mode: FlowMode): Promise<AnalysisStatusResponse> {
  await initializeVerifiedFirebaseServices();
  const functions = getFunctions(getApp(), 'europe-west1');
  const lookup = httpsCallable<{ requestId: string }, AnalysisStatusResponse>(functions, 'getAnalysisStatus', { timeout: 20_000 });
  const response = await lookup({ requestId });
  const status = response.data;
  if (!status || !['missing', 'processing', 'failed', 'completed'].includes(status.state)) {
    throw new Error('Starea analizei nu este validă.');
  }
  if (status.state === 'completed' && !validAnalyzeMathResponse(status.response, mode)) {
    throw new Error('Rezultatul reluat nu este valid.');
  }
  return status;
}

async function waitForExistingAnalysis(
  requestId: string,
  mode: FlowMode,
  shouldStop: () => boolean,
): Promise<AnalyzeMathResponse | null> {
  const deadline = Date.now() + ANALYSIS_CLIENT_TIMEOUT_MS;
  while (!shouldStop() && Date.now() < deadline) {
    const status = await getAnalysisStatus(requestId, mode);
    if (status.state === 'completed') return status.response;
    if (status.state === 'missing' || status.state === 'failed') return null;
    await wait(ANALYSIS_POLL_INTERVAL_MS);
  }
  if (shouldStop()) throw new Error('Analiza a fost lăsată să continue în fundal.');
  throw Object.assign(new Error('Analiza durează mai mult decât era de așteptat.'), { code: 'functions/deadline-exceeded' });
}

export async function analyzeOrResumeMathImage(
  mode: FlowMode,
  image: CapturedImage,
  requestId: string,
  resumeExisting: boolean,
  shouldStop: () => boolean,
): Promise<AnalyzeMathResponse> {
  if (resumeExisting) {
    const existing = await waitForExistingAnalysis(requestId, mode, shouldStop);
    if (existing) return existing;
  }

  try {
    return await analyzeMathImage(mode, image, requestId);
  } catch (error) {
    if (!callableCode(error).endsWith('/aborted')) throw error;
    const existing = await waitForExistingAnalysis(requestId, mode, shouldStop);
    if (existing) return existing;
    throw error;
  }
}
