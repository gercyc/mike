// SSE event bus — frontend + word-addin subscribe here for live cross-surface
// updates (project created, document uploaded, chat message appended, etc).

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { eventBus } from "../lib/eventBus";
import type { MikeBridgeEvent } from "@mike/shared";

export const eventsRouter = Router();

eventsRouter.get("/", requireAuth, (req, res) => {
  const userId = res.locals.userId as string;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: MikeBridgeEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Initial ping so clients know the stream is open.
  send({ type: "ping", ts: Date.now() });

  // Heartbeat every 20s keeps proxies and Office's task pane from cutting us
  // off. Word's web view is particularly aggressive about idle connections.
  const heartbeat = setInterval(
    () => send({ type: "ping", ts: Date.now() }),
    20_000,
  );

  const unsubscribe = eventBus.subscribe(userId, send);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});
