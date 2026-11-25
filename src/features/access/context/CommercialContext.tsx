import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getApp } from '@react-native-firebase/app';
import { getAuth, onIdTokenChanged, type User } from '@react-native-firebase/auth';
import { AppState } from 'react-native';
import type { CommercialAccess, CommercialStatus } from '../../../shared/types';
import { connectWithGoogle, disconnectGoogleAccount, getCommercialAccess } from '../services/commercial';
import { preparePlayIntegrity } from '../../../shared/services/deviceIntegrity';
import { recordDiagnosticError } from '../../../shared/services/diagnostics';
import { deleteAllUserData, type DataDeletionResult } from '../../account/services/dataManagement';
import { firebaseUserSessionKey, resetFirebaseInitialization } from '../../../shared/services/firebase';
import { clearFavoriteLessonsCache, prewarmFavoriteLessonsCache } from '../../lessons/services/lessons';
import { clearExamLocalState } from '../../exams/services/examStorage';
import { clearPracticeLocalState } from '../../practice/services/practiceStorage';
import { clearStudyLocalState } from '../../study/services/studyStorage';
import {
  retryStudyProgressSyncIfNeeded,
  startStudyProgressSync,
  stopStudyProgressSync,
} from '../../study/services/studySync';
import { discardPendingAnalysis } from '../../analysis/services/pendingAnalysis';
import { clearMathDrafts } from '../../math/services/mathDraft';
import { invalidateSessionOperations } from '../../../shared/services/sessionGuard';
import { resetPurchasesForSignedOutUser } from '../services/purchases';
import {
  createCommercialExpiryMonitor,
  isCommercialAccessExpired,
  isCurrentCommercialRefreshGeneration,
  shouldAutomaticallyRefreshCommercialAccess,
} from '../services/commercialRefreshPolicy';

type CommercialContextValue = {
  authSessionKey: string | null;
  identity: CommercialAccess['identity'] | null;
  access: CommercialAccess | null;
  startupReady: boolean;
  status: CommercialStatus;
  loading: boolean;
  refreshing: boolean;
  identityTransitionBusy: boolean;
  refresh: () => Promise<CommercialAccess | null>;
  refreshIfStale: () => Promise<CommercialAccess | null>;
  applyServerAccess: (access: CommercialAccess) => void;
  connectGoogle: () => Promise<CommercialAccess | null>;
  disconnectGoogle: () => Promise<CommercialAccess | null>;
  deleteAccount: () => Promise<DataDeletionResult>;
};

const CommercialContext = createContext<CommercialContextValue | null>(null);

type RefreshRequest = {
  generation: number;
  promise: Promise<CommercialAccess | null>;
};

const DISCONNECT_SETTLE_WAIT_MS = 3_500;

function identityFromUser(user: User | null): CommercialAccess['identity'] | null {
  if (!user) return null;
  return !user.isAnonymous && user.providerData.some((provider) => provider.providerId === 'google.com')
    ? 'google'
    : 'anonymous';
}

function settleWithin<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<{ done: true; value: T } | { done: false; value: null }> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ done: false, value: null });
    }, timeoutMs);
    promise.then((value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ done: true, value });
    }).catch(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ done: true, value: null as T });
    });
  });
}

