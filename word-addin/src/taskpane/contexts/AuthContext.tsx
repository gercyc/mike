import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  AuthStatus,
  fetchAuthStatus,
  loginWithPassword,
  logout as logoutRequest,
  setupPassword,
} from "../lib/auth";

interface AuthContextValue {
  status: AuthStatus | null;
  /** True until the initial /auth/status fetch lands. */
  loading: boolean;
  isAuthenticated: boolean;
  login: (password: string) => Promise<void>;
  setup: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  status: null,
  loading: true,
  isAuthenticated: false,
  login: async () => {},
  setup: async () => {},
  signOut: async () => {},
  refreshStatus: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    try {
      const next = await fetchAuthStatus();
      setStatus(next);
    } catch {
      setStatus({ initialized: true, authenticated: false });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await fetchAuthStatus();
        if (!cancelled) setStatus(next);
      } catch {
        if (!cancelled) setStatus({ initialized: true, authenticated: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (password: string) => {
    await loginWithPassword(password);
    await refreshStatus();
  }, [refreshStatus]);

  const setup = useCallback(async (password: string) => {
    await setupPassword(password);
    await refreshStatus();
  }, [refreshStatus]);

  const signOut = useCallback(async () => {
    await logoutRequest();
    setStatus({ initialized: true, authenticated: false });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        status,
        loading,
        isAuthenticated: !!status?.authenticated,
        login,
        setup,
        signOut,
        refreshStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
