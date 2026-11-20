import type { CommercialAccess } from '../../shared/types';
import type { PendingAnalysis } from '../../features/analysis/services/pendingAnalysis';
import { isCommercialAccessExpired } from '../../features/access/services/commercialRefreshPolicy.ts';
import { withDeadline } from '../../shared/utils/latestTask.ts';

type Session = { key: string; userId: string };

export type StartupSnapshot = {
  initialAccess: CommercialAccess;
  pendingAnalysis: PendingAnalysis | null;
  sessionKey: string;
  verifiedAt: number;
  timings: { visuals: number; session: number; account: number; total: number };
};

type Dependencies = {
  prepareVisuals: () => Promise<void>;
  initializeSession: () => Promise<unknown>;
  loadAccess: () => Promise<CommercialAccess>;
  loadPendingAnalysis: () => Promise<PendingAnalysis | null>;
  currentSession: () => Session | null;
  now?: () => number;
};

export class StartupError extends Error {
  readonly code: string;
  readonly stage: 'visuals' | 'session' | 'account' | 'timeout';
  constructor(stage: StartupError['stage'], cause: unknown) {
    super(`Application preparation failed: ${stage}`, { cause });
    this.name = 'StartupError';
    this.stage = stage;
    this.code = `startup/${stage}`;
  }
}

/** One launch request; success requires real account data and every shared asset. */
export function createStartupLoader(dependencies: Dependencies, timeoutMs = 15_000) {
  let pending: Promise<StartupSnapshot> | null = null;
  const now = dependencies.now ?? Date.now;

  return function prepare(): Promise<StartupSnapshot> {
    if (pending) return pending;
    const startedAt = now();
    const timings = { visuals: 0, session: 0, account: 0, total: 0 };
    const measure = async <T>(stage: 'visuals' | 'session' | 'account', operation: () => Promise<T>): Promise<T> => {
      const started = now();
      try { return await operation(); }
      catch (error) { throw new StartupError(stage, error); }
      finally { timings[stage] = now() - started; }
    };

    const visuals = measure('visuals', dependencies.prepareVisuals);
    const session = measure('session', dependencies.initializeSession);
    const account = session.then(() => measure('account', async () => {
      const owner = dependencies.currentSession();
      if (!owner) throw Error('Session unavailable before access verification.');
      const access = await dependencies.loadAccess();
      if (dependencies.currentSession()?.key !== owner.key) throw Error('Identity changed during access verification.');
      return { access, owner, verifiedAt: now() };
    }));
    const analysis = session.then(dependencies.loadPendingAnalysis);
    const work = Promise.all([visuals, account, analysis]).then(([, verified, pendingAnalysis]) => {
      const current = dependencies.currentSession();
      if (current?.key !== verified.owner.key) throw new StartupError('session', Error('Identity changed during launch.'));
      if (isCommercialAccessExpired(verified.access, now())) throw new StartupError('account', Error('Access expired during launch.'));
      timings.total = now() - startedAt;
      return {
        initialAccess: verified.access,
        pendingAnalysis: pendingAnalysis?.userId === current.userId ? pendingAnalysis : null,
        sessionKey: current.key,
        verifiedAt: verified.verifiedAt,
        timings,
      };
    });
    const operation = withDeadline(work, timeoutMs, 'Application preparation timed out.')
      .catch((error: unknown) => { throw error instanceof StartupError ? error : new StartupError('timeout', error); })
      .finally(() => { if (pending === operation) pending = null; });
    pending = operation;
    return operation;
  };
}
