import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getApp } from '@react-native-firebase/app';
import { getAuth, onIdTokenChanged } from '@react-native-firebase/auth';
import { AppState } from 'react-native';
import type { CommercialAccess, CommercialStatus } from '../../../shared/types';
import { connectWithGoogle, disconnectGoogleAccount, getCommercialAccess } from '../services/commercial';
import { preparePlayIntegrity } from '../../../shared/services/deviceIntegrity';
import { recordDiagnosticError } from '../../../shared/services/diagnostics';
import { deleteAllUserData, type DataDeletionResult } from '../../account/services/dataManagement';
import { firebaseUserSessionKey, resetFirebaseInitialization } from '../../../shared/services/firebase';
import { clearFavoriteLessonsCache, prewarmFavoriteLessonsCache } from '../../lessons/services/lessons';
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

export function CommercialProvider({ children, initialAccess = null, initialVerifiedAt = 0, initiallyOffline = false }: {
  children: ReactNode;
  initialAccess?: CommercialAccess | null;
  initialVerifiedAt?: number;
  initiallyOffline?: boolean;
}) {
  const [authSessionKey, setAuthSessionKey] = useState(() => firebaseUserSessionKey(getAuth(getApp()).currentUser));
  const [identity, setIdentity] = useState<CommercialAccess['identity'] | null>(() => {
    const user = getAuth(getApp()).currentUser;
    return user ? (!user.isAnonymous && user.providerData.some((provider) => provider.providerId === 'google.com') ? 'google' : 'anonymous') : null;
  });
  const observedSessionKey = useRef(authSessionKey);
  const observedUserId = useRef(getAuth(getApp()).currentUser?.uid);
  const [access, setAccess] = useState<CommercialAccess | null>(initialAccess);
  const [startupReady, setStartupReady] = useState(Boolean(initialAccess));
  const [status, setStatus] = useState<CommercialStatus>(initialAccess ? 'ready' : initiallyOffline ? 'unavailable' : 'resolving');
  const [refreshing, setRefreshing] = useState(false);
  const accessRef = useRef<CommercialAccess | null>(initialAccess);
  const refreshInFlight = useRef<RefreshRequest | null>(null);
  const lastSuccessfulRefreshAt = useRef(initialAccess ? initialVerifiedAt : 0);
  const identityGeneration = useRef(0);
  const identityTransitionInFlight = useRef<Promise<CommercialAccess | null> | null>(null);
  const accountDeletionInFlight = useRef<Promise<DataDeletionResult> | null>(null);
  const identityTransitionActive = useRef(false);
  const expiryMonitor = useRef<ReturnType<typeof createCommercialExpiryMonitor> | null>(null);

  const markStartupReady = useCallback(() => setStartupReady(true), []);

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

  const clearAccessForIdentityChange = useCallback(() => {
    expiryMonitor.current?.reset();
    accessRef.current = null;
    lastSuccessfulRefreshAt.current = 0;
    setAccess(null);
    setStatus('resolving');
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
  }, [applyServerAccess, markStartupReady]);

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
    setIdentity(user ? (!user.isAnonymous && user.providerData.some((provider) => provider.providerId === 'google.com') ? 'google' : 'anonymous') : null);
    const previousUserId = observedUserId.current;
    observedSessionKey.current = nextSessionKey;
    observedUserId.current = user?.uid;
    if (!identityTransitionActive.current) {
      invalidateSessionOperations();
      identityGeneration.current += 1;
      refreshInFlight.current = null;
      setRefreshing(false);
    }
    clearFavoriteLessonsCache();
    if (previousUserId !== user?.uid) {
      discardPendingAnalysis();
      clearMathDrafts();
    }
    if (!identityTransitionActive.current) {
      void resetPurchasesForSignedOutUser().catch((error) => recordDiagnosticError('purchases_identity', error));
      resetFirebaseInitialization();
      clearAccessForIdentityChange();
    }
    setAuthSessionKey(nextSessionKey);
    if (!identityTransitionActive.current) void refresh();
  }), [clearAccessForIdentityChange, refresh]);

  useEffect(() => {
    if (initiallyOffline) return;
    // Launch already fetched this snapshot. Do not immediately fetch it again.
    if (!accessRef.current) void refreshIfStale();
    if (accessRef.current?.deviceRecall.shouldVerify) {
      void preparePlayIntegrity().catch((error) => recordDiagnosticError('commercial_initialization', error));
    }
  }, [initiallyOffline, refreshIfStale]);

  useEffect(() => {
    // The session-scoped listener also keeps later saves ready for the next visit.
    void prewarmFavoriteLessonsCache().catch((error) => recordDiagnosticError('notebook_prewarm', error));
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
    invalidateSessionOperations();
    identityGeneration.current += 1;
    refreshInFlight.current = null;
    setRefreshing(false);

    const operation = connectWithGoogle()
      .then((user) => {
        if (!user) return null;
        if (firebaseUserSessionKey(user) !== previousSessionKey) clearAccessForIdentityChange();
        return refresh();
      })
      .catch(async (error) => {
        const currentSessionKey = firebaseUserSessionKey(getAuth(getApp()).currentUser);
        if (currentSessionKey !== previousSessionKey) {
          clearAccessForIdentityChange();
          await refresh();
        }
        throw error;
      })
      .finally(() => {
        if (identityTransitionInFlight.current === operation) {
          identityTransitionInFlight.current = null;
          identityTransitionActive.current = false;
        }
      });
    identityTransitionInFlight.current = operation;
    return operation;
  }, [clearAccessForIdentityChange, refresh]);

  const disconnectGoogle = useCallback((): Promise<CommercialAccess | null> => {
    if (identityTransitionInFlight.current) return identityTransitionInFlight.current;
    if (accountDeletionInFlight.current) {
      return Promise.reject(new Error('Așteaptă finalizarea ștergerii contului.'));
    }
    const previousSessionKey = firebaseUserSessionKey(getAuth(getApp()).currentUser);
    identityTransitionActive.current = true;
    invalidateSessionOperations();
    identityGeneration.current += 1;
    refreshInFlight.current = null;
    setRefreshing(false);

    const operation = disconnectGoogleAccount()
      .then((user) => {
        if (!user || firebaseUserSessionKey(user) !== previousSessionKey) clearAccessForIdentityChange();
        void refresh();
        return null;
      })
      .catch(async (error) => {
        const currentSessionKey = firebaseUserSessionKey(getAuth(getApp()).currentUser);
        if (currentSessionKey !== previousSessionKey) {
          clearAccessForIdentityChange();
          await refresh();
        }
        throw error;
      })
      .finally(() => {
        if (identityTransitionInFlight.current === operation) {
          identityTransitionInFlight.current = null;
          identityTransitionActive.current = false;
        }
      });
    identityTransitionInFlight.current = operation;
    return operation;
  }, [clearAccessForIdentityChange, refresh]);

  const deleteAccount = useCallback((): Promise<DataDeletionResult> => {
    if (accountDeletionInFlight.current) return accountDeletionInFlight.current;
    if (identityTransitionInFlight.current) {
      return Promise.reject(new Error('Așteaptă finalizarea schimbării de cont înainte de ștergere.'));
    }
    const previousSessionKey = firebaseUserSessionKey(getAuth(getApp()).currentUser);
    identityTransitionActive.current = true;
    invalidateSessionOperations();
    identityGeneration.current += 1;
    refreshInFlight.current = null;
    setRefreshing(false);

    const operation = deleteAllUserData()
      .then((result) => {
        // The remote deletion is already definitive. Clear every trace of the
        // deleted identity immediately; a failed guest refresh is only an
        // offline/retry state and cannot turn deletion into a reported failure.
        clearAccessForIdentityChange();
        if (result.localSignOutPending) setAuthSessionKey(null);
        void refresh();
        return result;
      })
      .catch(async (error) => {
        const currentSessionKey = firebaseUserSessionKey(getAuth(getApp()).currentUser);
        if (currentSessionKey !== previousSessionKey) {
          clearAccessForIdentityChange();
          await refresh();
        }
        throw error;
      })
      .finally(() => {
        if (accountDeletionInFlight.current === operation) {
          accountDeletionInFlight.current = null;
          identityTransitionActive.current = false;
        }
      });
    accountDeletionInFlight.current = operation;
    return operation;
  }, [clearAccessForIdentityChange, refresh]);

  const value = useMemo(
    () => ({
      authSessionKey,
      identity,
      access,
      startupReady,
      status,
      loading: status === 'resolving',
      refreshing,
      refresh,
      refreshIfStale,
      applyServerAccess,
      connectGoogle,
      disconnectGoogle,
      deleteAccount,
    }),
    [access, applyServerAccess, authSessionKey, connectGoogle, deleteAccount, disconnectGoogle, identity, refresh, refreshIfStale, refreshing, startupReady, status],
  );
  return <CommercialContext.Provider value={value}>{children}</CommercialContext.Provider>;
}

export function useCommercial(): CommercialContextValue {
  const value = useContext(CommercialContext);
  if (!value) throw new Error('useCommercial trebuie folosit în CommercialProvider.');
  return value;
}
