import { GoogleGenAI } from '@google/genai';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type Query, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { mathAnalysisJsonSchema } from './analysisSchema.js';
import { completeAccountMerge, createAccountMergeTicket } from './accountMerge.js';
import {
  commercialPrincipalFromAuthToken,
  hasRecentGoogleAuthentication,
  installationPrincipalId,
  validInstallationToken,
  type CommercialPrincipal,
} from './commercialIdentity.js';
import {
  bindInstallationToAccount,
  getCommercialConfig,
  identityFromAuthToken,
  readCommercialAccess,
  reconcileStaleAnalysisReservations,
  refundAnalysisQuota,
  reserveAnalysisQuota,
  settleAnalysisQuota,
} from './commercialAccess.js';
import { assertFirestoreSafeAnalysis } from './documentSize.js';
import { FEEDBACK_RETENTION_MS, feedbackSeverity, isFeedbackCategory } from './feedbackTriage.js';
import { FEEDBACK_RATE_WINDOW_MS, nextFeedbackRateState } from './feedbackSubmission.js';
import { claimWelcomeDevice, welcomeClaimHash } from './deviceRecall.js';
import {
  minimizeInstallationProfileForDeletion,
  removeOrRetainCommercialUsage,
  unlinkCommercialInstallations,
} from './dataDeletion.js';
import { ProviderCircuitBreaker } from './providerCircuitBreaker.js';
import { ENFORCE_APP_CHECK } from './releaseSecurity.js';
import { runProviderPipeline } from './providerPipeline.js';
import type { RenderedMathAnalysis } from './mathRenderer.js';
import {
  deleteRevenueCatCustomer,
  parseRevenueCatWebhook,
  secureSecretEquals,
  syncRevenueCatEntitlement,
  verifyRevenueCatSignature,
} from './revenueCat.js';
import { getAIAnalysisConfig } from './runtimeConfig.js';
import { parseAnalysisStatusRequest, parseAnalyzeRequest } from './validation.js';

if (getApps().length === 0) initializeApp();

const db = getFirestore();
const geminiApiKey = defineSecret('GEMINI_API_KEY');
const commercialIdentityHmacKey = defineSecret('COMMERCIAL_IDENTITY_HMAC_KEY');
// Firebase loads this non-secret flag from the Functions environment both
// during discovery and at runtime. Until RevenueCat is configured for real,
// its endpoints do not exist and the CLI cannot request placeholder secrets.
const revenueCatEnabled = process.env.PROFU_ENABLE_REVENUECAT === 'true';
const revenueCatSecrets = revenueCatEnabled ? {
  apiKey: defineSecret('REVENUECAT_SECRET_API_KEY'),
  webhookAuth: defineSecret('REVENUECAT_WEBHOOK_AUTH'),
  webhookSigning: defineSecret('REVENUECAT_WEBHOOK_SIGNING_SECRET'),
} : null;
// Each workload has its own least-privilege identity; never fall back to the default Editor account.
const AI_RUNTIME_SERVICE_ACCOUNT = 'profu-ai-runtime@profu-de-mate-danmat88.iam.gserviceaccount.com';
const DATA_RUNTIME_SERVICE_ACCOUNT = 'profu-data-runtime@profu-de-mate-danmat88.iam.gserviceaccount.com';
const CLEANUP_RUNTIME_SERVICE_ACCOUNT = 'profu-cleanup-runtime@profu-de-mate-danmat88.iam.gserviceaccount.com';
const REQUEST_LEASE_MS = 130_000;
const REQUEST_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const WEBHOOK_LEASE_MS = 2 * 60 * 1000;
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

function requestCommercialPrincipal(token: unknown, userId: string, installationToken?: unknown): CommercialPrincipal {
  return commercialPrincipalFromAuthToken(token, userId, commercialIdentityHmacKey.value(), installationToken);
}

function installationTokenFromData(data: unknown): string {
  const value = data && typeof data === 'object'
    ? (data as { installationToken?: unknown }).installationToken
    : undefined;
  if (!validInstallationToken(value)) {
    throw new HttpsError('invalid-argument', 'Identitatea instalării nu este validă.');
  }
  return value;
}

