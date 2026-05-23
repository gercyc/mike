import { STATIC_MODELS, type ModelOption } from "../components/assistant/ModelToggle";
import type { ApiKeyState } from "@/app/lib/mikeApi";

export type ModelProvider = "claude" | "gemini" | "openai" | "openrouter";

export function getModelProvider(modelId: string): ModelProvider | null {
    // Known static models
    const model = STATIC_MODELS.find((m) => m.id === modelId);
    if (model) return modelGroupToProvider(model.group);
    // Dynamic OpenRouter models follow the pattern "org/model-name"
    if (modelId.includes("/") || modelId.startsWith("openrouter")) return "openrouter";
    return null;
}

export function isModelAvailable(
    modelId: string,
    apiKeys: ApiKeyState,
): boolean {
    const provider = getModelProvider(modelId);
    if (!provider) return false;
    return isProviderAvailable(provider, apiKeys);
}

export function isProviderAvailable(
    provider: ModelProvider,
    apiKeys: ApiKeyState,
): boolean {
    return !!apiKeys[provider]?.configured;
}

export function providerLabel(provider: ModelProvider): string {
    if (provider === "claude") return "Anthropic (Claude)";
    if (provider === "openai") return "OpenAI";
    if (provider === "openrouter") return "OpenRouter";
    return "Google (Gemini)";
}

export function modelGroupToProvider(
    group: ModelOption["group"],
): ModelProvider {
    if (group === "Anthropic") return "claude";
    if (group === "OpenAI") return "openai";
    if (group === "OpenRouter") return "openrouter";
    return "gemini";
}
