// Backend → clients SSE event bus payloads (Phase 2 bridge).
//
// Both the Next.js frontend and the Word add-in subscribe to GET /events
// and react to these so a project/document/chat created in one surface
// appears live in the other.

import type { MikeProject, MikeDocument, MikeChat, MikeFolder } from "./types";

export type MikeBridgeEvent =
  | { type: "ping"; ts: number }
  | { type: "project.created"; project: MikeProject }
  | { type: "project.updated"; project: MikeProject }
  | { type: "project.deleted"; project_id: string }
  | { type: "folder.created"; folder: MikeFolder }
  | { type: "folder.deleted"; folder_id: string }
  | { type: "document.created"; document: MikeDocument }
  | { type: "document.updated"; document: MikeDocument }
  | { type: "document.deleted"; document_id: string }
  | { type: "chat.created"; chat: MikeChat }
  | { type: "chat.deleted"; chat_id: string }
  | {
      type: "chat.message_appended";
      chat_id: string;
      message_id: string;
    }
  | {
      type: "ai_keys.updated";
      providers: string[];
    }
  | {
      type: "mcp.status";
      running: boolean;
      transports: ("stdio" | "http")[];
      port?: number;
    }
  | {
      /**
       * Cross-surface "Open in desktop" jump. Emitted when the Word add-in
       * (or another surface) wants to focus the Mike desktop window and
       * navigate it to a specific route. Replaces the `mike://` URL scheme,
       * which is unreliable in dev mode because macOS LaunchServices binds
       * the scheme to the generic Electron binary rather than this app.
       */
      type: "desktop.navigate";
      /** Frontend route, e.g. `/projects/abc-123` or `/tabular-reviews/xyz`. */
      route: string;
    };

/** Discriminator helper for narrowing events in switch statements. */
export type MikeBridgeEventType = MikeBridgeEvent["type"];
