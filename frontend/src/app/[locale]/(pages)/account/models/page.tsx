"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, ChevronDown, Eye, EyeOff, Loader2, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserProfile } from "@/contexts/UserProfileContext";
import type { ApiKeyState, OpenRouterModel } from "@/app/lib/mikeApi";
import { STATIC_MODELS } from "@/app/components/assistant/ModelToggle";
import {
    isModelAvailable,
    modelGroupToProvider,
    providerLabel,
} from "@/app/lib/modelAvailability";
import { useOpenRouterModels } from "@/app/hooks/useOpenRouterModels";

const API_KEY_FIELDS = [
    {
        provider: "claude",
        label: "Anthropic (Claude) API Key",
        placeholder: "sk-ant-…",
    },
    {
        provider: "gemini",
        label: "Google (Gemini) API Key",
        placeholder: "AI…",
    },
    {
        provider: "openai",
        label: "OpenAI API Key",
        placeholder: "sk-…",
    },
    {
        provider: "openrouter",
        label: "OpenRouter API Key",
        placeholder: "sk-or-…",
    },
] as const;

export default function ModelsAndApiKeysPage() {
    const t = useTranslations("account.modelsPage");
    const { profile, updateModelPreference, updateApiKey } = useUserProfile();

    return (
        <div className="space-y-4">
            {/* Model Preferences */}
            <div className="pb-6">
                <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-2xl font-medium font-serif">
                        {t("modelPreferences")}
                    </h2>
                </div>
                <div className="space-y-4 max-w-md">
                    <div>
                        <label className="text-sm text-gray-600 block mb-2">
                            {t("tabularReviewModel")}
                        </label>
                        <p className="text-xs text-gray-400 mb-2">
                            {t("tabularReviewModelHint")}
                        </p>
                        <TabularModelDropdown
                            value={
                                profile?.tabularModel ??
                                "gemini-3-flash-preview"
                            }
                            apiKeys={profile?.apiKeys}
                            onChange={(id) =>
                                updateModelPreference("tabularModel", id)
                            }
                        />
                    </div>
                </div>
            </div>

            {/* API Keys */}
            <div className="py-6">
                <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-2xl font-medium font-serif">
                        {t("apiKeys")}
                    </h2>
                </div>
                <p className="text-sm text-gray-500 mb-4 max-w-xl">
                    {t("apiKeysDescription")}
                </p>
                <p className="text-xs text-gray-400 mb-4 max-w-xl">
                    {t("apiKeysTitleHint")}
                </p>
                <div className="space-y-4 max-w-xl">
                    {API_KEY_FIELDS.map((field) => (
                        <ApiKeyField
                            key={field.provider}
                            label={field.label}
                            placeholder={field.placeholder}
                            hasSavedKey={
                                !!profile?.apiKeys[field.provider].configured
                            }
                            isServerConfigured={
                                profile?.apiKeys[field.provider].source ===
                                "env"
                            }
                            onSave={(value) =>
                                updateApiKey(
                                    field.provider,
                                    value.trim() || null,
                                )
                            }
                            onRemove={() =>
                                updateApiKey(field.provider, null)
                            }
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function isFreeModel(m: OpenRouterModel): boolean {
    return m.pricing?.prompt === "0" && m.pricing?.completion === "0";
}

const STATIC_GROUP_ORDER: ("Anthropic" | "Google" | "OpenAI")[] = [
    "Anthropic",
    "Google",
    "OpenAI",
];

function TabularModelDropdown({
    value,
    onChange,
    apiKeys,
}: {
    value: string;
    onChange: (id: string) => void;
    apiKeys?: ApiKeyState;
}) {
    const t = useTranslations("account.modelsPage");
    const [isOpen, setIsOpen] = useState(false);
    const [orSearch, setOrSearch] = useState("");
    const searchRef = useRef<HTMLInputElement>(null);
    const { state: orState, load: loadOpenRouterModels } = useOpenRouterModels();
    const openRouterAvailable = apiKeys ? !!apiKeys.openrouter?.configured : true;

    const allOrModels = orState.status === "loaded" ? orState.models : [];
    const q = orSearch.trim().toLowerCase();
    const filteredOrModels = q
        ? allOrModels.filter(
              (m) =>
                  (m.name ?? m.id).toLowerCase().includes(q) ||
                  m.id.toLowerCase().includes(q),
          )
        : allOrModels;

    const selectedStatic = STATIC_MODELS.find((m) => m.id === value);
    const selectedOrModel = allOrModels.find((m) => m.id === value);
    const selectedLabel =
        selectedStatic?.label ??
        (selectedOrModel ? (selectedOrModel.name ?? selectedOrModel.id) : null) ??
        value;
    const selectedAvailable = apiKeys ? isModelAvailable(value, apiKeys) : true;

    function handleOpenChange(open: boolean) {
        setIsOpen(open);
        if (open && openRouterAvailable) loadOpenRouterModels();
        if (!open) setOrSearch("");
    }

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
                    className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm shadow-sm flex items-center justify-between gap-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/10"
                >
                    <span className="flex items-center gap-2 min-w-0">
                        {!selectedAvailable && (
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                        )}
                        <span className="truncate text-gray-900">{selectedLabel}</span>
                    </span>
                    <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="z-50 max-h-[400px] flex flex-col overflow-hidden"
                style={{ width: "var(--radix-dropdown-menu-trigger-width)" }}
                align="start"
            >
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
                                    const provider = modelGroupToProvider(m.group);
                                    const available = apiKeys
                                        ? isModelAvailable(m.id, apiKeys)
                                        : true;
                                    return (
                                        <DropdownMenuItem
                                            key={m.id}
                                            className="cursor-pointer"
                                            onSelect={() => onChange(m.id)}
                                            title={
                                                !available
                                                    ? `Add a ${providerLabel(provider)} API key to use this model`
                                                    : undefined
                                            }
                                        >
                                            <span className={`flex-1 ${available ? "" : "text-gray-400"}`}>
                                                {m.label}
                                            </span>
                                            {!available && (
                                                <AlertCircle className="h-3.5 w-3.5 text-red-500 ml-1" />
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
                                {t("loadingModels")}
                            </div>
                        )}
                        {orState.status === "error" && (
                            <div className="px-2 py-1.5 text-xs text-red-500">
                                {orState.message}
                            </div>
                        )}
                        {orState.status === "loaded" && (
                            <>
                                <div className="px-2 pb-1 shrink-0">
                                    <div className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1">
                                        <Search className="h-3 w-3 text-gray-400 shrink-0" />
                                        <input
                                            ref={searchRef}
                                            type="text"
                                            placeholder={t("searchModels")}
                                            value={orSearch}
                                            onChange={(e) => setOrSearch(e.target.value)}
                                            onKeyDown={(e) => e.stopPropagation()}
                                            className="flex-1 bg-transparent text-xs outline-none placeholder:text-gray-400"
                                        />
                                    </div>
                                </div>
                                <div className="overflow-y-auto min-h-0 flex-1">
                                    {filteredOrModels.length === 0 ? (
                                        <div className="px-2 py-2 text-xs text-gray-400">
                                            {t("noModelsMatch", { query: orSearch })}
                                        </div>
                                    ) : (
                                        filteredOrModels.map((m) => (
                                            <DropdownMenuItem
                                                key={m.id}
                                                className="cursor-pointer"
                                                onSelect={() => onChange(m.id)}
                                            >
                                                <span className="flex-1 truncate">
                                                    {m.name ?? m.id}
                                                </span>
                                                {isFreeModel(m) && (
                                                    <span className="ml-1 shrink-0 rounded px-1 py-0.5 text-[10px] font-medium bg-green-50 text-green-700">
                                                        free
                                                    </span>
                                                )}
                                                {m.id === value && (
                                                    <Check className="h-3.5 w-3.5 text-gray-600 ml-1 shrink-0" />
                                                )}
                                            </DropdownMenuItem>
                                        ))
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

function ApiKeyField({
    label,
    placeholder,
    hasSavedKey,
    isServerConfigured,
    onSave,
    onRemove,
}: {
    label: string;
    placeholder: string;
    hasSavedKey: boolean;
    isServerConfigured: boolean;
    onSave: (value: string) => Promise<boolean>;
    onRemove: () => Promise<boolean>;
}) {
    const t = useTranslations("account.modelsPage");
    const [value, setValue] = useState("");
    const [reveal, setReveal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setValue("");
    }, [hasSavedKey]);

    const dirty = value.trim().length > 0;

    const handleSave = async () => {
        setIsSaving(true);
        const ok = await onSave(value);
        setIsSaving(false);
        if (ok) {
            setValue("");
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } else {
            alert(`Failed to save ${label}.`);
        }
    };

    const handleRemove = async () => {
        setIsSaving(true);
        const ok = await onRemove();
        setIsSaving(false);
        if (!ok) alert(`Failed to remove ${label}.`);
    };

    return (
        <div>
            <label className="text-sm text-gray-600 block mb-2">{label}</label>
            {isServerConfigured && !hasSavedKey && (
                <div className="mb-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
                    <p className="text-xs text-blue-800">
                        {t("serverEnvKeyConfigured")}
                    </p>
                </div>
            )}
            {hasSavedKey && !isServerConfigured && (
                <p className="text-xs text-gray-500 mb-2">
                    {t("savedKeyReplace")}
                </p>
            )}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Input
                        type={reveal ? "text" : "password"}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={
                            hasSavedKey
                                ? t("savedKeyHidden")
                                : isServerConfigured
                                  ? t("serverEnvKeyActive")
                                  : placeholder
                        }
                        className="pr-10"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    <button
                        type="button"
                        onClick={() => setReveal((r) => !r)}
                        className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
                        aria-label={reveal ? t("hideKey") : t("showKey")}
                    >
                        {reveal ? (
                            <EyeOff className="h-4 w-4" />
                        ) : (
                            <Eye className="h-4 w-4" />
                        )}
                    </button>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={isSaving || !dirty || saved}
                    className="min-w-[80px] transition-all bg-black hover:bg-gray-900 text-white"
                >
                    {isSaving ? (
                        t("saving")
                    ) : saved ? (
                        <>
                            <Check className="h-4 w-3" />
                            {t("saved")}
                        </>
                    ) : (
                        t("save")
                    )}
                </Button>
                {hasSavedKey && !isServerConfigured && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleRemove}
                        disabled={isSaving}
                    >
                        {t("remove")}
                    </Button>
                )}
            </div>
        </div>
    );
}
