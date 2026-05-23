"use client";

// AI provider keys settings page. Empty by default — users supply their
// own keys per provider. The backend uses these keys instead of any
// global env-var keys (Phase 3 of the desktop migration explicitly
// removed the env fallback to keep cost control with the user).

import { useEffect, useState, useCallback } from "react";
import { Eye, EyeOff, Check, X, Loader2, AlertCircle } from "lucide-react";
import type { AiKeysMap, AiProvider, AiProviderKey } from "@mike/shared";
import { mike } from "@/app/lib/mikeClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ProviderMeta {
  id: AiProvider;
  label: string;
  helpText: string;
  placeholder: string;
  signupUrl: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: "anthropic",
    label: "Anthropic Claude",
    helpText: "For chat with Claude models (Opus, Sonnet, Haiku).",
    placeholder: "sk-ant-...",
    signupUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openai",
    label: "OpenAI",
    helpText: "For chat with GPT models.",
    placeholder: "sk-...",
    signupUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    helpText: "For chat with Gemini models and tabular extraction.",
    placeholder: "AIza...",
    signupUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    helpText: "Multi-provider routing — one key for many models.",
    placeholder: "sk-or-...",
    signupUrl: "https://openrouter.ai/keys",
  },
];

type TestStatus =
  | { state: "idle" }
  | { state: "testing" }
  | { state: "ok"; ms: number }
  | { state: "error"; message: string };

export default function AiKeysPage() {
  const [keys, setKeys] = useState<AiKeysMap>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [tests, setTests] = useState<Record<string, TestStatus>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await mike.getAiKeys();
      setKeys(next);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function save(provider: AiProvider, patch: AiProviderKey) {
    setSaving((s) => ({ ...s, [provider]: true }));
    try {
      const next = await mike.setAiKey(provider, patch);
      setKeys(next);
      setDrafts((d) => ({ ...d, [provider]: "" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving((s) => ({ ...s, [provider]: false }));
    }
  }

  async function remove(provider: AiProvider) {
    setSaving((s) => ({ ...s, [provider]: true }));
    try {
      const next = await mike.deleteAiKey(provider);
      setKeys(next);
      setDrafts((d) => ({ ...d, [provider]: "" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving((s) => ({ ...s, [provider]: false }));
    }
  }

  async function test(provider: AiProvider) {
    setTests((t) => ({ ...t, [provider]: { state: "testing" } }));
    try {
      const r = await mike.testAiKey(provider);
      setTests((t) => ({
        ...t,
        [provider]: r.ok
          ? { state: "ok", ms: r.latency_ms }
          : { state: "error", message: r.error ?? "Failed" },
      }));
    } catch (e) {
      setTests((t) => ({
        ...t,
        [provider]: { state: "error", message: (e as Error).message },
      }));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-medium font-serif mb-1">AI Provider Keys</h2>
        <p className="text-sm text-gray-600">
          Mike uses your own provider keys for chat, tabular extraction, and
          workflows. Nothing is shared between users — keys are encrypted and
          stored only in your account.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      <div className="space-y-4">
        {PROVIDERS.map((p) => {
          const stored = keys[p.id];
          const draft = drafts[p.id] ?? "";
          const isRevealed = reveal[p.id] ?? false;
          const status: TestStatus = tests[p.id] ?? { state: "idle" };
          const isSaving = saving[p.id] ?? false;
          const hasKey = Boolean(stored?.key);
          const placeholder = hasKey ? `${stored?.key}` : p.placeholder;

          return (
            <div
              key={p.id}
              className="rounded-lg border border-gray-200 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-sm">{p.label}</div>
                  <div className="text-xs text-gray-500">{p.helpText}</div>
                </div>
                <a
                  href={p.signupUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline shrink-0"
                >
                  Get a key →
                </a>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={isRevealed ? "text" : "password"}
                    placeholder={placeholder}
                    value={draft}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [p.id]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setReveal((r) => ({ ...r, [p.id]: !isRevealed }))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    title={isRevealed ? "Hide" : "Show"}
                  >
                    {isRevealed ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  disabled={isSaving || !draft.trim()}
                  onClick={() =>
                    save(p.id, {
                      enabled: true,
                      key: draft.trim(),
                    })
                  }
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>

              {hasKey && (
                <div className="flex items-center gap-2 text-xs">
                  <label className="flex items-center gap-1.5 text-gray-700">
                    <input
                      type="checkbox"
                      checked={stored?.enabled ?? false}
                      onChange={(e) =>
                        save(p.id, {
                          enabled: e.target.checked,
                          key: null,
                        })
                      }
                    />
                    Enabled
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => test(p.id)}
                    disabled={!stored?.enabled || status.state === "testing"}
                  >
                    {status.state === "testing" ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Testing…
                      </>
                    ) : (
                      "Test"
                    )}
                  </Button>
                  {status.state === "ok" && (
                    <span className="flex items-center gap-1 text-green-700">
                      <Check className="w-3 h-3" /> {status.ms} ms
                    </span>
                  )}
                  {status.state === "error" && (
                    <span className="flex items-center gap-1 text-red-700">
                      <X className="w-3 h-3" /> {status.message}
                    </span>
                  )}
                  <button
                    onClick={() => remove(p.id)}
                    className="ml-auto text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
