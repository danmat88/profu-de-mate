import { HttpsError } from 'firebase-functions/v2/https';
import { flowModeSchema, type FlowMode } from './analysisSchema.js';
import { parseMathInput } from './mathInput.js';

const MAX_BASE64_LENGTH = 7_000_000;
const MAX_IMAGE_BYTES = 5_000_000;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const REQUEST_ID_PATTERN = /^analysis-[a-z0-9]{6,16}-[a-z0-9]{6,16}$/;
const INSTALLATION_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

type AnalyzeRequestIdentity = {
  mode: FlowMode;
  requestId: string;
  installationToken: string;
};

export type ImageAnalysisInput = { kind?: 'image'; imageBase64: string; mimeType: 'image/jpeg' | 'image/png' };
export type MathAnalysisInput = { kind: 'math'; problemLatex: string; solutionLatex?: string };
export type AnalyzeRequest = AnalyzeRequestIdentity & (ImageAnalysisInput | MathAnalysisInput);

export type AnalysisStatusRequest = {
  requestId: string;
};

function parseRequestId(value: unknown): string {
  if (typeof value !== 'string' || !REQUEST_ID_PATTERN.test(value)) {
    throw new HttpsError('invalid-argument', 'Identificatorul analizei nu este valid.');
  }
  return value;
}

export function parseAnalysisStatusRequest(value: unknown): AnalysisStatusRequest {
  if (!value || typeof value !== 'object') {
    throw new HttpsError('invalid-argument', 'Cererea de reluare nu este validă.');
  }
  return { requestId: parseRequestId((value as Record<string, unknown>).requestId) };
}

export function parseAnalyzeRequest(value: unknown): AnalyzeRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'Cererea nu conține o problemă validă.');
  }

  const data = value as Record<string, unknown>;
  const parsedMode = flowModeSchema.safeParse(data.mode);
  if (!parsedMode.success) {
    throw new HttpsError('invalid-argument', 'Modul de analiză nu este valid.');
  }

  const requestId = parseRequestId(data.requestId);

  if (typeof data.installationToken !== 'string' || !INSTALLATION_TOKEN_PATTERN.test(data.installationToken)) {
    throw new HttpsError('invalid-argument', 'Identitatea instalării nu este validă.');
  }

  if (data.kind === 'math') {
    if (data.imageBase64 !== undefined || data.mimeType !== undefined) {
      throw new HttpsError('invalid-argument', 'Trimite fie o fotografie, fie problema scrisă.');
    }
    const problemLatex = parseMathInput(data.problemLatex, 'problemLatex');
    if (parsedMode.data === 'solve' && data.solutionLatex !== undefined) {
      throw new HttpsError('invalid-argument', 'Rezolvarea elevului poate fi trimisă numai pentru verificare.');
    }
    const solutionLatex = parsedMode.data === 'check' ? parseMathInput(data.solutionLatex, 'solutionLatex') : undefined;
    return {
      kind: 'math', mode: parsedMode.data, problemLatex,
      ...(solutionLatex === undefined ? {} : { solutionLatex }),
      requestId, installationToken: data.installationToken,
    };
  }
  if (data.kind !== undefined && data.kind !== 'image') {
    throw new HttpsError('invalid-argument', 'Tipul problemei nu este acceptat.');
  }
  if (data.problemLatex !== undefined || data.solutionLatex !== undefined) {
    throw new HttpsError('invalid-argument', 'Trimite fie o fotografie, fie problema scrisă.');
  }
  if (data.mimeType !== 'image/jpeg' && data.mimeType !== 'image/png') {
    throw new HttpsError('invalid-argument', 'Formatul imaginii nu este acceptat.');
  }

  if (typeof data.imageBase64 !== 'string' || data.imageBase64.length === 0 || data.imageBase64.length > MAX_BASE64_LENGTH) {
    throw new HttpsError('invalid-argument', 'Imaginea este goală sau prea mare.');
  }

  if (!BASE64_PATTERN.test(data.imageBase64) || Buffer.byteLength(data.imageBase64, 'base64') > MAX_IMAGE_BYTES) {
    throw new HttpsError('invalid-argument', 'Datele imaginii nu sunt valide.');
  }

  return {
    mode: parsedMode.data,
    imageBase64: data.imageBase64,
    mimeType: data.mimeType,
    requestId,
    installationToken: data.installationToken,
  };
}
