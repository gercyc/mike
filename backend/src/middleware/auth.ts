// LOCAL-MIGRATION (Wave 1): replaced Supabase JWT verification with a
// SQLite-backed session lookup. The exported shape is intentionally
// preserved (`requireAuth(req, res, next)` populating `res.locals.userId`)
// so route files don't change.
//
// Accepts:
//   * Authorization: Bearer <session_token>
//   * Cookie:        mike_session=<session_token>
//   * Loopback hatch: a request from 127.0.0.1/::1 carrying header
//     `x-mike-loopback: 1` is accepted without a session. This is what
//     the Wave 3 Electron shell will use for in-process API calls; the
//     custom header makes drive-by attacks (e.g. localhost web pages)
//     much harder because browsers can't set arbitrary headers
//     cross-origin without CORS.
//
// In local mode there is exactly one user, conceptually `id = "local"`.

import { Request, Response, NextFunction } from "express";
import { db } from "../lib/db";

const LOOPBACK_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function isLoopback(req: Request): boolean {
  const ip = req.ip ?? "";
  return LOOPBACK_IPS.has(ip);
}

function readSessionToken(req: Request): string | null {
  const auth = req.headers.authorization ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  // express's cookie-parser populates req.cookies.
  const cookies = (req as Request & { cookies?: Record<string, string> })
    .cookies;
  if (cookies?.mike_session) return cookies.mike_session;
  return null;
}

function setLocalUser(res: Response, token: string | null) {
  res.locals.userId = "local";
  res.locals.userEmail = "";
  res.locals.token = token ?? "";
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Loopback + magic header bypass. Documented above.
  if (isLoopback(req) && req.headers["x-mike-loopback"] === "1") {
    setLocalUser(res, null);
    next();
    return;
  }

  const token = readSessionToken(req);
  if (!token) {
    res.status(401).json({ detail: "Missing session" });
    return;
  }
  const row = db
    .prepare("SELECT token FROM sessions WHERE token = ?")
    .get(token) as { token: string } | undefined;
  if (!row) {
    res.status(401).json({ detail: "Invalid or expired session" });
    return;
  }
  // Best-effort touch.
  db.prepare(
    "UPDATE sessions SET last_seen = datetime('now') WHERE token = ?",
  ).run(token);

  setLocalUser(res, token);
  next();
}
