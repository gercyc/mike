// /desktop/* — cross-surface coordination endpoints.
//
// Today this is just one route: the Word add-in calls /desktop/navigate to
// ask the Electron shell to focus its window and route to a particular
// page. Implemented as an eventBus publish so the existing SSE machinery
// does the delivery (and the Electron main process subscribes via
// loopback bypass — see electron/main.js).

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { eventBus } from "../lib/eventBus";

export const desktopRouter = Router();

desktopRouter.post("/navigate", requireAuth, (req, res) => {
  const userId = res.locals.userId as string;
  const route = typeof req.body?.route === "string" ? req.body.route : "";
  if (!route || !route.startsWith("/")) {
    return void res
      .status(400)
      .json({ detail: "route must be a path starting with /" });
  }
  eventBus.publish(userId, { type: "desktop.navigate", route });
  res.json({ ok: true });
});
