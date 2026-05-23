// Build the MCP server: registers all resources + tools and returns a
// configured McpServer ready to be connected to a transport.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MikeClient } from "@mike/shared";
import { registerProjectResources } from "./resources/projects";
import { registerProjectTools } from "./tools/projects";
import { registerDocumentTools } from "./tools/documents";
import { registerChatTools } from "./tools/chat";
import { registerWorkflowTools } from "./tools/workflows";

export interface BuildOptions {
  baseUrl: string;
  /** MCP token (mike_mcp_*) — exchanged for a Supabase JWT by the backend. */
  token: string;
}

export function buildServer(opts: BuildOptions): McpServer {
  const server = new McpServer(
    {
      name: "mike",
      version: "0.1.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    },
  );

  // The MCP token is sent as a Bearer credential. The backend's MCP token
  // middleware (see backend/src/middleware/mcpAuth.ts) accepts it and
  // resolves to the underlying user.
  const client = new MikeClient({
    baseUrl: opts.baseUrl,
    getAuthToken: async () => opts.token,
  });

  registerProjectResources(server, client);
  registerProjectTools(server, client);
  registerDocumentTools(server, client);
  registerChatTools(server, client);
  registerWorkflowTools(server, client);

  return server;
}
