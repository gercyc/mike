// Wave 3: desktop ↔ Word-add-in pairing.
//
// Both surfaces talk to the same backend over loopback, but they live in
// independent browser contexts and don't share cookies/localStorage. So we
// use a short-lived 6-digit code as the bridge:
//
//   POST /auth/pair/create   (desktop, authenticated)
//        → { code, expiresInSeconds }
//   POST /auth/pair/redeem   (add-in, no auth)
//        body: { code }
//        → { token }
//
// Both endpoints are loopback-only — a local-only app should never expose
// this surface to other machines.

import { Router } from "express";
import crypto from "node:crypto";
import { db } from "../lib/db";
import { requireAuth } from "../middleware/auth";

export const pairRouter = Router();

const LOOPBACK_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const CODE_TTL_SECONDS = 60;

function isLoopback(req: import("express").Request): boolean {
  return LOOPBACK_IPS.has(req.ip ?? "");
}

function deleteExpired(): void {
  db.prepare("DELETE FROM pair_codes WHERE expires_at < datetime('now')").run();
}

function generateCode(): string {
  // 6 digits, zero-padded.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

// POST /auth/pair/create — caller must already have a session.
pairRouter.post("/create", requireAuth, (req, res) => {
  if (!isLoopback(req)) {
    return void res.status(403).json({ detail: "Loopback only" });
  }
  deleteExpired();
  // Mint a brand-new session token (separate from the desktop's). We store
  // it on the row keyed by the 6-digit code; the add-in redeems and uses it.
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare(
    "INSERT INTO sessions (token, created_at, last_seen) VALUES (?, datetime('now'), datetime('now'))",
  ).run(token);

  // Generate a unique code (extremely unlikely to collide given the TTL).
  let code = generateCode();
  for (let i = 0; i < 5; i++) {
    const exists = db
      .prepare("SELECT code FROM pair_codes WHERE code = ?")
      .get(code);
    if (!exists) break;
    code = generateCode();
  }
  db.prepare(
    "INSERT INTO pair_codes (code, session_token, expires_at) VALUES (?, ?, datetime('now', ?))",
  ).run(code, token, `+${CODE_TTL_SECONDS} seconds`);

  res.json({ code, expiresInSeconds: CODE_TTL_SECONDS });
});

// POST /auth/pair/redeem { code } — anonymous, loopback only. Returns the
// session token the add-in should store.
pairRouter.post("/redeem", (req, res) => {
  if (!isLoopback(req)) {
    return void res.status(403).json({ detail: "Loopback only" });
  }
  deleteExpired();
  const code: unknown = req.body?.code;
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
    return void res
      .status(400)
      .json({ detail: "code must be a 6-digit string" });
  }
  const row = db
    .prepare(
      "SELECT session_token FROM pair_codes WHERE code = ? AND expires_at > datetime('now')",
    )
    .get(code) as { session_token: string } | undefined;
  if (!row) {
    return void res
      .status(404)
      .json({ detail: "Code is invalid or expired" });
  }
  db.prepare("DELETE FROM pair_codes WHERE code = ?").run(code);
  res.json({ token: row.session_token });
});
