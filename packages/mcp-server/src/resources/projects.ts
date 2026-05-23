import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MikeClient } from "@mike/shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function registerProjectResources(
  server: McpServer,
  client: MikeClient,
) {
  (server as any).resource(
    "projects",
    "mike://projects",
    {
      title: "All projects",
      description:
        "List every project the authenticated user owns or has access to.",
      mimeType: "application/json",
    },
    async () => {
      const projects = await client.listProjects();
      return {
        contents: [
          {
            uri: "mike://projects",
            mimeType: "application/json",
            text: JSON.stringify(projects, null, 2),
          },
        ],
      };
    },
  );

  (server as any).resource(
    "project",
    "mike://projects/{id}",
    {
      title: "Project detail",
      description: "Project metadata, folder tree, and document list.",
      mimeType: "application/json",
    },
    async (uri: URL) => {
      const m = uri.toString().match(/^mike:\/\/projects\/([^/]+)$/);
      if (!m) throw new Error(`Unrecognised project URI: ${uri}`);
      const project = await client.getProject(m[1]);
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "application/json",
            text: JSON.stringify(project, null, 2),
          },
        ],
      };
    },
  );
}
