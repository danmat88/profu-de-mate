import { File, Paths } from 'expo-file-system';
import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import type { CapturedImage, FlowMode, WrittenMathProblem } from '../../../shared/types';
import { clearTemporaryCapturedImagesOnStartup, deleteTemporaryCapturedImages, isManagedTemporaryImage } from '../../capture/services/temporaryImages';

const PENDING_ANALYSIS_FILE = 'profu-pending-analysis-v1.json';
const PENDING_ANALYSIS_MAX_AGE_MS = 30 * 60 * 1000;
let preparedSnapshot: PendingAnalysis | null | undefined;
let revision = 0;

type PendingBase = {
  userId: string;
  mode: FlowMode;
  requestId: string;
  createdAt: number;
};
export type PendingAnalysis = PendingBase & (
  | { schemaVersion: 2; image: CapturedImage }
  | { schemaVersion: 3; math: WrittenMathProblem }
);

function getPendingFile(): File {
  return new File(Paths.cache, PENDING_ANALYSIS_FILE);
}

function isPendingAnalysis(value: unknown): value is PendingAnalysis {
  if (!value || typeof value !== 'object') return false;
  const pending = value as Partial<PendingBase> & { schemaVersion?: unknown; image?: Partial<CapturedImage>; math?: Partial<WrittenMathProblem> };
  const image = pending.image;
  const validBase = (pending.schemaVersion === 2 || pending.schemaVersion === 3)
    && typeof pending.userId === 'string'
    && pending.userId.length > 0
    && pending.userId === getAuth(getApp()).currentUser?.uid
    && (pending.mode === 'solve' || pending.mode === 'check')
    && typeof pending.requestId === 'string'
    && /^analysis-[a-z0-9]+-[a-z0-9]+$/.test(pending.requestId)
    && typeof pending.createdAt === 'number'
    && Number.isFinite(pending.createdAt)
    && Date.now() - pending.createdAt >= 0
    && Date.now() - pending.createdAt <= PENDING_ANALYSIS_MAX_AGE_MS;
  if (!validBase) return false;
  if (pending.schemaVersion === 3) {
    const math = pending.math;
    return Boolean(math)
      && typeof math?.problemLatex === 'string' && math.problemLatex.trim().length > 0 && math.problemLatex.length <= 1600
      && (pending.mode === 'check'
        ? typeof math.solutionLatex === 'string' && math.solutionLatex.trim().length > 0 && math.solutionLatex.length <= 1600
        : math.solutionLatex === undefined);
  }
  return Boolean(image)
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

export function savePendingWrittenMath(mode: FlowMode, math: WrittenMathProblem, requestId: string, userId: string): boolean {
  if (getAuth(getApp()).currentUser?.uid !== userId) return false;
  const pending: PendingAnalysis = { schemaVersion: 3, userId, mode, math, requestId, createdAt: Date.now() };
  if (!isPendingAnalysis(pending)) return false;
  try {
    getPendingFile().write(JSON.stringify(pending));
    revision += 1;
    preparedSnapshot = pending;
    return true;
  } catch { return false; }
}

export function savePendingAnalysis(mode: FlowMode, image: CapturedImage, requestId: string, userId: string): boolean {
  if (getAuth(getApp()).currentUser?.uid !== userId) return false;
  const pending: PendingAnalysis = {
    schemaVersion: 2,
    userId,
    mode,
    image,
    requestId,
    createdAt: Date.now(),
  };
  revision += 1;
  preparedSnapshot = pending;
  try {
    getPendingFile().write(JSON.stringify(pending));
    return true;
  } catch {
    return false;
  }
}

export function clearPendingAnalysis(expectedRequestId?: string): void {
  if (expectedRequestId !== undefined && preparedSnapshot?.requestId !== expectedRequestId) return;
  revision += 1;
  preparedSnapshot = null;
  try {
    const file = getPendingFile();
    if (file.exists) file.delete();
  } catch {
    // A later startup can invalidate an unreadable marker.
  }
}

/** Removes only the temporary pending photograph, never saved notebook data. */
export function discardPendingAnalysis(): void {
  const imageUri = preparedSnapshot?.schemaVersion === 2 ? preparedSnapshot.image.uri : undefined;
  clearPendingAnalysis();
  if (imageUri) deleteTemporaryCapturedImages([imageUri]);
}

/**
 * Returns the in-memory value established during startup or by the active
 * analysis flow. `undefined` is reserved for callers running before startup
 * preparation; normal screens receive a stable value on their first render.
 */
export function getPreparedPendingAnalysis(): PendingAnalysis | null | undefined {
  if (preparedSnapshot && !isPendingAnalysis(preparedSnapshot)) discardPendingAnalysis();
  return preparedSnapshot;
}

export async function preparePendingAnalysisOnStartup(): Promise<PendingAnalysis | null> {
  const startedRevision = revision;
  try {
    const file = getPendingFile();
    if (!file.exists) {
      clearTemporaryCapturedImagesOnStartup();
      preparedSnapshot = null;
      return null;
    }

    const value: unknown = JSON.parse(await file.text());
    // A newer flow or logout won while disk I/O was pending.
    if (startedRevision !== revision) return getPreparedPendingAnalysis() ?? null;
    if (!isPendingAnalysis(value)) throw new Error('Invalid pending analysis marker.');

    if (value.schemaVersion === 2) {
      const imageFile = new File(value.image.uri);
      if (!imageFile.exists) throw new Error('Pending analysis image is missing.');
      clearTemporaryCapturedImagesOnStartup([value.image.uri]);
    } else {
      clearTemporaryCapturedImagesOnStartup();
    }
    preparedSnapshot = value;
    return value;
  } catch {
    if (startedRevision !== revision) return getPreparedPendingAnalysis() ?? null;
    clearPendingAnalysis();
    clearTemporaryCapturedImagesOnStartup();
    return null;
  }
}
