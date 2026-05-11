import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createServerSupabase } from "../lib/supabase";

export const userRouter = Router();

// POST /user/profile
userRouter.post("/profile", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const db = createServerSupabase();
  const { error } = await db
    .from("user_profiles")
    .upsert(
      { user_id: userId },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (error) return void res.status(500).json({ detail: error.message });
  res.json({ ok: true });
});

// DELETE /user/account
// LOCAL-MIGRATION: in local mode the "account" is the password row + all
// derived data. We wipe the local_auth row + sessions so the next launch
// goes through /auth/setup again. Project/document data is left in place
// so the user can reuse it after re-setup; Wave 2 may revisit this.
userRouter.delete("/account", requireAuth, async (_req, res) => {
  const { db } = await import("../lib/db");
  db.prepare("DELETE FROM local_auth").run();
  db.prepare("DELETE FROM sessions").run();
  res.status(204).send();
});
