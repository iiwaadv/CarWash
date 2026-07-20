import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { initSyncEngine, subscribeSync, type SyncState } from "../lib/sync";
import { useAuth } from "./AuthContext";

const SyncContext = createContext<SyncState | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [state, setState] = useState<SyncState>({
    isOnline: navigator.onLine,
    pendingCount: 0,
    lastSyncAt: null,
    lastError: null,
    syncing: false,
  });

  useEffect(() => subscribeSync(setState), []);

  useEffect(() => {
    const stop = initSyncEngine(() => token);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return <SyncContext.Provider value={state}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within SyncProvider");
  return ctx;
}
