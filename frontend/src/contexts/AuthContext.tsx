"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from "react";
import {
    fetchAuthStatus,
    getMikeToken,
    loginWithPassword,
    logout as logoutRequest,
    setupPassword,
    type AuthStatus,
} from "@/lib/mikeAuth";

// In the local-password world there's a single user (`local`). We keep the
// `user` shape so existing consumers that dereference `user.id` / `user.email`
// continue to compile — they used those values purely for client-side
// "this row belongs to me" checks, which are now trivially true.
interface User {
    id: string;
    email: string;
}

const LOCAL_USER: User = { id: "local", email: "local" };

interface AuthContextType {
    /** Latest server-reported auth status; null until first /auth/status fetches. */
    status: AuthStatus | null;
    user: User | null;
    isAuthenticated: boolean;
    /** True only during the initial bootstrap fetch. */
    authLoading: boolean;
    login: (password: string) => Promise<void>;
    setup: (password: string) => Promise<void>;
    signOut: () => Promise<void>;
    /** Re-fetch /auth/status (e.g. after a 401 elsewhere). */
    refreshStatus: () => Promise<AuthStatus | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<AuthStatus | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    const refreshStatus = useCallback(async () => {
        try {
            const next = await fetchAuthStatus();
            setStatus(next);
            return next;
        } catch (e) {
            console.error("[auth] /auth/status failed", e);
            setStatus({ initialized: true, authenticated: false });
            return null;
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const token = getMikeToken();
            const next = await fetchAuthStatus().catch(() => null);
            if (cancelled) return;
            if (next) {
                // If we have a token but the server says we're not authed,
                // the token is stale — drop it.
                if (!next.authenticated && token) {
                    try {
                        window.localStorage.removeItem("mike.token");
                    } catch {
                        /* ignore */
                    }
                }
                setStatus(next);
            } else {
                setStatus({ initialized: true, authenticated: false });
            }
            setAuthLoading(false);
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

    const isAuthenticated = !!status?.authenticated;

    return (
        <AuthContext.Provider
            value={{
                status,
                user: isAuthenticated ? LOCAL_USER : null,
                isAuthenticated,
                authLoading,
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
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
