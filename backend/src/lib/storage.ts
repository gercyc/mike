/**
 * Local filesystem storage for Mike document management.
 *
 * Files live under `~/.mike/storage/` mirroring the prior R2 key layout, e.g.
 *   ~/.mike/storage/documents/{userId}/{docId}/source.docx
 *
 * Each stored file gets a sidecar `<file>.meta.json` with content-type, size
 * and creation timestamp so downloads can re-emit the original Content-Type.
 *
 * Replaces Cloudflare R2 / S3 presigned URLs with short-lived loopback
 * tokens served by the local backend (see lib/fileTokens.ts and routes/files.ts).
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createFileToken } from "./fileTokens";

// ---------------------------------------------------------------------------
// Storage root + key→path mapping
// ---------------------------------------------------------------------------

const STORAGE_ROOT = path.join(os.homedir(), ".mike", "storage");

function ensureRoot(): void {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

/**
 * Resolve a storage key to an absolute filesystem path inside STORAGE_ROOT.
 * Throws if the key would escape the root (path traversal protection).
 */
function resolveKey(key: string): string {
  if (typeof key !== "string" || key.length === 0) {
    throw new Error("storage: empty key");
  }
  if (key.includes("\0")) {
    throw new Error("storage: invalid key (null byte)");
  }
  // Reject any traversal segment outright.
  const segments = key.split(/[\\/]+/);
  for (const seg of segments) {
    if (seg === "..") throw new Error("storage: invalid key (traversal)");
  }
  const abs = path.resolve(STORAGE_ROOT, key);
  const rootWithSep = STORAGE_ROOT.endsWith(path.sep)
    ? STORAGE_ROOT
    : STORAGE_ROOT + path.sep;
  if (abs !== STORAGE_ROOT && !abs.startsWith(rootWithSep)) {
    throw new Error("storage: resolved path escapes root");
  }
  return abs;
}

function metaPathFor(absPath: string): string {
  return absPath + ".meta.json";
}

// Filesystem is always available, so storage is always enabled.
export const storageEnabled = true;

// ---------------------------------------------------------------------------
// Upload / Download / Delete
// ---------------------------------------------------------------------------

export async function uploadFile(
  key: string,
  content: ArrayBuffer,
  contentType: string,
): Promise<void> {
  ensureRoot();
  const abs = resolveKey(key);
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  const buf = Buffer.from(content);
  await fsp.writeFile(abs, buf);
  const meta = {
    contentType,
    size: buf.byteLength,
    createdAt: new Date().toISOString(),
  };
  await fsp.writeFile(metaPathFor(abs), JSON.stringify(meta), "utf8");
}

export async function downloadFile(key: string): Promise<ArrayBuffer | null> {
  let abs: string;
  try {
    abs = resolveKey(key);
  } catch {
    return null;
  }
  try {
    const buf = await fsp.readFile(abs);
    // Slice to a tight ArrayBuffer (Node Buffers can share underlying pool).
    return buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer;
  } catch {
    return null;
  }
}

export async function deleteFile(key: string): Promise<void> {
  let abs: string;
  try {
    abs = resolveKey(key);
  } catch {
    return;
  }
  await fsp.rm(abs, { force: true });
  await fsp.rm(metaPathFor(abs), { force: true });
}

/**
 * Read the sidecar metadata for a key, if present.
 */
export async function readFileMeta(
  key: string,
): Promise<{ contentType?: string; size?: number; createdAt?: string } | null> {
  let abs: string;
  try {
    abs = resolveKey(key);
  } catch {
    return null;
  }
  try {
    const raw = await fsp.readFile(metaPathFor(abs), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Signed URL replacement: short-lived loopback token URL
// ---------------------------------------------------------------------------

export async function getSignedUrl(
  key: string,
  expiresIn = 3600,
  downloadFilename?: string,
): Promise<string | null> {
  // Verify file exists so we don't hand out tokens for missing keys.
  let abs: string;
  try {
    abs = resolveKey(key);
  } catch {
    return null;
  }
  try {
    await fsp.access(abs);
  } catch {
    return null;
  }
  const meta = await readFileMeta(key);
  const token = createFileToken({
    key,
    filename: downloadFilename,
    contentType: meta?.contentType,
    expiresIn,
  });
  const port = process.env.PORT ?? "3001";
  return `http://127.0.0.1:${port}/files/${token}`;
}

// ---------------------------------------------------------------------------
// Filename / Content-Disposition helpers (unchanged)
// ---------------------------------------------------------------------------

export function normalizeDownloadFilename(name: string): string {
  const trimmed = name.trim();
  const base = trimmed || "download";
  return base.replace(/[\x00-\x1F\x7F]/g, "_").replace(/[\\/]/g, "_");
}

export function sanitizeDispositionFilename(name: string): string {
  return normalizeDownloadFilename(name)
    .replace(/["\\]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_");
}

export function encodeRFC5987(str: string): string {
  return encodeURIComponent(str).replace(
    /['()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

export function buildContentDisposition(
  kind: "inline" | "attachment",
  filename: string,
): string {
  const normalized = normalizeDownloadFilename(filename);
  return `${kind}; filename="${sanitizeDispositionFilename(normalized)}"; filename*=UTF-8''${encodeRFC5987(normalized)}`;
}

// ---------------------------------------------------------------------------
// Storage key helpers (unchanged — preserve callers)
// ---------------------------------------------------------------------------

export function storageKey(
  userId: string,
  docId: string,
  filename: string,
): string {
  return `documents/${userId}/${docId}/source${storageExtension(filename, ".bin")}`;
}

export function pdfStorageKey(
  userId: string,
  docId: string,
  stem: string,
): string {
  return `documents/${userId}/${docId}/${stem}.pdf`;
}

export function generatedDocKey(
  userId: string,
  docId: string,
  filename: string,
): string {
  return `generated/${userId}/${docId}/generated${storageExtension(filename, ".docx")}`;
}

export function versionStorageKey(
  userId: string,
  docId: string,
  versionSlug: string,
  filename: string,
): string {
  return `documents/${userId}/${docId}/versions/${versionSlug}${storageExtension(filename, ".bin")}`;
}

function storageExtension(filename: string, fallback: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot < 0) return fallback;
  const ext = filename.slice(lastDot).toLowerCase();
  return /^\.[a-z0-9]{1,16}$/.test(ext) ? ext : fallback;
}
