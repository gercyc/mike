/**
 * Storage utilities for Mike document management.
 * Supports multiple S3-compatible backends via STORAGE_PROVIDER env var.
 *
 * STORAGE_PROVIDER = "r2" (default) | "minio"
 *
 * Cloudflare R2 env vars:
 *   R2_ENDPOINT_URL       — https://<account-id>.r2.cloudflarestorage.com
 *   R2_ACCESS_KEY_ID      — R2 API token (Access Key ID)
 *   R2_SECRET_ACCESS_KEY  — R2 API token (Secret Access Key)
 *   R2_BUCKET_NAME        — bucket name (default: "mike")
 *
 * MinIO env vars:
 *   MINIO_ENDPOINT_URL    — http(s)://<host>:<port>
 *   MINIO_ACCESS_KEY_ID   — MinIO access key
 *   MINIO_SECRET_ACCESS_KEY — MinIO secret key
 *   MINIO_BUCKET_NAME     — bucket name (default: "mike")
 *   MINIO_REGION          — region (default: "us-east-1")
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";

type StorageProvider = "r2" | "minio";

function getProvider(): StorageProvider {
  const val = (process.env.STORAGE_PROVIDER ?? "r2").toLowerCase();
  if (val === "minio") return "minio";
  return "r2";
}

function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ENDPOINT_URL &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY,
  );
}

function isMinioConfigured(): boolean {
  return Boolean(
    process.env.MINIO_ENDPOINT_URL &&
    process.env.MINIO_ACCESS_KEY_ID &&
    process.env.MINIO_SECRET_ACCESS_KEY,
  );
}

export const storageEnabled =
  getProvider() === "minio" ? isMinioConfigured() : isR2Configured();

let cachedClient: S3Client | undefined;

function getClient(): S3Client {
  if (!cachedClient) {
    const provider = getProvider();
    if (provider === "minio") {
      cachedClient = new S3Client({
        region: process.env.MINIO_REGION ?? "us-east-1",
        endpoint: process.env.MINIO_ENDPOINT_URL!,
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.MINIO_ACCESS_KEY_ID!,
          secretAccessKey: process.env.MINIO_SECRET_ACCESS_KEY!,
        },
      });
    } else {
      cachedClient = new S3Client({
        region: "auto",
        endpoint: process.env.R2_ENDPOINT_URL!,
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      });
    }
  }
  return cachedClient;
}

function getBucket(): string {
  const provider = getProvider();
  if (provider === "minio") {
    return process.env.MINIO_BUCKET_NAME ?? "mike";
  }
  return process.env.R2_BUCKET_NAME ?? "mike";
}

function requireStorageConfig(): void {
  if (!storageEnabled) {
    const provider = getProvider();
    if (provider === "minio") {
      throw new Error(
        "MINIO_ENDPOINT_URL, MINIO_ACCESS_KEY_ID, and MINIO_SECRET_ACCESS_KEY must be set",
      );
    }
    throw new Error(
      "R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must be set",
    );
  }
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export async function uploadFile(
  key: string,
  content: ArrayBuffer,
  contentType: string,
): Promise<void> {
  requireStorageConfig();
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: Buffer.from(content),
      ContentType: contentType,
    }),
  );
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

export async function downloadFile(key: string): Promise<ArrayBuffer | null> {
  if (!storageEnabled) return null;
  try {
    const client = getClient();
    const response = await client.send(
      new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    );
    if (!response.Body) return null;
    const bytes = await response.Body.transformToByteArray();
    return bytes.buffer as ArrayBuffer;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteFile(key: string): Promise<void> {
  if (!storageEnabled) return;
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

// ---------------------------------------------------------------------------
// Signed URL (pre-signed for temporary direct access)
// ---------------------------------------------------------------------------

export async function getSignedUrl(
  key: string,
  expiresIn = 3600,
  downloadFilename?: string,
): Promise<string | null> {
  if (!storageEnabled) return null;
  try {
    const client = getClient();
    // Override the response Content-Disposition so the browser uses this
    // filename on download, instead of the last path segment of the storage key
    // (which includes the document UUID). The `download` attribute on <a>
    // is ignored for cross-origin URLs, so we have to set it server-side.
    const responseContentDisposition = downloadFilename
      ? buildContentDisposition("attachment", downloadFilename)
      : undefined;
    const command = new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
      ResponseContentDisposition: responseContentDisposition,
    });
    return await awsGetSignedUrl(client, command, { expiresIn });
  } catch {
    return null;
  }
}

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
// Storage key helpers
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
