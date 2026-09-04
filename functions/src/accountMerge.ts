import { randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import {
  FieldPath,
  FieldValue,
  type Firestore,
  type Query,
  Timestamp,
} from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { bucharestQuotaWindow, COMMERCIAL_PROFILE_RETENTION_MS, getCommercialConfig } from './commercialAccess.js';
import { isCommercialPrincipalId } from './commercialIdentity.js';

// Account selection can outlive a short callable timeout or an app restart.
// Keep the signed, installation-bound handoff recoverable without forcing the
// user to lose the anonymous notebook after Google authentication succeeds.
const MERGE_TICKET_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const COMPLETED_TICKET_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function numeric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function mergeConsumedUsage(
  targetUsed: unknown,
  targetRequestIds: unknown,
  sourceTodayRequestIds: unknown,
  limit: number,
): { used: number; requestIds: string[] } {
  const targetIds = stringArray(targetRequestIds);
  const sourceIds = stringArray(sourceTodayRequestIds);
  const requestIds = [...new Set([...targetIds, ...sourceIds])].slice(-limit);
  const uniqueSourceAdds = sourceIds.filter((value) => !targetIds.includes(value)).length;
  return {
    used: Math.min(limit, Math.max(numeric(targetUsed), targetIds.length) + uniqueSourceAdds),
    requestIds,
  };
}

export async function createAccountMergeTicket(
  db: Firestore,
  sourceUserId: string,
  sourcePrincipalId: string,
  now = Date.now(),
): Promise<string> {
  if (!isCommercialPrincipalId(sourcePrincipalId) || !sourcePrincipalId.startsWith('i_')) {
    throw new HttpsError('failed-precondition', 'Identitatea instalării nu este validă.');
  }
  const newTicket = randomUUID();
  const profileRef = db.collection('_commercialUsers').doc(sourcePrincipalId);
  return db.runTransaction(async (transaction) => {
    const profile = await transaction.get(profileRef);
    const activeTicket = typeof profile.data()?.activeMergeTicket === 'string'
      ? profile.data()?.activeMergeTicket as string
      : null;
    const activeExpiry = profile.data()?.activeMergeExpiresAt instanceof Timestamp
      ? profile.data()?.activeMergeExpiresAt.toMillis()
      : 0;
    if (activeTicket && activeExpiry > now && /^[a-f0-9-]{36}$/i.test(activeTicket)) {
      const activeSnapshot = await transaction.get(db.collection('_accountMergeTickets').doc(activeTicket));
      if (activeSnapshot.data()?.sourceUserId === sourceUserId
        && activeSnapshot.data()?.sourcePrincipalId === sourcePrincipalId
        && activeSnapshot.data()?.state === 'issued') {
        return activeTicket;
      }
    }

    const expiresAt = Timestamp.fromMillis(now + MERGE_TICKET_LIFETIME_MS);
    transaction.create(db.collection('_accountMergeTickets').doc(newTicket), {
      sourceUserId,
      sourcePrincipalId,
      state: 'issued',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt,
    });
    transaction.set(profileRef, {
      userId: sourceUserId,
      principalId: sourcePrincipalId,
      activeMergeTicket: newTicket,
      activeMergeExpiresAt: expiresAt,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(now + COMMERCIAL_PROFILE_RETENTION_MS),
    }, { merge: true });
    return newTicket;
  });
}

async function copyLessons(db: Firestore, sourceUserId: string, targetUserId: string): Promise<number> {
  const source = db.collection('users').doc(sourceUserId).collection('lessons');
  const target = db.collection('users').doc(targetUserId).collection('lessons');
  let copied = 0;
  let lastId: string | null = null;

  while (true) {
    let query = source.orderBy(FieldPath.documentId()).limit(200);
    if (lastId) query = query.startAfter(lastId);
    const snapshot = await query.get();
    if (snapshot.empty) return copied;
    const targetRefs = snapshot.docs.map((document) => target.doc(document.id));
    const targetSnapshots = await db.getAll(...targetRefs);
    const batch = db.batch();
    snapshot.docs.forEach((document, index) => {
      if (!targetSnapshots[index].exists) {
        batch.set(targetRefs[index], document.data());
        copied += 1;
      }
    });
    await batch.commit();
    lastId = snapshot.docs.at(-1)?.id ?? null;
    if (snapshot.size < 200) return copied;
  }
}

async function reassignFeedback(db: Firestore, sourceUserId: string, targetUserId: string): Promise<number> {
  let updated = 0;
  while (true) {
    const snapshot = await db.collection('feedback').where('userId', '==', sourceUserId).limit(400).get();
    if (snapshot.empty) return updated;
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.update(document.ref, { userId: targetUserId }));
    await batch.commit();
    updated += snapshot.size;
  }
}