function pendingMergeTicketsFromData(data: unknown): string[] {
  const value = data && typeof data === 'object'
    ? (data as { pendingMergeTickets?: unknown }).pendingMergeTickets
    : undefined;
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 5
    || value.some((ticket) => typeof ticket !== 'string' || !/^[a-f0-9-]{36}$/i.test(ticket))) {
    throw new HttpsError('invalid-argument', 'Starea conectării contului nu este validă.');
  }
  return [...new Set(value as string[])];
}

async function removePendingMergeSourcesForDeletion(
  ticketIds: readonly string[],
  installationPrincipal: string,
  currentUserId: string,
): Promise<void> {
  if (ticketIds.length === 0) return;
  const ticketRefs = ticketIds.map((ticket) => db.collection('_accountMergeTickets').doc(ticket));
  const snapshots = await db.getAll(...ticketRefs);
  const sourceUserIds = new Set<string>();
  const ownedTickets = snapshots.filter((snapshot) => {
    const data = snapshot.data();
    const targetBelongsToAccount = data?.targetUserId === undefined || data?.targetUserId === currentUserId;
    if (data?.sourcePrincipalId !== installationPrincipal || !targetBelongsToAccount) return false;
    if (typeof data?.sourceUserId === 'string' && data.sourceUserId !== currentUserId) {
      sourceUserIds.add(data.sourceUserId);
    }
    return true;
  });

  await Promise.all([...sourceUserIds].map(async (sourceUserId) => {
    await Promise.all([
      db.recursiveDelete(db.collection('users').doc(sourceUserId)),
      deleteQueryInBatches(db.collection('feedback').where('userId', '==', sourceUserId)),
      deleteQueryInBatches(db.collection('_aiUsage').where('userId', '==', sourceUserId)),
      deleteQueryInBatches(db.collection('_analysisRequests').where('userId', '==', sourceUserId)),
      deleteQueryInBatches(db.collection('_commercialReservations').where('userId', '==', sourceUserId)),
      db.collection('_feedbackRateLimits').doc(sourceUserId).delete(),
    ]);
    await getAuth().deleteUser(sourceUserId).catch((error: unknown) => {
      const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
      if (code !== 'auth/user-not-found') throw error;
    });
  }));

  if (ownedTickets.length > 0) {
    const batch = db.batch();
    ownedTickets.forEach((ticket) => batch.delete(ticket.ref));
    await batch.commit();
  }
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
  enforceAppCheck: ENFORCE_APP_CHECK,
  secrets: [geminiApiKey, commercialIdentityHmacKey],
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

    const commercialPrincipal = requestCommercialPrincipal(request.auth.token, request.auth.uid, input.installationToken);
    await reserveAnalysisQuota(
      db,
      request.auth.uid,
      input.requestId,
      commercialPrincipal,
      Date.now(),
      aiConfig.maxDailyRequests,
    );
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
    await settleAnalysisQuota(db, commercialPrincipal.principalId, input.requestId, result.status === 'ready', (transaction) => {
      if (lessonRef) {
        transaction.set(lessonRef, {
          ...result,
          model: 'gemini-3.7-flash',
          isFavorite: false,
          expiresAt: Timestamp.fromMillis(Date.now() + REQUEST_CACHE_MS),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.set(requestRef, {
        state: 'completed',
        response,
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + REQUEST_CACHE_MS),
      }, { merge: true });
    });

    logger.info('Math image analyzed', {
      status: result.status,
      mode: result.mode,
      stored: Boolean(lessonRef),
    });

    return response;
  } catch (error) {
    await Promise.all([
      refundAnalysisQuota(
        db,
        requestCommercialPrincipal(request.auth.token, request.auth.uid, input.installationToken).principalId,
        input.requestId,
      ).catch(() => undefined),
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

export const getAnalysisStatus = onCall({
  region: 'europe-west1',
  serviceAccount: AI_RUNTIME_SERVICE_ACCOUNT,
  memory: '256MiB',
  timeoutSeconds: 20,
  maxInstances: 5,
  enforceAppCheck: ENFORCE_APP_CHECK,
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sesiunea nu este validă.');
  const { requestId } = parseAnalysisStatusRequest(request.data);
  const snapshot = await db.collection('_analysisRequests')
    .doc(`${request.auth.uid}_${requestId}`)
    .get();
  if (!snapshot.exists) return { state: 'missing' as const };

  const data = snapshot.data();
  if (data?.state === 'completed' && data.response) {
    return { state: 'completed' as const, response: data.response as CachedResponse };
  }
  if (data?.state === 'processing') return { state: 'processing' as const };
  return { state: 'failed' as const };
});

export const submitLessonFeedback = onCall({
  region: 'europe-west1',
  serviceAccount: DATA_RUNTIME_SERVICE_ACCOUNT,
  memory: '256MiB',
  timeoutSeconds: 20,
  maxInstances: 5,
  enforceAppCheck: ENFORCE_APP_CHECK,
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sesiunea nu este validă.');
  const uid = request.auth.uid;
  const data = request.data && typeof request.data === 'object'
    ? request.data as Record<string, unknown>
    : {};
  const lessonId = typeof data.lessonId === 'string' ? data.lessonId : '';
  const category = data.category;
  const appVersion = typeof data.appVersion === 'string' ? data.appVersion.trim() : '';
  if (!/^analysis-[a-z0-9]{6,16}-[a-z0-9]{6,16}$/.test(lessonId)
    || !isFeedbackCategory(category)
    || appVersion.length < 1
    || appVersion.length > 24) {
    throw new HttpsError('invalid-argument', 'Raportarea nu este validă.');
  }

  const now = Date.now();
  const lessonRef = db.collection('users').doc(uid).collection('lessons').doc(lessonId);
  const rateRef = db.collection('_feedbackRateLimits').doc(uid);
  const feedbackRef = db.collection('feedback').doc();
  await db.runTransaction(async (transaction) => {
    const [lesson, rate] = await Promise.all([
      transaction.get(lessonRef),
      transaction.get(rateRef),
    ]);
    if (!lesson.exists) throw new HttpsError('not-found', 'Lecția nu mai este disponibilă.');
    const rateData = rate.data();
    const next = nextFeedbackRateState({
      windowStartedAt: rateData?.windowStartedAt instanceof Timestamp ? rateData.windowStartedAt.toMillis() : undefined,
      submissions: rateData?.submissions,
    }, now);
    if (!next.allowed) {
      throw new HttpsError('resource-exhausted', 'Ai trimis mai multe raportări într-un timp scurt. Încearcă din nou mai târziu.');
    }
    transaction.set(rateRef, {
      userId: uid,
      windowStartedAt: Timestamp.fromMillis(next.state.windowStartedAt),
      submissions: next.state.submissions,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(next.state.windowStartedAt + FEEDBACK_RATE_WINDOW_MS + 24 * 60 * 60 * 1000),
    });
    transaction.create(feedbackRef, {
      userId: uid,
      lessonId,
      category,
      appVersion,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { submitted: true };
});

export const getCommercialAccess = onCall({
  region: 'europe-west1',
  serviceAccount: DATA_RUNTIME_SERVICE_ACCOUNT,
  memory: '256MiB',
  timeoutSeconds: 30,
  maxInstances: 5,
  enforceAppCheck: ENFORCE_APP_CHECK,
  secrets: [commercialIdentityHmacKey],
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sesiunea nu este validă.');
  const installationToken = installationTokenFromData(request.data);
  const installationPrincipal = installationPrincipalId(installationToken, commercialIdentityHmacKey.value());
  const principal = requestCommercialPrincipal(request.auth.token, request.auth.uid, installationToken);
  await reconcileStaleAnalysisReservations(db, principal.principalId).catch((error) => {
    // Index propagation or a transient database failure must not block access;
    // the same idempotent recovery runs again on the next refresh.
    logger.warn('Stale quota reconciliation deferred', safeErrorDescriptor(error));
  });
  if (principal.identity === 'google') {
    await bindInstallationToAccount(
      db,
      installationPrincipal,
      principal.principalId,
      request.auth.uid,
    );
  }
  return readCommercialAccess(
    db,
    request.auth.uid,
    principal,
  );
});

export const prepareAccountLogout = onCall({
  region: 'europe-west1',
  serviceAccount: DATA_RUNTIME_SERVICE_ACCOUNT,
  memory: '256MiB',
  timeoutSeconds: 30,
  maxInstances: 5,
  enforceAppCheck: ENFORCE_APP_CHECK,
  secrets: [commercialIdentityHmacKey],
}, async (request) => {
  // Compatibility endpoint for already-installed clients. Logging out no
  // longer depends on it; it only refreshes the reversible installation link.
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sesiunea nu este validă.');
  const installationToken = installationTokenFromData(request.data);
  const principal = requestCommercialPrincipal(request.auth.token, request.auth.uid, installationToken);
  if (principal.identity !== 'google') {
    throw new HttpsError('failed-precondition', 'Nu există un cont Google conectat.');
  }
  await bindInstallationToAccount(
    db,
    installationPrincipalId(installationToken, commercialIdentityHmacKey.value()),
    principal.principalId,
    request.auth.uid,
  );
  return { ready: true as const };
});

export const claimGuestWelcome = onCall({
  region: 'europe-west1',
  serviceAccount: DATA_RUNTIME_SERVICE_ACCOUNT,
  memory: '256MiB',
  timeoutSeconds: 30,
  maxInstances: 5,
  enforceAppCheck: ENFORCE_APP_CHECK,
  secrets: [commercialIdentityHmacKey],
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sesiunea nu este validă.');
  if (identityFromAuthToken(request.auth.token) !== 'anonymous') return { verified: true };
  const data = request.data && typeof request.data === 'object'
    ? request.data as { requestId?: unknown; integrityToken?: unknown; requestHash?: unknown; installationToken?: unknown }
    : {};
  if (typeof data.requestId !== 'string' || !/^analysis-[a-z0-9-]{8,80}$/i.test(data.requestId)
    || typeof data.integrityToken !== 'string' || data.integrityToken.length < 100 || data.integrityToken.length > 20_000
    || typeof data.requestHash !== 'string' || data.requestHash !== welcomeClaimHash(request.auth.uid, data.requestId)
    || !validInstallationToken(data.installationToken)) {
    throw new HttpsError('invalid-argument', 'Verificarea problemelor de bun-venit nu este validă.');
  }
  const config = await getCommercialConfig(db);
  return claimWelcomeDevice({
    db,
    userId: request.auth.uid,
    principalId: installationPrincipalId(data.installationToken, commercialIdentityHmacKey.value()),
    requestId: data.requestId,
    integrityToken: data.integrityToken,
    requestHash: data.requestHash,
    mode: config.deviceRecallMode,
    freeDailyLimit: config.freeDailyLimit,
  });
});

export const prepareAccountMerge = onCall({
  region: 'europe-west1',
  serviceAccount: DATA_RUNTIME_SERVICE_ACCOUNT,
  memory: '256MiB',
  timeoutSeconds: 30,
  maxInstances: 3,
  enforceAppCheck: ENFORCE_APP_CHECK,
  secrets: [commercialIdentityHmacKey],
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sesiunea nu este validă.');
  if (identityFromAuthToken(request.auth.token) !== 'anonymous') {
    throw new HttpsError('failed-precondition', 'Contul este deja conectat.');
  }
  const installationToken = installationTokenFromData(request.data);
  const sourcePrincipalId = installationPrincipalId(installationToken, commercialIdentityHmacKey.value());
  return { ticket: await createAccountMergeTicket(db, request.auth.uid, sourcePrincipalId) };
});

export const completeAccountMergeWithGoogle = onCall({
  region: 'europe-west1',
  serviceAccount: DATA_RUNTIME_SERVICE_ACCOUNT,
  memory: '512MiB',
  timeoutSeconds: 120,
  maxInstances: 2,
  enforceAppCheck: ENFORCE_APP_CHECK,
  secrets: [commercialIdentityHmacKey],
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sesiunea nu este validă.');
  if (identityFromAuthToken(request.auth.token) !== 'google') {
    throw new HttpsError('failed-precondition', 'Conectarea cu Google nu este finalizată.');
  }
  const ticket = request.data && typeof request.data === 'object'
    ? (request.data as { ticket?: unknown }).ticket
    : undefined;
  if (typeof ticket !== 'string' || !/^[a-f0-9-]{36}$/i.test(ticket)) {
    throw new HttpsError('invalid-argument', 'Legătura dintre conturi nu este validă.');
  }
  const installationToken = installationTokenFromData(request.data);
  const principal = requestCommercialPrincipal(request.auth.token, request.auth.uid);
  return completeAccountMerge({
    db,
    ticket,
    targetUserId: request.auth.uid,
    targetPrincipalId: principal.principalId,
    expectedSourcePrincipalId: installationPrincipalId(installationToken, commercialIdentityHmacKey.value()),
  });
});

export const syncPremiumAccess = revenueCatSecrets ? onCall({
  region: 'europe-west1',
  serviceAccount: DATA_RUNTIME_SERVICE_ACCOUNT,
  memory: '256MiB',
  timeoutSeconds: 30,
  maxInstances: 5,
  enforceAppCheck: ENFORCE_APP_CHECK,
  secrets: [revenueCatSecrets.apiKey, commercialIdentityHmacKey],
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sesiunea nu este validă.');
  const identity = identityFromAuthToken(request.auth.token);
  if (identity !== 'google') {
    throw new HttpsError('failed-precondition', 'Conectează-te cu Google înainte să restaurezi Premium.');
  }
  const config = await getCommercialConfig(db);
  const principal = requestCommercialPrincipal(request.auth.token, request.auth.uid);
  await syncRevenueCatEntitlement({
    db,
    appUserId: principal.principalId,
    secretApiKey: revenueCatSecrets.apiKey.value(),
    entitlementId: config.premiumEntitlementId,
    source: 'callable',
  });
  return readCommercialAccess(db, request.auth.uid, principal);
}) : undefined;

export const revenueCatWebhook = revenueCatSecrets ? onRequest({
  region: 'europe-west1',
  serviceAccount: DATA_RUNTIME_SERVICE_ACCOUNT,
  memory: '256MiB',
  timeoutSeconds: 60,
  maxInstances: 5,
  secrets: [revenueCatSecrets.apiKey, revenueCatSecrets.webhookAuth, revenueCatSecrets.webhookSigning],
}, async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).send('Method not allowed');
    return;
  }
  if (!secureSecretEquals(request.get('authorization'), revenueCatSecrets.webhookAuth.value())) {
    response.status(401).send('Unauthorized');
    return;
  }
  const rawBody = request.rawBody;
  const signature = request.get('x-revenuecat-webhook-signature');
  if (!Buffer.isBuffer(rawBody) || !signature || !verifyRevenueCatSignature(rawBody, signature, revenueCatSecrets.webhookSigning.value())) {
    response.status(401).send('Invalid signature');
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    response.status(400).send('Invalid JSON');
    return;
  }
  const event = parseRevenueCatWebhook(payload);
  if (!event) {
    response.status(400).send('Invalid event');
    return;
  }

  const eventRef = db.collection('_commercialEvents').doc(event.eventId);
  const claim = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(eventRef);
    const data = snapshot.data();
    if (data?.state === 'completed') return 'completed' as const;
    const updatedAt = data?.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : 0;
    if (data?.state === 'processing' && Date.now() - updatedAt < WEBHOOK_LEASE_MS) return 'busy' as const;
    transaction.set(eventRef, {
      eventId: event.eventId,
      eventType: event.eventType,
      state: 'processing',
      attempts: typeof data?.attempts === 'number' ? data.attempts + 1 : 1,
      updatedAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 400 * 24 * 60 * 60 * 1000),
    }, { merge: true });
    return 'claimed' as const;
  });
  if (claim === 'completed') {
    response.status(200).send('Already processed');
    return;
  }
  if (claim === 'busy') {
    response.status(409).send('Processing');
    return;
  }

  try {
    const config = await getCommercialConfig(db);
    const commercialUsers = event.appUserIds.filter((appUserId) => appUserId.startsWith('g_'));
    await Promise.all(commercialUsers.map((appUserId) => syncRevenueCatEntitlement({
      db,
      appUserId,
      secretApiKey: revenueCatSecrets.apiKey.value(),
      entitlementId: config.premiumEntitlementId,
      source: 'webhook',
    })));
    await eventRef.set({
      state: 'completed',
      syncedUsers: commercialUsers.length,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    logger.info('RevenueCat webhook processed', { eventType: event.eventType, syncedUsers: commercialUsers.length });
    response.status(200).send('OK');
  } catch (error) {
    await eventRef.set({ state: 'failed', updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => undefined);
    logger.error('RevenueCat webhook failed', safeErrorDescriptor(error));
    response.status(500).send('Sync failed');
  }
}) : undefined;

export const deleteMyData = onCall({
  region: 'europe-west1',
  serviceAccount: DATA_RUNTIME_SERVICE_ACCOUNT,
  memory: '256MiB',
  timeoutSeconds: 120,
  maxInstances: 3,
  enforceAppCheck: ENFORCE_APP_CHECK,
  secrets: [commercialIdentityHmacKey, ...(revenueCatSecrets ? [revenueCatSecrets.apiKey] : [])],
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sesiunea nu este validă.');
  const userId = request.auth.uid;
  const installationToken = installationTokenFromData(request.data);
  const installationPrincipal = installationPrincipalId(installationToken, commercialIdentityHmacKey.value());
  const pendingMergeTickets = pendingMergeTicketsFromData(request.data);
  const principal = requestCommercialPrincipal(request.auth.token, userId, installationToken);
  if (principal.identity === 'google' && !hasRecentGoogleAuthentication(request.auth.token)) {
    throw new HttpsError(
      'failed-precondition',
      'Confirmă din nou contul Google înainte de ștergerea definitivă.',
      { commercialReason: 'recent-auth-required' },
    );
  }

  try {
    let revenueCatDeletionPending = false;
    if (revenueCatSecrets) {
      try {
        await deleteRevenueCatCustomer(principal.principalId, revenueCatSecrets.apiKey.value());
      } catch (error) {
        revenueCatDeletionPending = true;
        await db.collection('_pendingRevenueCatDeletions').doc(principal.principalId).set({
          appUserId: principal.principalId,
          attempts: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          nextAttemptAt: Timestamp.now(),
        }, { merge: true });
        logger.warn('RevenueCat deletion queued', safeErrorDescriptor(error));
      }
    }
    if (principal.identity === 'google') {
      // Run this before updating the current installation profile so two
      // batches never race on the same document.
      await unlinkCommercialInstallations(db, principal.principalId);
    }
    await removePendingMergeSourcesForDeletion(
      pendingMergeTickets,
      installationPrincipal,
      userId,
    );
    await Promise.all([
      db.recursiveDelete(db.collection('users').doc(userId)),
      deleteQueryInBatches(db.collection('feedback').where('userId', '==', userId)),
      deleteQueryInBatches(db.collection('_aiUsage').where('userId', '==', userId)),
      deleteQueryInBatches(db.collection('_analysisRequests').where('userId', '==', userId)),
      removeOrRetainCommercialUsage(db, principal),
      deleteQueryInBatches(db.collection('_commercialReservations').where('userId', '==', userId)),
      db.collection('_feedbackRateLimits').doc(userId).delete(),
      deleteQueryInBatches(db.collection('_accountMergeTickets').where('sourceUserId', '==', userId)),
      deleteQueryInBatches(db.collection('_accountMergeTickets').where('targetUserId', '==', userId)),
      principal.identity === 'google'
        ? db.collection('_commercialUsers').doc(principal.principalId).delete()
        : Promise.resolve(),
      db.collection('_commercialEntitlements').doc(principal.principalId).delete(),
      minimizeInstallationProfileForDeletion(db, installationPrincipal),
    ]);
    await getAuth().deleteUser(userId).catch((error: unknown) => {
      const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
      if (code !== 'auth/user-not-found') throw error;
    });
    logger.info('User data deleted');
    return { deleted: true, revenueCatDeletionPending };
  } catch (error) {
    logger.error('User data deletion failed', safeErrorDescriptor(error));
    throw new HttpsError('internal', 'Datele nu au putut fi șterse acum. Încearcă din nou.');
  }
});

export const retryRevenueCatDeletions = revenueCatSecrets ? onSchedule({
  region: 'europe-west1',
  serviceAccount: DATA_RUNTIME_SERVICE_ACCOUNT,
  schedule: 'every day 04:15',
  timeZone: 'Europe/Bucharest',
  memory: '256MiB',
  timeoutSeconds: 300,
  secrets: [revenueCatSecrets.apiKey],
}, async () => {
  const snapshot = await db.collection('_pendingRevenueCatDeletions')
    .where('nextAttemptAt', '<=', Timestamp.now())
    .limit(100)
    .get();
  let completed = 0;
  let deferred = 0;
  for (const document of snapshot.docs) {
    const appUserId = document.data().appUserId;
    if (typeof appUserId !== 'string' || appUserId !== document.id || !/^[gi]_[a-f0-9]{64}$/.test(appUserId)) {
      await document.ref.delete();
      continue;
    }
    try {
      await deleteRevenueCatCustomer(appUserId, revenueCatSecrets.apiKey.value());
      await document.ref.delete();
      completed += 1;
    } catch {
      const attempts = typeof document.data().attempts === 'number' ? document.data().attempts + 1 : 1;
      await document.ref.set({
        attempts,
        updatedAt: FieldValue.serverTimestamp(),
        nextAttemptAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
      }, { merge: true });
      deferred += 1;
    }
  }
  logger.info('RevenueCat deletion retry completed', { inspected: snapshot.size, completed, deferred });
}) : undefined;

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
  const [requests, legacyUsage, commercialProfiles, commercialUsage, commercialReservations, commercialEntitlements, commercialGlobal, commercialEvents, mergeTickets, lessons, feedback, feedbackRateLimits] = await Promise.all([
    deleteQueryInBatches(db.collection('_analysisRequests').where('expiresAt', '<=', now)),
    deleteQueryInBatches(db.collection('_aiUsage').where('expiresAt', '<=', now)),
    deleteQueryInBatches(db.collection('_commercialUsers').where('expiresAt', '<=', now)),
    deleteQueryInBatches(db.collection('_commercialUsage').where('expiresAt', '<=', now)),
    deleteQueryInBatches(db.collection('_commercialReservations').where('expiresAt', '<=', now)),
    deleteQueryInBatches(db.collection('_commercialEntitlements').where('retentionExpiresAt', '<=', now)),
    deleteQueryInBatches(db.collection('_commercialGlobal').where('expiresAt', '<=', now)),
    deleteQueryInBatches(db.collection('_commercialEvents').where('expiresAt', '<=', now)),
    deleteQueryInBatches(db.collection('_accountMergeTickets').where('expiresAt', '<=', now)),
    deleteQueryInBatches(db.collectionGroup('lessons').where('expiresAt', '<=', now)),
    deleteQueryInBatches(db.collection('feedback').where('expiresAt', '<=', now)),
    deleteQueryInBatches(db.collection('_feedbackRateLimits').where('expiresAt', '<=', now)),
  ]);
  logger.info('Expired data cleaned', {
    requests,
    legacyUsage,
    commercialProfiles,
    commercialUsage,
    commercialReservations,
    commercialEntitlements,
    commercialGlobal,
    commercialEvents,
    mergeTickets,
    lessons,
    feedback,
    feedbackRateLimits,
  });
});
