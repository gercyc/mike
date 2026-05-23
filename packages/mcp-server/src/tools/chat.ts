import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MikeClient } from "@mike/shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function registerChatTools(server: McpServer, client: MikeClient) {
  (server as any).tool(
    "list_chats",
    "List the authenticated user's chat threads.",
    {},
    async () => {
      const chats = await client.listChats();
      return {
        content: [{ type: "text", text: JSON.stringify(chats, null, 2) }],
      };
    },
  );

  (server as any).tool(
    "get_chat",
    "Fetch a single chat thread with all of its messages.",
    { chat_id: z.string() },
    async ({ chat_id }: { chat_id: string }) => {
      const detail = await client.getChat(chat_id);
      return {
        content: [{ type: "text", text: JSON.stringify(detail, null, 2) }],
      };
    },
  );

  (server as any).tool(
    "send_chat",
    "Send a message to Mike. Optionally scope it to a project. The full " +
      "streamed response is collected and returned as text.",
    {
      message: z.string().min(1),
      chat_id: z.string().optional(),
      project_id: z.string().optional(),
      model: z.string().optional(),
      hidden: z
        .boolean()
        .optional()
        .describe(
          "When true, run Microsoft Presidio over the message before sending it to the AI provider, then unmask in the response. May reduce context quality.",
        ),
    },
    async (input: {
      message: string;
      chat_id?: string;
      project_id?: string;
      model?: string;
      hidden?: boolean;
    }) => {
      const res = await client.streamChat({
        messages: [{ role: "user", content: input.message }],
        chat_id: input.chat_id,
        project_id: input.project_id,
        model: input.model,
        hidden: input.hidden,
      });
      if (!res.ok || !res.body) {
        throw new Error(`Chat failed: ${res.status} ${res.statusText}`);
      }
      // Aggregate the SSE stream into a single text reply for MCP callers,
      // which don't have a native streaming primitive equivalent to ours.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let collected = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const m = block.match(/^data:\s*(.*)$/m);
          if (!m) continue;
          if (m[1] === "[DONE]") continue;
          try {
            const event = JSON.parse(m[1]);
            if (event.type === "text_chunk" && typeof event.text === "string") {
              collected += event.text;
            } else if (
              event.type === "content" &&
              typeof event.text === "string"
            ) {
              collected += event.text;
            }
          } catch {
            /* ignore */
          }
        }
      }
      return {
        content: [{ type: "text", text: collected || "(no response)" }],
      };
    },
  );
}
