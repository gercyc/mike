import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { eq, or, inArray, desc, asc, and } from "drizzle-orm";
import {
    getDb,
    chats,
    chatMessages,
    projects,
    documentEdits,
    documentVersions,
} from "../db";
import {
    buildDocContext,
    buildMessages,
    enrichWithPriorEvents,
    buildWorkflowStore,
    extractAnnotations,
    runLLMStream,
    type ChatMessage,
} from "../lib/chatTools";
import { completeText } from "../lib/llm";
import { getUserApiKeys, getUserModelSettings } from "../lib/userSettings";
import { checkProjectAccess } from "../lib/access";

export const chatRouter = Router();

const isDev = process.env.NODE_ENV !== "production";
const devLog = (...args: Parameters<typeof console.log>) => {
    if (isDev) console.log(...args);
};

type AccessibleChat = {
    id: string;
    title: string | null;
    userId: string;
    projectId: string | null;
} & Record<string, unknown>;

function parseOptionalProjectId(value: unknown):
    | { ok: true; provided: boolean; projectId: string | null }
    | { ok: false; detail: string } {
    if (value === undefined)
        return { ok: true, provided: false, projectId: null };
    if (value === null) return { ok: true, provided: true, projectId: null };
    if (typeof value !== "string" || !value.trim()) {
        return {
            ok: false,
            detail: "project_id must be a non-empty string or null",
        };
    }
    return { ok: true, provided: true, projectId: value.trim() };
}

function parseOptionalChatId(value: unknown):
    | { ok: true; chatId: string | null }
    | { ok: false; detail: string } {
    if (value === undefined || value === null) return { ok: true, chatId: null };
    if (typeof value !== "string" || !value.trim()) {
        return { ok: false, detail: "chat_id must be a non-empty string" };
    }
    return { ok: true, chatId: value.trim() };
}

function parseChatMessages(value: unknown):
    | { ok: true; messages: ChatMessage[] }
    | { ok: false; detail: string } {
    if (!Array.isArray(value) || value.length === 0) {
        return { ok: false, detail: "messages must be a non-empty array" };
    }

    for (const message of value) {
        if (!message || typeof message !== "object" || Array.isArray(message)) {
            return { ok: false, detail: "messages must contain objects" };
        }
        const row = message as Record<string, unknown>;
        if (typeof row.role !== "string") {
            return { ok: false, detail: "message.role must be a string" };
        }
        if (row.content !== null && typeof row.content !== "string") {
            return {
                ok: false,
                detail: "message.content must be a string or null",
            };
        }
    }

    return { ok: true, messages: value as ChatMessage[] };
}

function parseOptionalModel(value: unknown):
    | { ok: true; model: string | undefined }
    | { ok: false; detail: string } {
    if (value === undefined) return { ok: true, model: undefined };
    if (typeof value !== "string" || !value.trim()) {
        return { ok: false, detail: "model must be a non-empty string" };
    }
    return { ok: true, model: value.trim() };
}

async function validateAccessibleProjectId(
    projectId: string | null,
    userId: string,
    userEmail: string | null | undefined,
): Promise<{ ok: true } | { ok: false; status: number; detail: string }> {
    if (!projectId) return { ok: true };
    const access = await checkProjectAccess(projectId, userId, userEmail);
    if (!access.ok)
        return { ok: false, status: 404, detail: "Project not found" };
    return { ok: true };
}

async function getAccessibleChat(
    chatId: string,
    userId: string,
    userEmail: string | null | undefined,
): Promise<AccessibleChat | null> {
    const [chat] = await getDb()
        .select()
        .from(chats)
        .where(eq(chats.id, chatId))
        .limit(1);
    if (!chat) return null;

    if (chat.userId === userId) return chat as unknown as AccessibleChat;

    if (chat.projectId) {
        const access = await checkProjectAccess(
            chat.projectId,
            userId,
            userEmail,
        );
        if (access.ok) return chat as unknown as AccessibleChat;
    }

    return null;
}

