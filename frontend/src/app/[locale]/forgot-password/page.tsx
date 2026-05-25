"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { SiteLogo } from "@/components/site-logo";
import { useTranslations } from "next-intl";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);
    const t = useTranslations("auth");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_BASE}/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || t("forgotPassword.errorSendFailed"));
            }

            setSent(true);
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : t("forgotPassword.errorGeneric"),
            );
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
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
                            {t("forgotPassword.successTitle")}
                        </h2>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            {t.rich("forgotPassword.successMessage", {
                                email,
                                strong: (chunks) => <strong>{chunks}</strong>,
                            })}
                        </p>
                        <Link
                            href="/login"
                            className="text-blue-600 hover:underline text-sm"
                        >
                            {t("forgotPassword.backToLogin")}
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
                        {t("forgotPassword.title")}
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                {t("forgotPassword.emailLabel")}
                            </label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={t("forgotPassword.emailPlaceholder")}
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
                            disabled={loading}
                            className="w-full bg-black hover:bg-gray-900 text-white"
                        >
                            {loading
                                ? t("forgotPassword.submitting")
                                : t("forgotPassword.submit")}
                        </Button>
                    </form>

                    <div className="mt-4 text-center">
                        <Link
                            href="/login"
                            className="text-sm text-blue-600 hover:underline"
                        >
                            {t("forgotPassword.backToLogin")}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
