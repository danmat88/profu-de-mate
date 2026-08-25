import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { CommercialAccess } from '../types';
import { connectWithGoogle, disconnectGoogleAccount, getCommercialAccess, prepareCommercialServices } from '../services/commercial';
import { recordDiagnosticError } from '../services/diagnostics';

type CommercialContextValue = {
  access: CommercialAccess | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<CommercialAccess | null>;
  connectGoogle: () => Promise<boolean>;
  disconnectGoogle: () => Promise<void>;
};

const CommercialContext = createContext<CommercialContextValue | null>(null);

export function CommercialProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<CommercialAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refreshInFlight = useRef<Promise<CommercialAccess | null> | null>(null);

  const refresh = useCallback((): Promise<CommercialAccess | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    setRefreshing(true);
    const request = getCommercialAccess()
      .then((next) => {
        setAccess(next);
        return next;
      })
      .catch((error) => {
        recordDiagnosticError('commercial_access', error);
        return null;
      })
      .finally(() => {
        refreshInFlight.current = null;
        setRefreshing(false);
        setLoading(false);
      });
    refreshInFlight.current = request;
    return request;
  }, []);

  useEffect(() => {
    let mounted = true;
    prepareCommercialServices()
      .then(() => mounted ? refresh() : null)
      .catch((error) => {
        recordDiagnosticError('commercial_initialization', error);
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [refresh]);

  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', (next) => {
      const returningToForeground = (previous === 'background' || previous === 'inactive') && next === 'active';
      previous = next;
      if (returningToForeground) void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const connectGoogle = useCallback(async () => {
    const user = await connectWithGoogle();
    if (!user) return false;
    await refresh();
    return true;
  }, [refresh]);

  const disconnectGoogle = useCallback(async () => {
    await disconnectGoogleAccount();
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ access, loading, refreshing, refresh, connectGoogle, disconnectGoogle }),
    [access, connectGoogle, disconnectGoogle, loading, refresh, refreshing],
  );
  return <CommercialContext.Provider value={value}>{children}</CommercialContext.Provider>;
}

export function useCommercial(): CommercialContextValue {
  const value = useContext(CommercialContext);
  if (!value) throw new Error('useCommercial trebuie folosit în CommercialProvider.');
  return value;
}
