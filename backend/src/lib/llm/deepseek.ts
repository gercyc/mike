import type {
    LlmMessage,
    NormalizedToolCall,
    NormalizedToolResult,
    OpenAIToolSchema,
    StreamChatParams,
    StreamChatResult,
} from "./types";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
const MAX_OUTPUT_TOKENS = 8192;

type AssistantToolCall = {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
};

type ChatMessage =
    | { role: "system" | "user"; content: string }
    | { role: "assistant"; content: string | null; reasoning_content?: string; tool_calls?: AssistantToolCall[] }
    | { role: "tool"; tool_call_id: string; content: string };

type ToolFunction = {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
};

type ChatTool = { type: "function"; function: ToolFunction };

type ToolCallDelta = {
    index: number;
    id?: string;
    type?: "function";
    function?: { name?: string; arguments?: string };
};

type StreamDelta = {
    role?: string;
    content?: string | null;
    reasoning_content?: string | null;
    tool_calls?: ToolCallDelta[];
};

type StreamChoice = { delta: StreamDelta; finish_reason?: string | null };

type StreamChunk = { choices?: StreamChoice[] };

function apiKey(override?: string | null): string {
    const key = override?.trim() || process.env.DEEPSEEK_API_KEY?.trim() || "";
    if (!key) {
        throw new Error(
            "DeepSeek API key is not configured. Set DEEPSEEK_API_KEY or add a user DeepSeek key.",
        );
    }
    return key;
}

function toMessages(systemPrompt: string | undefined, messages: LlmMessage[]): ChatMessage[] {
    const result: ChatMessage[] = [];
    if (systemPrompt) result.push({ role: "system", content: systemPrompt });
    for (const m of messages) {
        if (m.role === "assistant") {
            result.push({ role: "assistant", content: m.content });
        } else {
            result.push({ role: "user", content: m.content });
        }
    }
    return result;
}

function toChatTools(tools: OpenAIToolSchema[]): ChatTool[] {
    return tools.map((t) => ({
        type: "function",
        function: {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
        },
    }));
}

function extractSseJson(buffer: string): { events: unknown[]; rest: string } {
    const events: unknown[] = [];
    const chunks = buffer.split(/\n\n/);
    const rest = chunks.pop() ?? "";

    for (const chunk of chunks) {
        const dataLines = chunk
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim());

        for (const data of dataLines) {
            if (!data || data === "[DONE]") continue;
            try {
                events.push(JSON.parse(data));
            } catch {
                // Incomplete SSE events are buffered until the next read.
            }
        }
    }

    return { events, rest };
}

async function chatCompletionStream(params: {
    model: string;
    messages: ChatMessage[];
    tools?: ChatTool[];
    maxTokens?: number;
    apiKey: string;
}): Promise<Response> {
    const body: Record<string, unknown> = {
        model: params.model,
        messages: params.messages,
        stream: true,
        max_tokens: params.maxTokens ?? MAX_OUTPUT_TOKENS,
    };
    if (params.tools?.length) body.tools = params.tools;

    const response = await fetch(DEEPSEEK_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${params.apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        const err = new Error(
            `DeepSeek request failed (${response.status}): ${text || response.statusText}`,
        );
        (err as { status?: number }).status = response.status;
        throw err;
    }

    return response;
}

export async function streamDeepSeek(
    params: StreamChatParams,
): Promise<StreamChatResult> {
    const {
        model,
        systemPrompt,
        tools = [],
        callbacks = {},
        runTools,
        apiKeys,
    } = params;
    const maxIter = params.maxIterations ?? 10;
    const key = apiKey(apiKeys?.deepseek);
    const chatTools = toChatTools(tools);
    let messages = toMessages(systemPrompt, params.messages);
    let fullText = "";

    for (let iter = 0; iter < maxIter; iter++) {
        const response = await chatCompletionStream({
            model,
            messages,
            tools: chatTools,
            apiKey: key,
        });
        if (!response.body) throw new Error("DeepSeek response had no body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        let iterText = "";
        let iterReasoning = "";
        const toolCallMap = new Map<
            number,
            { id: string; name: string; arguments: string }
        >();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const extracted = extractSseJson(buffer);
            buffer = extracted.rest;

            for (const event of extracted.events as StreamChunk[]) {
                const delta = event.choices?.[0]?.delta;
                if (!delta) continue;

                if (typeof delta.reasoning_content === "string") {
                    iterReasoning += delta.reasoning_content;
                    callbacks.onReasoningDelta?.(delta.reasoning_content);
                }

                if (typeof delta.content === "string") {
                    iterText += delta.content;
                    callbacks.onContentDelta?.(delta.content);
                }

                for (const tc of delta.tool_calls ?? []) {
                    const existing = toolCallMap.get(tc.index);
                    if (!existing) {
                        const call = {
                            id: tc.id ?? `tool-${tc.index}`,
                            name: tc.function?.name ?? "",
                            arguments: tc.function?.arguments ?? "",
                        };
                        toolCallMap.set(tc.index, call);
                        callbacks.onToolCallStart?.({
                            id: call.id,
                            name: call.name,
                            input: {},
                        });
                    } else {
                        if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                        if (tc.function?.name) existing.name = tc.function.name;
                    }
                }
            }
        }

        fullText += iterText;

        if (!toolCallMap.size || !runTools) break;

        const toolCalls: NormalizedToolCall[] = Array.from(toolCallMap.values()).map((tc) => {
            let input: Record<string, unknown> = {};
            try {
                const parsed = JSON.parse(tc.arguments || "{}");
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                    input = parsed as Record<string, unknown>;
                }
            } catch {
                input = {};
            }
            return { id: tc.id, name: tc.name, input };
        });

        const toolCallsForMessage: AssistantToolCall[] = Array.from(toolCallMap.values()).map(
            (tc) => ({
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: tc.arguments },
            }),
        );

        messages = [
            ...messages,
            {
                role: "assistant",
                content: iterText || null,
                ...(iterReasoning ? { reasoning_content: iterReasoning } : {}),
                tool_calls: toolCallsForMessage,
            },
            ...((await runTools(toolCalls)) as NormalizedToolResult[]).map(
                (r): ChatMessage => ({
                    role: "tool",
                    tool_call_id: r.tool_use_id,
                    content: r.content,
                }),
            ),
        ];
    }

    return { fullText };
}

export async function completeDeepSeekText(params: {
    model: string;
    systemPrompt?: string;
    user: string;
    maxTokens?: number;
    apiKeys?: { deepseek?: string | null };
}): Promise<string> {
    const messages = toMessages(params.systemPrompt, [
        { role: "user", content: params.user },
    ]);

    const response = await fetch(DEEPSEEK_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey(params.apiKeys?.deepseek)}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: params.model,
            messages,
            max_tokens: params.maxTokens ?? 512,
        }),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
            `DeepSeek request failed (${response.status}): ${text || response.statusText}`,
        );
    }

    const json = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
    };
    return json.choices?.[0]?.message?.content ?? "";
}

export type { NormalizedToolResult };