// GET /chat
chatRouter.get("/", requireAuth, async (req, res) => {
    const userId = res.locals.userId as string;
    const requestedLimit = Number.parseInt(String(req.query.limit ?? ""), 10);
    const limit = Number.isFinite(requestedLimit)
        ? Math.min(Math.max(requestedLimit, 1), 100)
        : null;

    const ownProjects = await getDb()
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.userId, userId));
    const ownProjectIds = ownProjects.map((p) => p.id);

    let rows;
    if (ownProjectIds.length > 0) {
        let query = getDb()
            .select()
            .from(chats)
            .where(or(eq(chats.userId, userId), inArray(chats.projectId, ownProjectIds)))
            .orderBy(desc(chats.createdAt))
            .$dynamic();
        if (limit) query = query.limit(limit);
        rows = await query;
    } else {
        let query = getDb()
            .select()
            .from(chats)
            .where(eq(chats.userId, userId))
            .orderBy(desc(chats.createdAt))
            .$dynamic();
        if (limit) query = query.limit(limit);
        rows = await query;
    }

    // Serialize camelCase → snake_case for response shape compatibility
    res.json(rows.map(serializeChat));
});

// POST /chat/create
chatRouter.post("/create", requireAuth, async (req, res) => {
    const userId = res.locals.userId as string;
    const userEmail = res.locals.userEmail as string | undefined;
    const parsedProjectId = parseOptionalProjectId(req.body?.project_id);
    if (!parsedProjectId.ok) {
        return void res.status(400).json({ detail: parsedProjectId.detail });
    }
    const projectId = parsedProjectId.projectId;
    const projectAccess = await validateAccessibleProjectId(
        projectId,
        userId,
        userEmail,
    );
    if (!projectAccess.ok)
        return void res
            .status(projectAccess.status)
            .json({ detail: projectAccess.detail });

    const [row] = await getDb()
        .insert(chats)
        .values({ userId, projectId: projectId ?? null })
        .returning({ id: chats.id });

    if (!row) return void res.status(500).json({ detail: "Failed to create chat" });
    res.json({ id: row.id });
});

// GET /chat/:chatId
chatRouter.get("/:chatId", requireAuth, async (req, res) => {
    const userId = res.locals.userId as string;
    const userEmail = res.locals.userEmail as string | undefined;
    const { chatId } = req.params;

    const chat = await getAccessibleChat(chatId, userId, userEmail);
    if (!chat)
        return void res.status(404).json({ detail: "Chat not found" });

    const messages = await getDb()
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.chatId, chatId))
        .orderBy(asc(chatMessages.createdAt));

    const hydrated = await hydrateEditStatuses(messages as Record<string, unknown>[]);
    res.json({ chat: serializeChat(chat), messages: hydrated });
});

async function hydrateEditStatuses(
    messages: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
    const editIds = new Set<string>();
    const versionIds = new Set<string>();
    const collectFromAnnList = (list: unknown) => {
        if (!Array.isArray(list)) return;
        for (const a of list as Record<string, unknown>[]) {
            if (typeof a?.edit_id === "string") editIds.add(a.edit_id);
            if (typeof a?.version_id === "string")
                versionIds.add(a.version_id);
        }
    };
    for (const m of messages) {
        collectFromAnnList(m.annotations);
        const content = m.content;
        if (Array.isArray(content)) {
            for (const ev of content as Record<string, unknown>[]) {
                if (ev?.type === "doc_edited") {
                    collectFromAnnList(ev.annotations);
                    if (typeof ev.version_id === "string")
                        versionIds.add(ev.version_id);
                }
            }
        }
    }
    if (editIds.size === 0 && versionIds.size === 0) return messages;

    const statusById = new Map<string, "pending" | "accepted" | "rejected">();
    if (editIds.size > 0) {
        const rows = await getDb()
            .select({ id: documentEdits.id, status: documentEdits.status })
            .from(documentEdits)
            .where(inArray(documentEdits.id, Array.from(editIds)));
        for (const r of rows) {
            if (
                r.status === "pending" ||
                r.status === "accepted" ||
                r.status === "rejected"
            ) {
                statusById.set(r.id, r.status as "pending" | "accepted" | "rejected");
            }
        }
    }

    const versionNumberById = new Map<string, number | null>();
    if (versionIds.size > 0) {
        const rows = await getDb()
            .select({ id: documentVersions.id, versionNumber: documentVersions.versionNumber })
            .from(documentVersions)
            .where(inArray(documentVersions.id, Array.from(versionIds)));
        for (const r of rows) {
            versionNumberById.set(r.id, r.versionNumber ?? null);
        }
    }

    const patchAnnList = (list: unknown): unknown => {
        if (!Array.isArray(list)) return list;
        return (list as Record<string, unknown>[]).map((a) => {
            let next = a;
            if (typeof a?.edit_id === "string" && statusById.has(a.edit_id)) {
                next = { ...next, status: statusById.get(a.edit_id) };
            }
            if (
                typeof a?.version_id === "string" &&
                versionNumberById.has(a.version_id)
            ) {
                next = {
                    ...next,
                    version_number: versionNumberById.get(a.version_id) ?? null,
                };
            }
            return next;
        });
    };
    return messages.map((m) => {
        const next: Record<string, unknown> = { ...m };
        next.annotations = patchAnnList(m.annotations);
        if (Array.isArray(m.content)) {
            next.content = (m.content as Record<string, unknown>[]).map(
                (ev) => {
                    if (ev?.type !== "doc_edited") return ev;
                    let patched: Record<string, unknown> = {
                        ...ev,
                        annotations: patchAnnList(ev.annotations),
                    };
                    if (
                        typeof ev.version_id === "string" &&
                        versionNumberById.has(ev.version_id)
                    ) {
                        patched = {
                            ...patched,
                            version_number:
                                versionNumberById.get(ev.version_id) ?? null,
                        };
                    }
                    return patched;
                },
            );
        }
        return next;
    });
}

