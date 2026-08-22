import { HttpsError } from 'firebase-functions/v2/https';
import { flowModeSchema, type FlowMode } from './analysisSchema.js';

const MAX_BASE64_LENGTH = 7_000_000;
const MAX_IMAGE_BYTES = 5_000_000;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export type AnalyzeRequest = {
  mode: FlowMode;
  imageBase64: string;
  mimeType: 'image/jpeg' | 'image/png';
};

export function parseAnalyzeRequest(value: unknown): AnalyzeRequest {
  if (!value || typeof value !== 'object') {
    throw new HttpsError('invalid-argument', 'Cererea nu conține o imagine validă.');
  }

  const data = value as Record<string, unknown>;
  const parsedMode = flowModeSchema.safeParse(data.mode);
  if (!parsedMode.success) {
    throw new HttpsError('invalid-argument', 'Modul de analiză nu este valid.');
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
  };
}
