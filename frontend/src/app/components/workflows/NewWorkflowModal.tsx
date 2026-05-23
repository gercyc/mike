"use client";

import { useEffect, useRef, useState } from "react";
import { X, MessageSquare, Table2 } from "lucide-react";
import { createWorkflow, updateWorkflow } from "@/app/lib/mikeApi";
import type { MikeWorkflow } from "../shared/types";
import { PRACTICE_KEYS } from "./practices";
import { useTranslations } from "next-intl";

interface Props {
    open: boolean;
    onClose: () => void;
    onCreated: (workflow: MikeWorkflow) => void;
    editWorkflow?: MikeWorkflow;
    onUpdated?: (workflow: MikeWorkflow) => void;
}

export function NewWorkflowModal({ open, onClose, onCreated, editWorkflow, onUpdated }: Props) {
    const t = useTranslations("workflows");
    const tP = useTranslations("workflows.practices");
    const [title, setTitle] = useState("");
    const [type, setType] = useState<"assistant" | "tabular">("assistant");
    const [practiceKey, setPracticeKey] = useState<string>("");
    const [customPractice, setCustomPractice] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const customInputRef = useRef<HTMLInputElement>(null);

    const isEditing = !!editWorkflow;
    const isOthers = practiceKey === "others";
    const effectivePractice = isOthers
        ? (customPractice.trim() || null)
        : practiceKey
          ? tP(practiceKey as Parameters<typeof tP>[0])
          : null;

    useEffect(() => {
        if (open && editWorkflow) {
            setTitle(editWorkflow.title);
            setType(editWorkflow.type);
            const saved = editWorkflow.practice ?? "";
            const matchedKey = PRACTICE_KEYS.find(
                (k) => tP(k) === saved,
            );
            if (matchedKey) {
                setPracticeKey(matchedKey);
                setCustomPractice("");
            } else if (saved) {
                setPracticeKey("others");
                setCustomPractice(saved);
            } else {
                setPracticeKey("");
                setCustomPractice("");
            }
            setError("");
        }
    }, [open, editWorkflow?.id]);

    useEffect(() => {
        if (isOthers) {
            customInputRef.current?.focus();
        }
    }, [isOthers]);

    if (!open) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim()) return;
        setLoading(true);
        setError("");
        try {
            if (isEditing && editWorkflow) {
                const updated = await updateWorkflow(editWorkflow.id, {
                    title: title.trim(),
                    practice: effectivePractice,
                });
                onUpdated?.(updated);
            } else {
                const workflow = await createWorkflow({
                    title: title.trim(),
                    type,
                    practice: effectivePractice,
                });
                onCreated(workflow);
            }
            resetForm();
            onClose();
        } catch (err: unknown) {
            setError((err as Error).message || t(isEditing ? "new.failedUpdate" : "new.failedCreate"));
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setTitle("");
        setType("assistant");
        setPracticeKey("");
        setCustomPractice("");
        setError("");
    }

    function handleClose() {
        resetForm();
        onClose();
    }

    return (
        <div className="fixed inset-0 z-101 flex items-center justify-center bg-black/20 backdrop-blur-xs">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col" style={{ height: 600 }}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-2 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <span>{t("new.workflows")}</span>
                        <span>›</span>
                        <span>{isEditing ? t("new.editWorkflow") : t("new.newWorkflow")}</span>
                    </div>
                    <button
                        onClick={handleClose}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    {/* Body */}
                    <div className="px-6 pt-3 pb-5 flex-1 overflow-y-auto">
                        {/* Title */}
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={t("new.workflowName")}
                            className="w-full text-2xl font-serif text-gray-800 placeholder-gray-300 focus:outline-none bg-transparent"
                            autoFocus
                        />

                        {/* Type pills — only shown when creating */}
                        {!isEditing && (
                            <div className="mt-5">
                                <p className="mb-2 text-sm font-medium text-gray-500">{t("new.type")}</p>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setType("assistant")}
                                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                                            type === "assistant"
                                                ? "border-gray-900 bg-gray-900 text-white"
                                                : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                        }`}
                                    >
                                        <MessageSquare className="h-3 w-3" />
                                        {t("modal.assistant")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setType("tabular")}
                                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                                            type === "tabular"
                                                ? "border-gray-900 bg-gray-900 text-white"
                                                : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                        }`}
                                    >
                                        <Table2 className="h-3 w-3" />
                                        {t("modal.tabular")}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Practice */}
                        <div className="mt-5">
                            <p className="mb-2 text-sm font-medium text-gray-500">{t("new.practiceArea")}</p>
                            <div className="flex flex-wrap gap-2">
                                {PRACTICE_KEYS.map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setPracticeKey(practiceKey === key ? "" : key)}
                                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                                            practiceKey === key
                                                ? "border-gray-900 bg-gray-900 text-white"
                                                : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                        }`}
                                    >
                                        {tP(key)}
                                    </button>
                                ))}
                            </div>
                            {isOthers && (
                                <input
                                    ref={customInputRef}
                                    type="text"
                                    value={customPractice}
                                    onChange={(e) => setCustomPractice(e.target.value)}
                                    placeholder={t("new.enterPractice")}
                                    className="mt-3 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
                                />
                            )}
                        </div>

                        {error && (
                            <p className="mt-4 text-sm text-red-500">{error}</p>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4 shrink-0">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                            {t("new.cancel")}
                        </button>
                        <button
                            type="submit"
                            disabled={!title.trim() || loading}
                            className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
                        >
                            {loading
                                ? (isEditing ? t("new.saving") : t("new.creating"))
                                : (isEditing ? t("new.saveChanges") : t("new.createWorkflow"))}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
