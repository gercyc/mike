// In-process pub/sub for cross-surface live updates between the Next.js
// frontend and the Word add-in. Backend modules call `publish(userId, event)`
// when state changes; subscribers receive only events scoped to their user.
//
// Phase 2 of the Mike desktop migration. The transport on the wire is SSE
// (see routes/events.ts).

import { EventEmitter } from "node:events";
import type { MikeBridgeEvent } from "@mike/shared";

class MikeEventBus {
  private emitter = new EventEmitter();

  constructor() {
    // We may have many simultaneous subscribers (one per open client tab
    // or add-in pane). Bump the soft cap to avoid Node's memory-leak warning.
    this.emitter.setMaxListeners(100);
  }

  publish(userId: string, event: MikeBridgeEvent): void {
    this.emitter.emit(`user:${userId}`, event);
    // Also fan out to a wildcard channel — useful for the MCP server, which
    // is per-user but identifies via a different token type.
    this.emitter.emit("*", { userId, event });
  }

  subscribe(
    userId: string,
    listener: (event: MikeBridgeEvent) => void,
  ): () => void {
    const channel = `user:${userId}`;
    this.emitter.on(channel, listener);
    return () => this.emitter.off(channel, listener);
  }
}

export const eventBus = new MikeEventBus();
