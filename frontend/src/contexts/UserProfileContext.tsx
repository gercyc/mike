"use client";

// Local profile context. The original implementation was backed by a
// Supabase `user_profiles` table; the local-mode rewrite replaces that with
// localStorage-backed preferences. We keep the same shape so the UI doesn't
// have to change.
//
// AI keys live in the encrypted `~/.mike/secrets.enc` file and are managed
// via `/user/ai-keys`. The `claudeApiKey` / `geminiApiKey` fields exposed
// here are presence sentinels only ("•" if set, null otherwise) — never the
// actual key material. Existing consumers only check truthiness, so this
// keeps them working without leaking secrets to localStorage.

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authHeader } from "@/lib/mikeAuth";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://127.0.0.1:3001";
const KEY_SENTINEL = "•";

interface UserProfile {
    displayName: string | null;
    organisation: string | null;
    messageCreditsUsed: number;
    creditsResetDate: string;
    creditsRemaining: number;
    tier: string;
    tabularModel: string;
    claudeApiKey: string | null;
    geminiApiKey: string | null;
}

interface UserProfileContextType {
    profile: UserProfile | null;
    loading: boolean;
    updateDisplayName: (name: string) => Promise<boolean>;
    updateOrganisation: (organisation: string) => Promise<boolean>;
    updateModelPreference: (
        field: "tabularModel",
        value: string,
    ) => Promise<boolean>;
    updateApiKey: (
        provider: "claude" | "gemini",
        value: string | null,
    ) => Promise<boolean>;
    reloadProfile: () => Promise<void>;
    incrementMessageCredits: () => Promise<boolean>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(
    undefined,
);

const STORAGE_KEY = "mike.userProfile.v1";
const MONTHLY_CREDIT_LIMIT = 999999; // unlimited in local mode

function defaultProfile(): UserProfile {
    const reset = new Date();
    reset.setDate(reset.getDate() + 30);
    return {
        displayName: null,
        organisation: null,
        messageCreditsUsed: 0,
        creditsResetDate: reset.toISOString(),
        creditsRemaining: MONTHLY_CREDIT_LIMIT,
        tier: "Local",
        tabularModel: "gemini-3-flash-preview",
        claudeApiKey: null,
        geminiApiKey: null,
    };
}

function readStorage(): UserProfile | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<UserProfile>;
        // Strip any legacy plaintext keys that may be sitting in localStorage
        // from earlier builds. Real keys live in the encrypted secrets file;
        // we only ever expose presence sentinels here.
        const { claudeApiKey: _drop1, geminiApiKey: _drop2, ...rest } = parsed;
        void _drop1;
        void _drop2;
        return {
            ...defaultProfile(),
            ...rest,
            claudeApiKey: null,
            geminiApiKey: null,
        };
    } catch {
        return null;
    }
}

function writeStorage(p: UserProfile): void {
    if (typeof window === "undefined") return;
    try {
        // Never persist the AI-key fields — they're populated at runtime from
        // /user/ai-keys, not from localStorage.
        const { claudeApiKey: _k1, geminiApiKey: _k2, ...persistable } = p;
        void _k1;
        void _k2;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
    } catch {
        /* ignore */
    }
}

async function fetchAiKeyPresence(): Promise<{
    claudeApiKey: string | null;
    geminiApiKey: string | null;
}> {
    try {
        const res = await fetch(`${API_BASE}/user/ai-keys`, {
            headers: authHeader(),
            credentials: "include",
        });
        if (!res.ok) return { claudeApiKey: null, geminiApiKey: null };
        const data = (await res.json()) as Record<
            string,
            { enabled?: boolean; masked?: string | null } | undefined
        >;
        // Backend keys by the company name ("anthropic"), the UI keys by
        // the model family ("claude") — translate at this seam.
        const anthropic = data?.anthropic;
        const gemini = data?.gemini;
        return {
            claudeApiKey: anthropic?.enabled ? KEY_SENTINEL : null,
            geminiApiKey: gemini?.enabled ? KEY_SENTINEL : null,
        };
    } catch {
        return { claudeApiKey: null, geminiApiKey: null };
    }
}

