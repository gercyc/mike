"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SiteLogo } from "@/components/site-logo";
import { useTranslations } from "next-intl";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

function VerifyEmailForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const [status, setStatus] = useState<"loading" | "success" | "error">(
        "loading",
    );
    const [message, setMessage] = useState("");
    const t = useTranslations("auth");

    useEffect(() => {
        setMessage(t("verifyEmail.verifying"));
        if (!token) {
            setStatus("error");
            setMessage(t("verifyEmail.invalidLink"));
            return;
        }

        fetch(`${API_BASE}/auth/verify-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
        })
            .then(async (res) => {
                const data = await res.json();
                if (res.ok) {
                    setStatus("success");
                    setMessage(data.message || t("verifyEmail.verifySuccess"));
                } else {
                    setStatus("error");
                    setMessage(data.detail || t("verifyEmail.verifyFailed"));
                }
            })
            .catch(() => {
                setStatus("error");
                setMessage(t("verifyEmail.networkError"));
            });
    }, [token, t]);

    return (
        <div className="min-h-dvh bg-white flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative">
            <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                <SiteLogo size="md" className="md:text-4xl" asLink />
            </div>
            <div className="w-full max-w-md">
                <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center shadow-sm">
                    {status === "loading" && (
                        <div className="mx-auto w-12 h-12 border-4 border-gray-200 border-t-black rounded-full animate-spin mb-6" />
                    )}
                    {status === "success" && (
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
                    )}
                    {status === "error" && (
                        <div className="mx-auto w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-6">
                            <svg
                                className="h-6 w-6 text-red-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </div>
                    )}
                    <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                        {status === "success"
                            ? t("verifyEmail.successTitle")
                            : status === "error"
                              ? t("verifyEmail.errorTitle")
                              : t("verifyEmail.loadingTitle")}
                    </h2>
                    <p className="text-gray-600 leading-relaxed mb-6">
                        {message}
                    </p>
                    {status === "success" && (
                        <Link
                            href="/login"
                            className="inline-block bg-black hover:bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium"
                        >
                            {t("verifyEmail.goToLogin")}
                        </Link>
                    )}
                    {status === "error" && (
                        <div className="flex flex-col gap-3 items-center">
                            <Link
                                href="/login"
                                className="text-blue-600 hover:underline text-sm"
                            >
                                {t("verifyEmail.goToLogin")}
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
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
            <VerifyEmailForm />
        </Suspense>
    );
}
