import { createHash, randomUUID } from 'node:crypto';
import { FieldValue, type Firestore, Timestamp, type Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import type { RenderedMathAnalysis } from './mathRenderer.js';
import type { AnalyzeRequest, ImageAnalysisInput, MathAnalysisInput } from './validation.js';
import { assertUserActive } from './userLifecycle.js';

export const REQUEST_LEASE_MS = 130_000;
export const REQUEST_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
export type CachedResponse = { lessonId: string | null; result: RenderedMathAnalysis };

export function requestFingerprint(input: { mode: AnalyzeRequest['mode'] } & (ImageAnalysisInput | MathAnalysisInput)): string {
  if (input.kind === 'math') {
    // Length-prefix every field and separate this protocol from legacy image
    // hashes. Editing the solution must never reuse another result or lease.
    const hash = createHash('sha256').update('math-v1\n');
    for (const field of [input.mode, input.problemLatex, input.solutionLatex ?? '']) {
      hash.update(`${Buffer.byteLength(field, 'utf8')}:`).update(field);
    }
    return hash.digest('hex');
  }
  // Keep the original bytes so existing image retries and cached lessons work.
  return createHash('sha256').update(`${input.mode}\n${input.mimeType}\n`).update(input.imageBase64).digest('hex');
}

export function analysisRequestState(data: Record<string, unknown> | undefined, now = Date.now()): 'missing' | 'processing' | 'completed' | 'failed' {
  if (!data) return 'missing';
  const expiry = data.expiresAt instanceof Timestamp ? data.expiresAt.toMillis() : 0;
  if (expiry <= now) return 'missing';
  if (data.state === 'completed' && data.response) return 'completed';
  const updated = data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : 0;
  if (data.state === 'processing' && now - updated < REQUEST_LEASE_MS) return 'processing';
  return 'failed';
}

export async function claimAnalysisRequest(db: Firestore, userId: string, input: AnalyzeRequest, now = Date.now()): Promise<{ response: CachedResponse | null; leaseId: string }> {
  const ref = db.collection('_analysisRequests').doc(`${userId}_${input.requestId}`);
  const fingerprint = requestFingerprint(input);
  const leaseId = randomUUID();
  return db.runTransaction(async (transaction) => {
    await assertUserActive(transaction, db, userId);
    const snapshot = await transaction.get(ref);
    const data = snapshot.data();
    // Never recycle IDs for different content or mode, including failed requests.
    if (data && (data.mode !== input.mode || (data.fingerprint && data.fingerprint !== fingerprint))) {
      throw new HttpsError('invalid-argument', 'Această cerere aparține altei probleme. Trimite o analiză nouă.');
    }
    const state = analysisRequestState(data, now);
    if (state === 'completed') {
      // Legacy completed records have no input binding and cannot safely be replayed.
      if (!data?.fingerprint) throw new HttpsError('failed-precondition', 'Trimite problema ca analiză nouă.');
      return { response: data.response as CachedResponse, leaseId };
    }
    if (state === 'processing') throw new HttpsError('aborted', 'Analiza problemei este deja în curs.');
    transaction.set(ref, {
      userId, mode: input.mode, fingerprint, leaseId, state: 'processing',
      updatedAt: Timestamp.fromMillis(now), expiresAt: Timestamp.fromMillis(now + REQUEST_CACHE_MS),
    });
    return { response: null, leaseId };
  });
}

export async function assertAnalysisLease(transaction: Transaction, db: Firestore, userId: string, requestId: string, leaseId: string): Promise<void> {
  const snapshot = await transaction.get(db.collection('_analysisRequests').doc(`${userId}_${requestId}`));
  if (snapshot.data()?.leaseId !== leaseId || snapshot.data()?.state !== 'processing') {
    throw new HttpsError('aborted', 'Analiza a fost reluată în altă sesiune.');
  }
}

export async function failAnalysisRequest(db: Firestore, userId: string, requestId: string, leaseId: string): Promise<void> {
  await db.runTransaction(async (transaction) => {
    await assertUserActive(transaction, db, userId);
    const ref = db.collection('_analysisRequests').doc(`${userId}_${requestId}`);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.data()?.leaseId !== leaseId || snapshot.data()?.state !== 'processing') return;
    transaction.update(ref, { state: 'failed', updatedAt: FieldValue.serverTimestamp() });
  });
}
