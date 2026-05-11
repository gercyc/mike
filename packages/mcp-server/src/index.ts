#!/usr/bin/env node
// Mike MCP server entry point.
//
// Modes:
//   mike-mcp stdio          — Claude Desktop / Cursor connector
//   mike-mcp http [--port N] — local HTTP+SSE transport for remote agents
//
// Auth: requires a MIKE_TOKEN env var (long-lived MCP token issued from
// Mike Settings → MCP Server). The token is exchanged for a per-request
// Supabase JWT by the backend.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server";

async function main() {
  const mode = process.argv[2] ?? "stdio";

  const baseUrl = process.env.MIKE_BACKEND_URL ?? "http://127.0.0.1:3001";
  const token = process.env.MIKE_TOKEN;
  if (!token) {
    console.error(
      "MIKE_TOKEN env var is required. Issue one in Mike → Settings → MCP Server.",
    );
    process.exit(1);
  }

  const server = buildServer({ baseUrl, token });

  switch (mode) {
    case "stdio": {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      // stdio runs forever; nothing else to do.
      break;
    }
    case "http": {
      // HTTP+SSE transport is wired up by the Electron host (see electron/
      // main process), since the SDK's HTTP transport requires an Express-
      // style server we don't want this binary to own. Refusing here keeps
      // the surface honest.
      console.error(
        "HTTP mode is started by the Electron app, not directly. " +
          "Run `mike-mcp stdio` instead, or enable the HTTP transport in " +
          "Mike → Settings → MCP Server.",
      );
      process.exit(2);
    }
    default:
      console.error(`Unknown mode: ${mode}`);
      process.exit(2);
  }
}

main().catch((err) => {
  console.error("[mike-mcp] fatal:", err);
  process.exit(1);
});
