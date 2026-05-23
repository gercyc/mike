/**
 * In-memory file-token registry.
 *
 * Each token maps to a storage key + optional download metadata, with a TTL.
 * Tokens are multi-use until they expire (so a browser can fetch a single
 * URL multiple times for caching) and are evicted by a periodic GC.
 */
import crypto from "node:crypto";

export interface FileTokenEntry {
  key: string;
  filename?: string;
  contentType?: string;
  expiresAt: number; // epoch ms
}

export interface CreateFileTokenOpts {
  key: string;
  filename?: string;
  contentType?: string;
  expiresIn?: number; // seconds
}

const tokens = new Map<string, FileTokenEntry>();

export function createFileToken(opts: CreateFileTokenOpts): string {
  const token = crypto.randomBytes(32).toString("hex");
  const ttlSec = opts.expiresIn ?? 3600;
  tokens.set(token, {
    key: opts.key,
    filename: opts.filename,
    contentType: opts.contentType,
    expiresAt: Date.now() + ttlSec * 1000,
  });
  return token;
}

export function consumeFileToken(token: string): FileTokenEntry | null {
  const entry = tokens.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    tokens.delete(token);
    return null;
  }
  return entry;
}

// Periodic GC. Runs every 5 minutes, removing expired entries.
const GC_INTERVAL_MS = 5 * 60 * 1000;
const gcTimer = setInterval(() => {
  const now = Date.now();
  for (const [tok, entry] of tokens.entries()) {
    if (entry.expiresAt < now) tokens.delete(tok);
  }
}, GC_INTERVAL_MS);
// Don't keep the event loop alive just for GC.
if (typeof gcTimer.unref === "function") gcTimer.unref();
