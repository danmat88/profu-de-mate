import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type Query, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { mathAnalysisJsonSchema } from './analysisSchema.js';
import { assertFirestoreSafeAnalysis } from './documentSize.js';
import { FEEDBACK_RETENTION_MS, feedbackSeverity, isFeedbackCategory } from './feedbackTriage.js';
import { ProviderCircuitBreaker } from './providerCircuitBreaker.js';
import { runProviderPipeline } from './providerPipeline.js';
import type { RenderedMathAnalysis } from './mathRenderer.js';
import { consumeAnalysisQuota, refundDailyAnalysisQuota } from './rateLimit.js';
import { getAIAnalysisConfig } from './runtimeConfig.js';
import { parseAnalyzeRequest } from './validation.js';

initializeApp();

const db = getFirestore();
const geminiApiKey = defineSecret('GEMINI_API_KEY');
// Each workload has its own least-privilege identity; never fall back to the default Editor account.
const AI_RUNTIME_SERVICE_ACCOUNT = 'profu-ai-runtime@profu-de-mate-danmat88.iam.gserviceaccount.com';
const DATA_RUNTIME_SERVICE_ACCOUNT = 'profu-data-runtime@profu-de-mate-danmat88.iam.gserviceaccount.com';
const CLEANUP_RUNTIME_SERVICE_ACCOUNT = 'profu-cleanup-runtime@profu-de-mate-danmat88.iam.gserviceaccount.com';
const REQUEST_LEASE_MS = 130_000;
const REQUEST_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const providerCircuit = new ProviderCircuitBreaker();

type CachedResponse = {
  lessonId: string | null;
  result: RenderedMathAnalysis;
};

function safeErrorDescriptor(error: unknown): { name: string; code?: string } {
  if (!error || typeof error !== 'object') return { name: typeof error };
  const value = error as { name?: unknown; code?: unknown };
  return {
    name: typeof value.name === 'string' ? value.name.slice(0, 80) : 'UnknownError',
    ...(typeof value.code === 'string' ? { code: value.code.slice(0, 80) } : {}),
  };
}

async function claimAnalysisRequest(userId: string, requestId: string, mode: string): Promise<CachedResponse | null> {
  const ref = db.collection('_analysisRequests').doc(`${userId}_${requestId}`);
  const claim = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data();
    if (data?.state === 'completed' && data.response) {
      return { kind: 'cached' as const, response: data.response as CachedResponse };
    }

    const updatedAt = data?.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : 0;
    if (data?.state === 'processing' && Date.now() - updatedAt < REQUEST_LEASE_MS) {
      return { kind: 'busy' as const };
    }

    const now = Date.now();
    transaction.set(ref, {
      userId,
      mode,
      state: 'processing',
      updatedAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + REQUEST_CACHE_MS),
    }, { merge: true });
    return { kind: 'claimed' as const };
  });

  if (claim.kind === 'busy') {
    throw new HttpsError('aborted', 'Analiza fotografiei este deja în curs.');
  }
  return claim.kind === 'cached' ? claim.response : null;
}

async function deleteQueryInBatches(query: Query): Promise<number> {
  let deleted = 0;
  while (true) {
    const snapshot = await query.limit(400).get();
    if (snapshot.empty) return deleted;
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    deleted += snapshot.size;
  }
}

