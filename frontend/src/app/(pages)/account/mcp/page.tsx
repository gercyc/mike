"use client";

// MCP server control panel.
//
// Lets the user issue + revoke long-lived MCP tokens, then shows ready-to-paste
// config snippets for Claude Desktop / Cursor / generic MCP clients.

import { useEffect, useState, useCallback } from "react";
import { Copy, Check, Trash2, Plus, Loader2, AlertCircle } from "lucide-react";
import type { McpToken } from "@mike/shared";
import { mike } from "@/app/lib/mikeClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function McpPage() {
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [justCreated, setJustCreated] = useState<{
    token: McpToken;
    secret: string;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTokens(await mike.listMcpTokens());
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

  async function create() {
    if (!label.trim()) return;
    setCreating(true);
    try {
      const result = await mike.createMcpToken({ label: label.trim() });
      setJustCreated(result);
      setLabel("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function revoke(tokenId: string) {
    if (!confirm("Revoke this token? Any agent using it will be disconnected.")) {
      return;
    }
    try {
      await mike.revokeMcpToken(tokenId);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const claudeDesktopConfig = justCreated
    ? JSON.stringify(
        {
          mcpServers: {
            mike: {
              command: "npx",
              args: ["-y", "@mike/mcp-server", "stdio"],
              env: {
                MIKE_TOKEN: justCreated.secret,
                MIKE_BACKEND_URL: "http://127.0.0.1:3001",
              },
            },
          },
        },
        null,
        2,
      )
    : "";

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
        <h2 className="text-2xl font-medium font-serif mb-1">MCP Server</h2>
        <p className="text-sm text-gray-600">
          Connect Mike to other AI tools using the Model Context Protocol.
          Issue a token below, paste it into your MCP client, and Mike's
          projects, documents, chats, and workflows become available there.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {justCreated && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="text-sm font-medium text-amber-900">
            Save this token now — it won't be shown again.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-white px-2 py-1 text-xs font-mono break-all">
              {justCreated.secret}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copy(justCreated.secret, "secret")}
            >
              {copied === "secret" ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>

          <div className="text-xs font-medium text-amber-900 pt-2">
            Claude Desktop config (~/Library/Application Support/Claude/claude_desktop_config.json):
          </div>
          <div className="relative">
            <pre className="rounded bg-white p-2 text-xs font-mono overflow-x-auto">
              {claudeDesktopConfig}
            </pre>
            <Button
              size="sm"
              variant="outline"
              className="absolute top-2 right-2"
              onClick={() => copy(claudeDesktopConfig, "config")}
            >
              {copied === "config" ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setJustCreated(null)}
          >
            Done
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="font-medium text-sm">Issue new token</div>
        <div className="flex items-center gap-2">
          <Input
            placeholder='Label, e.g. "Claude Desktop on MacBook"'
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <Button onClick={create} disabled={creating || !label.trim()}>
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Plus className="w-4 h-4 mr-1" /> Issue
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="font-medium text-sm">Active tokens</div>
        {tokens.length === 0 ? (
          <div className="text-xs text-gray-500 italic">
            No tokens yet. Issue one above to connect Mike to an MCP client.
          </div>
        ) : (
          <div className="space-y-2">
            {tokens.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-md border border-gray-200 p-3 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.label}</div>
                  <div className="text-xs text-gray-500">
                    <span className="font-mono">…{t.preview}</span>
                    {" · "}
                    {t.scope}
                    {" · "}
                    {t.last_used_at
                      ? `last used ${new Date(t.last_used_at).toLocaleString()}`
                      : "never used"}
                  </div>
                </div>
                <button
                  onClick={() => revoke(t.id)}
                  className="text-red-600 hover:text-red-800"
                  title="Revoke"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
