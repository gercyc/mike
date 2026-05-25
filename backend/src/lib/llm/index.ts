import { streamClaude, completeClaudeText } from "./claude";
import { streamGemini, completeGeminiText } from "./gemini";
import { streamOpenAI, completeOpenAIText } from "./openai";
import { streamOpenRouter, completeOpenRouterText } from "./openrouter";
import { streamDeepSeek, completeDeepSeekText } from "./deepseek";
import { providerForModel } from "./models";
import type { StreamChatParams, StreamChatResult, UserApiKeys } from "./types";

export * from "./types";
export * from "./models";

export async function streamChatWithTools(
    params: StreamChatParams,
): Promise<StreamChatResult> {
    const provider = providerForModel(params.model);
    try {
        if (provider === "claude") return await streamClaude(params);
        if (provider === "openai") return await streamOpenAI(params);
        if (provider === "openrouter") return await streamOpenRouter(params);
        if (provider === "deepseek") return await streamDeepSeek(params);
        return await streamGemini(params);
    } catch (err) {
        console.error(`[llm/stream] provider=${provider} model=${params.model} error:`, err);
        throw err;
    }
}

export async function completeText(params: {
    model: string;
    systemPrompt?: string;
    user: string;
    maxTokens?: number;
    apiKeys?: UserApiKeys;
}): Promise<string> {
    const provider = providerForModel(params.model);
    try {
        if (provider === "claude") return await completeClaudeText(params);
        if (provider === "openai") return await completeOpenAIText(params);
        if (provider === "openrouter") return await completeOpenRouterText(params);
        if (provider === "deepseek") return await completeDeepSeekText(params);
        return await completeGeminiText(params);
    } catch (err) {
        console.error(`[llm/complete] provider=${provider} model=${params.model} error:`, err);
        throw err;
    }
}
