import type { Provider } from "./types";

// ---------------------------------------------------------------------------
// Canonical model IDs
// ---------------------------------------------------------------------------
// Main-chat tier (top-end) — user picks one of these per message.
export const CLAUDE_MAIN_MODELS = ["claude-opus-4-7", "claude-sonnet-4-6"] as const;
export const GEMINI_MAIN_MODELS = [
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
] as const;
export const OPENAI_MAIN_MODELS = ["gpt-5.5", "gpt-5.4-mini"] as const;
export const OPENROUTER_MAIN_MODELS = ["openai/gpt-oss-120b:free"] as const;
export const DEEPSEEK_MAIN_MODELS = ["deepseek-v4-pro", "deepseek-v4-flash"] as const;

// Mid-tier (used for tabular review) — user picks one in account settings.
export const CLAUDE_MID_MODELS = ["claude-sonnet-4-6"] as const;
export const GEMINI_MID_MODELS = ["gemini-3-flash-preview"] as const;
export const OPENAI_MID_MODELS = ["gpt-5.4-mini"] as const;
export const OPENROUTER_MID_MODELS = ["openai/gpt-oss-120b:free"] as const;
export const DEEPSEEK_MID_MODELS = ["deepseek-v4-flash"] as const;

// Low-tier (used for title generation, lightweight extractions) — user picks
// one in account settings.
export const CLAUDE_LOW_MODELS = ["claude-haiku-4-5"] as const;
export const GEMINI_LOW_MODELS = ["gemini-3.1-flash-lite-preview"] as const;
export const OPENAI_LOW_MODELS = ["gpt-5.4-nano"] as const;
export const OPENROUTER_LOW_MODELS = ["openai/gpt-oss-120b:free"] as const;
export const DEEPSEEK_LOW_MODELS = ["deepseek-v4-flash"] as const;

export const DEFAULT_MAIN_MODEL = "openrouter/auto";
export const DEFAULT_TITLE_MODEL = "gemini-3.1-flash-lite-preview";
export const DEFAULT_TABULAR_MODEL = "gemini-3-flash-preview";

const ALL_MODELS = new Set<string>([
    ...CLAUDE_MAIN_MODELS,
    ...GEMINI_MAIN_MODELS,
    ...OPENAI_MAIN_MODELS,
    ...OPENROUTER_MAIN_MODELS,
    ...DEEPSEEK_MAIN_MODELS,
    ...CLAUDE_MID_MODELS,
    ...GEMINI_MID_MODELS,
    ...OPENAI_MID_MODELS,
    ...OPENROUTER_MID_MODELS,
    ...DEEPSEEK_MID_MODELS,
    ...CLAUDE_LOW_MODELS,
    ...GEMINI_LOW_MODELS,
    ...OPENAI_LOW_MODELS,
    ...OPENROUTER_LOW_MODELS,
    ...DEEPSEEK_LOW_MODELS,
]);

// ---------------------------------------------------------------------------
// Provider inference
// ---------------------------------------------------------------------------

const OPENROUTER_MODEL_IDS = new Set<string>([
    ...OPENROUTER_MAIN_MODELS,
    ...OPENROUTER_MID_MODELS,
    ...OPENROUTER_LOW_MODELS,
]);

export function providerForModel(model: string): Provider {
    if (model.startsWith("claude")) return "claude";
    if (model.startsWith("gemini")) return "gemini";
    if (model.startsWith("deepseek")) return "deepseek";
    // Dynamic OpenRouter models use "org/model" format
    if (OPENROUTER_MODEL_IDS.has(model) || model.includes("/")) return "openrouter";
    if (model.startsWith("gpt-") || model.startsWith("openai")) return "openai";
    throw new Error(`Unknown model id: ${model}`);
}

export function resolveModel(id: string | null | undefined, fallback: string): string {
    if (!id) return fallback;
    // Dynamic OpenRouter models are not in the static set but are valid
    if (ALL_MODELS.has(id) || id.includes("/")) return id;
    return fallback;
}
