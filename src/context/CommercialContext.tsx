import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { AppState } from 'react-native';
import type { CommercialAccess, CommercialStatus } from '../types';
import { connectWithGoogle, disconnectGoogleAccount, getCommercialAccess, prepareCommercialServices } from '../services/commercial';
import { recordDiagnosticError } from '../services/diagnostics';
import { firebaseUserSessionKey } from '../services/firebase';
import { prewarmFavoriteLessonsCache } from '../services/lessons';
import {
  isCurrentCommercialRefreshGeneration,
  shouldAutomaticallyRefreshCommercialAccess,
} from '../services/commercialRefreshPolicy';

type CommercialContextValue = {
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
};

const CommercialContext = createContext<CommercialContextValue | null>(null);

const INITIAL_ACCESS_DEADLINE_MS = 4_500;

type RefreshRequest = {
  generation: number;
  promise: Promise<CommercialAccess | null>;
};

export function CommercialProvider({ children, initialAccess = null }: { children: ReactNode; initialAccess?: CommercialAccess | null }) {
  const [access, setAccess] = useState<CommercialAccess | null>(initialAccess);
  // A cached snapshot paints the hidden Home immediately, but the first reveal
  // still waits for one authoritative refresh (or the bounded offline deadline).
  const [startupReady, setStartupReady] = useState(false);
  const [status, setStatus] = useState<CommercialStatus>(initialAccess ? 'ready' : 'resolving');
  const [refreshing, setRefreshing] = useState(false);
  const accessRef = useRef<CommercialAccess | null>(initialAccess);
  const refreshInFlight = useRef<RefreshRequest | null>(null);
  const lastSuccessfulRefreshAt = useRef(0);
  const identityGeneration = useRef(0);
  const identityTransitionInFlight = useRef<Promise<CommercialAccess | null> | null>(null);
  const identityTransitionActive = useRef(false);

  const markStartupReady = useCallback(() => setStartupReady(true), []);

  const applyServerAccess = useCallback((next: CommercialAccess) => {
    accessRef.current = next;
    lastSuccessfulRefreshAt.current = Date.now();
    setAccess(next);
    setStatus('ready');
    markStartupReady();
  }, [markStartupReady]);

  const clearAccessForIdentityChange = useCallback(() => {
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
    if (!shouldAutomaticallyRefreshCommercialAccess({
      now: Date.now(),
      lastSuccessfulRefreshAt: lastSuccessfulRefreshAt.current,
      identityTransitionActive: identityTransitionActive.current,
    })) {
      return Promise.resolve(accessRef.current);
    }
    return refresh();
  }, [refresh]);

  useEffect(() => {
    let mounted = true;
    const startupDeadline = setTimeout(() => {
      if (mounted) markStartupReady();
    }, INITIAL_ACCESS_DEADLINE_MS);

    // Firestore owns its own local cache and does not depend on the commercial
    // access request. Warming it independently avoids a serial startup chain.
    void prewarmFavoriteLessonsCache().catch((error) => {
      recordDiagnosticError('notebook_prewarm', error);
    });

    prepareCommercialServices()
      .then(() => mounted ? refreshIfStale() : null)
      .catch((error) => {
        recordDiagnosticError('commercial_initialization', error);
        if (mounted) {
          if (!accessRef.current) setStatus('unavailable');
          setRefreshing(false);
          markStartupReady();
        }
      });
    return () => {
      mounted = false;
      clearTimeout(startupDeadline);
    };
  }, [markStartupReady, refreshIfStale]);

  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', (next) => {
      const returningToForeground = (previous === 'background' || previous === 'inactive') && next === 'active';
      previous = next;
      // Credential Manager temporarily backgrounds Android while its Activity
      // is visible. The identity operation performs one authoritative refresh
      // itself, so an automatic refresh here would race the old account.
      if (returningToForeground && !identityTransitionActive.current) void refreshIfStale();
    });
    return () => subscription.remove();
  }, [refreshIfStale]);

  const connectGoogle = useCallback((): Promise<CommercialAccess | null> => {
    if (identityTransitionInFlight.current) return identityTransitionInFlight.current;
    const previousSessionKey = firebaseUserSessionKey(getAuth(getApp()).currentUser);
    identityTransitionActive.current = true;
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
    const previousSessionKey = firebaseUserSessionKey(getAuth(getApp()).currentUser);
    identityTransitionActive.current = true;
    identityGeneration.current += 1;
    refreshInFlight.current = null;
    setRefreshing(false);

    const operation = disconnectGoogleAccount()
      .then((user) => {
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

  const value = useMemo(
    () => ({
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
    }),
    [access, applyServerAccess, connectGoogle, disconnectGoogle, refresh, refreshIfStale, refreshing, startupReady, status],
  );
  return <CommercialContext.Provider value={value}>{children}</CommercialContext.Provider>;
}

export function useCommercial(): CommercialContextValue {
  const value = useContext(CommercialContext);
  if (!value) throw new Error('useCommercial trebuie folosit în CommercialProvider.');
  return value;
}
