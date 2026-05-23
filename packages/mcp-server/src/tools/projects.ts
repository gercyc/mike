// MCP tools for project CRUD. Read/write per Phase 4 spec — external
// agents (Claude Desktop, Cursor) can list, create, update, and delete
// projects on the user's behalf.
//
// We pass schemas as plain ZodRawShapes via `as any` to dodge the SDK's
// deeply nested overload-inference, which otherwise blows up tsc.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MikeClient } from "@mike/shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function registerProjectTools(server: McpServer, client: MikeClient) {
  (server as any).tool(
    "list_projects",
    "List every Mike project visible to the authenticated user.",
    {},
    async () => {
      const projects = await client.listProjects();
      return {
        content: [{ type: "text", text: JSON.stringify(projects, null, 2) }],
      };
    },
  );

  (server as any).tool(
    "get_project",
    "Fetch a single project including documents and folder tree.",
    { project_id: z.string().describe("UUID of the project.") },
    async ({ project_id }: { project_id: string }) => {
      const project = await client.getProject(project_id);
      return {
        content: [{ type: "text", text: JSON.stringify(project, null, 2) }],
      };
    },
  );

  (server as any).tool(
    "create_project",
    "Create a new Mike project.",
    {
      name: z.string().min(1),
      cm_number: z.string().optional(),
      shared_with: z.array(z.string().email()).optional(),
    },
    async (input: {
      name: string;
      cm_number?: string;
      shared_with?: string[];
    }) => {
      const project = await client.createProject(input);
      return {
        content: [{ type: "text", text: JSON.stringify(project, null, 2) }],
      };
    },
  );

  (server as any).tool(
    "update_project",
    "Rename a project, change its CM number, or update its share list.",
    {
      project_id: z.string(),
      name: z.string().optional(),
      cm_number: z.string().nullable().optional(),
      shared_with: z.array(z.string().email()).optional(),
    },
    async ({
      project_id,
      ...patch
    }: {
      project_id: string;
      name?: string;
      cm_number?: string | null;
      shared_with?: string[];
    }) => {
      const project = await client.updateProject(project_id, patch as any);
      return {
        content: [{ type: "text", text: JSON.stringify(project, null, 2) }],
      };
    },
  );

  (server as any).tool(
    "delete_project",
    "Permanently delete a project. This also removes documents and chats.",
    { project_id: z.string() },
    async ({ project_id }: { project_id: string }) => {
      await client.deleteProject(project_id);
      return {
        content: [{ type: "text", text: `Deleted project ${project_id}` }],
      };
    },
  );
}