// PATCH /chat/:chatId
chatRouter.patch("/:chatId", requireAuth, async (req, res) => {
    const userId = res.locals.userId as string;
    const { chatId } = req.params;
    const title = (req.body.title ?? "").trim();
    if (!title)
        return void res.status(400).json({ detail: "title is required" });

    const [updated] = await getDb()
        .update(chats)
        .set({ title })
        .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
        .returning({ id: chats.id, title: chats.title });

    if (!updated)
        return void res.status(404).json({ detail: "Chat not found" });
    res.json({ id: updated.id, title: updated.title });
});

// DELETE /chat/:chatId
chatRouter.delete("/:chatId", requireAuth, async (req, res) => {
    const userId = res.locals.userId as string;
    const { chatId } = req.params;
    await getDb()
        .delete(chats)
        .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));
    res.status(204).send();
});

// POST /chat/:chatId/generate-title
chatRouter.post("/:chatId/generate-title", requireAuth, async (req, res) => {
    const userId = res.locals.userId as string;
    const userEmail = res.locals.userEmail as string | undefined;
    const { chatId } = req.params;
    const message =
        typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message)
        return void res.status(400).json({ detail: "message is required" });

    const chat = await getAccessibleChat(chatId, userId, userEmail);
    if (!chat)
        return void res.status(404).json({ detail: "Chat not found" });

    try {
        const { title_model, api_keys } = await getUserModelSettings(userId);
        const titleText = await completeText({
            model: title_model,
            user: `Generate a concise title (3–6 words) for a chat in an AI Legal Platform that starts with this message. The title should describe the topic or document — do NOT include words like "Legal Assistant", "AI", "Chat", or any similar prefix. Return only the title, no quotes or punctuation.\n\nMessage: ${message.slice(0, 500)}`,
            maxTokens: 64,
            apiKeys: api_keys,
        });
        const title = titleText.trim() || message.slice(0, 60);

        await getDb()
            .update(chats)
            .set({ title })
            .where(eq(chats.id, chatId));

        res.json({ title });
    } catch (err) {
        console.error("[generate-title]", err);
        res.status(500).json({ detail: "Failed to generate title" });
    }
});

