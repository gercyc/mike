// MCP token issuance + verification.
//
// Tokens look like `mike_mcp_<random>` and are sent as an Authorization
// Bearer credential by the MCP server to the backend. We store only the
// SHA-256 of the secret — the plaintext is shown to the user once at
// creation time and never persisted.

import crypto from "node:crypto";
import { createServerSupabase } from "./supabase";
import type { McpToken } from "@mike/shared";

const PREFIX = "mike_mcp_";

export function generateToken(): { secret: string; hash: string; preview: string } {
  const random = crypto.randomBytes(32).toString("base64url");
  const secret = `${PREFIX}${random}`;
  const hash = crypto.createHash("sha256").update(secret).digest("hex");
  const preview = secret.slice(-6);
  return { secret, hash, preview };
}

export function hashToken(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export interface ResolvedMcpToken {
  user_id: string;
  scope: "read" | "read_write";
  token_id: string;
}

/** Look up a presented secret. Returns null if no match. */
export async function resolveMcpToken(
  secret: string,
): Promise<ResolvedMcpToken | null> {
  if (!secret.startsWith(PREFIX)) return null;
  const hash = hashToken(secret);
  const db = createServerSupabase();
  const { data } = await db
    .from("mcp_tokens")
    .select("id, user_id, scope")
    .eq("secret_hash", hash)
    .single();
  if (!data) return null;

  // Update last_used_at — best-effort, fire-and-forget.
  void db
    .from("mcp_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    user_id: data.user_id as string,
    scope: data.scope as "read" | "read_write",
    token_id: data.id as string,
  };
}

export async function listMcpTokens(userId: string): Promise<McpToken[]> {
  const db = createServerSupabase();
  const { data } = await db
    .from("mcp_tokens")
    .select("id, user_id, label, preview, scope, created_at, last_used_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as McpToken[];
}

export async function createMcpToken(
  userId: string,
  label: string,
  scope: "read" | "read_write" = "read_write",
): Promise<{ token: McpToken; secret: string }> {
  const { secret, hash, preview } = generateToken();
  const db = createServerSupabase();
  const { data, error } = await db
    .from("mcp_tokens")
    .insert({
      user_id: userId,
      label,
      secret_hash: hash,
      preview,
      scope,
    })
    .select("id, user_id, label, preview, scope, created_at, last_used_at")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create token");
  return { token: data as McpToken, secret };
}

export async function revokeMcpToken(
  userId: string,
  tokenId: string,
): Promise<void> {
  const db = createServerSupabase();
  await db
    .from("mcp_tokens")
    .delete()
    .eq("id", tokenId)
    .eq("user_id", userId);
}
