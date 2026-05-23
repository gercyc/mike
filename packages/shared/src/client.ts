// Single HTTP client shared across frontend, word-addin, electron renderer,
// and mcp-server. Auth token resolution is pluggable so each surface can
// hand in its localStorage / electron-store / static-token strategy.

import type {
  AiKeysMap,
  AiProvider,
  AiProviderKey,
  MikeChat,
  MikeChatDetailOut,
  MikeDocument,
  MikeProject,
  MikeWorkflow,
  TabularReview,
  TabularReviewDetailOut,
  McpToken,
} from "./types";

export type AuthTokenProvider = () => Promise<string | null>;

export interface MikeClientOptions {
  baseUrl: string;
  /** Returns the bearer token to attach to requests, or null for unauthenticated. */
  getAuthToken: AuthTokenProvider;
  /** Optional custom fetch (useful for SSR / tests). */
  fetchImpl?: typeof fetch;
}

export class MikeApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`Mike API error ${status}: ${body || "(no body)"}`);
    this.status = status;
    this.body = body;
  }
}

export class MikeClient {
  readonly baseUrl: string;
  private readonly getAuthToken: AuthTokenProvider;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: MikeClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.getAuthToken = opts.getAuthToken;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const auth = await this.authHeaders();
    const { headers: initHeaders, ...rest } = init ?? {};
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      cache: "no-store",
      ...rest,
      headers: {
        Accept: "application/json",
        ...auth,
        ...(initHeaders as Record<string, string> | undefined),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new MikeApiError(res.status, body);
    }
    if (res.status === 204 || res.headers.get("content-length") === "0") {
      return undefined as T;
    }
    return (await res.json()) as T;
  }

  /** Returns the raw Response, e.g. for SSE streaming. */
  async raw(path: string, init?: RequestInit): Promise<Response> {
    const auth = await this.authHeaders();
    const { headers: initHeaders, ...rest } = init ?? {};
    return this.fetchImpl(`${this.baseUrl}${path}`, {
      ...rest,
      headers: { ...auth, ...(initHeaders as Record<string, string> | undefined) },
    });
  }

  // -------------------------------------------------------------------------
  // Projects
  // -------------------------------------------------------------------------

  listProjects(): Promise<MikeProject[]> {
    return this.request<MikeProject[]>("/projects");
  }

  getProject(projectId: string): Promise<MikeProject> {
    return this.request<MikeProject>(
      `/projects/${encodeURIComponent(projectId)}`,
    );
  }

  createProject(input: {
    name: string;
    cm_number?: string;
    shared_with?: string[];
  }): Promise<MikeProject> {
    return this.request<MikeProject>("/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  updateProject(
    projectId: string,
    patch: Partial<Pick<MikeProject, "name" | "cm_number" | "shared_with">>,
  ): Promise<MikeProject> {
    return this.request<MikeProject>(
      `/projects/${encodeURIComponent(projectId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      },
    );
  }

  deleteProject(projectId: string): Promise<void> {
    return this.request<void>(
      `/projects/${encodeURIComponent(projectId)}`,
      { method: "DELETE" },
    );
  }

  // -------------------------------------------------------------------------
  // Documents
  // -------------------------------------------------------------------------

  listProjectDocuments(projectId: string): Promise<MikeDocument[]> {
    return this.request<MikeDocument[]>(
      `/projects/${encodeURIComponent(projectId)}/documents`,
    );
  }

  listSingleDocuments(): Promise<MikeDocument[]> {
    return this.request<MikeDocument[]>("/single-documents");
  }

  // -------------------------------------------------------------------------
  // Chats
  // -------------------------------------------------------------------------

  listChats(): Promise<MikeChat[]> {
    return this.request<MikeChat[]>("/chat");
  }

  getChat(chatId: string): Promise<MikeChatDetailOut> {
    return this.request<MikeChatDetailOut>(
      `/chat/${encodeURIComponent(chatId)}`,
    );
  }

  /**
   * Open a streaming chat connection.
   * Caller is responsible for parsing the SSE stream from `Response.body`.
   */
  streamChat(payload: {
    messages: { role: string; content: string }[];
    chat_id?: string;
    project_id?: string;
    model?: string;
    /** Phase 5 — when true, server runs Presidio redact/unredact around AI call. */
    hidden?: boolean;
    signal?: AbortSignal;
  }): Promise<Response> {
    const { signal, project_id, ...body } = payload;
    const path = project_id
      ? `/projects/${encodeURIComponent(project_id)}/chat`
      : "/chat";
    return this.raw(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
      signal,
    });
  }

  // -------------------------------------------------------------------------
  // Workflows
  // -------------------------------------------------------------------------

  listWorkflows(): Promise<MikeWorkflow[]> {
    return this.request<MikeWorkflow[]>("/workflows");
  }

  // -------------------------------------------------------------------------
  // Tabular reviews
  // -------------------------------------------------------------------------

  listTabularReviews(projectId?: string): Promise<TabularReview[]> {
    const qs = projectId
      ? `?project_id=${encodeURIComponent(projectId)}`
      : "";
    return this.request<TabularReview[]>(`/tabular-review${qs}`);
  }

  getTabularReview(reviewId: string): Promise<TabularReviewDetailOut> {
    return this.request<TabularReviewDetailOut>(
      `/tabular-review/${encodeURIComponent(reviewId)}`,
    );
  }

  // -------------------------------------------------------------------------
  // AI keys (Phase 3)
  // -------------------------------------------------------------------------

  getAiKeys(): Promise<AiKeysMap> {
    return this.request<AiKeysMap>("/user/ai-keys");
  }

  setAiKey(provider: AiProvider, key: AiProviderKey): Promise<AiKeysMap> {
    return this.request<AiKeysMap>(
      `/user/ai-keys/${encodeURIComponent(provider)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(key),
      },
    );
  }

  deleteAiKey(provider: AiProvider): Promise<AiKeysMap> {
    return this.request<AiKeysMap>(
      `/user/ai-keys/${encodeURIComponent(provider)}`,
      { method: "DELETE" },
    );
  }

  testAiKey(
    provider: AiProvider,
  ): Promise<{ ok: boolean; latency_ms: number; error?: string }> {
    return this.request(
      `/user/ai-keys/${encodeURIComponent(provider)}/test`,
      { method: "POST" },
    );
  }

  // -------------------------------------------------------------------------
  // MCP tokens (Phase 4)
  // -------------------------------------------------------------------------

  listMcpTokens(): Promise<McpToken[]> {
    return this.request<McpToken[]>("/user/mcp-tokens");
  }

  createMcpToken(input: {
    label: string;
    scope?: "read" | "read_write";
  }): Promise<{ token: McpToken; secret: string }> {
    return this.request("/user/mcp-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "read_write", ...input }),
    });
  }

  revokeMcpToken(tokenId: string): Promise<void> {
    return this.request<void>(
      `/user/mcp-tokens/${encodeURIComponent(tokenId)}`,
      { method: "DELETE" },
    );
  }

  // -------------------------------------------------------------------------
  // Live event bus (Phase 2)
  // -------------------------------------------------------------------------

  /** Open the SSE event bus. Caller parses the stream. */
  events(signal?: AbortSignal): Promise<Response> {
    return this.raw("/events", {
      headers: { Accept: "text/event-stream" },
      signal,
    });
  }
}
