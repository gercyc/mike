// Portable, file-backed secrets store for local-mode Mike.
//
// Wave 2 of the local refactor moves AI provider keys out of SQLite (where
// they were encrypted with a process-derived key) into a single encrypted
// file at `~/.mike/secrets.enc`, derived from the user's local password.
//
// Layout
// ------
//   ~/.mike/secrets.salt    — 16 random bytes; created at /auth/setup.
//   ~/.mike/secrets.enc     — `v1.<iv:12B>.<tag:16B>.<ciphertext>` (binary).
//
// Encryption: AES-256-GCM. Key: scrypt(password, salt, 32). Plaintext is the
// JSON-serialised secrets blob `{ anthropic, openai, gemini, openrouter,
// custom }`.
//
// Lifecycle
// ---------
//   * /auth/setup  → initializeSecrets(password): creates salt + empty blob.
//   * /auth/login  → unlockSecretsWithPassword(password): derives key, reads
//                    + decrypts file into the in-process cache.
//   * /auth/logout → lockSecrets(): clears the cache.
//
// Single-user app: cache is global to the process. Routes that need to
// read keys go through getSecretsCache(); they get null if the user
// hasn't logged in yet (which yields a clean "401-ish" upstream).
//
// SQLite migration note: we leave the legacy `user_profiles.ai_keys`
// column in place (SQLite ALTER limitations make dropping awkward) but
// stop reading and writing it.  See migrations/sqlite/002_drop_ai_keys_column.sql.

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const ALGO = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
const SALT_LEN = 16;
const SCRYPT_N = 1 << 15; // 32768; ~50ms on commodity hardware.
const SCRYPT_r = 8;
const SCRYPT_p = 1;

const MIKE_DIR = path.join(os.homedir(), ".mike");
const SALT_PATH = path.join(MIKE_DIR, "secrets.salt");
const ENC_PATH = path.join(MIKE_DIR, "secrets.enc");

export interface SecretsBlob {
  anthropic?: string;
  openai?: string;
  gemini?: string;
  openrouter?: string;
  custom?: string;
}

interface CacheState {
  key: Buffer;
  data: SecretsBlob;
}

let cache: CacheState | null = null;

async function ensureMikeDir(): Promise<void> {
  await fs.mkdir(MIKE_DIR, { recursive: true, mode: 0o700 });
}

async function readSalt(): Promise<Buffer | null> {
  try {
    const buf = await fs.readFile(SALT_PATH);
    if (buf.length !== SALT_LEN) {
      throw new Error(`secrets.salt has unexpected length ${buf.length}`);
    }
    return buf;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

async function writeSalt(salt: Buffer): Promise<void> {
  await ensureMikeDir();
  const tmp = `${SALT_PATH}.tmp`;
  await fs.writeFile(tmp, salt, { mode: 0o600 });
  await fs.rename(tmp, SALT_PATH);
}

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      KEY_LEN,
      // Node's default `maxmem` is 32 MiB. Our params need 128*N*r = 32 MiB
      // exactly, which trips OpenSSL's "memory limit exceeded" guard. Bump
      // the cap to 64 MiB so the derivation fits comfortably.
      { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p, maxmem: 64 * 1024 * 1024 },
      (err, derived) => (err ? reject(err) : resolve(derived as Buffer)),
    );
  });
}

function encryptBlob(key: Buffer, data: SecretsBlob): Buffer {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Header: magic "MK1\0" + iv(12) + tag(16) + ciphertext.
  const header = Buffer.from([0x4d, 0x4b, 0x31, 0x00]);
  return Buffer.concat([header, iv, tag, enc]);
}

function decryptBlob(key: Buffer, file: Buffer): SecretsBlob {
  if (file.length < 4 + IV_LEN + TAG_LEN) {
    throw new Error("secrets.enc is truncated or corrupt");
  }
  if (
    file[0] !== 0x4d ||
    file[1] !== 0x4b ||
    file[2] !== 0x31 ||
    file[3] !== 0x00
  ) {
    throw new Error("secrets.enc has an unrecognised header");
  }
  const iv = file.subarray(4, 4 + IV_LEN);
  const tag = file.subarray(4 + IV_LEN, 4 + IV_LEN + TAG_LEN);
  const enc = file.subarray(4 + IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(dec.toString("utf8")) as SecretsBlob;
}

async function writeEncFile(key: Buffer, data: SecretsBlob): Promise<void> {
  await ensureMikeDir();
  const buf = encryptBlob(key, data);
  const tmp = `${ENC_PATH}.tmp`;
  await fs.writeFile(tmp, buf, { mode: 0o600 });
  await fs.rename(tmp, ENC_PATH);
}

async function readEncFile(): Promise<Buffer | null> {
  try {
    return await fs.readFile(ENC_PATH);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

/**
 * Called from /auth/setup when a fresh local password is created.
 * Generates a salt and writes an empty encrypted secrets file.
 */
export async function initializeSecrets(password: string): Promise<void> {
  await ensureMikeDir();
  let salt = await readSalt();
  if (!salt) {
    salt = crypto.randomBytes(SALT_LEN);
    await writeSalt(salt);
  }
  const key = await deriveKey(password, salt);
  const data: SecretsBlob = {};
  await writeEncFile(key, data);
  cache = { key, data };
}

/**
 * Called from /auth/login. Derives the key, decrypts the file, and parks
 * it in the in-memory cache. If the file is missing (e.g. legacy install
 * that pre-dates Wave 2) it's transparently created empty.
 */
export async function unlockSecretsWithPassword(
  password: string,
): Promise<void> {
  await ensureMikeDir();
  let salt = await readSalt();
  if (!salt) {
    // First login on a Wave-1-only profile; bootstrap a salt now.
    salt = crypto.randomBytes(SALT_LEN);
    await writeSalt(salt);
  }
  const key = await deriveKey(password, salt);
  const file = await readEncFile();
  let data: SecretsBlob;
  if (!file) {
    data = {};
    await writeEncFile(key, data);
  } else {
    data = decryptBlob(key, file);
  }
  cache = { key, data };
}

/** Drops the in-memory key + plaintext. Called from /auth/logout. */
export function lockSecrets(): void {
  if (cache) {
    cache.key.fill(0);
  }
  cache = null;
}

/** Returns the decrypted secrets, or null if the user hasn't logged in. */
export function getSecretsCache(): SecretsBlob | null {
  return cache ? cache.data : null;
}

/**
 * Replace the in-memory secrets blob and persist it atomically.
 * Throws if the cache hasn't been unlocked yet.
 */
export async function writeSecrets(next: SecretsBlob): Promise<void> {
  if (!cache) {
    throw new Error(
      "Secrets store is locked — log in before reading or writing AI keys.",
    );
  }
  cache.data = next;
  await writeEncFile(cache.key, next);
}

/** Mask a key for client display: keep last 4 chars, mask the rest. */
export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  const tail = key.slice(-4);
  const head = key.slice(0, 6);
  return `${head}${"•".repeat(8)}${tail}`;
}

// Test/maintenance helper: indicates whether setup has been run.
export async function secretsInitialized(): Promise<boolean> {
  const salt = await readSalt();
  return !!salt;
}

export const __paths = { MIKE_DIR, SALT_PATH, ENC_PATH };
