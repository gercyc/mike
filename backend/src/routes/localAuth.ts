// /auth/* — local password + session management. Wave 1 of the local
// refactor: there is exactly one user (conceptually `local`), gated by
// a single bcrypt password set at first launch.

import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import {
  initializeSecrets,
  unlockSecretsWithPassword,
  lockSecrets,
} from "../lib/secrets";

export const localAuthRouter = Router();

const SESSION_COOKIE = "mike_session";
const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  // The Electron shell + add-in talk to us over plain HTTP on loopback,
  // so we don't force `secure` here. Wire that on once we're on HTTPS.
  secure: false,
  path: "/",
};

function readPasswordRow(): { password_hash: string } | null {
  return (
    (db
      .prepare("SELECT password_hash FROM local_auth WHERE id = 1")
      .get() as { password_hash: string } | undefined) ?? null
  );
}

function readSessionToken(req: import("express").Request): string | null {
  const auth = req.headers.authorization ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const cookies = (req as { cookies?: Record<string, string> }).cookies;
  return cookies?.[SESSION_COOKIE] ?? null;
}

// GET /auth/status
localAuthRouter.get("/status", (req, res) => {
  const initialized = !!readPasswordRow();
  const token = readSessionToken(req);
  let authenticated = false;
  if (token) {
    const row = db
      .prepare("SELECT token FROM sessions WHERE token = ?")
      .get(token);
    authenticated = !!row;
  }
  res.json({ initialized, authenticated });
});

function mintSession(): string {
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare(
    `INSERT INTO sessions (token, created_at, last_seen) VALUES (?, datetime('now'), datetime('now'))`,
  ).run(token);
  return token;
}

// POST /auth/setup { password }
//
// On success we ALSO mint a session and return `{ token }` so the client is
// immediately authenticated — saves the user from having to log in straight
// after setting their password. Wrapped in try/catch because Express 4 does
// not auto-forward async rejections; without this the request would hang and
// the browser would surface "Failed to fetch".
localAuthRouter.post("/setup", async (req, res) => {
  try {
    if (readPasswordRow()) {
      return void res
        .status(409)
        .json({ detail: "Password already set; use /auth/login instead." });
    }
    const password: unknown = req.body?.password;
    if (typeof password !== "string" || password.length < 4) {
      return void res
        .status(400)
        .json({ detail: "password is required (minimum 4 chars)" });
    }
    const hash = bcrypt.hashSync(password, 10);
    // Initialise the encrypted secrets file FIRST. If it throws, we want to
    // bail before the password row is committed — otherwise the user ends up
    // with a half-set-up profile (password saved, secrets missing) that the
    // login flow can't fully recover.
    await initializeSecrets(password);
    db.prepare(
      "INSERT INTO local_auth (id, password_hash) VALUES (1, ?)",
    ).run(hash);
    const token = mintSession();
    res.cookie(SESSION_COOKIE, token, SESSION_COOKIE_OPTS);
    res.json({ token });
  } catch (err) {
    console.error("[auth/setup]", err);
    res
      .status(500)
      .json({ detail: `Setup failed: ${(err as Error).message}` });
  }
});

// POST /auth/login { password }
localAuthRouter.post("/login", async (req, res) => {
  try {
    const row = readPasswordRow();
    if (!row) {
      return void res
        .status(409)
        .json({ detail: "Password not set; call /auth/setup first." });
    }
    const password: unknown = req.body?.password;
    if (typeof password !== "string") {
      return void res.status(400).json({ detail: "password is required" });
    }
    if (!bcrypt.compareSync(password, row.password_hash)) {
      return void res.status(401).json({ detail: "Invalid password" });
    }
    // Wave 2: derive the secrets-file key while we have the plaintext.
    // If the secrets file is missing (e.g. an interrupted /auth/setup)
    // unlockSecretsWithPassword bootstraps it transparently.
    try {
      await unlockSecretsWithPassword(password);
    } catch (err) {
      return void res.status(500).json({
        detail: `Could not unlock local secrets store: ${(err as Error).message}`,
      });
    }
    const token = mintSession();
    res.cookie(SESSION_COOKIE, token, SESSION_COOKIE_OPTS);
    res.json({ token });
  } catch (err) {
    console.error("[auth/login]", err);
    res
      .status(500)
      .json({ detail: `Login failed: ${(err as Error).message}` });
  }
});

// POST /auth/logout
localAuthRouter.post("/logout", (req, res) => {
  const token = readSessionToken(req);
  if (token) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }
  // Drop the in-memory key + plaintext blob — local-only data, but no
  // reason to keep it warm once the user has explicitly logged out.
  lockSecrets();
  res.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTS);
  res.json({ ok: true });
});
