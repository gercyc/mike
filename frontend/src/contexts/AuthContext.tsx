"use client";

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from "react";
import { getAuthToken, removeAuthToken } from "@/lib/authToken";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

interface User {
    id: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    authLoading: boolean;
    signOut: () => Promise<void>;
    login: (token: string, userId: string, email: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const checkUser = async () => {
            const token = getAuthToken();
            if (!token) {
                setAuthLoading(false);
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    setUser({ id: data.userId, email: data.email });
                } else {
                    removeAuthToken();
                }
            } catch {
                removeAuthToken();
            } finally {
                setAuthLoading(false);
            }
        };

        checkUser();
    }, []);

    const login = (token: string, userId: string, email: string) => {
        localStorage.setItem("mike_auth_token", token);
        setUser({ id: userId, email });
    };

    const signOut = async () => {
        removeAuthToken();
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                authLoading,
                signOut,
                login,
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
