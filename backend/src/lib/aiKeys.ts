// Read/write per-user AI provider keys.
//
// Wave 2: keys live in `~/.mike/secrets.enc` (AES-256-GCM, key derived
// from the local password via scrypt — see `lib/secrets.ts`). The
// SQLite `user_profiles.ai_keys` column is no longer read or written;
// it remains in the schema only to keep migrations simple.
//
// `userId` is always "local" in single-user mode but the parameter is
// kept for source compatibility with the previous Supabase shape.

import {
  getSecretsCache,
  writeSecrets,
  maskKey,
  type SecretsBlob,
} from "./secrets";
import type { AiKeysMap, AiProvider, AiProviderKey } from "@mike/shared";

const PROVIDERS: AiProvider[] = [
  "anthropic",
  "openai",
  "gemini",
  "openrouter",
  "custom",
];

interface ProviderMeta {
  enabled: boolean;
  label?: string;
  base_url?: string;
  default_model?: string;
}

/**
 * On-disk shape inside the encrypted blob.
 *
 *   { anthropic: "sk-ant-...", openai: "...", ..., _meta: { anthropic: { enabled, label, ... }, ... } }
 *
 * The plaintext fields exactly match the documented Wave-2 shape. The
 * sibling `_meta` map carries the route-layer metadata (enabled flag,
 * custom-provider label/base_url/default_model). It's stored alongside
 * the keys, not in SQLite, so the secrets file stays portable.
 */
interface EncBlob extends SecretsBlob {
  _meta?: Partial<Record<AiProvider, ProviderMeta>>;
}

function readBlob(): EncBlob {
  const cache = getSecretsCache();
  if (!cache) {
    // Locked store: behave as "no keys configured" rather than throwing,
    // so unauthenticated callers get clean empty responses upstream.
    return {};
  }
  return cache as EncBlob;
}

async function commitBlob(next: EncBlob): Promise<void> {
  await writeSecrets(next);
}

function getKeyFor(blob: EncBlob, provider: AiProvider): string | null {
  const v = blob[provider as keyof SecretsBlob];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function setKeyFor(blob: EncBlob, provider: AiProvider, key: string | null) {
  if (key) {
    blob[provider as keyof SecretsBlob] = key;
  } else {
    delete blob[provider as keyof SecretsBlob];
  }
}

function getMetaFor(blob: EncBlob, provider: AiProvider): ProviderMeta {
  return blob._meta?.[provider] ?? { enabled: false };
}

function setMetaFor(blob: EncBlob, provider: AiProvider, meta: ProviderMeta) {
  if (!blob._meta) blob._meta = {};
  blob._meta[provider] = meta;
}

// ---------------------------------------------------------------------------
// Public API — names below match the original Supabase-backed shape so
// route handlers (and any future consumer) don't change.
// ---------------------------------------------------------------------------

/** Returns a masked, client-safe view of all configured keys. */
export async function getAiKeysMasked(_userId: string): Promise<AiKeysMap> {
  const blob = readBlob();
  const out: AiKeysMap = {};
  for (const prov of PROVIDERS) {
    const key = getKeyFor(blob, prov);
    const meta = getMetaFor(blob, prov);
    if (!key && !blob._meta?.[prov]) continue;
    out[prov] = {
      enabled: meta.enabled,
      key: key ? maskKey(key) : null,
      label: meta.label,
      base_url: meta.base_url,
      default_model: meta.default_model,
    };
  }
  return out;
}

/** Look up a single provider's plaintext key, or null if not configured. */
export async function getDecryptedKey(
  _userId: string,
  provider: AiProvider,
): Promise<string | null> {
  const blob = readBlob();
  const meta = getMetaFor(blob, provider);
  if (!meta.enabled) return null;
  return getKeyFor(blob, provider);
}

/** Upsert a provider entry. */
export async function setAiKey(
  _userId: string,
  provider: AiProvider,
  patch: AiProviderKey,
): Promise<AiKeysMap> {
  if (!PROVIDERS.includes(provider)) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  const blob = { ...readBlob() };
  // If `key` is null the caller is just toggling enabled / changing label;
  // retain whatever ciphertext we already have. Empty string also means
  // "don't replace".
  if (typeof patch.key === "string" && patch.key.length > 0) {
    setKeyFor(blob, provider, patch.key);
  }
  setMetaFor(blob, provider, {
    enabled: patch.enabled,
    label: patch.label,
    base_url: patch.base_url,
    default_model: patch.default_model,
  });
  await commitBlob(blob);
  return getAiKeysMasked(_userId);
}

export async function deleteAiKey(
  _userId: string,
  provider: AiProvider,
): Promise<AiKeysMap> {
  const blob = { ...readBlob() };
  setKeyFor(blob, provider, null);
  if (blob._meta) delete blob._meta[provider];
  await commitBlob(blob);
  return getAiKeysMasked(_userId);
}

// ---------------------------------------------------------------------------
// Spec-named helpers (Wave 2 plan): legacy snake_case shape consumers can
// use without worrying about the AiProvider enum.
// ---------------------------------------------------------------------------

export interface UserAiKeysShape {
  claude_api_key: string | null;
  openai_api_key: string | null;
  gemini_api_key: string | null;
  openrouter_api_key: string | null;
}

export async function getUserAiKeys(
  _userId: string,
): Promise<UserAiKeysShape> {
  const blob = readBlob();
  return {
    claude_api_key: getKeyFor(blob, "anthropic"),
    openai_api_key: getKeyFor(blob, "openai"),
    gemini_api_key: getKeyFor(blob, "gemini"),
    openrouter_api_key: getKeyFor(blob, "openrouter"),
  };
}

export async function setUserAiKeys(
  _userId: string,
  keys: Partial<UserAiKeysShape>,
): Promise<UserAiKeysShape> {
  const blob = { ...readBlob() };
  if ("claude_api_key" in keys)
    setKeyFor(blob, "anthropic", keys.claude_api_key ?? null);
  if ("openai_api_key" in keys)
    setKeyFor(blob, "openai", keys.openai_api_key ?? null);
  if ("gemini_api_key" in keys)
    setKeyFor(blob, "gemini", keys.gemini_api_key ?? null);
  if ("openrouter_api_key" in keys)
    setKeyFor(blob, "openrouter", keys.openrouter_api_key ?? null);
  await commitBlob(blob);
  return getUserAiKeys(_userId);
}
