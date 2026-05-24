"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { SiteLogo } from "@/components/site-logo";
import { useTranslations } from "next-intl";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token");
    const t = useTranslations("auth");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!token) {
            setError(t("resetPassword.errorInvalidLink"));
        }
    }, [token, t]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;

        if (password !== confirmPassword) {
            setError(t("resetPassword.errorPasswordMismatch"));
            return;
        }

        if (password.length < 8) {
            setError(t("resetPassword.errorPasswordLength"));
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_BASE}/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || t("resetPassword.errorResetFailed"));
            }

            setSuccess(true);
            setTimeout(() => router.push("/login"), 3000);
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : t("resetPassword.errorGeneric"),
            );
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-dvh bg-white flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative">
                <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                    <SiteLogo size="md" className="md:text-4xl" asLink />
                </div>
                <div className="w-full max-w-md">
                    <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center shadow-sm">
                        <div className="mx-auto w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-6">
                            <svg
                                className="h-6 w-6 text-green-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                            {t("resetPassword.successTitle")}
                        </h2>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            {t("resetPassword.successMessage")}
                        </p>
                        <Link
                            href="/login"
                            className="inline-block bg-black hover:bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium"
                        >
                            {t("resetPassword.goToLogin")}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-white flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative">
            <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                <SiteLogo size="md" className="md:text-4xl" asLink />
            </div>
            <div className="w-full max-w-md">
                <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-4">
                    <h2 className="text-left text-2xl font-serif mb-6">
                        {t("resetPassword.title")}
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                {t("resetPassword.newPasswordLabel")}
                            </label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t("resetPassword.newPasswordPlaceholder")}
                                required
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="confirmPassword"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                {t("resetPassword.confirmPasswordLabel")}
                            </label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) =>
                                    setConfirmPassword(e.target.value)
                                }
                                placeholder={t("resetPassword.confirmPasswordPlaceholder")}
                                required
                                className="w-full"
                            />
                        </div>

                        {error && (
                            <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading || !token}
                            className="w-full bg-black hover:bg-gray-900 text-white"
                        >
                            {loading
                                ? t("resetPassword.submitting")
                                : t("resetPassword.submit")}
                        </Button>
                    </form>

                    <div className="mt-4 text-center">
                        <Link
                            href="/login"
                            className="text-sm text-blue-600 hover:underline"
                        >
                            {t("resetPassword.backToLogin")}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    const t = useTranslations("auth");
    return (
        <Suspense
            fallback={
                <div className="min-h-dvh bg-white flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative">
                    <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                        <SiteLogo size="md" className="md:text-4xl" asLink />
                    </div>
                    <div className="w-full max-w-md">
                        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center shadow-sm">
                            <div className="mx-auto w-12 h-12 border-4 border-gray-200 border-t-black rounded-full animate-spin mb-6" />
                            <p className="text-gray-600">{t("verifyEmail.loading")}</p>
                        </div>
                    </div>
                </div>
            }
        >
            <ResetPasswordForm />
        </Suspense>
    );
}
