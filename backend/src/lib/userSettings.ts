// Wave 3 cleanup: API keys live in `~/.mike/secrets.enc` (managed by
// `lib/aiKeys.ts`). The legacy `user_profiles.claude_api_key` /
// `gemini_api_key` columns are no longer read or written from anywhere.
//
// This module preserves its old export surface so chat / tabular routes
// don't have to change — it just sources the keys from `aiKeys.ts` and
// the lightweight `tabular_model` preference from the SQLite shim.

import { createServerSupabase } from "./supabase";
import {
    resolveModel,
    DEFAULT_TITLE_MODEL,
    DEFAULT_TABULAR_MODEL,
    OPENAI_LOW_MODELS,
    type UserApiKeys,
} from "./llm";
import { getUserAiKeys } from "./aiKeys";

export type UserModelSettings = {
    title_model: string;
    tabular_model: string;
    api_keys: UserApiKeys;
};

// Title generation is a lightweight task — always routed to the cheapest model
// of whichever provider the user has keys for: Gemini Flash Lite if Gemini is
// available, otherwise OpenAI nano, otherwise Claude Haiku. With no user keys
// set, defaults to Gemini (the dev-mode env fallback).
function resolveTitleModel(apiKeys: UserApiKeys): string {
    if (apiKeys.gemini?.trim()) return DEFAULT_TITLE_MODEL;
    if (apiKeys.openai?.trim()) return OPENAI_LOW_MODELS[0];
    if (apiKeys.claude?.trim()) return "claude-haiku-4-5";
    return DEFAULT_TITLE_MODEL;
}

async function fetchApiKeys(userId: string): Promise<UserApiKeys> {
    const k = await getUserAiKeys(userId);
    return {
        claude: k.claude_api_key ?? null,
        gemini: k.gemini_api_key ?? null,
    };
}

export async function getUserModelSettings(
    userId: string,
    db?: ReturnType<typeof createServerSupabase>,
): Promise<UserModelSettings> {
    const client = db ?? createServerSupabase();
    const { data } = await client
        .from("user_profiles")
        .select("tabular_model")
        .eq("user_id", userId)
        .single();

    const api_keys = await fetchApiKeys(userId);

    return {
        title_model: resolveTitleModel(api_keys),
        tabular_model: resolveModel(data?.tabular_model, DEFAULT_TABULAR_MODEL),
        api_keys,
    };
}

export async function getUserApiKeys(
    userId: string,
    _db?: ReturnType<typeof createServerSupabase>,
): Promise<UserApiKeys> {
    return fetchApiKeys(userId);
}
