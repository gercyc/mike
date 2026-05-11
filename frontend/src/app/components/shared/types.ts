// This file is now a thin re-export of the canonical types in @mike/shared.
// All Mike domain types (projects, documents, chats, AI keys, MCP, redaction)
// live in packages/shared/src/types.ts so backend, frontend, word-addin,
// electron, and the MCP server stay in lockstep.
//
// Existing frontend imports of the form
//   import type { MikeProject } from "@/app/components/shared/types"
// keep working unchanged.

export * from "@mike/shared";