export const analyzeMathImage = onCall({
  region: 'europe-west1',
  serviceAccount: AI_RUNTIME_SERVICE_ACCOUNT,
  memory: '512MiB',
  timeoutSeconds: 120,
  maxInstances: 3,
  concurrency: 10,
  enforceAppCheck: true,
  secrets: [geminiApiKey],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Trebuie să pornești aplicația din nou.');
  }

  const input = parseAnalyzeRequest(request.data);
  const requestRef = db.collection('_analysisRequests').doc(`${request.auth.uid}_${input.requestId}`);
  const cached = await claimAnalysisRequest(request.auth.uid, input.requestId, input.mode);
  if (cached) return cached;

  try {
    const aiConfig = await getAIAnalysisConfig(db);
    if (!aiConfig.enabled) {
      throw new HttpsError('unavailable', 'Profu’ este într-o scurtă pauză tehnică. Încearcă din nou peste câteva minute.');
    }
    if (!providerCircuit.canRequest()) {
      throw new HttpsError('unavailable', 'Profu’ este într-o scurtă pauză tehnică. Încearcă din nou peste un minut.');
    }

    await consumeAnalysisQuota(db, request.auth.uid, input.requestId, Date.now(), aiConfig.maxDailyRequests);
    const client = new GoogleGenAI({ apiKey: geminiApiKey.value() });
    let result: RenderedMathAnalysis;

    try {
      result = await runProviderPipeline({
        mode: input.mode,
        imageBase64: input.imageBase64,
        mimeType: input.mimeType,
        generate: async (providerRequest) => {
          const interaction = await client.interactions.create({
            model: 'gemini-3.7-flash',
            // Stateless requests prevent the provider from retaining the uploaded
            // photograph, candidate JSON and generated response as Interaction resources.
            store: false,
            input: providerRequest.kind === 'repair'
              ? [
                { type: 'text', text: providerRequest.prompt },
                { type: 'text', text: `OBIECT JSON DE CORECTAT:\n${providerRequest.source}` },
              ]
              : [
                { type: 'text', text: providerRequest.prompt },
                { type: 'image', data: providerRequest.imageBase64, mime_type: providerRequest.mimeType },
              ],
            response_format: {
              type: 'text',
              mime_type: 'application/json',
              schema: mathAnalysisJsonSchema,
            },
            generation_config: {
              thinking_level: 'low',
            },
          });
          return interaction.output_text;
        },
        onRejected: (event, error) => {
          logger.warn('Structured math response rejected', {
            call: event.call,
            mode: input.mode,
            requestKind: event.requestKind,
            stage: event.stage,
            issues: event.issues,
            ...(event.stage === 'schema' ? {} : safeErrorDescriptor(error)),
          });
        },
      });
      providerCircuit.recordSuccess();
    } catch (error) {
      providerCircuit.recordFailure();
      throw error;
    }

    assertFirestoreSafeAnalysis(result);
    const lessonRef = result.status === 'ready'
      ? db.collection('users').doc(request.auth.uid).collection('lessons').doc(input.requestId)
      : null;

    const response: CachedResponse = { lessonId: lessonRef?.id ?? null, result };
    const batch = db.batch();
    if (lessonRef) {
      batch.set(lessonRef, {
        ...result,
        model: 'gemini-3.7-flash',
        isFavorite: false,
        expiresAt: Timestamp.fromMillis(Date.now() + REQUEST_CACHE_MS),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    batch.set(requestRef, {
      state: 'completed',
      response,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + REQUEST_CACHE_MS),
    }, { merge: true });
    await batch.commit();

    logger.info('Math image analyzed', {
      status: result.status,
      mode: result.mode,
      stored: Boolean(lessonRef),
    });

    return response;
  } catch (error) {
    await Promise.all([
      refundDailyAnalysisQuota(db, request.auth.uid, input.requestId).catch(() => undefined),
      requestRef.set({
        state: 'failed',
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + REQUEST_CACHE_MS),
      }, { merge: true }).catch(() => undefined),
    ]);
    if (error instanceof HttpsError) throw error;
    logger.error('Math analysis failed', safeErrorDescriptor(error));
    throw new HttpsError('internal', 'Nu am putut analiza imaginea acum. Încearcă din nou.');
  }
});

export const deleteMyData = onCall({
  region: 'europe-west1',
  serviceAccount: DATA_RUNTIME_SERVICE_ACCOUNT,
  memory: '256MiB',
  timeoutSeconds: 120,
  maxInstances: 3,
  enforceAppCheck: true,
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sesiunea nu este validă.');
  const userId = request.auth.uid;

  try {
    await Promise.all([
      db.recursiveDelete(db.collection('users').doc(userId)),
      deleteQueryInBatches(db.collection('feedback').where('userId', '==', userId)),
      deleteQueryInBatches(db.collection('_aiUsage').where('userId', '==', userId)),
      deleteQueryInBatches(db.collection('_analysisRequests').where('userId', '==', userId)),
    ]);
    await getAuth().deleteUser(userId);
    logger.info('User data deleted');
    return { deleted: true };
  } catch (error) {
    logger.error('User data deletion failed', safeErrorDescriptor(error));
    throw new HttpsError('internal', 'Datele nu au putut fi șterse acum. Încearcă din nou.');
  }
});

export const initializeFeedbackTriage = onDocumentCreated({
  document: 'feedback/{feedbackId}',
  region: 'europe-west1',
  serviceAccount: DATA_RUNTIME_SERVICE_ACCOUNT,
  memory: '256MiB',
  maxInstances: 2,
}, async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;
  const category = snapshot.data()?.category;
  if (!isFeedbackCategory(category)) {
    logger.warn('Feedback triage skipped: invalid category');
    return;
  }

  const now = Date.now();
  await snapshot.ref.set({
    status: 'new',
    severity: feedbackSeverity(category),
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(now + FEEDBACK_RETENTION_MS),
  }, { merge: true });
  logger.info('Feedback queued for triage', { category, severity: feedbackSeverity(category) });
});

export const cleanupExpiredData = onSchedule({
  region: 'europe-west1',
  serviceAccount: CLEANUP_RUNTIME_SERVICE_ACCOUNT,
  schedule: 'every day 03:15',
  timeZone: 'Europe/Bucharest',
  memory: '256MiB',
  timeoutSeconds: 300,
}, async () => {
  const now = Timestamp.now();
  const [requests, usage, lessons, feedback] = await Promise.all([
    deleteQueryInBatches(db.collection('_analysisRequests').where('expiresAt', '<=', now)),
    deleteQueryInBatches(db.collection('_aiUsage').where('expiresAt', '<=', now)),
    deleteQueryInBatches(db.collectionGroup('lessons').where('expiresAt', '<=', now)),
    deleteQueryInBatches(db.collection('feedback').where('expiresAt', '<=', now)),
  ]);
  logger.info('Expired data cleaned', { requests, usage, lessons, feedback });
});
