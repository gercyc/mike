// Word add-in API surface — wraps the shared MikeClient with local-password
// auth (token stored in localStorage by AuthContext / lib/auth.ts).

import { MikeClient } from "@mike/shared";
import type {
  AiKeysMap,
  MikeChat,
  MikeChatDetailOut,
  MikeWorkflow,
} from "@mike/shared";
import { API_BASE, authHeader, getMikeToken } from "./auth";

export { API_BASE };

export const mike = new MikeClient({
  baseUrl: API_BASE,
  getAuthToken: async () => getMikeToken(),
});

// ---------------------------------------------------------------------------
// Re-exports kept for backwards compatibility with existing add-in imports.
// These now thin-wrap the shared client.
// ---------------------------------------------------------------------------

export type { MikeProject as ApiProject, MikeDocument as ApiDocument } from "@mike/shared";

export interface ApiChatMessage {
  role: string;
  content: string;
  files?: { filename: string; document_id?: string }[];
  workflow?: { id: string; title: string };
}

export interface StreamChatPayload {
  messages: ApiChatMessage[];
  chat_id?: string;
  model?: string;
  /** Selected workflow to invoke server-side. */
  workflow?: { id: string; title: string };
  /** Document refs the user attached as additional context. */
  files?: { document_id?: string; filename: string }[];
  /** Edit mode for assistant suggestions: track changes vs. comments. */
  editMode?: "track" | "comments";
  /**
   * Current Word selection at compose time. When present and
   * `has_selection` is true, the agent should scope edits to this range
   * while still using the broader document for tone/context.
   */
  selection?: { text: string; has_selection: boolean };
  /**
   * Where assistant-authored content should land. `"project"` (default)
   * preserves the existing behavior of creating a new project document.
   * `"this_word_doc"` asks the assistant to write back into the user's
   * currently open Word document.
   */
  creation_mode?: "project" | "this_word_doc";
  signal?: AbortSignal;
}

export function streamChat(payload: StreamChatPayload): Promise<Response> {
  // We POST directly so we can pass through workflow/files/editMode fields
  // — MikeClient.streamChat strips unknown keys.
  const { signal, ...body } = payload;
  return fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...authHeader(),
    },
    body: JSON.stringify(body),
    signal,
  });
}

export function streamProjectChat(
  payload: StreamChatPayload & { projectId: string },
): Promise<Response> {
  const { signal, projectId, files, ...rest } = payload;
  // The project chat endpoint expects `attached_documents` rather than the
  // `files` field used by /chat. Translate so the doc refs surface in the
  // system prompt instead of being silently dropped.
  const body = {
    ...rest,
    attached_documents: files ?? undefined,
  };
  return fetch(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...authHeader(),
      },
      body: JSON.stringify(body),
      signal,
    },
  );
}

export function listChats(): Promise<MikeChat[]> {
  return mike.listChats();
}

export function getChat(chatId: string): Promise<MikeChatDetailOut> {
  return mike.getChat(chatId);
}

export function getProject(projectId: string) {
  return mike.getProject(projectId);
}

export function listAssistantWorkflows(): Promise<MikeWorkflow[]> {
  return fetch(`${API_BASE}/workflows?type=assistant`, {
    headers: { Accept: "application/json", ...authHeader() },
    cache: "no-store",
  }).then(async (r) => {
    if (!r.ok) throw new Error(`workflows ${r.status}`);
    const all = (await r.json()) as MikeWorkflow[];
    return all.filter((w) => w.type === "assistant");
  });
}

export function getAiKeys(): Promise<AiKeysMap> {
  return mike.getAiKeys();
}

export type { AiKeysMap, MikeChat, MikeChatDetailOut, MikeWorkflow };

export function listProjects() {
  return mike.listProjects();
}

export function listProjectDocuments(projectId: string) {
  return mike.listProjectDocuments(projectId);
}

export type {
  MikeWorkflow as ApiWorkflow,
  TabularReview as ApiTabularReview,
  TabularReviewDetailOut as ApiTabularReviewDetail,
} from "@mike/shared";

export function listWorkflows() {
  return mike.listWorkflows();
}

export function listTabularReviews(projectId?: string) {
  return mike.listTabularReviews(projectId);
}

export function getTabularReview(reviewId: string) {
  return mike.getTabularReview(reviewId);
}

export function getProjectDetail(projectId: string) {
  // Project detail with documents — the shared client exposes this via a
  // dedicated documents call; the /projects/:id endpoint also returns the
  // project bundle. We use listProjectDocuments which is what other parts
  // of the add-in already rely on.
  return mike.listProjectDocuments(projectId);
}

export async function uploadDocument(
  file: File,
): Promise<{ id: string; filename: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/single-documents`, {
    method: "POST",
    headers: authHeader(),
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

/**
 * Ask the Mike desktop shell to focus its window and route to `route`.
 * Implementation: backend publishes a `desktop.navigate` SSE event; the
 * Electron main process is subscribed via loopback bypass and handles the
 * focus + navigation. Far more reliable than the `mike://` URL scheme,
 * which gets hijacked by other Electron binaries on macOS in dev mode.
 */
export async function openInDesktop(route: string): Promise<void> {
  const res = await fetch(`${API_BASE}/desktop/navigate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ route }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
}

/**
 * Upload an in-memory .docx Blob (typically the bytes of the open Word doc
 * read via Office.js `getFileAsync`) to the user's project. Routes through
 * `POST /projects/:projectId/documents` so the existing storage + version
 * machinery on the server takes care of converting to PDF for previews,
 * registering a document_versions row, and broadcasting the new doc via
 * the SSE event bus.
 *
 * When `projectId` is null the file is saved as a standalone document
 * (no project) — same path that `POST /single-documents` uses.
 */
export async function uploadDocumentBlob(opts: {
  blob: Blob;
  filename: string;
  projectId: string | null;
}): Promise<{ id: string; filename: string }> {
  const form = new FormData();
  form.append("file", opts.blob, opts.filename);
  const url = opts.projectId
    ? `${API_BASE}/projects/${encodeURIComponent(opts.projectId)}/documents`
    : `${API_BASE}/single-documents`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeader(),
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Save a chunk of markdown text (typically the latest assistant reply) as
 * a project document. Backend converts the markdown to .docx via the same
 * pipeline the assistant's `generate_docx` tool uses.
 */
export async function uploadFromMarkdown(opts: {
  markdown: string;
  project_id?: string | null;
  filename?: string;
}): Promise<{
  id: string;
  filename: string;
  download_url: string;
  project_id: string | null;
}> {
  const res = await fetch(`${API_BASE}/single-documents/from-markdown`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}
