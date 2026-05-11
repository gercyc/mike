// LOCAL-MIGRATION (Wave 1): accepts EITHER an MCP token OR a regular local
// session token (replacing the previous Supabase JWT path). Same exported
// shape as before — populates `res.locals.userId` / `tokenScope`.

import { Request, Response, NextFunction } from "express";
import { db } from "../lib/db";
import { resolveMcpToken } from "../lib/mcpTokens";

export async function requireAuthOrMcp(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.headers.authorization ?? "";
  if (!auth.startsWith("Bearer ")) {
    res.status(401).json({ detail: "Missing Authorization header" });
    return;
  }
  const token = auth.slice(7).trim();

  if (token.startsWith("mike_mcp_")) {
    const resolved = await resolveMcpToken(token);
    if (!resolved) {
      res.status(401).json({ detail: "Invalid MCP token" });
      return;
    }
    res.locals.userId = resolved.user_id;
    res.locals.userEmail = "";
    res.locals.tokenScope = resolved.scope;
    res.locals.tokenKind = "mcp";
    next();
    return;
  }

  // Otherwise treat as a local session token.
  const row = db
    .prepare("SELECT token FROM sessions WHERE token = ?")
    .get(token) as { token: string } | undefined;
  if (!row) {
    res.status(401).json({ detail: "Invalid token" });
    return;
  }
  res.locals.userId = "local";
  res.locals.userEmail = "";
  res.locals.tokenScope = "read_write" as const;
  res.locals.tokenKind = "session";
  next();
}
