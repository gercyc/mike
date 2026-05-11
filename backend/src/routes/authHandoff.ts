// LOCAL-MIGRATION (Wave 1): Supabase JWT handoff between Electron and the
// Word add-in is gone — the add-in (Wave 3) will use a local-mode session
// instead. Routes return 410 Gone so any caller still wired to the old API
// fails loudly. The router is kept registered to preserve the URL path.

import { Router } from "express";

export const authHandoffRouter = Router();

const GONE = {
  detail:
    "Supabase auth handoff has been removed. Use the local-password session flow (/auth/setup, /auth/login).",
};

authHandoffRouter.get("/", (_req, res) => void res.status(410).json(GONE));
authHandoffRouter.post("/install", (_req, res) =>
  void res.status(410).json(GONE),
);
authHandoffRouter.delete("/", (_req, res) => void res.status(410).json(GONE));
