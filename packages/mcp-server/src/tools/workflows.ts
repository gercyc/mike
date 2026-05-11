import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MikeClient } from "@mike/shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function registerWorkflowTools(
  server: McpServer,
  client: MikeClient,
) {
  (server as any).tool(
    "list_workflows",
    "List the user's saved workflows (assistant + tabular).",
    {},
    async () => {
      const workflows = await client.listWorkflows();
      return {
        content: [{ type: "text", text: JSON.stringify(workflows, null, 2) }],
      };
    },
  );
}