export function UserProfileProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const loadProfile = useCallback(async () => {
        setLoading(true);
        const stored = readStorage() ?? defaultProfile();
        const presence = await fetchAiKeyPresence();
        setProfile({ ...stored, ...presence });
        setLoading(false);
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            loadProfile();
        } else {
            setProfile(null);
            setLoading(false);
        }
    }, [isAuthenticated, loadProfile]);

    const updateField = useCallback(
        async <K extends keyof UserProfile>(
            key: K,
            value: UserProfile[K],
        ): Promise<boolean> => {
            setProfile((prev) => {
                const base = prev ?? defaultProfile();
                const next = { ...base, [key]: value };
                writeStorage(next);
                return next;
            });
            return true;
        },
        [],
    );

    const updateDisplayName = useCallback(
        (displayName: string) => updateField("displayName", displayName),
        [updateField],
    );

    const updateOrganisation = useCallback(
        (organisation: string) => updateField("organisation", organisation),
        [updateField],
    );

    const updateModelPreference = useCallback(
        (field: "tabularModel", value: string) => updateField(field, value),
        [updateField],
    );

    const updateApiKey = useCallback(
        async (
            provider: "claude" | "gemini",
            value: string | null,
        ): Promise<boolean> => {
            const stateField =
                provider === "claude" ? "claudeApiKey" : "geminiApiKey";
            // The UI labels Anthropic's models as "Claude" (Claude Opus,
            // Sonnet, …) but the backend's AiProvider enum is keyed by the
            // company name. Map the friendlier label to the wire value so
            // PUT /user/ai-keys/anthropic works.
            const wireProvider = provider === "claude" ? "anthropic" : provider;
            const normalized = value?.trim() ? value.trim() : null;
            try {
                if (normalized) {
                    const res = await fetch(
                        `${API_BASE}/user/ai-keys/${wireProvider}`,
                        {
                            method: "PUT",
                            headers: {
                                "Content-Type": "application/json",
                                ...authHeader(),
                            },
                            credentials: "include",
                            body: JSON.stringify({
                                enabled: true,
                                key: normalized,
                            }),
                        },
                    );
                    if (!res.ok) return false;
                } else {
                    const res = await fetch(
                        `${API_BASE}/user/ai-keys/${wireProvider}`,
                        {
                            method: "DELETE",
                            headers: authHeader(),
                            credentials: "include",
                        },
                    );
                    if (!res.ok) return false;
                }
            } catch {
                return false;
            }
            // Persist only the sentinel — never the plaintext key.
            return updateField(stateField, normalized ? KEY_SENTINEL : null);
        },
        [updateField],
    );

    const reloadProfile = useCallback(async () => {
        await loadProfile();
    }, [loadProfile]);

    const incrementMessageCredits = useCallback(async (): Promise<boolean> => {
        setProfile((prev) => {
            const base = prev ?? defaultProfile();
            const used = base.messageCreditsUsed + 1;
            const next: UserProfile = {
                ...base,
                messageCreditsUsed: used,
                creditsRemaining: MONTHLY_CREDIT_LIMIT - used,
            };
            writeStorage(next);
            return next;
        });
        return true;
    }, []);

    return (
        <UserProfileContext.Provider
            value={{
                profile,
                loading,
                updateDisplayName,
                updateOrganisation,
                updateModelPreference,
                updateApiKey,
                reloadProfile,
                incrementMessageCredits,
            }}
        >
            {children}
        </UserProfileContext.Provider>
    );
}

export function useUserProfile() {
    const context = useContext(UserProfileContext);
    if (context === undefined) {
        throw new Error(
            "useUserProfile must be used within a UserProfileProvider",
        );
    }
    return context;
}