export function CommercialProvider({ children, initialAccess = null, initialVerifiedAt = 0, initiallyOffline = false }: {
  children: ReactNode;
  initialAccess?: CommercialAccess | null;
  initialVerifiedAt?: number;
  initiallyOffline?: boolean;
}) {
  const [authSessionKey, setAuthSessionKey] = useState(() => firebaseUserSessionKey(getAuth(getApp()).currentUser));
  const [identity, setIdentity] = useState<CommercialAccess['identity'] | null>(() => identityFromUser(getAuth(getApp()).currentUser));
  const observedSessionKey = useRef(authSessionKey);
  const observedUserId = useRef(getAuth(getApp()).currentUser?.uid);
  const [access, setAccess] = useState<CommercialAccess | null>(initialAccess);
  const [startupReady, setStartupReady] = useState(Boolean(initialAccess));
  const [status, setStatus] = useState<CommercialStatus>(initialAccess ? 'ready' : initiallyOffline ? 'unavailable' : 'resolving');
  const [refreshing, setRefreshing] = useState(false);
  const [identityTransitionBusy, setIdentityTransitionBusy] = useState(false);
  const accessRef = useRef<CommercialAccess | null>(initialAccess);
  const refreshInFlight = useRef<RefreshRequest | null>(null);
  const lastSuccessfulRefreshAt = useRef(initialAccess ? initialVerifiedAt : 0);
  const identityGeneration = useRef(0);
  const identityTransitionInFlight = useRef<Promise<CommercialAccess | null> | null>(null);
  const accountDeletionInFlight = useRef<Promise<DataDeletionResult> | null>(null);
  const identityTransitionActive = useRef(false);
  const expiryMonitor = useRef<ReturnType<typeof createCommercialExpiryMonitor> | null>(null);

  const markStartupReady = useCallback(() => setStartupReady(true), []);

  const syncAuthUiState = useCallback((user: User | null, overrideSessionKey?: string | null) => {
    const nextSessionKey = overrideSessionKey !== undefined ? overrideSessionKey : firebaseUserSessionKey(user);
    const nextIdentity = overrideSessionKey === null ? null : identityFromUser(user);
    observedSessionKey.current = nextSessionKey;
    observedUserId.current = user?.uid;
    setIdentity(nextIdentity);
    setAuthSessionKey(nextSessionKey);
  }, []);

  const applyServerAccess = useCallback((next: CommercialAccess) => {
    // A request started just before midnight may arrive after its window ends.
    // Keep that exhausted snapshot out of the UI; the monitor asks the server
    // for the current day instead of inventing a fresh allowance locally.
    const expired = isCommercialAccessExpired(next, Date.now());
    accessRef.current = next;
    lastSuccessfulRefreshAt.current = Date.now();
    setAccess(expired ? null : next);
    setStatus(expired ? 'resolving' : 'ready');
    expiryMonitor.current?.reschedule();
    markStartupReady();
  }, [markStartupReady]);

  const clearAccessForIdentityChange = useCallback((nextStatus: CommercialStatus = 'resolving') => {
    expiryMonitor.current?.reset();
    accessRef.current = null;
    lastSuccessfulRefreshAt.current = 0;
    setAccess(null);
    setStatus(nextStatus);
  }, []);

  const refresh = useCallback((): Promise<CommercialAccess | null> => {
    const generation = identityGeneration.current;
    const activeRequest = refreshInFlight.current;
    if (activeRequest?.generation === generation) return activeRequest.promise;

    setRefreshing(true);
    if (!accessRef.current) setStatus('resolving');
    const request = getCommercialAccess()
      .then((next) => {
        if (!isCurrentCommercialRefreshGeneration(generation, identityGeneration.current)) return null;
        // Commit auth identity, session key and authoritative server access in
        // one synchronous turn so React renders the transition atomically.
        syncAuthUiState(getAuth(getApp()).currentUser);
        applyServerAccess(next);
        return next;
      })
      .catch((error) => {
        if (isCurrentCommercialRefreshGeneration(generation, identityGeneration.current)) {
          recordDiagnosticError('commercial_access', error);
          if (!accessRef.current) setStatus('unavailable');
          markStartupReady();
        }
        return null;
      })
      .finally(() => {
        if (refreshInFlight.current?.promise === request) {
          refreshInFlight.current = null;
          setRefreshing(false);
        }
      });
    refreshInFlight.current = { generation, promise: request };
    return request;
  }, [applyServerAccess, markStartupReady, syncAuthUiState]);

  const refreshIfStale = useCallback((): Promise<CommercialAccess | null> => {
    if (initiallyOffline && !accessRef.current) return Promise.resolve(null);
    if (!shouldAutomaticallyRefreshCommercialAccess({
      now: Date.now(),
      lastSuccessfulRefreshAt: lastSuccessfulRefreshAt.current,
      identityTransitionActive: identityTransitionActive.current,
      access: accessRef.current,
    })) {
      return Promise.resolve(accessRef.current);
    }
    return refresh();
  }, [initiallyOffline, refresh]);

  useEffect(() => {
    const monitor = createCommercialExpiryMonitor({
      getAccess: () => accessRef.current,
      canRefresh: () => !identityTransitionActive.current && AppState.currentState === 'active',
      invalidateExpiredAccess: () => {
        accessRef.current = null;
        lastSuccessfulRefreshAt.current = 0;
        setAccess(null);
        setStatus('resolving');
      },
      refresh,
    });
    expiryMonitor.current = monitor;
    monitor.check();
    return () => {
      monitor.dispose();
      if (expiryMonitor.current === monitor) expiryMonitor.current = null;
    };
  }, [refresh]);

  useEffect(() => onIdTokenChanged(getAuth(getApp()), (user) => {
    const nextSessionKey = firebaseUserSessionKey(user);
    if (nextSessionKey === observedSessionKey.current) return;
    const previousUserId = observedUserId.current;
    observedSessionKey.current = nextSessionKey;
    observedUserId.current = user?.uid;
    clearFavoriteLessonsCache();
    if (previousUserId !== user?.uid) {
      discardPendingAnalysis();
      clearMathDrafts();
    }
    if (identityTransitionActive.current) {
      // An explicit connect/disconnect/delete transition is in flight and will
      // commit identity, session key and server access atomically once ready.
      return;
    }
    if (previousUserId && previousUserId !== user?.uid) {
      stopStudyProgressSync();
      clearStudyLocalState();
      clearPracticeLocalState();
      clearExamLocalState();
    }
    invalidateSessionOperations();
    identityGeneration.current += 1;
    refreshInFlight.current = null;
    setRefreshing(false);
    void resetPurchasesForSignedOutUser().catch((error) => recordDiagnosticError('purchases_identity', error));
    resetFirebaseInitialization();
    clearAccessForIdentityChange();
    syncAuthUiState(user);
    void refresh();
  }), [clearAccessForIdentityChange, refresh, syncAuthUiState]);

  useEffect(() => {
    if (initiallyOffline) return;
    // Launch already fetched this snapshot. Do not immediately fetch it again.
    if (!accessRef.current) void refreshIfStale();
    if (accessRef.current?.deviceRecall.shouldVerify) {
      void preparePlayIntegrity().catch((error) => recordDiagnosticError('commercial_initialization', error));
    }
  }, [initiallyOffline, refreshIfStale]);

  useEffect(() => {
    // Prewarm notebook cache right as CommercialProvider mounts behind LaunchSplash
    // so saved lessons and badges are already ready before Home reveals.
    if (!authSessionKey) return;
    void prewarmFavoriteLessonsCache().catch((error) => recordDiagnosticError('notebook_prewarm', error));
  }, [authSessionKey]);

  useEffect(() => {
    // Own study/practice cloud sync above NavigationContainer (never frozen on
    // blur) so connecting or disconnecting Google in Settings/Paywall updates
    // track, favorite formulas, streak, and repeat queue immediately.
    if (!authSessionKey) {
      stopStudyProgressSync();
      return undefined;
    }
    return startStudyProgressSync();
  }, [authSessionKey]);

  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', (next) => {
      const returningToForeground = (previous === 'background' || previous === 'inactive') && next === 'active';
      previous = next;
      // Credential Manager temporarily backgrounds Android while its Activity
      // is visible. The identity operation performs one authoritative refresh
      // itself, so an automatic refresh here would race the old account.
      if (returningToForeground && !identityTransitionActive.current) {
        expiryMonitor.current?.check();
        retryStudyProgressSyncIfNeeded();
        void refreshIfStale();
      }
    });
    return () => subscription.remove();
  }, [refreshIfStale]);

  const connectGoogle = useCallback((): Promise<CommercialAccess | null> => {
    if (identityTransitionInFlight.current) return identityTransitionInFlight.current;
    if (accountDeletionInFlight.current) {
      return Promise.reject(new Error('Așteaptă finalizarea ștergerii contului.'));
    }
    const previousSessionKey = firebaseUserSessionKey(getAuth(getApp()).currentUser);
    identityTransitionActive.current = true;
    setIdentityTransitionBusy(true);
    invalidateSessionOperations();
    identityGeneration.current += 1;
    refreshInFlight.current = null;
    setRefreshing(false);

    const operation = connectWithGoogle()
      .then(async (user) => {
        if (!user) return null;
        const next = await refresh();
        if (!next) {
          const current = getAuth(getApp()).currentUser ?? user;
          if (firebaseUserSessionKey(current) !== previousSessionKey || identityFromUser(current) === 'google') {
            syncAuthUiState(current);
            clearAccessForIdentityChange('unavailable');
          }
        }
        return next;
      })
      .catch(async (error) => {
        const current = getAuth(getApp()).currentUser;
        if (firebaseUserSessionKey(current) !== previousSessionKey) {
          const next = await refresh();
          const active = getAuth(getApp()).currentUser ?? current;
          if (!next) {
            syncAuthUiState(active);
            clearAccessForIdentityChange('unavailable');
          }
          // Firebase Auth already switched to Google; never surface a false
          // sign-in failure banner over an authenticated account.
          if (identityFromUser(active) === 'google') {
            recordDiagnosticError('google_connect', error);
            return next;
          }
        }
        throw error;
      })
      .finally(() => {
        if (identityTransitionInFlight.current === operation) {
          identityTransitionInFlight.current = null;
          identityTransitionActive.current = false;
          setIdentityTransitionBusy(false);
        }
      });
    identityTransitionInFlight.current = operation;
    return operation;
  }, [clearAccessForIdentityChange, refresh, syncAuthUiState]);

  const disconnectGoogle = useCallback((): Promise<CommercialAccess | null> => {
    if (identityTransitionInFlight.current) return identityTransitionInFlight.current;
    if (accountDeletionInFlight.current) {
      return Promise.reject(new Error('Așteaptă finalizarea ștergerii contului.'));
    }
    const previousSessionKey = firebaseUserSessionKey(getAuth(getApp()).currentUser);
    identityTransitionActive.current = true;
    setIdentityTransitionBusy(true);
    invalidateSessionOperations();
    identityGeneration.current += 1;
    refreshInFlight.current = null;
    setRefreshing(false);

    const operation = disconnectGoogleAccount()
      .then(async (user) => {
        // Local sign-out already succeeded. Wait briefly for the replacement
        // anonymous session and fresh guest quota so the UI swaps atomically in
        // one frame without trapping the user if the device is offline.
        const guestRefresh = refresh();
        const settled = await settleWithin(guestRefresh, DISCONNECT_SETTLE_WAIT_MS);
        if (settled.done && settled.value) {
          return settled.value;
        }
        const current = getAuth(getApp()).currentUser ?? user;
        if (!current || firebaseUserSessionKey(current) !== previousSessionKey) {
          syncAuthUiState(current);
          clearAccessForIdentityChange(settled.done ? 'unavailable' : 'resolving');
        }
        return null;
      })
      .catch(async (error) => {
        const current = getAuth(getApp()).currentUser;
        if (firebaseUserSessionKey(current) !== previousSessionKey) {
          const next = await refresh();
          if (!next) {
            syncAuthUiState(getAuth(getApp()).currentUser);
            clearAccessForIdentityChange('unavailable');
          }
        }
        throw error;
      })
      .finally(() => {
        if (identityTransitionInFlight.current === operation) {
          identityTransitionInFlight.current = null;
          identityTransitionActive.current = false;
          setIdentityTransitionBusy(false);
        }
      });
    identityTransitionInFlight.current = operation;
    return operation;
  }, [clearAccessForIdentityChange, refresh, syncAuthUiState]);

  const deleteAccount = useCallback((): Promise<DataDeletionResult> => {
    if (accountDeletionInFlight.current) return accountDeletionInFlight.current;
    if (identityTransitionInFlight.current) {
      return Promise.reject(new Error('Așteaptă finalizarea schimbării de cont înainte de ștergere.'));
    }
    const previousSessionKey = firebaseUserSessionKey(getAuth(getApp()).currentUser);
    identityTransitionActive.current = true;
    setIdentityTransitionBusy(true);
    invalidateSessionOperations();
    identityGeneration.current += 1;
    refreshInFlight.current = null;
    setRefreshing(false);

    const operation = deleteAllUserData()
      .then((result) => {
        // The remote deletion is already definitive. Clear every trace of the
        // deleted identity immediately; a failed guest refresh is only an
        // offline/retry state and cannot turn deletion into a reported failure.
        syncAuthUiState(
          result.localSignOutPending ? null : getAuth(getApp()).currentUser,
          result.localSignOutPending ? null : undefined,
        );
        clearAccessForIdentityChange();
        void refresh();
        return result;
      })
      .catch(async (error) => {
        const current = getAuth(getApp()).currentUser;
        if (firebaseUserSessionKey(current) !== previousSessionKey) {
          const next = await refresh();
          if (!next) {
            syncAuthUiState(getAuth(getApp()).currentUser);
            clearAccessForIdentityChange('unavailable');
          }
        }
        throw error;
      })
      .finally(() => {
        if (accountDeletionInFlight.current === operation) {
          accountDeletionInFlight.current = null;
          identityTransitionActive.current = false;
          setIdentityTransitionBusy(false);
        }
      });
    accountDeletionInFlight.current = operation;
    return operation;
  }, [clearAccessForIdentityChange, refresh, syncAuthUiState]);

  const value = useMemo(
    () => ({
      authSessionKey,
      identity,
      access,
      startupReady,
      status,
      loading: status === 'resolving',
      refreshing,
      identityTransitionBusy,
      refresh,
      refreshIfStale,
      applyServerAccess,
      connectGoogle,
      disconnectGoogle,
      deleteAccount,
    }),
    [access, applyServerAccess, authSessionKey, connectGoogle, deleteAccount, disconnectGoogle, identity, identityTransitionBusy, refresh, refreshIfStale, refreshing, startupReady, status],
  );
  return <CommercialContext.Provider value={value}>{children}</CommercialContext.Provider>;
}

export function useCommercial(): CommercialContextValue {
  const value = useContext(CommercialContext);
  if (!value) throw new Error('useCommercial trebuie folosit în CommercialProvider.');
  return value;
}
