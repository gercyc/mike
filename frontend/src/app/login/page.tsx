"use client";

// Local-password login / first-time-setup screen.
//
// Wave 2 swap-out: the previous version called Supabase. Now we hit the
// backend's `/auth/status` endpoint to decide which form to render:
//   - initialized=false           → setup form (set the master password)
//   - initialized, !authenticated → login form (enter the password)
//   - authenticated               → bounce to /assistant
//
// On submit we call `setup` / `login` from AuthContext, which stores the
// returned token in localStorage and re-fetches /auth/status.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteLogo } from "@/components/site-logo";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
    const router = useRouter();
    const { status, isAuthenticated, authLoading, login, setup } = useAuth();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            router.replace("/assistant");
        }
    }, [authLoading, isAuthenticated, router]);

    if (authLoading || !status) {
        return (
            <div className="min-h-dvh bg-white flex items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
            </div>
        );
    }

    const isSetup = !status.initialized;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (isSetup) {
            if (password.length < 6) {
                setError("Password must be at least 6 characters");
                return;
            }
            if (password !== confirmPassword) {
                setError("Passwords do not match");
                return;
            }
        }

        setLoading(true);
        try {
            if (isSetup) {
                await setup(password);
            } else {
                await login(password);
            }
            router.push("/assistant");
        } catch (err: unknown) {
            const msg =
                err instanceof Error ? err.message : "Something went wrong";
            setError(
                isSetup
                    ? msg
                    : msg.includes("401") || msg.toLowerCase().includes("invalid")
                      ? "Incorrect password"
                      : msg,
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh bg-white flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative">
            <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                <SiteLogo size="md" className="md:text-4xl" asLink />
            </div>
            <div className="w-full max-w-md">
                <div className="bg-white border border-gray-200 rounded-2xl p-8">
                    <div className="mb-6">
                        <h2 className="text-left text-2xl font-serif">
                            {isSetup ? "Welcome to Mike" : "Log In"}
                        </h2>
                        {isSetup && (
                            <p className="text-sm text-gray-500 mt-2">
                                Set a password to protect your local data. You
                                will use this password every time you sign in
                                on this machine.
                            </p>
                        )}
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Password
                            </label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={
                                    isSetup
                                        ? "Choose a password (min. 6 characters)"
                                        : "Enter your password"
                                }
                                required
                                autoFocus
                                autoComplete={
                                    isSetup ? "new-password" : "current-password"
                                }
                                className="w-full"
                            />
                        </div>

                        {isSetup && (
                            <div>
                                <label
                                    htmlFor="confirm"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    Confirm Password
                                </label>
                                <Input
                                    id="confirm"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) =>
                                        setConfirmPassword(e.target.value)
                                    }
                                    placeholder="Confirm your password"
                                    required
                                    autoComplete="new-password"
                                    className="w-full"
                                />
                            </div>
                        )}

                        {error && (
                            <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-5 bg-black hover:bg-gray-900 text-white"
                        >
                            {loading
                                ? isSetup
                                    ? "Setting up…"
                                    : "Logging in…"
                                : isSetup
                                  ? "Set Password"
                                  : "Log in"}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