async function deleteQueryInBatches(db: Firestore, query: Query): Promise<void> {
  while (true) {
    const snapshot = await query.limit(400).get();
    if (snapshot.empty) return;
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

export async function cleanupMergedSource(db: Firestore, sourceUserId: string): Promise<void> {
  await Promise.all([
    db.recursiveDelete(db.collection('users').doc(sourceUserId)),
    deleteQueryInBatches(db, db.collection('_analysisRequests').where('userId', '==', sourceUserId)),
    deleteQueryInBatches(db, db.collection('_commercialReservations').where('userId', '==', sourceUserId)),
  ]);
  await getAuth().deleteUser(sourceUserId).catch((error: unknown) => {
    const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
    if (code !== 'auth/user-not-found') throw error;
  });
}

export async function completeAccountMerge(args: {
  db: Firestore;
  ticket: string;
  targetUserId: string;
  targetPrincipalId: string;
  expectedSourcePrincipalId: string;
  now?: number;
}): Promise<{ merged: true; copiedLessons: number }> {
  const now = args.now ?? Date.now();
  if (!isCommercialPrincipalId(args.targetPrincipalId) || !args.targetPrincipalId.startsWith('g_')) {
    throw new HttpsError('failed-precondition', 'Identitatea Google nu este validă.');
  }
  if (!isCommercialPrincipalId(args.expectedSourcePrincipalId) || !args.expectedSourcePrincipalId.startsWith('i_')) {
    throw new HttpsError('failed-precondition', 'Identitatea instalării nu este validă.');
  }
  const ticketRef = args.db.collection('_accountMergeTickets').doc(args.ticket);
  const ticketSnapshot = await ticketRef.get();
  const ticket = ticketSnapshot.data();
  const sourceUserId = typeof ticket?.sourceUserId === 'string' ? ticket.sourceUserId : null;
  const sourcePrincipalId = typeof ticket?.sourcePrincipalId === 'string' ? ticket.sourcePrincipalId : null;
  if (!sourceUserId || sourcePrincipalId !== args.expectedSourcePrincipalId) {
    throw new HttpsError('failed-precondition', 'Legătura dintre conturi nu este validă.');
  }
  const keepsSameUser = sourceUserId === args.targetUserId;
  const expiresAt = ticket?.expiresAt instanceof Timestamp ? ticket.expiresAt.toMillis() : 0;
  if (ticket?.state === 'issued' && expiresAt < now) {
    throw new HttpsError('deadline-exceeded', 'Conectarea a expirat. Încearcă din nou.');
  }
  if (ticket?.state === 'completed' && ticket?.targetUserId !== args.targetUserId) {
    throw new HttpsError('permission-denied', 'Această legătură a fost deja folosită.');
  }

  await args.db.runTransaction(async (transaction) => {
    const current = await transaction.get(ticketRef);
    const data = current.data();
    if (data?.sourceUserId !== sourceUserId || data?.sourcePrincipalId !== args.expectedSourcePrincipalId) {
      throw new HttpsError('failed-precondition', 'Legătura dintre conturi nu este validă.');
    }
    if (data?.state === 'completed') return;
    if (data?.state === 'merging' && data?.targetUserId !== args.targetUserId) {
      throw new HttpsError('aborted', 'Conturile sunt deja în curs de conectare.');
    }
    transaction.update(ticketRef, {
      state: 'merging',
      targetUserId: args.targetUserId,
      targetPrincipalId: args.targetPrincipalId,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(now + MERGE_TICKET_LIFETIME_MS),
    });
  });

  const copiedLessons = keepsSameUser ? 0 : await copyLessons(args.db, sourceUserId, args.targetUserId);
  if (!keepsSameUser) await reassignFeedback(args.db, sourceUserId, args.targetUserId);

  const commercialConfig = await getCommercialConfig(args.db, now);
  const window = bucharestQuotaWindow(now);
  const sourceProfileRef = args.db.collection('_commercialUsers').doc(sourcePrincipalId);
  const targetProfileRef = args.db.collection('_commercialUsers').doc(args.targetPrincipalId);
  const targetDailyRef = args.db.collection('_commercialUsage').doc(`${args.targetPrincipalId}_${window.day}`);
  const targetEntitlementRef = args.db.collection('_commercialEntitlements').doc(args.targetPrincipalId);

  await args.db.runTransaction(async (transaction) => {
    const [currentTicket, sourceProfile, targetDaily, targetEntitlement] = await Promise.all([
      transaction.get(ticketRef),
      transaction.get(sourceProfileRef),
      transaction.get(targetDailyRef),
      transaction.get(targetEntitlementRef),
    ]);
    const data = currentTicket.data();
    if (data?.targetUserId !== args.targetUserId || !['merging', 'completed'].includes(data?.state)) {
      throw new HttpsError('aborted', 'Legătura dintre conturi nu mai este validă.');
    }
    if (data.state === 'completed') return;

    const entitlementData = targetEntitlement.data();
    const entitlementExpiry = entitlementData?.expiresAt instanceof Timestamp ? entitlementData.expiresAt.toMillis() : null;
    const premiumActive = entitlementData?.active === true && (entitlementExpiry === null || entitlementExpiry > now);
    const dailyLimit = premiumActive ? commercialConfig.premiumDailyLimit : commercialConfig.freeDailyLimit;
    const targetUsed = numeric(targetDaily.data()?.requests);
    const sourceTodayRequestIds = sourceProfile.data()?.welcomeTodayDay === window.day
      ? stringArray(sourceProfile.data()?.welcomeTodayRequestIds)
      : [];
    const merged = mergeConsumedUsage(
      targetUsed,
      targetDaily.data()?.requestIds,
      sourceTodayRequestIds,
      dailyLimit,
    );

    transaction.set(targetDailyRef, {
      principalId: args.targetPrincipalId,
      day: window.day,
      requests: merged.used,
      requestIds: merged.requestIds,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(now + 35 * 24 * 60 * 60 * 1000),
    }, { merge: true });
    transaction.set(targetProfileRef, {
      userId: args.targetUserId,
      principalId: args.targetPrincipalId,
      mergedAnonymousAccountAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(now + COMMERCIAL_PROFILE_RETENTION_MS),
    }, { merge: true });
    transaction.set(sourceProfileRef, {
      userId: sourceUserId,
      principalId: sourcePrincipalId,
      welcomeLocked: FieldValue.delete(),
      linkedAccountPrincipalId: args.targetPrincipalId,
      activeMergeTicket: FieldValue.delete(),
      activeMergeExpiresAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(now + COMMERCIAL_PROFILE_RETENTION_MS),
    }, { merge: true });
    transaction.update(ticketRef, {
      state: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(now + COMPLETED_TICKET_RETENTION_MS),
    });
  });

  if (!keepsSameUser) await cleanupMergedSource(args.db, sourceUserId);
  return { merged: true, copiedLessons };
}