// POST /chat — streaming
chatRouter.post("/", requireAuth, async (req, res) => {
    const userId = res.locals.userId as string;
    const body =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
            ? (req.body as Record<string, unknown>)
            : {};
    const parsedMessages = parseChatMessages(body.messages);
    if (!parsedMessages.ok) {
        return void res.status(400).json({ detail: parsedMessages.detail });
    }
    const parsedChatId = parseOptionalChatId(body.chat_id);
    if (!parsedChatId.ok) {
        return void res.status(400).json({ detail: parsedChatId.detail });
    }
    const parsedProjectId = parseOptionalProjectId(body.project_id);
    if (!parsedProjectId.ok) {
        return void res.status(400).json({ detail: parsedProjectId.detail });
    }
    const parsedModel = parseOptionalModel(body.model);
    if (!parsedModel.ok) {
        return void res.status(400).json({ detail: parsedModel.detail });
    }

    const messages = parsedMessages.messages;
    const chat_id = parsedChatId.chatId;
    const project_id = parsedProjectId.projectId;
    const model = parsedModel.model;

    devLog("[chat/stream] incoming request", {
        userId,
        chat_id,
        project_id,
        model,
        messageCount: messages?.length,
    });

    const userEmail = res.locals.userEmail as string | undefined;
    let chatId = chat_id ?? null;
    let chatTitle: string | null = null;
    let resolvedProjectId: string | null = parsedProjectId.projectId;

    if (chatId) {
        const existing = await getAccessibleChat(chatId, userId, userEmail);
        if (!existing)
            return void res.status(404).json({ detail: "Chat not found" });

        const existingProjectId = existing.projectId ?? null;
        if (
            parsedProjectId.provided &&
            parsedProjectId.projectId !== existingProjectId
        ) {
            return void res
                .status(400)
                .json({ detail: "project_id does not match chat" });
        }
        resolvedProjectId = existingProjectId;
        chatTitle = existing.title;
    }

    if (!chatId) {
        const projectAccess = await validateAccessibleProjectId(
            resolvedProjectId,
            userId,
            userEmail,
        );
        if (!projectAccess.ok)
            return void res
                .status(projectAccess.status)
                .json({ detail: projectAccess.detail });

        const [newChat] = await getDb()
            .insert(chats)
            .values({ userId, projectId: resolvedProjectId })
            .returning({ id: chats.id, title: chats.title });
        if (!newChat) {
            console.error("[chat/stream] failed to create chat");
            return void res
                .status(500)
                .json({ detail: "Failed to create chat" });
        }
        chatId = newChat.id;
        chatTitle = newChat.title ?? null;
    }

    devLog("[chat/stream] resolved chatId", chatId);

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
        await getDb().insert(chatMessages).values({
            chatId,
            role: "user",
            content: lastUser.content as unknown as Record<string, unknown>,
            files: (lastUser.files ?? null) as unknown as Record<string, unknown> | null,
            annotations: (lastUser.workflow ?? null) as unknown as Record<string, unknown> | null,
        });
    }

    const dbForTools = null;

    const { docIndex, docStore } = await buildDocContext(
        messages,
        userId,
        chatId,
    );
    const docAvailability = Object.entries(docIndex).map(([doc_id, info]) => ({
        doc_id,
        filename: info.filename,
    }));
    const enrichedMessages = await enrichWithPriorEvents(
        messages,
        chatId,
        dbForTools,
        docIndex,
    );
    const apiMessages = buildMessages(enrichedMessages, docAvailability);

    const workflowStore = await buildWorkflowStore(userId, userEmail);

    devLog("[chat/stream] starting LLM stream", {
        apiMessageCount: apiMessages.length,
        docCount: Object.keys(docIndex).length,
        workflowCount: Object.keys(workflowStore).length,
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const write = (line: string) => res.write(line);

    const apiKeys = await getUserApiKeys(userId);

    try {
        write(`data: ${JSON.stringify({ type: "chat_id", chatId })}\n\n`);

        const { fullText, events } = await runLLMStream({
            apiMessages,
            docStore,
            docIndex,
            userId,
            write,
            workflowStore,
            model,
            apiKeys,
            projectId: resolvedProjectId,
        });

        devLog("[chat/stream] LLM stream finished", {
            fullTextLen: fullText?.length ?? 0,
            eventCount: events?.length ?? 0,
        });

        const annotations = extractAnnotations(fullText, docIndex, events);
        await getDb().insert(chatMessages).values({
            chatId,
            role: "assistant",
            content: (events.length ? events : null) as unknown as Record<string, unknown> | null,
            annotations: (annotations.length ? annotations : null) as unknown as Record<string, unknown> | null,
        });

        if (!chatTitle && lastUser?.content) {
            await getDb()
                .update(chats)
                .set({ title: lastUser.content.slice(0, 120) })
                .where(eq(chats.id, chatId));
        }
    } catch (err) {
        console.error("[chat/stream] error:", err);
        try {
            write(
                `data: ${JSON.stringify({ type: "error", message: "Stream error" })}\n\n`,
            );
            write("data: [DONE]\n\n");
        } catch {
            /* ignore */
        }
    } finally {
        res.end();
    }
});

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

function serializeChat(row: Record<string, unknown>): Record<string, unknown> {
    if (!row) return row;
    const out: Record<string, unknown> = { ...row };
    // Map Drizzle camelCase → snake_case for response compatibility
    if ("userId" in out) { out.user_id = out.userId; delete out.userId; }
    if ("projectId" in out) { out.project_id = out.projectId; delete out.projectId; }
    if ("createdAt" in out) { out.created_at = out.createdAt; delete out.createdAt; }
    return out;
}

