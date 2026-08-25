import { File, Paths } from 'expo-file-system';
import type { CapturedImage, FlowMode } from '../types';
import { clearTemporaryCapturedImagesOnStartup, isManagedTemporaryImage } from './temporaryImages';

const PENDING_ANALYSIS_FILE = 'profu-pending-analysis-v1.json';
const PENDING_ANALYSIS_MAX_AGE_MS = 30 * 60 * 1000;

export type PendingAnalysis = {
  schemaVersion: 1;
  mode: FlowMode;
  image: CapturedImage;
  requestId: string;
  createdAt: number;
};

function getPendingFile(): File {
  return new File(Paths.cache, PENDING_ANALYSIS_FILE);
}

function isPendingAnalysis(value: unknown): value is PendingAnalysis {
  if (!value || typeof value !== 'object') return false;
  const pending = value as Partial<PendingAnalysis>;
  const image = pending.image as Partial<CapturedImage> | undefined;
  return pending.schemaVersion === 1
    && (pending.mode === 'solve' || pending.mode === 'check')
    && typeof pending.requestId === 'string'
    && /^analysis-[a-z0-9]+-[a-z0-9]+$/.test(pending.requestId)
    && typeof pending.createdAt === 'number'
    && Number.isFinite(pending.createdAt)
    && Date.now() - pending.createdAt >= 0
    && Date.now() - pending.createdAt <= PENDING_ANALYSIS_MAX_AGE_MS
    && Boolean(image)
    && typeof image?.uri === 'string'
    && isManagedTemporaryImage(image.uri)
    && typeof image.width === 'number'
    && Number.isFinite(image.width)
    && image.width > 0
    && typeof image.height === 'number'
    && Number.isFinite(image.height)
    && image.height > 0
    && (image.source === 'camera' || image.source === 'gallery');
}

export function savePendingAnalysis(mode: FlowMode, image: CapturedImage, requestId: string): boolean {
  const pending: PendingAnalysis = {
    schemaVersion: 1,
    mode,
    image,
    requestId,
    createdAt: Date.now(),
  };
  try {
    getPendingFile().write(JSON.stringify(pending));
    return true;
  } catch {
    return false;
  }
}

export function clearPendingAnalysis(): void {
  try {
    const file = getPendingFile();
    if (file.exists) file.delete();
  } catch {
    // A later startup can invalidate an unreadable marker.
  }
}

export async function preparePendingAnalysisOnStartup(): Promise<PendingAnalysis | null> {
  try {
    const file = getPendingFile();
    if (!file.exists) {
      clearTemporaryCapturedImagesOnStartup();
      return null;
    }

    const value: unknown = JSON.parse(await file.text());
    if (!isPendingAnalysis(value)) throw new Error('Invalid pending analysis marker.');

    const imageFile = new File(value.image.uri);
    if (!imageFile.exists) throw new Error('Pending analysis image is missing.');

    clearTemporaryCapturedImagesOnStartup([value.image.uri]);
    return value;
  } catch {
    clearPendingAnalysis();
    clearTemporaryCapturedImagesOnStartup();
    return null;
  }
}
