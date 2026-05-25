"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Check, AlertCircle, Loader2, Search } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isModelAvailable } from "@/app/lib/modelAvailability";
import { useOpenRouterModels } from "@/app/hooks/useOpenRouterModels";
import type { ApiKeyState, OpenRouterModel } from "@/app/lib/mikeApi";

export interface ModelOption {
    id: string;
    label: string;
    group: "Anthropic" | "Google" | "OpenAI" | "OpenRouter" | "DeepSeek";
}

export const STATIC_MODELS: ModelOption[] = [
    { id: "claude-opus-4-7", label: "Claude Opus 4.7", group: "Anthropic" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", group: "Anthropic" },
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", group: "Google" },
    { id: "gemini-3-flash-preview", label: "Gemini 3 Flash", group: "Google" },
    { id: "gpt-5.5", label: "GPT-5.5", group: "OpenAI" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", group: "OpenAI" },
    { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", group: "DeepSeek" },
    { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", group: "DeepSeek" },
];

// Keep MODELS exported for backwards-compat (pages/account/models uses it)
export const MODELS: ModelOption[] = STATIC_MODELS;

export const DEFAULT_MODEL_ID = "openrouter/auto";

export const ALLOWED_MODEL_IDS = new Set(MODELS.map((m) => m.id));

const STATIC_GROUP_ORDER: ModelOption["group"][] = ["Anthropic", "Google", "OpenAI", "DeepSeek"];

interface Props {
    value: string;
    onChange: (id: string) => void;
    apiKeys?: ApiKeyState;
}

function isFreeModel(m: OpenRouterModel): boolean {
    return m.pricing?.prompt === "0" && m.pricing?.completion === "0";
}

export function ModelToggle({ value, onChange, apiKeys }: Props) {
    const t = useTranslations("assistant");
    const [isOpen, setIsOpen] = useState(false);
    const [orSearch, setOrSearch] = useState("");
    const searchRef = useRef<HTMLInputElement>(null);
    const { state: orState, load: loadOpenRouterModels } = useOpenRouterModels();
    const openRouterAvailable = apiKeys ? !!apiKeys.openrouter?.configured : true;

    // Backend already returns models sorted: free first, then extras alphabetically
    const allOrModels = orState.status === "loaded" ? orState.models : [];

    const q = orSearch.trim().toLowerCase();
    const filteredOrModels = q
        ? allOrModels.filter(
              (m) =>
                  (m.name ?? m.id).toLowerCase().includes(q) ||
                  m.id.toLowerCase().includes(q),
          )
        : allOrModels;

    // Selected model may be a dynamic OpenRouter model not in STATIC_MODELS
    const selectedOrModel = allOrModels.find((m) => m.id === value);
    const selectedLabel =
        STATIC_MODELS.find((m) => m.id === value)?.label ??
        (selectedOrModel ? (selectedOrModel.name ?? selectedOrModel.id) : null) ??
        value;

    const selectedAvailable = apiKeys ? isModelAvailable(value, apiKeys) : true;

    function handleOpenChange(open: boolean) {
        setIsOpen(open);
        if (open && openRouterAvailable) {
            loadOpenRouterModels();
        }
        if (!open) setOrSearch("");
    }

    // Focus the search input when the OpenRouter section becomes visible
    useEffect(() => {
        if (isOpen && orState.status === "loaded") {
            setTimeout(() => searchRef.current?.focus(), 50);
        }
    }, [isOpen, orState.status]);

    return (
        <DropdownMenu onOpenChange={handleOpenChange}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={`flex items-center gap-1.5 rounded-lg px-2 h-8 text-sm transition-colors cursor-pointer text-gray-400 hover:bg-gray-100 hover:text-gray-700 ${isOpen ? "bg-gray-100 text-gray-700" : ""}`}
                    title={
                        !selectedAvailable
                            ? t("modelToggle.apiKeyMissingTitle")
                            : t("modelToggle.chooseModel")
                    }
                >
                    {!selectedAvailable && (
                        <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
                    )}
                    <span className="max-w-[140px] truncate">{selectedLabel}</span>
                    <ChevronDown
                        className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72 z-50 max-h-[480px] flex flex-col overflow-hidden" side="top" align="start">
                {/* Static providers */}
                <div className="overflow-y-auto">
                    {STATIC_GROUP_ORDER.map((group, gi) => {
                        const items = STATIC_MODELS.filter((m) => m.group === group);
                        if (items.length === 0) return null;
                        return (
                            <div key={group}>
                                {gi > 0 && <DropdownMenuSeparator />}
                                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-gray-400">
                                    {group}
                                </DropdownMenuLabel>
                                {items.map((m) => {
                                    const available = apiKeys
                                        ? isModelAvailable(m.id, apiKeys)
                                        : true;
                                    return (
                                        <DropdownMenuItem
                                            key={m.id}
                                            className="cursor-pointer"
                                            onSelect={() => onChange(m.id)}
                                        >
                                            <span className={`flex-1 ${available ? "" : "text-gray-400"}`}>
                                                {m.label}
                                            </span>
                                            {!available && (
                                                <AlertCircle
                                                    className="h-3.5 w-3.5 text-red-500 ml-1"
                                                    aria-label={t("modelToggle.apiKeyMissingAria")}
                                                />
                                            )}
                                            {m.id === value && available && (
                                                <Check className="h-3.5 w-3.5 text-gray-600 ml-1" />
                                            )}
                                        </DropdownMenuItem>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>

                {/* OpenRouter section */}
                {openRouterAvailable && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-gray-400 shrink-0">
                            OpenRouter
                        </DropdownMenuLabel>

                        {orState.status === "loading" && (
                            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-400">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {t("modelToggle.loadingModels")}
                            </div>
                        )}

                        {orState.status === "error" && (
                            <div className="px-2 py-1.5 text-xs text-red-500">
                                {orState.message}
                            </div>
                        )}

                        {orState.status === "loaded" && (
                            <>
                                {/* Search box */}
                                <div className="px-2 pb-1 shrink-0">
                                    <div className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1">
                                        <Search className="h-3 w-3 text-gray-400 shrink-0" />
                                        <input
                                            ref={searchRef}
                                            type="text"
                                            placeholder={t("modelToggle.searchPlaceholder")}
                                            value={orSearch}
                                            onChange={(e) => setOrSearch(e.target.value)}
                                            onKeyDown={(e) => e.stopPropagation()}
                                            className="flex-1 bg-transparent text-xs outline-none placeholder:text-gray-400"
                                        />
                                    </div>
                                </div>

                                {/* Model list */}
                                <div className="overflow-y-auto min-h-0 flex-1">
                                    {filteredOrModels.length === 0 ? (
                                        <div className="px-2 py-2 text-xs text-gray-400">
                                            {t("modelToggle.noModelsMatch", { search: orSearch })}
                                        </div>
                                    ) : (
                                        filteredOrModels.map((m) => {
                                            const free = isFreeModel(m);
                                            return (
                                                <DropdownMenuItem
                                                    key={m.id}
                                                    className="cursor-pointer"
                                                    onSelect={() => onChange(m.id)}
                                                >
                                                    <span className="flex-1 truncate">
                                                        {m.name ?? m.id}
                                                    </span>
                                                    {free && (
                                                        <span className="ml-1 shrink-0 rounded px-1 py-0.5 text-[10px] font-medium bg-green-50 text-green-700">
                                                            {t("modelToggle.free")}
                                                        </span>
                                                    )}
                                                    {m.id === value && (
                                                        <Check className="h-3.5 w-3.5 text-gray-600 ml-1 shrink-0" />
                                                    )}
                                                </DropdownMenuItem>
                                            );
                                        })
                                    )}
                                </div>
                            </>
                        )}
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
