import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MikeClient } from "@mike/shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function registerDocumentTools(
  server: McpServer,
  client: MikeClient,
) {
  (server as any).tool(
    "list_project_documents",
    "List all documents in a project, with filename, type, and status.",
    { project_id: z.string() },
    async ({ project_id }: { project_id: string }) => {
      const docs = await client.listProjectDocuments(project_id);
      return {
        content: [{ type: "text", text: JSON.stringify(docs, null, 2) }],
      };
    },
  );

  (server as any).tool(
    "list_single_documents",
    "List the user's standalone documents (not attached to any project).",
    {},
    async () => {
      const docs = await client.listSingleDocuments();
      return {
        content: [{ type: "text", text: JSON.stringify(docs, null, 2) }],
      };
    },
  );
}
